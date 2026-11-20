// ─────────────────────────────────────────
// RISHI BOT v2.0 — index.js
// ─────────────────────────────────────────
'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino   = require('pino');
const fs     = require('fs');
const path   = require('path');
const rl     = require('readline');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const cfg = require('./config');

// ── dynamic state ──
const history   = {};
const cooldowns = {};
const antilinkGroups = new Set();

let botMode        = cfg.MODE;
let autoReply      = cfg.AUTO_REPLY;
let autoViewStatus = cfg.AUTO_VIEW_STATUS;
let autoReact      = cfg.AUTO_REACT;
let startTime      = Date.now();
let sock;

// ── helpers ──
function uptime() {
  let s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60);   s %= 60;
  return `${h}h ${m}m ${s}s`;
}

function nowTime() {
  return new Date().toLocaleString('en-IN', { timeZone: cfg.TIMEZONE });
}

function isOwner(jid) {
  if (!jid) return false;
  const num = jid.replace(/[^0-9]/g, '');
  const own = cfg.OWNER_NUMBER.replace(/[^0-9]/g, '');
  const bot = sock?.user?.id?.replace(/[^0-9]/g, '').split(':')[0] || '';
  return num === own || num === bot;
}

function isAllowed(jid) {
  if (botMode === 'PRIVATE') return isOwner(jid);
  return true;
}

function sc(str) {
  const map = 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
  return String(str).toLowerCase().split('').map(c => {
    const i = c.charCodeAt(0) - 97;
    return i >= 0 && i < 26 ? map[i] : c;
  }).join('');
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

  if (!history[jid]) history[jid] = [];
  history[jid].push({ role: 'user',      content: userText });
  history[jid].push({ role: 'assistant', content: answer   });
  if (history[jid].length > cfg.MAX_HISTORY * 2)
    history[jid] = history[jid].slice(-cfg.MAX_HISTORY * 2);

  return answer;
}

