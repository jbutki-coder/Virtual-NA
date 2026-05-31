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

const DEFAULT_TARGET_TIME_ZONE = "America/Detroit";

const BMLT_SOURCES = [
  {
    name: "Virtual NA / BMLT",
    fellowship: "NA",
    url: "https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Michigan Region / BMLT",
    fellowship: "NA",
    url: "https://michigan-na.org/bmlt/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "NERNA / BMLT",
    fellowship: "NA",
    url: "https://www.nerna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "WSZF / BMLT",
    fellowship: "NA",
    url: "https://bmlt.wszf.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "SEZF / BMLT",
    fellowship: "NA",
    url: "https://bmlt.sezf.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Tennessee Region / BMLT",
    fellowship: "NA",
    url: "https://natennessee.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Hawaii Region / BMLT",
    fellowship: "NA",
    url: "https://na-hawaii.org/bmltmain/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Central Indiana Region / BMLT",
    fellowship: "NA",
    url: "https://cirna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Florida Region / BMLT",
    fellowship: "NA",
    url: "https://bmlt.floridarso.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Georgia Region / BMLT",
    fellowship: "NA",
    url: "https://grscna.com/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Arizona Region / BMLT",
    fellowship: "NA",
    url: "https://arizona-na.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Colorado Region / BMLT",
    fellowship: "NA",
    url: "https://nacolorado.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Greater New York Region / BMLT",
    fellowship: "NA",
    url: "https://newyorkna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Southern California Region / BMLT",
    fellowship: "NA",
    url: "https://socalna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "San Diego Imperial Region / BMLT",
    fellowship: "NA",
    url: "https://sandiegona.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Wisconsin Region / BMLT",
    fellowship: "NA",
    url: "https://wisconsinna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Minnesota Region / BMLT",
    fellowship: "NA",
    url: "https://naminnesota.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "New Jersey Region / BMLT",
    fellowship: "NA",
    url: "https://nj-na.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Eastern Pennsylvania Region / BMLT",
    fellowship: "NA",
    url: "https://eparna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Connecticut Region / BMLT",
    fellowship: "NA",
    url: "https://ctna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Iowa Region / BMLT",
    fellowship: "NA",
    url: "https://iowa-na.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Kentucky Region / BMLT",
    fellowship: "NA",
    url: "https://kentuckiana.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Ohio Region / BMLT",
    fellowship: "NA",
    url: "https://naohio.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Alabama Northwest Florida / BMLT",
    fellowship: "NA",
    url: "https://anwfnara.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Tejas Bluebonnet Region / BMLT",
    fellowship: "NA",
    url: "https://tbrna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Australia Region / BMLT",
    fellowship: "NA",
    url: "https://www.na.org.au/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "South Africa Region / BMLT",
    fellowship: "NA",
    url: "https://na.org.za/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "UKNA / BMLT",
    fellowship: "NA",
    url: "https://ukna.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Ireland NA / BMLT",
    fellowship: "NA",
    url: "https://www.na-ireland.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Iran Region One / Possible BMLT",
    fellowship: "NA",
    url: "https://meeting.nairan1.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Iran Region One / Possible BMLT Alt",
    fellowship: "NA",
    url: "https://meeting.nairan1.org/en/main_server/client_interface/json/?switcher=GetSearchResults"
  }
];

let lastSourceReport = [];

