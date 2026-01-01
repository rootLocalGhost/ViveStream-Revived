const fs = require('fs');
const path = require('path');
const PORTABLE_ROOT = path.join(__dirname, '..', 'python-portable');
const TOP_LEVEL_DIRS_TO_REMOVE = [
  'include',
  'share',
  'tcl',
  'doc',
  'man',
  'manuals',
  'libs',
  'Tools',
  '%cd%',
  'python-darwin-x64', 
];
const EXECUTABLES_ALLOWLIST = [
  'python',
  'python.exe',
  'python3',
  'python3.exe',
  'pythonw',
  'pythonw.exe',
  'pip',
  'pip.exe',
  'yt-dlp',
  'yt-dlp.exe',
  'ffmpeg',
  'ffmpeg.exe',
  'ffprobe',
  'ffprobe.exe',
];
const RECURSIVE_DELETE_PATTERNS = [
  '__pycache__',
  'tests',
  'test',
  'testing',
  'examples',
  'sample',
  'samples',
  'docs',
  '%cd%',
];
const SITE_PACKAGES_CLEANUP_RULES = [
  { pkg: 'docutils', remove: ['languages', 'parsers'] },
  { pkg: 'urllib3', remove: ['contrib/emscripten'] },
  { pkg: 'yt_dlp', remove: ['__pyinstaller'] },
];
function deleteItem(itemPath) {
  if (fs.existsSync(itemPath)) {
    try {
      fs.rmSync(itemPath, { recursive: true, force: true });
    } catch (e) {
    }
  }
}
function isAllowlisted(filename) {
  const name = path.parse(filename).name;
  const base = path.basename(filename);
  const allow = EXECUTABLES_ALLOWLIST.some(
    (a) =>
      a.toLowerCase() === base.toLowerCase() ||
      a.toLowerCase() === name.toLowerCase()
  );
  return allow;
}
function cleanExecutablesFolder(folderPath) {
  if (folderPath.split(path.sep).includes('static_ffmpeg')) {
    return;
  }
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const fullPath = path.join(folderPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        if (!isAllowlisted(file)) {
          deleteItem(fullPath);
        }
      }
    });
  } catch (e) {}
}
function cleanSitePackagesFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return;
  SITE_PACKAGES_CLEANUP_RULES.forEach((rule) => {
    const pkgPath = path.join(folderPath, rule.pkg);
    if (fs.existsSync(pkgPath)) {
      rule.remove.forEach((target) => {
        deleteItem(path.join(pkgPath, target));
      });
    }
  });
  const contents = fs.readdirSync(folderPath);
  contents.forEach((item) => {
    const fullPath = path.join(folderPath, item);
    if (item.endsWith('.dist-info') && fs.statSync(fullPath).isDirectory()) {
      deleteItem(path.join(fullPath, 'RECORD'));
      deleteItem(path.join(fullPath, 'AUTHORS'));
      deleteItem(path.join(fullPath, 'LICENSE'));
      deleteItem(path.join(fullPath, 'licenses'));
    }
  });
}
function walkAndClean(currentDir) {
  if (!fs.existsSync(currentDir)) return;
  let items;
  try {
    items = fs.readdirSync(currentDir);
  } catch (e) {
    return;
  }
  items.forEach((item) => {
    const fullPath = path.join(currentDir, item);
    if (RECURSIVE_DELETE_PATTERNS.includes(item)) {
      deleteItem(fullPath);
      return;
    }
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      return;
    }
    if (stat.isDirectory()) {
      const lowerItem = item.toLowerCase();
      if (lowerItem === 'scripts' || lowerItem === 'bin') {
        cleanExecutablesFolder(fullPath);
        walkAndClean(fullPath);
      } else if (lowerItem === 'site-packages') {
        cleanSitePackagesFolder(fullPath);
        walkAndClean(fullPath);
      } else {
        walkAndClean(fullPath);
      }
    } else {
      if (
        item.endsWith('.pdb') ||
        item.endsWith('.whl') ||
        item.endsWith('.txt') ||
        item.endsWith('.md')
      ) {
        const lower = item.toLowerCase();
        if (
          lower !== 'license.txt' &&
          lower !== 'python314._pth' &&
          !isAllowlisted(item)
        ) {
          deleteItem(fullPath);
        }
      }
    }
  });
}
function main() {
  if (!fs.existsSync(PORTABLE_ROOT)) return;
  const platforms = fs.readdirSync(PORTABLE_ROOT).filter((f) => {
    return fs.statSync(path.join(PORTABLE_ROOT, f)).isDirectory();
  });
  platforms.forEach((platform) => {
    if (platform.includes('darwin') || platform.includes('macos')) {
      deleteItem(path.join(PORTABLE_ROOT, platform));
      return;
    }
    const platformPath = path.join(PORTABLE_ROOT, platform);
    TOP_LEVEL_DIRS_TO_REMOVE.forEach((d) =>
      deleteItem(path.join(platformPath, d))
    );
    walkAndClean(platformPath);
  });
}
if (require.main === module) {
  main();
}
module.exports = {
  cleanExecutablesFolder,
  isAllowlisted,
  deleteItem,
  walkAndClean,
  cleanSitePackagesFolder,
};