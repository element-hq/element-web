# Tunetalks Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TUNETALKS WEB                             │
│                    (Custom Element Web)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Frontend   │  │    Theme     │  │   Assets     │          │
│  │    React     │  │  Tunetalks   │  │   Logos &    │          │
│  │  TypeScript  │  │    Colors    │  │    Icons     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │              Matrix JS SDK                          │         │
│  │        (Protocol Implementation)                    │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Matrix Protocol (HTTPS/WSS)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MATRIX HOMESERVER                               │
│              (matrix.tunetalks.com)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Synapse    │  │   Database   │  │    Redis     │          │
│  │  or Dendrite │  │  PostgreSQL  │  │   (Cache)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
Internet
   │
   ▼
┌──────────────────────────────────────────────────────┐
│              Load Balancer / CDN                      │
│              (CloudFlare / AWS)                       │
└──────────────────────────────────────────────────────┘
   │
   ├────────────────────┬─────────────────────────────┐
   │                    │                             │
   ▼                    ▼                             ▼
┌─────────┐      ┌─────────────┐            ┌─────────────┐
│  Web    │      │  Homeserver │            │   Jitsi     │
│ Server  │      │   (Matrix)  │            │   Server    │
│ (Nginx) │      │             │            │  (Video)    │
└─────────┘      └─────────────┘            └─────────────┘
   │                    │                             │
   │                    │                             │
tunetalks.com    matrix.tunetalks.com    meet.tunetalks.com
```

## Component Structure

```
element-web/
│
├── src/
│   ├── vector/
│   │   ├── index.html              ← Title: "Tunetalks"
│   │   └── index.ts                ← App initialization
│   │
│   ├── components/                 ← React components
│   │   ├── structures/             ← Layout components
│   │   ├── views/                  ← UI components
│   │   └── utils/                  ← Utility components
│   │
│   └── i18n/                       ← Internationalization
│       └── strings/
│           ├── en_EN.json          ← English strings
│           └── vi.json             ← Vietnamese strings
│
├── res/
│   ├── vector-icons/               ← App icons (24-512px)
│   │   ├── 24.png                  ← Tunetalks icons
│   │   ├── 120.png
│   │   └── ...
│   │
│   ├── img/                        ← Images & logos
│   │   └── tunetalks-logo.svg     ← Brand logo
│   │
│   ├── themes/
│   │   ├── light/                  ← Default light theme
│   │   ├── dark/                   ← Default dark theme
│   │   └── tunetalks/              ← Custom Tunetalks theme
│   │       ├── css/
│   │       │   └── tunetalks.pcss  ← Theme styles
│   │       └── img/
│   │           └── logos/          ← Theme assets
│   │
│   └── manifest.json               ← PWA manifest
│
├── config.tunetalks.json           ← Tunetalks configuration
├── .env.tunetalks                  ← Environment variables
│
└── custom-assets/
    └── tunetalks/                  ← Source assets
        ├── logos/
        ├── icons/
        ├── backgrounds/
        └── themes/
```

## Build Process Flow

```
┌──────────────┐
│  Source Code │
│   (src/)     │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   Webpack    │────▶│  TypeScript  │
│   Bundler    │     │   Compiler   │
└──────┬───────┘     └──────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────┐      ┌──────────┐     ┌──────────┐
│   JS     │      │   CSS    │     │  Assets  │
│ Bundles  │      │  Themes  │     │  (copy)  │
└────┬─────┘      └────┬─────┘     └────┬─────┘
     │                 │                 │
     └────────┬────────┴─────────────────┘
              │
              ▼
       ┌──────────────┐
       │   webapp/    │
       │  (output)    │
       └──────┬───────┘
              │
              ├────────────────┬──────────────┐
              │                │              │
              ▼                ▼              ▼
        ┌──────────┐     ┌──────────┐  ┌──────────┐
        │  Docker  │     │   Nginx  │  │   CDN    │
        │  Image   │     │  Server  │  │  Upload  │
        └──────────┘     └──────────┘  └──────────┘
```

## Configuration Flow

```
config.tunetalks.json
        │
        ├─────────────────┬─────────────────┬──────────────┐
        │                 │                 │              │
        ▼                 ▼                 ▼              ▼
   ┌────────┐      ┌──────────┐     ┌──────────┐   ┌──────────┐
   │ Brand  │      │Homeserver│     │  Theme   │   │ Features │
   │  Name  │      │   URL    │     │  Config  │   │   Flags  │
   └────────┘      └──────────┘     └──────────┘   └──────────┘
        │                 │                 │              │
        └─────────────────┴─────────────────┴──────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  App Runtime  │
                    │  (SdkConfig)  │
                    └───────────────┘
