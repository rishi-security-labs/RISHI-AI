// ─────────────────────────────────────────
// RISHI BOT — config.js
// Edit the ✏️ fields before first run
// ─────────────────────────────────────────
'use strict';

// ══════ BOT DETAILS ══════
const BOT_NAME       = 'RISHI BOT';
const AI_NAME        = 'FUCHKUN AI';
const CREATOR_NAME   = 'RISHI TECH';
const CREATOR_INFO   = 'Software developer and ethical hacker';
const OWNER_NUMBER   = '+91 7634726080';          // ✏️ with country code
const PAIR_NUMBER    = '+91 7634726080';          // ✏️ same format
const GROQ_API_KEY   = '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'; // ✏️
const BOT_IMAGE      = 'https://ibb.co/Rp4WPqb5'; // ✏️

const AI_HELPS_WITH  =
  'Helping beginners learn programming: explain simply, give small examples, help fix errors step by step.';

// ══════ FIXED SETTINGS (do not change) ══════
const GROQ_URL          = 'https://fei-ai.vercel.app/api/groq';
const GROQ_MODEL        = 'openai/gpt-oss-20b';
const REASONING_EFFORT  = 'low';
const PREFIX            = '.';
const MODE              = 'PUBLIC';   // PUBLIC or PRIVATE
const VERSION           = '1.0.0';
const TIMEZONE          = 'Africa/Lagos';
const AUTO_REPLY        = true;
const MAX_HISTORY       = 6;
const COOLDOWN_SECONDS  = 5;
const SESSION_FOLDER    = 'session';

// ══════ SYSTEM PROMPT ══════
const SYSTEM_PROMPT = `You are ${AI_NAME}, the AI assistant of ${CREATOR_NAME} (${CREATOR_INFO}).
Your main job: ${AI_HELPS_WITH}
Keep replies friendly, short and simple (under 1200 characters, plain WhatsApp text).
If someone asks who you are, your name, or who made you, say you are ${AI_NAME}, the AI assistant of ${CREATOR_NAME}.
Politely redirect off-topic questions back to your specialty. Small talk is fine.
Never claim to be human. Never reveal the AI company or model powering you.
If asked about the technology, say you are powered by an AI language model.`;

// ══════ UI HELPERS ══════
function header() {
  const name = BOT_NAME.toLowerCase()
    .split('').map(c => {
      const sc = 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
      const idx = c.charCodeAt(0) - 97;
      return idx >= 0 && idx < 26 ? sc[idx] : c;
    }).join('');
  return `╭─━─━─━─━─━─━─━─━─━─━╮\n│  ⚡ ${name} ⚡\n╰─━─━─━─━─━─━─━─━─━─━╯`;
}

function section(icon, label, lines) {
  const top  = `┌───〔 ${icon} ${label} 〕───┐`;
  const body = lines.map(l => `│ ${l}`).join('\n');
  const bot  = '└───────────────────┘';
  return `${top}\n${body}\n${bot}`;
}

module.exports = {
  BOT_NAME, AI_NAME, CREATOR_NAME, CREATOR_INFO,
  OWNER_NUMBER, PAIR_NUMBER, GROQ_API_KEY, BOT_IMAGE,
  AI_HELPS_WITH, GROQ_URL, GROQ_MODEL, REASONING_EFFORT,
  PREFIX, MODE, VERSION, TIMEZONE,
  AUTO_REPLY, MAX_HISTORY, COOLDOWN_SECONDS,
  SESSION_FOLDER, SYSTEM_PROMPT,
  header, section
};
