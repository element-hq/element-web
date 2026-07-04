#!/usr/bin/env bash
# Build the heic-decode helper for the requested arch(es): build.sh [x64 | arm64 | universal ...].
# No argument → universal (used by the standalone `build:native:heic` script). electron-builder's
# beforeBuild passes the target arch so single-arch packages get a thin binary, not a fat one.
# Requires the Xcode Command Line Tools (clang + macOS SDK). macOS-only.
set -euo pipefail

# macOS-only helper (links Apple's Image I/O). No-op elsewhere so this is safe to call from any
# build host (e.g. electron-builder's beforeBuild runs on every platform).
if [[ "$(uname)" != "Darwin" ]]; then
    echo "heic-decode: skipping build on non-macOS host ($(uname))"
    exit 0
fi

cd "$(dirname "$0")"

# Map electron-builder Arch names to clang -arch flags. No argument (standalone script) → universal.
arch_flags=()
for a in "${@:-universal}"; do
    case "$a" in
        x64) arch_flags+=(-arch x86_64) ;;
        arm64) arch_flags+=(-arch arm64) ;;
        universal) arch_flags+=(-arch arm64 -arch x86_64) ;;
        *) echo "heic-decode: unknown arch '$a', building universal"; arch_flags+=(-arch arm64 -arch x86_64) ;;
    esac
done

clang \
    "${arch_flags[@]}" \
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
