# A2UI (agent UI) prototype

Element Web can render [A2UI](https://a2ui.org/) surfaces sent by agents and bots as interactive UI in the timeline,
and report the user's actions back. The Matrix event formats and which components and functions each client supports
are documented in [A2UI over Matrix](https://github.com/hughns/a2ui-prototype/blob/main/A2UI.md); this page covers
what is specific to Element Web.

Enable the **Interactive agent messages (A2UI)** labs flag (`feature_a2ui`).

## Behaviour

- Buttons are disabled while an action is being sent, and a failure shows "Your response could not be sent. Please
  try again." under the surfaces.
- `openUrl` buttons render as links styled as buttons. They show the URL as a tooltip and stay usable while an
  action is sending. They follow the same rules as links in message text: permalinks to users, rooms and events
  (such as `matrix.to` links) open inside Element, and other links open in a new tab. `matrix:` URIs are turned
  into `matrix.to` links first, so they open the same way.
- `mxc` URLs use authenticated media where the homeserver supports it.
- Images and videos follow the same media preview rules as timeline attachments: when previews are off for the
  sender, a "Show image" or "Show video" placeholder is shown, and the choice to reveal is remembered per message.
- Videos render in a native player with controls and load only their metadata until played.

## Trying it out

Open **Developer tools → Send custom timeline event** in a room and fill in:

- **Event Type**: `m.room.message`
- **Event Content**: only the value of `content` from the
  [example in A2UI over Matrix](https://github.com/hughns/a2ui-prototype/blob/main/A2UI.md#creating-surfaces),
  starting at `{ "msgtype": ... }`. Pasting the whole example, including `type`, wraps the real content in a
  `content` key and the message renders as raw JSON instead.

Pressing the button sends the action event, which you can inspect with **Explore room state** or the network tab.

## Code

- `packages/shared-components/src/a2ui/`: protocol types, `A2UISurface` (applies messages, resolves bindings and
  actions) and the `A2UISurfaceView` renderer. Stories live under "A2UI" in Storybook.
- `apps/web/src/a2ui/A2UIEvents.ts`: the Matrix event formats.
- `apps/web/src/viewmodels/message-body/A2UIBodyViewModel.ts`: builds surfaces from an event, its edits and its
  updates, and sends action events.
- `apps/web/src/components/views/messages/MA2UIBody.tsx`: the timeline body, registered for the
  `io.element.a2ui` msgtype in `MessageEvent`.
