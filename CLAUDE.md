# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clap Element Web** is a customized fork of Element Web (v1.12.2) for the Clap messenger platform. Element Web is a Matrix protocol client - a decentralized, end-to-end encrypted messaging platform similar to Telegram or WhatsApp, but open-source and self-hosted.

- **Base**: Element Web v1.12.2
- **Branch**: `clap-stable` (main development branch for Clap customizations)
- **Homeserver**: dev.clap.ac (dev), clap.ac (production)
- **Stack**: React 19, TypeScript, Webpack 5, Matrix JS SDK 39.0.0

## Core Architecture

### Three-Layer Architecture

1. **Matrix JS SDK** (`matrix-js-sdk` v39.0.0)
   - Core Matrix protocol implementation
   - Handles client-server communication, E2E encryption, room state
   - Lives in `node_modules/matrix-js-sdk` (or linked for local dev)
   - All Matrix API calls go through this layer

2. **Element Web** (this repository)
   - React UI layer built on top of matrix-js-sdk
   - Business logic, state management, UI components
   - Located in `src/` directory

3. **Clap Customizations**
   - Branding changes ("Element" → "Clap")
   - Korean localization (default country: KR)
   - Configuration in `config.clap.json`
   - Deployment infrastructure for AWS EKS

### Key Directories

```
src/
├── components/          # React components (views and structures)
│   ├── views/          # Isolated UI components (e.g., EventTile, RoomList)
│   └── structures/     # High-level app structures (e.g., MatrixChat, RoomView)
├── stores/             # State management (singleton pattern, NOT Redux)
├── dispatcher/         # Flux-style event dispatcher
├── utils/              # Utility functions
├── hooks/              # React custom hooks
├── i18n/              # Internationalization (counterpart library)
├── contexts/          # React contexts
└── vector/            # Element-specific initialization code

res/
├── css/               # PostCSS stylesheets (NOT SCSS)
├── themes/            # Theme definitions (light, dark, etc.)
└── img/               # Images and icons

k8s/                   # Kubernetes deployment manifests
├── deployment.yaml    # EKS deployment configuration
├── service.yaml       # ClusterIP service
└── ingress.yaml       # AWS ALB ingress
```

### Component Organization

- **Views**: Small, reusable UI components (e.g., buttons, tiles, dialogs)
- **Structures**: Large, app-level components that compose views (e.g., MatrixChat, LeftPanel)
- File naming: UpperCamelCase (e.g., `EventTile.tsx`, `RoomList.tsx`)
- Hierarchy: `src/components/views/rooms/EventTile.tsx` (2-level: type/category)

### State Management

**Stores use singleton pattern** (NOT Redux):
```typescript
class FooStore {
    public static readonly instance = new FooStore();
    // or lazy initialization with private static _instance
}
```

- Stores subscribe to dispatcher events
- Components access stores via `.instance` property
- Flux-style unidirectional data flow

### CSS Architecture (PostCSS, not SCSS)

