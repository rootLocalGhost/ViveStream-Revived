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
function toPosix(p) {
  return p.split(path.sep).join(path.posix.sep);
}
function log(step, message) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}
function parseVerbose() {
  return process.argv.includes('--verbose') || process.argv.includes('--debug');
}
function parseDebug() {
  return process.argv.includes('--debug');
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
        targets = ['AppImage', 'deb', 'rpm', 'snap', 'flatpak', 'tar.gz'];
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
        pythonSource: 'python-portable/python-win-x64',
        cliFlag: '--win',
        target: targets.length > 0 ? targets : ['nsis', 'msi'],
        excludePatterns: ['**/bin/linux/**'],
      };
    case 'linux':
      const gnuPath = 'python-portable/python-linux-gnu';
      return {
        id: 'linux',
        name: 'Linux',
        pythonSource: gnuPath,
        cliFlag: '--linux',
        target:
          targets.length > 0
            ? targets
            : ['AppImage', 'deb', 'rpm', 'snap', 'flatpak', 'tar.gz'],
        excludePatterns: ['**/bin/win32/**'],
      };
    default:
      throw new Error(
        `Unsupported platform or Mac/Darwin is no longer supported: ${platform}`
      );
  }
}
async function executeCommand(command, args, cwd) {
  const verbose = parseVerbose();
  return new Promise((resolve, reject) => {
    const cmd =
      process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
    const fullCommand = [cmd, ...args]
      .map((a) => (a.includes(' ') ? `"${a}"` : a))
      .join(' ');
    const env = { ...process.env, NODE_NO_WARNINGS: 1 };
    if (verbose && command === 'npx' && args.includes('electron-builder')) {
      env.DEBUG = 'electron-builder';
    }
    const child = spawn(fullCommand, {
      cwd: cwd,
      shell: true,
      env: env,
    });
    let stdoutLog = '';
    let stderrLog = '';
    let hasLoggedPackaging = false;
    let hasLoggedInstaller = false;
    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdoutLog += str;
      if (verbose) console.log(str.trimEnd());
      const lowerStr = str.toLowerCase();
      if (lowerStr.includes('downloading') && !lowerStr.includes('part')) {
        console.log(
          `   ${colors.gray}↓  Downloading resources...${colors.reset}`
        );
      } else if (lowerStr.includes('packaging') && !hasLoggedPackaging) {
        console.log(
          `   ${colors.green}→  Packaging application...${colors.reset}`
        );
        hasLoggedPackaging = true;
      } else if (
        (lowerStr.includes('msi') ||
          lowerStr.includes('nsis') ||
          lowerStr.includes('snap') ||
          lowerStr.includes('deb') ||
          lowerStr.includes('rpm') ||
          lowerStr.includes('flatpak') ||
          lowerStr.includes('tar')) &&
        !hasLoggedInstaller &&
        lowerStr.includes('building')
      ) {
        console.log(
          `   ${colors.green}→  Building Installer/Package...${colors.reset}`
        );
        hasLoggedInstaller = true;
      }
    });
    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderrLog += str;
      if (
        verbose ||
        str.toLowerCase().includes('error') ||
        str.toLowerCase().includes('fatal')
      ) {
        console.error(`${colors.red}${str.trimEnd()}${colors.reset}`);
      }
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        if (!verbose) {
          console.error(
            `\n${colors.red}--- BUILD FAILURE LOGS ---${colors.reset}`
          );
          console.error(stderrLog.slice(-10000));
          if (stderrLog.length < 100) console.error(stdoutLog.slice(-5000));
          console.error(
            `${colors.red}--------------------------${colors.reset}\n`
          );
        }
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}
function cleanUnwantedFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    if (stat.isDirectory()) {
      if (file.includes('unpacked')) {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(
            `   ${colors.yellow}× Deleted Unpacked Dir: ${file}${colors.reset}`
          );
        } catch (e) {}
      } else if (
        file === 'linux' ||
        file === 'win' ||
        file === 'win-unpacked' ||
        file === 'linux-unpacked'
      ) {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } catch (e) {}
      }
    } else {
      if (file.endsWith('.yml') || file.endsWith('.blockmap')) {
        try {
          fs.unlinkSync(fullPath);
          console.log(
            `   ${colors.yellow}× Deleted Unwanted File: ${file}${colors.reset}`
          );
        } catch (e) {}
      }
    }
  }
}
async function runBuild() {
  const platformConfig = getPlatformConfig();
  const rootDir = path.join(__dirname, '..');
  const releaseDir = path.join(rootDir, 'release');
  const tempConfigPath = path.join(rootDir, 'temp-build-config.json');
  const verbose = parseVerbose();
  const debug = parseDebug();
  const shouldPublish = parsePublish();
  console.log(
    colors.cyan +
      '==================================================' +
      colors.reset
  );
  console.log(
    colors.cyan +
      '            ViveStream Custom Builder             ' +
      colors.reset
  );
  console.log(
    colors.cyan +
      '==================================================' +
      colors.reset
  );
  console.log(
    `   Target Platform: ${colors.yellow}${platformConfig.name}${colors.reset}`
  );
  console.log(
    `   Bundling Python: ${colors.yellow}${platformConfig.pythonSource}${colors.reset}`
  );
  console.log(`   Isolation:       ${colors.green}Enabled${colors.reset}`);
  console.log(
    `   Publishing:      ${shouldPublish ? colors.green + 'Yes' : colors.gray + 'No'}${colors.reset}`
  );
  log('1/6', 'Preparing Environment');
  console.log(`   ${colors.gray}→  Joining split files...${colors.reset}`);
  await executeCommand(
    'node',
    ['helpers/large-file-manager.js', 'join'],
    rootDir
  );
  console.log(
    `   ${colors.gray}→  Cleaning Python environment...${colors.reset}`
  );
  await executeCommand('node', ['helpers/cleanup.js'], rootDir);
  console.log(`   ${colors.green}✔ Environment Ready.${colors.reset}`);
  log('\n2/6', 'Cleanup Build Dirs');
  if (!debug && fs.existsSync(releaseDir)) {
    try {
      if (rimrafSync) rimrafSync(releaseDir);
      else await rimraf(releaseDir);
    } catch (e) {}
  }
  console.log(`   ${colors.green}✔ Cleaned.${colors.reset}`);
  log('\n3/6', 'Rebuilding Native Dependencies');
  await executeCommand(
    'npx',
    ['electron-builder', 'install-app-deps'],
    rootDir
  );
  log('\n4/6', 'Packaging');
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
      const filterPatterns = ['**/*'];
      if (platformConfig.excludePatterns) {
        platformConfig.excludePatterns.forEach((p) =>
          filterPatterns.push(`!${p}`)
        );
      }
      extraResources.push({
        from: toPosix(platformConfig.pythonSource),
        to: toPosix(platformConfig.pythonSource),
        filter: filterPatterns,
      });
    } else {
      console.warn(
        `${colors.red}WARNING: Portable Python not found at ${platformConfig.pythonSource}${colors.reset}`
      );
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
      '!python-portable/**/*',
      '!**/.git/**',
      '!**/.github/**',
      '!**/helpers/**',
    ],
    extraResources: extraResources,
    compression: 'store',
    asar: true,
    win: {
      target:
        platformConfig.id === 'win' ? platformConfig.target : ['nsis', 'msi'],
      icon: toPosix(path.join(rootDir, 'assets', 'icon.ico')),
      legalTrademarks: 'ViveStream',
    },
    nsis: {
      oneClick: false,
      perMachine: true,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false,
      include: 'build/installer.nsh',
      runAfterFinish: true,
      shortcutName: 'ViveStream',
    },
    msi: {
      oneClick: false,
      perMachine: true,
      runAfterFinish: true,
      shortcutName: 'ViveStream',
    },
    linux: {
      target:
        platformConfig.id === 'linux' ? platformConfig.target : ['AppImage'],
      icon: toPosix(path.join(rootDir, 'assets')),
      category: 'Video',
      executableName: 'vivestream-revived',
      maintainer: 'Md Siam Mia <vivestream.revived@example.com>',
      synopsis: 'Offline media player and downloader',
      description: 'Your personal, offline, and stylish media sanctuary.',
    },
    deb: {
      compression: 'gz',
    },
    rpm: {
      fpm: [
        '--rpm-rpmbuild-define',
        '_build_id_links none',
        '--rpm-rpmbuild-define',
        '_enable_debug_packages 0',
        '--rpm-compression',
        'bzip2',
        '--name',
        'vivestream-revived',
      ],
    },
  };
  fs.writeFileSync(tempConfigPath, JSON.stringify(buildConfig, null, 2));
  const builderArgs = [
    'electron-builder',
    '--config',
    'temp-build-config.json',
    platformConfig.cliFlag,
  ];
  if (shouldPublish) {
    builderArgs.push('--publish', 'always');
  } else {
    builderArgs.push('--publish', 'never');
  }
  try {
    await executeCommand('npx', builderArgs, rootDir);
  } catch (e) {
    if (!debug && fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
    throw e;
  }
  if (!debug && fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
  log('\n5/6', 'Cleaning & Organizing');
  if (!debug) {
    cleanUnwantedFiles(releaseDir);
  }
  log('\n6/6', 'Complete');
  console.log(`${colors.green}   Build Successful!${colors.reset}`);
}
runBuild().catch((err) => {
  console.error(`\n${colors.red}[FATAL] ${err.message}${colors.reset}`);
  process.exit(1);
});