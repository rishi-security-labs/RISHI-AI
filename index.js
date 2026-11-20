// ─────────────────────────────────────────
// RISHI BOT — index.js
// ─────────────────────────────────────────
'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeInMemoryStore
} = require('@whiskeysockets/baileys');
const pino   = require('pino');
const fs     = require('fs');
const path   = require('path');
const rl     = require('readline');

const cfg = require('./config');

// ── startup check ──
if (!cfg.GROQ_API_KEY) {
  console.log('[WARN] GROQ_API_KEY is empty — AI replies will not work.');
}

// ── state ──
const history   = {};   // jid → [{role,content}]
const cooldowns = {};   // jid+sender → timestamp
let   autoReply = cfg.AUTO_REPLY;
let   startTime = Date.now();
let   sock;

// ── uptime helper ──
function uptime() {
  let s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60);   s %= 60;
  return `${h}h ${m}m ${s}s`;
}

// ── current time (TIMEZONE) ──
function nowTime() {
  return new Date().toLocaleString('en-US', { timeZone: cfg.TIMEZONE });
}

// ── is owner ──
function isOwner(jid) {
  const num = jid.replace(/[^0-9]/g, '');
  const own = cfg.OWNER_NUMBER.replace(/[^0-9]/g, '');
  const bot = sock?.user?.id?.replace(/[^0-9]/g, '').split(':')[0] || '';
  return num === own || num === bot;
}

// ── is allowed (MODE check) ──
function isAllowed(jid) {
  if (cfg.MODE === 'PRIVATE') return isOwner(jid);
  return true;
}

