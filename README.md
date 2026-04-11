# element-tor

> A fork of [Element Desktop](https://github.com/element-hq/element-web) that routes all network traffic through Tor natively and transparently.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

---

## What is element-tor?

element-tor is Element Desktop with Tor baked in. On launch, the app:

1. Starts a bundled Tor daemon (no system Tor required)
2. Waits for full bootstrap (0% → 100%) before opening the UI
3. Routes **all** app traffic through a SOCKS5h proxy — including DNS, preventing leaks
4. Kills Tor cleanly on exit

No configuration required. No system dependencies. Just run the app.

---

## ⚠️ Limitations

| Feature | Status | Reason |
|---|---|---|
| Text messaging | ✅ Full support | TCP over Tor |
| File transfers | ✅ Full support | TCP over Tor |
| Element Call (video/audio) | ❌ Blocked | WebRTC uses UDP, incompatible with Tor SOCKS5 |
| VoIP calls (1-to-1) | ❌ Blocked | Same reason |

Any attempt to open an Element Call URL is intercepted and blocked to protect your anonymity.

---

## Requirements

| Platform | Requirement |
|---|---|
| Linux | x64, glibc ≥ 2.17 |
| macOS | x64 or arm64, macOS 10.15+ |
| Windows | x64, Windows 10+ |

No system Tor installation needed — Tor is bundled.

---

## Quick Install (one-liner)

### Linux / macOS
```bash
curl -sSL https://raw.githubusercontent.com/Gvte-Kali/element-tor/feature/tor-integration/install.sh | bash
```

### Windows (PowerShell, run as Administrator)
```powershell
irm https://raw.githubusercontent.com/Gvte-Kali/element-tor/feature/tor-integration/install.ps1 | iex
```

---

## Build from source

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- Git

```bash
# Clone
git clone https://github.com/Gvte-Kali/element-tor.git
cd element-tor
git checkout feature/tor-integration

# Install dependencies
corepack enable
pnpm install

# Extract Tor binaries
bash apps/desktop/scripts/extract-tor.sh

# Build webapp
pnpm --filter element-web build

# Package the app (Linux x64)
cd apps/desktop
cp -r ../web/webapp .
pnpm asar-webapp
pnpm electron-builder --linux --x64
```

Build output: `apps/desktop/dist/`

For other platforms:
```bash
pnpm electron-builder --mac --x64    # macOS Intel
pnpm electron-builder --mac --arm64  # macOS Apple Silicon
pnpm electron-builder --win --x64    # Windows
```

---

## Development

```bash
# Extract Tor binaries (first time only)
bash apps/desktop/scripts/extract-tor.sh

# Build and run in dev mode
pnpm --filter element-web build      # build webapp (first time only)
pnpm --filter element-desktop start  # launch Electron
```

Tor bootstrap logs appear in the terminal during startup. The app window opens only after Tor reaches 100%.

---

## Architecture
apps/
├── desktop/
│   ├── src/
│   │   ├── electron-main.ts   # Electron entry point
│   │   ├── TorService.ts      # Tor lifecycle manager (spawn, bootstrap, proxy)
│   │   └── TorSplash.ts       # Bootstrap splash screen
│   ├── 3rd-party/tor/
│   │   ├── linux-x64/         # tor binary + bundled libs
│   │   ├── mac-x64/
│   │   ├── mac-arm64/
│   │   └── win-x64/
│   └── scripts/
│       └── extract-tor.sh     # Downloads Tor Expert Bundle from torproject.org
└── web/                       # Element webapp (unmodified)

**Key design decisions:**

- Tor binaries are extracted from the official [Tor Expert Bundle](https://www.torproject.org/download/tor/) — not compiled, not third-party
- `SOCKS5h` proxy (not SOCKS5) — DNS resolution happens inside Tor, preventing DNS leaks
- TorService lives exclusively in the Electron main process — never exposed to the renderer
- Bundled libs (`libevent`, `libssl`, `libcrypto`) ship alongside the binary — no system library dependencies

---

## Configuring your homeserver

Edit `apps/web/webapp/config.json`:

```json
{
    "default_server_config": {
        "m.homeserver": {
            "base_url": "http://your-onion-address.onion:8448",
            "server_name": "your-onion-address.onion:8448"
        }
    },
    "brand": "element-tor"
}
```

For maximum anonymity, use a Matrix homeserver reachable via `.onion` address.

---

## Security notes

- All traffic is routed through Tor before any UI is shown
- DNS resolution is handled by Tor (`SOCKS5h`) — no local DNS leaks
- WebRTC / Element Call is blocked at the Electron level
- The Tor control port (19051) uses cookie authentication
- Tor data directory is stored in the OS temp folder and cleared on each run

---

## Credits

- [Element](https://element.io) — the Matrix client this is based on
- [The Tor Project](https://www.torproject.org) — Tor daemon and Expert Bundle
- [TryQuiet/quiet](https://github.com/TryQuiet/quiet) — reference implementation for bundling Tor in Electron

---

## License

AGPL-3.0 — same as Element. See [LICENSE](LICENSE).