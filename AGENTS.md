# Element Web Agent Instructions

## Quick Start

```bash
cd apps/web
cp config.sample.json config.json
pnpm install
pnpm start
```

Dev server runs at `http://127.0.0.1:8080/`. Requires Node >= 22.18 and pnpm 10.33.0.

## Key Commands

| Command                         | Location | Description                                |
| ------------------------------- | -------- | ------------------------------------------ |
| `pnpm start`                    | apps/web | Dev server with hot reload                 |
| `pnpm test`                     | apps/web | Jest unit tests                            |
| `pnpm run test:playwright`      | apps/web | E2E tests (requires Docker)                |
| `pnpm run test:playwright:open` | apps/web | Playwright UI                              |
| `pnpm lint`                     | root     | Full lint (types, prettier, eslint, style) |
| `pnpm lint:types`               | root     | TypeScript check                           |
| `pnpm lint:prettier`            | root     | Format check                               |
| `pnpm lint:knip`                | root     | Dead code analysis                         |

## Development Setup

1. **matrix-js-sdk linking**: Create `.link-config` in apps/web:

    ```
    matrix-js-sdk=/path/to/matrix-js-sdk
    ```

    Then clone and build matrix-js-sdk separately.

2. **Linux inotify limits**: Increase limits before `pnpm start`:
    ```bash
    sudo sysctl fs.inotify.max_user_watches=131072
    sudo sysctl fs.inotify.max_user_instances=512
    ```

## Architecture

- `apps/web` - Main web application (Element)
- `apps/desktop` - Electron desktop app
- `packages/shared-components` - Reusable UI components (published to npm)
- `packages/playwright-common` - Shared E2E test utilities

### Directory Structure (apps/web/src)

| Path                     | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `vector/`                | App entry points (platform, routing, lifecycle)   |
| `components/views/`      | UI views (rooms, dialogs, settings, auth, spaces) |
| `components/structures/` | Page-level structures (RoomView, Timeline, etc.)  |
| `components/viewmodels/` | View models (legacy)                              |
| `stores/`                | State management (RoomStore, SpaceStore, etc.)    |
| `dispatcher/`            | Event dispatcher/actions                          |
| `hooks/`                 | React hooks                                       |
| `utils/`                 | Utility functions                                 |
| `settings/`              | Settings system (handlers, controllers, watchers) |
| `actions/`               | Redux-style actions                               |
| `i18n/`                  | Internationalization                              |
| `modules/`               | SDK modules integration                           |
| `widgets/`               | Widget system                                     |
| `integrations/`          | Integration managers                              |
| `notifications/`         | Notification system                               |
| `rageshake/`             | Bug reporting                                     |
| `usercontent/`           | User content iframe                               |
| `workers/`               | Web Workers (blurhash, playback, indexeddb)       |

### Key Entry Points

- `src/index.ts` - Browser entry (imports matrix-js-sdk)
- `src/Lifecycle.ts` - App initialization/cleanup
- `src/MatrixClientPeg.ts` - Global matrix client accessor
- `src/dispatcher/dispatcher.ts` - App event dispatcher

## Testing

- **Unit tests**: `pnpm test` in apps/web (Jest)
- **E2E tests**: Playwright with testcontainers (Synapse/Dendrite)
    - Requires: `pnpm playwright install --with-deps`
    - Run specific test: `pnpm run test:playwright playwright/e2e/path/to/test.spec.ts`
- **Screenshot tests**: `pnpm run test:playwright:screenshots` (runs in Docker)

## Code Style

- **CSS**: PostCSS (\*.pcss) in apps/web, CSS modules in packages/shared-components
- **Styling**: Use Compound Design Tokens (`var(--cpd-*)`) for new code
- **Class naming**: `mx_*` prefix for PostCSS, semantic names for CSS modules
- **Formatting**: Prettier, 120 char line limit, 4-space indent

## Branches

- `develop` - Default branch, base for PRs
- `staging` - Release branch
- PRs only against `develop`

## Important Files

- `docs/config.md` - Configuration options
- `docs/playwright.md` - E2E testing guide
- `developer_guide.md` - Full dev setup guide
- `code_style.md` - Detailed code conventions
