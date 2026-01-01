const { spawnSync } = require('child_process');
const readline = require('readline');
const os = require('os');
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};
const PLATFORM = os.platform();
const HOST_LINUX_TARGETS = ['AppImage', 'deb', 'snap', 'tar.gz'];
const WINDOWS_TARGETS = ['nsis', 'msi', 'source'];
const DOCKER_LINUX_TARGETS = ['rpm'];
const ALL_LINUX_TARGETS = ['AppImage', 'deb', 'rpm', 'snap', 'tar.gz'];
const IS_DEBUG = process.argv.includes('--debug');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function ask(question) {
  return new Promise((resolve) => {
    rl.question(
      `${colors.yellow}${question} [Y/n]: ${colors.reset}`,
      (answer) => {
        resolve(
          answer.toLowerCase() === 'y' ||
            answer.toLowerCase() === 'yes' ||
            answer === ''
        );
      }
    );
  });
}
function runSync(command, args, options = {}) {
  const stdioMode = IS_DEBUG ? 'inherit' : 'ignore';
  if (IS_DEBUG)
    console.log(`${colors.cyan}> ${command} ${args.join(' ')}${colors.reset}`);
  else console.log(`${colors.cyan}> Running ${command}...${colors.reset}`);
  const result = spawnSync(command, args, {
    stdio: stdioMode,
    shell: true,
    ...options,
  });
  return result.status === 0;
}
function checkDocker() {
  const result = spawnSync('docker', ['--version'], {
    stdio: 'ignore',
    shell: true,
  });
  return result.status === 0;
}
function checkDockerImage() {
  const result = spawnSync('docker', ['images', '-q', 'vivestream-builder'], {
    stdio: 'pipe',
    shell: true,
  });
  return result.stdout.toString().trim().length > 0;
}
async function installDocker() {
  if (PLATFORM === 'linux') {
    console.log('Installing Docker via convenience script...');
    return runSync('curl -fsSL https://get.docker.com | sh');
  } else if (PLATFORM === 'win32') {
    console.log('Opening Docker Desktop download page...');
    runSync('start https://www.docker.com/products/docker-desktop');
    console.log('Please install Docker Desktop and restart this script.');
    process.exit(0);
  }
  return false;
}
async function runDockerBuild(targets) {
  const hasDocker = checkDocker();
  if (!hasDocker) {
    console.warn(`${colors.red}❌ Docker not found.${colors.reset}`);
    const install = await ask('Do you want to install Docker now?');
    if (install) {
      const installed = await installDocker();
      if (!installed && PLATFORM === 'linux') {
        console.error('Docker installation failed. Please install manually.');
        return;
      }
    } else {
      console.log('Skipping Docker build.');
      if (PLATFORM === 'win32')
        console.log('Tip: Use Debian WSL to build Linux packages.');
      return;
    }
  }
  const hasImage = checkDockerImage();
  if (!hasImage) {
    const create = await ask(
      'Docker image "vivestream-builder" not found. Build it?'
    );
    if (!create) {
      console.log('Skipping Docker build.');
      return;
    }
  }
  const scriptCmd = PLATFORM === 'win32' ? 'bash' : './docker-build.sh';
  const args = PLATFORM === 'win32' ? ['./docker-build.sh'] : [];
  args.push(`--target=${targets.join(',')}`);
  if (IS_DEBUG) args.push('--debug');
  console.log(`${colors.green}🚀 Starting Docker Build...${colors.reset}`);
  runSync(scriptCmd, args, { stdio: 'inherit' });
}
async function main() {
  console.log(
    `${colors.green}=========================================${colors.reset}`
  );
  console.log(
    `${colors.green}   🚀 ViveStream Smart Build System      ${colors.reset}`
  );
  console.log(
    `${colors.green}=========================================${colors.reset}`
  );
  runSync('npm', ['run', 'env:update']);
  if (PLATFORM === 'linux') {
    console.log(`${colors.cyan}🐧 Linux Host Detected.${colors.reset}`);
    console.log(`Building native targets: ${HOST_LINUX_TARGETS.join(', ')}`);
    const linuxArgs = [
      'helpers/builder.js',
      '--linux',
      `--target=${HOST_LINUX_TARGETS.join(',')}`,
    ];
    if (IS_DEBUG) linuxArgs.push('--debug');
    runSync('node', linuxArgs);
    const buildWin = await ask(
      'Do you want to cross-compile for Windows (exe, msi, source)?'
    );
    if (buildWin) {
      console.log(
        `${colors.cyan}🪟 Starting Windows Cross-Compilation...${colors.reset}`
      );
      const winArgs = [
        'helpers/builder.js',
        '--win',
        `--target=${WINDOWS_TARGETS.join(',')}`,
      ];
      if (IS_DEBUG) winArgs.push('--debug');
      runSync('node', winArgs);
    }
    const buildRpm = await ask(
      'Do you want to build the RPM package in Docker?'
    );
    if (buildRpm) {
      await runDockerBuild(['rpm']);
    }
  } else if (PLATFORM === 'win32') {
    console.log(`${colors.cyan}🪟 Windows Host Detected.${colors.reset}`);
    console.log(`Building native targets: ${WINDOWS_TARGETS.join(', ')}`);
    const winArgs = [
      'helpers/builder.js',
      '--win',
      `--target=${WINDOWS_TARGETS.join(',')}`,
    ];
    if (IS_DEBUG) winArgs.push('--debug');
    runSync('node', winArgs);
    const buildLinux = await ask(
      'Do you want to build Linux packages in Docker?'
    );
    if (buildLinux) {
      await runDockerBuild(ALL_LINUX_TARGETS);
    }
  } else {
    console.error(
      `${colors.red}Unsupported Host Platform: ${PLATFORM}${colors.reset}`
    );
  }
  console.log(`\n${colors.green}✨ All tasks finished.${colors.reset}`);
  rl.close();
}
main();