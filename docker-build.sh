set -e
IMAGE_NAME="vivestream-builder"
DOCKERFILE="Dockerfile"
BUILD_TARGETS="rpm"
DEBUG_FLAG=""
for arg in "$@"; do
  case $arg in
    --target=*)
      BUILD_TARGETS="${arg
      ;;
    --debug)
      DEBUG_FLAG="--debug"
      ;;
  esac
done
if [ -n "$DEBUG_FLAG" ]; then
    echo "   🎯 Build Targets: $BUILD_TARGETS"
    echo "   🐞 Debug Mode: ON"
fi
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  if [ -n "$DEBUG_FLAG" ]; then echo "   🐳 Building Docker Image..."; fi
  if [ ! -f "$DOCKERFILE" ]; then
    echo "❌ Error: $DOCKERFILE not found."
    exit 1
  fi
  QUIET_BUILD="-q"
  if [ -n "$DEBUG_FLAG" ]; then QUIET_BUILD=""; fi
  docker build $QUIET_BUILD --network=host -t "$IMAGE_NAME" -f "$DOCKERFILE" .
else
  if [ -n "$DEBUG_FLAG" ]; then echo "   ✅ Docker image found."; fi
fi
if [ -n "$DEBUG_FLAG" ]; then echo "   🚀 Running Build in Docker"; fi
HOST_UID=$(id -u)
HOST_GID=$(id -g)
NPM_CACHE_DIR="$HOME/.npm"
mkdir -p "$NPM_CACHE_DIR"
docker run --rm \
  --network=host \
  --privileged \
  --shm-size=2g \
  -v "$(pwd)":/source:z \
  -v "$NPM_CACHE_DIR":/npm_cache \
  -v vivestream_electron_cache:/electron_cache \
  -e HOST_UID="$HOST_UID" \
  -e HOST_GID="$HOST_GID" \
  -e DEBUG_FLAG="$DEBUG_FLAG" \
  "$IMAGE_NAME" \
  /bin/bash -c "
    set -e
    # 1. Create a non-root user matching host UID/GID
    groupadd -g \$HOST_GID buildergroup || groupmod -n buildergroup \$(getent group \$HOST_GID | cut -d: -f1)
    useradd -u \$HOST_UID -g \$HOST_GID -m -s /bin/bash builder
    # 2. Fix FUSE permissions
    if [ -e /dev/fuse ]; then
      chmod 666 /dev/fuse
    fi
    # 3. Prepare Workspace
    if [ -n \"\$DEBUG_FLAG\" ]; then echo '→ Preparing workspace...'; fi
    mkdir -p /tmp/workspace
    cp -r /source/. /tmp/workspace/
    # 4. Fix Ownership
    chown -R builder:buildergroup /tmp/workspace
    chown -R builder:buildergroup /npm_cache
    chown -R builder:buildergroup /electron_cache
    # 5. Switch to User and Build
    if [ -n \"\$DEBUG_FLAG\" ]; then echo '→ Switching to non-root user for build...'; fi
    su builder -c '
      set -e
      cd /tmp/workspace
      # Setup User Environment
      export npm_config_cache=/npm_cache
      export ELECTRON_CACHE=/electron_cache
      export ELECTRON_BUILDER_CACHE=/electron_cache
      export XDG_DATA_HOME=/home/builder/.local/share
      export XDG_CACHE_HOME=/home/builder/.cache
      export XDG_RUNTIME_DIR=/tmp/runtime-builder
      mkdir -p \$XDG_RUNTIME_DIR
      chmod 700 \$XDG_RUNTIME_DIR
      eval \$(dbus-launch --sh-syntax)
      if [ -n \"\$DEBUG_FLAG\" ]; then echo \"→ Configuring NPM...\"; fi
      npm config set registry https://registry.npmjs.org/
      npm config set loglevel error
      if [ -n \"\$DEBUG_FLAG\" ]; then echo \"→ Installing Dependencies...\"; fi
      npm ci --prefer-offline --silent
      if [ -n \"\$DEBUG_FLAG\" ]; then echo \"→ Preparing Environment...\"; fi
      npm run files:join
      npm run env:update
      if [ -n \"\$DEBUG_FLAG\" ]; then echo \"→ Building Artifacts (Targets: $BUILD_TARGETS)...\"; fi
      node helpers/builder.js --linux --target=$BUILD_TARGETS \$DEBUG_FLAG
      kill \$DBUS_SESSION_BUS_PID
    '
    # 6. Extract Artifacts
    if [ -n \"\$DEBUG_FLAG\" ]; then echo '→ Moving artifacts back to host...'; fi
    mkdir -p /source/release
    cp -r /tmp/workspace/release/* /source/release/ || true
    chown -R \$HOST_UID:\$HOST_GID /source/release
    echo '✅ Build Complete!'
  "