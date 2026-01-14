# 🎨 Hướng Dẫn Thiết Kế Visual Identity Tunetalks

## 📋 Tổng Quan

Tài liệu này hướng dẫn chi tiết để tạo bộ nhận diện thương hiệu hoàn chỉnh cho Tunetalks.

---

## ✅ Đã Có Sẵn

### 1. Brand Identity System
✅ **Brand Colors** - Đã định nghĩa đầy đủ trong `custom-assets/tunetalks/themes/colors.json`
✅ **Typography** - Font Inter (primary), Fira Code (monospace)
✅ **Spacing & Layout** - Grid system 8px base
✅ **Brand Guidelines** - Tone, voice, personality

### 2. Technical Specifications
✅ Kích thước assets required
✅ File formats cần thiết
✅ Cấu trúc thư mục
✅ Naming conventions

### 3. Configuration Files
✅ config.tunetalks.json
✅ Environment variables
✅ Build scripts

---

## ❌ Cần Thiết Kế

### Logo & Branding Assets

#### 1. Main Logo
**File:** `tunetalks-logo.svg`
- **Kích thước:** Scalable SVG
- **Composition:** Icon + Wordmark
- **Max width:** 200px
- **Max height:** 50px
- **Colors:** Primary #0DBD8B, White/Dark text

**Design Requirements:**
```
+----------------------------------+
|  [Icon]  TUNETALKS              |
|   🎵                             |
+----------------------------------+
```

- Icon: Music/chat themed (notes, waves, chat bubble)
- Clean, modern, minimalist
- Works on light & dark backgrounds
- Có 2 variants: color và monochrome

#### 2. Icon Only
**File:** `tunetalks-icon.svg`
- **Kích thước:** Square (1:1 ratio)
- **Minimum size:** 512x512px
- **Content:** Logo icon only (no text)
- **Padding:** 10% internal padding

**Use cases:**
- App icons
- Favicons
- Social media avatars
- Loading spinners

#### 3. Wordmark Only
**File:** `tunetalks-wordmark.svg`
- **Content:** "TUNETALKS" text only
- **Font:** Inter Bold hoặc custom
- **Letter spacing:** -0.02em
- **Variants:** Primary color, white, black

---

## 📱 App Icons (PWA)

Tạo 7 kích thước từ icon SVG:

```bash
# Sizes needed (PNG format)
tunetalks-24.png      # Toolbar
tunetalks-120.png     # iOS (2x)
tunetalks-144.png     # Android Chrome
tunetalks-152.png     # iOS (iPad)
tunetalks-180.png     # iOS (3x)
tunetalks-192.png     # Android (standard)
tunetalks-512.png     # Android (high-res)
```

