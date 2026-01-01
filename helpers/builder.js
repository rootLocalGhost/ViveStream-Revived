const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const rimrafPkg = require('rimraf');
const rimraf = rimrafPkg.rimraf || rimrafPkg;
const rimrafSync = rimrafPkg.rimrafSync || rimrafPkg.sync;
process.env.NODE_NO_WARNINGS = '1';
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};
const IS_DEBUG = process.argv.includes('--debug');
function toPosix(p) {
  return p.split(path.sep).join(path.posix.sep);
}
function log(step, message) {
  if (IS_DEBUG) {
    console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
  }
}
function logAlways(message) {
  console.log(message);
}
function parsePublish() {
  return process.argv.includes('--publish');
}
function parseTargets() {
  const args = process.argv.slice(2);
  let targets = [];
  args.forEach((arg) => {
    if (arg.startsWith('--target=')) {
      const val = arg.split('=')[1];
      if (val === 'all') {
        targets = ['AppImage', 'deb', 'rpm', 'snap', 'tar.gz'];
      } else {
        targets = val.split(',').map((t) => t.trim());
      }
    }
  });
  return targets;
}
function getPlatformConfig() {
  const targets = parseTargets();
  const args = process.argv;
  let platform = process.platform;
  if (args.includes('--win')) platform = 'win32';
  else if (args.includes('--linux')) platform = 'linux';
  switch (platform) {
    case 'win32':
      return {
        id: 'win',
        name: 'Windows',
        pythonSource: 'pyvenv/python-win-x64',
        cliFlag: '--win',
        target: targets.length > 0 ? targets : ['nsis', 'msi'],
        excludePatterns: ['**/bin/linux/**'],
      };
    case 'linux':
      const gnuPath = 'pyvenv/python-linux-gnu';
      return {
        id: 'linux',
        name: 'Linux',
        pythonSource: gnuPath,
        cliFlag: '--linux',
        target:
          targets.length > 0
            ? targets
            : ['AppImage', 'deb', 'rpm', 'snap', 'tar.gz'],
        excludePatterns: ['**/bin/win32/**'],
      };
    default:
      throw new Error(
        `Unsupported platform: ${platform}. Only Windows and Linux are supported.`
      );
  }
}
async function executeCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const cmd =
      process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
    const fullCommand = [cmd, ...args]
      .map((a) => (a.includes(' ') ? `"${a}"` : a))
      .join(' ');
    const env = { ...process.env, NODE_NO_WARNINGS: 1 };
    const stdioMode = IS_DEBUG ? 'inherit' : 'ignore';
    const child = spawn(fullCommand, {
      cwd: cwd,
      shell: true,
      env: env,
      stdio: stdioMode,
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}
async function packSourceCode(rootDir, releaseDir) {
  logAlways(`${colors.cyan}📦 Packaging Source Code...${colors.reset}`);
  const version = require(path.join(rootDir, 'package.json')).version;
  const zipName = `ViveStream-Source-v${version}.zip`;
  const outputPath = path.join(releaseDir, zipName);
  if (!fs.existsSync(releaseDir)) fs.mkdirSync(releaseDir, { recursive: true });
  try {
    const exclude = [
      'node_modules/*',
      'pyvenv/*',
      '.git/*',
      'release/*',
      '*.log',
      'helpers/large-file-manager.js',
    ]
      .map((x) => `-x "${x}"`)
      .join(' ');
    await executeCommand(`zip -r "${outputPath}" . ${exclude}`, [], rootDir);
    logAlways(`   ${colors.green}✔ Created ${zipName}${colors.reset}`);
  } catch (e) {
    console.error(
      `${colors.red}Failed to zip source: ${e.message}${colors.reset}`
    );
  }
}
function cleanSpecificTargets(releaseDir, targets) {
  if (!fs.existsSync(releaseDir)) return;
  const extMap = {
    nsis: ['.exe'],
    msi: ['.msi'],
    deb: ['.deb'],
    rpm: ['.rpm'],
    AppImage: ['.AppImage'],
    snap: ['.snap'],
    'tar.gz': ['.tar.gz'],
    zip: ['.zip'],
  };
  const files = fs.readdirSync(releaseDir);
  let deletedCount = 0;
  files.forEach((file) => {
    let shouldDelete = false;
    targets.forEach((target) => {
      const exts = extMap[target] || [];
      exts.forEach((ext) => {
        if (file.endsWith(ext)) shouldDelete = true;
      });
    });
    if (shouldDelete) {
      try {
        fs.unlinkSync(path.join(releaseDir, file));
        deletedCount++;
      } catch (e) {}
    }
  });
  if (deletedCount > 0 && IS_DEBUG) {
    console.log(
      `   ${colors.yellow}✔ Deleted ${deletedCount} old artifact(s).${colors.reset}`
    );
  }
}
function cleanUnwantedFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath);
  const itemsToRemove = [
    'builder-debug.yml',
    'latest-linux.yml',
    'latest.yml',
    '.icon-set',
    'linux-unpacked',
    'win-unpacked',
  ];
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    try {
      if (itemsToRemove.includes(file)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        return;
      }
      if (file.endsWith('.blockmap')) {
        fs.unlinkSync(fullPath);
        return;
      }
    } catch (e) {
      if (IS_DEBUG) console.error(`Cleanup warning: ${e.message}`);
    }
  });
}
async function runBuild() {
  const rootDir = path.join(__dirname, '..');
  const releaseDir = path.join(rootDir, 'release');
  const tempConfigPath = path.join(rootDir, 'temp-build-config.json');
  const shouldPublish = parsePublish();
  const targets = parseTargets();
  const args = process.argv;
  if (targets.includes('source')) {
    await packSourceCode(rootDir, releaseDir);
    if (targets.length === 1) return;
  }
  const platformConfig = getPlatformConfig();
  platformConfig.target = platformConfig.target.filter((t) => t !== 'source');
  if (platformConfig.target.length === 0) return;
  logAlways(`${colors.cyan}=== ViveStream Custom Builder ===${colors.reset}`);
  logAlways(
    `   Target: ${colors.yellow}${platformConfig.target.join(', ')}${colors.reset} | Debug: ${IS_DEBUG ? 'ON' : 'OFF'}`
  );
  log('1/6', 'Preparing Environment');
  await executeCommand(
    'node',
    ['helpers/large-file-manager.js', 'join'],
    rootDir
  );
  await executeCommand('node', ['helpers/cleanup.js'], rootDir);
  log('2/6', 'Selective Cleanup');
  if (fs.existsSync(releaseDir)) {
    cleanSpecificTargets(releaseDir, platformConfig.target);
  }
  log('3/6', 'Rebuilding Native Dependencies');
  await executeCommand(
    'npx',
    ['electron-builder', 'install-app-deps'],
    rootDir
  );
  log('4/6', 'Packaging');
  const extraResources = [];
  if (platformConfig.pythonSource) {
    const pPath = path.join(rootDir, platformConfig.pythonSource);
    if (fs.existsSync(pPath)) {
      if (process.platform !== 'win32') {
        try {
          const binDir = path.join(pPath, 'bin');
          if (fs.existsSync(binDir))
            fs.readdirSync(binDir).forEach((f) =>
              fs.chmodSync(path.join(binDir, f), '755')
            );
        } catch (e) {}
      }
      extraResources.push({
        from: toPosix(platformConfig.pythonSource),
        to: toPosix(platformConfig.pythonSource),
        filter: platformConfig.excludePatterns
          ? ['**/*', ...platformConfig.excludePatterns.map((p) => `!${p}`)]
          : ['**/*'],
      });
    }
  }
  const buildConfig = {
    appId: 'com.vivestream.revived.app',
    productName: 'ViveStream Revived',
    copyright: 'Copyright © 2025 Md Siam Mia',
    directories: { output: 'release', buildResources: 'assets' },
    files: [
      'src/**/*',
      'package.json',
      'assets/**/*',
      '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
      '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
      '!**/node_modules/*.d.ts',
      '!**/node_modules/.bin',
      '!vendor/**/*',
      '!pyvenv/**/*',
      '!**/.git/**',
      '!**/.github/**',
      '!**/helpers/**',
    ],
    extraResources: extraResources,
    compression: 'store',
    asar: true,
    win: {
      target: platformConfig.target,
      icon: toPosix(path.join(rootDir, 'assets', 'icon.ico')),
    },
    nsis: {
      oneClick: false,
      perMachine: true,
      runAfterFinish: true,
      shortcutName: 'ViveStream',
    },
    linux: {
      target: platformConfig.target,
      icon: toPosix(path.join(rootDir, 'assets')),
      category: 'Video',
      executableName: 'vivestream-revived',
      maintainer: 'Md Siam Mia <vivestream.revived@example.com>',
      synopsis: 'Offline media player and downloader',
      description: 'Your personal, offline, and stylish media sanctuary.',
      artifactName: '${productName}-${version}-${arch}.${ext}',
    },
    rpm: { fpm: ['--rpm-compression', 'bzip2'] },
  };
  fs.writeFileSync(tempConfigPath, JSON.stringify(buildConfig, null, 2));
  const builderArgs = [
    'electron-builder',
    '--config',
    'temp-build-config.json',
    platformConfig.cliFlag,
  ];
  if (shouldPublish) builderArgs.push('--publish', 'always');
  else builderArgs.push('--publish', 'never');
  try {
    await executeCommand('npx', builderArgs, rootDir);
  } catch (e) {
    if (!IS_DEBUG && fs.existsSync(tempConfigPath))
      fs.unlinkSync(tempConfigPath);
    throw e;
  }
  if (!IS_DEBUG && fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
  log('\n5/6', 'Cleaning Temp Files');
  if (!IS_DEBUG) cleanUnwantedFiles(releaseDir);
  logAlways(`${colors.green}   Build Successful!${colors.reset}`);
}
runBuild().catch((err) => {
  console.error(`\n${colors.red}[FATAL] ${err.message}${colors.reset}`);
  process.exit(1);
});