// ── commands ──
const commands = {
  menu: {
    cat: 'General',
    desc: 'Show all commands',
    run: async (sock, msg, jid) => {
      const infoSec = cfg.section('👑', sc('bot info'), [
        `✦ ${sc('owner')}   : ${cfg.CREATOR_NAME}`,
        `✦ ${sc('prefix')}  : ${cfg.PREFIX}`,
        `✦ ${sc('mode')}    : ${botMode}`,
        `✦ ${sc('ai reply')}: ${autoReply ? 'ON' : 'OFF'}`,
        `✦ ${sc('status')}  : ${autoViewStatus ? 'Auto-View' : 'OFF'}`,
        `✦ ${sc('uptime')}  : ${uptime()}`
      ]);

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
        const imgBuf = await (await fetch(cfg.BOT_IMAGE, { signal: AbortSignal.timeout(8000) })).arrayBuffer();
        await sock.sendMessage(jid, { image: Buffer.from(imgBuf), caption: text }, { quoted: msg });
      } catch {
        await sock.sendMessage(jid, { text }, { quoted: msg });
      }
    }
  },

  ai: {
    cat: 'AI',
    desc: 'Ask AI anything',
    run: async (sock, msg, jid, args) => {
      if (!args.length) return sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}ai <question>` }, { quoted: msg });
      await sock.sendPresenceUpdate('composing', jid);
      const ans = await askAI(jid, args.join(' '));
      await sock.sendMessage(jid, { text: ans }, { quoted: msg });
    }
  },

  reset: {
    cat: 'AI',
    desc: 'Clear AI chat memory',
    run: async (sock, msg, jid) => {
      history[jid] = [];
      await sock.sendMessage(jid, { text: '✅ AI chat memory cleared.' }, { quoted: msg });
    }
  },

  s: {
    cat: 'Media & Tools',
    desc: 'Convert replied image to sticker',
    run: async (sock, msg, jid) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const targetMsg = quoted?.imageMessage ? { message: quoted } : (msg.message?.imageMessage ? msg : null);

      if (!targetMsg) {
        return sock.sendMessage(jid, { text: `❌ Kisi image par reply karke *${cfg.PREFIX}s* likhein.` }, { quoted: msg });
      }

      try {
        const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
        const sticker = new Sticker(buffer, {
          pack: cfg.BOT_NAME,
          author: cfg.CREATOR_NAME,
          type: StickerTypes.FULL,
          quality: 70
        });
        await sock.sendMessage(jid, await sticker.toMessage(), { quoted: msg });
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Sticker banane mein error aaya.' }, { quoted: msg });
      }
    }
  },

  vv: {
    cat: 'Media & Tools',
    desc: 'Unlock View-Once photo/video',
    run: async (sock, msg, jid) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const viewOnce = quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessage?.message;

      if (!viewOnce) {
        return sock.sendMessage(jid, { text: `❌ Kisi View-Once photo/video par reply karke *${cfg.PREFIX}vv* likhein.` }, { quoted: msg });
      }

      try {
        const buffer = await downloadMediaMessage({ message: viewOnce }, 'buffer', {});
        if (viewOnce.imageMessage) {
          await sock.sendMessage(jid, { image: buffer, caption: '🔓 Unlocked by ' + cfg.BOT_NAME }, { quoted: msg });
        } else if (viewOnce.videoMessage) {
          await sock.sendMessage(jid, { video: buffer, caption: '🔓 Unlocked by ' + cfg.BOT_NAME }, { quoted: msg });
        }
      } catch (e) {
        await sock.sendMessage(jid, { text: '❌ Media unlock nahi ho paya.' }, { quoted: msg });
      }
    }
  },

  tts: {
    cat: 'Media & Tools',
    desc: 'Convert text to voice note',
    run: async (sock, msg, jid, args) => {
      const text = args.join(' ');
      if (!text) return sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}tts Hello friends` }, { quoted: msg });
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=hi&client=tw-ob`;
      await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
    }
  },

  tagall: {
    cat: 'Group',
    desc: 'Mention all group members',
    run: async (sock, msg, jid, args) => {
      if (!jid.endsWith('@g.us')) return sock.sendMessage(jid, { text: '❌ Ye command sirf groups ke liye hai.' }, { quoted: msg });
      const meta = await sock.groupMetadata(jid);
      const participants = meta.participants.map(p => p.id);
      const message = args.join(' ') || '📢 Attention Everyone!';
      let text = `${message}\n\n`;
      participants.forEach(p => { text += `@${p.split('@')[0]} `; });
      await sock.sendMessage(jid, { text, mentions: participants }, { quoted: msg });
    }
  },

  kick: {
    cat: 'Group',
    desc: 'Remove a member from group',
    run: async (sock, msg, jid) => {
      if (!jid.endsWith('@g.us')) return;
      const sender = msg.key.participant || jid;
      if (!isOwner(sender)) return sock.sendMessage(jid, { text: '❌ Owner only command.' }, { quoted: msg });

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                        msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (!mentioned) return sock.sendMessage(jid, { text: '❌ Kisi ko tag ya reply karein kick karne ke liye.' }, { quoted: msg });

      await sock.groupParticipantsUpdate(jid, [mentioned], 'remove');
      await sock.sendMessage(jid, { text: '👢 User ko group se nikal diya gaya.' }, { quoted: msg });
    }
  },

  antilink: {
    cat: 'Group',
    desc: 'Toggle group link blocker (on/off)',
    run: async (sock, msg, jid, args) => {
      if (!jid.endsWith('@g.us')) return;
      if (!isOwner(msg.key.participant || jid)) return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
      const val = args[0]?.toLowerCase();
      if (val === 'on') {
        antilinkGroups.add(jid);
        await sock.sendMessage(jid, { text: '🛡️ *Anti-Link ON* — WhatsApp group links delete kar diye jayenge.' }, { quoted: msg });
      } else if (val === 'off') {
        antilinkGroups.delete(jid);
        await sock.sendMessage(jid, { text: '🔓 *Anti-Link OFF*' }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}antilink on/off` }, { quoted: msg });
      }
    }
  },

  mode: {
    cat: 'Owner',
    desc: 'Switch PUBLIC or PRIVATE mode',
    run: async (sock, msg, jid, args) => {
      if (!isOwner(msg.key.participant || jid)) return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
      const val = args[0]?.toUpperCase();
      if (val === 'PUBLIC' || val === 'PRIVATE') {
        botMode = val;
        await sock.sendMessage(jid, { text: `✅ Bot mode ab *${botMode}* hai.` }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}mode public / private` }, { quoted: msg });
      }
    }
  },

  autoreply: {
    cat: 'Owner',
    desc: 'Toggle auto AI reply (on/off)',
    run: async (sock, msg, jid, args) => {
      if (!isOwner(msg.key.participant || jid)) return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
      const val = args[0]?.toLowerCase();
      if (val === 'on') autoReply = true;
      else if (val === 'off') autoReply = false;
      else return sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}autoreply on/off` }, { quoted: msg });
      await sock.sendMessage(jid, { text: `✅ Auto reply is now *${autoReply ? 'ON' : 'OFF'}*` }, { quoted: msg });
    }
  },

  autostatus: {
    cat: 'Owner',
    desc: 'Toggle auto status view (on/off)',
    run: async (sock, msg, jid, args) => {
      if (!isOwner(msg.key.participant || jid)) return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
      const val = args[0]?.toLowerCase();
      if (val === 'on') autoViewStatus = true;
      else if (val === 'off') autoViewStatus = false;
      else return sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}autostatus on/off` }, { quoted: msg });
      await sock.sendMessage(jid, { text: `✅ Auto Status View is now *${autoViewStatus ? 'ON' : 'OFF'}*` }, { quoted: msg });
    }
  },

  autoreact: {
    cat: 'Owner',
    desc: 'Toggle auto emoji react (on/off)',
    run: async (sock, msg, jid, args) => {
      if (!isOwner(msg.key.participant || jid)) return sock.sendMessage(jid, { text: '❌ Owner only.' }, { quoted: msg });
      const val = args[0]?.toLowerCase();
      if (val === 'on') autoReact = true;
      else if (val === 'off') autoReact = false;
      else return sock.sendMessage(jid, { text: `Usage: ${cfg.PREFIX}autoreact on/off` }, { quoted: msg });
      await sock.sendMessage(jid, { text: `✅ Auto React is now *${autoReact ? 'ON' : 'OFF'}*` }, { quoted: msg });
    }
  },

  ping: {
    cat: 'General',
    desc: 'Check bot speed',
    run: async (sock, msg, jid) => {
      const t = Date.now();
      const sent = await sock.sendMessage(jid, { text: '🏓 Pong!' }, { quoted: msg });
      const lat = Date.now() - t;
      await sock.sendMessage(jid, { text: `⚡ Latency: ${lat}ms` }, { quoted: sent });
    }
  },

  alive: {
    cat: 'General',
    desc: 'Check bot status',
    run: async (sock, msg, jid) => {
      const sec = cfg.section('🟢', sc('status'), [
        `✦ ${sc('bot')}    : ${cfg.BOT_NAME} v${cfg.VERSION}`,
        `✦ ${sc('uptime')} : ${uptime()}`,
        `✦ ${sc('time')}   : ${nowTime()}`
      ]);
      await sock.sendMessage(jid, { text: sec }, { quoted: msg });
    }
  },

  owner: {
    cat: 'General',
    desc: 'Owner details',
    run: async (sock, msg, jid) => {
      const sec = cfg.section('👤', sc('owner info'), [
        `✦ ${sc('name')}   : ${cfg.CREATOR_NAME}`,
        `✦ ${sc('number')} : ${cfg.OWNER_NUMBER}`,
        `✦ ${sc('info')}   : ${cfg.CREATOR_INFO}`
      ]);
      await sock.sendMessage(jid, { text: sec }, { quoted: msg });
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
      if (num) {
        try {
          const code = await sock.requestPairingCode(num);
          const fmt  = code.match(/.{1,4}/g).join('-');
          console.log(`\n🔑 PAIRING CODE: ${fmt}\n`);
        } catch (e) {
          console.error('[PAIR] Error:', e.message);
        }
      }
    }, 3000);
  }

  // ── connection updates ──
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log(`[BOT] ${cfg.BOT_NAME} v${cfg.VERSION} connected ✅`);
      startTime = Date.now();
      try {
        const ownerJid = cfg.OWNER_NUMBER.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(ownerJid, {
          text: `🟢 *${cfg.BOT_NAME} v${cfg.VERSION}* is now online!\nType *.menu* to see new commands.`
        });
      } catch {}
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === 401) {
        fs.rmSync(cfg.SESSION_FOLDER, { recursive: true, force: true });
        setTimeout(connect, 3000);
      } else {
        setTimeout(connect, code === 515 ? 500 : 5000);
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
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@newsletter')) continue;

        // 1. Auto View Status
        if (jid === 'status@broadcast') {
          if (autoViewStatus) {
            await sock.readMessages([msg.key]);
          }
          continue;
        }

        // 2. Self-Chat Fix (Allow commands in "Message Yourself", prevent loops)
        const botNum = sock.user?.id?.split(':')[0]?.replace(/[^0-9]/g, '');
        const chatNum = jid.split('@')[0]?.replace(/[^0-9]/g, '');
        const isSelfChat = botNum && chatNum && botNum === chatNum;
        if (msg.key.fromMe && !isSelfChat) continue;

        const sender = msg.key.participant || jid;
        if (!isAllowed(sender)) continue;

        const isGroup = jid.endsWith('@g.us');
        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption || '';

        // 3. Anti-Link Check in Groups
        if (isGroup && antilinkGroups.has(jid) && !isOwner(sender)) {
          if (/chat\.whatsapp\.com\/[a-zA-Z0-9]+/i.test(body)) {
            await sock.sendMessage(jid, { delete: msg.key });
            await sock.sendMessage(jid, { text: `🚫 @${sender.split('@')[0]}, group links allowed nahi hain!`, mentions: [sender] });
            continue;
          }
        }

        if (!body.trim()) continue;

        // 4. Auto React
        if (autoReact && !msg.key.fromMe) {
          const emojis = ['⚡', '🔥', '❤️', '🤖', '✨'];
          const pick = emojis[Math.floor(Math.random() * emojis.length)];
          await sock.sendMessage(jid, { react: { text: pick, key: msg.key } });
        }

        // Cooldown check
        const ck = `${jid}:${sender}`;
        const now = Date.now();
        if (cooldowns[ck] && now - cooldowns[ck] < cfg.COOLDOWN_SECONDS * 1000) continue;
        cooldowns[ck] = now;

        // 5. Prefix Commands
        if (body.startsWith(cfg.PREFIX)) {
          const [rawCmd, ...args] = body.slice(cfg.PREFIX.length).trim().split(/\s+/);
          const cmd = commands[rawCmd.toLowerCase()];
          if (cmd) {
            await cmd.run(sock, msg, jid, args);
          }
          continue;
        }

        // 6. Auto Reply (Skip in self-chat to prevent infinite loop)
        if (!isGroup && !isSelfChat && autoReply) {
          await sock.sendPresenceUpdate('composing', jid);
          const ans = await askAI(jid, body);
          await sock.sendMessage(jid, { text: ans }, { quoted: msg });
          continue;
        }

        // 7. Group Reply to Bot
        if (isGroup) {
          const botJid  = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
          const isReply = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
          if (isReply && autoReply) {
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

setInterval(() => {}, 1000 * 60 * 5);
process.on('uncaughtException',  e => console.error('[UNCAUGHT]',  e));
process.on('unhandledRejection', e => console.error('[UNHANDLED]', e));

connect();
