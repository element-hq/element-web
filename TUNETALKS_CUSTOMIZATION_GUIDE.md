# Hướng Dẫn Tùy Chỉnh Element Web Thành Tunetalks

## Tổng Quan

Tài liệu này mô tả các bước cần thiết để rebrand Element Web thành Tunetalks, một ứng dụng chat Matrix tùy chỉnh.

## Các Thay Đổi Cần Thiết

### 1. Cấu Hình Package (package.json)

**File: `/Users/hexagon/WebElement/element-web/package.json`**

```json
{
    "name": "tunetalks-web",
    "version": "1.0.0",
    "description": "Tunetalks: Nền tảng giao tiếp an toàn",
    "author": "Tunetalks Team",
    "repository": {
        "type": "git",
        "url": "https://github.com/your-org/tunetalks-web"
    }
}
```

### 2. Cấu Hình Branding (config.json)

**File: `/Users/hexagon/WebElement/element-web/config.json`** (tạo từ config.sample.json)

```json
{
    "default_server_config": {
        "m.homeserver": {
            "base_url": "https://matrix.tunetalks.com",
            "server_name": "tunetalks.com"
        }
    },
    "brand": "Tunetalks",
    "default_theme": "light",
    
    "element_call": {
        "url": "https://call.tunetalks.com",
        "brand": "Tunetalks Call"
    },
    
    "jitsi": {
        "preferred_domain": "meet.tunetalks.com"
    },
    
    "desktop_builds": {
        "available": true,
        "logo": "https://tunetalks.com/assets/logo-small.svg",
        "url": "https://tunetalks.com/download"
    },
    
    "mobile_builds": {
        "ios": "https://apps.apple.com/app/tunetalks",
        "android": "https://play.google.com/store/apps/details?id=com.tunetalks.android",
        "fdroid": "https://f-droid.org/packages/com.tunetalks.android"
    },
    
    "branding": {
        "welcome_background_url": "https://tunetalks.com/assets/welcome-bg.jpg",
        "auth_header_logo_url": "https://tunetalks.com/assets/logo.svg",
        "auth_footer_links": [
            { "text": "Về Chúng Tôi", "url": "https://tunetalks.com/about" },
            { "text": "Hỗ Trợ", "url": "https://tunetalks.com/support" }
        ]
    },
    
    "embedded_pages": {
        "welcome_url": "https://tunetalks.com/assets/welcome.html",
        "home_url": "https://tunetalks.com/assets/home.html"
    },
    
    "help_url": "https://tunetalks.com/help",
    "privacy_policy_url": "https://tunetalks.com/privacy"
}
```

### 3. HTML Title & Metadata

**File: `/Users/hexagon/WebElement/element-web/src/vector/index.html`**

Thay đổi:
- `<title>Element</title>` → `<title>Tunetalks</title>`
- `<meta name="apple-mobile-web-app-title" content="Element">` → `content="Tunetalks"`
- `<meta name="application-name" content="Element">` → `content="Tunetalks"`

### 4. Manifest File (PWA)

**File: `/Users/hexagon/WebElement/element-web/res/manifest.json`**

```json
{
    "name": "Tunetalks",
    "short_name": "Tunetalks",
    "description": "Nền tảng giao tiếp an toàn Matrix",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#0DBD8B",
    "background_color": "#ffffff",
    "icons": [
        {
            "src": "vector-icons/192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "vector-icons/512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

### 5. Icons & Logo

**Cần thay thế các file trong:**

```
/res/vector-icons/
├── 24.png      → Tunetalks logo 24x24
├── 120.png     → Tunetalks logo 120x120
├── 144.png     → Tunetalks logo 144x144
├── 152.png     → Tunetalks logo 152x152
├── 180.png     → Tunetalks logo 180x180
├── 192.png     → Tunetalks logo 192x192
├── 512.png     → Tunetalks logo 512x512
└── favicon.ico → Tunetalks favicon

/res/img/
├── element-desktop-logo.svg → tunetalks-logo.svg
└── element-shiny.svg → tunetalks-shiny.svg

/res/themes/element/img/logos/
└── (thay thế tất cả logo ở đây)
```

### 6. Theme Customization

**Tạo theme tùy chỉnh: `/Users/hexagon/WebElement/element-web/res/themes/tunetalks/`**

```
tunetalks/
├── css/
│   └── tunetalks.pcss
└── img/
    └── logos/
        ├── logo.svg
        └── opengraph.png
```

**File: `res/themes/tunetalks/css/tunetalks.pcss`**

```css
@import "../../light/css/_base.pcss";

