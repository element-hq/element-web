# 🔗 Connect Tunetalks với GitHub & Figma

Hướng dẫn đầy đủ để setup Git, push lên GitHub, và connect với Figma.

---

## 📋 Prerequisites

✅ Git installed: `git --version`  
✅ GitHub account: [github.com](https://github.com)  
✅ Figma account: [figma.com](https://figma.com)

---

## 🚀 Part 1: Git Setup & Push to GitHub

### Step 1: Configure Git (One-time)

```bash
# Set your name and email
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify
git config --global --list
```

### Step 2: Initialize Git (If not done)

```bash
# Initialize repository
git init

# Set default branch to main
git branch -M main
```

### Step 3: Add Tunetalks Files

```bash
# Add all Tunetalks documentation
git add TUNETALKS*.md

# Add configuration files
git add config.tunetalks.json
git add .env.tunetalks
git add Dockerfile.tunetalks
git add docker-compose.tunetalks.yml

# Add scripts
git add scripts/build-tunetalks*.sh
git add scripts/deploy-tunetalks-assets.sh

# Add custom assets
git add custom-assets/tunetalks/

# Add Cloudflare configs
git add public/_headers
git add public/_redirects

# Check what's staged
git status
```

### Step 4: Create Initial Commit

```bash
git commit -m "Initial Tunetalks setup

- Add comprehensive documentation
- Add Cloudflare Pages deployment
- Add build and deployment scripts
- Add brand identity specifications
- Configure domain: tunetalks.me
- Ready for production deployment"
```

### Step 5: Create GitHub Repository

**Option A: Via Web Interface** ⭐ Recommended

1. Go to: https://github.com/new
2. Fill in:
   - **Repository name:** `tunetalks-web`
   - **Description:** `Tunetalks - Secure Matrix Chat App based on Element Web`
   - **Visibility:** Public or Private
   - **DO NOT** check "Initialize with README"
3. Click **"Create repository"**

**Option B: Via GitHub CLI**

```bash
# Install gh CLI: brew install gh
gh auth login
gh repo create tunetalks-web --public --description "Tunetalks - Secure Matrix Chat App"
```

### Step 6: Add Remote & Push

```bash
# Replace YOUR_USERNAME with your GitHub username
GITHUB_USERNAME="your-username"

# Add remote
git remote add origin https://github.com/$GITHUB_USERNAME/tunetalks-web.git

# Push to GitHub
git push -u origin main
```

### Step 7: Verify

```bash
# Check remote
git remote -v

# Visit your repository
open "https://github.com/$GITHUB_USERNAME/tunetalks-web"
```

---

## 🎨 Part 2: Connect Figma to GitHub

### Why Connect Figma?

✅ **Design Handoff** - Developers get specs directly from Figma  
✅ **Version Control** - Track design changes alongside code  
✅ **Code Generation** - Generate code from Figma components  
✅ **Design Tokens** - Sync colors, typography, spacing  
✅ **Documentation** - Auto-update design docs

### Option 1: Figma Dev Mode (Recommended)

**Requirements:** Figma Professional or higher

1. **Open your Figma file**
   - Use the diagrams we created earlier, or
   - Create new design file for Tunetalks

2. **Enable Dev Mode**
   - Click "Dev Mode" toggle (top right)
   - Or press `Shift + D`

3. **Connect to GitHub**
   - Click "Plugins" → "GitHub"
   - Or install: https://www.figma.com/community/plugin/761379599544322950/GitHub
   - Authorize Figma to access GitHub
   - Select repository: `tunetalks-web`

4. **Link Design to Code**
   - Select components in Figma
   - Click "Link to code"
   - Choose file in GitHub repo
   - Map component to code

### Option 2: Figma Code Connect

**Setup Code Connect mapping:**

```typescript
// Example: Map Figma button to React component
// docs/figma-code-connect/Button.figma.tsx

import { figma } from '@figma/code-connect'
import { Button } from '../../src/components/views/elements/Button'

figma.connect(Button, 'https://figma.com/file/...?node-id=123:456', {
  props: {
    variant: figma.enum('Variant', {
      primary: 'primary',
      secondary: 'secondary',
    }),
    label: figma.string('Label'),
  },
  example: ({ variant, label }) => (
    <Button variant={variant}>{label}</Button>
  ),
})
```

### Option 3: Figma Webhooks + GitHub Actions

**Automate design-to-code workflow:**

1. **Setup Figma Webhook**
   - Figma Settings → Webhooks
   - Add webhook URL: `https://your-server.com/figma-webhook`
   - Select events: File updates, comments

2. **Create GitHub Action**

```yaml
# .github/workflows/figma-sync.yml
name: Sync Figma Designs

on:
  repository_dispatch:
    types: [figma-update]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Fetch Figma Design Tokens
        run: |
          # Use Figma API to fetch design tokens
          curl -H "X-Figma-Token: ${{ secrets.FIGMA_TOKEN }}" \
               "https://api.figma.com/v1/files/${{ secrets.FIGMA_FILE_KEY }}" \
               -o figma-design.json
      
      - name: Convert to CSS Variables
        run: |
          # Convert Figma colors to CSS
          node scripts/figma-to-css.js
      
      - name: Commit Changes
        run: |
          git config user.name "Figma Sync Bot"
          git config user.email "bot@tunetalks.me"
          git add res/themes/tunetalks/
          git commit -m "Update design tokens from Figma"
          git push
```

---

## 🔧 Part 3: Figma API Integration

### Get Figma Personal Access Token

1. Go to: https://www.figma.com/settings
2. Scroll to "Personal access tokens"
3. Click "Generate new token"
4. Name: "Tunetalks Dev"
5. Copy token (save securely!)

### Add to GitHub Secrets

```bash
# Via GitHub CLI
gh secret set FIGMA_TOKEN --body "your-figma-token"

# Or via web:
# Repository → Settings → Secrets → Actions → New secret
```

### Test Figma API

```bash
# Get file info
FIGMA_TOKEN="your-token"
FIGMA_FILE_KEY="your-file-key"

curl -H "X-Figma-Token: $FIGMA_TOKEN" \
     "https://api.figma.com/v1/files/$FIGMA_FILE_KEY" | jq
```

---

## 🎨 Part 4: Use Figma Designs in Development

### Figma to Code Tools

1. **Figma to React** (Plugin)
   - Install: https://www.figma.com/community/plugin/959043285816860985
   - Select component → Generate React code

2. **Anima** (Plugin)
   - Install: https://www.figma.com/community/plugin/857346721138427857
   - Export to React, Vue, HTML

3. **Quest** (AI-powered)
   - https://www.quest.ai/
   - Convert Figma designs to React components

### Export Design Tokens

```bash
# Install figma-tokens CLI
npm install -g @tokens-studio/figma-tokens

# Export from Figma
figma-tokens export \
  --file-key $FIGMA_FILE_KEY \
  --token $FIGMA_TOKEN \
  --output custom-assets/tunetalks/themes/tokens.json
```

### Sync Colors Automatically

```javascript
// scripts/sync-figma-colors.js
const fetch = require('node-fetch');
const fs = require('fs');

async function syncColors() {
  const response = await fetch(
    `https://api.figma.com/v1/files/${process.env.FIGMA_FILE_KEY}`,
    {
      headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN }
    }
  );
  
  const data = await response.json();
  
  // Extract colors from styles
  const colors = {};
  Object.entries(data.styles).forEach(([id, style]) => {
    if (style.styleType === 'FILL') {
      colors[style.name] = style.color;
    }
  });
  
  // Update colors.json
  fs.writeFileSync(
    'custom-assets/tunetalks/themes/colors.json',
    JSON.stringify({ colors }, null, 2)
  );
  
  console.log('✅ Colors synced from Figma');
}

