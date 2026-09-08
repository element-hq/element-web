# Element Call as a React component in Element Web

Element Call (EC) runs in Element Web (EW) as a widget in an iframe. Behind the labs flag
`feature_element_call_react` it is instead mounted as an in-process React component, the `ElementCall`
export of `@element-hq/element-call-component` (element-hq/element-call#4233). This document describes
what that changes in the EW codebase and why it is built the way it is. The evaluation of alternatives is
in [element-call-react-options.md](./element-call-react-options.md); the full-call Playwright setup in
[element-call-e2e-call-plan.md](./element-call-e2e-call-plan.md).

## Why a component, and why on top of `AppTile`

**Why a component.** One process and one `MatrixClient`: EC uses EW's client and MatrixRTC session
directly instead of re-implementing Matrix access over the widget driver and `postMessage`. Configuration
and control become props and callbacks rather than URL parameters and widget actions. The iframe lifecycle
(load waiting, capability negotiation, permission prompts, "widget died" heuristics) goes away, and EC can
follow EW's theme live. It also enables things an iframe cannot do, such as moving the running call into a
browser Document Picture-in-Picture window.

**Why on top of `AppTile`.** Almost everything EW does _around_ a call is keyed on the call's virtual
widget, not on the iframe: `ActiveWidgetStore` (docking, persistence, liveness), `PersistedElement`
(surviving navigation), `PipContainer` / `WidgetPipViewModel` (the floating PiP and the maximise/minimise
toggle), `RoomViewStore` (`view_call`, voice calls straight into PiP), `CallStore`, `WidgetStore`, the
incoming-call toasts, the room header call buttons, timeline call tiles and room list indicators. Replacing
the widget abstraction would mean rewriting all of that. Instead:

- the **virtual call widget stays as the call's identity** (its id is the persist key, the
  `ActiveWidgetStore` key and the PiP candidate), and
- a **new tile with `AppTile`'s props** renders `<ElementCall …/>` where `AppTile` would render an iframe,
  reproducing the parts of `AppTile`'s lifecycle that are not about iframes.

Everything listed above keeps working unchanged; the diff is confined to the tile, a control-plane seam in
the `ElementCall` model, and build plumbing. The iframe path is untouched and remains the default; with
the flag on, only Element Call widgets take the new path (other widgets always use `AppTile`).

## The component API

```tsx
await initializeElementCall(configOptions); // once per page load, before the first render

<ElementCall
    client={client} // EW's MatrixClient; EC resolves the MatrixRTCSession from roomId itself
    roomId={roomId}
    intent={UserIntent.StartNewCall} // what the user asked for; EC derives defaults from it
    config={{ perParticipantE2EE, skipLobby, background, … }} // EW's overrides on top of those defaults
    hostBridge={bridge} // EC → EW: ElementCallHostBridge callbacks
    ref={handleRef} // EW → EC: ElementCallHandle (hangUp, join, setDeviceMute, setTheme)
    theme={theme} // live props
    language={language}
/>;
```

