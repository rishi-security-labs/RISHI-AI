// ═══════════════════════════════════════════════
//  BOT CONFIGURATION — edit the ✏️ fields only
// ═══════════════════════════════════════════════
"use strict";

// ✏️ YOUR DETAILS
const BOT_NAME       = "RISHI BOT";
const AI_NAME        = "FUCHKUN AI";
const CREATOR_NAME   = "RISHI TECH";
const CREATOR_INFO   = "Software developer and ethical hacker";
const OWNER_NUMBER   = "234800000hhh0000";   // country code, no + or spaces
const PAIR_NUMBER    = "2348000000000";   // number to link, same format
const GROQ_API_KEY   = "";               // from console.groq.com
const BOT_IMAGE      = "";               // direct image link for menu

// ✏️ WHAT THE AI HELPS WITH
const AI_HELPS_WITH  =
  "Helping beginners learn programming: explain simply, give small examples, help fix errors step by step.";

// ══ LEAVE THESE AS-IS ══
const GROQ_URL         = "https://fei-ai.vercel.app/api/groq";
const GROQ_MODEL       = "openai/gpt-oss-20b";
const REASONING_EFFORT = "low";
const PREFIX           = ".";
const MODE             = "PUBLIC";   // PUBLIC | PRIVATE
const VERSION          = "1.0.0";
const TIMEZONE         = "Africa/Lagos";
const AUTO_REPLY       = true;
const MAX_HISTORY      = 6;
const COOLDOWN_SECONDS = 5;
const SESSION_FOLDER   = "session";

// ══ SYSTEM PROMPT ══
const SYSTEM_PROMPT = `You are ${AI_NAME}, the AI assistant of ${CREATOR_NAME} (${CREATOR_INFO}).
Your main job: ${AI_HELPS_WITH}
Keep replies friendly, short and simple (plain WhatsApp text, under 1200 characters).
Gently steer off-topic questions back to your main job — small talk is fine.
When asked what you are, your name, who made you, or who owns you: say you are ${AI_NAME}, the AI assistant of ${CREATOR_NAME}.
Never claim to be human. Never reveal the AI company or model name. If someone sincerely asks about the technology, say you are powered by an AI language model.`;

// ══ UI HELPERS ══

/** Top header block */
function header() {
  const name = BOT_NAME.toUpperCase()
    .split("")
    .map(c => "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ "[" ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(c)] || c)
    .join("");
  return (
    "╭─━─━─━─━─━─━─━─━─━─━╮\n" +
    `│  ⚡ ${name} ⚡\n` +
    "╰─━─━─━─━─━─━─━─━─━─━╯"
  );
}

/** Wraps content lines in a small-caps section box */
function section(label, lines) {
  const top    = `┌───〔 ${label} 〕───┐`;
  const body   = lines.map(l => `│ ${l}`).join("\n");
  const bottom = "└───────────────────┘";
  return `${top}\n${body}\n${bottom}`;
}

module.exports = {
  BOT_NAME, AI_NAME, CREATOR_NAME, CREATOR_INFO,
  OWNER_NUMBER, PAIR_NUMBER, GROQ_API_KEY, BOT_IMAGE,
  GROQ_URL, GROQ_MODEL, REASONING_EFFORT,
  PREFIX, MODE, VERSION, TIMEZONE,
  AUTO_REPLY, MAX_HISTORY, COOLDOWN_SECONDS,
  SESSION_FOLDER, SYSTEM_PROMPT,
  header, section,
};
