set -e
IMAGE_NAME="vivestream-builder"
DOCKERFILE_PATH="./Dockerfile.vivestream-build"
BUILD_TARGETS="rpm,flatpak"
for arg in "$@"; do
  case $arg in
    --target=*)
      BUILD_TARGETS="${arg#*=}"
      shift
      ;;
  esac
done
echo "   🎯 Build Targets: $BUILD_TARGETS"
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  echo "========================================="
  echo "   📝 Generating Light OS Dockerfile..."
  echo "========================================="
  cat <<EOF > "$DOCKERFILE_PATH"
FROM node:20-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
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
    elfutils \
    libsecret-1-dev \
    libgl1-mesa-dev \
    curl \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
WORKDIR /app
CMD ["/bin/bash"]
EOF
  echo "   🐳 Building Docker Image: $IMAGE_NAME"
  docker build --network=host -t "$IMAGE_NAME" -f "$DOCKERFILE_PATH" .
else
  echo "   ✅ Docker image '$IMAGE_NAME' found. Skipping build."
fi
echo "========================================="
echo "   🚀 Running Build in Docker"
echo "========================================="
HOST_UID=$(id -u)
HOST_GID=$(id -g)
NPM_CACHE_DIR="$HOME/.npm"
if [ ! -d "$NPM_CACHE_DIR" ]; then
  mkdir -p "$NPM_CACHE_DIR"
fi
docker run --rm \
  --network=host \
  -v "$(pwd)":/app:z \
  -v "$NPM_CACHE_DIR":/root/.npm \
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
    # Prefer offline if node_modules exists
    if [ -d 'node_modules' ]; then
      echo '   ⚡ node_modules detected.'
      npm install --prefer-offline
    else
      echo '   📦 Running clean install...'
      npm ci --prefer-offline
    fi
    echo '→ Preparing environment...'
    npm run files:join
    echo '→ Hydrating Python environment...'
    npm run env:update
    echo '→ Building Artifacts (Targets: $BUILD_TARGETS)...'
    node helpers/builder.js --linux --target=$BUILD_TARGETS --verbose
    echo '→ Fixing permissions...'
    chown -R \$HOST_UID:\$HOST_GID release || true
    if [ -d 'python-portable' ]; then
      chown -R \$HOST_UID:\$HOST_GID python-portable || true
    fi
    echo '✅ Build Complete! Artifacts are in release/'
  "
echo "========================================="
echo "   🎉 Done!"
echo "========================================="