// ── Groq AI call ──
async function askAI(jid, userText) {
  const msgs = history[jid] || [];
  const payload = {
    model:            cfg.GROQ_MODEL,
    reasoning_effort: cfg.REASONING_EFFORT,
    max_tokens:       600,
    messages: [
      { role: 'system', content: cfg.SYSTEM_PROMPT },
      ...msgs,
      { role: 'user', content: userText }
    ]
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  let res, body;
  try {
    res  = await fetch(cfg.GROQ_URL, {
      method:  'POST',
      signal:  ctrl.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    body = await res.json();
  } catch (e) {
    console.error('[AI] fetch error:', e.message);
    return 'AI is busy, try again in a moment 🙏';
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok || !body?.choices?.[0]?.message?.content) {
    console.error(`[AI] status=${res?.status} body=`, JSON.stringify(body));
    return 'AI is busy, try again in a moment 🙏';
  }

  const answer = body.choices[0].message.content.trim();

  // update history
  if (!history[jid]) history[jid] = [];
  history[jid].push({ role: 'user',      content: userText });
  history[jid].push({ role: 'assistant', content: answer   });
  if (history[jid].length > cfg.MAX_HISTORY * 2)
    history[jid] = history[jid].slice(-cfg.MAX_HISTORY * 2);

  return answer;
}

// ── small-caps helper ──
function sc(str) {
  const map = 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
  return String(str).toLowerCase().split('').map(c => {
    const i = c.charCodeAt(0) - 97;
    return i >= 0 && i < 26 ? map[i] : c;
  }).join('');
}

// ── commands ──
const commands = {
  menu: {
    cat: 'General',
    desc: 'Show this menu',
    run: async (sock, msg, jid, _args) => {
      const mode   = cfg.MODE;
      const arText = autoReply ? 'ON' : 'OFF';

      const infoSec = cfg.section('👑', sc('bot info'), [
        `✦ ${sc('owner')}  : ${cfg.CREATOR_NAME}`,
        `✦ ${sc('prefix')} : ${cfg.PREFIX}`,
        `✦ ${sc('mode')}   : ${mode}`,
        `✦ ${sc('ai reply')}: ${arText}`,
        `✦ ${sc('status')} : Online 🟢`,
        `✦ ${sc('uptime')} : ${uptime()}`
      ]);

      // group commands by category
      const cats = {};
      for (const [name, cmd] of Object.entries(commands)) {
        if (!cats[cmd.cat]) cats[cmd.cat] = [];
        cats[cmd.cat].push(`✦ ${cfg.PREFIX}${name} — ${cmd.desc}`);
      }
      const cmdSecs = Object.entries(cats).map(([cat, lines]) =>
        cfg.section('📌', sc(cat), lines)
      ).join('\n');

      const text = `${cfg.header()}\n${infoSec}\n${cmdSecs}`;

      try {
        const imgBuf = await (await fetch(cfg.BOT_IMAGE, { signal: AbortSignal.timeout(10000) })).arrayBuffer();
        await sock.sendMessage(jid, {
          image:   Buffer.from(imgBuf),
          caption: text
        }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, { text }, { quoted: msg });
      }
    }
  },

  ai: {
    cat: 'AI',
    desc: 'Ask the AI a question',
    run: async (sock, msg, jid, args) => {
      if (!args.length) {
        await sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}ai <your question>` }, { quoted: msg });
        return;
      }
      await sock.sendPresenceUpdate('composing', jid);
      const ans = await askAI(jid, args.join(' '));
      await sock.sendMessage(jid, { text: ans }, { quoted: msg });
    }
  },

  reset: {
    cat: 'AI',
    desc: 'Clear your chat history with the AI',
    run: async (sock, msg, jid, _args) => {
      history[jid] = [];
      await sock.sendMessage(jid, { text: '✅ Your AI chat history has been cleared.' }, { quoted: msg });
    }
  },

  about: {
    cat: 'General',
    desc: 'About this bot',
    run: async (sock, msg, jid, _args) => {
      const sec = cfg.section('ℹ️', sc('about'), [
        `✦ ${sc('bot')}     : ${cfg.BOT_NAME}`,
        `✦ ${sc('ai')}      : ${cfg.AI_NAME}`,
        `✦ ${sc('creator')} : ${cfg.CREATOR_NAME}`,
        `✦ ${sc('info')}    : ${cfg.CREATOR_INFO}`,
        `✦ ${sc('version')} : ${cfg.VERSION}`
      ]);
      await sock.sendMessage(jid, { text: sec }, { quoted: msg });
    }
  },

  ping: {
    cat: 'General',
    desc: 'Check bot latency',
    run: async (sock, msg, jid, _args) => {
      const t = Date.now();
      await sock.sendMessage(jid, { text: '🏓 Pong!' }, { quoted: msg });
      const lat = Date.now() - t;
      await sock.sendMessage(jid, { text: `⚡ Latency: ${lat}ms` });
    }
  },

  alive: {
    cat: 'General',
    desc: 'Check if bot is online',
    run: async (sock, msg, jid, _args) => {
      const sec = cfg.section('🟢', sc('status'), [
        `✦ ${sc('bot')}    : ${cfg.BOT_NAME} is Online`,
        `✦ ${sc('uptime')} : ${uptime()}`,
        `✦ ${sc('time')}   : ${nowTime()}`
      ]);
      await sock.sendMessage(jid, { text: sec }, { quoted: msg });
    }
  },

  owner: {
    cat: 'General',
    desc: 'Get owner contact',
    run: async (sock, msg, jid, _args) => {
      const sec = cfg.section('👤', sc('owner info'), [
        `✦ ${sc('name')}   : ${cfg.CREATOR_NAME}`,
        `✦ ${sc('number')} : ${cfg.OWNER_NUMBER}`,
        `✦ ${sc('info')}   : ${cfg.CREATOR_INFO}`
      ]);
      await sock.sendMessage(jid, { text: sec }, { quoted: msg });
    }
  },

  runtime: {
    cat: 'General',
    desc: 'Bot runtime / uptime',
    run: async (sock, msg, jid, _args) => {
      await sock.sendMessage(jid, { text: `⏱ Uptime: ${uptime()}` }, { quoted: msg });
    }
  },

  time: {
    cat: 'General',
    desc: 'Current time',
    run: async (sock, msg, jid, _args) => {
      await sock.sendMessage(jid, { text: `🕐 ${nowTime()} (${cfg.TIMEZONE})` }, { quoted: msg });
    }
  },

  autoreply: {
    cat: 'Owner',
    desc: 'Toggle auto AI reply (owner only)',
    run: async (sock, msg, jid, args) => {
      if (!isOwner(msg.key.participant || msg.key.remoteJid)) {
        await sock.sendMessage(jid, { text: '❌ Owner only command.' }, { quoted: msg });
        return;
      }
      const val = args[0]?.toLowerCase();
      if (val === 'on')       autoReply = true;
      else if (val === 'off') autoReply = false;
      else {
        await sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}autoreply on/off` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(jid, {
        text: `✅ Auto reply is now *${autoReply ? 'ON' : 'OFF'}*`
      }, { quoted: msg });
    }
  }
};

// ── connect ──
async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(cfg.SESSION_FOLDER);

  sock = makeWASocket({
    logger:           pino({ level: 'silent' }),
    auth:             state,
    browser:          Browsers.ubuntu('Chrome'),
    syncFullHistory:  false,
    getMessage:       async () => undefined
  });

  // ── pairing ──
  const sessionExists = fs.existsSync(path.join(cfg.SESSION_FOLDER, 'creds.json'));
  if (!sessionExists) {
    setTimeout(async () => {
      let num = cfg.PAIR_NUMBER?.replace(/[^0-9]/g, '');
      if (!num) {
        // fallback readline
        const r = rl.createInterface({ input: process.stdin, output: process.stdout });
        num = await new Promise(res => {
          let answered = false;
          const t = setTimeout(() => {
            if (!answered) {
              console.log('[PAIR] No input received — retrying in 15s…');
              r.close();
              res('');
            }
          }, 15000);
          r.question('Enter your WhatsApp number (with country code): ', v => {
            answered = true;
            clearTimeout(t);
            r.close();
            res(v.replace(/[^0-9]/g, ''));
          });
        });
        if (!num) { sock.end(); return; }
      }

      try {
        const code = await sock.requestPairingCode(num);
        const fmt  = code.match(/.{1,4}/g).join('-');
        console.log('\n╔════════════════════════╗');
        console.log('║   PAIRING CODE STEPS   ║');
        console.log('╠════════════════════════╣');
        console.log('║ 1. Open WhatsApp        ║');
        console.log('║ 2. Linked devices       ║');
        console.log('║ 3. Link a device        ║');
        console.log(`║ 4. Enter: ${fmt.padEnd(13)}║`);
        console.log('╚════════════════════════╝\n');
      } catch (e) {
        console.error('[PAIR] Failed to get code:', e.message);
        sock.end();
      }
    }, 3000);
  }

  // ── connection updates ──
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, isNewLogin }) => {
    if (connection === 'open') {
      console.log(`[BOT] ${cfg.BOT_NAME} connected ✅`);
      startTime = Date.now();
      // notify owner
      try {
        const ownerJid = cfg.OWNER_NUMBER.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(ownerJid, {
          text: `🟢 *${cfg.BOT_NAME}* is now online!\nVersion: ${cfg.VERSION}`
        });
      } catch {}
    }
    if (connection === 'close') {
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason;
      console.log(`[BOT] Disconnected — code ${code}`);
      if (code === 401) {
        // logged out — wipe session and re-pair
        console.log('[BOT] Logged out. Clearing session…');
        fs.rmSync(cfg.SESSION_FOLDER, { recursive: true, force: true });
        setTimeout(connect, 3000);
      } else {
        const delay = code === 515 ? 500 : 5000;
        setTimeout(connect, delay);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── messages ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe)   continue;

        // ignore status / newsletter
        const jid = msg.key.remoteJid;
        if (!jid) continue;
        if (jid === 'status@broadcast') continue;
        if (jid.endsWith('@newsletter'))  continue;

        if (!isAllowed(msg.key.participant || jid)) continue;

        const isGroup = jid.endsWith('@g.us');
        const sender  = msg.key.participant || jid;

        // extract text
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption || '';

        if (!body.trim()) continue;

        // cooldown check
        const ck = `${jid}:${sender}`;
        const now = Date.now();
        if (cooldowns[ck] && now - cooldowns[ck] < cfg.COOLDOWN_SECONDS * 1000) continue;
        cooldowns[ck] = now;

        // ── prefix commands ──
        if (body.startsWith(cfg.PREFIX)) {
          const [rawCmd, ...args] = body.slice(cfg.PREFIX.length).trim().split(/\s+/);
          const cmdName = rawCmd.toLowerCase();
          const cmd = commands[cmdName];
          if (cmd) {
            await cmd.run(sock, msg, jid, args);
          }
          continue;
        }

        // ── auto reply (private chats) ──
        if (!isGroup && autoReply) {
          await sock.sendPresenceUpdate('composing', jid);
          const ans = await askAI(jid, body);
          await sock.sendMessage(jid, { text: ans }, { quoted: msg });
          continue;
        }

        // ── group: .ai <q> or reply to bot ──
        if (isGroup) {
          const botJid  = sock.user?.id;
          const isReply = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
          const isAICmd = body.toLowerCase().startsWith('.ai ');

          if (isAICmd) {
            const q = body.slice(4).trim();
            if (!q) continue;
            await sock.sendPresenceUpdate('composing', jid);
            const ans = await askAI(jid, q);
            await sock.sendMessage(jid, { text: ans }, { quoted: msg });
          } else if (isReply && autoReply) {
            await sock.sendPresenceUpdate('composing', jid);
            const ans = await askAI(jid, body);
            await sock.sendMessage(jid, { text: ans }, { quoted: msg });
          }
        }
      } catch (e) {
        console.error('[MSG] handler error:', e.message);
      }
    }
  });
}

// ── keep alive + error guard ──
setInterval(() => {}, 1000 * 60 * 5);

process.on('uncaughtException',  e => console.error('[UNCAUGHT]',  e));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

connect();
