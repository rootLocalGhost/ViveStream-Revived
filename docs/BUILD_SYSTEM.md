# **⚠️ Note:** Docs are generate by AI

## 🛠️ Build System & Vendor Management

The project uses a sophisticated custom build system to handle cross-platform complexities, particularly regarding external dependencies like Python, FFmpeg, and yt-dlp.

## 📜 The Builder Script (`helpers/builder.js`)

We do not use the standard `electron-builder` CLI directly. Instead, we run `node helpers/builder.js [flags]`.

### Workflow

1.  **Preparation**:
    - **Vendor Init**: Runs `helpers/vendor-init.js` to prepare frontend libraries.
2.  **Configuration**:
    - Detects the OS or target flag (`--win`, `--linux`).
    - Selects the appropriate binaries from `binaries/` based on the target platform.
3.  **Dependency Injection**:
    - Copies the **platform-specific** binaries into the build artifacts (via `extraResources`).
    - Ensures binaries have executable permissions (`chmod 755`) on Linux.
4.  **Building**:
    - Generates a temporary `temp-build-config.json` for `electron-builder`.
    - Executes `electron-builder` with this dynamic config.
    - **Linux**: Builds AppImage, Deb, RPM, Snap (if requested).
    - **Windows**: Builds NSIS Installer (setup.exe).
    - **macOS**: Builds DMG.
5.  **Cleanup**:
    - Moves final artifacts to `release/<platform>/`.
    - Deletes temporary build folders.


## 📦 Standalone Binaries

Instead of a full Python environment, we now bundle standalone executables for `yt-dlp` and `ffmpeg`.

### Strategy
- **Windows**: Copies `yt-dlp.exe`, `ffmpeg.exe` and `ffprobe.exe` from `binaries/` to the build artifacts.
- **Linux**: Copies `yt-dlp_linux` (renamed/accessed as needed), `ffmpeg` and `ffprobe` from `binaries/` to the build artifacts.

### Folder Structure (Build Artifact)
```
resources/
├── binaries/
│   ├── ffmpeg(.exe)
│   ├── ffprobe(.exe)
│   └── yt-dlp(.exe)
```


## 🚀 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/build.yml`) mirrors the local build process:

1.  Checks out code.
2.  Runs `npm install`.
3.  Runs `node helpers/builder.js` with the appropriate flags for the target platform.
4.  Uploads artifacts to a GitHub Release.
