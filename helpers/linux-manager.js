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

// --- Configuration ---
// These are built in Docker because they require specific dependencies or are unstable on some distros (like Fedora)
const DOCKER_TARGETS = ['AppImage', 'deb', 'rpm', 'tar.gz', 'flatpak'];

// These are built on Host because they require systemd/daemons (Snap) or explicit user intent
const HOST_TARGETS = ['snap'];

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
  const hasSnapcraft = checkCommand('snapcraft');

  // 1. Docker Build Phase
  if (hasDocker) {
    console.log(
      `\n${colors.yellow}[1/2] Docker Detected: Building Portable Formats (RPM, Deb, AppImage, Flatpak)...${colors.reset}`
    );

    // Pass targets to docker script via environment variable or args
    // We updated docker-build.sh to accept --target
    const success = run('./docker-build.sh', [
      `--target=${DOCKER_TARGETS.join(',')}`,
    ]);

    if (!success) {
      console.error(`${colors.red}❌ Docker build failed.${colors.reset}`);
      process.exit(1);
    }
  } else {
    console.warn(
      `\n${colors.yellow}⚠️  Docker not found. Attempting to build ALL targets on host machine.${colors.reset}`
    );
    console.warn(
      `${colors.yellow}   (RPM builds might fail on non-RHEL systems)${colors.reset}`
    );
    DOCKER_TARGETS.forEach((t) => HOST_TARGETS.push(t)); // Move everything to host
  }

  // 2. Host Build Phase (Snap)
  if (HOST_TARGETS.includes('snap')) {
    console.log(
      `\n${colors.yellow}[2/2] Checking Snap requirements...${colors.reset}`
    );

    if (hasSnapcraft) {
      console.log(
        `${colors.green}✔ Snapcraft found. Building Snap on Host...${colors.reset}`
      );

      // Ensure host env is ready first
      run('npm', ['run', 'env:update']);

      const success = run('node', [
        'helpers/builder.js',
        '--linux',
        '--target=snap',
      ]);
      if (!success) {
        console.error(`${colors.red}❌ Snap build failed.${colors.reset}`);
        // Don't exit, maybe Docker build succeeded
      }
    } else {
      console.log(
        `${colors.gray}✖ Snapcraft not installed. Skipping Snap build.${colors.reset}`
      );
      console.log(
        `${colors.gray}   (Install via: sudo snap install snapcraft --classic)${colors.reset}`
      );
    }
  }

  console.log(
    `\n${colors.green}✨ All build processes finished.${colors.reset}`
  );
  console.log(`   Check 'release/linux/' for artifacts.`);
}

main();
