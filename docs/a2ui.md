# A2UI (agent UI) prototype

Element Web can render [A2UI](https://a2ui.org/) surfaces sent by agents and bots as interactive forms in the
timeline, and report the user's actions back. This is a prototype behind the **Interactive agent messages (A2UI)**
labs flag (`feature_a2ui`). Event types use the `io.element` unstable prefix and may change.

## Event formats

### Rendering a surface

An agent renders UI by sending an `m.room.message` with `msgtype` `io.element.a2ui`. The `body` is a plain-text
fallback shown by clients without A2UI support, and `messages` is a list of A2UI v0.9 server-to-client messages
(`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`) that build one or more surfaces.

```json
{
    "type": "m.room.message",
    "content": {
        "msgtype": "io.element.a2ui",
        "body": "Please fill in the contact form.",
        "messages": [
            { "version": "v0.9", "createSurface": { "surfaceId": "main" } },
            {
                "version": "v0.9",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": [
                        { "id": "root", "component": "Column", "children": ["title", "name", "subscribe", "submit"] },
                        { "id": "title", "component": "Text", "text": "Contact us", "variant": "h2" },
                        {
                            "id": "name",
                            "component": "TextField",
                            "label": "Name",
                            "value": { "path": "/contact/name" }
                        },
                        {
                            "id": "subscribe",
                            "component": "CheckBox",
                            "label": "Subscribe to the newsletter",
                            "value": { "path": "/contact/subscribe" }
                        },
                        {
                            "id": "submit",
                            "component": "Button",
                            "child": "submitLabel",
                            "variant": "primary",
                            "action": {
                                "event": {
                                    "name": "submitContactForm",
                                    "context": { "formId": "contact_form_1", "contact": { "path": "/contact" } }
                                }
                            }
                        },
                        { "id": "submitLabel", "component": "Text", "text": "Send" }
                    ]
                }
            },
            {
                "version": "v0.9",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": { "contact": { "name": "", "subscribe": false } }
                }
            }
        ]
    }
}
```

The surface is rendered once a component with `id` `root` exists. Bindings (`{ "path": "/..." }`) are JSON Pointers
into the surface's data model. Inputs bound to a path write the user's edits back into the data model, so bindings in
an action's `context` report the current values.

### Updating a surface

Later changes to the same surfaces are sent as `io.element.a2ui.update` events related to the original message with
an `m.reference` relation. Only updates from the sender of the original message are applied, in the order received.

```json
{
    "type": "io.element.a2ui.update",
    "content": {
        "m.relates_to": { "rel_type": "m.reference", "event_id": "$surface_event_id" },
        "messages": [
            { "version": "v0.9", "updateDataModel": { "surfaceId": "main", "path": "/contact/name", "value": "Alice" } }
        ]
    }
}
```

### Reporting a user action

When the user presses a button, Element sends an `io.element.a2ui.action` event with the A2UI client-to-server
`action` message, related to the original message with `m.reference`. If the surface was created with
`sendDataModel: true`, the surface's data model is included as `dataModel`.

```json
{
    "type": "io.element.a2ui.action",
    "content": {
        "m.relates_to": { "rel_type": "m.reference", "event_id": "$surface_event_id" },
        "version": "v0.9",
        "action": {
            "name": "submitContactForm",
            "surfaceId": "main",
            "sourceComponentId": "submit",
            "timestamp": "2026-10-23T14:00:00.000Z",
            "context": { "formId": "contact_form_1", "contact": { "name": "Alice", "subscribe": true } }
        }
    }
}
```

Update and action events are not shown in the timeline.

## Supported components

From the A2UI basic catalog: `Text`, `Image`, `Icon`, `Video`, `Row`, `Column`, `List` (including template
children), `Card`, `Tabs`, `Divider`, `Button` (server `event` actions only), `TextField`, `CheckBox`,
`ChoicePicker`, `Slider` and `DateTimeInput`. Other components render as an "Unsupported component" notice. Client-side `functionCall`
actions, `checks` validation and theming are not implemented.

Catalog icon names map onto the closest Compound icon; names with no equivalent (`payment`, `print`, `rewind`,
`shoppingCart`, `skipNext`, `skipPrevious`) show a generic icon. An `Icon` may also carry its own `svgPath`, which
is drawn in a 24x24 viewBox.

Image and video URLs must be `http(s)` or `mxc` URLs. `mxc` URLs are converted to the homeserver's media endpoint,
using authenticated media where the homeserver supports it. Images and videos follow the same media preview rules
as timeline attachments: when previews are off for the sender, a "Show image" or "Show video" placeholder is shown
and the choice to reveal is remembered per message. Feature-sized images open in the full-size image viewer when
clicked; videos render in a native player with controls and load metadata only until played.

## Trying it out

Enable the labs flag, then in a room open **Developer tools → Send custom timeline event** and fill in:

- **Event Type**: `m.room.message`
- **Event Content**: only the value of `content` from the example above, starting at `{ "msgtype": ... }`. Pasting
  the whole example, including `type`, wraps the real content in a `content` key and the message renders as raw
  JSON instead.

Pressing the button sends the action event, which you can inspect with **Explore room state** or the network tab.

## Code

- `packages/shared-components/src/a2ui/`: protocol types, `A2UISurface` (applies messages, resolves bindings) and
  the `A2UISurfaceView` renderer. Stories live under "A2UI" in Storybook.
- `apps/web/src/a2ui/A2UIEvents.ts`: the Matrix event formats above.
- `apps/web/src/viewmodels/message-body/A2UIBodyViewModel.ts`: builds surfaces from an event and its updates, and
  sends action events.
- `apps/web/src/components/views/messages/MA2UIBody.tsx`: the timeline body, registered for the
  `io.element.a2ui` msgtype in `MessageEvent`.