syncColors();
```

---

## 🔄 Part 5: Continuous Integration

### Auto-deploy on Design Updates

```yaml
# .github/workflows/deploy-on-design-update.yml
name: Deploy on Figma Update

on:
  repository_dispatch:
    types: [figma-design-updated]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - name: Install Dependencies
        run: yarn install
      
      - name: Sync Figma Assets
        run: node scripts/sync-figma-colors.js
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}
      
      - name: Build
        run: ./scripts/build-tunetalks-cloudflare.sh
      
      - name: Deploy to Cloudflare
        run: wrangler pages publish webapp --project-name=tunetalks
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 📊 Part 6: Design System Documentation

### Auto-generate from Figma

```bash
# Install Figma Doc Generator
npm install -g @figma-export/cli

# Configure
cat > .figmaexportrc.json << 'EOF'
{
  "fileId": "YOUR_FIGMA_FILE_KEY",
  "token": "$FIGMA_TOKEN",
  "output": {
    "components": "docs/design-system/components",
    "styles": "docs/design-system/styles"
  }
}
EOF

# Export
figma-export styles
figma-export components
```

### Create Design System Site

```bash
# Install Storybook
npx storybook init

# Add Figma addon
yarn add -D storybook-addon-designs

# Configure .storybook/main.js
module.exports = {
  addons: ['storybook-addon-designs'],
};

# Add Figma links to stories
export default {
  title: 'Components/Button',
  parameters: {
    design: {
      type: 'figma',
      url: 'https://figma.com/file/...',
    },
  },
};
```

