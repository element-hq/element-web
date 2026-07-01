#!/usr/bin/env bash
# Build the universal (arm64 + x86_64) heic-decode helper binary.
# Requires the Xcode Command Line Tools (clang + macOS SDK). macOS-only.
set -euo pipefail

# macOS-only helper (links Apple's Image I/O). No-op elsewhere so this is safe to call from any
# build host (e.g. electron-builder's beforeBuild runs on every platform).
if [[ "$(uname)" != "Darwin" ]]; then
    echo "heic-decode: skipping build on non-macOS host ($(uname))"
    exit 0
fi

cd "$(dirname "$0")"

clang \
    -arch arm64 \
    -arch x86_64 \
    -mmacosx-version-min=11.0 \
    -O2 \
    -fobjc-arc \
    -framework Foundation \
    -framework ImageIO \
    -framework CoreGraphics \
    heic_decode.m \
    -o heic-decode

echo "built heic-decode:"
file heic-decode
