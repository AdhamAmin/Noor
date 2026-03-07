<br>
<div align="center">

# 🌙 نور — Noor Prayer App

**A beautiful, bilingual progressive web app for Muslim prayer times, Quran, and Azkar.**

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blueviolet?style=flat-square&logo=googlechrome)](#)
[![Offline Support](https://img.shields.io/badge/Offline-Supported-green?style=flat-square&logo=serviceworker)](#)
[![Arabic RTL](https://img.shields.io/badge/Arabic-RTL_Support-gold?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](#)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🕌 **Prayer Times** | Accurate daily prayer times via GPS + Aladhan API |
| ⏱️ **Live Countdown** | Animated circular countdown to the next prayer |
| 📖 **Quran Reader** | Full Quran with Arabic text, Surah navigation, and audio playback |
| 🎙️ **Reciter Selection** | Choose between multiple Quranic reciters (Shuyukh) |
| 🔖 **Ayah Bookmarks** | Single smart bookmark icon — turns gold and expands to "Go to saved" when set |
| 📿 **Interactive Azkar** | Tap-to-decrement counter with haptics & bilingual success popup |
| 🌐 **Bilingual UI** | Fully translated English ↔ Arabic interface |
| 🕯️ **Ramadan Mode** | Decorative Fawanees, Zeena pennants, and Madfaa cannon at Maghrib |
| 🔔 **Adhan Playback** | Auto-plays Adhan audio when prayer time is reached |
| 📱 **PWA / Installable** | Install as a standalone app on iOS, Android, and Desktop |
| 🌓 **Multiple Themes** | Dark, Light, and Ramadan themes |
| 📵 **Mobile Stars BG** | On phones, the Surah reader shows only ambient stars & crescent |

---

## 🗂️ Project Structure

```
noor/
├── 📄 index.html          ← App shell & HTML structure
├── 📄 manifest.json       ← PWA manifest (icons, display mode)
├── 📄 sw.js               ← Service Worker for offline caching
│
├── 📁 css/
│   └── styles.css         ← All styles (themes, components, animations)
│
├── 📁 js/
│   ├── api.js             ← API calls (Aladhan, Quran, Azkar, Geocoding)
│   ├── engine.js          ← Countdown timer logic + SVG progress ring
│   ├── main.js            ← Core app logic (NoorApp class)
│   ├── particles.js       ← Particle effects & Ramadan decorations
│   └── settings.js        ← Theme & settings management
│
└── 📁 assets/
    ├── icon.png           ← App icon (192×192 & 512×512)
    └── icon.svg           ← Scalable SVG icon
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│                  index.html                 │
│   (App Shell — Views, Modals, Navigation)   │
└──────────────┬──────────────────────────────┘
               │ loads
     ┌─────────▼──────────────────────────┐
     │          NoorApp  (main.js)        │
     │  ┌──────────┐  ┌────────────────┐  │
     │  │ NoorAPI  │  │  NoorSettings  │  │
     │  │ (api.js) │  │ (settings.js)  │  │
     │  └────┬─────┘  └────────────────┘  │
     │       │                            │
     │  ┌────▼─────────┐  ┌────────────┐  │
     │  │  NoorEngine  │  │  Particles │  │
     │  │ (engine.js)  │  │(particles.js)│ │
     │  └──────────────┘  └────────────┘  │
     └────────────────────────────────────┘
```

---

## 🔄 App Flow

```
User Opens App
      │
      ▼
Splash Screen (🕌 Cannon Animation)
      │
      ▼
First Visit? ──Yes──► Welcome Modal (Credits → Language Select)
      │
      ▼ No
 GPS Location Request
      │
      ▼
Fetch Prayer Times (Aladhan API)
      │
      ├──► Display Home Dashboard
      │         ├─ Next Prayer Card
      │         ├─ Circular Countdown Timer
      │         ├─ Prayer List (today)
      │         └─ Daily Doaa Snippet
      │
      ├──► Quran Tab → Surah Grid → Surah Reader
      │            └─ Tap Ayah → Highlight / Play Audio
      │
      └──► Azkar Tab → Category Grid → Azkar Reader
                   └─ Tap Card → Count Decrements → ✨ Popup
```

---

## 📡 APIs Used

| API | Purpose |
|---|---|
| [Aladhan API](https://aladhan.com/prayer-times-api) | Prayer times by coordinates |
| [AlQuran Cloud](https://alquran.cloud/api) | Quran text + audio editions |
| [BigDataCloud](https://www.bigdatacloud.com) | Reverse geocoding (city name) |
| [Doaa API](https://raw.githubusercontent.com/) | Azkar & Doaa JSON data |

---

## 🚀 Getting Started

```bash
# Clone or download the project
git clone https://github.com/your-username/noor-prayer-app.git

# Open directly in browser (no build step needed)
open index.html

# Or serve locally for PWA features
npx serve .
```

> **Note:** The Service Worker requires the app to be served over `http://` or `https://` — opening `index.html` directly via `file://` will not register the SW.

---

## 📱 PWA Installation

On mobile (Chrome/Safari):
1. Open the app in your browser.
2. Tap the **"Install App"** button in Settings, or use your browser's native **Add to Home Screen** option.
3. The app installs and works fully offline.

---

## 🎨 Themes

| Theme | Description |
|---|---|
| 🌑 **Dark** (default) | Deep navy gradient with gold accents |
| ✨ **Ramadan** | Same dark palette + Fawanees, Zeena flags, and Madfaa cannon at Maghrib |
| 🌤️ **Light** | Softer contrast version for daytime reading |

---

## 🔒 Security

The app enforces a strict **Content-Security-Policy** that:
- Disallows `eval()` and dynamic code execution
- Whitelists only the specific CDNs used for audio, fonts, and APIs
- Prevents loading scripts, styles, or media from unknown origins

---

## ✏️ Customization

Inside `js/settings.js`, you can configure:
- **Calculation Method** — Customise the Islamic prayer calculation method (e.g. MWL, ISNA, Egyptian, etc.)
- **Madhab** — Hanafi, Shafi'i, etc.
- **Sound Toggle** — Enable/disable Adhan audio.
- **Madfaa Transition** — Enable the Ramadan cannon animation at Maghrib.

---

## 🤲 Credits

**Designed & Developed by Adham Amin**

Built with ❤️ for Ramadan 1446 / 2025.

---

<div align="center">

*"وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا"*

— سورة النحل: ١٨

</div>