The build is an ES module that externalises `react`, `react-dom`, `matrix-js-sdk` (and its `lib/*`
subpaths) and `livekit-client`; the host must provide exactly one copy of each. It ships one stylesheet,
scoped by EC's build to `[data-element-call-root]`. English is bundled in; every other locale is a lazy chunk
of the component, loaded when the `language` prop first asks for it. `intent` and `config` are
compared by value; a change to them makes EC leave and rejoin the call, so they are decided once per call
(see [Configuration](#configuration)).

## How it fits together

```
CallView (docked)  ──┐                                   ┌─ PersistedElement (persistKey = widget uid)
PersistentApp (PiP) ─┴─► CallAppTile ─► ElementCallAppTile ┤     └─ HostedElementCall
                          │ flag off: AppTile (iframe)     │           ├─ <ElementCall …/>  (real or mock, lazy)
                          └───────────────────────────────►┘           └─ MarkReadyOnMount

ElementCall component ── ElementCallHostBridge ──► ElementCall model (handleJoined/handleHangup/…, markReady)
ElementCall model ──── ElementCallHandle (ref) ──► ElementCall component (hangUp)
```

- **`CallAppTile`** (`views/voip/CallTile.tsx`) is the single decision point between the transports; it reads
  the flag at render time. `CallView` uses it directly; `PersistentApp` uses it for `WidgetType.CALL` widgets
  and `AppTile` otherwise.
- **`ElementCallAppTile`** decides _where_ the call is shown (docked or floating) and owns the widget-store
  lifecycle. Every tile of a call renders the same `HostedElementCall` inside the same `PersistedElement`,
  so switching containers does not disturb the component.
- **`HostedElementCall`** lives in the persisted root for the whole call, whichever tile shows it (or none,
  while the call is in a browser PiP window). It is where live inputs are read: the effective theme, the
  language, the bridge, and the frozen `intent`/`config` from the model.
- **Control plane** is the model's, shared by both transports: the widget action handlers acknowledge the
  widget request and call `handleJoined()` etc.; the bridge calls them directly.

## Changes by area

### Settings (`settings/Settings.tsx`)

| Setting                              | Purpose                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature_element_call_react`         | Labs flag (VoiceAndVideo, device level, config-prioritised) choosing the transport. `ReloadOnChangeController`: a mounted call cannot switch transports.              |
| `Developer.elementCallMockComponent` | Device-level devtools setting: with the flag on, render the mock component instead of the real one. Used by Playwright and for development without a LiveKit backend. |

The two are independent switches: transport (widget vs React) × stand-in (real vs mock).

### `ElementCallAppTile` (`views/voip/ElementCallAppTile.tsx`)

Typed with `CallTileProps` (`AppTile`'s props with its `defaultProps` optional) so it is a compile-checked
drop-in. It uses `app`, `room`, `miniMode`, `fullWidth`, `pointerEvents`, `overlay`, `movePersistedElement`;
it ignores the iframe/menubar props and `stickyPromise` (the bridge hangs up other calls itself). It finds
its call through `useCall(room.roomId)` and renders nothing unless it is an `ElementCall` whose widget id
matches `app.id`.

What it reproduces from `AppTile`:

| Behaviour                      | Implementation                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persist across navigation      | `PersistedElement` with `persistKey = getPersistKey(getWidgetUid(app))`, z-index 9 docked / 101 mini, `moveRef={movePersistedElement}`                                                                                                                                                                                                                                     |
| Dock / undock                  | `dockWidget` on mount, `undockWidget` on unmount, only when `!miniMode`                                                                                                                                                                                                                                                                                                    |
| Teardown on unmount            | If `!ActiveWidgetStore.isLive(app.id, roomId)` → `endCall()`: `PersistedElement.destroyElement`, `destroyPersistentWidget`, and `call.handleClose()` if connected (nobody can report a hang-up any more). The check is deferred by one tick and cancelled if the effect re-runs, so React StrictMode's simulated unmount/remount in development does not destroy the call. |
| Leave / ban                    | `RoomEvent.MyMembership` (leave/ban) and `Action.AfterLeaveRoom`: not viewing the room → `endCall()`, otherwise `destroyPersistentWidget`                                                                                                                                                                                                                                  |
| Classes                        | `mx_AppTile` / `mx_AppTile_mini` / `mx_AppTileFullWidth`, body `mx_AppTileBody --large/--mini --call`, so `_AppsDrawer.pcss` applies unchanged                                                                                                                                                                                                                             |
| Messaging, permissions, popout | Not reproduced                                                                                                                                                                                                                                                                                                                                                             |

Both components are `lazy()` chunks (`element-call-component` with its CSS, `element-call-mock`) loaded
through `loadElementCall`, which awaits `initializeElementCall(ElementCall.getConfigOptions(transports))`
once before the first render. `MarkReadyOnMount` calls `call.markReady()` when the component mounts,
because EC's component build does not call `contentLoaded()` itself yet (only its standalone app does).

### Control plane: `ElementWebHostBridge` and the model seam

`views/voip/ElementWebHostBridge.ts` implements `ElementCallHostBridge`. It is stateless (one instance per
call via `useMemo`, but EC forwards to whichever bridge it was last given), and each callback maps onto
what `WidgetMessaging` plus the model's widget action handlers do today:

| Bridge member               | Widget equivalent                                                 | Bridge does                                                                                                |
| --------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `contentLoaded()`           | `WidgetMessaging` ready / `Call.start()` messaging wait           | `call.markReady()`                                                                                         |
| `notifyJoined()`            | `io.element.join` → `setConnected()`                              | `call.handleJoined()`                                                                                      |
| `notifyHungUp()`            | `im.vector.hangup` → `setDisconnected()`                          | `call.handleHangup()`                                                                                      |
| `close()`                   | `io.element.close` → `setDisconnected(); close()`                 | `call.handleClose()`                                                                                       |
| `notifyDeviceMute(state)`   | `io.element.device_mute` (ack only)                               | `call.handleDeviceMute(state)` (no-op; EW does not track mute)                                             |
| `setAlwaysOnScreen(bool)`   | `UpdateAlwaysOnScreen` → `stickyPromise` → `setWidgetPersistence` | Disconnect every other connected call (what `CallView`'s `stickyPromise` did), then `setWidgetPersistence` |
| `allowJoinUnmutedViaIntent` | widget host: `true` (the client chose the intent)                 | `true`: EW chose the intent, so a call that skips the lobby may start unmuted on its strength              |
| `supportsReactions`         | reactions capability                                              | `true`                                                                                                     |

The other direction, EW → EC, goes through the component's `ElementCallHandle`, registered on the model with
`call.setComponentHandle` as the `ref` (a stable function, so React only clears it when the component itself
unmounts, not when one tile replaces another). Only `hangUp()` is used; `join`/`setDeviceMute` are not
needed and the theme is a prop.

In `models/Call.ts` the `ElementCall` model gains:

- `static usesReactComponent` (reads the flag);
- `handleJoined/handleHangup/handleClose/handleDeviceMute`: the bodies of the former `onJoin/onHangup/
onClose/onDeviceMute`, which are now thin ack-and-forward wrappers;
- a `ready` deferred and `markReady()`; `start()` on the React path skips URL generation and `widgetApi`
  handler registration and instead awaits `ready` with the same 16 s timeout, returning `null`
  (`Promise<ClientWidgetApi | null>`; `RoomViewStore` ignores the value);
- `componentHandle`/`setComponentHandle`; `performDisconnection()` on the React path awaits
  `componentHandle.hangUp()` with the same timeout and fails immediately if no component is mounted;
- `componentOptions`, the frozen `intent`/`config` (below);
- `close()` resets `ready` and the frozen options so a later `start()` waits for a fresh component;
  `destroy()` drops the handle.

`Call.onStopMessaging` ("widget died → hangup") has no React equivalent; the tile's `endCall()` covers it.

### Configuration

`ElementCall.computeCallOptions(client, roomId, widgetGenerationParameters)` is the single source of truth
for what a call runs with, serving both transports: `generateWidgetUrl()` serialises it into URL parameters
(unchanged output), `ElementCallAppTile` passes it as props.

- **`intent`**: EW's `ElementCallIntent` values are the same strings as EC's `UserIntent`, so it is a cast.
  Decided by `getRoomIntent` (video room → join existing; DM vs group; call already started; `voiceOnly`).
- **`config`** carries only what differs from the intent's defaults: `perParticipantE2EE` (room encrypted
  and `feature_disable_call_per_sender_encryption` off), `background: Solid`, `allowIceFallback`,
  `echoCancellation`, `noiseSuppression`, `returnToLobby` (video rooms), `skipLobby` (room rule wins over
  the caller's request). `lang`, fonts and `fontScale` are widget-URL only: the component takes `language`
  as a prop, and fonts do not reach it (see [Open items](#open-items)).
- **Frozen per call**: EC reconnects whenever `intent`/`config` change by value, and both are computed from
  live state (who is in the call, settings). `componentOptions` therefore freezes the first result until
  `close()`, the counterpart of freezing them into the widget URL.

`ElementCall.getConfigOptions(transports)` builds the `ConfigOptions` for `initializeElementCall`, the
counterpart of `appendAnalyticsParams` and `rageshakeSubmitUrl`: rageshake submit URL, PostHog and (gated on
analytics consent, as before) Sentry from `SdkConfig`, plus the first LiveKit transport from
`CallStore.getConfiguredRTCTransports()` as `livekit.livekit_service_url` (see [Open items](#open-items)).

### Theme and language

`hooks/useEffectiveTheme.ts` wraps a `ThemeWatcher` and returns the theme actually shown (including the
system theme when matching is on), the same answer `WidgetMessaging` uses for widgets. `HostedElementCall`
passes it as the `theme` prop, so a theme change reaches the call even in the browser PiP window where no
tile is mounted.

The language is read once (`getCurrentLanguage()`, `_` → `-`), since changing it reloads EW, and passed as the
`language` prop. The component calls `i18n.changeLanguage` with it and loads that locale's chunk on demand;
i18next resolves a region tag to its base language when the exact one is missing (`de-DE` → `de`,
`pt-BR` → `pt`) and to English otherwise (e.g. `nb-NO`, which EC has no translation for). EW's language
files are named `de_DE`, `zh_Hans`, … so this covers them. All Element Call instances on a page share one
i18next instance, so the most recently set language wins for all.

### Package, types and build

- **Dependency**: `@element-hq/element-call-component` as a git dependency on the `component` directory of
  the EC repository (`github:element-hq/element-call#<branch>&path:/component`); its `prepare` script builds
  `dist/` on install, which `allowBuilds` in `pnpm-workspace.yaml` permits (pnpm keys git packages by
  repository URL). `livekit-client` and `rxjs` become direct EW dependencies at versions compatible with
  EC's. `@element-hq/element-call-embedded` stays while the widget path exists. For local EC development,
  a `.link-config` line (`@element-hq/element-call-component=/path/to/element-call/component=apps/web`) or
  a `link:` spec points at a built checkout.
- **The `prepare` build must not run under a `node_modules` path.** pnpm builds a git dependency in a
  temporary checkout under its store (`<store>/tmp/`), and `pnpm/action-setup` makes
  `~/setup-pnpm/node_modules/.bin` the `PNPM_HOME` the store lives in. Built from such a path, EC's
  toolchain treats its own sources as a dependency's: the rolldown Babel plugin skips them (its default
  exclude is `node_modules`), so the React Compiler does not run, and the TypeScript transform ignores EC's
  `useDefineForClassFields: false`, so class fields get define semantics. The result is a bundle no local
  build produces, and `MediaDevices`, whose field initialisers read a constructor parameter property,
  throws on mount (`Cannot read properties of undefined (reading 'behavior')`), leaving the call tile
  blank. The web app build workflows (`build.yml`, `build_develop.yml`, `build-and-test.yaml`) therefore
  set `pnpm_config_store_dir` to `$RUNNER_TEMP/pnpm-store` before `actions/setup-node` (pnpm 11 reads
  `pnpm_config_*`, not `npm_config_*`, from the environment); a local
  `pnpm store path` (`~/Library/pnpm/store`, `~/.local/share/pnpm/store`) is unaffected. The tell-tale of
  a bad build is a component chunk with no `react/compiler-runtime` import.
- **One SDK, one LiveKit** (`webpack.config.ts`): aliases `matrix-js-sdk$` → `src/matrix.ts` and
  `matrix-js-sdk/lib` → `src`, before the existing prefix alias, so EC's `lib/*` imports resolve to the
  modules EW uses (otherwise `instanceof`, enums and `getRoomSession()` identity break); `livekit-client$`
  → its resolved entry file. `tsconfig.json` `paths` mirror this so the package's `MatrixClient` is EW's type.
- **CSS**: the `styles` cache group excludes the component's stylesheet (by real path), so it is emitted
  with the component's lazy chunk instead of the app-wide stylesheet. Combined with EC scoping every
  selector to `[data-element-call-root]`, EW's document keeps its own styles.
- **Types** (`views/voip/ElementCallComponentTypes.ts`): re-exports the package's types; `UserIntent`,
  `HeaderStyle`, `BackgroundStyle` are string-enum mirrors (importing values from the package would pull the
  bundle into the main chunk; the model needs `BackgroundStyle` on the widget path too), and
  `configurationForIntent` is a copy for the mock. `ElementCallProps` re-types `ref` with EW's React.
  `@types/element-call-component.d.ts` declares the untyped `./style.css` subpath;
  `@types/document-picture-in-picture.d.ts` types the browser API.

### Mock component (`views/voip/ElementCallMock.tsx`)

Same module shape as the package (`ElementCall`, `initializeElementCall`), rendered when
`Developer.elementCallMockComponent` is on. Instead of a call UI it lists the session's memberships, shows a
HostBridge panel (one button per callback, `contentLoaded` on mount, a log of both directions), implements
the `ElementCallHandle` (acknowledging `hangUp` etc.) and shows the effective configuration. "Joining"
publishes a real MatrixRTC membership using the deployment's LiveKit transport, expiring after 10 minutes
and cleared on unmount, so the `ElementCall` model behaves as with a real call and a stale membership never
sends the real component to a bogus focus. Playwright turns the setting on in `beforeEach`, unit tests via
`enableCalls()`; production users never download the chunk.

### Document Picture-in-Picture

Only possible with the component: the persisted DOM tree can move to another window while the React tree
keeps running in the main document (an iframe would reload).

- `stores/DocumentPipStore.ts` opens the window (Chromium `window.documentPictureInPicture`), copies the
  page's stylesheets and theme classes, moves the call's tree there and brings it back when the user reopens
  the call view, the call disconnects, or the window closes.
- `PersistedElement.detach/reattach/isDetached`: while detached the tree fills its host and stays visible
  without a mounted `PersistedElement`; placeholders are ignored.
- `hooks/room/useDocumentPip.ts` exposes `available` (React transport, connected, API present), `active`,
  `toggle`. `RoomHeader` shows, while in a call, EW's own PiP toggle (`collapse`/`expand` icons,
  `data-testid="call-pip-button"`) and the Document PiP button (`pop-out`, `data-testid="document-pip-button"`).
