const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};
const DOCKER_RECOMMENDED = ['rpm', 'flatpak'];
const HOST_RECOMMENDED = ['AppImage', 'deb', 'snap', 'tar.gz'];
function run(command, args = [], options = {}) {
  console.log(`${colors.cyan}> ${command} ${args.join(' ')}${colors.reset}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options,
  });
  return result.status === 0;
}
function checkCommand(cmd) {
  try {
    const result = spawnSync('which', [cmd], { stdio: 'ignore' });
    return result.status === 0;
  } catch (e) {
    return false;
  }
}
function main() {
  console.log(
    `${colors.green}=========================================${colors.reset}`
  );
  console.log(
    `${colors.green}   🐧 ViveStream Linux Smart Builder     ${colors.reset}`
  );
  console.log(
    `${colors.green}=========================================${colors.reset}`
  );
  const hasDocker = checkCommand('docker');
  const dockerTargets = [];
  const hostTargets = [];
  DOCKER_RECOMMENDED.forEach((t) => dockerTargets.push(t));
  HOST_RECOMMENDED.forEach((t) => hostTargets.push(t));
  if (dockerTargets.length > 0) {
    if (hasDocker) {
      console.log(
        `\n${colors.yellow}[1/2] Docker Phase: Building ${dockerTargets.join(', ')}...${colors.reset}`
      );
      const success = run('./docker-build.sh', [
        `--target=${dockerTargets.join(',')}`,
      ]);
      if (!success) {
        console.error(`${colors.red}❌ Docker build failed.${colors.reset}`);
      }
    } else {
      console.warn(
        `\n${colors.yellow}⚠️  Docker not found. Skipping ${dockerTargets.join(', ')}.${colors.reset}`
      );
      console.warn(
        `${colors.yellow}   (Install Docker to build RPM/Flatpak reliably)${colors.reset}`
      );
    }
  }
  if (hostTargets.length > 0) {
    console.log(
      `\n${colors.yellow}[2/2] Host Phase: Building ${hostTargets.join(', ')}...${colors.reset}`
    );
    run('npm', ['run', 'env:update']);
    const success = run('node', [
      'helpers/builder.js',
      '--linux',
      `--target=${hostTargets.join(',')}`,
    ]);
    if (!success) {
      console.error(`${colors.red}❌ Host build failed.${colors.reset}`);
      process.exit(1);
    }
  }
  console.log(
    `\n${colors.green}✨ All build processes finished.${colors.reset}`
  );
  console.log(`   Check 'release/' for artifacts.`);
}
main();