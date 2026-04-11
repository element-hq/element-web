#!/usr/bin/env bash
# extract-tor.sh — Extracts Tor binaries from the official Tor Expert Bundle
# Intended for developers embedding Tor in their application.
# Usage: bash scripts/extract-tor.sh

set -euo pipefail

TOR_VERSION="15.0.7"
BASE_URL="https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}"
OUT_DIR="$(cd "$(dirname "$0")/../3rd-party/tor" && pwd)"

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

extract_linux_x64() {
  local dest="${OUT_DIR}/linux-x64"
  mkdir -p "$dest"

  echo "→ Downloading tor-expert-bundle linux-x64..."
  curl -sSL "${BASE_URL}/tor-expert-bundle-linux-x86_64-${TOR_VERSION}.tar.gz" \
    -o "${TMP}/expert-linux.tar.gz"

  echo "→ Extracting..."
  tar -xzf "${TMP}/expert-linux.tar.gz" -C "$TMP"

  cp "$TMP/tor/tor" "$dest/tor"
  chmod +x "$dest/tor"

  find "$TMP/tor" -maxdepth 1 -name "*.so*" -type f | while read -r lib; do
    cp "$lib" "$dest/"
    echo "  ✓ $(basename "$lib")"
  done

  result=$(LD_LIBRARY_PATH="$dest" "$dest/tor" --version 2>&1 | head -1)
  echo "✓ linux-x64 OK — $result"
}

# macOS x64 — Tor Expert Bundle for macOS (directory name: mac-x64)
extract_mac_x64() {
  local dest="${OUT_DIR}/mac-x64"
  mkdir -p "$dest"

  echo "→ Downloading tor-expert-bundle mac-x64..."
  curl -sSL "${BASE_URL}/tor-expert-bundle-macos-x86_64-${TOR_VERSION}.tar.gz" \
    -o "${TMP}/expert-mac-x64.tar.gz"

  echo "→ Extracting..."
  tar -xzf "${TMP}/expert-mac-x64.tar.gz" -C "$TMP/mac-x64" --strip-components=0 2>/dev/null \
    || tar -xzf "${TMP}/expert-mac-x64.tar.gz" -C "$TMP"

  cp "$TMP/tor/tor" "$dest/tor"
  chmod +x "$dest/tor"

  echo "✓ mac-x64 binary extracted (run on macOS to verify)"
}

# macOS arm64 — Tor Expert Bundle for macOS Apple Silicon (directory name: mac-arm64)
extract_mac_arm64() {
  local dest="${OUT_DIR}/mac-arm64"
  mkdir -p "$dest"

  echo "→ Downloading tor-expert-bundle mac-arm64..."
  curl -sSL "${BASE_URL}/tor-expert-bundle-macos-aarch64-${TOR_VERSION}.tar.gz" \
    -o "${TMP}/expert-mac-arm64.tar.gz"

  echo "→ Extracting..."
  tar -xzf "${TMP}/expert-mac-arm64.tar.gz" -C "$TMP"

  cp "$TMP/tor/tor" "$dest/tor"
  chmod +x "$dest/tor"

  echo "✓ mac-arm64 binary extracted (run on macOS to verify)"
}

# Windows x64 — Tor Expert Bundle for Windows (directory name: win-x64)
extract_win_x64() {
  local dest="${OUT_DIR}/win-x64"
  mkdir -p "$dest"

  echo "→ Downloading tor-expert-bundle win-x64..."
  curl -sSL "${BASE_URL}/tor-expert-bundle-windows-x86_64-${TOR_VERSION}.tar.gz" \
    -o "${TMP}/expert-win-x64.tar.gz"

  echo "→ Extracting..."
  tar -xzf "${TMP}/expert-win-x64.tar.gz" -C "$TMP"

  cp "$TMP/tor/tor.exe" "$dest/tor.exe"

  echo "✓ win-x64 binary extracted (run on Windows to verify)"
}

# Always extract linux-x64 (CI runs on Linux).
# Other targets are extracted only when explicitly requested via TARGET env var.
case "${TARGET:-linux-x64}" in
  linux-x64)  extract_linux_x64 ;;
  mac-x64)    extract_mac_x64 ;;
  mac-arm64)  extract_mac_arm64 ;;
  win-x64)    extract_win_x64 ;;
  all)
    extract_linux_x64
    extract_mac_x64
    extract_mac_arm64
    extract_win_x64
    ;;
  *)
    echo "Unknown TARGET '${TARGET}'. Valid values: linux-x64, mac-x64, mac-arm64, win-x64, all" >&2
    exit 1
    ;;
esac

echo ""
echo "Extracted files:"
find "${OUT_DIR}" -type f