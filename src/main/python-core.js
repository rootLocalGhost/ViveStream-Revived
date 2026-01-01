const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let pythonDetails = null;

function getPythonDetails() {
  if (pythonDetails) return pythonDetails;

  const root = isDev
    ? path.join(__dirname, '..', '..', 'python-portable')
    : path.join(process.resourcesPath, 'python-portable');

  console.log(
    `[Python Core] Detecting environment. Dev: ${isDev}, Root: ${root}`
  );

  let pythonPath = null;
  let binDir = null;


  if (process.platform === 'win32') {
    const winDir = path.join(root, 'python-win-x64');
    if (fs.existsSync(winDir)) {
      pythonPath = path.join(winDir, 'python.exe');
      binDir = path.join(winDir, 'Scripts');
    }
  } else {

    const linuxGnu = path.join(root, 'python-linux-gnu');

    if (fs.existsSync(linuxGnu)) {
      pythonPath = path.join(linuxGnu, 'bin', 'python3');
      binDir = path.join(linuxGnu, 'bin');
    }
  }


  if (!pythonPath || !fs.existsSync(pythonPath)) {
    console.warn('[Python Core] Portable Python not found. Checking system...');
    try {
      const { execSync } = require('child_process');
      try {
        const out = execSync('python3 --version').toString();
        if (out.includes('Python 3')) {
          pythonPath = 'python3';
          console.log("[Python Core] System 'python3' found:", out.trim());
        }
      } catch (e) {
        const out = execSync('python --version').toString();
        if (out.includes('Python 3')) {
          pythonPath = 'python';
          console.log("[Python Core] System 'python' found:", out.trim());
        }
      }
    } catch (e) {
      console.error('[Python Core] No system Python found either.');
    }
  }


  if (pythonPath && fs.existsSync(pythonPath) && process.platform !== 'win32') {
    try {
      fs.chmodSync(pythonPath, 0o755);
    } catch (e) {
      console.warn(
        `[Python Core] Failed to chmod python binary: ${e.message}. Attempting to run anyway.`
      );
    }
  }

  pythonDetails = { pythonPath, binDir };
  console.log(
    `[Python Core] Final Resolution: binary=${pythonPath}, scriptDir=${binDir}`
  );
  return pythonDetails;
}

function spawnPython(args, options = {}) {
  const { pythonPath, binDir } = getPythonDetails();
  const env = { ...process.env, ...options.env };
  if (binDir) {
    const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
    env[pathKey] = `${binDir}${path.delimiter}${env[pathKey] || ''}`;
  }

  env['PYTHONUNBUFFERED'] = '1';
  return spawn(pythonPath, args, { ...options, env });
}

module.exports = {
  getPythonDetails,
  spawnPython,
};
