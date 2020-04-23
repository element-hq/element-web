# Labs features

If Labs is enabled in the [Riot config](config.md), you can enable some of these features by going
to `Settings->Labs`. This list is non-exhaustive and subject to change, chat in
[#riot-web:matrix.org](https://matrix.to/#/#riot-web:matrix.org) for more information.

**Be warned! Labs features are not finalised, they may be fragile, they may change, they may be
dropped. Ask in the room if you are unclear about any details here.**

## Message pinning (`feature_pinning`)

Allows you to pin messages in the room. To pin a message, use the 3 dots to the right of the message
and select "Pin".

## Custom status (`feature_custom_status`)

An experimental approach for supporting custom status messages across DMs. To set a status, click on
your avatar next to the message composer.

## Custom tags (`feature_custom_tags`)

An experimental approach for dealing with custom tags. Custom tags will appear in the bottom portion
of the community filter panel.

Setting custom tags is not supported by Riot.

## Render simple counters in room header (`feature_state_counters`)

Allows rendering of labelled counters above the message list.

Once enabled, send a custom state event to a room to set values:

1. In a room, type `/devtools` to bring up the devtools interface
2. Click "Send Custom Event"
3. Toggle from "Event" to "State Event"
4. Set the event type to: `re.jki.counter` and give it a unique key
5. Specify the content in the following format:

```
{
    "link": "",
    "severity": "normal",
    "title": "my counter",
    "value": 0
}
```

That's it. Now should see your new counter under the header.

## Multiple integration managers (`feature_many_integration_managers`)

Exposes a way to access all the integration managers known to Riot. This is an implementation of [MSC1957](https://github.com/matrix-org/matrix-doc/pull/1957).

## New ways to ignore people (`feature_mjolnir`)

When enabled, a new settings tab appears for users to be able to manage their ban lists.
This is a different kind of ignoring where the ignored user's messages still get rendered,
but are hidden by default.

Ban lists are rooms within Matrix, proposed as [MSC2313](https://github.com/matrix-org/matrix-doc/pull/2313).
[Mjolnir](https://github.com/matrix-org/mjolnir) is a set of moderation tools which support
ban lists.

## Verifications in DMs (`feature_dm_verification`)

An implementation of [MSC2241](https://github.com/matrix-org/matrix-doc/pull/2241). When enabled, verification might not work with devices which don't support MSC2241.

This also includes a new implementation of the user & member info panel, designed to share more code between showing community members & room members. Built on top of this new panel is also a new UX for verification from the member panel.

## Cross-signing

Cross-signing ([MSC1756](https://github.com/matrix-org/matrix-doc/pull/1756))
improves the device verification experience by allowing you to verify a user
instead of verifying each of their devices.

The feature is enabled by default and does not follow a traditional labs flag
at the moment. If something goes wrong, add this to your config to disable it:
```json
{
  "settingDefaults": {
    "feature_cross_signing": false  
  }
}
```

The setting will be removed in a future release, enabling it non-optionally for
all users.

## Bridge info tab (`feature_bridge_state`)

Adds a "Bridge Info" tab to the Room Settings dialog, if a compatible bridge is
present in the room. The Bridge info tab pulls information from the `m.bridge` state event ([MSC2346](https://github.com/matrix-org/matrix-doc/pull/2346)). Since the feature is based upon a MSC, most
bridges are not expected to be compatible, and users should not rely on this
tab as the single source of truth just yet.

## Presence indicator in room list (`feature_presence_in_room_list`)

This adds a presence indicator in the room list next to DM rooms where the other
person is online.

## Show padlocks on invite only rooms (`feature_invite_only_padlocks`)

This adds padlocks to room list tiles and room header for invite only rooms.
This feature flag (unlike most) is enabled by default.

## Custom themes (`feature_custom_themes`)

Custom themes are possible through Riot's [theme support](./theming.md), though
normally these themes need to be defined in the config for Riot. This labs flag
adds an ability for end users to add themes themselves by using a URL to the JSON
theme definition.

For some sample themes, check out [aaronraimist/riot-web-themes](https://github.com/aaronraimist/riot-web-themes).
