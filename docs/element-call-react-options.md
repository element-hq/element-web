# Element Call as a React component — findings & options

Follow-up to [element-call-react-plan.md](./element-call-react-plan.md).

Scope: how Element Call (EC) is wired into Element Web (EW) today, what the iframe/widget layer
actually provides, and which options exist for mounting EC as a plain React component while keeping
the diff small and all custom call behaviour intact.

> **Decision (2026-09-03, with the EC team):** EW consumes EC's **public `ElementCall` component**
> (`component/index.tsx` in element-call#4233): `<ElementCall client roomId intent config hostBridge />`
> plus `initializeElementCall()`. EC resolves the `MatrixRTCSession` itself; the `HostBridge` is the
> control plane. A driver/host-object contract beyond that (§1.6) is a possible **later** follow-up and
> is **out of scope for this plan**.

A mock component now exists at `apps/web/src/components/views/voip/ElementCall.tsx` (same exports and
shapes as EC's `component/index.tsx`; renders the session members, a HostBridge panel and the config) so the mounting options below can be prototyped against a real component.

---

## 1. How Element Call is used today

### 1.1 The path from "click call" to a running call

| Step                                                                                   | Code                                                                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Call buttons / call options in the room header                                         | `hooks/room/useRoomCall.ts`                                                                                       |
| Dispatches `ViewRoom` with `view_call: true`, `skipLobby`, `voiceOnly`                 | `utils/room/placeCall.ts`                                                                                         |
| Creates the call, marks it `presented`, calls `call.start({skipLobby, voiceOnly})`     | `stores/RoomViewStore.tsx:365-397`                                                                                |
| Owns the `Call` object per room, tracks connected calls, cleans up unclean disconnects | `stores/CallStore.ts`                                                                                             |
| `MainSplitContentType.Call` (also for video rooms)                                     | `components/structures/RoomView.tsx:600`, `:2673`                                                                 |
| Renders the call                                                                       | `components/views/voip/CallView.tsx` → `AppTile`                                                                  |
| Iframe + widget messaging + permissions                                                | `components/views/elements/AppTile.tsx`, `stores/widgets/WidgetMessaging.ts`                                      |
| Matrix API access for the widget                                                       | `stores/widgets/ElementWidgetDriver.ts`                                                                           |
| PiP when not viewing the room                                                          | `components/structures/PipContainer.tsx` → `viewmodels/room/WidgetPipViewModel.tsx` → `PersistentApp` → `AppTile` |

### 1.2 The `Call` abstraction

`models/Call.ts` holds `Call` (abstract) → `JitsiCall` and `ElementCall`. Notably, `Call` is _not_
transport-agnostic: it is documented as "a group call accessed through a widget" and holds
`widget: IApp`, `widgetUid`, and `widgetApi: ClientWidgetApi`. Its public surface — the part the
rest of EW depends on — is small and transport-neutral though:

- `connectionState` / `connected`, `participants`, `callType`, `presented`, `roomId`
- `start(params)`, `disconnect()`, `clean()`, `destroy()`
- events `ConnectionState`, `Participants`, `Close`, `Destroy`, `CallTypeChanged`

Everything else in EW consumes only that surface (via `CallStore` / `hooks/useCall.ts`):
room header buttons, `IncomingCallToast`, room list live indicators, timeline call tiles
(`viewmodels/room/timeline/event-tile/call/*`), `ResizerViewModel` / auto-collapse behaviours.
**`call.widget` leaks out of the model in only four files:** `CallView.tsx:48-52`,
`WidgetPipViewModel.tsx:128`, `RoomViewStore.tsx:387` (persistence), and `useRoomCall.ts:193-215`.
The last one is more than a type check: the hook _returns_ `groupCall?.widget` as the widget the room
header acts on, so the header's call handling depends on a widget object existing.

Participants already come from MatrixRTC directly, not from the widget:
`ElementCall` holds a `MatrixRTCSession` and derives `participants` from
`session.memberships` (`models/Call.ts:969-986`). The widget is only the _media/UI_ layer.

### 1.3 The "virtual widget" trick

EC has no widget state event. `ElementCall.createOrGetCallWidget()` registers a **virtual widget**
(`WidgetStore.addVirtualWidget`) whose URL points at the bundled EC build
(`webapp/widgets/element-call/index.html`, copied from `@element-hq/element-call-embedded` by
`webpack.config.ts:720`) or at `Developer.elementCallUrl`. That widget id is the identity used by
`ActiveWidgetStore` (docking/persistence), `PersistedElement` (`persistKey = "widget_" + id`),
and the PiP view model.

### 1.4 What the widget layer provides today

1. **Configuration**, as ~20 URL params (`generateWidgetUrl`): user/device/room id, `baseUrl`,
   `lang`, `theme`, `fontScale`, custom fonts, `perParticipantE2EE`, `intent` (start/join, DM,
   voice), `skipLobby`, `returnToLobby`, echo cancellation / noise suppression, ICE fallback,
   `rageshakeSubmitUrl`, and a _separate_ PostHog/Sentry configuration.
2. **Matrix access**, via `ElementWidgetDriver`: state events (RTC memberships, delayed events),
   to-device messages (encryption keys), sticky events, room state/timeline reads, RTC transports,
   TURN servers, OIDC token, media upload/download.
3. **Control plane**, as widget actions: `io.element.join`, `im.vector.hangup`, `io.element.close`,
   `io.element.device_mute` (`stores/widgets/ElementWidgetActions.ts`). These drive
   `setConnected()` / `setDisconnected()` / `close()` in the model, and `disconnect()` sends
   `HangupCall` to the widget and waits for the reply.
4. **Isolation & lifecycle plumbing**: iframe sandbox + `allow` for camera/microphone/display
   capture, permission prompts (`AppPermission`, `allowedWidgets`, module API pre-approval),
   mixed-content guard, popout, "widget died → treat as hangup", `beforeunload`.
5. **Survival across navigation**: `PersistedElement` renders the iframe in a separate React root
   attached to `document.body`, so switching rooms does not unmount the call; `ActiveWidgetStore`
   tracks dock/persistence and `PipContainer` re-hosts the same DOM node in the PiP dragger.

Items 1–3 become props/callbacks/direct `MatrixClient` use for a React component. Item 4 mostly
disappears (that is the point). **Item 5 is the one that does not go away** and is the main
architectural constraint: unmounting a React EC means tearing down media, so whatever we pick must
keep EC mounted while the user navigates. `PersistedElement` is widget-agnostic (it just takes
`children`), so it is reusable as-is — with two caveats that never mattered for an iframe:

- It renders its children in a **separate React root** and re-provides only `SDKContext`,
  `MatrixClientContext` and `TooltipProvider`. Any other context EC expects (theme, i18n, EC's own
  providers) has to be provided inside the persisted subtree.
- That root is wrapped in **`StrictMode`**, which double-invokes effects in development. A component
  that acquires media and joins a LiveKit room on mount will connect, disconnect and reconnect in
  dev builds. EC's mount effects must be idempotent, or the persisted root must not use `StrictMode`
  for the call.

### 1.5 Prerequisites outside EW

- `@element-hq/element-call-embedded@0.24.0` ships **only a built static app** (`dist/index.html`
  plus assets). A React entry point has to be published by EC first (component + its own deps:
  livekit-client, i18n, theming, state).
- EC would use EW's `MatrixClient` instance, so both must resolve to **one** `matrix-js-sdk`
  instance (peer dependency, not a nested copy). EW currently pins js-sdk to a git tarball.
- Analytics/Sentry: today EC has its own PostHog instance configured via URL params. In-process,
  either it reuses EW's or we keep two initialised instances in one page.
- No CSP/sandbox boundary any more: EC code runs with EW's privileges. Worth an explicit decision.

---

### 1.6 Later follow-up (out of scope): a driver-shaped EC ↔ EW contract

**Not part of this plan.** EC takes `(client, roomId, intent, config, hostBridge)` for now (see the decision above). At some
point the contract may move towards something close to `ElementWidgetDriver`, so the analysis of what
a "driver" is and is not in EW is kept here for when that work is picked up. Nothing in §2–§4 depends
on it.

The widget integration is actually **three** layers, only one of which is the iframe:

| Layer                                                             | Direction | Implemented in                                                                                                                                                                             | Fate when EC becomes a component             |
| ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Transport (`postMessage`, capability negotiation, action framing) | both      | `ClientWidgetApi` (from `matrix-widget-api`), created in `WidgetMessaging.start(iframe)`                                                                                                   | **deleted**                                  |
| Pull: what EC asks the client to do                               | EC → EW   | `ElementWidgetDriver` (`WidgetDriver` subclass)                                                                                                                                            | **kept** — this is the "driver" EC will take |
| Push: what the client tells EC, and client-side actions           | EW → EC   | `WidgetMessaging` (`feedEvent`, `feedToDevice`, `updateTheme`) plus the action handlers (`UpdateAlwaysOnScreen` → `ActiveWidgetStore.setWidgetPersistence`, `OpenModalWidget`, `ViewRoom`) | **kept, but has no home in `WidgetDriver`**  |

Concrete facts that follow from reading the code:

- **`WidgetDriver` is pull-only.** All methods (24 in `1.17`, ~28 in `1.19`) of `WidgetDriver` are
  one-shot requests (`sendEvent`, `sendStickyEvent`, `sendDelayedEvent`, `sendToDevice`,
  `readRoomState`, `readRoomTimeline`, `readStickyEvents`, `getTurnServers`, `getRtcTransports`,
  `uploadFile`/`downloadFile`, …; `askOpenID` answers through a `SimpleObservable`, but is still a
  request the widget initiates). There is **no** subscription/push method and **no**
  `setAlwaysOnScreen`. So "EC takes a driver" cannot mean _only_ a `WidgetDriver`: the object EC
  receives has to be a superset — driver + event feed + client actions (sticky/close/hangup/mute).
  Call it the **EC host object**.
- **`ElementWidgetDriver` is already ~90% widget-independent.** `forWidget` / `forWidgetKind` are
  referenced only in the constructor's capability grants, in `validateCapabilities`, and in
  `askOpenID`. Every data method goes straight to `MatrixClientPeg` + `inRoomId`
  (`ElementWidgetDriver.ts:316-873`). Reusing it in-process is realistic; the widget-shaped part is
  exactly the permission machinery.
- **For EC that permission machinery is already a no-op.** The `virtual && WidgetType.CALL` branch
  (`ElementWidgetDriver.ts:123-246`) hand-grants dozens of capabilities (25 `add` calls, several of
  them looping over event-type lists) and force-sets `OIDCState.Allowed`. In-process,
  `validateCapabilities` collapses to "allow everything", i.e. those ~120 lines become dead code.
- **The driver interface is itself becoming EC-shaped.** `getRtcTransports` is implemented today;
  upstream `matrix-widget-api@1.19` is understood to add `getRtcLivekitToken` and
  `delegateRtcLivekitDelayedLeave` (EW is on `^1.18.0`, installed `1.18.0`, and does not implement
  them). _Unverified from this checkout: only 1.17/1.18 are present locally; confirm against the
  upstream changelog before relying on it._ The driver
  is where the EC↔client contract is being standardised — which is an argument for keeping it as
  the seam rather than replacing it with ad-hoc props.
- **Sticky/PiP is a client action, not a driver call.** Today EC asks via
  `UpdateAlwaysOnScreen`; `WidgetMessaging` awaits `stickyPromise` (which `CallView` uses to hang up
  every other connected call) and then flips `ActiveWidgetStore` persistence
  (`WidgetMessaging.ts:378-397`). Whoever hosts the React EC must provide this method.

**Consequence, when this is picked up:** the refactor would be "split `WidgetMessaging` +
`ElementWidgetDriver` into a transport-independent **EC host** and a thin iframe transport". For the
current plan the only piece of this that is needed is the **control plane** (join / hangup / close /
ready / sticky between the mounted component and the `Call` model), which is a handful of callbacks,
not a driver. It is covered in §4 step 1.

---

## 2. Options for mounting

### Option A — New view sibling, chosen in `CallView` (view-layer only)

`CallView` branches: if the React EC is enabled, render `<ElementCall …/>` (wrapped in
`PersistedElement`), otherwise the existing `AppTile`.

- Diff: `CallView.tsx` only (~20 lines) for the docked case.
- Keeps `RoomView`, `CallStore`, header buttons, toasts, timeline tiles untouched.
- Does **not** by itself solve the control plane or PiP.
- Good first step; not sufficient on its own.

### Option B′ — `ElementCallAppTile`: same public API as `AppTile`, React body instead of iframe

A **new, separate** component (not a flag on `AppTile`) that accepts the same props and reproduces
the parts of `AppTile`'s lifecycle that are not about iframes, then renders `<ElementCall …/>` as its
body. Both `AppTile` call sites for calls (`CallView`, `PersistentApp`) can then swap component by
one import each — ideally via a one-line selector so the choice lives in a single place.

_(This supersedes the earlier "add a flag to `AppTile`" framing, which is not recommended: the
problem there was mutating a 900-line component shared with real widgets, not the API shape.)_

### Option C — Make the `Call` abstraction transport-agnostic

Split `Call` into a transport-neutral base (state machine + participants + events, which is all EW
consumes) plus a `WidgetCall` layer (widget uid, `widgetApi`, messaging-store waiting), then add
`ElementCallReact extends Call` whose `start()`/`disconnect()` talk to the mounted component.
`Call.get()` picks the implementation from a flag. `call.widget` becomes optional at its four
leaking call sites.

### Option D — Mount once at app root and portal into containers

Cleanest persistence story, but duplicates what `PersistedElement` + `PipContainer` already do and
touches `MatrixChat`. Only worth it if we also retire `PersistedElement`.

### Option E — In-process widget API bridge (no iframe, no change in EC)

Keep `ClientWidgetApi` but swap `postMessage` for a same-process transport. Near-zero EW diff, keeps
the entire widget indirection. Useful only as a transitional step.

---

## 3. Head-to-head: A + C vs. `ElementCallAppTile` (B′)

### 3.1 What the two actually look like

**A + C** — the widget disappears from the design; a second `Call` implementation and a second view:

```tsx
// models/Call.ts — new sibling, no widget
class ElementCallReact extends Call {
    constructor(session: MatrixRTCSession, room: Room, client: MatrixClient) { … }
    public async start(params) { /* wait for the component to report ready */ }
    protected async performDisconnection() { await this.host.hangup(); }
}

// components/views/voip/CallView.tsx
return call instanceof ElementCallReact ? (
    <ElementCallReactView call={call} resizing={resizing} /> // owns PersistedElement + docking
) : (
    <AppTile app={call.widget} … /> // unchanged widget path
);
```

**B′** — the widget stays as an identity token; one component, drop-in at both call sites:

```tsx
// components/views/voip/ElementCallAppTile.tsx
type Props = Pick<ComponentProps<typeof AppTile>,
    "app" | "room" | "userId" | "creatorUserId" | "miniMode" | "fullWidth" |
    "pointerEvents" | "overlay" | "movePersistedElement" | "stickyPromise" | …>;

// components/views/voip/CallTile.tsx — the single decision point.
// Must read the flag at render time (settings are not loaded at import time, and the
// flag can change), so this is a component, not a module-scope ternary.
export const CallTile = (props: ComponentProps<typeof AppTile>): JSX.Element => {
    const reactCall = useSettingValue("feature_element_call_react");
    return reactCall ? <ElementCallAppTile {...props} /> : <AppTile {...props} />;
};
```

`CallView` and `PersistentApp` then import `CallTile` instead of `AppTile`. `PersistentApp` is only
rendered by `WidgetPipViewModel`, and `CallTile` checks the widget type itself, so `WidgetPipViewModel`,
`PipContainer`, `ActiveWidgetStore`, `RoomViewStore` and `CallStore` need **no** changes.

### 3.2 Comparison

|                                                                                                                                                                                                                                                  | **A + C**                                                                                                                                                                                                                                                               | **B′ `ElementCallAppTile`**                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New files                                                                                                                                                                                                                                        | `ElementCallReactView.tsx`, PiP variant of `PersistentApp`, `ElementCallReact` in `models/Call.ts`                                                                                                                                                                      | `ElementCallAppTile.tsx`, `CallTile.tsx`                                                                                                                                                |
| Existing files touched                                                                                                                                                                                                                           | `CallView.tsx`, `models/Call.ts` (split `Call`/`WidgetCall`), `WidgetPipViewModel.tsx`, `RoomViewStore.tsx`, `useRoomCall.ts`, `CallStore.ts` (impl selection)                                                                                                          | `CallView.tsx`, `PersistentApp.tsx` (one import each), `models/Call.ts` (control plane)                                                                                                 |
| Rough diff (view layer + control-plane callbacks; a later driver/host extraction per §1.6 is not included)                                                                                                                                       | ~400–600 lines, spread over stores + model + views                                                                                                                                                                                                                      | ~200–250 lines, concentrated in two new view files                                                                                                                                      |
| Call sites made drop-in?                                                                                                                                                                                                                         | No — each view is bespoke                                                                                                                                                                                                                                               | Yes — compiler-enforced if typed from `ComponentProps<typeof AppTile>`                                                                                                                  |
| PiP / persistence                                                                                                                                                                                                                                | Must be re-plumbed: `ActiveWidgetStore` is keyed by `(widgetId, roomId)`, and `PipContainer` picks its candidate from `getPersistentWidgetId()`. Without a widget you need a parallel registry, or you keep the virtual widget anyway (in which case C bought you less) | Free. Same `persistKey`, same `ActiveWidgetStore` keys, same `PipContainer` candidate selection, same `PersistedElement`                                                                |
| Lifecycle rules that must be reproduced (dock/undock, `isLive` "another container is keeping it alive", `destroyPersistentWidget`, `PersistedElement.destroyElement`, leave-room/`AfterLeaveRoom` teardown, `stickyPromise` before going sticky) | Yes, in the new views — and twice if docked and PiP views differ                                                                                                                                                                                                        | Yes, but once, in one component, copied from a known-good implementation                                                                                                                |
| Where the control plane (later: host object) lives                                                                                                                                                                                               | Owned by the `Call` model (`ElementCallReact.host`) — survives navigation naturally, since `CallStore` owns the call                                                                                                                                                    | Owned by the tile, mirroring `WidgetMessaging` — needs the same "don't destroy while persistent" rule the widget path already has                                                       |
| EC's API is `(client, roomId, intent, config, hostBridge)` (**decided**)                                                                                                                                                                         | Natural fit; the model has both already                                                                                                                                                                                                                                 | Fine, but the `app: IWidget` prop is then pure ceremony                                                                                                                                 |
| If EC's API later becomes a driver-like host object (follow-up, §1.6)                                                                                                                                                                            | The `Call` split does not help with it: you still need the driver extracted out of `WidgetMessaging`, and `Call` is the wrong owner for `feedEvent`-style plumbing                                                                                                      | Better fit: the tile is exactly where `WidgetMessaging` + `ElementWidgetDriver` are constructed today, so the host can be built the same way, minus the iframe                          |
| Reuse of `ElementWidgetDriver`                                                                                                                                                                                                                   | Awkward (needs a `Widget` for capabilities/OIDC, which the model would have to fabricate)                                                                                                                                                                               | Direct: the virtual widget is still there, so `new ElementWidgetDriver(widget, WidgetKind.Room, true, roomId)` works unchanged on day one, and can be slimmed later                     |
| Widget concepts remaining in the design                                                                                                                                                                                                          | Few — that is the point                                                                                                                                                                                                                                                 | Many: `IApp`/`IWidget` identity, `WidgetUtils.getWidgetUid`, `getPersistKey("widget_"+id)`, virtual widget in `WidgetStore` (incl. the `CallStore.inUpdateRoom` re-entrancy guard)      |
| Risk to existing widgets (Jitsi, third-party, `AppsDrawer`, `WidgetCard`)                                                                                                                                                                        | Low (`AppTile` untouched)                                                                                                                                                                                                                                               | Low (`AppTile` untouched — this is the difference from the original Option B)                                                                                                           |
| Meaningless props inherited                                                                                                                                                                                                                      | None                                                                                                                                                                                                                                                                    | ~8: `waitForIframeLoad`, `showPopout`, `showTitle`, `showLayoutButtons`, `showMenubar`, `onEditClick`, `onDeleteClick`, `threadId`, `widgetPageTitle`, `userWidget`                     |
| `models/Call.ts` changes needed                                                                                                                                                                                                                  | Large by design (class split)                                                                                                                                                                                                                                           | Small but real: `start()`/`performDisconnection()`/`close()` must go through an injected host instead of `widgetApi`; `Call.widgetApi` becomes one interface behind two implementations |
| Testability                                                                                                                                                                                                                                      | New unit surface for `ElementCallReact`; `test-utils/call.ts` `MockedCall` helpers need a second flavour                                                                                                                                                                | Existing `MockedCall`/`useMockedCalls` helpers keep working; the tile is testable with the mock component                                                                               |
| Playwright                                                                                                                                                                                                                                       | Widget-path specs unaffected while flagged off; new specs need a mounted-component story                                                                                                                                                                                | Same                                                                                                                                                                                    |
| Rollback                                                                                                                                                                                                                                         | Flag flips two subsystems (model + view)                                                                                                                                                                                                                                | Flag flips one component reference                                                                                                                                                      |
| Trajectory to a widget-free design                                                                                                                                                                                                               | Direct, but pays the whole cost before EC's real API is known                                                                                                                                                                                                           | Two-step: ship the tile now, then delete widget identity once the widget path is retired (the `Call` split of C becomes a pure cleanup, with no coexistence burden)                     |

### 3.3 The decisive points

1. **A + C does not actually escape the widget for PiP.** `ActiveWidgetStore`,
   `PipContainer.getPersistentWidgetId()`, `RoomViewStore`'s voice-call-in-PiP path
   (`RoomViewStore.tsx:387`) and `PersistedElement`'s `persistKey` are all keyed by widget id. Either
   C keeps the virtual widget — and then it is B′ with more files — or it also introduces a parallel
   "persistent call" registry, which is a much bigger change than the plan's "keep the diff minimal".
2. **The tile is the natural home for the control plane, now and later.** Even with `(client,
session)`, someone has to wire join / hangup / close / ready / sticky between the component and
   the `Call` model, and that wiring is constructed per `(widget, room)` with a lifetime matching the
   persisted DOM — exactly `AppTile`'s contract. If a driver/host object comes later (§1.6), it slots
   into the same place; putting it in the `Call` model would give the model `feedEvent`/theme/sticky
   responsibilities it has no business owning.
3. **B′ is compiler-enforced drop-in; A+C is hand-rolled parity.** The lifecycle rules in `AppTile`
   (dock/undock, `isLive`, persistence-aware teardown) are subtle and were bug-fixed over years.
   Reimplementing them in two bespoke views is where regressions like "call keeps running after
   leaving the room" or "PiP dies on room switch" come from.
4. **A + C is still the right _end_ state.** Once the widget path is deleted, `Call`'s widget
   coupling is dead weight, and the split becomes cheap and safe. Doing it _now_ means maintaining
   two `Call` implementations plus two view paths while EC's API is still moving.

### 3.4 Where each one hurts

- **A + C:** parallel persistence registry (or a kept virtual widget that undermines the point); two
  `Call` implementations to keep in sync (`presented`/`checkDestroy`, `beforeunload`,
  `MyMembership`, participants); `call.widget` becomes optional, so its four consumers grow branches;
  `CallStore`'s widget-driven `updateRoom` path needs a non-widget trigger.
- **B′:** inherits an iframe-shaped prop surface; keeps the virtual widget (and its `WidgetStore`
  re-entrancy quirk) alive longer; "same public API as `AppTile`" is a contract that must be
  maintained by hand as `AppTile` evolves — worth pinning with
  `satisfies ComponentProps<typeof AppTile>` and a test that renders both with the same props.

---

## 4. Recommendation (revised)

**Ship B′ (`ElementCallAppTile`) with a minimal in-process control plane; keep C as the follow-up
cleanup. No driver/host extraction in this plan.**

1. **Define a minimal control-plane interface** between the mounted EC component and the `Call`
   model: component → model `onJoined` / `onHangup` / `onClose` / `onReady`, model → component
   `hangup()`, plus `setAlwaysOnScreen` (sticky) and `setDeviceMute`. This is the in-process
   replacement for the four widget actions in `ElementWidgetActions.ts` — a small callbacks object,
   **not** `ElementWidgetDriver` and not `WidgetMessaging`. Matrix access is EC's own business via
   the `client`/`session` props.
2. **Add a transport seam in `ElementCall`, not a class split.** Replace direct `widgetApi` use in
   `start()`/`performDisconnection()`/`close()`/`onJoin`/`onHangup`/`onClose` with the control-plane
   interface from step 1, implemented by (a) the widget path (over `ClientWidgetApi`) and (b) the
   in-process path. One class, two transports — much smaller than Option C and it keeps
   `presented`/`checkDestroy`/participants logic single-sourced. This includes **readiness**: today
   `start()` waits for `WidgetMessagingStore` to report the widget uid ready
   (`models/Call.ts:226-271`). The in-process path needs an equivalent signal from the mounted tile
   (`onReady` when the component mounts), and the same timeout/`ConnectionState` handling on failure
   to mount.
3. **Add `ElementCallAppTile` with `AppTile`'s prop shape**, reproducing only the non-iframe
   lifecycle: `PersistedElement` (`zIndex` 9 docked / 101 mini), `ActiveWidgetStore` dock/undock,
   persistence-aware teardown, leave-room teardown, `stickyPromise` before going sticky,
   `pointerEvents`/`overlay`/`movePersistedElement` passthrough, and the `mx_AppTileBody--call`
   classes so existing CSS applies.
4. **Introduce one selector** (`CallTile`) used by `CallView` and `PersistentApp`, gated on a labs
   flag (`feature_element_call_react`) and on the widget type.
5. **Move configuration from URL params to props/context** — keep `generateWidgetUrl`'s decision
   logic (intent, `skipLobby`, `returnToLobby`, `perParticipantE2EE`, theme/lang/fontScale/fonts,
   audio processing, rageshake/analytics) and change only its output shape, so both paths stay honest.
6. **Then do C.** When the widget path is removed: delete the virtual widget, fold the host into a
   plain `ElementCall`, drop `call.widget` and the EC branches of `ElementWidgetDriver`/`AppTile`.

The step-by-step implementation of this recommendation is laid out in
[element-call-react-plan.md](./element-call-react-plan.md#implementation-plan-option-b--elementcallapptile).

Take Option A's `CallView` branch only if `ElementCallAppTile` turns out to need a materially
different prop shape (e.g. EC needs the `MatrixRTCSession` and nothing else); it is a one-line change
either way. Options D and E stay out of scope: D duplicates `PersistedElement`/`PipContainer`, E
keeps the whole widget indirection.

### Suggested order of work

0. ~~Settle EC's input shape with the EC team~~ — **done:** EC's public `ElementCall` component with a `HostBridge`; driver work deferred.
1. Mock component (done) + a dev-only render path to see it in a room.
2. Control-plane interface in `ElementCall`, widget path still using it over `ClientWidgetApi` (no
   behaviour change, fully testable on its own).
3. `ElementCallAppTile` + `CallTile` selector, docked case, behind the flag.
4. PiP: verify room switching mid-call, sticky/`AlwaysOnScreen`, and hang-up-other-calls.
5. Swap the mock for EC's real React export; move config to props.
6. Delete the widget path, then do the Option C cleanup.
7. _(Separate plan, later.)_ Driver/host-object contract per §1.6, if EC wants it.

### Open questions

- Does EC manage its own MatrixRTC membership (i.e. does it want the `MatrixRTCSession`, or does EW
  keep owning `MembershipManager`)? This decides who owns `connect()`.
- _(Deferred with §1.6.)_ If a host/driver object comes later: does it need capability checks at all
  for a trusted, bundled EC, or is `validateCapabilities` simply gone in-process?
- One js-sdk instance: EC as a peer-dep consumer of EW's `MatrixClient`.
- Analytics: one PostHog instance or two, and how anonymity/consent is threaded through.
- Do we keep a widget path for third-party/self-hosted EC deployments (`Developer.elementCallUrl`)?
  This decides the **end state**, not just a detail: if yes, `AppTile` and the iframe transport are
  permanent, B′'s coexistence is a feature, and step 6 above ("delete the widget path, then do C")
  never happens — the virtual widget stays as the shared identity for both transports. If no, step 6
  stands. The recommendation is written assuming "no"; flip it explicitly if that is wrong.
