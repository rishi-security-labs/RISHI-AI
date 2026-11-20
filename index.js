// ═══════════════════════════════════════════════
//  WhatsApp AI Chatbot — index.js
// ═══════════════════════════════════════════════
"use strict";

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");
const pino    = require("pino");
const fs      = require("fs");
const path    = require("path");
const readline = require("readline");

const cfg = require("./config");

// ── State ────────────────────────────────────────
const chatHistories = {};   // jid → [{role, content}]
const cooldowns     = {};   // jid → timestamp
let   autoReply     = cfg.AUTO_REPLY;
const startTime     = Date.now();
let   sock          = null;

// ── Helpers ──────────────────────────────────────

function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function localTime() {
  return new Date().toLocaleString("en-US", { timeZone: cfg.TIMEZONE });
}

function isOwner(jid) {
  const num = jid.replace(/[^0-9]/g, "");
  return num === cfg.OWNER_NUMBER || (sock && num === sock.user?.id?.replace(/[^0-9]/g, ""));
}

function isBotSelf(jid) {
  return sock && jid.replace(/[^0-9]/g, "") === sock.user?.id?.replace(/[^0-9]/g, "");
}

function allowed(jid) {
  if (cfg.MODE === "PRIVATE") return isOwner(jid);
  return true;
}

/** Trim history to MAX_HISTORY pairs */
function getHistory(jid) {
  if (!chatHistories[jid]) chatHistories[jid] = [];
  return chatHistories[jid];
}

function pushHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  // keep last MAX_HISTORY messages
  while (h.length > cfg.MAX_HISTORY) h.shift();
}

/** Send text reply */
async function reply(jid, text, quoted) {
  try {
    await sock.sendMessage(jid, { text }, quoted ? { quoted } : {});
  } catch (e) {
    console.error("Reply error:", e.message);
  }
}

/** Call the Groq proxy */
async function askAI(jid, question) {
  const history = getHistory(jid);
  const messages = [
    { role: "system", content: cfg.SYSTEM_PROMPT },
    ...history,
    { role: "user", content: question },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(cfg.GROQ_URL, {
      method:  "POST",
      signal:  controller.signal,
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${cfg.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:            cfg.GROQ_MODEL,
        reasoning_effort: cfg.REASONING_EFFORT,
        messages,
        max_tokens: 600,
      }),
    });

    clearTimeout(timer);

    const raw = await res.text();

    if (!res.ok) {
      console.error(`[AI] HTTP ${res.status}:`, raw);
      return "AI is busy, try again in a moment 🙏";
    }

    let data;
    try { data = JSON.parse(raw); } catch {
      console.error("[AI] JSON parse error:", raw);
      return "AI is busy, try again in a moment 🙏";
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      console.error("[AI] Empty answer:", raw);
      return "AI is busy, try again in a moment 🙏";
    }

    // persist to history
    pushHistory(jid, "user",      question);
    pushHistory(jid, "assistant", answer);

    return answer;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      console.error("[AI] Request timed out");
    } else {
      console.error("[AI] Fetch error:", e.message);
    }
    return "AI is busy, try again in a moment 🙏";
  }
}

// ── Commands ─────────────────────────────────────

function buildMenu() {
  const cats = {};
  for (const [cmd, def] of Object.entries(COMMANDS)) {
    if (!cats[def.cat]) cats[def.cat] = [];
    cats[def.cat].push(`${cfg.PREFIX}${cmd} — ${def.desc}`);
  }

  let out = cfg.header() + "\n\n";
  for (const [cat, lines] of Object.entries(cats)) {
    out += cfg.section(`👑 ${cat.toUpperCase()}`, lines) + "\n\n";
  }

  out += cfg.section("👑 ʙᴏᴛ ɪɴғᴏ", [
    `✦ ᴏᴡɴᴇʀ : ${cfg.CREATOR_NAME}`,
    `✦ ᴘʀᴇғɪx : ${cfg.PREFIX}`,
    `✦ ᴍᴏᴅᴇ : ${cfg.MODE}`,
    `✦ ᴀɪ ʀᴇᴘʟʏ : ${autoReply ? "ON" : "OFF"}`,
    `✦ sᴛᴀᴛᴜs : Online 🟢`,
    `✦ ᴜᴘᴛɪᴍᴇ : ${uptime()}`,
  ]);

  return out;
}