---

## ✅ Verification Checklist

### Git & GitHub
- [ ] Git initialized
- [ ] Files committed
- [ ] Remote added
- [ ] Pushed to GitHub
- [ ] Repository accessible online

### Figma Integration
- [ ] Figma account created
- [ ] Design files created
- [ ] GitHub plugin installed
- [ ] Repository connected
- [ ] Components linked

### Automation (Optional)
- [ ] Figma token generated
- [ ] GitHub secrets configured
- [ ] Webhooks setup
- [ ] GitHub Actions working
- [ ] Auto-sync tested

---

## 🚀 Quick Commands Reference

```bash
# Git Setup
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/tunetalks-web.git
git push -u origin main

# Update & Push
git add .
git commit -m "Update description"
git push

# Check Status
git status
git log --oneline
git remote -v

# Figma Export
figma-export styles --file-key YOUR_KEY --token YOUR_TOKEN
```

---

## 📖 Resources

### GitHub
- [GitHub Docs](https://docs.github.com)
- [GitHub Actions](https://docs.github.com/actions)
- [GitHub CLI](https://cli.github.com/)

### Figma
- [Figma Dev Mode](https://help.figma.com/hc/en-us/articles/360055203533)
- [Figma API](https://www.figma.com/developers/api)
- [Figma Plugins](https://www.figma.com/community/plugins)
- [Code Connect](https://www.figma.com/blog/code-connect/)

### Tools
- [Figma to React](https://www.figma.com/community/plugin/959043285816860985)
- [Style Dictionary](https://amzn.github.io/style-dictionary/)
- [Figma Tokens](https://tokens.studio/)

---

## 💡 Tips & Best Practices

### Git
1. **Commit often** - Small, focused commits
2. **Write good messages** - Explain why, not what
3. **Use branches** - Feature branches for development
4. **Pull before push** - Avoid conflicts
5. **Ignore large files** - Use .gitignore

### Figma
1. **Organize layers** - Clear naming conventions
2. **Use components** - Reusable design elements
3. **Document styles** - Color names, token system
4. **Version control** - Use Figma's version history
5. **Share early** - Get feedback from developers

### Integration
1. **Automate sync** - Reduce manual work
2. **Test changes** - Preview before production
3. **Document process** - Team onboarding easier
4. **Monitor builds** - Check GitHub Actions logs
5. **Iterate quickly** - Design → Code → Deploy

---

## 🆘 Troubleshooting

### Git Issues

**Issue:** `fatal: not a git repository`
```bash
Solution: git init
```

**Issue:** `remote origin already exists`
```bash
Solution: 
git remote remove origin
git remote add origin https://github.com/USER/REPO.git
```

**Issue:** `Permission denied (publickey)`
```bash
Solution: Setup SSH key or use HTTPS with token
https://docs.github.com/en/authentication
```

### Figma Issues

**Issue:** "Cannot connect to GitHub"
```bash
Solution:
1. Check Figma plugin permissions
2. Re-authorize GitHub access
3. Verify repository exists
```

**Issue:** "Invalid Figma token"
```bash
Solution:
1. Generate new token in Figma settings
2. Update GitHub secret
3. Verify token has not expired
```

---

## ✨ Summary

Bạn đã setup:
1. ✅ Git repository initialized
2. ✅ Code committed with good structure
3. ✅ Ready to push to GitHub
4. ✅ Figma integration guide ready
5. ✅ Automation workflows documented

**Next Steps:**
1. Create GitHub repository
2. Push code: `git push -u origin main`
3. Create Figma designs
4. Connect Figma to GitHub
5. Start iterating!

---

*Happy Coding & Designing! 🚀*

*Last updated: January 14, 2026*