- **PostCSS** with plugins (looks like SCSS but isn't)
- Class naming: `mx_ComponentName` prefix (e.g., `mx_EventTile`)
- Nested elements: `mx_EventTile_avatar`, `mx_EventTile_body`
- One CSS file per component: `_ComponentName.pcss`
- Theme support: CSS custom properties (variables)

## Development Commands

### Setup and Build

```bash
# First-time setup
yarn install
cp config.clap.json config.json  # Use Clap configuration

# Development server (http://localhost:8080)
yarn start                        # Runs webpack-dev-server with hot reload
yarn start:https                  # HTTPS development server

# Production build
yarn build                        # Builds to webapp/ directory
yarn dist                         # Creates deployable tarball (not supported on Windows)

# Clean build artifacts
yarn clean                        # Removes lib/ and webapp/ directories
```

### Development with matrix-js-sdk

To work on matrix-js-sdk and Element Web simultaneously:

```bash
# In matrix-js-sdk directory
git clone https://github.com/matrix-org/matrix-js-sdk.git
cd matrix-js-sdk
yarn link
yarn install

# In element-web directory
yarn link matrix-js-sdk
yarn install
yarn start
```

Changes to matrix-js-sdk will be automatically picked up by webpack.

### Testing

```bash
# Unit tests (Jest + JSDOM)
yarn test                         # Run all tests
yarn coverage                     # Run tests with coverage report

# End-to-end tests (Playwright)
yarn test:playwright              # Run E2E tests
yarn test:playwright:open         # Open Playwright UI for debugging
yarn test:playwright:screenshots  # Visual regression tests

# Linting and type checking
yarn lint                         # Run all linters
yarn lint:js                      # ESLint + Prettier
yarn lint:js-fix                  # Auto-fix linting issues
yarn lint:types                   # TypeScript type checking
yarn lint:style                   # Stylelint for CSS
```

### Single Test Execution

```bash
# Run a single Jest test file
yarn test src/path/to/test.test.ts

# Run a specific test suite/case
yarn test -t "test name or describe block"

# Run a single Playwright test
yarn test:playwright tests/path/to/test.spec.ts

# Run Playwright test in headed mode (see browser)
yarn test:playwright tests/path/to/test.spec.ts --headed
```

### Internationalization

```bash
# Full i18n workflow (extract strings + sort + lint + generate types)
yarn i18n                         # Run when adding new _t() calls in code

# Quick type generation only (when manually adding keys to JSON)
yarn i18n:types                   # Fast (~0.6s) - updates TypeScript types only

# Check translation differences
yarn i18n:diff                    # Compare with baseline
```

**Translation Key Workflow**:

| Scenario | Command | Time |
|----------|---------|------|
| Added `_t()` call in code | `yarn i18n` | ~2-3s |
| Manually added key to JSON | `yarn i18n:types` | ~0.6s |
| Modified shared-components | `cd packages/shared-components && yarn prepare` | ~30s |

**Important**: Translation keys must exist in `src/i18n/strings/en_EN.json` and TypeScript types must be regenerated for the `_t()` function to recognize new keys.

## Clap Deployment

### Configuration

Clap-specific settings in `config.clap.json`:
```json
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://dev.clap.ac",
      "server_name": "dev.clap.ac"
    }
  },
  "brand": "Clap",
  "default_country_code": "KR",
  "show_labs_settings": true
}
```

### Docker Build

```bash
# Local Docker build
docker build -t clap-element-web .
docker run -p 8080:80 clap-element-web

# Access at http://localhost:8080
```

### Kubernetes Deployment

**GitHub Actions** (Recommended):
- Workflow: `.github/workflows/clap-deploy-eks.yml`
- Manual trigger via GitHub Actions UI
- Environments: dev, staging, production
- Builds ARM64 image for AWS Graviton EKS nodes

**Manual Deployment**:
```bash
# Configure kubectl for EKS
aws eks update-kubeconfig --region ap-northeast-2 --name clap-eks-dev

# Apply manifests
kubectl apply -f k8s/deployment.yaml -n clap
kubectl apply -f k8s/service.yaml -n clap
kubectl apply -f k8s/ingress.yaml -n clap

# Check deployment status
kubectl rollout status deployment/element-web -n clap
kubectl get pods -l app=element-web -n clap

# View logs
kubectl logs -l app=element-web -n clap --tail=100 -f

# Rollback if needed
kubectl rollout undo deployment/element-web -n clap
```

**Deployment Targets**:
- **Dev**: app.dev.clap.ac (auto-deploy on push to `clap-stable`)
- **Staging**: app.staging.clap.ac (manual approval)
- **Production**: app.clap.ac (manual approval)

## Code Style Requirements

### TypeScript/JavaScript

- **Formatting**: Prettier (automatic via `yarn lint:js-fix`)
- **Line length**: 120 characters
- **Indentation**: 4 spaces
- **Semicolons**: Required (except interfaces, classes, non-arrow functions)
- **Quotes**: Double quotes (single quotes if string contains double quotes)
- **Imports**: Named exports only (avoid `export default`)
- **Types**: Always explicit, avoid `any` (comment explaining why if necessary)
- **Variables**: `const` for constants, `let` for mutability
- **Naming**:
  - lowerCamelCase: functions, variables
  - UpperCamelCase: classes, interfaces, types, components
  - No `I` prefix for interfaces

### React Components

- **Prefer functional components with hooks** over class components
- Class components must have `Props` and `State` interfaces (defined above component)
- One component per file (except small utility components)
- Component file naming: UpperCamelCase (e.g., `EventTile.tsx`)
- CSS class naming: `mx_ComponentName` (must match component name)
- No `forceUpdate()` usage
- Derive from props over establishing state when possible

### CSS (PostCSS)

- File naming: `_ComponentName.pcss` (matches component name)
- Class naming: `mx_ComponentName` prefix strictly enforced
- Nested elements: `mx_ComponentName_elementName` (lowerCamelCase)
- Use `$font` variables instead of hardcoded values
- Maximum nesting: 5 levels
- Document magic numbers with comments (z-index, pixel adjustments, etc.)
- Avoid `!important` (comment why if necessary)

### Testing

- **Unit tests**: Required for all new features and bug fixes
- **Coverage target**: ≥80% for new code
- **Test file location**: `/test` directory (mirrors `/src` structure)
- **E2E tests**: Required for user-facing features before leaving labs
- **Test naming**: `it("should...")`  convention
- **Structure**:
  ```typescript
  describe("ComponentName", () => {
    beforeEach(() => { /* setup */ });
    afterEach(() => { /* cleanup */ });
    it("should do something", async () => {
      // test-specific variables
      // function calls/state changes
      // expectations
    });
  });
  ```

## Important Development Notes

### Matrix SDK Integration

- **Dependency**: `matrix-js-sdk` v39.0.0 (pinned in package.json)
- **Import pattern**: `import { Client } from "matrix-js-sdk"`
- **Client instance**: Access via `MatrixClientPeg.get()` singleton
- **Room state**: Always accessed through SDK, never cached manually
- **Events**: Subscribe to SDK events via `client.on(event, handler)`

### Bundle Structure

Webpack splits code into:
- **Vendor bundle**: React, matrix-js-sdk, third-party libraries
- **Theme bundles**: Separate CSS bundles for each theme
- **Code-split chunks**: Lazy-loaded features (e.g., call UI, settings)
- **Service worker**: For offline support (in `src/serviceworker/`)

### Performance Considerations

- **Lazy loading**: Use React.lazy() for large components
- **Memoization**: Use React.memo() and useMemo() for expensive renders
- **Virtualization**: Use `react-virtuoso` for long lists (e.g., room list, timeline)
- **Bundle size**: Monitor with `yarn analyse:webpack-bundles`

### Security Constraints

- **No external CDNs**: All dependencies must be bundled (offline requirement)
- **CSP headers**: Configure via server (X-Frame-Options, Content-Security-Policy)
- **XSS prevention**: Sanitize user content (use `sanitize-html` library)
- **Separate domains**: Never host Element on same domain as homeserver

### Common Gotchas

- **inotify limits on Linux**: May need to increase file watch limits
  ```bash
  sudo sysctl fs.inotify.max_user_watches=131072
  sudo sysctl fs.inotify.max_user_instances=512
  ```
- **Mac file limits**: Run `ulimit -Sn 1024` before building
- **Windows**: `yarn dist` not supported, use `yarn build` instead
- **PostCSS vs SCSS**: Our `.pcss` files look like SCSS but use PostCSS plugins
- **Component cycles**: Utilities requiring JSX must be separate from non-JSX utilities

## Pull Request Guidelines

- **Target branch**: Always PR to `develop` (NOT `main` or `clap-stable`)
- **Squash merging**: Preferred (keep PR number in commit message)
- **Commit messages**: Descriptive, focus on "why" not "what"
- **Changelogs**: Auto-generated from PR title and `Notes:` in description
- **Labels**: Required for changelog categorization
  - `T-Enhancement`: New feature (minor version bump)
  - `T-Defect`: Bug fix
  - `T-Task`: No user-facing changes (no changelog entry)
  - `X-Breaking-Change`: Breaking change (major version bump)
- **Before/after screenshots**: Required for UI changes
- **Testing strategy**: Include step-by-step testing instructions

## Updating Element Web

To merge upstream Element Web changes:

```bash
# Add upstream if not already added
git remote add upstream https://github.com/element-hq/element-web.git

# Fetch latest tags
git fetch upstream --tags

# Merge new version into clap-stable
git checkout clap-stable
git merge v1.x.x

# Resolve conflicts (especially config files, branding)
# Test thoroughly
# Push to trigger deployment
```

**Key conflict areas**:
- `config.clap.json` vs upstream config changes
- Branding strings in `src/`
- Theme customizations in `res/`
- `CLAP_README.md` vs upstream `README.md`

## Related Repositories

- **clap-synapse**: Matrix Synapse homeserver (backend)
- **clap-infrastructure**: AWS infrastructure as code (Terraform)
- **ClapAndroid**: Android native client
- **element-desktop**: Desktop wrapper (upstream Electron app)

## Clap Developer Flags System

팀 개발자 전용 기능을 플래그로 제어하는 시스템. 로컬 스토리지에 저장되며 서버에 동기화되지 않음.

### 관련 파일

| 파일 | 역할 |
|------|------|
| `src/settings/ClapDeveloperFlags.ts` | 플래그 정의 (중앙 집중식) |
| `src/hooks/useSettings.ts` | `useDeveloperFlag()` 훅 |
| `src/utils/ClapDevFlagsConsole.ts` | 콘솔 API (`window.mxDevFlags`) |
| `src/settings/Settings.tsx` | `clapDeveloperFlags` 설정 |

### 새 플래그 추가 방법

`src/settings/ClapDeveloperFlags.ts`에 키 추가:
```typescript
export const CLAP_DEV_FLAGS = {
    showCustomHomeserver: "다른 홈서버 등록 UI 표시",
    newFeature: "새 기능 설명",  // 추가
} as const;
```

### 컴포넌트에서 사용

```typescript
import { useDeveloperFlag } from "../hooks/useSettings";

const MyComponent = () => {
    const isEnabled = useDeveloperFlag("showCustomHomeserver");
    if (!isEnabled) return null;
    return <SomeUI />;
};
```

### 콘솔에서 토글 (F12)

```javascript
mxDevFlags.help()                         // 도움말
mxDevFlags.enable("showCustomHomeserver") // 켜기
mxDevFlags.disable("showCustomHomeserver") // 끄기
mxDevFlags.list()                         // 현재 상태
```

### UI에서 토글

1. Settings > Labs 탭
2. Developer Mode 활성화 필요 (DevTools에서)
3. "Clap Developer Flags" 섹션에서 토글

### 현재 적용된 플래그

- `showCustomHomeserver`: `/login`, `/register` 페이지의 ServerPicker 컴포넌트 표시/숨김 (`src/components/views/elements/ServerPicker.tsx`)
