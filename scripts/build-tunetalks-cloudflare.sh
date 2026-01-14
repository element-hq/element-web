#!/bin/bash

#
# Tunetalks Build Script for Cloudflare Pages
# 
# This script builds Element Web with Tunetalks branding
# optimized for Cloudflare Pages deployment
#

set -e  # Exit on error

echo "🚀 Building Tunetalks for Cloudflare Pages..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Node version
echo -e "${BLUE}📦 Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Error: Node.js 20.x or higher is required${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
echo ""

# Step 2: Load environment variables
echo -e "${BLUE}📝 Loading environment variables...${NC}"
if [ -f .env.tunetalks ]; then
    source .env.tunetalks
    echo -e "${GREEN}✅ Loaded .env.tunetalks${NC}"
else
    echo -e "${YELLOW}⚠️  .env.tunetalks not found, using defaults${NC}"
fi
echo ""

# Set defaults if not provided
export VERSION="${VERSION:-1.0.0}"
export RIOT_OG_IMAGE_URL="${RIOT_OG_IMAGE_URL:-https://tunetalks.com/images/og-tunetalks.png}"
export CSP_EXTRA_SOURCE="${CSP_EXTRA_SOURCE:-https://tunetalks.com}"

echo "Version: $VERSION"
echo "OG Image: $RIOT_OG_IMAGE_URL"
echo ""

# Step 3: Install dependencies (Cloudflare does this automatically)
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    yarn install --frozen-lockfile
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi
echo ""

# Step 4: Copy Tunetalks config
echo -e "${BLUE}⚙️  Setting up Tunetalks configuration...${NC}"
if [ -f config.tunetalks.json ]; then
    cp config.tunetalks.json config.json
    echo -e "${GREEN}✅ Copied config.tunetalks.json → config.json${NC}"
else
    echo -e "${RED}❌ Error: config.tunetalks.json not found${NC}"
    echo "Please create config.tunetalks.json first"
    exit 1
fi
echo ""

# Step 5: Verify assets are deployed
echo -e "${BLUE}🎨 Checking Tunetalks assets...${NC}"
ASSETS_MISSING=0

# Check for logo
if [ ! -f "res/vector-icons/tunetalks-logo.svg" ]; then
    echo -e "${YELLOW}⚠️  Warning: res/vector-icons/tunetalks-logo.svg not found${NC}"
    ASSETS_MISSING=1
fi

# Check for icons
for size in 24 120 144 152 180 192 512; do
    if [ ! -f "res/vector-icons/tunetalks-${size}.png" ]; then
        echo -e "${YELLOW}⚠️  Warning: tunetalks-${size}.png not found${NC}"
        ASSETS_MISSING=1
    fi
done

if [ $ASSETS_MISSING -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some assets are missing. Run:${NC}"
    echo -e "${YELLOW}   ./scripts/deploy-tunetalks-assets.sh${NC}"
    echo ""
    echo -e "${YELLOW}Continuing build anyway...${NC}"
else
    echo -e "${GREEN}✅ All assets present${NC}"
fi
echo ""

# Step 6: Clean previous build
echo -e "${BLUE}🧹 Cleaning previous build...${NC}"
if [ -d "webapp" ]; then
    rm -rf webapp
    echo -e "${GREEN}✅ Cleaned webapp directory${NC}"
else
    echo -e "${GREEN}✅ No previous build to clean${NC}"
fi
echo ""

# Step 7: Build the app
echo -e "${BLUE}🔨 Building Tunetalks...${NC}"
echo "This may take 2-3 minutes..."
echo ""

# Use production build with optimizations
NODE_ENV=production yarn build

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Build successful!${NC}"
else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Step 8: Copy config to webapp
echo -e "${BLUE}📋 Copying config to output...${NC}"
cp config.json webapp/config.json
echo -e "${GREEN}✅ Config copied to webapp/config.json${NC}"
echo ""

# Step 9: Create Cloudflare-specific files
echo -e "${BLUE}☁️  Creating Cloudflare-specific files...${NC}"

# Create _headers file
cat > webapp/_headers << 'EOF'
# Security headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

# Cache static assets aggressively
/bundles/*
  Cache-Control: public, max-age=31536000, immutable

/themes/*
  Cache-Control: public, max-age=31536000, immutable

/vector-icons/*
  Cache-Control: public, max-age=31536000, immutable

# Never cache config
/config.json
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

# Cache other assets moderately
/*.js
  Cache-Control: public, max-age=86400

/*.css
  Cache-Control: public, max-age=86400
EOF

echo -e "${GREEN}✅ Created webapp/_headers${NC}"

# Create _redirects file for SPA
cat > webapp/_redirects << 'EOF'
# SPA fallback - serve index.html for all routes
/*    /index.html   200
EOF

echo -e "${GREEN}✅ Created webapp/_redirects${NC}"
echo ""

# Step 10: Show build info
echo -e "${BLUE}📊 Build Information${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Output directory:  webapp/"
echo "Total size:        $(du -sh webapp | cut -f1)"
echo "Files count:       $(find webapp -type f | wc -l | tr -d ' ')"
echo "Version:           $VERSION"
echo "Config:            webapp/config.json"
echo "Brand:             $(cat webapp/config.json | grep '"brand"' | cut -d'"' -f4)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 11: Verify critical files
echo -e "${BLUE}🔍 Verifying build output...${NC}"
VERIFICATION_FAILED=0

if [ ! -f "webapp/index.html" ]; then
    echo -e "${RED}❌ Missing: webapp/index.html${NC}"
    VERIFICATION_FAILED=1
fi

if [ ! -f "webapp/config.json" ]; then
    echo -e "${RED}❌ Missing: webapp/config.json${NC}"
    VERIFICATION_FAILED=1
fi

if [ ! -d "webapp/bundles" ]; then
    echo -e "${RED}❌ Missing: webapp/bundles/${NC}"
    VERIFICATION_FAILED=1
fi

if [ $VERIFICATION_FAILED -eq 1 ]; then
    echo ""
    echo -e "${RED}❌ Build verification failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All critical files present${NC}"
echo ""

# Step 12: Final instructions
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Tunetalks build complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📤 Deployment Options:${NC}"
echo ""
echo "1️⃣  Git Push (Auto Deploy):"
echo "   git add webapp/"
echo "   git commit -m 'Build for production'"
echo "   git push"
echo ""
echo "2️⃣  Wrangler CLI:"
echo "   wrangler pages publish webapp --project-name=tunetalks"
echo ""
echo "3️⃣  Manual Upload:"
echo "   Drag & drop 'webapp/' folder to Cloudflare Pages dashboard"
echo ""
echo -e "${BLUE}🧪 Test Locally:${NC}"
echo "   cd webapp && python3 -m http.server 8080"
echo "   Open: http://localhost:8080"
echo ""
echo -e "${BLUE}📖 Full Guide:${NC}"
echo "   cat TUNETALKS_CLOUDFLARE_DEPLOY.md"
echo ""

exit 0
