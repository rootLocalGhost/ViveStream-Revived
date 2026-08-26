<div align="center">

# ⚠️ ViveStream-Revived is Deprecated

### 🚀 **ViveStream-Next is here!**
This repository is no longer actively maintained. Development has moved to **[ViveStream-Next](https://github.com/rootLocalGhost/ViveStream-Next)**, the next-generation rewrite featuring improved performance, a refreshed UI, and better stability.

[![Check out ViveStream-Next](https://img.shields.io/badge/Switch_to-ViveStream--Next-blueviolet?style=for-the-badge&logo=github)](https://github.com/rootLocalGhost/ViveStream-Next)

---

  <img src="https://github.com/rootLocalGhost/ViveStream-Next/blob/0e91efb12101393417bdc1857a3a0791c488684e/src/assets/Banner.png" alt="ViveStream Banner">

  <p>
    <!-- Release Info -->
    <a href="https://github.com/rootLocalGhost/ViveStream-Revived/releases">
    </a>
    </p>
    
---

<p>
    <a href="https://github.com/rootLocalGhost/ViveStream-Revived/blob/main/LICENSE">
    </a>
    <img src="https://img.shields.io<div align="center">
  <img src="./assets/Banner.png" alt="ViveStream Banner">
</p>
---

  <p>
    <!-- Deprecation Notice Badge -->
    <a href="https://github.com/rootLocalGhost/ViveStream-Next">
      <img src="https://img.shields.io/badge/Status-Deprecated%20%2F%20Legacy-red?style=for-the-badge" alt="Deprecated">
    </a>
    <a href="https://github.com/rootLocalGhost/ViveStream-Next">
      <img src="https://img.shields.io/badge/Next%20Gen-ViveStream--Next-blueviolet?style=for-the-badge" alt="ViveStream-Next">
    </a>
  </p>

  <p>
    <!-- Release Info -->
    <a href="https://github.com/rootLocalGhost/ViveStream-Revived/releases">
      <img src="https://img.shields.io/github/v/release/rootLocalGhost/ViveStream-Revived?style=flat-square&label=Legacy%20Version&color=blueviolet" alt="Latest Release">
    </a>
    <a href="https://github.com/rootLocalGhost/ViveStream-Revived/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/rootLocalGhost/ViveStream-Revived?style=flat-square&color=blue" alt="License">
    </a>
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-informational?style=flat-square" alt="Platform">
  </p>
  <p>
    <!-- Stats -->
    <img src="https://img.shields.io/github/downloads/rootLocalGhost/ViveStream-Revived/total?style=flat-square&color=success&label=Downloads" alt="Total Downloads">
    <a href="https://github.com/rootLocalGhost/ViveStream-Revived/stargazers">
      <img src="https://img.shields.io/github/stars/rootLocalGhost/ViveStream-Revived?style=flat-square&color=yellow" alt="Stars">
    </a>
    <a href="https://github.com/rootLocalGhost/ViveStream-Revived/network/members">
      <img src="https://img.shields.io/github/forks/rootLocalGhost/ViveStream-Revived?style=flat-square&color=orange" alt="Forks">
    </a>
    <img src="https://img.shields.io/github/last-commit/rootLocalGhost/ViveStream-Revived?style=flat-square" alt="Last Commit">
  </p>
  <p>
    <!-- Tech Stack -->
    <img src="https://img.shields.io/badge/Electron-2B2E3A?style=flat-square&logo=electron&logoColor=9FEAF9" alt="Electron">
    <img src="https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
    <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
    <img src="https://img.shields.io/badge/SQLite-07405E?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite">
    <img src="https://img.shields.io/badge/yt--dlp-EF233C?style=flat-square&logo=youtube&logoColor=white" alt="yt-dlp">
    <img src="https://img.shields.io/badge/FFmpeg-007808?style=flat-square&logo=ffmpeg&logoColor=white" alt="FFmpeg">
  </p>
</div>

> ### 🚨 Notice: ViveStream-Revived is now in Maintenance Mode
>
> **ViveStream-Revived** has been superseded by the next-generation release: [**ViveStream-Next**](https://github.com/rootLocalGhost/ViveStream-Next).
>
> **ViveStream-Next** features a fully overhauled engine, faster performance, reduced memory usage, improved media scraping, and a redesigned modern interface. Active development and new features have moved entirely to the new repository.
>
> 👉 **[Switch to ViveStream-Next Now](https://github.com/rootLocalGhost/ViveStream-Next)**

---

👋 **ViveStream-Revived** is the legacy edition of our offline-first media player. It downloads content via `yt-dlp`, organizes it into a local SQLite database, and provides an offline interface for media playback without ads or buffering.

<img src="./assets/UI.png" alt="ViveStream UI">

---

## 🚀 Core Features

- 📥 **Versatile Downloader:**
  - **YouTube & More:** Download videos and playlists from supported sites with automatic local playlist creation.
  - **Smart Downloads:** Skips redundant downloads while bumping the "date added" index.
  - **Import Local Files:** Index existing media files from your system directly into the local database with automated thumbnail generation.
- ✂️ **Advanced Download Controls:**
  - Clip specific sections using start/end timestamps.
  - Split videos by chapters into standalone tracks.
  - SponsorBlock integration for removing sponsored segments, intros, and outros.
  - Subtitle scraper (supports official and auto-generated captions).
  - Browser cookie injection for age-restricted/member-only content.
- 📚 **Library Management:**
  - **Fuzzy Search:** Query across videos, artists, and playlists instantly.
  - **Filtering:** Slice library views by media type (video/audio), duration, and source.
  - **Metadata Editor:** Direct inline tag editing for titles, artists, and descriptions.
  - **Custom Playlists & Artists:** Drag-and-drop playlist builder with custom artwork support.
- 🎬 **Integrated Player:**
  - Context-aware queues, gapless playback preloading, and configurable sleep timers.
  - Global system media key bindings.
  - Theater mode, fullscreen, miniplayer, playback speed controls, and subtitle rendering.
- 📦 **Self-Contained:** Packaged with an internal portable Python environment, preconfigured `yt-dlp`, and `FFmpeg` binaries.

---

## 📥 Installation (Legacy)

### Recommended Method (Installer)

> **⚠️ Note:** If upgrading from ViveStream v7.6.0 or lower, perform a clean uninstall first to avoid duplicate installations.

1. Go to the [**Releases**](https://github.com/rootLocalGhost/ViveStream-Revived/releases) page.
2. Download the installer for your OS:
   - **🪟 Windows:** `ViveStream-Revived-Setup-x.x.x.exe` or `.msi`.
   - **🐧 Linux:** `.AppImage`, `.deb`, `.rpm`, `.snap`, or `.tar.gz`.
3. Run the installer.

#### 🗑️ Uninstallation & Data

- **🪟 Windows:** The uninstaller prompts to retain or purge the database and media folder.
- **🐧 Linux:** Package managers do not auto-delete `~/ViveStream`. Purge via **Settings > Danger Zone > Clear All Media** & **Delete Database** before uninstalling.

---

## 💻 For Developers

See `docs/DEVELOPMENT.md` and `docs/ARCHITECTURE.md` for technical documentation.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/rootLocalGhost/ViveStream-Revived.git](https://github.com/rootLocalGhost/ViveStream-Revived.git)
   cd ViveStream-Revived

```

2. **Install dependencies:**
```bash
npm install

```


3. **Hydrate Binaries:**
```bash
npm run env:update

```


4. **Run the application:**
```bash
npm start

```



---

## 🎮 How to Use

1. **Download or Import Content:** Navigate to **Downloads** to grab online media, or go to **Settings > Maintenance > Import Files** for local directories.
2. **Manage Library:** Browse via **Home**, **Favorites**, **Playlists**, or **Artists** with top-bar search and filtering.
3. **Play Media:** Click any thumbnail to trigger the playback queue.

---

## ⌨️ Keyboard Shortcuts (Player)

| Key | Action |
| --- | --- |
| `Space` or `K` | Play / Pause |
| `M` | Mute / Unmute |
| `F` | Toggle Fullscreen |
| `T` | Toggle Theater Mode |
| `I` | Toggle Miniplayer |
| `←` / `→` | Seek Back / Forward 5s |
| `↑` / `↓` | Volume Up / Down |
| `N` | Play Next Media |
| `P` | Play Previous Media |

---

## 🛠️ Build From Source

```bash
# Windows (.exe, .msi, .zip source)
npm run build:win

# Linux (.AppImage, .deb, .snap, .tar.gz)
npm run build:linux

# Linux via Docker (.rpm and others)
npm run build:docker

# Build All
npm run build:all

```

---

## ⚠️ Issues and Fixes

* Check out [BUILD_PREPARATION](https://www.google.com/search?q=./docs/BUILD_PREPERATION.md) for build debugging.

---

## 🤝 Contributing

New features are prioritized on the **[ViveStream-Next](https://www.google.com/url?sa=E&source=gmail&q=https://github.com/rootLocalGhost/ViveStream-Next)** codebase. For legacy fixes here:

1. Fork the repo.
2. Create your feature branch (`git checkout -b fix/legacy-issue`).
3. Commit your changes (`git commit -m 'fix: resolve issue'`).
4. Push to the branch (`git push origin fix/legacy-issue`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
