const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const rimrafPkg = require('rimraf');
const rimraf = rimrafPkg.rimraf || rimrafPkg;
const rimrafSync = rimrafPkg.rimrafSync || rimrafPkg.sync;

const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

const TARGET_DIR = path.join(__dirname, '..', 'python-portable');
const CHUNK_EXT = '.chunk';
const CHUNK_SIZE = 1024 * 1024 * 90;

function getAllFiles(dirPath, arrayOfFiles) {
  if (!fs.existsSync(dirPath)) return [];

  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function splitFile(filePath) {
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  if (stats.size <= CHUNK_SIZE) return;
  if (fileName.includes(CHUNK_EXT)) return;

  console.log(
    `✂️  Splitting: ${fileName} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
  );

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(CHUNK_SIZE);
  let bytesRead = 0;
  let part = 1;

  try {
    while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
      const chunkName = `${filePath}${CHUNK_EXT}${String(part).padStart(
        3,
        '0'
      )}`;
      const dataToWrite =
        bytesRead < CHUNK_SIZE ? buffer.slice(0, bytesRead) : buffer;
      fs.writeFileSync(chunkName, dataToWrite);
      console.log(`   📄 Created: ${path.basename(chunkName)}`);
      part++;
    }
  } finally {
    fs.closeSync(fd);
  }

  fs.unlinkSync(filePath);
  console.log(`   🗑️  Removed original: ${fileName}`);
}

function joinFile(firstChunkPath) {
  const originalPath = firstChunkPath.slice(0, -9);
  const baseName = path.basename(originalPath);

  if (fs.existsSync(originalPath)) {
    console.log(`   ⏭️  Skipping ${baseName} (already exists)`);
    return;
  }

  console.log(`🧵 Joining: ${baseName}`);

  const dir = path.dirname(firstChunkPath);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(path.basename(originalPath) + CHUNK_EXT))
    .sort();

  const writeStream = fs.createWriteStream(originalPath);

  for (const chunkFile of files) {
    const chunkPath = path.join(dir, chunkFile);
    const data = fs.readFileSync(chunkPath);
    writeStream.write(data);
    fs.unlinkSync(chunkPath);
  }

  writeStream.end();

  if (
    originalPath.includes('/bin/') ||
    originalPath.endsWith('.so') ||
    originalPath.includes('.so.') ||
    originalPath.endsWith('.dylib') ||
    originalPath.endsWith('.exe') ||
    originalPath.includes('ffmpeg') ||
    originalPath.includes('ffprobe')
  ) {
    try {
      fs.chmodSync(originalPath, 0o755);
    } catch (e) {}
  }

  console.log(`   ✅ Restored.`);
}

// ---------------------------------------------------------
//  CLONE LOGIC (Ensure .git is removed)
// ---------------------------------------------------------
if (!fs.existsSync(TARGET_DIR)) {
  console.log(
    `${colors.yellow}Target directory not found: ${TARGET_DIR}${colors.reset}`
  );
  console.log(`${colors.green}Auto-cloning python-portable...${colors.reset}`);

  try {
    execSync(
      'git clone https://github.com/Md-Siam-Mia-Main/python-portable.git --depth 1',
      {
        cwd: path.dirname(TARGET_DIR),
        stdio: 'inherit',
      }
    );
    console.log(`${colors.green}Clone successful.${colors.reset}`);

    // Remove .git folder immediately to keep it clean
    const gitDir = path.join(TARGET_DIR, '.git');
    if (fs.existsSync(gitDir)) {
      console.log(`${colors.gray}Cleaning up .git directory...${colors.reset}`);
      try {
        if (rimrafSync) rimrafSync(gitDir);
        else rimraf.sync(gitDir);
      } catch (e) {
        // Fallback
        fs.rmSync(gitDir, { recursive: true, force: true });
      }
    }
  } catch (e) {
    console.error(
      `${colors.red}Failed to clone python-portable: ${e.message}${colors.reset}`
    );
    console.warn(
      `${colors.yellow}Please manually run: git clone https://github.com/Md-Siam-Mia-Main/python-portable.git ${colors.reset}`
    );
    process.exit(1);
  }
}

const action = process.argv[2];

if (action === 'split') {
  console.log(`🔍 Scanning ${TARGET_DIR} for large files (>90MB)...`);
  const files = getAllFiles(TARGET_DIR);
  let splitCount = 0;

  files.forEach((f) => {
    const stats = fs.statSync(f);
    if (stats.size > CHUNK_SIZE && !f.includes(CHUNK_EXT)) {
      splitFile(f);
      splitCount++;
    }
  });

  if (splitCount === 0) console.log('No large files found needing split.');
  else console.log('✨ Splitting complete.');
} else if (action === 'join') {
  console.log(`🔍 Scanning ${TARGET_DIR} for chunked files...`);
  const files = getAllFiles(TARGET_DIR);

  const startChunks = files.filter((f) => f.endsWith(`${CHUNK_EXT}001`));

  if (startChunks.length === 0) {
    console.log('No chunked files found.');
  } else {
    console.log(`Found ${startChunks.length} file(s) to join.`);
    startChunks.forEach((f) => joinFile(f));
  }
  console.log('✨ Reassembly complete.');
} else {
  // If no args, just exit successfully (used for clone-only check)
}
