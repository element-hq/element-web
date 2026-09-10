# Plan: a full end-to-end call test in Element Web (Element Call React component)

Element Web (EW) has Playwright coverage for Element Call (EC) only with stand-ins: a fake widget page
and a mock React component. Nothing in the suite ever carries media. This plan adds **one real call
between two users, through the real `ElementCall` React component, against a real MatrixRTC backend
(Synapse + LiveKit + lk-jwt-service)**, in Element Web's own Playwright suite.

Decision (2026-09-04): the full call is tested here, against the exact bundle Element Web ships. This is
Step 8 of [element-call-react-plan.md](./element-call-react-plan.md).

## Status (2026-09-04): implemented and green locally

Everything in sections 2–4 is in place and the spec passes on Chrome, both against `pnpm start` (dev bundle,
about 40 s) and against a production build served with `npx serve` (about 16 s):

| Piece                    | Path                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Spec                     | `apps/web/playwright/e2e/voip/element-call-full-call.spec.ts`                      |
| LiveKit container        | `apps/web/playwright/testcontainers/livekit.ts`                                    |
| lk-jwt-service container | `apps/web/playwright/testcontainers/lk-jwt-service.ts`                             |
| Backend + Synapse config | `apps/web/playwright/testcontainers/matrix-rtc.ts`                                 |
| Federation TLS cert      | `apps/web/playwright/testcontainers/res/matrix-rtc/tls.{crt,key}` (self-signed)    |
| Fixtures                 | `apps/web/playwright/services.ts` (`matrixRTC` option, `matrixRTCBackend` fixture) |

Run it with `pnpm test:playwright --project=Chrome playwright/e2e/voip/element-call-full-call.spec.ts`.
Both images are pinned by digest in the same `image:tag@sha256:…` form Renovate already tracks for
`**/testcontainers/*.ts`. Deviations from the plan below and what getting it green turned up:

