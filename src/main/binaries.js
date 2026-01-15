const path = require('path');
const { app } = require('electron');
const fs = require('fs');

const isDev = !app.isPackaged;

function getBinariesPath() {
  return isDev
    ? path.join(__dirname, '..', '..', 'binaries')
    : path.join(process.resourcesPath, 'binaries');
}

function getBinaryPath(name) {
  const binariesPath = getBinariesPath();
  const platform = process.platform;
  let filename = name;

  if (platform === 'win32') {
    filename = `${name}.exe`;
  } else if (name === 'yt-dlp') {
      filename = 'yt-dlp_linux';
  }
  
  const fullPath = path.join(binariesPath, filename);
  
  if (platform !== 'win32' && fs.existsSync(fullPath)) {
      try {
        fs.chmodSync(fullPath, 0o755);
      } catch (e) {
          console.warn(`[Binaries] Failed to chmod ${fullPath}: ${e.message}`);
      }
  }
  
  return fullPath;
}

module.exports = {
  getYtDlp: () => getBinaryPath('yt-dlp'),
  getFfmpeg: () => getBinaryPath('ffmpeg'),
  getFfprobe: () => getBinaryPath('ffprobe'),
  getFfplay: () => getBinaryPath('ffplay'),
};