### Thiết Kế Requirements:
- **Background:** Solid color (#0DBD8B) hoặc gradient
- **Icon:** Centered với padding 15-20%
- **Style:** Consistent với main logo
- **Export:** PNG, transparent nếu có background khác

### Auto-generate Script:
```bash
# Sử dụng ImageMagick hoặc SVGEXPORT
for size in 24 120 144 152 180 192 512; do
  svgexport tunetalks-icon.svg tunetalks-${size}.png ${size}:${size}
done
```

---

## 🌄 Background Images

### 1. Welcome Background
**File:** `welcome-bg.jpg`
- **Size:** 1920x1080px (Full HD)
- **Format:** JPG, optimized (< 500KB)
- **Style:** 
  - Abstract waves/music theme
  - Gradient overlay (#0DBD8B → #0CA678)
  - Low saturation, không quá flashy
  - Professional, modern

**Color palette:**
- Base: Teal shades
- Accents: Subtle white/light patterns
- Opacity: 80% để text readable

### 2. Auth Header Background (Optional)
**File:** `auth-bg.jpg`
- **Size:** 1920x400px
- **Style:** Similar to welcome-bg but shorter
- **Use:** Login/Register page header

---

## 🔗 Social Media Assets

### 1. OpenGraph Image
**File:** `og-tunetalks.png`
- **Size:** 1200x630px
- **Format:** PNG or JPG
- **Content:**
  ```
  +----------------------------------------+
  |                                        |
  |    [Large Logo]                        |
  |    TUNETALKS                           |
  |    Nền tảng giao tiếp an toàn          |
  |                                        |
  |    tunetalks.me                        |
  +----------------------------------------+
  ```
- **Background:** Brand gradient
- **Text:** White, high contrast

### 2. Social Media Sizes
```bash
Facebook Cover:     820x312px
Twitter Header:     1500x500px
LinkedIn Banner:    1584x396px
Instagram Profile:  320x320px
```

---

## 🎯 Favicon Package

### Required Files:
```
favicon.ico         # 16x16, 32x32, 48x48 (multi-size)
favicon-16x16.png
favicon-32x32.png
apple-touch-icon.png  # 180x180
```

### Tools để tạo:
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)
- ImageMagick manual

---

## 🎨 Design Tools & Resources

### Recommended Tools:

#### Free:
- **Figma** (web-based, collaborative) ⭐ Recommended
- **Inkscape** (SVG editor)
- **GIMP** (Raster graphics)
- **Canva** (Quick mockups)

#### Paid:
- **Adobe Illustrator** (Professional)
- **Sketch** (macOS only)
- **Affinity Designer** (One-time purchase)

### AI Tools:
- **Midjourney** - Generate logo concepts
- **DALL-E** - Create backgrounds
- **Looka** - AI logo generator
- **Brandmark** - Full brand identity

---

## 📐 Design Guidelines

### Logo Do's:
✅ Keep it simple và memorable
✅ Scalable (works at 16px và 1000px)
✅ Recognizable in monochrome
✅ Clear spacing around elements
✅ Use brand colors consistently

### Logo Don'ts:
❌ Too many colors (max 2-3)
❌ Overly complex details
❌ Thin lines (< 2px at small sizes)
❌ Text too small/unreadable
❌ Too similar to competitors

### Color Usage:
```css
/* Primary - Main brand color */
#0DBD8B  → Buttons, links, CTAs

/* Secondary - Supporting */
#0CA678  → Hover states, borders

/* Accent - Highlights */
#00E5A0  → Badges, notifications

/* Text */
#2E3338  → Body text
#FFFFFF  → On colored backgrounds
```

---

## 🚀 Quick Start với AI Tools

### Option 1: Sử dụng Midjourney

```
Prompt for Logo:
"minimalist logo for Tunetalks chat app, music note and chat bubble, 
teal green #0DBD8B, modern flat design, vector style, white background, 
simple and memorable"

Prompt for Icon:
"app icon for Tunetalks, music and messaging theme, teal green color, 
minimal design, square format, no text"

Prompt for Background:
"abstract background with teal green waves, gradient from #0DBD8B to 
#0CA678, modern professional style, high resolution"
```

### Option 2: Sử dụng Figma Templates

1. Search "chat app logo template" trên Figma Community
2. Duplicate template
3. Customize với Tunetalks colors
4. Export SVG

### Option 3: Hire Designer

**Platforms:**
- Fiverr ($20-100)
- Upwork ($50-300)
- 99designs (Contest: $299+)
- Dribbble (High-end: $500+)

**Brief template:** (included below)

---

## 📝 Design Brief Template

```markdown
# Tunetalks Logo & Brand Identity Design Brief

## Project Overview
Tên dự án: Tunetalks
Loại: Secure messaging app (Matrix protocol)
Tagline: "Nền tảng giao tiếp an toàn"

## Brand Personality
- Modern, clean, professional
- Trustworthy và secure
- Friendly nhưng serious
- Tech-savvy

## Logo Requirements
- Type: Combined mark (icon + wordmark)
- Style: Minimalist, flat design
- Icon theme: Music + Chat/Communication
- Must work in: Color, monochrome, small sizes

## Color Palette
Primary: #0DBD8B (Teal Green)
Secondary: #0CA678 (Dark Teal)
Accent: #00E5A0 (Light Teal)
Text: #2E3338 (Dark Gray)

## Deliverables
1. Main logo (SVG, PNG)
2. Icon only (SVG, PNG)
3. Wordmark only (SVG, PNG)
4. App icons (7 sizes: 24, 120, 144, 152, 180, 192, 512px)
5. Favicon package
6. Welcome background (1920x1080)
7. OpenGraph image (1200x630)

## Timeline
Preferred: 3-5 days
Budget: [Your budget]

## References/Inspiration
- Signal app (clean, security-focused)
- Telegram (friendly, modern)
- Element (Matrix protocol, professional)
- Discord (community-focused)

## Technical Notes
- SVG must be clean code (no unnecessary elements)
- PNG exports with transparent background
- Files under 500KB for web optimization
```

---

## 🎯 Design Workflow

### Step-by-Step Process:

#### Phase 1: Concept (Day 1-2)
1. Brainstorm 3-5 logo concepts
2. Sketch rough ideas
3. Choose best direction
4. Create digital mockup in Figma/Illustrator

#### Phase 2: Refinement (Day 2-3)
1. Refine chosen concept
2. Test at different sizes
3. Create color variations
4. Get feedback
5. Make revisions

#### Phase 3: Finalization (Day 3-4)
1. Finalize logo design
2. Create all required variations
3. Generate app icons (all sizes)
4. Design backgrounds
5. Create social media assets

#### Phase 4: Implementation (Day 4-5)
1. Export all files to correct formats
2. Organize in correct folders
3. Run deploy script
4. Test in application
5. Verify on different devices

---

## 📁 File Organization

Sau khi thiết kế xong, organize như sau:

```
custom-assets/tunetalks/
├── logos/
│   ├── tunetalks-logo.svg          # Main logo
│   ├── tunetalks-logo.png          # Main logo (raster)
│   ├── tunetalks-icon.svg          # Icon only
│   ├── tunetalks-icon.png
│   ├── tunetalks-wordmark.svg      # Text only
│   └── tunetalks-wordmark.png
│
├── icons/
│   ├── tunetalks-24.png
│   ├── tunetalks-120.png
│   ├── tunetalks-144.png
│   ├── tunetalks-152.png
│   ├── tunetalks-180.png
│   ├── tunetalks-192.png
│   └── tunetalks-512.png
│
├── backgrounds/
│   ├── welcome-bg.jpg
│   └── auth-bg.jpg (optional)
│
└── social/
    ├── og-tunetalks.png
    ├── favicon.ico
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    └── apple-touch-icon.png
```

---

## 🔧 Deployment Script

Sau khi có assets, chạy:

```bash
# Copy assets to correct locations
./scripts/deploy-tunetalks-assets.sh

# Verify
ls -la res/vector-icons/tunetalks*
ls -la res/themes/tunetalks/img/
```

Script sẽ tự động:
- Copy logos vào res/vector-icons/
- Copy icons vào res/vector-icons/
- Copy backgrounds vào res/themes/tunetalks/img/
- Copy favicons vào public/

---

## ✅ Quality Checklist

### Before Finalizing:

**Logo:**
- [ ] Scalable từ 16px → 1000px
- [ ] Clear ở mọi size
- [ ] Works on light & dark backgrounds
- [ ] Monochrome version readable
- [ ] SVG code clean (no hidden layers)

**Icons:**
- [ ] All 7 sizes generated
- [ ] Consistent visual style
- [ ] Proper padding (15-20%)
- [ ] Transparent backgrounds
- [ ] File sizes optimized

**Backgrounds:**
- [ ] High quality (no pixelation)
- [ ] File size < 500KB
- [ ] Colors match brand
- [ ] Text readable overlays

**Favicons:**
- [ ] All sizes included
- [ ] Recognizable at 16x16
- [ ] Multi-size .ico working
- [ ] Apple touch icon 180x180

**General:**
- [ ] All files named correctly
- [ ] Organized in proper folders
- [ ] No extra/temp files
- [ ] README updated with sources

---

## 🎨 Example Inspirations

### Similar Apps for Reference:

1. **Signal**
   - Simple bubble icon
   - Blue/white color scheme
   - Clean, trustworthy design

2. **Telegram**
   - Paper plane icon
   - Light blue primary
   - Friendly, modern

3. **Element**
   - Chat bubble with brackets
   - Green accent
   - Professional, tech-focused

4. **Discord**
   - Game controller/chat hybrid
   - Purple/blue
   - Fun, community-focused

### Tunetalks Differentiation:
- Music theme (notes, waves)
- Teal green (unique in chat apps)
- Vietnamese market focus
- Security emphasis

---

## 💰 Budget Estimates

### DIY (Free):
- Time: 10-20 hours
- Tools: Figma (free), Inkscape (free)
- Cost: $0

### Freelancer (Budget):
- Fiverr: $20-100
- Timeline: 3-5 days
- Revisions: 2-3 rounds

### Freelancer (Mid-range):
- Upwork: $50-300
- Timeline: 5-7 days
- Full package + source files

### Agency (Premium):
- Full identity: $500-2000
- Timeline: 2-3 weeks
- Includes brand guidelines

---

## 🚀 Next Steps

### Option A: DIY Design
1. Read this guide
2. Open Figma
3. Create workspace
4. Follow design guidelines
5. Export assets
6. Deploy using script

### Option B: AI-Assisted
1. Use Midjourney prompts above
2. Generate 5-10 variations
3. Select best ones
4. Refine in Figma/Illustrator
5. Export & deploy

### Option C: Hire Designer
1. Post brief on Fiverr/Upwork
2. Review designer portfolios
3. Award project
4. Provide feedback
5. Receive final files
6. Deploy

---

## 📞 Support & Resources

### Design Questions:
- [Figma Community](https://www.figma.com/community)
- [r/logodesign](https://reddit.com/r/logodesign)
- [Designer subreddit](https://reddit.com/r/design_critiques)

### Technical Questions:
- Review: `custom-assets/tunetalks/README.md`
- Scripts: `scripts/deploy-tunetalks-assets.sh`
- Config: `config.tunetalks.json`

### Tools Documentation:
- [Figma Tutorials](https://help.figma.com)
- [SVG Optimization](https://jakearchibald.github.io/svgomg/)
- [Favicon Generator](https://realfavicongenerator.net/)

---

## ✨ Summary

**Đã có:**
- ✅ Brand colors & guidelines
- ✅ Technical specifications
- ✅ File structure & naming
- ✅ Deployment scripts

**Cần tạo:**
- ❌ Logo designs (SVG)
- ❌ App icons (7 sizes PNG)
- ❌ Background images
- ❌ Social media assets
- ❌ Favicon package

**Timeline:** 3-5 days (design + implementation)

**Recommended:** Start với Figma hoặc hire designer trên Fiverr

---

**Ready to create your brand identity!** 🎨

*Document created: January 14, 2026*
*Version: 1.0*