- **matrix-js-sdk had to move forward.** Element Web and Element Call both depend on
  `matrix-js-sdk#develop`, but Element Web's lockfile pinned a snapshot (`84fb28a`) without
  `MatrixRTCSession.isKeyRotationSuppressed`. The component passes that getter's value as the initial value
  of a `Behavior`; `undefined` hits the default parameter and the scope throws
  `Behavior failed to synchronously emit an initial value` right after `START CALL VIEW SCOPE`, which the
  error boundary shows as "Something went wrong". `pnpm update matrix-js-sdk` (now `e16b0bcc`) fixed it and
  pulled `matrix-widget-api` to `^1.19.0` with it (the new SDK's `embedded.ts` needs it). Worth reporting to
  EC: guard the initial value (`?? false`) or declare the minimum SDK the component needs.
- **Power levels.** A room created through the raw `createRoom` API keeps the default power level 50 for
  `org.matrix.msc3401.call.member`, so Bob's join button rendered disabled ("You do not have permission").
  Element Web's own room creation sets it to 0; the spec passes the same `power_level_content_override`.
- **Bob is in the room before the call starts.** In the first version Bob logged in after Alice had joined,
  and his room header never offered the join button even though his client logged the session's one
  membership. Element Web's `CallStore` only learns about sessions that start while it is running
  (`SessionStarted`), so a call already in progress at login is not surfaced. The spec now has Bob viewing
  the room first; the join-after-login case is a separate Element Web bug to look at.
- **Verifying against a production build locally.** `pnpm build` served a cached output from Nx after the
  dependency bump (`--skip-nx-cache` fixes that), and the dev server writes its bundle into `webapp/`
  (`writeToDisk`), so a build has to be copied elsewhere before serving it. The config route in
  `playwright-common` is hard-wired to port 8080, so a build served on another port needs a temporary
  route override; the checked-in spec relies on the standard fixture.
- **Noise that is not a failure.** The component's sounds are refused by Element Web's CSP
  (`connect-src` has no `data:`), `setE2EEEnabled` logs an error for unencrypted rooms, and Element Web
  warns about `RoomState.members` listeners. None of it affects the call.

## 1. What exists today

### Element Web

- `apps/web/playwright/e2e/voip/element-call.spec.ts` is the only call spec. Synapse runs via
  testcontainers with `matrix_rtc.transports` pointing at a dummy URL. The widget transport is stubbed
  by `sample-files/fake-element-call.html`; the React transport renders the mock component
  (`Developer.elementCallMockComponent`, set in `beforeEach`). One smoke test mounts the real
  component but stops at the lobby: no LiveKit, no media. `pstn.spec.ts` is unrelated.
- The homeserver stack comes from `@element-hq/element-web-playwright-common`
  (`packages/playwright-common` in this monorepo): worker-scoped fixtures `network`, `_homeserver`,
  `homeserver`, plus the `synapseConfig` worker option. `SynapseContainer.withConfig()` shallow-merges
  into a YAML written at start; the client port is mapped to a free host port, `baseUrl` is
  `http://localhost:<port>`, `server_name` is `localhost`, the container has the network alias
  `homeserver`. `routeConfigJson(context, …)` serves `config.json` per browser context and
  `populateLocalStorageWithCredentials(page, creds)` logs a page in without UI. Both are exported.
- `apps/web/playwright/services.ts` already extends those fixtures (`homeserverType`, Dendrite,
  Pinecone) and skips tests that need Synapse config on other homeservers.
- CI (`.github/workflows/build-and-test.yaml`, job `playwright_ew`): `ubuntu-24.04`, Docker available
  (testcontainers already in use), the browser runs on the runner itself (no
  `PW_TEST_CONNECT_WS_ENDPOINT`), `npx serve ./webapp`, `workers: 1`, sharded across machines. The
  Chrome project has fake media devices (`--use-fake-device-for-media-stream`) and the `microphone`
  permission, but not `camera`.

### Element Call repository (what the setup is based on)

- `docker-compose-dev.yml` + `docker-compose-playwright.yml` + `backend/`: Synapse
  (`playwright_homeserver.yaml`), `lk-jwt-service:0.4.4`, `livekit-server:v1.13.4`, an **nginx TLS
  proxy** with checked-in `*.m.localhost` certificates, and an Element Web container. The proxy exists
  because lk-jwt-service verifies OpenID tokens over the federation API, which is HTTPS-only.
- `playwright/widget/*` + `fixtures/widget-user.ts` + `widget/test-helpers.ts`: the shape of a
  two-user EW call test. Users are registered through the Synapse admin API, the call starts via
  "Video call" → "Element Call", joins via `lobby_joinCall`, the second user joins from the room, both
  leave via `incall_leave`, and the composer becoming visible again is the "call ended" signal.
  `spa-helpers.expectVideoTilesCount` checks `videoTile` count and that "Waiting for media..." is gone.
- M1 worktree (`../element-call-component-m1`): `playwright/component/component-call.spec.ts` +
  `harness.ts` hold a real call between two components and assert `videoTile` count 2. The component
  build carries the test ids we need: `lobby_joinCall`, `videoTile`, `incall_leave`, `name_tag`.
- lk-jwt-service (`~/Projects/lk-jwt-service`, v0.6.0, Rust, multi-arch image): `/sfu/get` resolves
  the token's `matrix_server_name` via `https://<name>/.well-known/matrix/server`, falls back to
  `https://<name>:8448`, and calls `/_matrix/federation/v1/openid/userinfo`. TLS verification can be
  disabled (`LIVEKIT_INSECURE_SKIP_VERIFY_TLS`). `LIVEKIT_URL` is used both for its own Twirp calls
  to the SFU and as the URL handed to clients. Its own e2e suite (`e2e-tests/docker`) is the model we
  follow: **no nginx**, Synapse with a native TLS federation listener on 8448 and self-signed certs,
  network alias equal to `server_name`, `LIVEKIT_CS_API_URL_OVERRIDES=<server_name>=http://<alias>:8008`.

## 2. Where it lives

| Piece                           | Path                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Spec                            | `apps/web/playwright/e2e/voip/element-call-full-call.spec.ts`                                 |
| LiveKit container               | `apps/web/playwright/testcontainers/livekit.ts`                                               |
| lk-jwt-service container        | `apps/web/playwright/testcontainers/lk-jwt-service.ts`                                        |
| Backend bundle + Synapse config | `apps/web/playwright/testcontainers/matrix-rtc.ts` (`startMatrixRTCBackend(network, logger)`) |
| Self-signed federation cert     | `apps/web/playwright/testcontainers/res/matrix-rtc/tls.crt`, `tls.key`                        |
| Fixtures                        | `apps/web/playwright/services.ts` (worker option `matrixRTC`, fixture `matrixRTCBackend`)     |

- A **separate spec file**, not an addition to `element-call.spec.ts`: it needs a different worker
  (extra containers, different Synapse config) and must not switch the mock on. The existing spec
  stays as it is.
- Containers live **in `apps/web`**, next to `dendrite.ts` and `mas.ts`, not in `playwright-common`.
  Nothing else consumes them yet; moving them to the shared package is a follow-up once
  element-desktop or the modules suite want a call.
- The certificate is checked in, as EC (`backend/dev_tls_*`) and lk-jwt-service
  (`e2e-tests/docker/certs`) do. Generated once with
  `openssl req -x509 -newkey rsa:2048 -nodes -days 36500 -subj /CN=homeserver -keyout tls.key -out tls.crt`.
  Verification is disabled on the jwt side, so the CN does not matter.

## 3. Backend: three containers on the worker network, no proxy

Started by the `matrixRTCBackend` worker fixture, only for workers whose tests set
`test.use({ matrixRTC: true })`. Order matters because each one needs the previous one's host port.

### 3.1 LiveKit — `livekit/livekit-server:v1.13.4` (pin the digest, as `synapse.ts` does)

Config copied into the container with `withCopyContentToContainer`:

```yaml
port: 7880
bind_addresses: ["0.0.0.0"]
rtc:
    tcp_port: 7891
    udp_port: 7892 # single-port UDP mux instead of a range
    use_external_ip: false
    node_ip: 127.0.0.1 # advertise loopback: the browser reaches the SFU through the published ports
keys: { devkey: secret }
room: { auto_create: false }
webhook:
    api_key: devkey
    urls: ["http://lk-jwt-service:8080/sfu_webhook"]
```

- Ports: `7880` → free host port (signalling, HTTP + WebSocket). `7891/tcp` and `7892/udp` published
  **1:1** (`{ container: 7891, host: 7891 }`, `{ container: 7892, host: 7892, protocol: "udp" }`):
  the SFU advertises its configured port numbers in ICE candidates, so they must be identical on the
  host. Deliberately not `7881`/`7882`, so a running EC dev backend does not collide.
- `node_ip: 127.0.0.1` is what makes this work on macOS as well as Linux CI. Without it LiveKit
  advertises its container IP, which only Linux hosts can route to. livekit-client tries UDP and
  falls back to ICE over TCP (`7891`) on its own.
- Network alias `livekit`. Wait strategy: HTTP `GET /` on 7880 returns `OK`.

### 3.2 lk-jwt-service — `ghcr.io/element-hq/lk-jwt-service:v0.6.0` (multi-arch: amd64 + arm64)

```
LIVEKIT_URL=ws://livekit.localhost:<livekitHostPort>
LIVEKIT_KEY=devkey
LIVEKIT_SECRET=secret
LIVEKIT_FULL_ACCESS_HOMESERVERS=*
LIVEKIT_INSECURE_SKIP_VERIFY_TLS=YES_I_KNOW_WHAT_I_AM_DOING
LIVEKIT_CS_API_URL_OVERRIDES=homeserver=http://homeserver:8008
```

- `withExtraHosts([{ host: "livekit.localhost", ipAddress: "host-gateway" }])`. Inside the container
  `livekit.localhost` resolves to the Docker host, where LiveKit's published port is; in Chromium and
  Firefox every `*.localhost` name resolves to loopback, where the same published port is. So **one
  `LIVEKIT_URL` is valid both for the service's own calls to the SFU and in the token it hands to the
  browser**. This replaces EC's nginx + `/etc/hosts` + certificate exceptions.
- The CS API override is what the service uses for delayed-leave delegation calls
  (`/_matrix/client/unstable/org.matrix.msc4140/delayed_events`). lk-jwt-service's own e2e config uses
  a plain `http://` override, so no TLS is needed on that path.
- Port `8080` → free host port (`<jwtHostPort>`). Network alias `lk-jwt-service`. Wait strategy:
  HTTP `GET /healthz`.

### 3.3 Synapse — the existing `SynapseContainer`, extra config from the fixture

Applied in the `_homeserver` override in `services.ts` when `matrixRTCBackend` is present, so the
`homeserver` fixture in `playwright-common` starts it exactly as it does today:

```yaml
server_name: homeserver # == the network alias, so https://homeserver:8448 is where the jwt service ends up
listeners:
    - {
          port: 8008,
          tls: false,
          type: http,
          x_forwarded: true,
          bind_addresses: ["::"],
          resources: [{ names: [client], compress: false }],
      }
    - {
          port: 8448,
          tls: true,
          type: http,
          bind_addresses: ["0.0.0.0"],
          resources: [{ names: [federation], compress: false }],
      }
tls_certificate_path: /data/tls.crt # copied in with withCopyContentToContainer
tls_private_key_path: /data/tls.key
experimental_features:
    msc4143_enabled: true # /rtc/transports
    msc3266_enabled: true
    msc4222_enabled: true
    msc4354_enabled: true # sticky events; harmless in EC's default "compatibility" mode, needed for matrix_2_0
max_event_delay_duration: 24h # MSC4140 delayed events, used for the leave event
rc_delayed_event_mgmt: { per_second: 10000, burst_count: 10000 }
matrix_rtc:
    transports:
        - type: livekit
          livekit_service_url: http://localhost:<jwtHostPort>
```

- `withConfig` merges **shallowly**, so `listeners` must include the default 8008 client listener,
  and `experimental_features` is given in full.
- `server_name: homeserver` is the one visible change: users become `@user_…:homeserver`. Only this
  spec sees them. Keeping `localhost` is impossible: the jwt service would resolve
  `https://localhost:8448` to its own loopback.
- `public_baseurl` stays `http://localhost:<port>`, set by `SynapseContainer.start()`.

### 3.4 Who talks to whom (browser on the host, containers on the worker network)

| From → To                        | Address                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Element Web → Synapse            | `http://localhost:<synapsePort>` (as today); `/rtc/transports` yields the jwt URL |
| EC component → lk-jwt-service    | `http://localhost:<jwtHostPort>/sfu/get` with the OpenID token                    |
| lk-jwt-service → Synapse         | `https://homeserver:8448/_matrix/federation/v1/openid/userinfo` (TLS, unverified) |
| lk-jwt-service → LiveKit (Twirp) | `ws://livekit.localhost:<livekitHostPort>` via `host-gateway`                     |
| Browser → LiveKit signalling     | `ws://livekit.localhost:<livekitHostPort>`                                        |
| Browser → LiveKit media          | ICE candidates `127.0.0.1:7892/udp`, `127.0.0.1:7891/tcp`                         |

### 3.5 Fixture wiring (`apps/web/playwright/services.ts`)

```ts
export interface WorkerOptions extends BaseWorkerOptions {
    homeserverType: HomeserverType;
    /** Start LiveKit + lk-jwt-service and point Synapse's `matrix_rtc.transports` at them. */
    matrixRTC: boolean;
}
export interface Services extends BaseServices {
    oAuthServer?: OAuthServer;
    matrixRTCBackend?: StartedMatrixRTCBackend; // { livekit, jwtService, synapseConfig, tlsFiles, stop() }
}

matrixRTC: [false, { option: true, scope: "worker" }],
matrixRTCBackend: [
    async ({ matrixRTC, network, logger }, use) => {
        if (!matrixRTC) return use(undefined);
        const backend = await startMatrixRTCBackend(network, logger); // livekit → jwt, returns synapse config
        await use(backend);
        await backend.stop();
    },
    { scope: "worker" },
],
_homeserver: [
    async ({ homeserverType, matrixRTCBackend }, use) => {
        // …existing switch…
        if (matrixRTCBackend && container instanceof SynapseContainer) {
            container.withConfig(matrixRTCBackend.synapseConfig).withCopyContentToContainer(matrixRTCBackend.tlsFiles);
        }
        await use(container);
    },
    { scope: "worker" },
],
```

Playwright fixtures are lazy: workers that never use `matrixRTC: true` never pull or start the two
images. The spec itself adds `test.skip(({ homeserverType }) => homeserverType !== "synapse", …)`
because the automatic `synapseConfig` skip does not see config applied this way.

## 4. The test: one happy path, two real participants

Keep it to a single test that proves media flows in both directions through Element Web's own
mounting path. Everything else (PiP mid-call, encryption, leave/ban) is a follow-up.

```ts
test.use({
    matrixRTC: true,
    displayName: "Alice",
    config: { features: { feature_element_call_react: true } }, // real component: Developer.elementCallMockComponent stays false
    permissions: ["microphone", "camera"],
});
test.skip(({ homeserverType }) => homeserverType !== "synapse", "Needs Synapse matrix_rtc config");

test(
    "two users hold a call through the Element Call component",
    { tag: ["@no-firefox", "@no-webkit"] },
    async ({ page, app, user, homeserver, browser, config }) => {
        test.slow();

        // Bob: a second logged-in Element Web in its own browser context, same recipe as the `user` fixture
        const bob = await homeserver.registerUser("bob", "password", "Bob");
        const bobContext = await browser.newContext({
            permissions: ["microphone", "camera"],
        });
        const bobPage = await bobContext.newPage();
        await routeConfigJson(bobContext, homeserver.baseUrl, config);
        await populateLocalStorageWithCredentials(bobPage, bob);

        // A plain (unencrypted) room with both in it
        const roomId = await app.client.createRoom({
            name: "Call room",
            invite: [bob.userId],
        });
        await homeserver.csApi.request("POST", `/v3/join/${roomId}`, bob.accessToken, {});

        // Alice starts the call: no iframe, the component's lobby renders, she joins
        await app.viewRoomById(roomId);
        await page.getByRole("button", { name: "Video call" }).click();
        await page.getByRole("menuitem", { name: "Element Call" }).click();
        await expect(page.locator("iframe")).toHaveCount(0);
        await page.getByTestId("lobby_joinCall").click(); // page-level: the tile lives in the persisted root on <body>
        await expect(page.getByTestId("videoTile")).toHaveCount(1);

        // Bob sees the ongoing call in the room and joins from the lobby
        await bobPage.goto(`/#/room/${roomId}`);
        await bobPage.waitForSelector(".mx_MatrixChat");
        // dismiss "Verify this device" / "Notifications" toasts as element-call.spec.ts does
        await bobPage.getByTestId("join-call-button").click();
        await bobPage.getByTestId("lobby_joinCall").click();

        // Both see two tiles carrying media (EC's expectVideoTilesCount, inlined)
        for (const p of [page, bobPage]) {
            await expect(p.getByTestId("videoTile")).toHaveCount(2, {
                timeout: 30_000,
            });
            await expect(p.getByText("Waiting for media...")).toHaveCount(0, {
                timeout: 10_000,
            });
            await expect(p.locator("video").filter({ visible: true })).toHaveCount(2);
        }

        // Bob leaves; Alice sees him go; Alice leaves; the room view is back
        await bobPage.getByTestId("incall_leave").click();
        await expect(page.getByTestId("videoTile")).toHaveCount(1);
        await page.getByTestId("incall_leave").click();
        await expect(page.locator(".mx_BasicMessageComposer")).toBeVisible();
        await expect(page.getByTestId("join-call-button")).not.toBeVisible();
    },
);
```

Notes:

- Alice reuses the standard `user`/`app` fixtures. Bob is built from the same three exported
  building blocks the `user` fixture uses (`registerUser`, `routeConfigJson`,
  `populateLocalStorageWithCredentials`), so no new page object is needed. The `config` fixture is
  passed through so both contexts get the same `feature_element_call_react: true`.
- All EC locators are **page-level**, not scoped to `.mx_CallView`: the tile renders into
  `PersistedElement`'s root attached to `<body>` (finding from the react plan, Step 7).
- Intents: Alice gets `start_call` (lobby shown), Bob `join_existing` via the header button (lobby
  shown). The toast path uses `skipLobby`, which the test avoids so both sides go through
  `lobby_joinCall`.
- The room is unencrypted, so `perParticipantE2EE` is false. An encrypted-room variant is the first
  follow-up once this is green.
- `camera` is requested at spec level so the Chrome project config stays untouched. Fake devices come
  from the existing launch args.
- Firefox and WebKit are tagged out for now. Firefox would need `media.navigator.streams.fake` and a
  camera pref in `playwright.config.ts` (EC's config has them); WebKit has no fake devices.

## 5. CI

- No workflow change: `playwright_ew` already runs Docker, and the two extra images are pulled only
  by the worker that runs this spec (roughly a minute). Pin both images by digest in the container
  classes and add them to `playwright-image-updates.yaml` alongside Synapse.
- Fixed host ports `7891/tcp` and `7892/udp`: safe with `workers: 1`; shards run on separate machines.
- Dendrite and Pinecone projects skip the spec (Synapse-only config).

## 6. Prerequisite and order of work

**Prerequisite:** `@element-hq/element-call-component` is a git dependency on
`github:element-hq/element-call#valere/component_ec_M1&path:/component` (since 2026-09-04; before that a
machine-local `link:`). CI can build the real component chunk once the EC branch carries the component
manifest commit and the lockfile has been regenerated (see "Switch `@element-hq/element-call-component` to a
remote dependency" under "Follow up tasks" in the react plan, which also says when to point the ref at
`main`). The backend and spec can be written and run locally before that; they cannot go green in CI until
it is done.

