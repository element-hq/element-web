# Tunetalks Quick Start Guide

## 🚀 Bắt Đầu Nhanh

### Yêu Cầu Hệ Thống

- Node.js 20.x LTS
- Yarn 1.22+
- Docker & Docker Compose (optional, cho deployment)

### 1. Clone và Setup

```bash
cd /Users/hexagon/WebElement/element-web

# Install dependencies
yarn install

# Copy Tunetalks config
cp config.tunetalks.json config.json
```

### 2. Development Mode

```bash
# Start development server
yarn start

# Hoặc sử dụng script tùy chỉnh
source .env.tunetalks
yarn start
```

Truy cập: http://localhost:8080

### 3. Production Build

#### Option A: Script Tự Động

```bash
./scripts/build-tunetalks.sh
```

#### Option B: Manual

```bash
# Load environment
source .env.tunetalks

# Build
yarn clean
yarn build

# Test locally
cd webapp
python3 -m http.server 8080
```

### 4. Docker Deployment

```bash
# Build Docker image
docker build -f Dockerfile.tunetalks -t tunetalks-web:latest .

# Run with Docker Compose
docker-compose -f docker-compose.tunetalks.yml up -d

# Check logs
docker-compose -f docker-compose.tunetalks.yml logs -f
```

## 📝 Checklist Tùy Chỉnh

### Assets Cần Chuẩn Bị

- [ ] **Logo Files** (PNG format):
  - 24x24px → `res/vector-icons/24.png`
  - 120x120px → `res/vector-icons/120.png`
  - 144x144px → `res/vector-icons/144.png`
  - 152x152px → `res/vector-icons/152.png`
  - 180x180px → `res/vector-icons/180.png`
  - 192x192px → `res/vector-icons/192.png`
  - 512x512px → `res/vector-icons/512.png`
  - favicon.ico → `res/vector-icons/favicon.ico`

- [ ] **SVG Logos**:
  - Main logo → `res/img/tunetalks-logo.svg`
  - Shiny logo → `res/img/tunetalks-shiny.svg`

- [ ] **Branding Assets**:
  - Welcome background → host tại tunetalks.com
  - OpenGraph image (1200x630px) → host tại tunetalks.com
  - Auth header logo → host tại tunetalks.com

### Configuration

- [ ] Cập nhật `config.tunetalks.json`:
  - [ ] Homeserver URL
  - [ ] Brand name
  - [ ] Theme preferences
  - [ ] Mobile app links
  - [ ] Help/Support URLs

- [ ] Cập nhật `package.json`:
  - [ ] Package name
  - [ ] Description
  - [ ] Author
  - [ ] Repository URL

- [ ] Cập nhật `.env.tunetalks`:
  - [ ] OG Image URL
  - [ ] CSP Extra Source
  - [ ] Version number

### Files Cần Chỉnh Sửa

- [ ] `src/vector/index.html` - Title và metadata
- [ ] `res/manifest.json` - PWA configuration
- [ ] `src/vector/mobile_guide/index.html` - Mobile guide branding

### Testing

- [ ] Test development build (`yarn start`)
- [ ] Test production build (`yarn build`)
- [ ] Test trên Chrome
- [ ] Test trên Firefox
- [ ] Test trên Safari
- [ ] Test trên Mobile browsers
- [ ] Test PWA installation
- [ ] Test đăng nhập/đăng ký
- [ ] Test gửi tin nhắn
- [ ] Test voice/video call

## 🎨 Tùy Chỉnh Theme

### Tạo Theme Tunetalks

1. Tạo folder: `res/themes/tunetalks/`
2. Tạo file CSS: `res/themes/tunetalks/css/tunetalks.pcss`

```css
@import "../../light/css/_base.pcss";

:root {
    /* Tunetalks Brand Colors */
    --cpd-color-bg-brand-primary: #0DBD8B;
    --cpd-color-bg-brand-secondary: #0CA678;
    --cpd-color-text-brand: #FFFFFF;
    
    /* Buttons */
    --cpd-color-bg-button-primary: #0DBD8B;
    --cpd-color-bg-button-primary-hover: #0CA678;
    
    /* Links */
    --cpd-color-text-link: #0DBD8B;
}
```

3. Cập nhật `webpack.config.js`:

```javascript
const cssThemes = {
    // ... existing themes
    "theme-tunetalks": "./res/themes/tunetalks/css/tunetalks.pcss",
};
```

4. Set default theme trong `config.json`:

```json
{
    "default_theme": "tunetalks"
}
```

## 🌐 Deploy Production

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name tunetalks.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tunetalks.com;
    
    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Root directory
    root /var/www/tunetalks-web;
    index index.html;
    
    # Security Headers
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "frame-ancestors 'self'" always;
    
    # Cache Control
    location ~ ^/(config.*\.json|i18n|home|sites|index.html)$ {
        add_header Cache-Control "no-cache";
    }
    
    # Static files cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Deploy Steps

```bash
# 1. Build
./scripts/build-tunetalks.sh

# 2. Upload to server
rsync -avz --delete webapp/ user@server:/var/www/tunetalks-web/

# 3. Reload nginx
ssh user@server "sudo systemctl reload nginx"
```

## 🐛 Troubleshooting

### Build Fails

```bash
# Clean everything
rm -rf node_modules yarn.lock
yarn cache clean
yarn install
```

### Port 8080 Already in Use

```bash
# Kill existing process
lsof -ti:8080 | xargs kill -9

# Or use different port
PORT=3000 yarn start
```

### Assets Not Loading

- Check file paths in config
- Verify webpack build output
- Clear browser cache
- Check nginx/web server logs

## 📚 Documentation Links

- [Full Customization Guide](TUNETALKS_CUSTOMIZATION_GUIDE.md)
- [Element Web Docs](docs/)
- [Matrix Specification](https://spec.matrix.org/)

## 🆘 Support

- Technical Issues: https://github.com/your-org/tunetalks-web/issues
- Matrix Room: #tunetalks-dev:tunetalks.com
- Email: support@tunetalks.com
