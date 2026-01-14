#!/bin/bash

# Tunetalks Assets Deployment Script
# This script copies all custom assets to their appropriate locations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../custom-assets/tunetalks"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo "🎵 Deploying Tunetalks Assets..."
echo "================================"

# Function to copy file if it exists
copy_if_exists() {
    if [ -f "$1" ]; then
        cp "$1" "$2"
        echo "✓ Copied: $(basename $1)"
    else
        echo "⚠ Missing: $(basename $1)"
    fi
}

# Create necessary directories
mkdir -p "$PROJECT_ROOT/res/vector-icons"
mkdir -p "$PROJECT_ROOT/res/img/backgrounds"
mkdir -p "$PROJECT_ROOT/res/themes/tunetalks/img/logos"

# Copy logo files
echo ""
echo "Copying logos..."
copy_if_exists "$ASSETS_DIR/logos/tunetalks-logo.svg" "$PROJECT_ROOT/res/img/"
copy_if_exists "$ASSETS_DIR/logos/tunetalks-logo-white.svg" "$PROJECT_ROOT/res/img/"
copy_if_exists "$ASSETS_DIR/logos/tunetalks-icon.svg" "$PROJECT_ROOT/res/img/"

# Copy app icons
echo ""
echo "Copying app icons..."
for size in 24 120 144 152 180 192 512; do
    copy_if_exists "$ASSETS_DIR/icons/${size}.png" "$PROJECT_ROOT/res/vector-icons/"
done

# Copy favicon
echo ""
echo "Copying favicon..."
copy_if_exists "$ASSETS_DIR/logos/favicon/favicon.ico" "$PROJECT_ROOT/res/vector-icons/"
copy_if_exists "$ASSETS_DIR/logos/favicon/favicon-16x16.png" "$PROJECT_ROOT/res/vector-icons/"
copy_if_exists "$ASSETS_DIR/logos/favicon/favicon-32x32.png" "$PROJECT_ROOT/res/vector-icons/"
copy_if_exists "$ASSETS_DIR/logos/favicon/apple-touch-icon.png" "$PROJECT_ROOT/res/vector-icons/"

# Copy background images
echo ""
echo "Copying backgrounds..."
if [ -d "$ASSETS_DIR/backgrounds" ]; then
    copy_if_exists "$ASSETS_DIR/backgrounds/welcome-bg.jpg" "$PROJECT_ROOT/res/img/backgrounds/"
    copy_if_exists "$ASSETS_DIR/backgrounds/auth-bg.jpg" "$PROJECT_ROOT/res/img/backgrounds/"
    copy_if_exists "$ASSETS_DIR/backgrounds/home-bg.jpg" "$PROJECT_ROOT/res/img/backgrounds/"
fi

# Copy social media assets to theme folder
echo ""
echo "Copying social media assets..."
if [ -d "$ASSETS_DIR/social" ]; then
    copy_if_exists "$ASSETS_DIR/social/opengraph.png" "$PROJECT_ROOT/res/themes/tunetalks/img/logos/"
    copy_if_exists "$ASSETS_DIR/social/twitter-card.png" "$PROJECT_ROOT/res/themes/tunetalks/img/logos/"
fi

echo ""
echo "================================"
echo "✅ Asset deployment completed!"
echo ""
echo "Next steps:"
echo "1. Review copied files in res/ directories"
echo "2. Update config.tunetalks.json with asset URLs"
echo "3. Run: yarn build"
echo ""