- `PipContainer` hides the floating PiP for a call that is in a Document PiP window.

### Tests

Unit: `CallTile.test.tsx` (flag × widget type), `ElementCallAppTile.test.tsx` (dock/undock, liveness
teardown, leave-room paths, StrictMode), `ElementWebHostBridge.test.ts`, `ElementCallMock.test.tsx`,
`Call.test.ts` (ready/timeout, hang-up via handle, `handle*` → `ConnectionState`, frozen options),
`DocumentPipStore.test.ts`, `PersistedElement.test.tsx`, `PersistentApp.test.tsx`, RoomHeader and
PipContainer cases. `test/test-utils/call.ts`'s `enableCalls()` turns the mock on.

Playwright (`e2e/voip/element-call.spec.ts`): the "Switching rooms" specs run for both transports with the
mock; "React component (real)" checks the real chunk mounts inside `.mx_CallView` without an iframe and
follows the theme; a Document PiP spec (Chromium). Locators for tile content must be page-level, since the
persisted root hangs off `<body>`. `element-call-full-call.spec.ts` runs a real two-user call through the
component against Synapse + LiveKit + lk-jwt-service (worker option `matrixRTC`, testcontainers in
`playwright/testcontainers/`). `routeConfigJson` in `playwright-common` now matches any origin so a
different `BASE_URL` gets the same config.