const COMMANDS = {
  menu: {
    cat: "general",
    desc: "Show this menu",
    async run({ jid, msg }) {
      const text = buildMenu();
      if (cfg.BOT_IMAGE) {
        try {
          await sock.sendMessage(jid, {
            image: { url: cfg.BOT_IMAGE },
            caption: text,
          }, { quoted: msg });
          return;
        } catch {
          // fall through to plain text
        }
      }
      await reply(jid, text, msg);
    },
  },

  ai: {
    cat: "ai",
    desc: "Ask the AI a question",
    async run({ jid, args, msg }) {
      if (!args.length) return reply(jid, `Usage: ${cfg.PREFIX}ai <your question>`, msg);
      await sock.sendPresenceUpdate("composing", jid);
      const answer = await askAI(jid, args.join(" "));
      await reply(jid, answer, msg);
    },
  },

  reset: {
    cat: "ai",
    desc: "Clear your AI chat history",
    async run({ jid, msg }) {
      chatHistories[jid] = [];
      await reply(jid, "✅ Your AI chat history has been cleared.", msg);
    },
  },

  about: {
    cat: "general",
    desc: "About this bot",
    async run({ jid, msg }) {
      const text = cfg.section("👑 ᴀʙᴏᴜᴛ", [
        `✦ ɴᴀᴍᴇ : ${cfg.BOT_NAME}`,
        `✦ ᴀɪ : ${cfg.AI_NAME}`,
        `✦ ᴄʀᴇᴀᴛᴏʀ : ${cfg.CREATOR_NAME}`,
        `✦ ɪɴғᴏ : ${cfg.CREATOR_INFO}`,
        `✦ ᴠᴇʀsɪᴏɴ : ${cfg.VERSION}`,
      ]);
      await reply(jid, text, msg);
    },
  },

  ping: {
    cat: "general",
    desc: "Check bot latency",
    async run({ jid, msg }) {
      const start = Date.now();
      await reply(jid, "🏓 Pong!", msg);
      const ms = Date.now() - start;
      await reply(jid, `⚡ Latency: ${ms}ms`, msg);
    },
  },

  alive: {
    cat: "general",
    desc: "Check if bot is online",
    async run({ jid, msg }) {
      const text = cfg.section("👑 sᴛᴀᴛᴜs", [
        `✦ sᴛᴀᴛᴜs : Online 🟢`,
        `✦ ᴜᴘᴛɪᴍᴇ : ${uptime()}`,
      ]);
      await reply(jid, text, msg);
    },
  },

  owner: {
    cat: "general",
    desc: "Get owner contact",
    async run({ jid, msg }) {
      const text = cfg.section("👑 ᴏᴡɴᴇʀ", [
        `✦ ɴᴀᴍᴇ : ${cfg.CREATOR_NAME}`,
        `✦ ɴᴜᴍʙᴇʀ : wa.me/${cfg.OWNER_NUMBER}`,
      ]);
      await reply(jid, text, msg);
    },
  },

  runtime: {
    cat: "general",
    desc: "Show bot uptime",
    async run({ jid, msg }) {
      await reply(jid, `⏱️ Uptime: ${uptime()}`, msg);
    },
  },

  time: {
    cat: "general",
    desc: "Show current time",
    async run({ jid, msg }) {
      await reply(jid, `🕐 ${localTime()}`, msg);
    },
  },

  autoreply: {
    cat: "owner",
    desc: "Toggle auto AI reply (owner only)",
    async run({ jid, args, msg, senderJid }) {
      if (!isOwner(senderJid) && !isBotSelf(senderJid)) {
        return reply(jid, "❌ Only the owner can use this command.", msg);
      }
      const val = args[0]?.toLowerCase();
      if (val === "on")  { autoReply = true;  return reply(jid, "✅ Auto reply is now ON.",  msg); }
      if (val === "off") { autoReply = false; return reply(jid, "✅ Auto reply is now OFF.", msg); }
      await reply(jid, `Auto reply is currently ${autoReply ? "ON" : "OFF"}. Use: ${cfg.PREFIX}autoreply on/off`, msg);
    },
  },
};

// ── Message handler ───────────────────────────────

async function handleMessage(m) {
  try {
    const msg      = m.messages?.[0];
    if (!msg || msg.key.fromMe) return;

    const jid       = msg.key.remoteJid;
    const isGroup   = jid.endsWith("@g.us");
    const senderJid = isGroup
      ? (msg.key.participant || msg.participant || jid)
      : jid;

    // ignore newsletters / status
    if (jid === "status@broadcast" || jid.endsWith("@newsletter")) return;

    if (!allowed(senderJid)) return;

    // extract text
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      "";

    if (!body) return;

    const isCommand = body.startsWith(cfg.PREFIX);

    // ── Commands ──
    if (isCommand) {
      const [rawCmd, ...args] = body.slice(cfg.PREFIX.length).trim().split(/\s+/);
      const cmdName = rawCmd.toLowerCase();
      const def     = COMMANDS[cmdName];
      if (!def) return reply(jid, `❓ Unknown command. Try ${cfg.PREFIX}menu`, msg);
      await def.run({ jid, args, msg, senderJid });
      return;
    }

    // ── Auto reply (DM) ──
    if (!isGroup) {
      if (!autoReply) return;

      // cooldown
      const now  = Date.now();
      const last = cooldowns[senderJid] || 0;
      if (now - last < cfg.COOLDOWN_SECONDS * 1000) return;
      cooldowns[senderJid] = now;

      await sock.sendPresenceUpdate("composing", jid);
      const answer = await askAI(jid, body);
      await reply(jid, answer, msg);
      return;
    }

    // ── Group: reply to .ai or quoted bot message ──
    if (isGroup) {
      const quotedId       = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const isBotQuoted    = quotedParticipant && isBotSelf(quotedParticipant);

      if (!body.startsWith(cfg.PREFIX + "ai") && !isBotQuoted) return;

      const question = body.startsWith(cfg.PREFIX + "ai")
        ? body.slice((cfg.PREFIX + "ai").length).trim()
        : body;

      if (!question) return reply(jid, `Usage: ${cfg.PREFIX}ai <question>`, msg);

      const now  = Date.now();
      const last = cooldowns[senderJid] || 0;
      if (now - last < cfg.COOLDOWN_SECONDS * 1000) return;
      cooldowns[senderJid] = now;

      await sock.sendPresenceUpdate("composing", jid);
      const answer = await askAI(jid, question);
      await reply(jid, answer, msg);
    }
  } catch (e) {
    console.error("[handleMessage]", e.message);
  }
}

