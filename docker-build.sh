#!/bin/bash
set -e

# Define image name
IMAGE_NAME="vivestream-builder"

# Check if the image already exists locally
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  echo "========================================="
  echo "   🐳 Building Docker Image: $IMAGE_NAME"
  echo "========================================="
  docker build -t "$IMAGE_NAME" .
else
  echo "========================================="
  echo "   ⚡ Docker Image Found. Skipping Build."
  echo "========================================="
fi

echo "========================================="
echo "   🚀 Running Build in Docker"
echo "========================================="

HOST_UID=$(id -u)
HOST_GID=$(id -g)

docker run --rm \
  -v "$(pwd)":/app:z \
  -v /app/node_modules \
  -v vivestream_npm_cache:/root/.npm \
  -v vivestream_pip_cache:/root/.cache/pip \
  --device /dev/fuse \
  --cap-add SYS_ADMIN \
  --security-opt apparmor:unconfined \
  --security-opt label=disable \
  -e HOST_UID="$HOST_UID" \
  -e HOST_GID="$HOST_GID" \
  "$IMAGE_NAME" \
  /bin/bash -c "
    set -e

    echo '→ Installing dependencies...'
    # npm ci will now use the cached /root/.npm folder
    npm ci --prefer-offline

    echo '→ Preparing environment...'
    npm run files:join

    echo '→ Hydrating Python environment...'
    # update-binaries.js will now skip if binaries exist
    npm run env:update

    echo '→ Building Linux Artifacts...'
    node helpers/builder.js --linux --target=AppImage,deb,rpm,tar.gz --verbose

    echo '→ Fixing permissions...'
    chown -R \$HOST_UID:\$HOST_GID release/linux || true
    if [ -d 'python-portable' ]; then
      chown -R \$HOST_UID:\$HOST_GID python-portable || true
    fi

    echo '✅ Build Complete! Artifacts are in release/linux/'
  "

echo "========================================="
echo "   🎉 Done!"
echo "========================================="