#!/bin/bash
set -e

IMAGE_NAME="vivestream-builder"
DOCKERFILE_PATH="./Dockerfile.vivestream-build"

BUILD_TARGETS="AppImage,rpm"

for arg in "$@"; do
  case $arg in
    --target=*)
      BUILD_TARGETS="${arg#*=}"
      shift
      ;;
  esac
done

echo "   🎯 Build Targets: $BUILD_TARGETS"
echo "========================================="
echo "   📝 Generating Dockerfile..."
echo "========================================="

cat <<EOF > "$DOCKERFILE_PATH"
# Use a standard Debian-based Node image
FROM node:20-bullseye

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install System Build Essentials & Tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    graphicsmagick \
    rpm \
    dpkg-dev \
    fakeroot \
    libfuse2 \
    libarchive-tools \
    flatpak \
    flatpak-builder \
    libsecret-1-dev \
    libgl1-mesa-dev \
    curl \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 2. Windows Cross-Compilation Setup (Optional but kept for safety)
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    wine \
    wine32 \
    wine64 \
    libwine \
    mingw-w64 \
    && rm -rf /var/lib/apt/lists/*

# 3. Flatpak Configuration
RUN flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# 4. Wine Configuration (Headless)
ENV WINEPREFIX=/root/.wine
RUN winecfg /v > /dev/null 2>&1 || true

# 5. Environment Settings
WORKDIR /app
CMD ["/bin/bash"]
EOF

echo "   ✅ Dockerfile generated at $DOCKERFILE_PATH"

# ==============================================================================
# 2. Build Docker Image
# ==============================================================================
echo "========================================="
echo "   🐳 Building Docker Image: $IMAGE_NAME"
echo "========================================="

docker build -t "$IMAGE_NAME" -f "$DOCKERFILE_PATH" .

echo "========================================="
echo "   🚀 Running Build in Docker"
echo "========================================="

HOST_UID=$(id -u)
HOST_GID=$(id -g)

docker run --rm \
  -v "$(pwd)":/app:z \
  -v vivestream_node_modules:/app/node_modules \
  -v vivestream_npm_cache:/root/.npm \
  -v vivestream_pip_cache:/root/.cache/pip \
  -v vivestream_electron_cache:/root/.cache/electron \
  -v vivestream_electron_builder_cache:/root/.cache/electron-builder \
  --device /dev/fuse \
  --cap-add SYS_ADMIN \
  --security-opt apparmor:unconfined \
  --security-opt label=disable \
  -e HOST_UID="$HOST_UID" \
  -e HOST_GID="$HOST_GID" \
  -e ELECTRON_CACHE="/root/.cache/electron" \
  -e ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
  "$IMAGE_NAME" \
  /bin/bash -c "
    set -e

    echo '→ Configuring NPM...'
    npm config set registry https://registry.npmjs.org/

    echo '→ Checking dependencies...'
    if [ -d 'node_modules' ]; then
      echo '   ⚡ node_modules detected. Syncing updates...'
      npm install --prefer-offline
    else
      echo '   📦 No node_modules found. Running clean install...'
      npm ci --prefer-offline
    fi

    echo '→ Preparing environment...'
    npm run files:join

    echo '→ Hydrating Python environment...'
    npm run env:update

    echo '→ Building Artifacts (Linux)...'
    # ---------------------------------------------------------
    # FIXED: Removed --win and injected dynamic targets
    # ---------------------------------------------------------
    node helpers/builder.js --linux --target=$BUILD_TARGETS --verbose

    echo '→ Fixing permissions...'
    chown -R \$HOST_UID:\$HOST_GID release || true
    if [ -d 'python-portable' ]; then
      chown -R \$HOST_UID:\$HOST_GID python-portable || true
    fi

    echo '✅ Build Complete! Artifacts are in release/linux'
  "

echo "========================================="
echo "   🎉 Done!"
echo "========================================="