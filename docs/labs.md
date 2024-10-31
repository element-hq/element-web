# Labs features

If Labs is enabled in the [Element config](config.md), you can enable some of these features by going
to `Settings->Labs`. This list is non-exhaustive and subject to change, chat in
[#element-web:matrix.org](https://matrix.to/#/#element-web:matrix.org) for more information.

If a labs features gets more stable, it _may_ be promoted to a beta feature
(see [Betas](https://github.com/element-hq/element-web/blob/develop/docs/betas.md)).

**Be warned! Labs features are not finalised, they may be fragile, they may change, they may be
dropped. Ask in the room if you are unclear about any details here.**

## Submit Abuse Report to Moderators [MSC3215](https://github.com/matrix-org/matrix-doc/pull/3215) support (`feature_report_to_moderators`)

A new version of the "Report" dialog that lets users send abuse reports directly to room moderators,
if the room supports it.

## Render LaTeX maths in messages (`feature_latex_maths`)

Enables rendering of LaTeX maths in messages using [KaTeX](https://katex.org/). LaTeX between single dollar-signs is interpreted as inline maths and double dollar-signs as display maths (i.e. centred on its own line).

## Message pinning (`feature_pinning`)

Allows you to pin messages in the room. To pin a message, use the 3 dots to the right of the message
and select "Pin".

## Jump to date (`feature_jump_to_date`)

Note: This labs feature is only visible when your homeserver has MSC3030 enabled
(in Synapse, add `experimental_features` -> `msc3030_enabled` to your
`homeserver.yaml`) which means `GET /_matrix/client/versions` responds with
`org.matrix.msc3030` under the `unstable_features` key.

Adds a dropdown menu to the date separator headers in the timeline which allows
you to jump to last week, last month, the beginning of the room, or choose a
date from the calendar.

Also adds the `/jumptodate 2022-01-31` slash command.

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

The setting will be removed in a future release, enabling it non-optionally for
all users.

## Bridge info tab (`feature_bridge_state`)

Adds a "Bridge Info" tab to the Room Settings dialog, if a compatible bridge is
present in the room. The Bridge info tab pulls information from the `m.bridge` state event ([MSC2346](https://github.com/matrix-org/matrix-doc/pull/2346)). Since the feature is based upon a MSC, most
bridges are not expected to be compatible, and users should not rely on this
tab as the single source of truth just yet.

## Custom themes (`feature_custom_themes`)

Custom themes are possible through Element's [theme support](./theming.md), though
normally these themes need to be defined in the config for Element. This labs flag
adds an ability for end users to add themes themselves by using a URL to the JSON
theme definition.

For some sample themes, check out [aaronraimist/element-themes](https://github.com/aaronraimist/element-themes).

## Live location sharing (`feature_location_share_live`) [In Development]

Enables sharing your current location to the timeline, with live updates.

## Video rooms (`feature_video_rooms`)

Enables support for creating video rooms, which are persistent video chats that users can jump in and out of.

## Element Call video rooms (`feature_element_call_video_rooms`) [In Development]

Enables support for video rooms that use Element Call rather than Jitsi, and causes the 'New video room' option to create Element Call video rooms rather than Jitsi ones.

This flag will not have any effect unless `feature_video_rooms` is also enabled.

## New group call experience (`feature_group_calls`) [In Development]

This feature allows users to place native [MSC3401](https://github.com/matrix-org/matrix-spec-proposals/pull/3401) group calls in compatible rooms, using Element Call.

If you're enabling this at the deployment level, you may also want to reference the docs for the `element_call` config section.

## Disable per-sender encryption for Element Call (`feature_disable_call_per_sender_encryption`)

The default for embedded Element Call in Element Web is per-participant encryption.
This labs flag disables encryption for embedded Element Call in encrypted rooms.

Under the hood this stops Element Web from adding the `perParticipantE2EE` flag for the Element Call widget url.

This is useful while we experiment with encryption and to make calling compatible with platforms that don't use encryption yet.

## Rich text in room topics (`feature_html_topic`) [In Development]

Enables rendering of MD / HTML in room topics.

## Enable the notifications panel in the room header (`feature_notifications`)

Unreliable in encrypted rooms.

## Knock rooms (`feature_ask_to_join`) [In Development]

Enables knock feature for rooms. This allows users to ask to join a room.
