import express from "express";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static("public"));

const BMLT_SOURCES = [
  {
    name: "Virtual NA / BMLT",
    url: "https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },

  // These are candidate BMLT endpoints. If one fails, the app skips it.
  {
    name: "NAHelp / BMLT",
    url: "https://nahelp.org/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "NAHelp / BMLT Alt",
    url: "https://nahelp.org/bmlt/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Billwild / BMLT",
    url: "https://billwild.net/main_server/client_interface/json/?switcher=GetSearchResults"
  },
  {
    name: "Billwild / BMLT Alt",
    url: "https://billwild.net/bmlt/main_server/client_interface/json/?switcher=GetSearchResults"
  }
];

const HTML_SOURCES = [
  {
    name: "NAHelp",
    url: "https://nahelp.org/meetings/",
    kind: "nahelp"
  },
  {
    name: "Billwild",
    url: "https://billwild.net/",
    kind: "billwild"
  }
];

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#038;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeBmltMeeting(m, sourceName) {
  const name =
    m.meeting_name ||
    m.name ||
    m.group_name ||
    "Unnamed NA Meeting";

  const weekday =
    Number(m.weekday_tinyint || m.weekday || m.day || 0);

  const startTime =
    m.start_time ||
    m.time ||
    "00:00:00";

  const duration =
    m.duration_time ||
    m.duration ||
    "";

  const timeZone =
    m.time_zone ||
    m.timezone ||
    m.tz ||
    "Local / listed timezone";

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
    name,
    weekday,
    startTime,
    duration,
    timeZone,
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

function parseTimeTo24Hour(timeText) {
  const match = String(timeText || "").match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);

  if (!match) {
    return "00:00:00";
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const ampm = match[3].toLowerCase();

  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function weekdayNameToNumber(dayName) {
  const days = {
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    thursday: 5,
    friday: 6,
    saturday: 7
  };

  return days[String(dayName || "").toLowerCase()] || 0;
}

function parseBillwildHtml(html) {
  const text = cleanText(html);
  const meetings = [];

  const dayPattern =
    /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))\s+([^]*?)(?=(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+\d{1,2}:\d{2}\s*(?:am|pm)|$)/gi;

  let match;

  while ((match = dayPattern.exec(text)) !== null) {
    const day = match[1];
    const start = match[2];
    const end = match[3];
    const details = match[4].trim();

    if (!isVirtualOrHybridText(details)) continue;

    const urls = extractUrls(details);

    let name = details
      .replace(/Zoom ID:.*$/i, "")
      .replace(/Meets Virtually.*$/i, "")
      .replace(/https?:\/\/[^\s]+/gi, "")
      .replace(/\b(O|C|D|SD|V|VM|HY|VO|ENG|SPK|BT|JT|ST|WC|LC|QA|TO)\b,?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 3) {
      name = "Darkside Fellowship Virtual Meeting";
    }

    meetings.push({
      source: "Billwild",
      name,
      weekday: weekdayNameToNumber(day),
      startTime: parseTimeTo24Hour(start),
      duration: `${start} - ${end}`,
      timeZone: "Listed timezone",
      joinUrl: urls[0] || "",
      phone: "",
      extra: `${details} | Source: Billwild`,
      formats: "Virtual / Hybrid",
      raw: { day, start, end, details }
    });
  }

  return meetings;
}

function parseNaHelpHtml(html) {
  const text = cleanText(html);
  const meetings = [];

  const pattern =
    /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s*([^]*?)(?=\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\s*(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)|$)/g;

  let match;

  while ((match = pattern.exec(text)) !== null) {
    const start = match[1];
    const day = match[2];
    const details = match[3].trim();

    if (!isVirtualOrHybridText(details)) continue;

    const urls = extractUrls(details);

    const name = details
      .split(",")[0]
      .replace(/https?:\/\/[^\s]+/gi, "")
      .trim() || "NAHelp Virtual Meeting";

    meetings.push({
      source: "NAHelp",
      name,
      weekday: weekdayNameToNumber(day),
      startTime: parseTimeTo24Hour(start),
      duration: "",
      timeZone: "Listed timezone",
      joinUrl: urls[0] || "",
      phone: "",
      extra: `${details} | Source: NAHelp`,
      formats: "Virtual / Hybrid / Phone",
      raw: { day, start, details }
    });
  }

  return meetings;
}

async function fetchHtmlSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "Blue-Water-Virtual-NA-Meeting-Finder/1.0",
        "Accept": "text/html,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`${source.name} returned ${response.status}`);
    }

    const html = await response.text();

    if (source.kind === "billwild") {
      return parseBillwildHtml(html);
    }

    if (source.kind === "nahelp") {
      return parseNaHelpHtml(html);
    }

    return [];
  } catch (error) {
    console.warn(`Skipped ${source.name} HTML: ${error.message}`);
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
      meeting.phone
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
    const jsonResults = await Promise.all(
      BMLT_SOURCES.map(source => fetchJsonSource(source))
    );

    const htmlResults = await Promise.all(
      HTML_SOURCES.map(source => fetchHtmlSource(source))
    );

    const meetings = dedupeMeetings([
      ...jsonResults.flat(),
      ...htmlResults.flat()
    ]);

    res.json({
      source: "Virtual NA / BMLT + NAHelp + Billwild",
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
