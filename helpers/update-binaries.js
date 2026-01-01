const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const PORTABLE_ROOT = path.join(__dirname, '..', 'pyvenv');
function getPythonPath() {
  if (process.platform === 'win32') {
    return {
      exe: path.join(PORTABLE_ROOT, 'python-win-x64', 'python.exe'),
      binDir: path.join(PORTABLE_ROOT, 'python-win-x64', 'Scripts'),
    };
  } else if (process.platform === 'linux') {
    const gnu = path.join(PORTABLE_ROOT, 'python-linux-gnu', 'bin', 'python3');
    const gnuBin = path.join(PORTABLE_ROOT, 'python-linux-gnu', 'bin');
    if (fs.existsSync(gnu)) return { exe: gnu, binDir: gnuBin };
    return { exe: 'python3', binDir: '' };
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}
function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}
function findFileRecursive(dir, filename) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const found = findFileRecursive(fullPath, filename);
      if (found) return found;
    } else if (file.toLowerCase() === filename.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}
function moveBinary(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.size === destStat.size) {
        console.log(`   ✔ Verified copy. Deleting source: ${src}`);
        fs.unlinkSync(src);
      } else {
        console.warn(`   ⚠️ Copy size mismatch. Keeping source.`);
      }
    }
  } catch (e) {
    console.error(`   ❌ Failed to move binary: ${e.message}`);
  }
}
async function main() {
  try {
    console.log('=========================================');
    console.log('   🔄 UPDATING & CONSOLIDATING BINARIES');
    console.log('=========================================');
    const { exe, binDir } = getPythonPath();
    if (!fs.existsSync(exe)) {
      console.warn(
        `Portable Python executable not found at: ${exe}. Skipping update.`
      );
      return;
    }
    const targetName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const probeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const ffmpegDest = path.join(binDir, targetName);
    const ffprobeDest = path.join(binDir, probeName);
    if (fs.existsSync(ffmpegDest) && fs.existsSync(ffprobeDest)) {
      console.log('✅ Binaries already exist. Skipping download.');
      return;
    }
    if (process.platform !== 'win32') {
      await runCommand('chmod', ['+x', exe]);
    }
    console.log('Installing/Updating packages...');
    await runCommand(exe, [
      '-m',
      'pip',
      'install',
      '-U',
      'yt-dlp',
      'static-ffmpeg',
    ]);
    console.log('Hydrating FFmpeg binaries...');
    await runCommand(exe, [
      '-c',
      'import static_ffmpeg; static_ffmpeg.add_paths()',
    ]);
    console.log('Consolidating binaries...');
    const searchRoot = path.dirname(path.dirname(binDir));
    const ffmpegSrc = findFileRecursive(searchRoot, targetName);
    const ffprobeSrc = findFileRecursive(searchRoot, probeName);
    if (ffmpegSrc && path.resolve(ffmpegSrc) !== path.resolve(ffmpegDest)) {
      moveBinary(ffmpegSrc, ffmpegDest);
      if (process.platform !== 'win32') fs.chmodSync(ffmpegDest, 0o755);
    }
    if (ffprobeSrc && path.resolve(ffprobeSrc) !== path.resolve(ffprobeDest)) {
      moveBinary(ffprobeSrc, ffprobeDest);
      if (process.platform !== 'win32') fs.chmodSync(ffprobeDest, 0o755);
    }
    console.log('\n✅ Success! Binaries are ready.');
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}
main();
