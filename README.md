# ⚡ RISHI BOT v2.0 — WhatsApp AI & Multi-Device Bot

A fast, lightweight, and feature-rich WhatsApp Multi-Device bot powered by **Baileys** and **Groq AI**. Easy to deploy on **Katabump**, **Pterodactyl Panels**, **VPS**, or **Termux**.

---

## 📋 Table of Contents
1. [Features](#-features)
2. [Prerequisites (What You Need)](#-prerequisites-what-you-need)
3. [How to Deploy on Katabump / Panel (Step-by-Step)](#-how-to-deploy-on-katabump--panel-step-by-step)
4. [How to Connect with WhatsApp (Pairing Code)](#-how-to-connect-with-whatsapp-pairing-code)
5. [How to Use the Bot](#-how-to-use-the-bot)
6. [Complete Commands List](#-complete-commands-list)
7. [Troubleshooting / Common Errors](#-troubleshooting--common-errors)

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

## 🔑 Prerequisites (What You Need)
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

​📱 How to Connect with WhatsApp (Pairing Code)
​Once the installation finishes, look at the Console screen:
​1. An 8-Digit Pairing Code (e.g., ABCD-1234) will appear in the console.
​2. Open WhatsApp on your mobile phone.
​3. Tap the Three Dots (⋮) at the top right (or Settings on iPhone).
​4. Tap Linked Devices → Link a Device.
​5. At the bottom, tap "Link with phone number instead".
​6. Enter the 8-Digit Code shown in your Katabump console.
​7. Within 5 seconds, your console will show [BOT] RISHI BOT v2.0 connected ✅ and you will receive an "Online" message on WhatsApp!
​💡 How to Use the Bot
​1. In Personal Chats (DM)
​Commands: Send any command starting with . (dot), such as .menu or .ping.
​AI Chat: Simply send any normal text message (e.g., "Explain Python loops"), and the bot will automatically reply using AI.
​Self-Chat ("Message Yourself"): You can test all . commands directly in your own "Message Yourself" chat.
​2. In WhatsApp Groups
​Using Commands: Type .menu, .tagall, .s, etc.
​Talking to AI in Groups: The bot will not reply to every random group message to avoid spam. To talk to the AI in a group:
​Either use .ai <your question> (e.g., .ai What is HTML?)
​Or Swipe/Reply directly to any message sent by the bot.
​📌 Complete Commands List
​🌐 General Commands
