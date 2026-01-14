#!/bin/bash

# Tunetalks Build Script
# Script để build Tunetalks Web với custom branding

set -e

echo "🎵 Building Tunetalks Web..."

# Load environment variables
if [ -f .env.tunetalks ]; then
    echo "Loading Tunetalks environment variables..."
    export $(cat .env.tunetalks | xargs)
fi

# Copy config
if [ ! -f config.json ]; then
    echo "Copying Tunetalks config..."
    cp config.tunetalks.json config.json
fi

# Clean previous build
echo "Cleaning previous build..."
yarn clean

# Install dependencies
echo "Installing dependencies..."
yarn install

# Build genfiles
echo "Building genfiles..."
yarn build:genfiles

# Production build
echo "Building production bundle..."
yarn build:bundle

echo "✅ Tunetalks Web build completed!"
echo "📦 Output directory: ./webapp"
echo ""
echo "Next steps:"
echo "1. Test the build: cd webapp && python3 -m http.server 8080"
echo "2. Deploy to production server"
echo "3. Configure web server (nginx/apache) with proper headers"
