const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// DIRECT FIX: Point directly to the root 'binaries' folder matching src/main/binaries.js
const BINARIES_DIR = path.join(__dirname, '..', 'binaries');

// Ensure the folder exists
if (!fs.existsSync(BINARIES_DIR)) fs.mkdirSync(BINARIES_DIR, { recursive: true });

const URLS = {
  solverCore: 'https://github.com/yt-dlp/ejs/releases/download/0.3.2/yt.solver.core.js',
  solverLib: 'https://github.com/yt-dlp/ejs/releases/download/0.3.2/yt.solver.lib.js',
};

async function fetchLatestReleaseTag(repo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!res.ok) throw new Error(`Failed to fetch latest release for ${repo}: ${res.statusText}`);
    const data = await res.json();
    return data.tag_name;
  } catch (error) {
    console.error(`Error fetching latest release for ${repo}:`, error);
    return null;
  }
}

async function downloadFile(url, destPath) {
  console.log(`⬇ Downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
  console.log(`✔ Downloaded to: ${destPath}`);
}

function extractArchive(archivePath, extractDir) {
  console.log(`📦 Extracting: ${archivePath}`);
  try {
    if (archivePath.endsWith('.zip') && os.platform() !== 'win32') {
      try {
        execSync(`unzip -o "${archivePath}" -d "${extractDir}"`);
      } catch (e) {
        console.log('unzip failed, trying python3...');
        execSync(`python3 -m zipfile -e "${archivePath}" "${extractDir}"`);
      }
    } else {
      // Tar usually handles zip on modern windows tar, or linux
      execSync(`tar -xf "${archivePath}" -C "${extractDir}"`);
    }
    console.log(`✔ Extracted.`);
  } catch (error) {
    console.error(`❌ Extraction failed:`, error.message);
    throw error;
  }
}

async function initYtDlp() {
  const repo = 'yt-dlp/yt-dlp';
  const tag = await fetchLatestReleaseTag(repo);
  if (!tag) return;

  const targets = [
    { platform: 'Windows', binaryName: 'yt-dlp.exe', destName: 'yt-dlp.exe' },
    { platform: 'Linux', binaryName: 'yt-dlp_linux', destName: 'yt-dlp_linux' } // Fixed name for Linux to match binaries.js
  ];

  for (const target of targets) {
    // Only download for the current platform to save time/bandwidth, or download all if building
    // For local dev, we prioritize current platform.
    if (os.platform() === 'win32' && target.platform !== 'Windows') continue;
    if (os.platform() === 'linux' && target.platform !== 'Linux') continue;

    const url = `https://github.com/${repo}/releases/download/${tag}/${target.binaryName}`;
    const destPath = path.join(BINARIES_DIR, target.destName);

    let currentVersion = '';
    let needsUpdate = true;

    if (fs.existsSync(destPath)) {
      const versionFile = path.join(BINARIES_DIR, 'yt-dlp-version.json');
      if (fs.existsSync(versionFile)) {
        try {
          const info = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
          if (info.tag === tag) needsUpdate = false;
        } catch (e) { }
      }
    }

    if (!needsUpdate) {
      console.log(`✅ yt-dlp (${target.platform}) is up to date (${tag})`);
      continue;
    }

    console.log(`🔄 Updating yt-dlp (${target.platform}) to ${tag}...`);
    await downloadFile(url, destPath);

    const versionFile = path.join(BINARIES_DIR, 'yt-dlp-version.json');
    let info = {};
    if (fs.existsSync(versionFile)) {
      try { info = JSON.parse(fs.readFileSync(versionFile, 'utf8')); } catch (e) { }
    }
    info.tag = tag;
    info.lastUpdated = new Date();
    fs.writeFileSync(versionFile, JSON.stringify(info));

    if (target.platform === 'Linux' && os.platform() !== 'win32') {
      fs.chmodSync(destPath, 0o755);
    }
  }
}

