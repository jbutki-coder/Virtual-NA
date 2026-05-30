import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.static("public"));

const DEFAULT_TARGET_TIME_ZONE = "America/Detroit";

const BMLT_SOURCES = [
  {
    name: "Virtual NA / BMLT",
    fellowship: "NA",
    url: "https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults"
  }
];

const TIME_ZONE_ALIASES = {
  eastern: "America/New_York",
  east: "America/New_York",
  est: "America/New_York",
  edt: "America/New_York",
  michigan: "America/Detroit",
  detroit: "America/Detroit",

  central: "America/Chicago",
  cst: "America/Chicago",
  cdt: "America/Chicago",
  nebraska: "America/Chicago",

  mountain: "America/Denver",
  mst: "America/Denver",
  mdt: "America/Denver",

  pacific: "America/Los_Angeles",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles"
};

function normalizeTimeZone(value) {
  const raw = String(value || "").trim();

  if (!raw) return DEFAULT_TARGET_TIME_ZONE;

  const lower = raw.toLowerCase();

  if (TIME_ZONE_ALIASES[lower]) {
    return TIME_ZONE_ALIASES[lower];
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date());
    return raw;
  } catch {
    return DEFAULT_TARGET_TIME_ZONE;
  }
}

function extractUrls(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s"'<>]+/gi);
  return matches || [];
}

function isVirtualOrHybridText(value) {
  const text = String(value || "").toLowerCase();

  return Boolean(
    text.includes("virtual") ||
    text.includes("hybrid") ||
    text.includes("zoom") ||
    text.includes("meets virtually") ||
    text.includes("phone") ||
    text.includes("dial") ||
    text.includes("vm") ||
    text.includes("hy") ||
    text.includes("vo") ||
    text.includes("tc")
  );
}

function isVirtualMeeting(m) {
  const joined = [
    m.meeting_name,
    m.name,
    m.group_name,
    m.formats,
    m.format_shared_id_list,
    m.virtual_meeting_link,
    m.phone_meeting_number,
    m.virtual_meeting_additional_info,
    m.comments,
    m.location_text,
    m.location_info,
    m.venue_type
  ].join(" ");

  return Boolean(
    m.virtual_meeting_link ||
    m.phone_meeting_number ||
    m.virtual_meeting_additional_info ||
    String(m.formats || "").includes("VM") ||
    String(m.formats || "").includes("HY") ||
    String(m.formats || "").includes("TC") ||
    String(m.format_shared_id_list || "").includes("VM") ||
    String(m.format_shared_id_list || "").includes("HY") ||
    isVirtualOrHybridText(joined)
  );
}

function bmltWeekdayToZeroBased(value) {
  const n = Number(value || 0);

  if (!n) return 0;

  // BMLT usually uses 1 = Sunday through 7 = Saturday.
  return (n + 6) % 7;
}

function customWeekdayToZeroBased(value) {
  const n = Number(value || 0);

  // Your custom-meetings.json should use:
  // Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3,
  // Thursday = 4, Friday = 5, Saturday = 6
  if (n >= 0 && n <= 6) return n;

  // Backup support if something comes in as BMLT style:
  // Sunday = 1 through Saturday = 7
  if (n >= 1 && n <= 7) return (n + 6) % 7;

  return 0;
}

function parseTimeParts(value) {
  const text = String(value || "").trim();

  const ampmMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2] || 0);
    const ampm = ampmMatch[3].toLowerCase();

    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    return { hour, minute, second: 0 };
  }

  const parts = text.split(":").map(Number);

  return {
    hour: Number.isFinite(parts[0]) ? parts[0] : 0,
    minute: Number.isFinite(parts[1]) ? parts[1] : 0,
    second: Number.isFinite(parts[2]) ? parts[2] : 0
  };
}

function formatTime(hour, minute, second = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
}

function zonedLocalTimeToUtcDate({ year, month, day, hour, minute, second, timeZone }) {
  const wantedUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guessedUtc = wantedUtc;

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(guessedUtc), timeZone);

    const actualUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );

    const difference = actualUtc - wantedUtc;
    guessedUtc -= difference;
  }

  return new Date(guessedUtc);
}

function convertMeetingToTargetTimeZone(meeting, targetTimeZone) {
  const sourceTimeZone = normalizeTimeZone(
    meeting.sourceTimeZone ||
    meeting.timeZone ||
    DEFAULT_TARGET_TIME_ZONE
  );

  const targetTz = normalizeTimeZone(targetTimeZone || DEFAULT_TARGET_TIME_ZONE);

  const sourceWeekday = customWeekdayToZeroBased(meeting.weekday);
  const { hour, minute, second } = parseTimeParts(meeting.startTime);

  // Reference week starts Sunday, Jan 7, 2024.
  const referenceSunday = new Date(Date.UTC(2024, 0, 7, 12, 0, 0));
  const sourceReferenceDate = new Date(referenceSunday);
  sourceReferenceDate.setUTCDate(referenceSunday.getUTCDate() + sourceWeekday);

  const year = sourceReferenceDate.getUTCFullYear();
  const month = sourceReferenceDate.getUTCMonth() + 1;
  const day = sourceReferenceDate.getUTCDate();

  const utcDate = zonedLocalTimeToUtcDate({
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeZone: sourceTimeZone
  });

  const targetParts = getZonedParts(utcDate, targetTz);

  const convertedDate = new Date(Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day,
    12,
    0,
    0
  ));

  const convertedWeekday = convertedDate.getUTCDay();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const originalTimeNote =
    `Original listed time: ${dayNames[sourceWeekday]} ${formatTime(hour, minute, second)} ${sourceTimeZone}`;

  const extra = meeting.extra
    ? `${meeting.extra} | ${originalTimeNote}`
    : originalTimeNote;

  return {
    ...meeting,
    weekday: convertedWeekday,
    startTime: formatTime(targetParts.hour, targetParts.minute, targetParts.second),
    timeZone: targetTz,
    sourceTimeZone,
    sourceWeekday,
    sourceStartTime: formatTime(hour, minute, second),
    extra
  };
}

