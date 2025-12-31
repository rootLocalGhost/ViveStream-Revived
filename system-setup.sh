#!/bin/bash

# ==============================================================================
#  🐧 Linux Build Environment Preparation Script
#  Supports: GNU-based Linux (Fedora, Debian/Ubuntu, Arch, OpenSUSE)
#  Installs dependencies for Linux builds (.rpm, .deb, etc.) AND 
#  Windows cross-compilation (Wine, Mono, MinGW).
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

if [ "$EUID" -ne 0 ]; then 
  error "Please run as root (sudo ./setup.sh)"
fi

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)
echo -e "Detected Distribution: ${GREEN}$DISTRO${NC}"

install_fedora() {
    log "Installing Fedora Build Essentials..."
    dnf check-update || true
    dnf group install -y development-tools c-development
    dnf install -y GraphicsMagick libicns-utils rpm-build rpmdevtools dpkg fakeroot fuse fuse-libs libarchive flatpak flatpak-builder elfutils libsecret-devel libglvnd-devel mesa-libGL-devel
    
    log "Installing Windows Cross-Compilation Tools (Wine + MinGW)..."
    dnf install -y wine wine-mono mingw32-gcc mingw32-binutils mingw32-winpthreads glibc-devel.i686 libgcc.i686 wine.i686 glibc.i686

    log "Setting up Snapcraft (Optional)..."
    dnf install -y snapd
    ln -s /var/lib/snapd/snap /snap || true
    systemctl enable --now snapd.socket
}

install_debian() {
    log "Installing Debian/Ubuntu Build Essentials..."
    apt-get update
    apt-get install -y build-essential graphicsmagick rpm dpkg-dev fakeroot libfuse2 libarchive-tools flatpak flatpak-builder libsecret-1-dev libgl1-mesa-dev
    
    log "Installing Windows Cross-Compilation Tools..."
    dpkg --add-architecture i386
    apt-get update
    apt-get install -y wine64 wine32 mingw-w64

    log "Setting up Snapcraft (Optional)..."
    apt-get install -y snapd
}

install_arch() {
    log "Installing Arch Linux Build Essentials..."
    pacman -Sy --noconfirm
    pacman -S --noconfirm base-devel graphicsmagick rpm-tools dpkg fakeroot fuse2 libarchive flatpak libsecret mesa
    
    log "Installing Windows Cross-Compilation Tools..."
    pacman -S --noconfirm wine wine-mono mingw-w64-gcc
}

install_opensuse() {
    log "Installing OpenSUSE Build Essentials..."
    zypper refresh
    zypper install -y -t pattern devel_basis
    zypper install -y GraphicsMagick rpm-build dpkg fakeroot libarchive13 flatpak flatpak-builder libsecret-devel Mesa-libGL-devel
    
    log "Installing Windows Cross-Compilation Tools..."
    zypper install -y wine wine-mono mingw32-cross-gcc mingw32-libgcc_s_sjlj1
}

case "$DISTRO" in
    fedora|rhel|centos) install_fedora ;;
    ubuntu|debian|linuxmint|pop) install_debian ;;
    arch|manjaro) install_arch ;;
    opensuse*|suse) install_opensuse ;;
    *) 
        warn "Unknown distro. Defaulting to apt-get (Debian/Ubuntu)..."
        install_debian 
        ;;
esac

log "Configuring Flatpak Runtimes..."
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install -y flathub org.freedesktop.Platform//24.08
flatpak install -y flathub org.freedesktop.Sdk//24.08
success "Flatpak runtimes configured."

log "Initializing Wine configuration (headless)..."
if [ -n "$SUDO_USER" ]; then
    sudo -u "$SUDO_USER" winecfg /v > /dev/null 2>&1 || true
else
    winecfg /v > /dev/null 2>&1 || true
fi

log "Applying DLL fixes for Windows MSI generation..."

DLL_SOURCE_DIR=""
if [ -n "$SUDO_USER" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    WINE_DEST_DIR="$USER_HOME/.wine/drive_c/windows/syswow64"
else
    WINE_DEST_DIR="$HOME/.wine/drive_c/windows/syswow64"
fi

if [ "$DISTRO" == "fedora" ] || [ "$DISTRO" == "rhel" ]; then
    DLL_SOURCE_DIR="/usr/i686-w64-mingw32/sys-root/mingw/bin"
elif [ "$DISTRO" == "ubuntu" ] || [ "$DISTRO" == "debian" ]; then
    DLL_SOURCE_DIR=$(find /usr -name "libgcc_s_dw2-1.dll" 2>/dev/null | head -n 1 | xargs dirname)
fi

copy_dll() {
    local dll="$1"
    local src="$DLL_SOURCE_DIR/$dll"
    
    if [ ! -f "$src" ]; then
        src=$(find /usr -name "$dll" 2>/dev/null | head -n 1)
    fi

    if [ -f "$src" ]; then
        if [ ! -d "$WINE_DEST_DIR" ]; then mkdir -p "$WINE_DEST_DIR"; fi
        cp "$src" "$WINE_DEST_DIR/"
        success "Copied $dll to Wine."
    else
        warn "Could not find $dll. Windows builds might fail."
    fi
}

copy_dll "libgcc_s_dw2-1.dll"
copy_dll "libwinpthread-1.dll"

if grep -q "fs.inotify.max_user_watches" /etc/sysctl.conf; then
    log "File watchers already configured."
else
    echo "fs.inotify.max_user_watches=524288" >> /etc/sysctl.conf
    sysctl -p > /dev/null
    success "Increased file watcher limit."
fi

if command -v docker &> /dev/null; then
    success "Docker is installed."
else
    warn "Docker is NOT installed. Recommended for RPM/Flatpak builds."
    echo "Run: curl -fsSL https://get.docker.com | sh"
fi

echo "=========================================================="
echo -e "   ${GREEN}Preparation Complete!${NC}"
echo "=========================================================="