async function initFFmpeg() {
  const latestReleaseRes = await fetch('https://api.github.com/repos/yt-dlp/FFmpeg-Builds/releases/latest');
  const latestRelease = await latestReleaseRes.json();
  const latestID = latestRelease.id;

  const targets = [
    { platform: 'Windows', osStr: 'win64', ext: 'zip', binaries: ['ffmpeg.exe', 'ffprobe.exe'] },
    { platform: 'Linux', osStr: 'linux64', ext: 'tar.xz', binaries: ['ffmpeg', 'ffprobe'] }
  ];

  const versionFile = path.join(BINARIES_DIR, 'ffmpeg-version.json');
  let currentInfo = {};
  if (fs.existsSync(versionFile)) {
    try {
      currentInfo = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    } catch (e) { }
  }

  let allFilesExist = true;
  // Check if binaries for CURRENT platform exist
  const currentTarget = targets.find(t => (os.platform() === 'win32' ? t.platform === 'Windows' : t.platform === 'Linux'));
  if (currentTarget) {
      for (const b of currentTarget.binaries) {
        if (!fs.existsSync(path.join(BINARIES_DIR, b))) {
            allFilesExist = false;
            break;
        }
      }
  }

  if (currentInfo.id === latestID && allFilesExist) {
    console.log('✅ FFmpeg is up to date.');
    return;
  }

  console.log('🔄 Updating FFmpeg binaries...');
  const tempDir = path.join(os.tmpdir(), 'vivestream-ffmpeg-temp');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir);

  for (const t of targets) {
    // Only download for current platform during dev init
    if (os.platform() === 'win32' && t.platform !== 'Windows') continue;
    if (os.platform() === 'linux' && t.platform !== 'Linux') continue;

    const filename = `ffmpeg-master-latest-${t.osStr}-gpl.${t.ext}`;
    const url = `https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/${filename}`;
    const archivePath = path.join(tempDir, filename);

    await downloadFile(url, archivePath);
    extractArchive(archivePath, tempDir);

    const files = fs.readdirSync(tempDir).filter(f => f !== filename && fs.statSync(path.join(tempDir, f)).isDirectory());
    const extractedFolder = files.find(f => f.includes(t.osStr)); 

    if (extractedFolder) {
      const folderPath = path.join(tempDir, extractedFolder);
      const binDir = path.join(folderPath, 'bin');
      const sourceBin = fs.existsSync(binDir) ? binDir : folderPath;

      t.binaries.forEach(b => {
        const src = path.join(sourceBin, b);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(BINARIES_DIR, b));
          if (t.platform === 'Linux' && os.platform() !== 'win32') {
            fs.chmodSync(path.join(BINARIES_DIR, b), 0o755);
          }
        } else {
          console.warn(`⚠ Could not find ${b} in extracted archive`);
        }
      });
    }
  }

  fs.writeFileSync(versionFile, JSON.stringify({ id: latestID, date: new Date() }));
  fs.rmSync(tempDir, { recursive: true, force: true });
}

async function initSolvers() {
  const files = ['yt.solver.core.js', 'yt.solver.lib.js'];
  const urls = [URLS.solverCore, URLS.solverLib];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const url = urls[i];
    const targetPath = path.join(BINARIES_DIR, file);
    if (!fs.existsSync(targetPath)) {
      console.log(`⬇ Downloading missing solver: ${file}`);
      await downloadFile(url, targetPath);
    }
  }
}

async function copyLibs() {
  console.log('📦 Vendor Init: Copying frontend libraries...');
  const libs = [
    {
      src: path.join(__dirname, '..', 'node_modules', 'sortablejs', 'Sortable.min.js'),
      dest: path.join(__dirname, '..', 'src', 'renderer', 'js', 'lib', 'Sortable.min.js'),
    },
  ];

  libs.forEach((lib) => {
    const destDir = path.dirname(lib.dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (fs.existsSync(lib.src)) {
      fs.copyFileSync(lib.src, lib.dest);
      console.log(`   ✔ Copied: ${path.basename(lib.src)}`);
    } else {
      // Don't crash if node_modules missing, might be pre-install
      console.warn(`   ⚠ Missing source lib: ${lib.src} (Run npm install first)`);
    }
  });
}

async function main() {
  try {
    await copyLibs();
    await initYtDlp();
    await initFFmpeg();
    await initSolvers();
    console.log('🎉 Vendor initialization complete!');
  } catch (e) {
    console.error('❌ Vendor initialization failed:', e);
    process.exit(1);
  }
}

main();