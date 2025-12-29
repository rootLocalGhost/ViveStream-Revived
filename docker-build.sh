#!/bin/bash
set -e

# ==============================================================================
# Configuration
# ==============================================================================
IMAGE_NAME="vivestream-builder"
DOCKERFILE_PATH="./Dockerfile.vivestream-build"

# ==============================================================================
# 1. Generate Dynamic Dockerfile
#    (Replicates setup.sh Debian logic inside the container)
# ==============================================================================
echo "========================================="
echo "   📝 Generating Dockerfile..."
echo "========================================="

cat <<EOF > "$DOCKERFILE_PATH"
# Use a standard Debian-based Node image (matches Debian logic in setup.sh)
FROM node:20-bullseye

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------------------------
# 1. Install System Build Essentials & Tools
# ------------------------------------------------------------------------------
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

# ------------------------------------------------------------------------------
# 2. Windows Cross-Compilation Setup (Wine + MinGW)
# ------------------------------------------------------------------------------
# Enable 32-bit architecture for Wine
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    wine \
    wine32 \
    wine64 \
    libwine \
    mingw-w64 \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# 3. Flatpak Configuration
# ------------------------------------------------------------------------------
RUN flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# ------------------------------------------------------------------------------
# 4. Wine Configuration & DLL Fixes
#    (Pre-populates the Wine prefix to avoid runtime setup)
# ------------------------------------------------------------------------------
# Set Wine prefix location
ENV WINEPREFIX=/root/.wine

# Initialize Wine (headless)
RUN winecfg /v > /dev/null 2>&1 || true

# Copy Critical DLLs for MSI generation (MinGW -> Wine SysWOW64)
# We search for them because paths vary by Debian version
RUN mkdir -p \$WINEPREFIX/drive_c/windows/syswow64 && \
    find /usr -name "libgcc_s_dw2-1.dll" -exec cp {} \$WINEPREFIX/drive_c/windows/syswow64/ \; && \
    find /usr -name "libwinpthread-1.dll" -exec cp {} \$WINEPREFIX/drive_c/windows/syswow64/ \;

# ------------------------------------------------------------------------------
# 5. Environment Settings
# ------------------------------------------------------------------------------
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

# We always build to ensure setup.sh logic is up to date (Docker caches layers so it's fast)
docker build -t "$IMAGE_NAME" -f "$DOCKERFILE_PATH" .

# ==============================================================================
# 3. Run Build in Docker
# ==============================================================================
echo "========================================="
echo "   🚀 Running Build in Docker"
echo "========================================="

HOST_UID=$(id -u)
HOST_GID=$(id -g)

# Define cache volumes to speed up repeat builds
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

    echo '→ Building Artifacts (Linux & Windows)...'
    # NOTE: Added --win to leverage the new Wine setup, remove if Linux-only desired
    node helpers/builder.js --linux --win --target=AppImage,deb,rpm,tar.gz,nsis --verbose

    echo '→ Fixing permissions...'
    # We fix ownership because Docker runs as root internally
    chown -R \$HOST_UID:\$HOST_GID release || true
    if [ -d 'python-portable' ]; then
      chown -R \$HOST_UID:\$HOST_GID python-portable || true
    fi

    echo '✅ Build Complete! Artifacts are in release/'
  "

echo "========================================="
echo "   🎉 Done!"
echo "========================================="