const TIME_ZONE_ALIASES = {
  eastern: "America/New_York",
  east: "America/New_York",
  et: "America/New_York",
  est: "America/New_York",
  edt: "America/New_York",
  newyork: "America/New_York",
  "new york": "America/New_York",

  michigan: "America/Detroit",
  detroit: "America/Detroit",

  central: "America/Chicago",
  ct: "America/Chicago",
  cst: "America/Chicago",
  cdt: "America/Chicago",
  chicago: "America/Chicago",
  nebraska: "America/Chicago",

  mountain: "America/Denver",
  mt: "America/Denver",
  mst: "America/Denver",
  mdt: "America/Denver",
  denver: "America/Denver",

  pacific: "America/Los_Angeles",
  pt: "America/Los_Angeles",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  california: "America/Los_Angeles",
  losangeles: "America/Los_Angeles",
  "los angeles": "America/Los_Angeles",

  arizona: "America/Phoenix",
  phoenix: "America/Phoenix",

  uk: "Europe/London",
  england: "Europe/London",
  london: "Europe/London",

  ireland: "Europe/Dublin",
  dublin: "Europe/Dublin",

  portugal: "Europe/Lisbon",
  lisbon: "Europe/Lisbon",

  thailand: "Asia/Bangkok",
  bangkok: "Asia/Bangkok",

  iran: "Asia/Tehran",
  tehran: "Asia/Tehran",

  australia: "Australia/Sydney",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  brisbane: "Australia/Brisbane",
  perth: "Australia/Perth",
  adelaide: "Australia/Adelaide",

  africa: "Africa/Johannesburg",
  southafrica: "Africa/Johannesburg",
  "south africa": "Africa/Johannesburg",
  johannesburg: "Africa/Johannesburg",

  newzealand: "Pacific/Auckland",
  "new zealand": "Pacific/Auckland",
  auckland: "Pacific/Auckland"
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

function hasVirtualOrHybridLanguage(value) {
  const text = String(value || "").toLowerCase();

  return Boolean(
    text.includes("virtual") ||
    text.includes("hybrid") ||
    text.includes("zoom") ||
    text.includes("meets virtually") ||
    text.includes("meets virtually and in-person") ||
    text.includes("meets virtually and in person") ||
    text.includes("online") ||
    text.includes("web") ||
    text.includes("skype") ||
    text.includes("virtual na")
  );
}

function hasPhoneOnlyLanguage(value) {
  const text = String(value || "").toLowerCase();

  const hasPhoneWords =
    text.includes("phone") ||
    text.includes("telephone") ||
    text.includes("dial") ||
    text.includes("conference call") ||
    text.includes("call-in") ||
    text.includes("call in");

  const hasVirtualWords = hasVirtualOrHybridLanguage(text);

  return hasPhoneWords && !hasVirtualWords;
}

function isVirtualOrHybridMeeting(m) {
  const joined = [
    m.meeting_name,
    m.name,
    m.group_name,
    m.formats,
    m.format_shared_id_list,
    m.virtual_meeting_link,
    m.virtual_meeting_additional_info,
    m.comments,
    m.location_text,
    m.location_info,
    m.venue_type
  ].join(" ");

  const formats = String(m.formats || m.format_shared_id_list || "").toUpperCase();

  const hasVirtualLink =
    Boolean(m.virtual_meeting_link) ||
    extractUrls(m.virtual_meeting_additional_info || m.comments || "").length > 0;

  const hasVirtualFormat =
    formats.includes("VM") ||
    formats.includes("HY") ||
    formats.includes("VIRTUAL") ||
    formats.includes("HYBRID") ||
    formats.includes("ONLINE");

  const hasVirtualVenueType =
    String(m.venue_type || "").toLowerCase().includes("virtual") ||
    String(m.venue_type || "").toLowerCase().includes("hybrid") ||
    String(m.venue_type || "") === "2" ||
    String(m.venue_type || "") === "3";

  const hasVirtualWords = hasVirtualOrHybridLanguage(joined);
  const phoneOnly = hasPhoneOnlyLanguage(joined);

  return Boolean((hasVirtualLink || hasVirtualFormat || hasVirtualVenueType || hasVirtualWords) && !phoneOnly);
}

function customMeetingIsVirtualOrHybrid(meeting) {
  const joined = [
    meeting.name,
    meeting.source,
    meeting.formats,
    meeting.extra,
    meeting.joinUrl
  ].join(" ");

  const hasLink = Boolean(meeting.joinUrl);
  const hasVirtualWords = hasVirtualOrHybridLanguage(joined);
  const phoneOnly = hasPhoneOnlyLanguage(joined);

  return Boolean((hasLink || hasVirtualWords) && !phoneOnly);
}

function bmltWeekdayToZeroBased(value) {
  const n = Number(value || 0);
  if (!n) return 0;

  return (n + 6) % 7;
}

function customWeekdayToZeroBased(value) {
  const n = Number(value || 0);

  if (n >= 0 && n <= 6) return n;

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

  for (let i = 0; i < 5; i++) {
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

function getReferenceSunday() {
  const now = new Date();
  const utcNoonToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
    0,
    0
  ));

  const day = utcNoonToday.getUTCDay();
  utcNoonToday.setUTCDate(utcNoonToday.getUTCDate() - day);

  return utcNoonToday;
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

  const referenceSunday = getReferenceSunday();
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

  const extraAlreadyHasOriginalTime = String(meeting.extra || "").includes("Original listed time:");

  const extra = extraAlreadyHasOriginalTime
    ? meeting.extra
    : meeting.extra
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
    phone: "",
    extra: [...extraParts, `Source: ${sourceName}`].join(" | "),
    formats,
    raw: m
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonSource(source) {
  try {
    const response = await fetchWithTimeout(source.url, {
      headers: {
        "User-Agent": "Blue-Water-Virtual-NA-Meeting-Finder/1.0",
        "Accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`${source.name} returned HTTP ${response.status}`);
    }

    const data = await response.json();

    const rawMeetings = Array.isArray(data)
      ? data
      : Array.isArray(data.meetings)
        ? data.meetings
        : [];

    const filteredMeetings = rawMeetings
      .filter(isVirtualOrHybridMeeting)
      .map(m => normalizeBmltMeeting(m, source.name));

    return {
      source: source.name,
      url: source.url,
      ok: true,
      rawCount: rawMeetings.length,
      virtualHybridCount: filteredMeetings.length,
      error: "",
      meetings: filteredMeetings
    };
  } catch (error) {
    console.warn(`Skipped ${source.name}: ${error.message}`);

    return {
      source: source.name,
      url: source.url,
      ok: false,
      rawCount: 0,
      virtualHybridCount: 0,
      error: error.message,
      meetings: []
    };
  }
}

async function loadCustomMeetings() {
  try {
    const filePath = path.join(__dirname, "public", "custom-meetings.json");
    const text = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      return {
        ok: false,
        error: "custom-meetings.json exists, but it is not a JSON array.",
        rawCount: 0,
        virtualHybridCount: 0,
        meetings: []
      };
    }

    const filteredMeetings = data
      .filter(customMeetingIsVirtualOrHybrid)
      .map(meeting => {
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
          phone: "",
          extra: meeting.extra || "",
          formats: meeting.formats || "Virtual NA",
          raw: meeting
        };
      });

    return {
      ok: true,
      error: "",
      rawCount: data.length,
      virtualHybridCount: filteredMeetings.length,
      meetings: filteredMeetings
    };
  } catch (error) {
    console.warn(`No custom-meetings.json loaded: ${error.message}`);

    return {
      ok: false,
      error: error.message,
      rawCount: 0,
      virtualHybridCount: 0,
      meetings: []
    };
  }
}

function normalizeDedupeUrl(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("?")[0]
    .replace(/\/$/, "")
    .replace(/[^a-z0-9]/g, "");
}

function dedupeMeetings(meetings) {
  const seen = new Set();
  const unique = [];

  for (const meeting of meetings) {
    const normalizedUrl = normalizeDedupeUrl(meeting.joinUrl);

    if (!normalizedUrl) {
      unique.push(meeting);
      continue;
    }

    const key = `url|${normalizedUrl}|${meeting.weekday}|${meeting.startTime}`;

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

    const customResult = await loadCustomMeetings();

    lastSourceReport = [
      ...bmltResults.map(result => ({
        source: result.source,
        url: result.url,
        ok: result.ok,
        rawCount: result.rawCount,
        virtualHybridCount: result.virtualHybridCount,
        error: result.error
      })),
      {
        source: "Custom Meetings",
        url: "public/custom-meetings.json",
        ok: customResult.ok,
        rawCount: customResult.rawCount,
        virtualHybridCount: customResult.virtualHybridCount,
        error: customResult.error
      }
    ];

    const meetingsBeforeConversion = [
      ...bmltResults.flatMap(result => result.meetings),
      ...customResult.meetings
    ];

    const convertedMeetings = meetingsBeforeConversion.map(meeting =>
      convertMeetingToTargetTimeZone(meeting, targetTimeZone)
    );

    const meetings = dedupeMeetings(convertedMeetings);

    res.json({
      source: "Multiple BMLT Sources + Custom NA Meetings",
      targetTimeZone,
      filterRule: "Virtual and hybrid meetings only. Phone-only meetings are excluded.",
      dedupeRule: "Duplicates are removed only when the same link appears at the same day/time. Same name alone is not treated as a duplicate.",
      sourceReport: lastSourceReport,
      countBeforeDedupe: convertedMeetings.length,
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

app.get("/api/debug", async (req, res) => {
  try {
    const customResult = await loadCustomMeetings();

    res.json({
      bmltSourcesConfigured: BMLT_SOURCES,
      lastSourceReport,
      customMeetings: {
        ok: customResult.ok,
        error: customResult.error,
        rawCount: customResult.rawCount,
        virtualHybridCount: customResult.virtualHybridCount,
        names: customResult.meetings.map(m => ({
          name: m.name,
          source: m.source,
          weekday: m.weekday,
          startTime: m.startTime,
          timeZone: m.timeZone,
          joinUrl: m.joinUrl
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message
    });
  }
});

app.use(express.static("public"));

app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: "Route not found"
  });
});

const port = process.env.PORT || PORT;

app.listen(port, () => {
  console.log(`Virtual NA finder running on port ${port}`);
});
