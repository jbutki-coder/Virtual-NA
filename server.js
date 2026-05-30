import express from "express";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static("public"));

const BMLT_ENDPOINT =
  "https://bmlt.virtual-na.org/main_server/client_interface/json/?switcher=GetSearchResults";

function isVirtualMeeting(m) {
  return Boolean(
    m.virtual_meeting_link ||
    m.phone_meeting_number ||
    m.virtual_meeting_additional_info ||
    m.virtual_information ||
    String(m.formats || "").includes("VM") ||
    String(m.formats || "").includes("TC")
  );
}

function normalizeMeeting(m) {
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

  const timeZone =
    m.time_zone ||
    m.timezone ||
    m.tz ||
    "UTC";

  const joinUrl =
    m.virtual_meeting_link ||
    m.virtual_information?.url ||
    "";

  const phone =
    m.phone_meeting_number ||
    m.virtual_information?.phone_number ||
    "";

  const extra =
    m.virtual_meeting_additional_info ||
    m.virtual_information?.info ||
    m.comments ||
    "";

  const formats =
    Array.isArray(m.formats)
      ? m.formats.map(f => f.key || f.name || f).join(", ")
      : String(m.formats || "");

  return {
    name,
    weekday,
    startTime,
    timeZone,
    joinUrl,
    phone,
    extra,
    formats,
    raw: m
  };
}

app.get("/api/meetings", async (req, res) => {
  try {
    const response = await fetch(BMLT_ENDPOINT, {
      headers: {
        "User-Agent": "Virtual-NA-Timeblock-Finder/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`BMLT request failed: ${response.status}`);
    }

    const data = await response.json();

    const meetings = Array.isArray(data)
      ? data
      : Array.isArray(data.meetings)
        ? data.meetings
        : [];

    const virtualMeetings = meetings
      .filter(isVirtualMeeting)
      .map(normalizeMeeting);

    res.json({
      source: "Virtual NA / BMLT",
      count: virtualMeetings.length,
      meetings: virtualMeetings
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