:root {
    /* Brand Colors */
    --cpd-color-bg-brand-primary: #0DBD8B;
    --cpd-color-bg-brand-secondary: #0CA678;
    
    /* Custom Variables */
    --tunetalks-primary: #0DBD8B;
    --tunetalks-secondary: #0CA678;
    --tunetalks-accent: #00E5A0;
}
```

**Thêm vào webpack.config.js:**

```javascript
const cssThemes = {
    // ... existing themes
    "theme-tunetalks": "./res/themes/tunetalks/css/tunetalks.pcss",
};
```

### 7. Mobile Guide Customization

**File: `/Users/hexagon/WebElement/element-web/src/vector/mobile_guide/index.html`**

Thay đổi:
- "Element Mobile Guide" → "Tunetalks Mobile Guide"
- "Download Element" → "Tải Tunetalks"
- Cập nhật links tới app stores
- Thay logo: `element-logo.svg` → `tunetalks-logo.svg`

**File: `/Users/hexagon/WebElement/element-web/src/vector/mobile_guide/assets/`**

Thêm logo và assets của Tunetalks.

### 8. Welcome Page

**File: `/Users/hexagon/WebElement/element-web/res/welcome.html`**

Tùy chỉnh nội dung welcome page với branding Tunetalks.

### 9. Internationalization (i18n)

**File: `/Users/hexagon/WebElement/element-web/src/i18n/strings/vi.json`**

Thêm hoặc cập nhật các translation strings cho tiếng Việt:

```json
{
    "powered_by_matrix": "Được hỗ trợ bởi Matrix",
    "welcome_to_app": "Chào mừng đến với %(brand)s",
    "sign_in": "Đăng nhập",
    "create_account": "Tạo tài khoản"
}
```

### 10. Environment Variables

**Tạo file: `.env.tunetalks`**

```bash
# Tunetalks Custom Build Config
RIOT_OG_IMAGE_URL=https://tunetalks.com/assets/opengraph.png
CSP_EXTRA_SOURCE=https://tunetalks.com
VERSION=1.0.0
```

## Build Commands

### Development Build

```bash
# Copy config
cp config.sample.json config.json
# Edit config.json with Tunetalks settings

# Start dev server
yarn start
```

### Production Build

```bash
# Load environment variables
source .env.tunetalks

# Build
yarn build

# Or create distribution tarball
yarn dist
```

### Docker Build

```bash
# Build Docker image with Tunetalks branding
docker build \
  --build-arg RIOT_OG_IMAGE_URL=https://tunetalks.com/assets/opengraph.png \
  -t tunetalks-web:latest \
  .
```

## Deployment Checklist

### Pre-deployment

- [ ] Tạo tất cả logo và icons với kích thước phù hợp
- [ ] Chuẩn bị assets (welcome-bg.jpg, opengraph.png, etc.)
- [ ] Cấu hình homeserver Matrix tại matrix.tunetalks.com
- [ ] Thiết lập domain và SSL certificates
- [ ] Tạo Jitsi server tại meet.tunetalks.com (nếu cần)

### Configuration

- [ ] Cập nhật package.json với thông tin Tunetalks
- [ ] Tạo config.json từ template
- [ ] Cấu hình branding trong config.json
- [ ] Thay thế tất cả logo và icons
- [ ] Tùy chỉnh theme colors
- [ ] Cập nhật mobile guide
- [ ] Tạo welcome và home pages

### Build & Test

- [ ] Test development build (`yarn start`)
- [ ] Test production build (`yarn build`)
- [ ] Test trên nhiều browsers (Chrome, Firefox, Safari)
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test PWA functionality
- [ ] Test theme switching
- [ ] Kiểm tra i18n (Vietnamese & English)

### Deployment

- [ ] Deploy lên production server
- [ ] Cấu hình web server headers (CSP, X-Frame-Options, etc.)
- [ ] Setup caching rules
- [ ] Cấu hình CDN (nếu có)
- [ ] Test production deployment
- [ ] Monitor logs và errors

## Advanced Customizations

### Custom Components

Sử dụng `components.json` để override các component:

```json
{
    "src/components/views/auth/Welcome.tsx": "src/custom/tunetalks/Welcome.tsx"
}
```

### Module System

Tạo custom module trong `build_config.yaml`:

```yaml
modules:
    - "./custom_modules/tunetalks-branding"
```

### Custom Themes với PostCSS

Tạo file `res/themes/tunetalks/css/_variables.pcss`:

```css
/* Tunetalks Brand Variables */
$primary-color: #0DBD8B;
$secondary-color: #0CA678;
$accent-color: #00E5A0;
$text-primary: #2E3338;
$background-primary: #FFFFFF;
```

## Bảo Mật & Best Practices

1. **Không hardcode credentials** - Sử dụng environment variables
2. **CSP Headers** - Cấu hình Content Security Policy đúng
3. **HTTPS Only** - Luôn deploy qua HTTPS
4. **Regular Updates** - Cập nhật Element Web base thường xuyên
5. **Custom Homeserver** - Sử dụng homeserver riêng, không dùng matrix.org
6. **Rate Limiting** - Cấu hình rate limiting cho APIs
7. **Backup** - Backup configs và custom code thường xuyên

## Troubleshooting

### Logo không hiển thị
- Kiểm tra đường dẫn trong webpack.config.js
- Verify icons tồn tại trong res/vector-icons/
- Clear browser cache

### Theme không apply
- Kiểm tra cssThemes trong webpack.config.js
- Rebuild: `yarn clean && yarn build`
- Verify theme file syntax (PCSS)

### Config không load
- Kiểm tra config.json syntax (valid JSON)
- Verify domain matching (config.$domain.json)
- Check browser console for errors

### Build errors
- Run `yarn install` để update dependencies
- Check Node version (cần LTS)
- Clear node_modules và yarn cache: `rm -rf node_modules && yarn install`

## Tài Liệu Tham Khảo

- [Element Web Configuration](docs/config.md)
- [Modules System](docs/modules.md)
- [Theming Guide](docs/theming.md)
- [Code Style Guide](code_style.md)
- [Matrix Spec](https://spec.matrix.org/)

## Support

Nếu gặp vấn đề, tham khảo:
- Element Web docs: https://github.com/element-hq/element-web/tree/develop/docs
- Matrix Community: #element-dev:matrix.org
- Stack Overflow: tag `matrix` và `element-web`
