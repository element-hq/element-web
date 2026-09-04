# Plan: Element Call iframe → React component

Element Call (EC) is currently embedded in Element Web (EW) as a widget running in an iframe. We
want to move to mounting EC as a plain React component instead, for the following reasons:

- **One process, one client.** EC would reuse EW's `MatrixClient` and MatrixRTC session instead of
  re-implementing Matrix access through the widget driver and `postMessage` transport.
- **No widget indirection.** Configuration, control (join / hang up / mute) and state today travel
  as URL parameters and widget actions; as a component they become props and callbacks.
- **Simpler lifecycle.** Iframe load waiting, capability negotiation, permission prompts and the
  "widget died" heuristics disappear.
- **Shared UI.** EC can use EW's theme, fonts, i18n and design system directly rather than being
  configured to imitate them.

Findings and the mounting proposal live in [element-call-react-options.md](./element-call-react-options.md).

## Before we start

Build a mock of Element Call's **public React component** — the `ElementCall` export of
[`component/index.tsx`](https://github.com/element-hq/element-call/blob/ace78de749ebb067cd258cd6be61610b14ca969a/component/index.tsx)
in [element-hq/element-call#4233](https://github.com/element-hq/element-call/pull/4233):

```tsx
await initializeElementCall(configOptions); // once, at startup

<ElementCall
    client={client} // the host's MatrixClient
    roomId={room.roomId} // EC resolves the MatrixRTCSession itself
    intent={UserIntent.StartNewCall} // what the user asked for; drives the defaults
    config={{ perParticipantE2EE, lang, fontScale, … }} // overrides on top of the intent
    hostBridge={elementWebHostBridge} // how EC talks to EW while the call runs
/>
```

**Status:** done, see `apps/web/src/components/views/voip/ElementCall.tsx`. It mirrors the EC file's
exports (`ElementCall`, `initializeElementCall`, `UserIntent`, `HeaderStyle`, `BackgroundStyle`,
`ElementCallConfiguration`, `ConfigOptions`, `HostBridge`, `HostRequest`, `DeviceMuteState`,
`DeviceMuteRequest`, `JoinCallData`, `nullHostBridge`, plus `configurationForIntent`) with the same
shapes, so the real package is later a one-import swap. Instead of a call UI it renders:

- the session members as a list of strings;
- a **HostBridge panel**: one button per EC → host method (`notifyJoined`/`notifyHungUp`,
  `setAlwaysOnScreen`, `notifyDeviceMute` for audio and video, `close` and `downloadMedia` when the
  host offers them), `contentLoaded` fired on mount, a subscription to every host → EC observable
  (`themeChange$`, `join$`, `hangUp$`, `deviceMute$`) that acknowledges each request and reacts like
  EC would, and a log of both directions;
- the **configuration**: `intent`, the `config` overrides passed in, the effective configuration
  (`configurationForIntent(intent)` + `config`, mirrored from EC), and what `initializeElementCall`
  was called with.

**Decision (2026-09-03, with the EC team):** EW consumes EC's public `ElementCall` component. It takes
the host's `MatrixClient` and a `roomId` (EC derives the `MatrixRTCSession` from
`client.matrixRTC.getRoomSession(room)` itself), a `UserIntent`, optional configuration overrides, and a
`HostBridge`. `ElementCallView` (client + rtcSession + booleans) is EC-internal and is what the wrapper
renders; EW does not use it directly. **The `HostBridge` is the control plane** — there is no separate
EW-invented callbacks object. A driver-style abstraction (something like `ElementWidgetDriver` passed
to EC instead of a client) is **not part of this plan**; it may come as a later follow-up and the
analysis for it is parked in the options document's §1.6.

## Element Web

Investigate how Element Call is used in Element Web. Make yourself familiar with the widget concept.

We want to keep the diff as minimal as possible. Find the best place to add this component.

- There is a `Call` abstraction (`models/Call.ts`). Maybe it makes sense to add it there.
- There is also an `AppTile` that wraps a widget. An `AppTile` that is not a widget but just a
  container for the `ElementCall` React component could be another good place.

Evaluate other options that make it easy to mount the `ElementCall` component into Element Web while
keeping all the custom call behaviour intact.

**Status:** done, see [element-call-react-options.md](./element-call-react-options.md).

---

## Implementation plan: Option B′ — `ElementCallAppTile`

**Status (2026-09-03):** Steps 0–4 and 6 are implemented (`CallTile.tsx`, `ElementCallAppTile.tsx`,
`ElementWebHostBridge.ts`, the seam and `getCallOptions()` in `models/Call.ts`, the labs flag, `rxjs`
dependency, tests). Step 5's manual verification in a running app has not been done yet. Deviations
from the text below, decided while implementing:

- **Sticky** is driven only by `HostBridge.setAlwaysOnScreen` (which is what EC calls when it joins),
  not additionally on `notifyJoined` — the bridge awaits `stickyPromise` before setting persistence.
- **Teardown on unmount** calls `call.handleClose()` (set disconnected + close) rather than
  `call.disconnect()`: with the component gone, nobody would reply to a hang-up request.
- **`Call.start()`** now returns `Promise<ClientWidgetApi | null>` (null on the React path); its only
  caller (`RoomViewStore`) ignores the value.
- **`hangUpRequests$`** lives on the `ElementCall` model (an rxjs `Subject`), and the bridge exposes it
  as `hangUp$`; `performDisconnection()` refuses immediately if no component is subscribed.
- The **theme** is forwarded through a `ThemeWatcher` owned by the bridge (`start()`/`stop()` from the
  tile), as `WidgetMessaging` does.
- **StrictMode** (dev only, inside `PersistedElement`) has not been exercised; the dock/undock effect's
  cleanup runs `endCall()` when the widget is not live, which under a simulated unmount would destroy
  the persisted element before the first real render. To be checked in Step 5.

Chosen in [element-call-react-options.md](./element-call-react-options.md) §3–§4. Summary of the
idea: a **new component with the same props as `AppTile`** that renders `<ElementCall …/>` instead of
an iframe, plus a **one-place selector** that picks it for Element Call widgets when a labs flag is on.
The virtual widget stays as the identity token, so `ActiveWidgetStore`, `PersistedElement`,
`PipContainer`, `RoomViewStore`, `CallStore` and `WidgetStore` keep working unchanged.

### What stays exactly as it is

- `ElementCall.createOrGetCallWidget()` still registers the virtual widget in `WidgetStore`; its id is
  still the `persistKey`, the `ActiveWidgetStore` key and the PiP candidate.
- `RoomViewStore` (`view_call`, `presented`, `call.start()`, voice-call-in-PiP persistence),
  `CallStore`, `ActiveWidgetStore`, `PipContainer`, `WidgetPipViewModel`, `useRoomCall`, toasts,
  timeline tiles, room list indicators.
- `AppTile` itself. Real widgets (Jitsi, third-party, `AppsDrawer`, `WidgetCard`, stickers) are not
  touched.
- The iframe path. With the flag off nothing changes; with the flag on only Element Call widgets
  take the new path.

### Step 0 — Labs flag ✅ done

`src/settings/Settings.tsx`: add `feature_element_call_react` next to
`feature_disable_call_per_sender_encryption` (same shape: `isFeature`, `LabGroup.VoiceAndVideo`,
`LEVELS_DEVICE_ONLY_SETTINGS_WITH_CONFIG_PRIORITISED`, default `false`) with
`controller: new ReloadOnChangeController()` — a call that is already mounted in one transport cannot
be switched to the other, and persisted roots survive navigation. Add the type entry and the
`labs|…` string.

### Step 1 — `CallTile` selector (single decision point) ✅ done

New `src/components/views/voip/CallTile.tsx`:

```tsx
export const CallTile = (props: ComponentProps<typeof AppTile>): JSX.Element => {
    const reactCall = useSettingValue("feature_element_call_react");
    return reactCall ? <ElementCallAppTile {...props} /> : <AppTile {...props} />;
};
```

Reads the flag at render time (not at import time). It only decides the **transport**; whether a
widget _is_ an Element Call is the caller's decision, so the generic `PersistentApp` stays free of
call-specific logic beyond one type check.

Call sites (one import each):

- `components/views/voip/CallView.tsx:47` — `AppTile` → `CallTile`. Docked case; always a call.
- `components/views/elements/PersistentApp.tsx` — `WidgetType.CALL.matches(app.type) ? CallTile : AppTile`.
  PiP case for any persistent widget. `WidgetPipViewModel` renders `PersistentApp` and therefore needs
  **no** change.

### Step 2 — `ElementCallAppTile` ✅ done

New `src/components/views/voip/ElementCallAppTile.tsx`, typed as
`(props: ComponentProps<typeof AppTile>) => JSX.Element` so the compiler enforces drop-in. Of the
`AppTile` props it **uses**: `app`, `room`, `miniMode`, `fullWidth`, `pointerEvents`, `overlay`,
`movePersistedElement`, `stickyPromise`. It **ignores** (iframe/menubar-only): `waitForIframeLoad`,
`showMenubar`, `showTitle`, `showPopout`, `showLayoutButtons`, `widgetPageTitle`, `userWidget`,
`threadId`, `onEditClick`, `onDeleteClick`, `handleMinimisePointerEvents`, `userId`, `creatorUserId`.

Where it gets its inputs:

- `call = CallStore.instance.getCall(room.roomId)`, asserted to be an `ElementCall` whose
  `widget.id === app.id`. Render nothing (and log) otherwise.
- `client` from `MatrixClientContext` — `PersistedElement` re-provides `SDKContext` and
  `MatrixClientContext` inside its separate root, so this works in the persisted subtree.
- `session = call.session` (public on the `ElementCall` model).

Lifecycle it reproduces from `AppTile` (function-component with hooks; line refs are to `AppTile.tsx`):

| Behaviour                                        | `AppTile` today                                                                                                                          | `ElementCallAppTile`                                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Persist across navigation                        | `PersistedElement persistKey={getPersistKey(getWidgetUid(app))} zIndex={miniMode ? 101 : 9} moveRef={movePersistedElement}` (776–802)    | Same, wrapping `<div className="mx_AppTile_persistedWrapper">`                                                                                                                             |
| Dock / undock                                    | `dockWidget` on mount, `undockWidget` on unmount, both only when `!miniMode` (363–369, 402–407)                                          | Same, in one `useEffect`                                                                                                                                                                   |
| Teardown on unmount                              | if `!ActiveWidgetStore.isLive(app.id, roomId)` → `endWidgetActions()` (412–419)                                                          | Same guard → `endCall()`: `PersistedElement.destroyElement(persistKey)`, `destroyPersistentWidget(app.id, roomId)`, and `call.disconnect()` if connected (replaces "widget died → hangup") |
| Leave / ban                                      | `RoomEvent.MyMembership` → `onUserLeftRoom()` (272–279); `Action.AfterLeaveRoom` (589–594)                                               | Same events; not-viewing → `endCall()`, otherwise `destroyPersistentWidget`                                                                                                                |
| Going sticky                                     | EC sends `UpdateAlwaysOnScreen`; `WidgetMessaging` awaits `stickyPromise` then `setWidgetPersistence(true)` (WidgetMessaging.ts:379–388) | When the component reports **joined**: `await stickyPromise?.()` then `setWidgetPersistence(app.id, roomId, true)`                                                                         |
| Classes                                          | `mx_AppTile` / `mx_AppTile_mini` / `mx_AppTileFullWidth`; body `mx_AppTileBody --large/--mini --call` (715–723, 806–814)                 | Same class names so `_AppsDrawer.pcss` (`--call` border radius, persisted wrapper) applies unchanged                                                                                       |
| `pointerEvents` / `overlay`                      | Inline style on body; overlay rendered as sibling inside persisted subtree (725–727, 774)                                                | Same                                                                                                                                                                                       |
| Messaging / permissions / mixed content / popout | `WidgetMessaging`, `AppPermission`, `iframeParentRef` …                                                                                  | **Not reproduced** — this is the point                                                                                                                                                     |

Body: `<ElementCall client={client} roomId={room.roomId} intent={…} config={…} hostBridge={bridge} />`
with `intent`/`config` from step 4 and `bridge` from step 3. `client` comes from `MatrixClientContext`;
EC resolves the RTC session itself, so `call.session` is only needed by the model, not the tile.

### Step 3 — Control plane: `ElementWebHostBridge` + a transport seam in `models/Call.ts` ✅ done

Today the `ElementCall` model talks to the widget over `widgetApi`: `start()` polls
`WidgetMessagingStore` until messaging with a `widgetApi` exists (`Call.start`, 223–273, 16 s
timeout), registers `JoinCall`/`HangupCall`/`Close`/`DeviceMute` action handlers (902–917), and
`performDisconnection()` sends `HangupCall` and awaits the reply (919–935). Without an iframe there
is no messaging, so `start()` would time out.

EC already defines the replacement: **`HostBridge`** (`src/HostBridge.ts` in EC, mirrored in the mock).
Its two halves map exactly onto what `WidgetMessaging` + the model's action handlers do today:

| `HostBridge` member       | Direction | Widget equivalent today                                           | EW implementation                                                                                          |
| ------------------------- | --------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `contentLoaded()`         | EC → EW   | `WidgetMessaging` `ready` / `Call.start()` messaging wait         | Resolve the model's ready deferred; `start()` awaits it with the same 16 s timeout                         |
| `notifyJoined()`          | EC → EW   | `ElementWidgetActions.JoinCall` → `onJoin` → `setConnected()`     | `call.handleJoined()`                                                                                      |
| `notifyHungUp()`          | EC → EW   | `HangupCall` → `onHangup` → `setDisconnected()`                   | `call.handleHangup()`                                                                                      |
| `close?()`                | EC → EW   | `Close` → `onClose` → `setDisconnected(); close()`                | `call.handleClose()` — present, since EW can dismiss the call                                              |
| `notifyDeviceMute(state)` | EC → EW   | `DeviceMute` → `onDeviceMute` (ack only)                          | No-op for now (`call.handleDeviceMute()`)                                                                  |
| `setAlwaysOnScreen(bool)` | EC → EW   | `UpdateAlwaysOnScreen` → `stickyPromise` → `setWidgetPersistence` | `await stickyPromise?.()` then `ActiveWidgetStore.setWidgetPersistence(app.id, roomId, bool)` (tile-owned) |
| `hangUp$`                 | EW → EC   | `performDisconnection()` sends `HangupCall`, awaits reply         | rxjs `Subject`; `performDisconnection()` pushes a request and awaits its `reply()`                         |
| `themeChange$`            | EW → EC   | `WidgetMessaging.updateTheme`                                     | `Subject` fed from EW's theme watcher                                                                      |
| `join$`, `deviceMute$`    | EW → EC   | `JoinCall` (preload) / `DeviceMute` request                       | `NEVER` for now — EW does not preload and does not drive mute                                              |
| `supportsReactions`       | —         | `io.element.participants`/reactions capability                    | `true`                                                                                                     |
| `downloadMedia?(mxc)`     | EC → EW   | `ElementWidgetDriver.downloadFile`                                | Omit — EC has the client and fetches media itself                                                          |

Work:

1. **Add `rxjs`** as a direct dependency (EC's public types use `Observable`; `rxjs@7.8.2` is already in
   the lockfile via `playwright-common`, so no new version). The mock uses a structural
   `Subscribable<T>` so rxjs `Subject`s satisfy it as-is.
2. **`ElementWebHostBridge implements HostBridge`** (new file next to the tile, e.g.
   `components/views/voip/ElementWebHostBridge.ts`), constructed per `(call, app, room, stickyPromise)`
   by `ElementCallAppTile` with the lifetime of the persisted DOM — the same contract `WidgetMessaging`
   has today. Its methods do nothing but call into the model and `ActiveWidgetStore` as in the table.
3. **Transport seam in the `ElementCall` model, not a class split.** Add `handleJoined()`,
   `handleHangup()`, `handleClose()`, `handleDeviceMute()` (the bodies of `onJoin`/`onHangup`/
   `onClose`/`onDeviceMute` minus the widget ack — the widget handlers become thin wrappers), a
   `markReady()` that resolves the deferred `start()` waits on when the React flag is set, and a
   `hangUpRequests$: Subject<HostRequest<Record<string, never>>>` that `performDisconnection()` uses
   instead of `widgetApi` on the React path. `start(params)` keeps merging `widgetGenerationParameters`
   but skips URL regeneration and `widgetApi` handler registration on the React path; the timeout and
   `ConnectionState` failure handling stay shared. `close()` completes the subject; widget path
   unchanged.
4. **`Call.onStopMessaging`** ("widget died → hangup") has no React equivalent; the tile's `endCall()`
   on unmount covers it, and the `MyMembership`/`beforeunload` handling in `Call` is unchanged.

The mock already drives every one of these from its HostBridge panel, so the bridge and model changes
can be tested end to end before EC's real component exists.

### Step 4 — Configuration: URL params → `intent` + `config` ✅ done

EC's component takes **what the user asked for** (`intent: UserIntent`) and derives the behaviour
itself via `configurationForIntent()` (skip lobby, ring vs notify, auto-leave, call intent audio/video,
`confineToRoom: true`, `perParticipantE2EE: true`, …). The host only overrides what differs
(`config: ElementCallConfiguration = Partial<UrlParams>`). This replaces `generateWidgetUrl`'s ~20
URL params:

| Today (`generateWidgetUrl` / `appendRoomParams`)                                         | With the component                                                                                                                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intent` (one of EW's eight `ElementCallIntent`, 660–709)                                | `intent` prop. **Same string values as EC's `UserIntent`** (`start_call`, `join_existing_dm_voice`, …), so this is a cast/rename, not a mapping          |
| `skipLobby` (only when `typeof opts.skipLobby === "boolean"`, 773–775)                   | Only in `config` when EW's rule differs from the intent default (EC: `false` for group calls, `true` for DMs); video rooms: `config.skipLobby = false`   |
| `returnToLobby=true` for video rooms (674)                                               | `config.returnToLobby: true` for `room.isVideoRoom()`                                                                                                    |
| `perParticipantE2EE` template var (`getWidgetData`, 844–857)                             | `config.perParticipantE2EE` = `room.hasEncryptionStateEvent() && !feature_disable_call_per_sender_encryption`                                            |
| `theme` template var, `lang`, `fontScale`, `font`/`useSystemFont`                        | `config.theme` / `lang` / `fontScale` / `fonts`; runtime theme changes via `hostBridge.themeChange$`                                                     |
| `background=solid`                                                                       | `config.background: BackgroundStyle.Solid` (EC's harness does the same to stay inside the container)                                                     |
| `allowIceFallback` (`fallbackICEServerAllowed`)                                          | `config.allowIceFallback`                                                                                                                                |
| `webrtc_audio_echoCancellation` / `noiseSuppression` settings                            | `config.echoCancellation` / `noiseSuppression`                                                                                                           |
| `userId`, `deviceId`, `roomId`, `baseUrl`, `widgetId`, `parentUrl`                       | Gone — `client` + `roomId` props; EC's `hostedProperties` nulls the widget plumbing                                                                      |
| `rageshakeSubmitUrl`, PostHog/Sentry params (`appendAnalyticsParams`, 711–748)           | Not per call: `initializeElementCall(configOptions)` at startup (step 7). Decide one PostHog instance or two (options §1.5)                              |
| `confineToRoom`, `header`, `showControls`, `hideScreensharing`, `controlledAudioDevices` | Take EC's intent defaults (`confineToRoom: true`, `header: AppBar` on web); only override if the docked/PiP layout needs e.g. `header: HeaderStyle.None` |

Implementation: factor the _decisions_ in `appendRoomParams` + `getWidgetData` into one method,
`ElementCall.getCallOptions(): { intent: UserIntent; config: ElementCallConfiguration }`, and make
`generateWidgetUrl()` serialise **from it** (so the widget path keeps producing identical URLs) while
`ElementCallAppTile` passes it as props. One source of truth, two outputs. `widgetGenerationParameters`
(`skipLobby`, `voiceOnly`) stays the input to both.

### Step 5 — Dev render path & PiP verification ✅ PiP covered by Playwright

**Status:** the "Switching rooms" specs in `playwright/e2e/voip/element-call.spec.ts` now run for both
transports (`feature_element_call_react` off and on) and pass: persist across room switch into PiP,
close from PiP and restart in the same or another room, join/leave/rejoin an existing call. Finding
along the way: the mock must publish an RTC membership when it "joins" (as the fake widget does),
otherwise `ElementCall.checkDestroy()` destroys the memberless call as soon as `presented` flips false
on navigation, which drops persistence before PiP can show. The real component joins the session for
real, so this only affected the mock. Voice-call-into-PiP, leave/ban mid-call and StrictMode remain to
be verified by hand.

With the flag on, `CallView` renders the mock via `CallTile`. Verify by hand, then in tests:

- Start a call, switch rooms mid-call: the mock stays mounted (persisted root), appears in PiP,
  returns when navigating back (`movePersistedElement`).
- `voiceOnly` start from `RoomViewStore` (voice call straight into PiP).
- Join in room A while connected in room B: `stickyPromise` hangs up B before A goes sticky.
- Leave / get banned from the room while in call, viewing and not viewing it.
- Reload with the flag on/off (`ReloadOnChangeController`).

### Step 6 — Tests ✅ done

- `ElementCallAppTile.test.tsx`: renders the mock; dock/undock, `isLive` teardown guard,
  `destroyElement`/`destroyPersistentWidget` on unmount, leave-room paths, bridge constructed with the
  tile's `stickyPromise`. Clicking the mock's HostBridge buttons is the integration test. Needs a real `ElementCall` model (or a
  `MockedCall` flavour with `WidgetType.CALL` and a `session`) — `test/test-utils/call.ts`'s
  `MockedCall` uses a `Custom` widget type today.
- `ElementWebHostBridge.test.ts`: each bridge method → the right model / `ActiveWidgetStore` call;
  `hangUp$` request is replied when the mock hangs up; `stickyPromise` runs before persistence.
- `CallTile.test.tsx`: flag × widget type → which component renders.
- `models/Call.test.ts`: `start()` resolves on `markReady()`, times out without it;
  `performDisconnection()` pushes into `hangUpRequests$` and awaits the reply; `handle*` drive
  `ConnectionState`; widget path tests unchanged.
- Existing `CallView.test.tsx` / `PipContainer.test.tsx` keep passing with the flag off. Playwright
  coverage for the React path is Step 5 (mock) and Step 8 (full call).

---

## Phase 2 — swapping in the real Element Call

> **Do not start Step 7 before Steps 0–6 are done, tested, and the placeholder works end to end**
> (docked view, PiP, room switching, sticky, leave/ban, flag on/off) with the mock `ElementCall`.
> Phase 2 changes the dependency graph and the build; doing it on top of an unproven mounting story
> means debugging two things at once.

### Step 7 — Swap in EC's real component (element-call#4233) ✅ implemented (local build)

**Status (2026-09-03):** done against a local build of the M1 branch. Deviations from the items below:

- **Package source.** No published package yet. A git worktree of `valere/component_ec_M1` lives at
  `../element-call-component-m1` (sibling of the `element-web` checkout); `pnpm build:component` there
  produces `dist/`, into which a hand-written `package.json` (`@element-hq/element-call-component`,
  `exports: { ".": element-call.js, "./style.css": element-call.css }`) was dropped. Element Web depends
  on it as `link:../../../element-call-component-m1/dist`. **This `link:` entry is machine-local and
  must be replaced before merging** — either by EC publishing the package or by a git dependency once
  the branch ships a manifest.
- **Types come from the package.** EC's build emits no `.d.ts` yet, but its tsconfig already has
  `declaration: true` and `tsc --emitDeclarationOnly` produces a clean `component/index.d.ts`; that
  output is copied into the local `dist/types/` and referenced via `types` / `exports["."].types` in the
  hand-written manifest (upstream ask: add the emit step to `build:component`). Element Web re-exports
  the package's types from `views/voip/ElementCallComponentTypes.ts` and keeps only **runtime** mirrors
  there — the `UserIntent`/`HeaderStyle`/`BackgroundStyle` enums (importing them as values would pull
  the bundle into the main chunk; TypeScript accepts same-named, same-membered enums as compatible)
  and the `configurationForIntent` copy for the mock. `@types/element-call-component.d.ts` only
  declares the untyped `./style.css` subpath. Two `paths` entries in `tsconfig.json` map
  `matrix-js-sdk` and `matrix-js-sdk/lib/*` to `src`, mirroring the webpack aliases, so the package
  typings' `MatrixClient` is the same type as Element Web's.
- **Initialisation.** `initializeElementCall(ElementCall.getConfigOptions())` runs inside the `lazy()`
  factory that loads the component (real or mock), i.e. once, on first use, rather than at app startup.
  `getConfigOptions()` on the model maps rageshake/PostHog/Sentry from `SdkConfig` with the same
  consent gate as `appendAnalyticsParams`.
- **Aliases.** Besides `matrix-js-sdk/lib` → `src`, the bundle's bare `import … from "matrix-js-sdk"`
  needed `matrix-js-sdk$` → `src/matrix.ts`; `livekit-client$` is aliased to its resolved entry file
  because the package does not expose `package.json` (which broke `getPackageRoot`).
- **Mock switch.** As planned: `Developer.elementCallMockComponent` (devtools flag), both components
  `lazy()`-loaded (`element-call-component.js` ≈ 17 MB unminified-dev / `element-call-mock.js`),
  Playwright sets the flag in `beforeEach`, `enableCalls()` returns `true` for it in unit tests. The
  mock moved to `ElementCallMock.tsx` (`mx_ElementCallMock` classes) and re-exports nothing of its
  own types any more.
- **CSS.** Imported next to the component chunk, but Element Web's webpack extracts all `.css` into the
  single `styles` chunk (`splitChunks.cacheGroups.styles`, `enforce: true`), so EC's 1.6 MB stylesheet
  (fonts inlined) ends up in the main stylesheet for everyone. Acceptable for labs; to fix, exclude the
  package from that cache group or load it as a `<link>` at runtime.
- **Playwright.** A "React component (real)" smoke spec (setting off) checks the real chunk loads and
  mounts inside `.mx_CallView` (`[data-element-call-root]`), with no iframe and no mock.
- **Versions.** EC's branch pins `livekit-client ^2.18.1`; Element Web got `^2.22.2` (semver-compatible).
  `rxjs 7.8.2` had to be re-added: it was missing from `package.json` after the Step 3–6 commits.
- **StrictMode (found by the React-path Playwright specs).** The app root is in `StrictMode`
  (`vector/app.tsx`), so in development React simulates an unmount/remount right after mounting. The
  tile's dock-effect cleanup then saw the widget as not live and destroyed the persisted element before
  the first real render — nothing rendered, plus "attempted to synchronously unmount a root while React
  was already rendering". Fixed in `ElementCallAppTile` by deferring the liveness check by a tick and
  cancelling it when the effect re-runs (a real unmount is never followed by a remount). Covered by a
  StrictMode unit test. This was the risk noted in the Step 2 status; it did not show with the mock
  bundled synchronously, only once the component became `lazy()`.
- **EC build defects (to report upstream, worked around in the worktree's `vite-component.config.ts`).**
    1. `react-i18next` pulls in the CommonJS `use-sync-external-store/shim`; its `require("react")`
       against an external React is left by rolldown as a shim that throws in the browser ("Calling
       `require` for "react" in an environment that doesn't expose the `require` function"). Fix:
       alias `"use-sync-external-store/shim": "react"` (React 18+ provides `useSyncExternalStore`).
    2. `react/compiler-runtime` (emitted by the React Compiler for every compiled component) was not
       in the externals list, so it was bundled as CommonJS with the same throwing `require("react")`.
       Fix: add it to `external` next to `react/jsx-runtime`. `pnpm lint:externals` should also reject
       any remaining `require` of an external — two shimmed `require("util")` calls are still in the
       `matrix-*` chunk.
    3. Call sounds are base64-inlined and then `fetch()`ed at module load (`prefetchSounds` in
       `soundUtils.ts`, called at top level of `CallEventAudioRenderer.tsx`). Element Web's CSP is
       `connect-src * blob:`, so `fetch("data:audio/ogg;…")` is refused and logs an unhandled
       "Failed to fetch" on every load. Not fatal (the component renders; sounds are just missing), but
       either the component must decode the data URL without `fetch`, or hosts must allow
       `connect-src data:`.
    4. The component never calls `HostBridge.contentLoaded()` — only EC's standalone `App.tsx` does — so
       `ElementCall.start()` timed out after 16 s. Element Web now marks the call ready itself when the
       lazily loaded component mounts (`MarkReadyOnMount` in the tile); once EC calls `contentLoaded`,
       that becomes redundant but stays harmless.
- **Mock memberships vs. the real component.** The mock's RTC membership originally named a placeholder
  focus (`https://example.org`, copied from the fake widget). Element Call connects to the focus of the
  _oldest_ membership in the room, so a membership left behind by a mock session (reload, flag flipped)
  made the real component on the same device try to reach `https://example.org` ("[ConnectionManager
  connections$] Creating item with keys https://example.org"). The mock now (a) publishes the
  deployment's real LiveKit transport from `CallStore.getConfiguredRTCTransports()` when one is known,
  (b) expires after 10 minutes instead of 4 hours, and (c) clears its membership when unmounted while in
  the call. A membership already left behind can be removed via devtools → Explore room state →
  `org.matrix.msc3401.call.member` → key `_<userId>_<deviceId>_m.call` → send `{}`, or by switching the
  mock back on and clicking notifyJoined then close.
- **Verified.** With the two local build fixes, the real component renders inside `.mx_CallView` in
  Playwright (lobby with camera preview, join button, device controls; no iframe; smoke spec green),
  and the mock-based room-switching specs pass for both transports. Note for specs: the tile's content
  lives in the persisted root attached to `<body>`, so locators must be page-level, not scoped to
  `.mx_CallView`.

What the EC PR provides (branch `valere/component_ec_M1`, draft "M1 — The component + a local dev
harness"), and what the mock already mirrors:

- **A library build**: `pnpm build:component` → `vite-component.config.ts`, ES module only, entry
  `component/index.tsx`, output file `element-call`, `cssCodeSplit: false` (one CSS file), assets
  base64-inlined, `publicDir: false`.
- **Externals** (must be provided by the host, checked by `pnpm lint:externals`): `react`,
  `react/jsx-runtime`, `react-dom`, `react-dom/client`, `livekit-client`, `matrix-js-sdk` and ~20
  `matrix-js-sdk/lib/*` subpaths (`lib/matrixrtc`, `lib/logger`, `lib/models/room`, …). `rxjs` is
  **bundled**, but appears in the public types.
- **Public API** (`component/index.tsx`): `initializeElementCall(config: ConfigOptions)` (await once;
  polyfills, `Config.initWith`, i18n with **English only, bundled**), `<ElementCall client roomId intent?
config? hostBridge? />`, and the types `HostBridge`, `HostRequest`, `DeviceMuteState`,
  `DeviceMuteRequest`, `JoinCallData`, `ConfigOptions`, `ElementCallConfiguration`, `UserIntent`,
  `BackgroundStyle`, `HeaderStyle`, `UrlConfiguration`. The wrapper owns `MemoryRouter`,
  `I18nextProvider`, `HostBridgeProvider`, `RootElementProvider` (theming and portals scoped to its
  own container via `data-element-call-root`, not `document.body`), `MediaDevices`, `ProcessorProvider`,
  and renders the internal `ElementCallView`.

Because steps 2–4 already build against the mirrored API, this step is mostly plumbing:

1. **Dependency.** Add the component package (name/registry TBD with EC; until published, a
   `pnpm link` / git dependency on the M1 branch). Keep `@element-hq/element-call-embedded` (static
   `dist/index.html`, copied by `webpack.config.ts:720`) while the widget path still exists.
2. **One `matrix-js-sdk`, one `react`, one `livekit-client`.** EC externalises `matrix-js-sdk/lib/*`;
   EW imports `matrix-js-sdk/src/*` everywhere (1.7k imports) and aliases `matrix-js-sdk` to the
   package root (`webpack.config.ts:248`). Without an alias, `matrix-js-sdk/lib/matrixrtc` and
   `matrix-js-sdk/src/matrixrtc` would be **two module instances** (`instanceof`, enums,
   `TypedEventEmitter` identity all break — and EC's `client.matrixRTC.getRoomSession()` would return
   a session EW's model does not recognise). Add a webpack alias `matrix-js-sdk/lib` →
   `matrix-js-sdk/src` (and check Vitest's resolver does the same). `react`/`react-dom` are already
   single; `livekit-client` becomes a direct EW dependency at the version EC pins.
3. **Swap the import — but keep the mock switchable.** `ElementWebHostBridge` and the model import
   the _types_ (`HostBridge`, `UserIntent`, `ElementCallConfiguration`, …) from the package; the mock
   file drops its mirrored copies and re-exports the package's. `tsc` is the check that the mirror
   matched; fix any drift there (the mock's `Subscribable` becomes rxjs `Observable`, `ConfigOptions`
   becomes EC's real type). The _component_ is chosen at runtime, see the next item.
4. **Mock in Playwright, real component everywhere else.** Step 5's two-transport "Switching rooms"
   specs keep driving the mock's HostBridge buttons (no media needed), while the app people run gets the
   real component from the same build. Do it the
   way the widget path already does for `Developer.elementCallUrl`: a **device-level developer setting**,
   `Developer.elementCallMockComponent` (boolean, default `false`, shown next to `elementCallUrl` in the
   devtools settings), read at render time by `ElementCallAppTile`:

    ```tsx
    // ElementCallAppTile.tsx
    const RealElementCall = lazy(() =>
        import("@element-hq/element-call/component").then((m) => ({
            default: m.ElementCall,
        })),
    );
    const MockElementCall = lazy(() => import("./ElementCallMock").then((m) => ({ default: m.ElementCall })));

    const useMock = useSettingValue("Developer.elementCallMockComponent");
    const Component = useMock ? MockElementCall : RealElementCall;
    <Suspense fallback={<Spinner />}>
        <Component client roomId intent config hostBridge />
    </Suspense>;
    ```

    - Playwright turns it on exactly where it sets `Developer.elementCallUrl` today
      (`element-call.spec.ts` `beforeEach`, `app.settings.setValue(..., SettingLevel.DEVICE, true)`), so
      the React-transport specs keep passing unchanged and still use the **same production bundle** CI
      serves (`npx serve ./webapp`) — no test-only build variant, no webpack alias.
    - Both components are `lazy()` code-split chunks: the mock's chunk is only fetched when the setting
      is on, the real component's (large: LiveKit etc.) only when a call is rendered on the React path.
      Production users never download the mock.
    - `CallTile` is unchanged: transport (widget vs React) and stand-in (real vs mock) are two
      independent switches, `feature_element_call_react` × `Developer.elementCallMockComponent`.
    - Unit tests (`ElementCallAppTile.test.tsx`) enable the setting through `enableCalls()`'s
      `SettingsStore` stub (add `Developer.elementCallMockComponent` → `true` there) so they keep
      clicking the mock's buttons; the real component is never imported in Vitest.
    - Rename `views/voip/ElementCall.tsx` → `ElementCallMock.tsx` (and its test/pcss) so the two are
      not confused; the mock must keep the package's public prop contract, which `tsc` enforces once it
      imports the types from the package.
    - Rejected alternatives: a webpack `resolve.alias` / env var (tests a different artifact than the
      one shipped, and needs a second build in CI); a `config.json` key (a test/dev knob in the
      deployment schema); a `window` injection hook (untyped, invisible in the settings UI).

5. **Initialise once.** `await initializeElementCall(configOptions)` during EW startup (next to the
   other init in `MatrixChat`/`init.tsx`), gated on the flag. Map `ConfigOptions` from `SdkConfig` /
   the old `appendAnalyticsParams` inputs: rageshake submit URL, PostHog/Sentry (one instance or two),
   default ICE fallback, audio processing defaults.
6. **CSS.** Import the library's single stylesheet once in EW's entry. It is scoped to EC's root element;
   verify no unlayered rules from `base.css` bleed into EW (EC's own comment says its unlayered part is
   custom properties on its root only). The mock's `_ElementCall.pcss` stays (renamed with the mock).
7. **i18n.** The M1 build bundles English only. Accept for the labs phase, or wire EC's `i18n` to EW's
   language once EC exposes a way to supply resources (tracked as an EC follow-up in the PR).
8. **Trim the mock.** It stays (item 4) as the Playwright and offline-dev stand-in; only its mirrored
   type/enum declarations and `configurationForIntent` copy go, replaced by imports from the package.
9. **Lint.** Peer deps satisfied by exactly one version (`pnpm why matrix-js-sdk livekit-client rxjs`);
   `knip` should not flag the embedded package as unused until the widget path is actually removed.

### Step 8 — Playwright: a full call with the component ✅ done

`playwright/e2e/voip/element-call-full-call.spec.ts` holds a real call between two Element Web sessions
through the real component, against Synapse + LiveKit + lk-jwt-service started by testcontainers (worker
option `matrixRTC` in `playwright/services.ts`, containers in `playwright/testcontainers/`). Setup, run
instructions and findings are in [element-call-e2e-call-plan.md](./element-call-e2e-call-plan.md).
`element-call.spec.ts` keeps the mock-based two-transport "Switching rooms" specs and the smoke spec that
checks the real component's chunk mounts inside `.mx_CallView` without an `iframe`.

### Follow up tasks:

- **Switch `@element-hq/element-call-component` to a remote dependency.** `apps/web/package.json` still has
  `"@element-hq/element-call-component": "link:../../../element-call-component-m1/dist"`, a machine-local
  worktree of EC's `valere/component_ec_M1` branch (kept on purpose for now, see Step 7). Before this can
  merge or run in CI it must become either the published package or a git dependency on the EC branch once
  it ships a `package.json` in its build output. Everything that renders the real component depends on it:
  the "React component (real)" smoke spec and the full-call spec from
  [element-call-e2e-call-plan.md](./element-call-e2e-call-plan.md) (`element-call-full-call.spec.ts`)
  cannot go green in CI until then.
- Check if we can remove ElementCallComponentTypes and instead get those types from @element-hq/element-call-component
- **Keep `matrix-js-sdk` at least as new as the component's build.** The full-call spec exposed that Element
  Web's develop snapshot lacked `MatrixRTCSession.isKeyRotationSuppressed`, which the component reads on
  mount; the lockfile now points at `e16b0bcc` (with `matrix-widget-api ^1.19.0`). Until the component
  package declares its SDK requirement, a bump of EC's build without a bump here breaks joining a call.

### Later (separate plans)

- Delete the widget path and do the Option C cleanup (transport-neutral `Call`, no virtual widget,
  no `call.widget`), once third-party/self-hosted EC via `Developer.elementCallUrl` is either
  dropped or explicitly kept as the reason to retain the iframe path.
- Driver/host-object contract per options §1.6, if EC wants it.

### Rough size

| Piece                                      | New / changed                                     |
| ------------------------------------------ | ------------------------------------------------- |
| Flag                                       | `Settings.tsx` + i18n string, ~15 lines           |
| `CallTile.tsx`                             | new, ~20 lines                                    |
| `ElementCallAppTile.tsx`                   | new, ~150–200 lines                               |
| `CallView.tsx`, `PersistentApp.tsx`        | one import each                                   |
| `ElementWebHostBridge.ts`                  | new, ~80 lines                                    |
| `models/Call.ts` seam + `getCallOptions()` | ~80–120 lines changed/added, widget path retained |
| Tests                                      | 3 new files, small additions to `Call.test.ts`    |