## Open items

- **Transport discovery**: the component only consults `/rtc/transports` and its `ConfigOptions.livekit`,
  not `.well-known`'s `org.matrix.msc4143.rtc_foci`, so EW passes the first known LiveKit transport at
  initialisation. `initializeElementCall` runs once per page load, so a transport that changes later is not
  picked up, and it must be known before the first call renders. Proper fix is upstream (an RTC driver
  instead of the full client).
- **`contentLoaded`** is not called by EC's component build; `MarkReadyOnMount` compensates and becomes
  redundant once it is.
- **Package reference**: switch the git ref to `main` (or a published package, dropping the `allowBuilds`
  entry) once element-call#4233 has merged. A prebuilt, published artifact also removes the class of
  problem below: with `prepare`, the component is built by the consumer's pnpm, in a location the consumer
  does not control (see [Package, types and build](#package-types-and-build)).
- **EC: class field ordering** (upstream). `src/state/MediaDevices.ts` initialises fields from the
  `scope` and `audioOutputOptions` parameter properties and relies on TypeScript assigning those first,
  which only `useDefineForClassFields: false` guarantees. Move the initialisers into the constructor body,
  and check the other classes whose field initialisers read `this.<parameter>` (some 20 classes change
  shape under define semantics). Until then the CI store-dir workaround is load-bearing.
- **EC: build determinism** (upstream). Make the component build independent of where it runs: give the
  rolldown Babel plugin an `exclude` that names only the project's own dependency directory by absolute
  path rather than any `node_modules` segment, and pass `useDefineForClassFields: false` explicitly through
  Vite's `oxc` options instead of depending on tsconfig discovery. EW could then drop the workaround.
- **`matrix-js-sdk` coupling**: the component reads SDK APIs (e.g. `MatrixRTCSession.isKeyRotationSuppressed`)
  that EW's pinned SDK must have; until the package declares its requirement, bump both together.
- **Fonts**: EW's system font setting (`FontWatcher` sets `--cpd-font-family-sans` on `document.body`) does
  not reach the component, because EC's stylesheet redeclares `--cpd-font-family-sans` on its own root
  element (`@layer cpd-base`), and a declaration on the element beats an inherited value. Likewise EC's
  text sizes are `px` × `--font-scale: 1`, so EW's font size setting (root `font-size`) only moves the
  `rem`-based compound spacing. Fix options: EC stops redeclaring the font family in the component build, or
  EW adds an unlayered rule `[data-element-call-root] { --cpd-font-family-sans: inherit }` (unlayered beats
  layered) and sets `--font-scale` from `FontWatcher.getRootFontSize() / getBrowserDefaultFontSize()`.
- **Device mute** state is received but not used by EW.
- **Later, separate plans**: remove the widget path and make `Call` transport-neutral (no virtual widget)
  once self-hosted EC via `Developer.elementCallUrl` is dropped or explicitly kept; a driver/host-object
  contract if EC wants one (options §1.6).