function normalizeBmltMeeting(m, sourceName) {
  const name =
    m.meeting_name ||
    m.name ||
    m.group_name ||
    "Unnamed NA Meeting";

  const weekday = bmltWeekdayToZeroBased(
    m.weekday_tinyint ||
    m.weekday ||
    m.day ||
    0
  );

  const startTime =
    m.start_time ||
    m.time ||
    "00:00:00";

  const sourceTimeZone = normalizeTimeZone(
    m.time_zone ||
    m.timezone ||
    m.tz ||
    DEFAULT_TARGET_TIME_ZONE
  );

  const joinUrl =
    m.virtual_meeting_link ||
    extractUrls(m.virtual_meeting_additional_info || m.comments || "")[0] ||
    "";

  const phone =
    m.phone_meeting_number ||
    "";

  const extraParts = [
    m.virtual_meeting_additional_info,
    m.comments,
    m.location_text,
    m.location_info
  ].filter(Boolean);

  const formats =
    Array.isArray(m.formats)
      ? m.formats.map(f => f.key || f.name || f).join(", ")
      : String(m.formats || m.format_shared_id_list || "");

  return {
    source: sourceName,
    fellowship: "NA",
    name,
    weekday,
    startTime,
    duration: m.duration_time || m.duration || "",
    timeZone: sourceTimeZone,
    sourceTimeZone,
    joinUrl,
    phone,
    extra: [...extraParts, `Source: ${sourceName}`].join(" | "),
    formats,
    raw: m
  };
}

async function fetchJsonSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Blue-Water-Virtual-NA-Meeting-Finder/1.0",
        "Accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`${source.name} returned ${response.status}`);
    }

    const data = await response.json();

    const meetings = Array.isArray(data)
      ? data
      : Array.isArray(data.meetings)
        ? data.meetings
        : [];

    return meetings
      .filter(isVirtualMeeting)
      .map(m => normalizeBmltMeeting(m, source.name));
  } catch (error) {
    console.warn(`Skipped ${source.name}: ${error.message}`);
    return [];
  }
}

async function loadCustomMeetings() {
  try {
    const filePath = path.join(__dirname, "public", "custom-meetings.json");
    const text = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(text);

    if (!Array.isArray(data)) return [];

    return data.map(meeting => {
      const sourceTimeZone = normalizeTimeZone(
        meeting.sourceTimeZone ||
        meeting.timeZone ||
        DEFAULT_TARGET_TIME_ZONE
      );

      return {
        source: meeting.source || "Custom NA Meeting",
        fellowship: "NA",
        name: meeting.name || "Unnamed Custom NA Meeting",
        weekday: customWeekdayToZeroBased(meeting.weekday),
        startTime: meeting.startTime || "00:00:00",
        duration: meeting.duration || "",
        timeZone: sourceTimeZone,
        sourceTimeZone,
        joinUrl: meeting.joinUrl || "",
        phone: meeting.phone || "",
        extra: meeting.extra || "",
        formats: meeting.formats || "Virtual NA",
        raw: meeting
      };
    });
  } catch (error) {
    console.warn(`No custom-meetings.json loaded: ${error.message}`);
    return [];
  }
}

function dedupeMeetings(meetings) {
  const seen = new Set();
  const unique = [];

  for (const meeting of meetings) {
    const key = [
      meeting.name,
      meeting.weekday,
      meeting.startTime,
      meeting.joinUrl,
      meeting.phone,
      meeting.source
    ]
      .join("|")
      .toLowerCase()
      .replace(/\s+/g, " ");

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(meeting);
  }

  return unique;
}

app.get("/api/meetings", async (req, res) => {
  try {
    const targetTimeZone = normalizeTimeZone(
      req.query.tz || DEFAULT_TARGET_TIME_ZONE
    );

    const bmltResults = await Promise.all(
      BMLT_SOURCES.map(source => fetchJsonSource(source))
    );

    const customMeetings = await loadCustomMeetings();

    const meetingsBeforeConversion = dedupeMeetings([
      ...bmltResults.flat(),
      ...customMeetings
    ]);

    const convertedMeetings = meetingsBeforeConversion.map(meeting =>
      convertMeetingToTargetTimeZone(meeting, targetTimeZone)
    );

    const meetings = dedupeMeetings(convertedMeetings);

    res.json({
      source: "Virtual NA / BMLT + Custom NA Meetings",
      targetTimeZone,
      count: meetings.length,
      meetings
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

const port = process.env.PORT || PORT;

app.listen(port, () => {
  console.log(`Virtual NA finder running on port ${port}`);
});
