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
  echo "→ Downloading tor-expert-bundle linux-x64..."
  curl -sSL "${BASE_URL}/tor-expert-bundle-linux-x86_64-${TOR_VERSION}.tar.gz" \
    -o "${TMP}/expert-linux.tar.gz"

  echo "→ Extracting..."
  tar -xzf "${TMP}/expert-linux.tar.gz" -C "$TMP"

  # Main binary
  cp "$TMP/tor/tor" "${OUT_DIR}/linux-x64/tor"
  chmod +x "${OUT_DIR}/linux-x64/tor"

  # Bundled libs — only from tor/, not debug/
  find "$TMP/tor" -maxdepth 1 -name "*.so*" -type f | while read -r lib; do
    cp "$lib" "${OUT_DIR}/linux-x64/"
    echo "  ✓ $(basename "$lib")"
  done

  # Verify the binary works with bundled libs
  result=$(LD_LIBRARY_PATH="${OUT_DIR}/linux-x64" "${OUT_DIR}/linux-x64/tor" --version 2>&1 | head -1)
  echo "✓ linux-x64 OK — $result"
}

extract_linux_x64

echo ""
echo "Extracted files:"
find "${OUT_DIR}" -type f