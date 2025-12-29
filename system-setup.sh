#!/bin/bash

# ==============================================================================
#  🐧 Universal Build Environment Preparation Script (Linux)
#  Supports: Fedora, Ubuntu/Debian, Arch, OpenSUSE
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------

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

# Check for root
if [ "$EUID" -ne 0 ]; then 
  error "Please run as root (sudo ./setup.sh)"
fi

ask_yes_no() {
    local prompt="$1"
    local default="$2"
    local reply

    if [ "$default" = "Y" ]; then
        prompt="$prompt [Y/n]"
    else
        prompt="$prompt [y/N]"
    fi

    echo -ne "$prompt: "
    read -r reply
    
    if [ -z "$reply" ]; then
        reply=$default
    fi

    case "$reply" in
        Y*|y*) return 0 ;;
        *) return 1 ;;
    esac
}

detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

# ------------------------------------------------------------------------------
# Distro Selection
# ------------------------------------------------------------------------------

DISTRO=$(detect_distro)
echo -e "Detected Distribution: ${GREEN}$DISTRO${NC}"

echo "Select your distribution family:"
echo "1) Fedora / RHEL (Recommended)"
echo "2) Ubuntu / Debian / Mint"
echo "3) Arch Linux / Manjaro"
echo "4) OpenSUSE"
echo -n "Enter choice [1-4] (default based on detection): "
read -r USER_DISTRO_CHOICE

if [ -z "$USER_DISTRO_CHOICE" ]; then
    case "$DISTRO" in
        fedora|rhel|centos) CHOICE=1 ;;
        ubuntu|debian|linuxmint|pop) CHOICE=2 ;;
        arch|manjaro) CHOICE=3 ;;
        opensuse*|suse) CHOICE=4 ;;
        *) CHOICE=1 ;;
    esac
else
    CHOICE=$USER_DISTRO_CHOICE
fi

# ------------------------------------------------------------------------------
# Package Installation Logic
# ------------------------------------------------------------------------------

install_fedora() {
    log "Running Fedora preparation steps..."
    dnf check-update || true

    log "Installing Build Essentials..."
    dnf group install -y development-tools c-development
    
    # Graphics & RPM Tools
    dnf install -y GraphicsMagick libicns-utils rpm-build rpmdevtools
    
    # Debian packing support
    dnf install -y dpkg fakeroot
    
    # AppImage Support
    dnf install -y fuse fuse-libs libarchive
    
    # Flatpak Support
    dnf install -y flatpak flatpak-builder elfutils
    
    # System Libraries (Electron requirements)
    dnf install -y libsecret-devel libglvnd-devel mesa-libGL-devel

    # Snapcraft on Fedora
    log "Setting up Snapcraft..."
    dnf install -y snapd
    ln -s /var/lib/snapd/snap /snap || true
    systemctl enable --now snapd.socket
    # Wait loop for snapd to be ready
    log "Waiting for snapd to initialize..."
    sleep 5
    snap install snapcraft --classic || warn "Snapcraft installation failed (snapd might be waking up). Run 'sudo snap install snapcraft --classic' manually later."

    # --- Windows Cross-Compile Setup ---
    log "Setting up Windows Cross-Compilation Environment (Wine + MinGW)..."
    
    # 1. Install Wine & Mono
    dnf install -y wine wine-mono

    # 2. Install 32-bit Architecture Support (Required for Wine)
    dnf install -y glibc-devel.i686 libgcc.i686 wine.i686 glibc.i686

    # 3. Install MinGW Dependencies (For compiling native Windows modules)
    dnf install -y mingw32-gcc mingw32-binutils mingw32-winpthreads
}

install_debian() {
    log "Running Debian/Ubuntu preparation steps..."
    apt-get update

    log "Installing Build Essentials..."
    apt-get install -y build-essential graphicsmagick rpm dpkg-dev fakeroot libfuse2 libarchive-tools flatpak flatpak-builder libsecret-1-dev libgl1-mesa-dev

    log "Setting up Snapcraft..."
    apt-get install -y snapd
    snap install snapcraft --classic || true

    # --- Windows Cross-Compile Setup ---
    log "Setting up Windows Cross-Compilation Environment..."
    
    # Enable 32-bit architecture
    dpkg --add-architecture i386
    apt-get update

    # Install Wine and MinGW
    apt-get install -y wine64 wine32 mingw-w64
}

install_arch() {
    log "Running Arch Linux preparation steps..."
    pacman -Sy --noconfirm

    log "Installing Build Essentials..."
    pacman -S --noconfirm base-devel graphicsmagick rpm-tools dpkg fakeroot fuse2 libarchive flatpak libsecret mesa

    # Snapcraft requires AUR on Arch, skipping auto-install to avoid helper complexity
    warn "Snapcraft on Arch usually requires AUR (yay/paru). Skipping automatic install."

    # --- Windows Cross-Compile Setup ---
    log "Setting up Windows Cross-Compilation Environment..."
    pacman -S --noconfirm wine wine-mono mingw-w64-gcc
}

install_opensuse() {
    log "Running OpenSUSE preparation steps..."
    zypper refresh

    log "Installing Build Essentials..."
    zypper install -y -t pattern devel_basis
    zypper install -y GraphicsMagick rpm-build dpkg fakeroot libarchive13 flatpak flatpak-builder libsecret-devel Mesa-libGL-devel

    log "Setting up Snapcraft..."
    zypper install -y snapd
    systemctl enable --now snapd
    ln -s /var/lib/snapd/snap /snap || true
    sleep 5
    snap install snapcraft --classic || true

    # --- Windows Cross-Compile Setup ---
    log "Setting up Windows Cross-Compilation Environment..."
    zypper install -y wine wine-mono mingw32-cross-gcc mingw32-libgcc_s_sjlj1
}

