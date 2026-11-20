# ⚡ RISHI BOT v2.0 — WhatsApp AI & Multi-Device Bot

A fast, lightweight, and feature-rich WhatsApp Multi-Device bot powered by **Baileys** and **Groq AI**. Easy to deploy on **Katabump**, **Pterodactyl Panels**, **VPS**, or **Termux**.

---

## 📋 Table of Contents
1. [Features](#-features)
2. [Prerequisites & API Keys](#-prerequisites--api-keys)
3. [How to Deploy on Katabump / Panel (Step-by-Step)](#-how-to-deploy-on-katabump--panel-step-by-step)
4. [How to Connect with WhatsApp (Pairing Code)](#-how-to-connect-with-whatsapp-pairing-code)
5. [How to Use the Bot](#-how-to-use-the-bot)
6. [Complete Commands List](#-complete-commands-list)
7. [Default Configuration & Credentials](#-default-configuration--credentials)
8. [Core API Endpoints](#-core-api-endpoints)
9. [GitHub Upload Commands](#-github-upload-commands)
10. [Troubleshooting / Common Errors](#-troubleshooting--common-errors)
11. [License & Credits](#-license--credits)

---

## ✨ Features
- 🤖 **Smart AI Chat:** Auto-replies in personal chats with conversation memory.
- 🔓 **Anti-ViewOnce (`.vv`):** Unlock view-once photos and videos easily.
- 🎨 **Sticker Maker (`.s`):** Turn any photo into a WhatsApp sticker instantly.
- 🗣️ **Text-to-Speech (`.tts`):** Convert any text message into a voice note.
- 🛡️ **Group Admin Tools:** Tag all members (`.tagall`), kick users (`.kick`), and block group links (`.antilink`).
- 👁️ **Auto-Status View:** Automatically views your contacts' WhatsApp statuses.
- ⚙️ **Live Owner Controls:** Switch modes (`.mode public/private`), toggle `.autoreply`, `.autostatus`, and `.autoreact` directly from WhatsApp.

---

## 🔑 Prerequisites & API Keys
Before starting, make sure you have:
1. **A Free Groq API Key:**
   - Go to [console.groq.com](https://console.groq.com) and sign in.
   - Click on **API Keys** → **Create API Key**.
   - Copy the key (starts with `gsk_...`).
2. **A WhatsApp Account:** The phone number you want to turn into a bot.

---

## 🚀 How to Deploy on Katabump / Panel (Step-by-Step)

Follow these exact steps to host the bot for free on **Katabump** (or any Pterodactyl Node.js panel):

### Step 1: Create a Server on Katabump
1. Go to [Katabump Dashboard](https://dashboard.katabump.com) and log in.
2. Click on **Create Server**.
3. Give your server a name (e.g., `Rishi-Bot`), select **Node.js** as the server type/egg, and create the server.

### Step 2: Upload Bot Files
1. Open your server in the panel and go to the **Files** tab.
2. Upload the following files from this repository:
   - `index.js`
   - `config.js`
   - `package.json`
   *(Note: Alternatively, go to the **Startup** tab, paste this GitHub repository URL into **Git Repo Address**, and restart the server to auto-download files).*

### Step 3: Edit `config.js`
1. In the **Files** tab, click on `config.js` to open the editor.
2. Update these 3 lines with your details:
   ```javascript
   const OWNER_NUMBER   = '+91 9876543210'; // Your WhatsApp number with country code
   const PAIR_NUMBER    = '+91 9876543210'; // Same WhatsApp number for pairing code
   const GROQ_API_KEY   = 'gsk_your_actual_api_key_here'; // Paste your Groq API key
   ```
3. Click **Save Content**.

### Step 4: Set Node.js Version & Start
1. Go to the **Startup** tab in your panel.
2. Make sure **Node.js Version** is set to **Node 20** (or Node 18+).
3. Set **Main File** to `index.js`.
4. Go to the **Console** tab and click **Start**.
5. Wait 10–20 seconds while the panel automatically installs `@whiskeysockets/baileys`, `pino`, and `wa-sticker-formatter`.

---

## 📱 How to Connect with WhatsApp (Pairing Code)

Once the installation finishes, look at the **Console** screen:

1. An **8-Digit Pairing Code** (e.g., `ABCD-1234`) will appear in the console.
2. Open **WhatsApp** on your mobile phone.
3. Tap the **Three Dots (`⋮`)** at the top right (or **Settings** on iPhone).
4. Tap **Linked Devices** → **Link a Device**.
5. At the bottom, tap **"Link with phone number instead"**.
6. Enter the **8-Digit Code** shown in your Katabump console.
7. Within 5 seconds, your console will show `[BOT] RISHI BOT v2.0 connected ✅` and you will receive an **"Online"** message on WhatsApp!

---

## 💡 How to Use the Bot

### 1. In Personal Chats (DM)
- **Commands:** Send any command starting with `.` (dot), such as `.menu` or `.ping`.
- **AI Chat:** Simply send any normal text message (e.g., *"Explain Python loops"*), and the bot will automatically reply using AI.
- **Self-Chat ("Message Yourself"):** You can test all `.` commands directly in your own *"Message Yourself"* chat.

### 2. In WhatsApp Groups
- **Using Commands:** Type `.menu`, `.tagall`, `.s`, etc.
- **Talking to AI in Groups:** The bot will **not** reply to every random group message to avoid spam. To talk to the AI in a group:
  - Either use `.ai <your question>` (e.g., `.ai What is HTML?`)
  - Or **Swipe/Reply** directly to any message sent by the bot.

---

## 📌 Complete Commands List

### 🌐 General Commands
| Command | Usage | Description |
| :--- | :--- | :--- |
| `.menu` | `.menu` | Displays the bot dashboard, status, and all commands |
| `.ping` | `.ping` | Checks bot response speed (latency in ms) |
| `.alive` | `.alive` | Shows bot uptime, version, and current time |
| `.owner` | `.owner` | Displays bot creator & owner contact info |

### 🤖 AI Commands
| Command | Usage | Description |
| :--- | :--- | :--- |
| `.ai` | `.ai <question>` | Ask any question to the AI assistant |
| `.reset` | `.reset` | Clears your previous AI conversation memory |

### 🛠️ Media & Utility Tools
| Command | Usage | Description |
| :--- | :--- | :--- |
| `.s` | Reply to an image with `.s` | Converts any photo into a WhatsApp sticker |
| `.vv` | Reply to View-Once with `.vv` | Unlocks View-Once photos/videos and sends them normally |
| `.tts` | `.tts <your text>` | Converts text into an audio voice note |

### 👥 Group Management Commands
| Command | Usage | Description |
| :--- | :--- | :--- |
| `.tagall` | `.tagall <message>` | Mentions/tags every member in the group |
| `.kick` | `.kick @user` (or reply) | Removes a member from the group *(Bot must be Admin)* |
| `.antilink` | `.antilink on` / `off` | Automatically deletes WhatsApp group invite links |

### 👑 Owner-Only Controls
| Command | Usage | Description |
| :--- | :--- | :--- |
| `.mode` | `.mode public` / `private` | `PUBLIC`: Anyone can use the bot. `PRIVATE`: Only Owner can use it |
| `.autoreply` | `.autoreply on` / `off` | Turns automatic AI replies ON or OFF |
| `.autostatus`| `.autostatus on` / `off` | Turns automatic WhatsApp status viewing ON or OFF |
| `.autoreact` | `.autoreact on` / `off` | Turns automatic emoji reactions on messages ON or OFF |

---

## 🔐 Default Configuration & Credentials
All bot credentials and default settings are managed inside `config.js`:

| Setting Key | Default Value | Description |
| :--- | :--- | :--- |
| `BOT_NAME` | `RISHI BOT` | Display name of the bot |
| `AI_NAME` | `FUCHKUN AI` | Persona name of the AI assistant |
| `OWNER_NUMBER` | `+91 0000000000` | Admin/Owner phone number (Full command access) |
| `PREFIX` | `.` | Command trigger symbol |
| `MODE` | `PUBLIC` | Default access mode (`PUBLIC` or `PRIVATE`) |
| `TIMEZONE` | `Asia/Kolkata` | Default timezone for `.time` and `.alive` |
| `SESSION_FOLDER` | `session` | Directory where WhatsApp login auth files are stored |

---

## 🔗 Core API Endpoints
This bot relies on the following external API endpoints to function:

| Service | Endpoint URL | Method | Purpose |
| :--- | :--- | :--- | :--- |
| **Groq AI Proxy** | `https://fei-ai.vercel.app/api/groq` | `POST` | Generates AI chat responses (`openai/gpt-oss-20b` model) |
| **Google TTS** | `https://translate.google.com/translate_tts` | `GET` | Converts text queries into Hindi/English audio voice notes |
| **WhatsApp Web** | `wss://web.whatsapp.com/ws/chat` (via Baileys) | `WSS` | Real-time Multi-Device WhatsApp socket connection |

---

## 📤 GitHub Upload Commands
To upload your own modified version of this bot to GitHub (make sure `.gitignore` excludes `session/` and `node_modules/`):

```bash
git init
git add .
git commit -m "Initial commit: RISHI BOT v2.0"
git branch -M main
git remote add origin [https://github.com/rishi-security-labs/RISHI-AI.git](https://github.com/rishi-security-labs/RISHI-AI.git))
git push -u origin main
```

---

## ❓ Troubleshooting / Common Errors
- **Bot says `"AI is busy, try again in a moment"`:**
  - Check your `GROQ_API_KEY` in `config.js`. Make sure there are no extra spaces or semicolons (`;`) inside the key.
- **No Pairing Code showing in Console:**
  - Make sure `PAIR_NUMBER` in `config.js` includes your country code (e.g., `+91 9876543210`).
  - If an old `session` folder exists, delete the `session` folder from the **Files** tab and restart the server.
- **Bot disconnected / Logged out (Code 401):**
  - The bot automatically deletes the old session and restarts. Check the console after 5 seconds for a new pairing code.

---

## 📄 License & Credits
- **License:** Distributed under the **MIT License**. Free to use, modify, and distribute with attribution.
- **Developer:** **RISHI TECH**
- **Core Library:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
