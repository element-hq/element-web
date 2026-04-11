#!/usr/bin/env bash
# install.sh — element-tor installer for Linux and macOS
# Usage: curl -sSL https://raw.githubusercontent.com/Gvte-Kali/element-tor/feature/tor-integration/install.sh | bash

set -euo pipefail

REPO="Gvte-Kali/element-tor"
GITHUB_API="https://api.github.com/repos/${REPO}/releases/latest"
APP_NAME="element-tor"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[element-tor]${NC} $*"; }
success() { echo -e "${GREEN}[element-tor]${NC} $*"; }
warn()    { echo -e "${YELLOW}[element-tor]${NC} $*"; }
error()   { echo -e "${RED}[element-tor]${NC} $*"; exit 1; }

# ── Detect platform ──────────────────────────────────────────────────────────

detect_platform() {
    local os arch
    os="$(uname -s)"
    arch="$(uname -m)"

    case "$os" in
        Linux)
            case "$arch" in
                x86_64)  echo "linux-x64" ;;
                aarch64) echo "linux-arm64" ;;
                *) error "Unsupported Linux architecture: $arch" ;;
            esac
            ;;
        Darwin)
            case "$arch" in
                x86_64)  echo "mac-x64" ;;
                arm64)   echo "mac-arm64" ;;
                *) error "Unsupported macOS architecture: $arch" ;;
            esac
            ;;
        *) error "Unsupported OS: $os. Use install.ps1 on Windows." ;;
    esac
}

# ── Detect package manager (Linux only) ──────────────────────────────────────

detect_pkg_manager() {
    if command -v apt-get &>/dev/null; then echo "apt"
    elif command -v dnf &>/dev/null;     then echo "dnf"
    elif command -v pacman &>/dev/null;  then echo "pacman"
    elif command -v zypper &>/dev/null;  then echo "zypper"
    elif command -v apk &>/dev/null;     then echo "apk"
    else echo "unknown"
    fi
}

# ── Install dependencies ──────────────────────────────────────────────────────

install_deps_linux() {
    local pkg_manager
    pkg_manager="$(detect_pkg_manager)"
    info "Detected package manager: $pkg_manager"

    case "$pkg_manager" in
        apt)    sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libuuid1 libsecret-1-0 ;;
        dnf)    sudo dnf install -y gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-atk libuuid libsecret ;;
        pacman) sudo pacman -S --needed --noconfirm gtk3 libnotify nss libxss libxtst xdg-utils at-spi2-atk util-linux-libs libsecret ;;
        zypper) sudo zypper install -y libgtk-3-0 libnotify4 mozilla-nss libXss1 libXtst6 xdg-utils libatspi0 libuuid1 libsecret-1-0 ;;
        apk)    sudo apk add --no-cache gtk+3.0 libnotify nss libxscrnsaver libxtst xdg-utils at-spi2-atk libsecret ;;
        *)      warn "Unknown package manager — skipping dependency install. If the app fails to launch, install GTK3 and NSS manually." ;;
    esac
}

# ── Get latest release URL ────────────────────────────────────────────────────

get_release_url() {
    local platform="$1"
    local url

    info "Fetching latest release info..."

    # Map platform to expected asset filename pattern
    case "$platform" in
        linux-x64)  pattern="linux.*x86_64\\.AppImage" ;;
        linux-arm64) pattern="linux.*aarch64\\.AppImage" ;;
        mac-x64)    pattern="mac.*x64\\.dmg" ;;
        mac-arm64)  pattern="mac.*arm64\\.dmg" ;;
    esac

    url=$(curl -sSL "$GITHUB_API" \
        | grep "browser_download_url" \
        | grep -E "$pattern" \
        | head -1 \
        | cut -d '"' -f 4)

    if [ -z "$url" ]; then
        error "Could not find a release asset for platform: $platform\nCheck https://github.com/${REPO}/releases"
    fi

    echo "$url"
}

# ── Install on Linux ──────────────────────────────────────────────────────────

install_linux() {
    local platform="$1"
    local url
    url="$(get_release_url "$platform")"
    local filename
    filename="$(basename "$url")"
    local dest="$HOME/.local/bin/${APP_NAME}.AppImage"

    info "Downloading $filename..."
    curl -L --progress-bar "$url" -o "$dest"
    chmod +x "$dest"

    # Desktop entry
    local desktop_dir="$HOME/.local/share/applications"
    mkdir -p "$desktop_dir"
    cat > "${desktop_dir}/${APP_NAME}.desktop" << EOF
[Desktop Entry]
Name=Element Tor
Comment=Element with native Tor routing
Exec=${dest} %U
Icon=element
Terminal=false
Type=Application
Categories=Network;InstantMessaging;
MimeType=x-scheme-handler/element;
StartupWMClass=element-tor
EOF

    update-desktop-database "$desktop_dir" 2>/dev/null || true

    success "Installed to $dest"
    success "Launcher added to application menu"
    info "Run with: ${dest}"
}

# ── Install on macOS ──────────────────────────────────────────────────────────

install_macos() {
    local platform="$1"
    local url
    url="$(get_release_url "$platform")"
    local filename
    filename="$(basename "$url")"
    local tmp_dmg
    tmp_dmg="$(mktemp /tmp/element-tor-XXXXXX.dmg)"

    info "Downloading $filename..."
    curl -L --progress-bar "$url" -o "$tmp_dmg"

    info "Mounting disk image..."
    local mount_point
    mount_point="$(hdiutil attach "$tmp_dmg" -nobrowse -quiet | tail -1 | awk '{print $NF}')"

    info "Installing to /Applications..."
    cp -r "${mount_point}/Element Tor.app" /Applications/

    hdiutil detach "$mount_point" -quiet
    rm -f "$tmp_dmg"

    success "Installed to /Applications/Element Tor.app"
    info "Launch from Spotlight or: open '/Applications/Element Tor.app'"
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
    echo ""
    echo "  ███████╗██╗     ███████╗███╗   ███╗███████╗███╗   ██╗████████╗    ████████╗ ██████╗ ██████╗ "
    echo "  ██╔════╝██║     ██╔════╝████╗ ████║██╔════╝████╗  ██║╚══██╔══╝    ╚══██╔══╝██╔═══██╗██╔══██╗"
    echo "  █████╗  ██║     █████╗  ██╔████╔██║█████╗  ██╔██╗ ██║   ██║          ██║   ██║   ██║██████╔╝"
    echo "  ██╔══╝  ██║     ██╔══╝  ██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║          ██║   ██║   ██║██╔══██╗"
    echo "  ███████╗███████╗███████╗██║ ╚═╝ ██║███████╗██║ ╚████║   ██║          ██║   ╚██████╔╝██║  ██║"
    echo "  ╚══════╝╚══════╝╚══════╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝          ╚═╝    ╚═════╝ ╚═╝  ╚═╝"
    echo ""

    local platform
    platform="$(detect_platform)"
    info "Platform detected: $platform"

    case "$platform" in
        linux-*)
            install_deps_linux
            install_linux "$platform"
            ;;
        mac-*)
            install_macos "$platform"
            ;;
    esac

    echo ""
    success "element-tor installation complete!"
    echo ""
}

main "$@"