1. ✅ Certificate, `livekit.ts`, `lk-jwt-service.ts`, `matrix-rtc.ts`, and the `services.ts` fixtures.
   Smoke it without a browser: start the fixture from a throwaway spec, take an OpenID token via
   `homeserver.csApi` and `POST /sfu/get` to the jwt host port; a 200 with a LiveKit JWT proves the
   TLS federation hop and the `host-gateway` hop both work.
2. ✅ The spec, Chrome only:
   `pnpm test:playwright --project=Chrome playwright/e2e/voip/element-call-full-call.spec.ts`.
3. ✅ Pin digests (Renovate's regex manager covers them; there is no separate image-update workflow in this
   monorepo).
4. Follow-ups, each its own small change: encrypted room; switch rooms mid-call and assert the tile
   count stays 2 in PiP (media survives `PersistedElement` moves); Firefox; move the containers to
   `packages/playwright-common` if another suite wants a call.

## 7. Known risks

- **UDP through Docker's port proxy** on macOS can be flaky; ICE over TCP on `7891` is the automatic
  fallback. If both fail on CI, `withNetworkMode("host")` for LiveKit on Linux is the escape hatch.
- **Component quirks already known from Step 7** of the react plan: `contentLoaded` is never called
  (EW's `MarkReadyOnMount` covers it) and call sounds fail to `fetch(data:)` under EW's CSP (logged,
  not fatal). Neither blocks the call.
- **Synapse `develop` digest**: `matrix_rtc` and the MSC flags above are all in current Synapse; if a
  future digest bump renames a flag, only this spec's config breaks, not the rest of the suite.