// ── Pairing ───────────────────────────────────────

async function requestPairingCode(socket) {
  if (!cfg.PAIR_NUMBER) {
    // readline fallback
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = () => new Promise(resolve => {
      rl.question("Enter phone number to pair (with country code): ", ans => {
        rl.close();
        resolve(ans.trim().replace(/\D/g, ""));
      });
    });

    console.log("PAIR_NUMBER is empty. Waiting 15 s for input...");
    const num = await Promise.race([
      ask(),
      new Promise(resolve => setTimeout(() => resolve(""), 15_000)),
    ]);

    if (!num) {
      console.log("No number entered. Will retry on next connection.");
      return;
    }

    try {
      const code = await socket.requestPairingCode(num);
      console.log(`\n🔑 Pairing code: ${code.match(/.{1,4}/g)?.join("-") || code}\n`);
    } catch (e) {
      console.error("Pairing code request failed:", e.message);
      socket.end();
    }
    return;
  }

  try {
    const code = await socket.requestPairingCode(cfg.PAIR_NUMBER);
    const formatted = code.match(/.{1,4}/g)?.join("-") || code;
    console.log("\n╔══════════════════════════════╗");
    console.log("║      WhatsApp Pairing Code   ║");
    console.log("╠══════════════════════════════╣");
    console.log(`║  Code : ${formatted.padEnd(21)}║`);
    console.log("╠══════════════════════════════╣");
    console.log("║  Steps:                      ║");
    console.log("║  1. Open WhatsApp on phone   ║");
    console.log("║  2. Settings → Linked Devices║");
    console.log("║  3. Link a Device            ║");
    console.log("║  4. Enter the code above     ║");
    console.log("╚══════════════════════════════╝\n");
  } catch (e) {
    console.error("Pairing code request failed:", e.message);
    socket.end();
  }
}

// ── Socket / connection ───────────────────────────

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(cfg.SESSION_FOLDER);

  sock = makeWASocket({
    auth:            state,
    logger:          pino({ level: "silent" }),
    browser:         Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    getMessage:      async () => undefined,
    shouldIgnoreJid: jid =>
      jid === "status@broadcast" || jid.endsWith("@newsletter"),
  });

  // pairing — only if no session yet
  const hasSession = fs.existsSync(path.join(cfg.SESSION_FOLDER, "creds.json"));
  if (!hasSession) {
    setTimeout(() => requestPairingCode(sock), 3_000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log(`✅ ${cfg.BOT_NAME} connected as ${sock.user?.id}`);
      // notify owner once
      try {
        await sock.sendMessage(`${cfg.OWNER_NUMBER}@s.whatsapp.net`, {
          text: `✅ *${cfg.BOT_NAME}* is now online!\n⏱️ ${localTime()}`,
        });
      } catch {}
    }

    if (connection === "close") {
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason;

      console.log(`⚠️ Connection closed. Code: ${code}`);

      if (code === 401) {
        // logged out — wipe session and re-pair
        console.log("🔑 Logged out. Clearing session...");
        fs.rmSync(cfg.SESSION_FOLDER, { recursive: true, force: true });
        setTimeout(connect, 3_000);
        return;
      }

      // 515 = restart required — reconnect almost immediately
      const delay = code === 515 ? 500 : 5_000;
      setTimeout(connect, delay);
    }
  });

  sock.ev.on("messages.upsert", handleMessage);

  // keep-alive
  setInterval(() => {}, 30_000);
}

// ── Entry ─────────────────────────────────────────

if (!cfg.GROQ_API_KEY) {
  console.warn("⚠️  GROQ_API_KEY is empty in config.js. AI replies will fail until you add it.");
}

process.on("uncaughtException",  e => console.error("[uncaughtException]",  e.message));
process.on("unhandledRejection", e => console.error("[unhandledRejection]", e?.message || e));

connect();