```

## Theme Customization Flow

```
colors.json
    │
    ▼
┌─────────────────┐
│ Brand Colors    │
│ #0DBD8B, etc.   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ tunetalks.pcss  │
│ CSS Variables   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│   PostCSS       │────▶│   Webpack    │
│   Processing    │     │   Bundle     │
└─────────────────┘     └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │theme-tune... │
                        │    .css      │
                        └──────────────┘
```

## User Authentication Flow

```
User Browser
    │
    ▼
┌──────────────────┐
│  Tunetalks Web   │
│  Login Page      │
└────────┬─────────┘
         │
         │ POST /login
         ▼
┌──────────────────┐
│ Matrix Homeserver│
│matrix.tunetalks  │
└────────┬─────────┘
         │
         │ Access Token
         ▼
┌──────────────────┐
│  Tunetalks Web   │
│  Main Interface  │
└────────┬─────────┘
         │
         │ Matrix Sync API
         ▼
┌──────────────────┐
│ Real-time Events │
│  Messages, Calls │
└──────────────────┘
```

## Asset Loading Sequence

```
Page Load
    │
    ├─────────┬──────────┬──────────┬──────────┐
    │         │          │          │          │
    ▼         ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ HTML │ │ CSS  │ │  JS    │ │ Fonts  │ │ Icons  │
└──┬───┘ └──┬───┘ └───┬────┘ └───┬────┘ └───┬────┘
   │        │         │          │          │
   │  config.json     │          │          │
   │        │         │          │          │
   └────────┴─────────┴──────────┴──────────┘
                  │
                  ▼
           ┌────────────┐
           │ App Ready  │
           │ Tunetalks  │
           └────────────┘
```

## Matrix Protocol Integration

```
┌────────────────────────────────────────────────────┐
│              Tunetalks Web Client                   │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         Matrix JS SDK                        │  │
│  ├──────────────────────────────────────────────┤  │
│  │                                              │  │
│  │  - Room Management                           │  │
│  │  - Message Sending/Receiving                 │  │
│  │  - User Authentication                       │  │
│  │  - End-to-End Encryption                     │  │
│  │  - VoIP Signaling                            │  │
│  │                                              │  │
│  └────────────┬─────────────────────────────────┘  │
│               │                                     │
└───────────────┼─────────────────────────────────────┘
                │
                │ HTTPS + WebSocket
                │ (Matrix C-S API)
                │
┌───────────────▼─────────────────────────────────────┐
│          Matrix Homeserver                          │
│       (matrix.tunetalks.com)                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  - User Management                                  │
│  - Room State Storage                               │
│  - Message Persistence                              │
│  - Federation with other servers                    │
│  - Push Notifications                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Security Layers

```
┌──────────────────────────────────────────────────┐
│            Security Layers                        │
├──────────────────────────────────────────────────┤
│                                                   │
│  Layer 1: HTTPS/TLS                               │
│  ▪ SSL Certificates                               │
│  ▪ Encrypted Transport                            │
│                                                   │
│  Layer 2: Content Security Policy                │
│  ▪ CSP Headers                                    │
│  ▪ X-Frame-Options                                │
│  ▪ X-Content-Type-Options                         │
│                                                   │
│  Layer 3: Matrix Protocol                        │
│  ▪ User Authentication                            │
│  ▪ Access Tokens                                  │
│  ▪ Room Permissions                               │
│                                                   │
│  Layer 4: End-to-End Encryption                  │
│  ▪ Olm/Megolm Protocols                          │
│  ▪ Device Verification                            │
│  ▪ Key Backup                                     │
│                                                   │
└──────────────────────────────────────────────────┘
```

## Monitoring & Logging

```
┌──────────────────────────────────────────────────┐
│         Monitoring Stack (Optional)               │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Sentry   │  │ Prometheus │  │   Grafana  │ │
│  │   Error    │  │  Metrics   │  │  Dashboard │ │
│  │  Tracking  │  │ Collection │  │            │ │
│  └────────────┘  └────────────┘  └────────────┘ │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │          Application Logs                  │  │
│  │  - User Actions                            │  │
│  │  - API Calls                               │  │
│  │  - Errors & Warnings                       │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

**Notes:**
- All diagrams use ASCII art for maximum compatibility
- Each component can be independently scaled
- Security is implemented at multiple layers
- Monitoring is optional but recommended for production