# Execute selected installation
case "$CHOICE" in
    1) install_fedora ;;
    2) install_debian ;;
    3) install_arch ;;
    4) install_opensuse ;;
    *) error "Invalid selection." ;;
esac

# ------------------------------------------------------------------------------
# Docker Installation Logic
# ------------------------------------------------------------------------------

if command -v docker &> /dev/null; then
    success "Docker is already installed."
else
    warn "Docker is NOT installed."
    if ask_yes_no "Do you want to install Docker now? (Recommended for consistent builds)" "Y"; then
        log "Installing Docker..."
        
        # Simple convience script from get.docker.com
        curl -fsSL https://get.docker.com | sh
        
        log "Starting Docker service..."
        systemctl start docker
        systemctl enable docker
        
        # Add current user to docker group (assumes script run via sudo, so get SUDO_USER)
        if [ -n "$SUDO_USER" ]; then
            usermod -aG docker "$SUDO_USER"
            log "Added user '$SUDO_USER' to docker group."
        fi
        success "Docker installed."
    else
        log "Skipping Docker installation."
    fi
fi

# ------------------------------------------------------------------------------
# Flatpak Runtime Configuration (Critical for Build)
# ------------------------------------------------------------------------------

log "Configuring Flatpak Runtimes (Version 24.08)..."
# Add Flathub if missing
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Install Sdk and Platform matching builder.js config
flatpak install -y flathub org.freedesktop.Platform//24.08
flatpak install -y flathub org.freedesktop.Sdk//24.08
success "Flatpak runtimes configured."

# ------------------------------------------------------------------------------
# Wine Configuration & DLL Fixes (Universal Logic)
# ------------------------------------------------------------------------------

log "Initializing Wine configuration (this may take a moment)..."
# Run winecfg non-interactively to create prefix if missing
if [ -n "$SUDO_USER" ]; then
    sudo -u "$SUDO_USER" winecfg /v > /dev/null 2>&1 || true
else
    winecfg /v > /dev/null 2>&1 || true
fi

log "Applying DLL fixes for Windows MSI generation..."

# Determine source paths based on distro
DLL_SOURCE_DIR=""
WINE_DEST_DIR=""

if [ -n "$SUDO_USER" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    WINE_DEST_DIR="$USER_HOME/.wine/drive_c/windows/syswow64"
else
    WINE_DEST_DIR="$HOME/.wine/drive_c/windows/syswow64"
fi

if [ "$CHOICE" -eq 1 ]; then
    # Fedora Specific Paths (From Prompt)
    DLL_SOURCE_DIR="/usr/i686-w64-mingw32/sys-root/mingw/bin"
elif [ "$CHOICE" -eq 2 ]; then
    # Debian/Ubuntu often puts these in /usr/lib/gcc/i686-w64-mingw32/<ver> or /usr/i686-w64-mingw32/lib
    # We try to find them dynamically
    DLL_SOURCE_DIR=$(find /usr -name "libgcc_s_dw2-1.dll" 2>/dev/null | head -n 1 | xargs dirname)
fi

# Copy Function
copy_dll_if_exists() {
    local dll_name="$1"
    local src="$DLL_SOURCE_DIR/$dll_name"
    local dest="$WINE_DEST_DIR/"

    # Fallback search if direct path fails
    if [ ! -f "$src" ]; then
        src=$(find /usr -name "$dll_name" 2>/dev/null | head -n 1)
    fi

    if [ -n "$src" ] && [ -f "$src" ]; then
        if [ ! -d "$dest" ]; then
            log "Creating Wine SysWOW64 directory..."
            mkdir -p "$dest"
        fi
        cp "$src" "$dest"
        success "Copied $dll_name to Wine."
    else
        warn "Could not find $dll_name. MSI builds might fail (Linker error)."
    fi
}

copy_dll_if_exists "libgcc_s_dw2-1.dll"
copy_dll_if_exists "libwinpthread-1.dll"

# ------------------------------------------------------------------------------
# Clean Electron Cache
# ------------------------------------------------------------------------------

log "Cleaning Electron Builder Cache..."
if [ -n "$SUDO_USER" ]; then
    rm -rf "$USER_HOME/.cache/electron-builder/wix"
else
    rm -rf "$HOME/.cache/electron-builder/wix"
fi
success "Cache cleaned."

# ------------------------------------------------------------------------------
# Final Configuration Checks
# ------------------------------------------------------------------------------

log "Checking file limits..."
# Increase file watchers for large projects
if grep -q "fs.inotify.max_user_watches" /etc/sysctl.conf; then
    log "File watchers already configured."
else
    echo "fs.inotify.max_user_watches=524288" >> /etc/sysctl.conf
    sysctl -p > /dev/null
    success "Increased file watcher limit."
fi

echo "=========================================================="
echo -e "   ${GREEN}Preparation Complete!${NC}"
echo "=========================================================="
echo "Notes:"
echo "1. If you installed Snapd/Docker, you may need to logout and login again."
echo "2. To build Linux packages, run: npm run build:linux"
echo "3. To build Windows MSI/EXE on Linux, run: npm run build:win"
echo "=========================================================="