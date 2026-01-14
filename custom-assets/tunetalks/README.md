# Tunetalks Assets Directory Structure

Thư mục này chứa tất cả custom assets cho Tunetalks branding.

## Structure

```
custom-assets/tunetalks/
├── logos/
│   ├── tunetalks-logo.svg          # Main logo (vector)
│   ├── tunetalks-logo-white.svg    # Logo for dark backgrounds
│   ├── tunetalks-icon.svg          # Icon only (no text)
│   └── favicon/
│       ├── favicon.ico
│       ├── favicon-16x16.png
│       ├── favicon-32x32.png
│       └── apple-touch-icon.png
│
├── icons/
│   ├── 24.png    # App icons in various sizes
│   ├── 120.png
│   ├── 144.png
│   ├── 152.png
│   ├── 180.png
│   ├── 192.png
│   └── 512.png
│
├── backgrounds/
│   ├── welcome-bg.jpg              # Welcome page background
│   ├── auth-bg.jpg                 # Auth page background
│   └── home-bg.jpg                 # Home page background
│
├── social/
│   ├── opengraph.png               # 1200x630px for social sharing
│   ├── twitter-card.png            # 1200x600px for Twitter
│   └── linkedin-banner.png         # 1200x627px for LinkedIn
│
└── themes/
    ├── colors.json                 # Brand color definitions
    └── custom.pcss                 # Custom CSS theme
```

## Copy Instructions

### Step 1: Copy Icons

```bash
# Copy logo files
cp custom-assets/tunetalks/logos/tunetalks-logo.svg res/img/
cp custom-assets/tunetalks/logos/tunetalks-icon.svg res/img/

# Copy all icon sizes
for size in 24 120 144 152 180 192 512; do
    cp custom-assets/tunetalks/icons/${size}.png res/vector-icons/
done

# Copy favicon
cp custom-assets/tunetalks/logos/favicon/favicon.ico res/vector-icons/
```

### Step 2: Setup Backgrounds

Upload backgrounds to your CDN/server:
- `welcome-bg.jpg` → https://tunetalks.com/assets/welcome-bg.jpg
- `auth-bg.jpg` → https://tunetalks.com/assets/auth-bg.jpg
- `opengraph.png` → https://tunetalks.com/assets/opengraph.png

Or copy locally:
```bash
cp custom-assets/tunetalks/backgrounds/* res/img/backgrounds/
```

### Step 3: Update References

Update all references in:
- `config.tunetalks.json`
- `src/vector/index.html`
- `res/manifest.json`

## Design Specifications

### Logo Requirements

**Main Logo (tunetalks-logo.svg)**
- Format: SVG (vector)
- Max width: 200px
- Max height: 50px
- Colors: Use brand primary color
- Background: Transparent

**App Icons (PNG)**
- Sizes: 24, 120, 144, 152, 180, 192, 512 px (square)
- Format: PNG with transparency
- Background: Can be solid color or transparent
- Content: Logo/icon centered with padding

### Background Images

**Welcome Background**
- Dimensions: 1920x1080px (16:9)
- Format: JPG or PNG
- File size: < 500KB (optimized)
- Style: Professional, relates to communication/chat

**OpenGraph Image**
- Dimensions: 1200x630px
- Format: PNG or JPG
- File size: < 1MB
- Must include: Tunetalks logo and tagline

## Brand Colors

Main Tunetalks colors (example):

```
Primary:   #0DBD8B (Teal Green)
Secondary: #0CA678 (Dark Teal)
Accent:    #00E5A0 (Light Teal)
Text:      #2E3338 (Dark Gray)
Background:#FFFFFF (White)
```

Save in `custom-assets/tunetalks/themes/colors.json`

## Quick Deploy Script

```bash
#!/bin/bash
# deploy-assets.sh

echo "Deploying Tunetalks assets..."

# Copy logos
cp custom-assets/tunetalks/logos/tunetalks-logo.svg res/img/
echo "✓ Logos copied"

# Copy icons
for size in 24 120 144 152 180 192 512; do
    cp custom-assets/tunetalks/icons/${size}.png res/vector-icons/
done
echo "✓ Icons copied"

# Copy favicon
cp custom-assets/tunetalks/logos/favicon/favicon.ico res/vector-icons/
echo "✓ Favicon copied"

echo "✅ All assets deployed successfully!"
```

## Asset Checklist

Before building, ensure you have:

- [ ] Main logo SVG
- [ ] All 7 icon sizes (PNG)
- [ ] Favicon files
- [ ] Welcome background image
- [ ] OpenGraph image for social sharing
- [ ] Brand colors defined
- [ ] Custom theme CSS (optional)

## Notes

- All assets should be optimized for web
- Use tools like ImageOptim or TinyPNG to compress images
- SVG logos should be cleaned (remove unnecessary metadata)
- Test all icons on different backgrounds (light/dark)
