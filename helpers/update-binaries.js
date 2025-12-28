const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORTABLE_ROOT = path.join(__dirname, '..', 'python-portable');

function getPythonPath() {
  if (process.platform === 'win32') {
    return {
      exe: path.join(PORTABLE_ROOT, 'python-win-x64', 'python.exe'),
      binDir: path.join(PORTABLE_ROOT, 'python-win-x64', 'Scripts'),
    };
  } else if (process.platform === 'darwin') {
    return {
      exe: path.join(PORTABLE_ROOT, 'python-mac-darwin', 'bin', 'python3'),
      binDir: path.join(PORTABLE_ROOT, 'python-mac-darwin', 'bin'),
    };
  } else if (process.platform === 'linux') {
    const gnu = path.join(PORTABLE_ROOT, 'python-linux-gnu', 'bin', 'python3');
    const gnuBin = path.join(PORTABLE_ROOT, 'python-linux-gnu', 'bin');
    if (fs.existsSync(gnu)) return { exe: gnu, binDir: gnuBin };

    const musl = path.join(
      PORTABLE_ROOT,
      'python-linux-musl',
      'bin',
      'python3'
    );
    const muslBin = path.join(PORTABLE_ROOT, 'python-linux-musl', 'bin');
    return { exe: musl, binDir: muslBin };
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
    // 1. Copy
    fs.copyFileSync(src, dest);

    // 2. Verify Size
    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);

      if (srcStat.size === destStat.size) {
        // 3. Delete Source (Move)
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
      throw new Error(`Python executable not found at: ${exe}`);
    }

    // 0. CHECK IF BINARIES EXIST
    const targetName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const probeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const ffmpegDest = path.join(binDir, targetName);
    const ffprobeDest = path.join(binDir, probeName);

    if (fs.existsSync(ffmpegDest) && fs.existsSync(ffprobeDest)) {
      console.log(
        '✅ Binaries already exist in bin folder. Skipping download.'
      );
      // We still update pip packages to ensure python libs are fresh, but skip heavy binary download
      // unless you want to force update everything.
      // For build stability, we return here.
      return;
    }

    if (process.platform !== 'win32') {
      await runCommand('chmod', ['+x', exe]);
    }

    // 1. Update Packages
    console.log('Installing/Updating packages...');
    await runCommand(exe, [
      '-m',
      'pip',
      'install',
      '-U',
      'yt-dlp',
      'static-ffmpeg',
    ]);

    // 2. Trigger Download
    console.log('Hydrating FFmpeg binaries (downloading if missing)...');
    // Using simple string argument for spawn to avoid shell issues
    await runCommand(exe, [
      '-c',
      'import static_ffmpeg; static_ffmpeg.add_paths()',
    ]);

    // 3. Consolidate (Move) FFmpeg to binDir
    console.log('Consolidating binaries...');

    // Find where static_ffmpeg hid them (usually in site-packages)
    const searchRoot = path.dirname(path.dirname(binDir));

    const ffmpegSrc = findFileRecursive(searchRoot, targetName);
    const ffprobeSrc = findFileRecursive(searchRoot, probeName);

    if (ffmpegSrc) {
      if (path.resolve(ffmpegSrc) !== path.resolve(ffmpegDest)) {
        console.log(
          `Moving FFmpeg:\n   From: ${ffmpegSrc}\n   To:   ${ffmpegDest}`
        );
        moveBinary(ffmpegSrc, ffmpegDest);
        if (process.platform !== 'win32') fs.chmodSync(ffmpegDest, 0o755);
      }
    } else {
      console.warn(
        '   ⚠️  Could not locate FFmpeg binary downloaded by static_ffmpeg.'
      );
    }

    if (ffprobeSrc) {
      if (path.resolve(ffprobeSrc) !== path.resolve(ffprobeDest)) {
        console.log(
          `Moving FFprobe:\n   From: ${ffprobeSrc}\n   To:   ${ffprobeDest}`
        );
        moveBinary(ffprobeSrc, ffprobeDest);
        if (process.platform !== 'win32') fs.chmodSync(ffprobeDest, 0o755);
      }
    }

    console.log('\n✅ Success! Binaries are ready and consolidated.');
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
