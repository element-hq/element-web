Changes in [1.9.8](https://github.com/vector-im/element-web/releases/tag/v1.9.8) (2021-12-20)
=============================================================================================

## ✨ Features
 * Include Vietnamese language ([\#20029](https://github.com/vector-im/element-web/pull/20029)).
 * Simple static location sharing ([\#19754](https://github.com/vector-im/element-web/pull/19754)).
 * Add support for the Indonesian language ([\#20032](https://github.com/vector-im/element-web/pull/20032)). Fixes #20030. Contributed by @Linerly.
 * Always unhide widgets on layout change (pinning a widget) ([\#7299](https://github.com/matrix-org/matrix-react-sdk/pull/7299)).
 * Update status message in the member list and user info panel when it is changed ([\#7338](https://github.com/matrix-org/matrix-react-sdk/pull/7338)). Fixes #20127. Contributed by @SimonBrandner.
 * Iterate space panel toggle collapse interaction ([\#7335](https://github.com/matrix-org/matrix-react-sdk/pull/7335)). Fixes #20079.
 * Spotlight search labs ([\#7116](https://github.com/matrix-org/matrix-react-sdk/pull/7116)). Fixes #19530.
 * Put room settings form elements in fieldsets ([\#7311](https://github.com/matrix-org/matrix-react-sdk/pull/7311)).
 * Add descriptions to ambiguous links for screen readers ([\#7310](https://github.com/matrix-org/matrix-react-sdk/pull/7310)).
 * Make tooltips keyboard accessible ([\#7281](https://github.com/matrix-org/matrix-react-sdk/pull/7281)).
 * Iterate room context menus for DMs ([\#7308](https://github.com/matrix-org/matrix-react-sdk/pull/7308)). Fixes #19527.
 * Update space panel expand mechanism ([\#7230](https://github.com/matrix-org/matrix-react-sdk/pull/7230)). Fixes #17993.
 * Add CSS variable to make the UI gaps consistent and fix the resize handle position ([\#7234](https://github.com/matrix-org/matrix-react-sdk/pull/7234)). Fixes #19904 and #19938.
 * Custom location sharing. ([\#7185](https://github.com/matrix-org/matrix-react-sdk/pull/7185)).
 * Simple static location sharing ([\#7135](https://github.com/matrix-org/matrix-react-sdk/pull/7135)).
 * Finish sending pending messages before leaving room ([\#7276](https://github.com/matrix-org/matrix-react-sdk/pull/7276)). Fixes #4702.
 * Dropdown follow wai-aria practices for expanding on arrow keys ([\#7277](https://github.com/matrix-org/matrix-react-sdk/pull/7277)). Fixes #3687.
 * Expose PL control for pinned events when lab enabled ([\#7278](https://github.com/matrix-org/matrix-react-sdk/pull/7278)). Fixes #5396.
 * In People & Favourites metaspaces always show all rooms ([\#7288](https://github.com/matrix-org/matrix-react-sdk/pull/7288)). Fixes #20048.
 * Don't allow calls when the connection the server has been lost ([\#7287](https://github.com/matrix-org/matrix-react-sdk/pull/7287)). Fixes #2096. Contributed by @SimonBrandner.
 * Analytics opt in for posthog ([\#6936](https://github.com/matrix-org/matrix-react-sdk/pull/6936)).
 * Don't inhibit current room notifications if user has Modal open ([\#7274](https://github.com/matrix-org/matrix-react-sdk/pull/7274)). Fixes #1118.
 * Remove the `Screen sharing is here!` dialog ([\#7266](https://github.com/matrix-org/matrix-react-sdk/pull/7266)). Fixes #18824. Contributed by @SimonBrandner.
 * Make composer buttons react to settings without having to change room ([\#7264](https://github.com/matrix-org/matrix-react-sdk/pull/7264)). Fixes #20011.
 * Decorate view keyboard shortcuts link as a link ([\#7260](https://github.com/matrix-org/matrix-react-sdk/pull/7260)). Fixes #20007.
 * Improve ease of focusing on Room list Search ([\#7255](https://github.com/matrix-org/matrix-react-sdk/pull/7255)). Fixes matrix-org/element-web-rageshakes#7017.
 * Autofocus device panel entry when renaming device ([\#7249](https://github.com/matrix-org/matrix-react-sdk/pull/7249)). Fixes #19984.
 * Update Space Panel scrollable region ([\#7245](https://github.com/matrix-org/matrix-react-sdk/pull/7245)). Fixes #19978.
 * Replace breadcrumbs with recently viewed menu ([\#7073](https://github.com/matrix-org/matrix-react-sdk/pull/7073)). Fixes #19528.
 * Tweaks to informational architecture 1.1 ([\#7052](https://github.com/matrix-org/matrix-react-sdk/pull/7052)). Fixes #19526, #19379, #17792, #16450, #19881, #19892, #19300, #19324, #17307, #17468 #19932 and #19956.

## 🐛 Bug Fixes
 * [Release] Fix inline code block nowrap issue ([\#7407](https://github.com/matrix-org/matrix-react-sdk/pull/7407)).
 * don't collapse spaces in inline code blocks (https ([\#7328](https://github.com/matrix-org/matrix-react-sdk/pull/7328)). Fixes #6051. Contributed by @HarHarLinks.
 * Fix accessibility regressions ([\#7336](https://github.com/matrix-org/matrix-react-sdk/pull/7336)).
 * Debounce User Info start dm "Message" button ([\#7357](https://github.com/matrix-org/matrix-react-sdk/pull/7357)). Fixes #7763.
 * Fix thread filter being cut-off on narrow screens ([\#7354](https://github.com/matrix-org/matrix-react-sdk/pull/7354)). Fixes #20146.
 * Fix upgraded rooms wrongly showing up in spotlight ([\#7341](https://github.com/matrix-org/matrix-react-sdk/pull/7341)). Fixes #20141.
 * Show votes in replied-to polls (pass in getRelationsForEvent) ([\#7345](https://github.com/matrix-org/matrix-react-sdk/pull/7345)). Fixes #20153.
 * Keep all previously approved widget capabilities when requesting new capabilities ([\#7340](https://github.com/matrix-org/matrix-react-sdk/pull/7340)). Contributed by @dhenneke.
 * Only show poll previews when the polls feature is enabled ([\#7331](https://github.com/matrix-org/matrix-react-sdk/pull/7331)).
 * No-op action:join if the user is already invited for scalar ([\#7334](https://github.com/matrix-org/matrix-react-sdk/pull/7334)). Fixes #20134.
 * Don't show polls in timeline if polls are disabled ([\#7332](https://github.com/matrix-org/matrix-react-sdk/pull/7332)). Fixes #20130.
 * Don't send a poll response event if you are voting for your current c… ([\#7326](https://github.com/matrix-org/matrix-react-sdk/pull/7326)). Fixes #20129.
 * Don't show options button when the user can't modify widgets ([\#7324](https://github.com/matrix-org/matrix-react-sdk/pull/7324)). Fixes #20114. Contributed by @SimonBrandner.
 * Add vertical spacing between buttons when they go over multiple lines ([\#7314](https://github.com/matrix-org/matrix-react-sdk/pull/7314)). Contributed by @twigleingrid.
 * Improve accessibility of opening space create menu ([\#7316](https://github.com/matrix-org/matrix-react-sdk/pull/7316)).
 * Correct tab order in room preview dialog ([\#7302](https://github.com/matrix-org/matrix-react-sdk/pull/7302)).
 * Fix favourites and people metaspaces not rendering their content ([\#7315](https://github.com/matrix-org/matrix-react-sdk/pull/7315)). Fixes #20070.
 * Make clear button images visible in high contrast theme ([\#7306](https://github.com/matrix-org/matrix-react-sdk/pull/7306)). Fixes #19931.
 * Fix html exporting and improve output size ([\#7312](https://github.com/matrix-org/matrix-react-sdk/pull/7312)). Fixes #19436 #20107 and #19441.
 * Fix textual message stripping new line ([\#7239](https://github.com/matrix-org/matrix-react-sdk/pull/7239)). Fixes #15320. Contributed by @renancleyson-dev.
 * Fix issue with room list resizer getting clipped in firefox ([\#7303](https://github.com/matrix-org/matrix-react-sdk/pull/7303)). Fixes #20076.
 * Fix wrong indentation with nested ordered list unnesting list on edit ([\#7300](https://github.com/matrix-org/matrix-react-sdk/pull/7300)). Contributed by @renancleyson-dev.
 * Fix input field behaviour inside context menus ([\#7293](https://github.com/matrix-org/matrix-react-sdk/pull/7293)). Fixes #19881.
 * Corrected the alignment of the Edit button on LoginPage. ([\#7292](https://github.com/matrix-org/matrix-react-sdk/pull/7292)). Contributed by @ankur12-1610.
 * Allow sharing manual location without giving location permission ([\#7295](https://github.com/matrix-org/matrix-react-sdk/pull/7295)). Fixes #20065. Contributed by @tulir.
 * Make emoji picker search placeholder localizable ([\#7294](https://github.com/matrix-org/matrix-react-sdk/pull/7294)).
 * Fix jump to bottom on message send ([\#7280](https://github.com/matrix-org/matrix-react-sdk/pull/7280)). Fixes #19859. Contributed by @SimonBrandner.
 * Fix: Warning: Unsupported style property pointer-events. Did you mean pointerEvents? ([\#7291](https://github.com/matrix-org/matrix-react-sdk/pull/7291)).
 * Add edits and replies to the right panel timeline & prepare the timelineCard to share code with threads ([\#7262](https://github.com/matrix-org/matrix-react-sdk/pull/7262)). Fixes #20012 and #19928.
 * Fix labs exploding when lab group is empty ([\#7290](https://github.com/matrix-org/matrix-react-sdk/pull/7290)). Fixes #20051.
 * Update URL when room aliases are modified ([\#7289](https://github.com/matrix-org/matrix-react-sdk/pull/7289)). Fixes #1616 and #1925.
 * Render mini user menu for when space panel is disabled ([\#7258](https://github.com/matrix-org/matrix-react-sdk/pull/7258)). Fixes #19998.
 * When accepting DM from People metaspace don't switch to Home ([\#7272](https://github.com/matrix-org/matrix-react-sdk/pull/7272)). Fixes #19995.
 * Fix CallPreview `room is null` ([\#7265](https://github.com/matrix-org/matrix-react-sdk/pull/7265)). Fixes #19990, #19972, matrix-org/element-web-rageshakes#7004 matrix-org/element-web-rageshakes#6991 and matrix-org/element-web-rageshakes#6964.
 * Fixes more instances of double-translation ([\#7259](https://github.com/matrix-org/matrix-react-sdk/pull/7259)). Fixes #20010.
 * Fix video calls ([\#7256](https://github.com/matrix-org/matrix-react-sdk/pull/7256)). Fixes #20008. Contributed by @SimonBrandner.
 * Fix broken i18n in Forgot & Change password ([\#7252](https://github.com/matrix-org/matrix-react-sdk/pull/7252)). Fixes #19989.
 * Fix setBotPower to not use `.content` ([\#7179](https://github.com/matrix-org/matrix-react-sdk/pull/7179)). Fixes #19845.
 * Break long words in pinned messages to prevent overflow ([\#7251](https://github.com/matrix-org/matrix-react-sdk/pull/7251)). Fixes #19985.
 * Disallow sending empty feedbacks ([\#7240](https://github.com/matrix-org/matrix-react-sdk/pull/7240)).
 * Fix wrongly sized default sub-space icons in space panel ([\#7243](https://github.com/matrix-org/matrix-react-sdk/pull/7243)). Fixes #19973.
 * Hide clear cache and reload button if crash is before client init ([\#7242](https://github.com/matrix-org/matrix-react-sdk/pull/7242)). Fixes matrix-org/element-web-rageshakes#6996.
 * Fix automatic space switching wrongly going via Home for room aliases ([\#7247](https://github.com/matrix-org/matrix-react-sdk/pull/7247)). Fixes #19974.
 * Fix links being parsed as markdown links improperly ([\#7200](https://github.com/matrix-org/matrix-react-sdk/pull/7200)). Contributed by @Palid.

Changes in [1.9.8-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.9.8-rc.1) (2021-12-14)
=======================================================================================================

## ✨ Features
 * Include Vietnamese language ([\#20029](https://github.com/vector-im/element-web/pull/20029)).
 * Simple static location sharing ([\#19754](https://github.com/vector-im/element-web/pull/19754)).
 * Add support for the Indonesian language ([\#20032](https://github.com/vector-im/element-web/pull/20032)). Fixes #20030. Contributed by @Linerly.
 * Always unhide widgets on layout change (pinning a widget) ([\#7299](https://github.com/matrix-org/matrix-react-sdk/pull/7299)).
 * Update status message in the member list and user info panel when it is changed ([\#7338](https://github.com/matrix-org/matrix-react-sdk/pull/7338)). Fixes #20127. Contributed by @SimonBrandner.
 * Iterate space panel toggle collapse interaction ([\#7335](https://github.com/matrix-org/matrix-react-sdk/pull/7335)). Fixes #20079.
 * Spotlight search labs ([\#7116](https://github.com/matrix-org/matrix-react-sdk/pull/7116)). Fixes #19530.
 * Put room settings form elements in fieldsets ([\#7311](https://github.com/matrix-org/matrix-react-sdk/pull/7311)).
 * Add descriptions to ambiguous links for screen readers ([\#7310](https://github.com/matrix-org/matrix-react-sdk/pull/7310)).
 * Make tooltips keyboard accessible ([\#7281](https://github.com/matrix-org/matrix-react-sdk/pull/7281)).
 * Iterate room context menus for DMs ([\#7308](https://github.com/matrix-org/matrix-react-sdk/pull/7308)). Fixes #19527.
 * Update space panel expand mechanism ([\#7230](https://github.com/matrix-org/matrix-react-sdk/pull/7230)). Fixes #17993.
 * Add CSS variable to make the UI gaps consistent and fix the resize handle position ([\#7234](https://github.com/matrix-org/matrix-react-sdk/pull/7234)). Fixes #19904 and #19938.
 * Custom location sharing. ([\#7185](https://github.com/matrix-org/matrix-react-sdk/pull/7185)).
 * Simple static location sharing ([\#7135](https://github.com/matrix-org/matrix-react-sdk/pull/7135)).
 * Finish sending pending messages before leaving room ([\#7276](https://github.com/matrix-org/matrix-react-sdk/pull/7276)). Fixes #4702.
 * Dropdown follow wai-aria practices for expanding on arrow keys ([\#7277](https://github.com/matrix-org/matrix-react-sdk/pull/7277)). Fixes #3687.
 * Expose PL control for pinned events when lab enabled ([\#7278](https://github.com/matrix-org/matrix-react-sdk/pull/7278)). Fixes #5396.
 * In People & Favourites metaspaces always show all rooms ([\#7288](https://github.com/matrix-org/matrix-react-sdk/pull/7288)). Fixes #20048.
 * Don't allow calls when the connection the server has been lost ([\#7287](https://github.com/matrix-org/matrix-react-sdk/pull/7287)). Fixes #2096. Contributed by @SimonBrandner.
 * Analytics opt in for posthog ([\#6936](https://github.com/matrix-org/matrix-react-sdk/pull/6936)).
 * Don't inhibit current room notifications if user has Modal open ([\#7274](https://github.com/matrix-org/matrix-react-sdk/pull/7274)). Fixes #1118.
 * Remove the `Screen sharing is here!` dialog ([\#7266](https://github.com/matrix-org/matrix-react-sdk/pull/7266)). Fixes #18824. Contributed by @SimonBrandner.
 * Make composer buttons react to settings without having to change room ([\#7264](https://github.com/matrix-org/matrix-react-sdk/pull/7264)). Fixes #20011.
 * Decorate view keyboard shortcuts link as a link ([\#7260](https://github.com/matrix-org/matrix-react-sdk/pull/7260)). Fixes #20007.
 * Improve ease of focusing on Room list Search ([\#7255](https://github.com/matrix-org/matrix-react-sdk/pull/7255)). Fixes matrix-org/element-web-rageshakes#7017.
 * Autofocus device panel entry when renaming device ([\#7249](https://github.com/matrix-org/matrix-react-sdk/pull/7249)). Fixes #19984.
 * Update Space Panel scrollable region ([\#7245](https://github.com/matrix-org/matrix-react-sdk/pull/7245)). Fixes #19978.
 * Replace breadcrumbs with recently viewed menu ([\#7073](https://github.com/matrix-org/matrix-react-sdk/pull/7073)). Fixes #19528.
 * Tweaks to informational architecture 1.1 ([\#7052](https://github.com/matrix-org/matrix-react-sdk/pull/7052)). Fixes #19526, #19379, #17792, #16450, #19881, #19892, #19300, #19324, #17307, #17468 #19932 and #19956.

## 🐛 Bug Fixes
 * Fix accessibility regressions ([\#7336](https://github.com/matrix-org/matrix-react-sdk/pull/7336)).
 * Debounce User Info start dm "Message" button ([\#7357](https://github.com/matrix-org/matrix-react-sdk/pull/7357)). Fixes #7763.
 * Fix thread filter being cut-off on narrow screens ([\#7354](https://github.com/matrix-org/matrix-react-sdk/pull/7354)). Fixes #20146.
 * Fix upgraded rooms wrongly showing up in spotlight ([\#7341](https://github.com/matrix-org/matrix-react-sdk/pull/7341)). Fixes #20141.
 * Show votes in replied-to polls (pass in getRelationsForEvent) ([\#7345](https://github.com/matrix-org/matrix-react-sdk/pull/7345)). Fixes #20153.
 * Keep all previously approved widget capabilities when requesting new capabilities ([\#7340](https://github.com/matrix-org/matrix-react-sdk/pull/7340)). Contributed by @dhenneke.
 * Only show poll previews when the polls feature is enabled ([\#7331](https://github.com/matrix-org/matrix-react-sdk/pull/7331)).
 * don't collapse spaces in inline code blocks (https ([\#7328](https://github.com/matrix-org/matrix-react-sdk/pull/7328)). Fixes #6051. Contributed by @HarHarLinks.
 * No-op action:join if the user is already invited for scalar ([\#7334](https://github.com/matrix-org/matrix-react-sdk/pull/7334)). Fixes #20134.
 * Don't show polls in timeline if polls are disabled ([\#7332](https://github.com/matrix-org/matrix-react-sdk/pull/7332)). Fixes #20130.
 * Don't send a poll response event if you are voting for your current c… ([\#7326](https://github.com/matrix-org/matrix-react-sdk/pull/7326)). Fixes #20129.
 * Don't show options button when the user can't modify widgets ([\#7324](https://github.com/matrix-org/matrix-react-sdk/pull/7324)). Fixes #20114. Contributed by @SimonBrandner.
 * Add vertical spacing between buttons when they go over multiple lines ([\#7314](https://github.com/matrix-org/matrix-react-sdk/pull/7314)). Contributed by @twigleingrid.
 * Improve accessibility of opening space create menu ([\#7316](https://github.com/matrix-org/matrix-react-sdk/pull/7316)).
 * Correct tab order in room preview dialog ([\#7302](https://github.com/matrix-org/matrix-react-sdk/pull/7302)).
 * Fix favourites and people metaspaces not rendering their content ([\#7315](https://github.com/matrix-org/matrix-react-sdk/pull/7315)). Fixes #20070.
 * Make clear button images visible in high contrast theme ([\#7306](https://github.com/matrix-org/matrix-react-sdk/pull/7306)). Fixes #19931.
 * Fix html exporting and improve output size ([\#7312](https://github.com/matrix-org/matrix-react-sdk/pull/7312)). Fixes #19436 #20107 and #19441.
 * Fix textual message stripping new line ([\#7239](https://github.com/matrix-org/matrix-react-sdk/pull/7239)). Fixes #15320. Contributed by @renancleyson-dev.
 * Fix issue with room list resizer getting clipped in firefox ([\#7303](https://github.com/matrix-org/matrix-react-sdk/pull/7303)). Fixes #20076.
 * Fix wrong indentation with nested ordered list unnesting list on edit ([\#7300](https://github.com/matrix-org/matrix-react-sdk/pull/7300)). Contributed by @renancleyson-dev.
 * Fix input field behaviour inside context menus ([\#7293](https://github.com/matrix-org/matrix-react-sdk/pull/7293)). Fixes #19881.
 * Corrected the alignment of the Edit button on LoginPage. ([\#7292](https://github.com/matrix-org/matrix-react-sdk/pull/7292)). Contributed by @ankur12-1610.
 * Allow sharing manual location without giving location permission ([\#7295](https://github.com/matrix-org/matrix-react-sdk/pull/7295)). Fixes #20065. Contributed by @tulir.
 * Make emoji picker search placeholder localizable ([\#7294](https://github.com/matrix-org/matrix-react-sdk/pull/7294)).
 * Fix jump to bottom on message send ([\#7280](https://github.com/matrix-org/matrix-react-sdk/pull/7280)). Fixes #19859. Contributed by @SimonBrandner.
 * Fix: Warning: Unsupported style property pointer-events. Did you mean pointerEvents? ([\#7291](https://github.com/matrix-org/matrix-react-sdk/pull/7291)).
 * Add edits and replies to the right panel timeline & prepare the timelineCard to share code with threads ([\#7262](https://github.com/matrix-org/matrix-react-sdk/pull/7262)). Fixes #20012 and #19928.
 * Fix labs exploding when lab group is empty ([\#7290](https://github.com/matrix-org/matrix-react-sdk/pull/7290)). Fixes #20051.
 * Update URL when room aliases are modified ([\#7289](https://github.com/matrix-org/matrix-react-sdk/pull/7289)). Fixes #1616 and #1925.
 * Render mini user menu for when space panel is disabled ([\#7258](https://github.com/matrix-org/matrix-react-sdk/pull/7258)). Fixes #19998.
 * When accepting DM from People metaspace don't switch to Home ([\#7272](https://github.com/matrix-org/matrix-react-sdk/pull/7272)). Fixes #19995.
 * Fix CallPreview `room is null` ([\#7265](https://github.com/matrix-org/matrix-react-sdk/pull/7265)). Fixes #19990, #19972, matrix-org/element-web-rageshakes#7004 matrix-org/element-web-rageshakes#6991 and matrix-org/element-web-rageshakes#6964.
 * Fixes more instances of double-translation ([\#7259](https://github.com/matrix-org/matrix-react-sdk/pull/7259)). Fixes #20010.
 * Fix video calls ([\#7256](https://github.com/matrix-org/matrix-react-sdk/pull/7256)). Fixes #20008. Contributed by @SimonBrandner.
 * Fix broken i18n in Forgot & Change password ([\#7252](https://github.com/matrix-org/matrix-react-sdk/pull/7252)). Fixes #19989.
 * Fix setBotPower to not use `.content` ([\#7179](https://github.com/matrix-org/matrix-react-sdk/pull/7179)). Fixes #19845.
 * Break long words in pinned messages to prevent overflow ([\#7251](https://github.com/matrix-org/matrix-react-sdk/pull/7251)). Fixes #19985.
 * Disallow sending empty feedbacks ([\#7240](https://github.com/matrix-org/matrix-react-sdk/pull/7240)).
 * Fix wrongly sized default sub-space icons in space panel ([\#7243](https://github.com/matrix-org/matrix-react-sdk/pull/7243)). Fixes #19973.
 * Hide clear cache and reload button if crash is before client init ([\#7242](https://github.com/matrix-org/matrix-react-sdk/pull/7242)). Fixes matrix-org/element-web-rageshakes#6996.
 * Fix automatic space switching wrongly going via Home for room aliases ([\#7247](https://github.com/matrix-org/matrix-react-sdk/pull/7247)). Fixes #19974.
 * Fix links being parsed as markdown links improperly ([\#7200](https://github.com/matrix-org/matrix-react-sdk/pull/7200)). Contributed by @Palid.

Changes in [1.9.7](https://github.com/vector-im/element-web/releases/tag/v1.9.7) (2021-12-13)
=============================================================================================

 * Security release with updated version of Olm to fix https://matrix.org/blog/2021/12/03/pre-disclosure-upcoming-security-release-of-libolm-and-matrix-js-sdk
 * Fix a crash on logout

Changes in [1.9.6](https://github.com/vector-im/element-web/releases/tag/v1.9.6) (2021-12-06)
=============================================================================================

## ✨ Features
 * Add unread indicator to the timelineCard header icon ([\#7156](https://github.com/matrix-org/matrix-react-sdk/pull/7156)). Fixes #19635.
 * Only show core navigation elements (call/chat/notification/info) when a widget is maximised ([\#7114](https://github.com/matrix-org/matrix-react-sdk/pull/7114)). Fixes #19632.
 * Improve ThreadPanel ctx menu accessibility ([\#7217](https://github.com/matrix-org/matrix-react-sdk/pull/7217)). Fixes #19885.
 * Allow filtering room list during treeview navigation ([\#7219](https://github.com/matrix-org/matrix-react-sdk/pull/7219)). Fixes #14702.
 * Add right panel chat timeline ([\#7112](https://github.com/matrix-org/matrix-react-sdk/pull/7112)). Fixes #19633.
 * Hide server options hint when disable_custom_urls is true ([\#7215](https://github.com/matrix-org/matrix-react-sdk/pull/7215)). Fixes #19919.
 * Improve right panel resize handle usability ([\#7204](https://github.com/matrix-org/matrix-react-sdk/pull/7204)). Fixes #15145. Contributed by @weeman1337.
 * Spaces quick settings ([\#7196](https://github.com/matrix-org/matrix-react-sdk/pull/7196)).
 * Maximised widgets always force a call to be shown in PIP mode ([\#7163](https://github.com/matrix-org/matrix-react-sdk/pull/7163)). Fixes #19637.
 * Group Labs flags ([\#7190](https://github.com/matrix-org/matrix-react-sdk/pull/7190)).
 * Show room context details in forward dialog ([\#7162](https://github.com/matrix-org/matrix-react-sdk/pull/7162)). Fixes #19793.
 * Remove chevrons from RoomSummaryCard_Button ([\#7137](https://github.com/matrix-org/matrix-react-sdk/pull/7137)). Fixes #19644.
 * Disable op/deop commands where user has no permissions ([\#7161](https://github.com/matrix-org/matrix-react-sdk/pull/7161)). Fixes #15390.
 * Add option to change the size of images/videos in the timeline ([\#7017](https://github.com/matrix-org/matrix-react-sdk/pull/7017)). Fixes vector-im/element-meta#49 #1520 and #19498.

## 🐛 Bug Fixes
 * Fix left panel glow in Safari ([\#7236](https://github.com/matrix-org/matrix-react-sdk/pull/7236)). Fixes #19863.
 * Fix newline on edit messages with quotes ([\#7227](https://github.com/matrix-org/matrix-react-sdk/pull/7227)). Fixes #12535. Contributed by @renancleyson-dev.
 * Guard against null refs in findSiblingElement ([\#7228](https://github.com/matrix-org/matrix-react-sdk/pull/7228)).
 * Tweak bottom of space panel buttons in expanded state ([\#7213](https://github.com/matrix-org/matrix-react-sdk/pull/7213)). Fixes #19921.
 * Fix multiline paragraph rendering as single line ([\#7210](https://github.com/matrix-org/matrix-react-sdk/pull/7210)). Fixes #8786. Contributed by @renancleyson-dev.
 * Improve room list message previews ([\#7224](https://github.com/matrix-org/matrix-react-sdk/pull/7224)). Fixes #17101 and #16169.
 * Fix EmojiPicker lazy loaded rendering bug ([\#7225](https://github.com/matrix-org/matrix-react-sdk/pull/7225)). Fixes #15341.
 * Prevent default avatar in UserInfo having pointer cursor ([\#7218](https://github.com/matrix-org/matrix-react-sdk/pull/7218)). Fixes #13872.
 * Prevent duplicate avatars in Event List Summaries ([\#7222](https://github.com/matrix-org/matrix-react-sdk/pull/7222)). Fixes #17706.
 * Respect the home page as a context for the Home space ([\#7216](https://github.com/matrix-org/matrix-react-sdk/pull/7216)). Fixes #19554.
 * Fix RoomUpgradeWarningBar exploding ([\#7214](https://github.com/matrix-org/matrix-react-sdk/pull/7214)). Fixes #19920.
 * Polish threads misalignments and UI diversion ([\#7209](https://github.com/matrix-org/matrix-react-sdk/pull/7209)). Fixes #19772, #19710 #19629 and #19711.
 * Fix Manage Restricted Join Rule Dialog for Spaces ([\#7208](https://github.com/matrix-org/matrix-react-sdk/pull/7208)). Fixes #19610.
 * Fix wrongly showing unpin in pinned messages tile with no perms ([\#7197](https://github.com/matrix-org/matrix-react-sdk/pull/7197)). Fixes #19886.
 * Make image size constrained by height when using the ImageSize.Large option ([\#7171](https://github.com/matrix-org/matrix-react-sdk/pull/7171)). Fixes #19788.
 * Prevent programmatic scrolling within truncated room sublists ([\#7191](https://github.com/matrix-org/matrix-react-sdk/pull/7191)).
 * Remove leading slash from /addwidget Jitsi confs ([\#7175](https://github.com/matrix-org/matrix-react-sdk/pull/7175)). Fixes #19839. Contributed by @AndrewFerr.
 * Fix automatic composer focus, regressed by threads work ([\#7167](https://github.com/matrix-org/matrix-react-sdk/pull/7167)). Fixes #19479.
 * Show space members when not invited even if summary didn't fail ([\#7153](https://github.com/matrix-org/matrix-react-sdk/pull/7153)). Fixes #19781.
 * Prevent custom power levels from breaking roles & permissions tab ([\#7160](https://github.com/matrix-org/matrix-react-sdk/pull/7160)). Fixes #19812.
 * Room Context Menu should respond to tag changes ([\#7154](https://github.com/matrix-org/matrix-react-sdk/pull/7154)). Fixes #19776.
 * Fix an edge case when trying to join an upgraded room ([\#7159](https://github.com/matrix-org/matrix-react-sdk/pull/7159)).

Changes in [1.9.6-rc.2](https://github.com/vector-im/element-web/releases/tag/v1.9.6-rc.2) (2021-12-01)
=======================================================================================================

 * Fixed release from correct branch

Changes in [1.9.6-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.9.6-rc.1) (2021-11-30)
=======================================================================================================

## ✨ Features
 * Tweaks to informational architecture 1.1 ([\#7052](https://github.com/matrix-org/matrix-react-sdk/pull/7052)). Fixes #19526, #19379, #17792, #16450, #19881, #19892, #19300, #19324, #17307, #17468, #19932 #19956 and #19526.
 * Add unread indicator to the timelineCard header icon ([\#7156](https://github.com/matrix-org/matrix-react-sdk/pull/7156)). Fixes #19635 and #19635.
 * Only show core navigation elements (call/chat/notification/info) when a widget is maximised ([\#7114](https://github.com/matrix-org/matrix-react-sdk/pull/7114)). Fixes #19632 and #19632.
 * Improve ThreadPanel ctx menu accessibility ([\#7217](https://github.com/matrix-org/matrix-react-sdk/pull/7217)). Fixes #19885 and #19885.
 * Allow filtering room list during treeview navigation ([\#7219](https://github.com/matrix-org/matrix-react-sdk/pull/7219)). Fixes #14702 and #14702.
 * Add right panel chat timeline ([\#7112](https://github.com/matrix-org/matrix-react-sdk/pull/7112)). Fixes #19633 and #19633.
 * Hide server options hint when disable_custom_urls is true ([\#7215](https://github.com/matrix-org/matrix-react-sdk/pull/7215)). Fixes #19919 and #19919.
 * Improve right panel resize handle usability ([\#7204](https://github.com/matrix-org/matrix-react-sdk/pull/7204)). Fixes #15145 and #15145. Contributed by @weeman1337.
 * Spaces quick settings ([\#7196](https://github.com/matrix-org/matrix-react-sdk/pull/7196)).
 * Maximised widgets always force a call to be shown in PIP mode ([\#7163](https://github.com/matrix-org/matrix-react-sdk/pull/7163)). Fixes #19637 and #19637.
 * Group Labs flags ([\#7190](https://github.com/matrix-org/matrix-react-sdk/pull/7190)).
 * Show room context details in forward dialog ([\#7162](https://github.com/matrix-org/matrix-react-sdk/pull/7162)). Fixes #19793 and #19793.
 * Remove chevrons from RoomSummaryCard_Button ([\#7137](https://github.com/matrix-org/matrix-react-sdk/pull/7137)). Fixes #19644 and #19644.
 * Disable op/deop commands where user has no permissions ([\#7161](https://github.com/matrix-org/matrix-react-sdk/pull/7161)). Fixes #15390 and #15390.
 * Add option to change the size of images/videos in the timeline ([\#7017](https://github.com/matrix-org/matrix-react-sdk/pull/7017)). Fixes vector-im/element-meta#49, #1520 #19498 and vector-im/element-meta#49.

## 🐛 Bug Fixes
 * Fix links being parsed as markdown links improperly ([\#7200](https://github.com/matrix-org/matrix-react-sdk/pull/7200)).
 * Fix left panel glow in Safari ([\#7236](https://github.com/matrix-org/matrix-react-sdk/pull/7236)). Fixes #19863 and #19863.
 * Fix newline on edit messages with quotes ([\#7227](https://github.com/matrix-org/matrix-react-sdk/pull/7227)). Fixes #12535 and #12535. Contributed by @renancleyson-dev.
 * Guard against null refs in findSiblingElement ([\#7228](https://github.com/matrix-org/matrix-react-sdk/pull/7228)).
 * Tweak bottom of space panel buttons in expanded state ([\#7213](https://github.com/matrix-org/matrix-react-sdk/pull/7213)). Fixes #19921 and #19921.
 * Fix multiline paragraph rendering as single line ([\#7210](https://github.com/matrix-org/matrix-react-sdk/pull/7210)). Fixes #8786 and #8786. Contributed by @renancleyson-dev.
 * Improve room list message previews ([\#7224](https://github.com/matrix-org/matrix-react-sdk/pull/7224)). Fixes #17101 #16169 and #17101.
 * Fix EmojiPicker lazy loaded rendering bug ([\#7225](https://github.com/matrix-org/matrix-react-sdk/pull/7225)). Fixes #15341 and #15341.
 * Prevent default avatar in UserInfo having pointer cursor ([\#7218](https://github.com/matrix-org/matrix-react-sdk/pull/7218)). Fixes #13872 and #13872.
 * Prevent duplicate avatars in Event List Summaries ([\#7222](https://github.com/matrix-org/matrix-react-sdk/pull/7222)). Fixes #17706 and #17706.
 * Respect the home page as a context for the Home space ([\#7216](https://github.com/matrix-org/matrix-react-sdk/pull/7216)). Fixes #19554 and #19554.
 * Fix RoomUpgradeWarningBar exploding ([\#7214](https://github.com/matrix-org/matrix-react-sdk/pull/7214)). Fixes #19920 and #19920.
 * Polish threads misalignments and UI diversion ([\#7209](https://github.com/matrix-org/matrix-react-sdk/pull/7209)). Fixes #19772, #19710, #19629 #19711 and #19772.
 * Fix Manage Restricted Join Rule Dialog for Spaces ([\#7208](https://github.com/matrix-org/matrix-react-sdk/pull/7208)). Fixes #19610 and #19610.
 * Fix wrongly showing unpin in pinned messages tile with no perms ([\#7197](https://github.com/matrix-org/matrix-react-sdk/pull/7197)). Fixes #19886 and #19886.
 * Make image size constrained by height when using the ImageSize.Large option ([\#7171](https://github.com/matrix-org/matrix-react-sdk/pull/7171)). Fixes #19788 and #19788.
 * Prevent programmatic scrolling within truncated room sublists ([\#7191](https://github.com/matrix-org/matrix-react-sdk/pull/7191)).
 * Remove leading slash from /addwidget Jitsi confs ([\#7175](https://github.com/matrix-org/matrix-react-sdk/pull/7175)). Fixes #19839 and #19839. Contributed by @AndrewFerr.
 * Fix automatic composer focus, regressed by threads work ([\#7167](https://github.com/matrix-org/matrix-react-sdk/pull/7167)). Fixes #19479 and #19479.
 * Show space members when not invited even if summary didn't fail ([\#7153](https://github.com/matrix-org/matrix-react-sdk/pull/7153)). Fixes #19781 and #19781.
 * Prevent custom power levels from breaking roles & permissions tab ([\#7160](https://github.com/matrix-org/matrix-react-sdk/pull/7160)). Fixes #19812 and #19812.
 * Room Context Menu should respond to tag changes ([\#7154](https://github.com/matrix-org/matrix-react-sdk/pull/7154)). Fixes #19776.
 * Fix an edge case when trying to join an upgraded room ([\#7159](https://github.com/matrix-org/matrix-react-sdk/pull/7159)).

Changes in [1.9.5](https://github.com/vector-im/element-web/releases/tag/v1.9.5) (2021-11-22)
=============================================================================================

## ✨ Features
 * Make double-clicking the PiP take you to the call room ([\#7142](https://github.com/matrix-org/matrix-react-sdk/pull/7142)). Fixes #18421 #15920 and #18421. Contributed by @SimonBrandner.
 * Add maximise widget functionality ([\#7098](https://github.com/matrix-org/matrix-react-sdk/pull/7098)). Fixes #19619, #19621 #19760 and #19619.
 * Add rainfall effect ([\#7086](https://github.com/matrix-org/matrix-react-sdk/pull/7086)). Contributed by @justjosias.
 * Add root folder to zip file created by export chat feature ([\#7097](https://github.com/matrix-org/matrix-react-sdk/pull/7097)). Fixes #19653 and #19653. Contributed by @aaronraimist.
 * Improve VoIP UI/UX ([\#7048](https://github.com/matrix-org/matrix-react-sdk/pull/7048)). Fixes #19513 and #19513. Contributed by @SimonBrandner.
 * Unified room context menus ([\#7072](https://github.com/matrix-org/matrix-react-sdk/pull/7072)). Fixes #19527 and #19527.
 * In forgot password screen, show validation errors inline in the form, instead of in modals ([\#7113](https://github.com/matrix-org/matrix-react-sdk/pull/7113)). Contributed by @psrpinto.
 * Implement more meta-spaces ([\#7077](https://github.com/matrix-org/matrix-react-sdk/pull/7077)). Fixes #18634 #17295 and #18634.
 * Expose power level control for m.space.child ([\#7120](https://github.com/matrix-org/matrix-react-sdk/pull/7120)).
 * Forget member-list query when switching out of a room ([\#7093](https://github.com/matrix-org/matrix-react-sdk/pull/7093)). Fixes #19432 and #19432. Contributed by @SimonBrandner.
 * Do pre-submit availability check on username during registration ([\#6978](https://github.com/matrix-org/matrix-react-sdk/pull/6978)). Fixes #9545 and #9545.

## 🐛 Bug Fixes
 * Adjust recovery key button sizes depending on text width ([\#7134](https://github.com/matrix-org/matrix-react-sdk/pull/7134)). Fixes #19511 and #19511. Contributed by @weeman1337.
 * Fix bulk invite button getting a negative count ([\#7122](https://github.com/matrix-org/matrix-react-sdk/pull/7122)). Fixes #19466 and #19466. Contributed by @renancleyson-dev.
 * Fix maximised / pinned widget state being loaded correctly ([\#7146](https://github.com/matrix-org/matrix-react-sdk/pull/7146)). Fixes #19768 and #19768.
 * Don't reload the page when user hits enter when entering ban reason ([\#7145](https://github.com/matrix-org/matrix-react-sdk/pull/7145)). Fixes #19763 and #19763.
 * Fix timeline text when sharing room layout ([\#7140](https://github.com/matrix-org/matrix-react-sdk/pull/7140)). Fixes #19622 and #19622.
 * Fix look of emoji verification ([\#7133](https://github.com/matrix-org/matrix-react-sdk/pull/7133)). Fixes #19740 and #19740. Contributed by @SimonBrandner.
 * Fixes element not remembering widget hidden state per room ([\#7136](https://github.com/matrix-org/matrix-react-sdk/pull/7136)). Fixes #16672, matrix-org/element-web-rageshakes#4407, #15718 #15768 and #16672.
 * Don't keep spinning if joining space child failed ([\#7129](https://github.com/matrix-org/matrix-react-sdk/pull/7129)). Fixes matrix-org/element-web-rageshakes#6813 and matrix-org/element-web-rageshakes#6813.
 * Guard around SpaceStore onAccountData handler prevEvent ([\#7123](https://github.com/matrix-org/matrix-react-sdk/pull/7123)). Fixes #19705 and #19705.
 * Fix missing spaces in threads copy ([\#7119](https://github.com/matrix-org/matrix-react-sdk/pull/7119)). Fixes #19702 and #19702.
 * Fix hover tile border ([\#7117](https://github.com/matrix-org/matrix-react-sdk/pull/7117)). Fixes #19698 and #19698. Contributed by @SimonBrandner.
 * Fix quote button ([\#7096](https://github.com/matrix-org/matrix-react-sdk/pull/7096)). Fixes #19659 and #19659. Contributed by @SimonBrandner.
 * Fix space panel layout edge cases ([\#7101](https://github.com/matrix-org/matrix-react-sdk/pull/7101)). Fixes #19668 and #19668.
 * Update powerlevel/role when the user changes in the user info panel ([\#7099](https://github.com/matrix-org/matrix-react-sdk/pull/7099)). Fixes #19666 and #19666. Contributed by @SimonBrandner.
 * Fix avatar disappearing when setting a room topic ([\#7092](https://github.com/matrix-org/matrix-react-sdk/pull/7092)). Fixes #19226 and #19226. Contributed by @SimonBrandner.
 * Fix possible infinite loop on widget start ([\#7071](https://github.com/matrix-org/matrix-react-sdk/pull/7071)). Fixes #15494 and #15494.
 * Use device IDs for nameless devices in device list ([\#7081](https://github.com/matrix-org/matrix-react-sdk/pull/7081)). Fixes #19608 and #19608.
 * Don't re-sort rooms on no-op RoomUpdateCause.PossibleTagChange ([\#7053](https://github.com/matrix-org/matrix-react-sdk/pull/7053)). Contributed by @bradtgmurray.

Changes in [1.9.5-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.9.5-rc.1) (2021-11-17)
=======================================================================================================

## ✨ Features
 * Make double-clicking the PiP take you to the call room ([\#7142](https://github.com/matrix-org/matrix-react-sdk/pull/7142)). Fixes #18421 #15920 and #18421. Contributed by @SimonBrandner.
 * Add maximise widget functionality ([\#7098](https://github.com/matrix-org/matrix-react-sdk/pull/7098)). Fixes #19619, #19621 #19760 and #19619.
 * Add rainfall effect ([\#7086](https://github.com/matrix-org/matrix-react-sdk/pull/7086)). Contributed by @justjosias.
 * Add root folder to zip file created by export chat feature ([\#7097](https://github.com/matrix-org/matrix-react-sdk/pull/7097)). Fixes #19653 and #19653. Contributed by @aaronraimist.
 * Improve VoIP UI/UX ([\#7048](https://github.com/matrix-org/matrix-react-sdk/pull/7048)). Fixes #19513 and #19513. Contributed by @SimonBrandner.
 * Unified room context menus ([\#7072](https://github.com/matrix-org/matrix-react-sdk/pull/7072)). Fixes #19527 and #19527.
 * In forgot password screen, show validation errors inline in the form, instead of in modals ([\#7113](https://github.com/matrix-org/matrix-react-sdk/pull/7113)). Contributed by @psrpinto.
 * Implement more meta-spaces ([\#7077](https://github.com/matrix-org/matrix-react-sdk/pull/7077)). Fixes #18634 #17295 and #18634.
 * Expose power level control for m.space.child ([\#7120](https://github.com/matrix-org/matrix-react-sdk/pull/7120)).
 * Forget member-list query when switching out of a room ([\#7093](https://github.com/matrix-org/matrix-react-sdk/pull/7093)). Fixes #19432 and #19432. Contributed by @SimonBrandner.
 * Do pre-submit availability check on username during registration ([\#6978](https://github.com/matrix-org/matrix-react-sdk/pull/6978)). Fixes #9545 and #9545.

## 🐛 Bug Fixes
 * Adjust recovery key button sizes depending on text width ([\#7134](https://github.com/matrix-org/matrix-react-sdk/pull/7134)). Fixes #19511 and #19511. Contributed by @weeman1337.
 * Fix bulk invite button getting a negative count ([\#7122](https://github.com/matrix-org/matrix-react-sdk/pull/7122)). Fixes #19466 and #19466. Contributed by @renancleyson-dev.
 * Fix maximised / pinned widget state being loaded correctly ([\#7146](https://github.com/matrix-org/matrix-react-sdk/pull/7146)). Fixes #19768 and #19768.
 * Don't reload the page when user hits enter when entering ban reason ([\#7145](https://github.com/matrix-org/matrix-react-sdk/pull/7145)). Fixes #19763 and #19763.
 * Fix timeline text when sharing room layout ([\#7140](https://github.com/matrix-org/matrix-react-sdk/pull/7140)). Fixes #19622 and #19622.
 * Fix look of emoji verification ([\#7133](https://github.com/matrix-org/matrix-react-sdk/pull/7133)). Fixes #19740 and #19740. Contributed by @SimonBrandner.
 * Fixes element not remembering widget hidden state per room ([\#7136](https://github.com/matrix-org/matrix-react-sdk/pull/7136)). Fixes #16672, matrix-org/element-web-rageshakes#4407, #15718 #15768 and #16672.
 * Don't keep spinning if joining space child failed ([\#7129](https://github.com/matrix-org/matrix-react-sdk/pull/7129)). Fixes matrix-org/element-web-rageshakes#6813 and matrix-org/element-web-rageshakes#6813.
 * Guard around SpaceStore onAccountData handler prevEvent ([\#7123](https://github.com/matrix-org/matrix-react-sdk/pull/7123)). Fixes #19705 and #19705.
 * Fix missing spaces in threads copy ([\#7119](https://github.com/matrix-org/matrix-react-sdk/pull/7119)). Fixes #19702 and #19702.
 * Fix hover tile border ([\#7117](https://github.com/matrix-org/matrix-react-sdk/pull/7117)). Fixes #19698 and #19698. Contributed by @SimonBrandner.
 * Fix quote button ([\#7096](https://github.com/matrix-org/matrix-react-sdk/pull/7096)). Fixes #19659 and #19659. Contributed by @SimonBrandner.
 * Fix space panel layout edge cases ([\#7101](https://github.com/matrix-org/matrix-react-sdk/pull/7101)). Fixes #19668 and #19668.
 * Update powerlevel/role when the user changes in the user info panel ([\#7099](https://github.com/matrix-org/matrix-react-sdk/pull/7099)). Fixes #19666 and #19666. Contributed by @SimonBrandner.
 * Fix avatar disappearing when setting a room topic ([\#7092](https://github.com/matrix-org/matrix-react-sdk/pull/7092)). Fixes #19226 and #19226. Contributed by @SimonBrandner.
 * Fix possible infinite loop on widget start ([\#7071](https://github.com/matrix-org/matrix-react-sdk/pull/7071)). Fixes #15494 and #15494.
 * Use device IDs for nameless devices in device list ([\#7081](https://github.com/matrix-org/matrix-react-sdk/pull/7081)). Fixes #19608 and #19608.
 * Don't re-sort rooms on no-op RoomUpdateCause.PossibleTagChange ([\#7053](https://github.com/matrix-org/matrix-react-sdk/pull/7053)). Contributed by @bradtgmurray.

Changes in [1.9.4](https://github.com/vector-im/element-web/releases/tag/v1.9.4) (2021-11-08)
=============================================================================================

## ✨ Features
 * Improve the look of tooltips ([\#7049](https://github.com/matrix-org/matrix-react-sdk/pull/7049)). Contributed by @SimonBrandner.
 * Improve the look of the spinner ([\#6083](https://github.com/matrix-org/matrix-react-sdk/pull/6083)). Contributed by @SimonBrandner.
 * Polls: Creation form & start event ([\#7001](https://github.com/matrix-org/matrix-react-sdk/pull/7001)).
 * Show a gray shield when encrypted by deleted session ([\#6119](https://github.com/matrix-org/matrix-react-sdk/pull/6119)). Contributed by @SimonBrandner.
 * <notes> ([\#7057](https://github.com/matrix-org/matrix-react-sdk/pull/7057)). Contributed by @ndarilek.
 * Make message separator more accessible. ([\#7056](https://github.com/matrix-org/matrix-react-sdk/pull/7056)). Contributed by @ndarilek.
 * <notes> ([\#7035](https://github.com/matrix-org/matrix-react-sdk/pull/7035)). Contributed by @ndarilek.
 * Implement RequiresClient capability for widgets ([\#7005](https://github.com/matrix-org/matrix-react-sdk/pull/7005)). Fixes #15744 and #15744.
 * Respect the system high contrast setting when using system theme ([\#7043](https://github.com/matrix-org/matrix-react-sdk/pull/7043)).
 * Remove redundant duplicate mimetype field which doesn't conform to spec ([\#7045](https://github.com/matrix-org/matrix-react-sdk/pull/7045)). Fixes #17145 and #17145.
 * Make join button on space hierarchy action in the background ([\#7041](https://github.com/matrix-org/matrix-react-sdk/pull/7041)). Fixes #17388 and #17388.
 * Add a high contrast theme (a variant of the light theme) ([\#7036](https://github.com/matrix-org/matrix-react-sdk/pull/7036)).
 * Improve timeline message for restricted join rule changes ([\#6984](https://github.com/matrix-org/matrix-react-sdk/pull/6984)). Fixes #18980 and #18980.
 * Improve the appearance of the font size slider ([\#7038](https://github.com/matrix-org/matrix-react-sdk/pull/7038)).
 * Improve RovingTabIndex & Room List filtering performance ([\#6987](https://github.com/matrix-org/matrix-react-sdk/pull/6987)). Fixes #17864 and #17864.
 * Remove outdated Spaces restricted rooms warning ([\#6927](https://github.com/matrix-org/matrix-react-sdk/pull/6927)).
 * Make /msg <message> param optional for more flexibility ([\#7028](https://github.com/matrix-org/matrix-react-sdk/pull/7028)). Fixes #19481 and #19481.
 * Add decoration to space hierarchy for tiles which have already been j… ([\#6969](https://github.com/matrix-org/matrix-react-sdk/pull/6969)). Fixes #18755 and #18755.
 * Add insert link button to the format bar ([\#5879](https://github.com/matrix-org/matrix-react-sdk/pull/5879)). Contributed by @SimonBrandner.
 * Improve visibility of font size chooser ([\#6988](https://github.com/matrix-org/matrix-react-sdk/pull/6988)).
 * Soften border-radius on selected/hovered messages ([\#6525](https://github.com/matrix-org/matrix-react-sdk/pull/6525)). Fixes #18108. Contributed by @SimonBrandner.
 * Add a developer mode flag and use it for accessing space timelines ([\#6994](https://github.com/matrix-org/matrix-react-sdk/pull/6994)). Fixes #19416 and #19416.
 * Position toggle switch more clearly ([\#6914](https://github.com/matrix-org/matrix-react-sdk/pull/6914)). Contributed by @CicadaCinema.
 * Validate email address in forgot password dialog ([\#6983](https://github.com/matrix-org/matrix-react-sdk/pull/6983)). Fixes #9978 and #9978. Contributed by @psrpinto.
 * Handle and i18n M_THREEPID_IN_USE during registration ([\#6986](https://github.com/matrix-org/matrix-react-sdk/pull/6986)). Fixes #13767 and #13767.
 * For space invite previews, use room summary API to get the right member count ([\#6982](https://github.com/matrix-org/matrix-react-sdk/pull/6982)). Fixes #19123 and #19123.
 * Simplify Space Panel notification badge layout ([\#6977](https://github.com/matrix-org/matrix-react-sdk/pull/6977)). Fixes #18527 and #18527.
 * Use prettier hsName during 3pid registration where possible ([\#6980](https://github.com/matrix-org/matrix-react-sdk/pull/6980)). Fixes #19162 and #19162.

## 🐛 Bug Fixes
 * Add a condition to only activate the resizer which belongs to the clicked handle ([\#7055](https://github.com/matrix-org/matrix-react-sdk/pull/7055)). Fixes #19521 and #19521.
 * Restore composer focus after event edit ([\#7065](https://github.com/matrix-org/matrix-react-sdk/pull/7065)). Fixes #19469 and #19469.
 * Don't apply message bubble visual style to media messages ([\#7040](https://github.com/matrix-org/matrix-react-sdk/pull/7040)).
 * Handle no selected screen when screen-sharing ([\#7018](https://github.com/matrix-org/matrix-react-sdk/pull/7018)). Fixes #19460 and #19460. Contributed by @SimonBrandner.
 * Add history entry before completing emoji ([\#7007](https://github.com/matrix-org/matrix-react-sdk/pull/7007)). Fixes #19177 and #19177. Contributed by @RafaelGoncalves8.
 * Add padding between controls on edit form in message bubbles ([\#7039](https://github.com/matrix-org/matrix-react-sdk/pull/7039)).
 * Respect the roomState right container request for the Jitsi widget ([\#7033](https://github.com/matrix-org/matrix-react-sdk/pull/7033)). Fixes #16552 and #16552.
 * Fix cannot read length of undefined for room upgrades ([\#7037](https://github.com/matrix-org/matrix-react-sdk/pull/7037)). Fixes #19509 and #19509.
 * Cleanup re-dispatching around timelines and composers ([\#7023](https://github.com/matrix-org/matrix-react-sdk/pull/7023)). Fixes #19491 and #19491. Contributed by @SimonBrandner.
 * Fix removing a room from a Space and interaction with `m.space.parent` ([\#6944](https://github.com/matrix-org/matrix-react-sdk/pull/6944)). Fixes #19363 and #19363.
 * Fix recent css regression ([\#7022](https://github.com/matrix-org/matrix-react-sdk/pull/7022)). Fixes #19470 and #19470. Contributed by @CicadaCinema.
 * Fix ModalManager reRender racing with itself ([\#7027](https://github.com/matrix-org/matrix-react-sdk/pull/7027)). Fixes #19489 and #19489.
 * Fix fullscreening a call while connecting ([\#7019](https://github.com/matrix-org/matrix-react-sdk/pull/7019)). Fixes #19309 and #19309. Contributed by @SimonBrandner.
 * Allow scrolling right in reply-quoted code block ([\#7024](https://github.com/matrix-org/matrix-react-sdk/pull/7024)). Fixes #19487 and #19487. Contributed by @SimonBrandner.
 * Fix dark theme codeblock colors ([\#6384](https://github.com/matrix-org/matrix-react-sdk/pull/6384)). Fixes #17998. Contributed by @SimonBrandner.
 * Show passphrase input label ([\#6992](https://github.com/matrix-org/matrix-react-sdk/pull/6992)). Fixes #19428 and #19428. Contributed by @RafaelGoncalves8.
 * Always render disabled settings as disabled ([\#7014](https://github.com/matrix-org/matrix-react-sdk/pull/7014)).
 * Make "Security Phrase" placeholder look consistent cross-browser ([\#6870](https://github.com/matrix-org/matrix-react-sdk/pull/6870)). Fixes #19006 and #19006. Contributed by @neer17.
 * Fix direction override characters breaking member event text direction ([\#6999](https://github.com/matrix-org/matrix-react-sdk/pull/6999)).
 * Remove redundant text in verification dialogs ([\#6993](https://github.com/matrix-org/matrix-react-sdk/pull/6993)). Fixes #19290 and #19290. Contributed by @RafaelGoncalves8.
 * Fix space panel name overflowing ([\#6995](https://github.com/matrix-org/matrix-react-sdk/pull/6995)). Fixes #19455 and #19455.
 * Fix conflicting CSS on syntax highlighted blocks ([\#6991](https://github.com/matrix-org/matrix-react-sdk/pull/6991)). Fixes #19445 and #19445.

Changes in [1.9.3](https://github.com/vector-im/element-desktop/releases/tag/v1.9.3) (2021-10-25)
=================================================================================================

## ✨ Features
 * Convert the "Cryptography" settings panel to an HTML table to assist screen reader users. ([\#6968](https://github.com/matrix-org/matrix-react-sdk/pull/6968)). Contributed by [andybalaam](https://github.com/andybalaam).
 * Swap order of private space creation and tweak copy ([\#6967](https://github.com/matrix-org/matrix-react-sdk/pull/6967)). Fixes #18768 and #18768.
 * Add spacing to Room settings - Notifications subsection ([\#6962](https://github.com/matrix-org/matrix-react-sdk/pull/6962)). Contributed by [CicadaCinema](https://github.com/CicadaCinema).
 * Use HTML tables for some tabular user interface areas, to assist with screen reader use ([\#6955](https://github.com/matrix-org/matrix-react-sdk/pull/6955)). Contributed by [andybalaam](https://github.com/andybalaam).
 * Fix space invite edge cases ([\#6884](https://github.com/matrix-org/matrix-react-sdk/pull/6884)). Fixes #19010 #17345 and #19010.
 * Allow options to cascade kicks/bans throughout spaces ([\#6829](https://github.com/matrix-org/matrix-react-sdk/pull/6829)). Fixes #18969 and #18969.
 * Make public space alias field mandatory again ([\#6921](https://github.com/matrix-org/matrix-react-sdk/pull/6921)). Fixes #19003 and #19003.
 * Add progress bar to restricted room upgrade dialog ([\#6919](https://github.com/matrix-org/matrix-react-sdk/pull/6919)). Fixes #19146 and #19146.
 * Add customisation point for visibility of invites and room creation ([\#6922](https://github.com/matrix-org/matrix-react-sdk/pull/6922)). Fixes #19331 and #19331.
 * Inhibit `Unable to get validated threepid` error during UIA ([\#6928](https://github.com/matrix-org/matrix-react-sdk/pull/6928)). Fixes #18883 and #18883.
 * Tweak room list skeleton UI height and behaviour ([\#6926](https://github.com/matrix-org/matrix-react-sdk/pull/6926)). Fixes #18231 #16581 and #18231.
 * If public room creation fails, retry without publishing it ([\#6872](https://github.com/matrix-org/matrix-react-sdk/pull/6872)). Fixes #19194 and #19194. Contributed by [AndrewFerr](https://github.com/AndrewFerr).
 * Iterate invite your teammates to Space view ([\#6925](https://github.com/matrix-org/matrix-react-sdk/pull/6925)). Fixes #18772 and #18772.
 * Make placeholder more grey when no input ([\#6840](https://github.com/matrix-org/matrix-react-sdk/pull/6840)). Fixes #17243 and #17243. Contributed by [wlach](https://github.com/wlach).
 * Respect tombstones in locally known rooms for Space children ([\#6906](https://github.com/matrix-org/matrix-react-sdk/pull/6906)). Fixes #19246 #19256 and #19246.
 * Improve emoji shortcodes generated from annotations ([\#6907](https://github.com/matrix-org/matrix-react-sdk/pull/6907)). Fixes #19304 and #19304.
 * Hide kick & ban options in UserInfo when looking at own profile ([\#6911](https://github.com/matrix-org/matrix-react-sdk/pull/6911)). Fixes #19066 and #19066.
 * Add progress bar to Community to Space migration tool ([\#6887](https://github.com/matrix-org/matrix-react-sdk/pull/6887)). Fixes #19216 and #19216.

## 🐛 Bug Fixes
 * Fix leave space cancel button exploding ([\#6966](https://github.com/matrix-org/matrix-react-sdk/pull/6966)).
 * Fix edge case behaviour of the space join spinner for guests ([\#6972](https://github.com/matrix-org/matrix-react-sdk/pull/6972)). Fixes #19359 and #19359.
 * Convert emoticon to emoji at the end of a line on send even if the cursor isn't there ([\#6965](https://github.com/matrix-org/matrix-react-sdk/pull/6965)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix text overflows button on Home page ([\#6898](https://github.com/matrix-org/matrix-react-sdk/pull/6898)). Fixes #19180 and #19180. Contributed by [oliver-pham](https://github.com/oliver-pham).
 * Space Room View should react to join rule changes down /sync ([\#6945](https://github.com/matrix-org/matrix-react-sdk/pull/6945)). Fixes #19390 and #19390.
 * Hide leave section button if user isn't in the room e.g peeking ([\#6920](https://github.com/matrix-org/matrix-react-sdk/pull/6920)). Fixes #17410 and #17410.
 * Fix bug where room list would get stuck showing no rooms ([\#6939](https://github.com/matrix-org/matrix-react-sdk/pull/6939)). Fixes #19373 and #19373.
 * Update room settings dialog title when room name changes ([\#6916](https://github.com/matrix-org/matrix-react-sdk/pull/6916)). Fixes #17480 and #17480. Contributed by [psrpinto](https://github.com/psrpinto).
 * Fix editing losing emote-ness and rainbow-ness of messages ([\#6931](https://github.com/matrix-org/matrix-react-sdk/pull/6931)). Fixes #19350 and #19350.
 * Remove semicolon from notifications panel ([\#6930](https://github.com/matrix-org/matrix-react-sdk/pull/6930)). Contributed by [robintown](https://github.com/robintown).
 * Prevent profile image in left panel's backdrop from being selected ([\#6924](https://github.com/matrix-org/matrix-react-sdk/pull/6924)). Contributed by [rom4nik](https://github.com/rom4nik).
 * Validate that the phone number verification field is filled before allowing user to submit ([\#6918](https://github.com/matrix-org/matrix-react-sdk/pull/6918)). Fixes #19316 and #19316. Contributed by [VFermat](https://github.com/VFermat).
 * Updated how save button becomes disabled in room settings to listen for all fields instead of the most recent ([\#6917](https://github.com/matrix-org/matrix-react-sdk/pull/6917)). Contributed by [LoganArnett](https://github.com/LoganArnett).
 * Use FocusLock around ContextMenus to simplify focus management ([\#6311](https://github.com/matrix-org/matrix-react-sdk/pull/6311)). Fixes #19259 and #19259.
 * Fix space hierarchy pagination ([\#6908](https://github.com/matrix-org/matrix-react-sdk/pull/6908)). Fixes #19276 and #19276.
 * Fix spaces keyboard shortcuts not working for last space ([\#6909](https://github.com/matrix-org/matrix-react-sdk/pull/6909)). Fixes #19255 and #19255.
 * Use fallback avatar only for DMs with 2 people. ([\#6895](https://github.com/matrix-org/matrix-react-sdk/pull/6895)). Fixes #18747 and #18747. Contributed by [andybalaam](https://github.com/andybalaam).

Changes in [1.9.3-rc.3](https://github.com/vector-im/element-desktop/releases/tag/v1.9.3-rc.3) (2021-10-25)
===========================================================================================================

## 🐛 Bug Fixes
 * Remove highlightjs CSS ([\#19483](https://github.com/vector-im/element-web/pull/19483)). Fixes vector-im/element-web#19476


Changes in [1.9.3-rc.2](https://github.com/vector-im/element-desktop/releases/tag/v1.9.3-rc.2) (2021-10-20)
===========================================================================================================

## 🐛 Bug Fixes
 * Fix conflicting CSS on syntax highlighted blocks ([\#6991](https://github.com/matrix-org/matrix-react-sdk/pull/6991)). Fixes vector-im/element-web#19445

Changes in [1.9.3-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.9.3-rc.1) (2021-10-19)
===========================================================================================================

## ✨ Features
 * Swap order of private space creation and tweak copy ([\#6967](https://github.com/matrix-org/matrix-react-sdk/pull/6967)). Fixes #18768 and #18768.
 * Add spacing to Room settings - Notifications subsection ([\#6962](https://github.com/matrix-org/matrix-react-sdk/pull/6962)). Contributed by [CicadaCinema](https://github.com/CicadaCinema).
 * Convert the "Cryptography" settings panel to an HTML to assist screen reader users. ([\#6968](https://github.com/matrix-org/matrix-react-sdk/pull/6968)). Contributed by [andybalaam](https://github.com/andybalaam).
 * Use HTML tables for some tabular user interface areas, to assist with screen reader use ([\#6955](https://github.com/matrix-org/matrix-react-sdk/pull/6955)). Contributed by [andybalaam](https://github.com/andybalaam).
 * Fix space invite edge cases ([\#6884](https://github.com/matrix-org/matrix-react-sdk/pull/6884)). Fixes #19010 #17345 and #19010.
 * Allow options to cascade kicks/bans throughout spaces ([\#6829](https://github.com/matrix-org/matrix-react-sdk/pull/6829)). Fixes #18969 and #18969.
 * Make public space alias field mandatory again ([\#6921](https://github.com/matrix-org/matrix-react-sdk/pull/6921)). Fixes #19003 and #19003.
 * Add progress bar to restricted room upgrade dialog ([\#6919](https://github.com/matrix-org/matrix-react-sdk/pull/6919)). Fixes #19146 and #19146.
 * Add customisation point for visibility of invites and room creation ([\#6922](https://github.com/matrix-org/matrix-react-sdk/pull/6922)). Fixes #19331 and #19331.
 * Inhibit `Unable to get validated threepid` error during UIA ([\#6928](https://github.com/matrix-org/matrix-react-sdk/pull/6928)). Fixes #18883 and #18883.
 * Tweak room list skeleton UI height and behaviour ([\#6926](https://github.com/matrix-org/matrix-react-sdk/pull/6926)). Fixes #18231 #16581 and #18231.
 * If public room creation fails, retry without publishing it ([\#6872](https://github.com/matrix-org/matrix-react-sdk/pull/6872)). Fixes #19194 and #19194. Contributed by [AndrewFerr](https://github.com/AndrewFerr).
 * Iterate invite your teammates to Space view ([\#6925](https://github.com/matrix-org/matrix-react-sdk/pull/6925)). Fixes #18772 and #18772.
 * Make placeholder more grey when no input ([\#6840](https://github.com/matrix-org/matrix-react-sdk/pull/6840)). Fixes #17243 and #17243. Contributed by [wlach](https://github.com/wlach).
 * Respect tombstones in locally known rooms for Space children ([\#6906](https://github.com/matrix-org/matrix-react-sdk/pull/6906)). Fixes #19246 #19256 and #19246.
 * Improve emoji shortcodes generated from annotations ([\#6907](https://github.com/matrix-org/matrix-react-sdk/pull/6907)). Fixes #19304 and #19304.
 * Hide kick & ban options in UserInfo when looking at own profile ([\#6911](https://github.com/matrix-org/matrix-react-sdk/pull/6911)). Fixes #19066 and #19066.
 * Add progress bar to Community to Space migration tool ([\#6887](https://github.com/matrix-org/matrix-react-sdk/pull/6887)). Fixes #19216 and #19216.

## 🐛 Bug Fixes
 * Fix leave space cancel button exploding ([\#6966](https://github.com/matrix-org/matrix-react-sdk/pull/6966)).
 * Fix edge case behaviour of the space join spinner for guests ([\#6972](https://github.com/matrix-org/matrix-react-sdk/pull/6972)). Fixes #19359 and #19359.
 * Convert emoticon to emoji at the end of a line on send even if the cursor isn't there ([\#6965](https://github.com/matrix-org/matrix-react-sdk/pull/6965)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix text overflows button on Home page ([\#6898](https://github.com/matrix-org/matrix-react-sdk/pull/6898)). Fixes #19180 and #19180. Contributed by [oliver-pham](https://github.com/oliver-pham).
 * Space Room View should react to join rule changes down /sync ([\#6945](https://github.com/matrix-org/matrix-react-sdk/pull/6945)). Fixes #19390 and #19390.
 * Hide leave section button if user isn't in the room e.g peeking ([\#6920](https://github.com/matrix-org/matrix-react-sdk/pull/6920)). Fixes #17410 and #17410.
 * Fix bug where room list would get stuck showing no rooms ([\#6939](https://github.com/matrix-org/matrix-react-sdk/pull/6939)). Fixes #19373 and #19373.
 * Update room settings dialog title when room name changes ([\#6916](https://github.com/matrix-org/matrix-react-sdk/pull/6916)). Fixes #17480 and #17480. Contributed by [psrpinto](https://github.com/psrpinto).
 * Fix editing losing emote-ness and rainbow-ness of messages ([\#6931](https://github.com/matrix-org/matrix-react-sdk/pull/6931)). Fixes #19350 and #19350.
 * Remove semicolon from notifications panel ([\#6930](https://github.com/matrix-org/matrix-react-sdk/pull/6930)). Contributed by [robintown](https://github.com/robintown).
 * Prevent profile image in left panel's backdrop from being selected ([\#6924](https://github.com/matrix-org/matrix-react-sdk/pull/6924)). Contributed by [rom4nik](https://github.com/rom4nik).
 * Validate that the phone number verification field is filled before allowing user to submit ([\#6918](https://github.com/matrix-org/matrix-react-sdk/pull/6918)). Fixes #19316 and #19316. Contributed by [VFermat](https://github.com/VFermat).
 * Updated how save button becomes disabled in room settings to listen for all fields instead of the most recent ([\#6917](https://github.com/matrix-org/matrix-react-sdk/pull/6917)). Contributed by [LoganArnett](https://github.com/LoganArnett).
 * Use FocusLock around ContextMenus to simplify focus management ([\#6311](https://github.com/matrix-org/matrix-react-sdk/pull/6311)). Fixes #19259 and #19259.
 * Fix space hierarchy pagination ([\#6908](https://github.com/matrix-org/matrix-react-sdk/pull/6908)). Fixes #19276 and #19276.
 * Fix spaces keyboard shortcuts not working for last space ([\#6909](https://github.com/matrix-org/matrix-react-sdk/pull/6909)). Fixes #19255 and #19255.
 * Use fallback avatar only for DMs with 2 people. ([\#6895](https://github.com/matrix-org/matrix-react-sdk/pull/6895)). Fixes #18747 and #18747. Contributed by [andybalaam](https://github.com/andybalaam).

Changes in [1.9.2](https://github.com/vector-im/element-desktop/releases/tag/v1.9.2) (2021-10-12)
=================================================================================================

## 🐛 Bug Fixes
 * Upgrade to matrix-js-sdk#14.0.1

Changes in [1.9.1](https://github.com/vector-im/element-desktop/releases/tag/v1.9.1) (2021-10-11)
=================================================================================================

## ✨ Features
 * Decrease profile button touch target ([\#6900](https://github.com/matrix-org/matrix-react-sdk/pull/6900)). Contributed by [ColonisationCaptain](https://github.com/ColonisationCaptain).
 * Don't let click events propagate out of context menus ([\#6892](https://github.com/matrix-org/matrix-react-sdk/pull/6892)).
 * Allow closing Dropdown via its chevron ([\#6885](https://github.com/matrix-org/matrix-react-sdk/pull/6885)). Fixes #19030 and #19030.
 * Improve AUX panel behaviour ([\#6699](https://github.com/matrix-org/matrix-react-sdk/pull/6699)). Fixes #18787 and #18787. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * A nicer opening animation for the Image View ([\#6454](https://github.com/matrix-org/matrix-react-sdk/pull/6454)). Fixes #18186 and #18186. Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * [Release] Fix space hierarchy pagination ([\#6910](https://github.com/matrix-org/matrix-react-sdk/pull/6910)).
 * Fix leaving space via other client leaving you in undefined-land ([\#6891](https://github.com/matrix-org/matrix-react-sdk/pull/6891)). Fixes #18455 and #18455.
 * Handle newer voice message encrypted event format for chat export ([\#6893](https://github.com/matrix-org/matrix-react-sdk/pull/6893)). Contributed by [jaiwanth-v](https://github.com/jaiwanth-v).
 * Fix pagination when filtering space hierarchy ([\#6876](https://github.com/matrix-org/matrix-react-sdk/pull/6876)). Fixes #19235 and #19235.
 * Fix spaces null-guard breaking the dispatcher settings watching ([\#6886](https://github.com/matrix-org/matrix-react-sdk/pull/6886)). Fixes #19223 and #19223.
 * Fix space children without specific `order` being sorted after those with one ([\#6878](https://github.com/matrix-org/matrix-react-sdk/pull/6878)). Fixes #19192 and #19192.
 * Ensure that sub-spaces aren't considered for notification badges ([\#6881](https://github.com/matrix-org/matrix-react-sdk/pull/6881)). Fixes #18975 and #18975.
 * Fix timeline autoscroll with non-standard DPI settings. ([\#6880](https://github.com/matrix-org/matrix-react-sdk/pull/6880)). Fixes #18984 and #18984.
 * Pluck out JoinRuleSettings styles so they apply in space settings too ([\#6879](https://github.com/matrix-org/matrix-react-sdk/pull/6879)). Fixes #19164 and #19164.
 * Null guard around the matrixClient in SpaceStore ([\#6874](https://github.com/matrix-org/matrix-react-sdk/pull/6874)).
 * Fix issue (https ([\#6871](https://github.com/matrix-org/matrix-react-sdk/pull/6871)). Fixes #19138 and #19138. Contributed by [psrpinto](https://github.com/psrpinto).
 * Fix pills being cut off in message bubble layout ([\#6865](https://github.com/matrix-org/matrix-react-sdk/pull/6865)). Fixes #18627 and #18627. Contributed by [robintown](https://github.com/robintown).
 * Fix space admin check false positive on multiple admins ([\#6824](https://github.com/matrix-org/matrix-react-sdk/pull/6824)).
 * Fix the User View ([\#6860](https://github.com/matrix-org/matrix-react-sdk/pull/6860)). Fixes #19158 and #19158.
 * Fix spacing for message composer buttons ([\#6852](https://github.com/matrix-org/matrix-react-sdk/pull/6852)). Fixes #18999 and #18999.
 * Always show root event of a thread in room's timeline ([\#6842](https://github.com/matrix-org/matrix-react-sdk/pull/6842)). Fixes #19016 and #19016.

Changes in [1.9.1-rc.2](https://github.com/vector-im/element-desktop/releases/tag/v1.9.1-rc.2) (2021-10-08)
===========================================================================================================

## 🐛 Bug Fixes

Changes in [1.9.1-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.9.1-rc.1) (2021-10-04)
===========================================================================================================

## ✨ Features
 * Decrease profile button touch target ([\#6900](https://github.com/matrix-org/matrix-react-sdk/pull/6900)). Contributed by [ColonisationCaptain](https://github.com/ColonisationCaptain).
 * Don't let click events propagate out of context menus ([\#6892](https://github.com/matrix-org/matrix-react-sdk/pull/6892)).
 * Allow closing Dropdown via its chevron ([\#6885](https://github.com/matrix-org/matrix-react-sdk/pull/6885)). Fixes #19030 and #19030.
 * Improve AUX panel behaviour ([\#6699](https://github.com/matrix-org/matrix-react-sdk/pull/6699)). Fixes #18787 and #18787. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * A nicer opening animation for the Image View ([\#6454](https://github.com/matrix-org/matrix-react-sdk/pull/6454)). Fixes #18186 and #18186. Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * Fix leaving space via other client leaving you in undefined-land ([\#6891](https://github.com/matrix-org/matrix-react-sdk/pull/6891)). Fixes #18455 and #18455.
 * Handle newer voice message encrypted event format for chat export ([\#6893](https://github.com/matrix-org/matrix-react-sdk/pull/6893)). Contributed by [jaiwanth-v](https://github.com/jaiwanth-v).
 * Fix pagination when filtering space hierarchy ([\#6876](https://github.com/matrix-org/matrix-react-sdk/pull/6876)). Fixes #19235 and #19235.
 * Fix spaces null-guard breaking the dispatcher settings watching ([\#6886](https://github.com/matrix-org/matrix-react-sdk/pull/6886)). Fixes #19223 and #19223.
 * Fix space children without specific `order` being sorted after those with one ([\#6878](https://github.com/matrix-org/matrix-react-sdk/pull/6878)). Fixes #19192 and #19192.
 * Ensure that sub-spaces aren't considered for notification badges ([\#6881](https://github.com/matrix-org/matrix-react-sdk/pull/6881)). Fixes #18975 and #18975.
 * Fix timeline autoscroll with non-standard DPI settings. ([\#6880](https://github.com/matrix-org/matrix-react-sdk/pull/6880)). Fixes #18984 and #18984.
 * Pluck out JoinRuleSettings styles so they apply in space settings too ([\#6879](https://github.com/matrix-org/matrix-react-sdk/pull/6879)). Fixes #19164 and #19164.
 * Null guard around the matrixClient in SpaceStore ([\#6874](https://github.com/matrix-org/matrix-react-sdk/pull/6874)).
 * Fix issue (https ([\#6871](https://github.com/matrix-org/matrix-react-sdk/pull/6871)). Fixes #19138 and #19138. Contributed by [psrpinto](https://github.com/psrpinto).
 * Fix pills being cut off in message bubble layout ([\#6865](https://github.com/matrix-org/matrix-react-sdk/pull/6865)). Fixes #18627 and #18627. Contributed by [robintown](https://github.com/robintown).
 * Fix space admin check false positive on multiple admins ([\#6824](https://github.com/matrix-org/matrix-react-sdk/pull/6824)).
 * Fix the User View ([\#6860](https://github.com/matrix-org/matrix-react-sdk/pull/6860)). Fixes #19158 and #19158.
 * Fix spacing for message composer buttons ([\#6852](https://github.com/matrix-org/matrix-react-sdk/pull/6852)). Fixes #18999 and #18999.
 * Always show root event of a thread in room's timeline ([\#6842](https://github.com/matrix-org/matrix-react-sdk/pull/6842)). Fixes #19016 and #19016.

Changes in [1.9.0](https://github.com/vector-im/element-desktop/releases/tag/v1.9.0) (2021-09-27)
=================================================================================================

## ✨ Features
 * Fix space keyboard shortcuts conflicting with native zoom shortcuts ([\#19037](https://github.com/vector-im/element-web/pull/19037)). Fixes #18481 and undefined/element-web#18481.
 * Say Joining space instead of Joining room where we know its a space ([\#6818](https://github.com/matrix-org/matrix-react-sdk/pull/6818)). Fixes #19064 and #19064.
 * Add warning that some spaces may not be relinked to the newly upgraded room ([\#6805](https://github.com/matrix-org/matrix-react-sdk/pull/6805)). Fixes #18858 and #18858.
 * Delabs Spaces, iterate some copy and move communities/space toggle to preferences ([\#6594](https://github.com/matrix-org/matrix-react-sdk/pull/6594)). Fixes #18088, #18524 #18088 and #18088.
 * Show "Message" in the user info panel instead of "Start chat" ([\#6319](https://github.com/matrix-org/matrix-react-sdk/pull/6319)). Fixes #17877 and #17877. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix space keyboard shortcuts conflicting with native zoom shortcuts ([\#6804](https://github.com/matrix-org/matrix-react-sdk/pull/6804)).
 * Replace plain text emoji at the end of a line ([\#6784](https://github.com/matrix-org/matrix-react-sdk/pull/6784)). Fixes #18833 and #18833. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Simplify Space Panel layout and fix some edge cases ([\#6800](https://github.com/matrix-org/matrix-react-sdk/pull/6800)). Fixes #18694 and #18694.
 * Show unsent message warning on Space Panel buttons ([\#6778](https://github.com/matrix-org/matrix-react-sdk/pull/6778)). Fixes #18891 and #18891.
 * Hide mute/unmute button in UserInfo for Spaces as it makes no sense ([\#6790](https://github.com/matrix-org/matrix-react-sdk/pull/6790)). Fixes #19007 and #19007.
 * Fix automatic field population in space create menu not validating ([\#6792](https://github.com/matrix-org/matrix-react-sdk/pull/6792)). Fixes #19005 and #19005.
 * Optimize input label transition on focus ([\#6783](https://github.com/matrix-org/matrix-react-sdk/pull/6783)). Fixes #12876 and #12876. Contributed by [MadLittleMods](https://github.com/MadLittleMods).
 * Adapt and re-use the RolesRoomSettingsTab for Spaces ([\#6779](https://github.com/matrix-org/matrix-react-sdk/pull/6779)). Fixes #18908 #18909 and #18908.
 * Deduplicate join rule management between rooms and spaces ([\#6724](https://github.com/matrix-org/matrix-react-sdk/pull/6724)). Fixes #18798 and #18798.
 * Add config option to turn on in-room event sending timing metrics ([\#6766](https://github.com/matrix-org/matrix-react-sdk/pull/6766)).
 * Improve the upgrade for restricted user experience ([\#6764](https://github.com/matrix-org/matrix-react-sdk/pull/6764)). Fixes #18677 and #18677.
 * Improve tooltips on space quick actions and explore button ([\#6760](https://github.com/matrix-org/matrix-react-sdk/pull/6760)). Fixes #18528 and #18528.
 * Make space members and user info behave more expectedly ([\#6765](https://github.com/matrix-org/matrix-react-sdk/pull/6765)). Fixes #17018 and #17018.
 * hide no-op m.room.encryption events and better word param changes ([\#6747](https://github.com/matrix-org/matrix-react-sdk/pull/6747)). Fixes #18597 and #18597.
 * Respect m.space.parent relations if they hold valid permissions ([\#6746](https://github.com/matrix-org/matrix-react-sdk/pull/6746)). Fixes #10935 and #10935.
 * Space panel accessibility improvements ([\#6744](https://github.com/matrix-org/matrix-react-sdk/pull/6744)). Fixes #18892 and #18892.

## 🐛 Bug Fixes
 * Fix spacing for message composer buttons ([\#6854](https://github.com/matrix-org/matrix-react-sdk/pull/6854)).
 * Fix accessing field on oobData which may be undefined ([\#6830](https://github.com/matrix-org/matrix-react-sdk/pull/6830)). Fixes #19085 and #19085.
 * Fix reactions aria-label not being a string and thus being read as [Object object] ([\#6828](https://github.com/matrix-org/matrix-react-sdk/pull/6828)).
 * Fix missing null guard in space hierarchy pagination ([\#6821](https://github.com/matrix-org/matrix-react-sdk/pull/6821)). Fixes matrix-org/element-web-rageshakes#6299 and matrix-org/element-web-rageshakes#6299.
 * Fix checks to show prompt to start new chats ([\#6812](https://github.com/matrix-org/matrix-react-sdk/pull/6812)).
 * Fix room list scroll jumps ([\#6777](https://github.com/matrix-org/matrix-react-sdk/pull/6777)). Fixes #17460 #18440 and #17460. Contributed by [robintown](https://github.com/robintown).
 * Fix various message bubble alignment issues ([\#6785](https://github.com/matrix-org/matrix-react-sdk/pull/6785)). Fixes #18293, #18294 #18305 and #18293. Contributed by [robintown](https://github.com/robintown).
 * Make message bubble font size consistent ([\#6795](https://github.com/matrix-org/matrix-react-sdk/pull/6795)). Contributed by [robintown](https://github.com/robintown).
 * Fix edge cases around joining new room which does not belong to active space ([\#6797](https://github.com/matrix-org/matrix-react-sdk/pull/6797)). Fixes #19025 and #19025.
 * Fix edge case space issues around creation and initial view ([\#6798](https://github.com/matrix-org/matrix-react-sdk/pull/6798)). Fixes #19023 and #19023.
 * Stop spinner on space preview if the join fails ([\#6803](https://github.com/matrix-org/matrix-react-sdk/pull/6803)). Fixes #19034 and #19034.
 * Fix emoji picker and stickerpicker not appearing correctly when opened ([\#6793](https://github.com/matrix-org/matrix-react-sdk/pull/6793)). Fixes #19012 and #19012. Contributed by [Palid](https://github.com/Palid).
 * Fix autocomplete not having y-scroll ([\#6794](https://github.com/matrix-org/matrix-react-sdk/pull/6794)). Fixes #18997 and #18997. Contributed by [Palid](https://github.com/Palid).
 * Fix broken edge case with public space creation with no alias ([\#6791](https://github.com/matrix-org/matrix-react-sdk/pull/6791)). Fixes #19003 and #19003.
 * Redirect from /#/welcome to /#/home if already logged in ([\#6786](https://github.com/matrix-org/matrix-react-sdk/pull/6786)). Fixes #18990 and #18990. Contributed by [aaronraimist](https://github.com/aaronraimist).
 * Fix build issues from two conflicting PRs landing without merge conflict ([\#6780](https://github.com/matrix-org/matrix-react-sdk/pull/6780)).
 * Render guest settings only in public rooms/spaces ([\#6693](https://github.com/matrix-org/matrix-react-sdk/pull/6693)). Fixes #18776 and #18776. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix message bubble corners being wrong in the presence of hidden events ([\#6776](https://github.com/matrix-org/matrix-react-sdk/pull/6776)). Fixes #18124 and #18124. Contributed by [robintown](https://github.com/robintown).
 * Debounce read marker update on scroll ([\#6771](https://github.com/matrix-org/matrix-react-sdk/pull/6771)). Fixes #18961 and #18961.
 * Use cursor:pointer on space panel buttons ([\#6770](https://github.com/matrix-org/matrix-react-sdk/pull/6770)). Fixes #18951 and #18951.
 * Fix regressed tab view buttons in space update toast ([\#6761](https://github.com/matrix-org/matrix-react-sdk/pull/6761)). Fixes #18781 and #18781.

Changes in [1.8.6-rc.2](https://github.com/vector-im/element-desktop/releases/tag/v1.8.6-rc.2) (2021-09-22)
===========================================================================================================

## 🐛 Bug Fixes
 * Fix spacing for message composer buttons ([\#6854](https://github.com/matrix-org/matrix-react-sdk/pull/6854)).

Changes in [1.8.6-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.8.6-rc.1) (2021-09-21)
===========================================================================================================

## ✨ Features
 * Fix space keyboard shortcuts conflicting with native zoom shortcuts ([\#19037](https://github.com/vector-im/element-web/pull/19037)). Fixes #18481 and undefined/element-web#18481.
 * Say Joining space instead of Joining room where we know its a space ([\#6818](https://github.com/matrix-org/matrix-react-sdk/pull/6818)). Fixes #19064 and #19064.
 * Add warning that some spaces may not be relinked to the newly upgraded room ([\#6805](https://github.com/matrix-org/matrix-react-sdk/pull/6805)). Fixes #18858 and #18858.
 * Delabs Spaces, iterate some copy and move communities/space toggle to preferences ([\#6594](https://github.com/matrix-org/matrix-react-sdk/pull/6594)). Fixes #18088, #18524 #18088 and #18088.
 * Show "Message" in the user info panel instead of "Start chat" ([\#6319](https://github.com/matrix-org/matrix-react-sdk/pull/6319)). Fixes #17877 and #17877. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix space keyboard shortcuts conflicting with native zoom shortcuts ([\#6804](https://github.com/matrix-org/matrix-react-sdk/pull/6804)).
 * Replace plain text emoji at the end of a line ([\#6784](https://github.com/matrix-org/matrix-react-sdk/pull/6784)). Fixes #18833 and #18833. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Simplify Space Panel layout and fix some edge cases ([\#6800](https://github.com/matrix-org/matrix-react-sdk/pull/6800)). Fixes #18694 and #18694.
 * Show unsent message warning on Space Panel buttons ([\#6778](https://github.com/matrix-org/matrix-react-sdk/pull/6778)). Fixes #18891 and #18891.
 * Hide mute/unmute button in UserInfo for Spaces as it makes no sense ([\#6790](https://github.com/matrix-org/matrix-react-sdk/pull/6790)). Fixes #19007 and #19007.
 * Fix automatic field population in space create menu not validating ([\#6792](https://github.com/matrix-org/matrix-react-sdk/pull/6792)). Fixes #19005 and #19005.
 * Optimize input label transition on focus ([\#6783](https://github.com/matrix-org/matrix-react-sdk/pull/6783)). Fixes #12876 and #12876. Contributed by [MadLittleMods](https://github.com/MadLittleMods).
 * Adapt and re-use the RolesRoomSettingsTab for Spaces ([\#6779](https://github.com/matrix-org/matrix-react-sdk/pull/6779)). Fixes #18908 #18909 and #18908.
 * Deduplicate join rule management between rooms and spaces ([\#6724](https://github.com/matrix-org/matrix-react-sdk/pull/6724)). Fixes #18798 and #18798.
 * Add config option to turn on in-room event sending timing metrics ([\#6766](https://github.com/matrix-org/matrix-react-sdk/pull/6766)).
 * Improve the upgrade for restricted user experience ([\#6764](https://github.com/matrix-org/matrix-react-sdk/pull/6764)). Fixes #18677 and #18677.
 * Improve tooltips on space quick actions and explore button ([\#6760](https://github.com/matrix-org/matrix-react-sdk/pull/6760)). Fixes #18528 and #18528.
 * Make space members and user info behave more expectedly ([\#6765](https://github.com/matrix-org/matrix-react-sdk/pull/6765)). Fixes #17018 and #17018.
 * hide no-op m.room.encryption events and better word param changes ([\#6747](https://github.com/matrix-org/matrix-react-sdk/pull/6747)). Fixes #18597 and #18597.
 * Respect m.space.parent relations if they hold valid permissions ([\#6746](https://github.com/matrix-org/matrix-react-sdk/pull/6746)). Fixes #10935 and #10935.
 * Space panel accessibility improvements ([\#6744](https://github.com/matrix-org/matrix-react-sdk/pull/6744)). Fixes #18892 and #18892.

## 🐛 Bug Fixes
 * Revert Firefox composer deletion hacks ([\#6844](https://github.com/matrix-org/matrix-react-sdk/pull/6844)). Fixes #19103 and #19103. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix accessing field on oobData which may be undefined ([\#6830](https://github.com/matrix-org/matrix-react-sdk/pull/6830)). Fixes #19085 and #19085.
 * Fix pill deletion on Firefox 78 ([\#6832](https://github.com/matrix-org/matrix-react-sdk/pull/6832)). Fixes #19077 and #19077. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix reactions aria-label not being a string and thus being read as [Object object] ([\#6828](https://github.com/matrix-org/matrix-react-sdk/pull/6828)).
 * Fix missing null guard in space hierarchy pagination ([\#6821](https://github.com/matrix-org/matrix-react-sdk/pull/6821)). Fixes matrix-org/element-web-rageshakes#6299 and matrix-org/element-web-rageshakes#6299.
 * Fix checks to show prompt to start new chats ([\#6812](https://github.com/matrix-org/matrix-react-sdk/pull/6812)).
 * Fix room list scroll jumps ([\#6777](https://github.com/matrix-org/matrix-react-sdk/pull/6777)). Fixes #17460 #18440 and #17460. Contributed by [robintown](https://github.com/robintown).
 * Fix various message bubble alignment issues ([\#6785](https://github.com/matrix-org/matrix-react-sdk/pull/6785)). Fixes #18293, #18294 #18305 and #18293. Contributed by [robintown](https://github.com/robintown).
 * Make message bubble font size consistent ([\#6795](https://github.com/matrix-org/matrix-react-sdk/pull/6795)). Contributed by [robintown](https://github.com/robintown).
 * Fix edge cases around joining new room which does not belong to active space ([\#6797](https://github.com/matrix-org/matrix-react-sdk/pull/6797)). Fixes #19025 and #19025.
 * Fix edge case space issues around creation and initial view ([\#6798](https://github.com/matrix-org/matrix-react-sdk/pull/6798)). Fixes #19023 and #19023.
 * Stop spinner on space preview if the join fails ([\#6803](https://github.com/matrix-org/matrix-react-sdk/pull/6803)). Fixes #19034 and #19034.
 * Fix emoji picker and stickerpicker not appearing correctly when opened ([\#6793](https://github.com/matrix-org/matrix-react-sdk/pull/6793)). Fixes #19012 and #19012. Contributed by [Palid](https://github.com/Palid).
 * Fix autocomplete not having y-scroll ([\#6794](https://github.com/matrix-org/matrix-react-sdk/pull/6794)). Fixes #18997 and #18997. Contributed by [Palid](https://github.com/Palid).
 * Fix broken edge case with public space creation with no alias ([\#6791](https://github.com/matrix-org/matrix-react-sdk/pull/6791)). Fixes #19003 and #19003.
 * Redirect from /#/welcome to /#/home if already logged in ([\#6786](https://github.com/matrix-org/matrix-react-sdk/pull/6786)). Fixes #18990 and #18990. Contributed by [aaronraimist](https://github.com/aaronraimist).
 * Fix build issues from two conflicting PRs landing without merge conflict ([\#6780](https://github.com/matrix-org/matrix-react-sdk/pull/6780)).
 * Render guest settings only in public rooms/spaces ([\#6693](https://github.com/matrix-org/matrix-react-sdk/pull/6693)). Fixes #18776 and #18776. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix message bubble corners being wrong in the presence of hidden events ([\#6776](https://github.com/matrix-org/matrix-react-sdk/pull/6776)). Fixes #18124 and #18124. Contributed by [robintown](https://github.com/robintown).
 * Debounce read marker update on scroll ([\#6771](https://github.com/matrix-org/matrix-react-sdk/pull/6771)). Fixes #18961 and #18961.
 * Use cursor:pointer on space panel buttons ([\#6770](https://github.com/matrix-org/matrix-react-sdk/pull/6770)). Fixes #18951 and #18951.
 * Fix regressed tab view buttons in space update toast ([\#6761](https://github.com/matrix-org/matrix-react-sdk/pull/6761)). Fixes #18781 and #18781.

Changes in [1.8.5](https://github.com/vector-im/element-desktop/releases/tag/v1.8.5) (2021-09-14)
=================================================================================================

## ✨ Features
 * Add bubble highlight styling ([\#6582](https://github.com/matrix-org/matrix-react-sdk/pull/6582)). Fixes #18295 and #18295. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Create narrow mode for Composer ([\#6682](https://github.com/matrix-org/matrix-react-sdk/pull/6682)). Fixes #18533 and #18533.
 * Prefer matrix.to alias links over room id in spaces & share ([\#6745](https://github.com/matrix-org/matrix-react-sdk/pull/6745)). Fixes #18796 and #18796.
 * Stop automatic playback of voice messages if a non-voice message is encountered ([\#6728](https://github.com/matrix-org/matrix-react-sdk/pull/6728)). Fixes #18850 and #18850.
 * Show call length during a call ([\#6700](https://github.com/matrix-org/matrix-react-sdk/pull/6700)). Fixes #18566 and #18566. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Serialize and retry mass-leave when leaving space ([\#6737](https://github.com/matrix-org/matrix-react-sdk/pull/6737)). Fixes #18789 and #18789.
 * Improve form handling in and around space creation ([\#6739](https://github.com/matrix-org/matrix-react-sdk/pull/6739)). Fixes #18775 and #18775.
 * Split autoplay GIFs and videos into different settings ([\#6726](https://github.com/matrix-org/matrix-react-sdk/pull/6726)). Fixes #5771 and #5771. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add autoplay for voice messages ([\#6710](https://github.com/matrix-org/matrix-react-sdk/pull/6710)). Fixes #18804, #18715, #18714 #17961 and #18804.
 * Allow to use basic html to format invite messages ([\#6703](https://github.com/matrix-org/matrix-react-sdk/pull/6703)). Fixes #15738 and #15738. Contributed by [skolmer](https://github.com/skolmer).
 * Allow widgets, when eligible, to interact with more rooms as per MSC2762 ([\#6684](https://github.com/matrix-org/matrix-react-sdk/pull/6684)).
 * Remove arbitrary limits from send/receive events for widgets ([\#6719](https://github.com/matrix-org/matrix-react-sdk/pull/6719)). Fixes #17994 and #17994.
 * Reload suggested rooms if we see the state change down /sync ([\#6715](https://github.com/matrix-org/matrix-react-sdk/pull/6715)). Fixes #18761 and #18761.
 * When creating private spaces, make the initial rooms restricted if supported ([\#6721](https://github.com/matrix-org/matrix-react-sdk/pull/6721)). Fixes #18722 and #18722.
 * Threading exploration work ([\#6658](https://github.com/matrix-org/matrix-react-sdk/pull/6658)). Fixes #18532 and #18532.
 * Default to `Don't leave any` when leaving a space ([\#6697](https://github.com/matrix-org/matrix-react-sdk/pull/6697)). Fixes #18592 and #18592. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Special case redaction event sending from widgets per MSC2762 ([\#6686](https://github.com/matrix-org/matrix-react-sdk/pull/6686)). Fixes #18573 and #18573.
 * Add active speaker indicators ([\#6639](https://github.com/matrix-org/matrix-react-sdk/pull/6639)). Fixes #17627 and #17627. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Increase general app performance by optimizing layers ([\#6644](https://github.com/matrix-org/matrix-react-sdk/pull/6644)). Fixes #18730 and #18730. Contributed by [Palid](https://github.com/Palid).

## 🐛 Bug Fixes
 * Fix autocomplete not having y-scroll ([\#6802](https://github.com/matrix-org/matrix-react-sdk/pull/6802)).
 * Fix emoji picker and stickerpicker not appearing correctly when opened ([\#6801](https://github.com/matrix-org/matrix-react-sdk/pull/6801)).
 * Debounce read marker update on scroll ([\#6774](https://github.com/matrix-org/matrix-react-sdk/pull/6774)).
 * Fix Space creation wizard go to my first room button behaviour ([\#6748](https://github.com/matrix-org/matrix-react-sdk/pull/6748)). Fixes #18764 and #18764.
 * Fix scroll being stuck at bottom ([\#6751](https://github.com/matrix-org/matrix-react-sdk/pull/6751)). Fixes #18903 and #18903.
 * Fix widgets not remembering identity verification when asked to. ([\#6742](https://github.com/matrix-org/matrix-react-sdk/pull/6742)). Fixes #15631 and #15631.
 * Add missing pluralisation i18n strings for Spaces ([\#6738](https://github.com/matrix-org/matrix-react-sdk/pull/6738)). Fixes #18780 and #18780.
 * Make ForgotPassword UX slightly more user friendly ([\#6636](https://github.com/matrix-org/matrix-react-sdk/pull/6636)). Fixes #11531 and #11531. Contributed by [Palid](https://github.com/Palid).
 * Don't context switch room on SpaceStore ready as it can break permalinks ([\#6730](https://github.com/matrix-org/matrix-react-sdk/pull/6730)). Fixes #17974 and #17974.
 * Fix explore rooms button not working during space creation wizard ([\#6729](https://github.com/matrix-org/matrix-react-sdk/pull/6729)). Fixes #18762 and #18762.
 * Fix bug where one party's media would sometimes not be shown ([\#6731](https://github.com/matrix-org/matrix-react-sdk/pull/6731)).
 * Only make the initial space rooms suggested by default ([\#6714](https://github.com/matrix-org/matrix-react-sdk/pull/6714)). Fixes #18760 and #18760.
 * Replace fake username in EventTilePreview with a proper loading state ([\#6702](https://github.com/matrix-org/matrix-react-sdk/pull/6702)). Fixes #15897 and #15897. Contributed by [skolmer](https://github.com/skolmer).
 * Don't send prehistorical events to widgets during decryption at startup ([\#6695](https://github.com/matrix-org/matrix-react-sdk/pull/6695)). Fixes #18060 and #18060.
 * When creating subspaces properly set restricted join rule ([\#6725](https://github.com/matrix-org/matrix-react-sdk/pull/6725)). Fixes #18797 and #18797.
 * Fix the Image View not openning for some pinned messages ([\#6723](https://github.com/matrix-org/matrix-react-sdk/pull/6723)). Fixes #18422 and #18422. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Show autocomplete sections vertically ([\#6722](https://github.com/matrix-org/matrix-react-sdk/pull/6722)). Fixes #18860 and #18860. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix EmojiPicker filtering to lower case emojibase data strings ([\#6717](https://github.com/matrix-org/matrix-react-sdk/pull/6717)). Fixes #18686 and #18686.
 * Clear currentRoomId when viewing home page, fixing document title ([\#6716](https://github.com/matrix-org/matrix-react-sdk/pull/6716)). Fixes #18668 and #18668.
 * Fix membership updates to Spaces not applying in real-time ([\#6713](https://github.com/matrix-org/matrix-react-sdk/pull/6713)). Fixes #18737 and #18737.
 * Don't show a double stacked invite modals when inviting to Spaces ([\#6698](https://github.com/matrix-org/matrix-react-sdk/pull/6698)). Fixes #18745 and #18745. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Remove non-functional DuckDuckGo Autocomplete Provider ([\#6712](https://github.com/matrix-org/matrix-react-sdk/pull/6712)). Fixes #18778 and #18778.
 * Filter members on `MemberList` load ([\#6708](https://github.com/matrix-org/matrix-react-sdk/pull/6708)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix improper voice messages being produced in Firefox and sometimes other browsers. ([\#6696](https://github.com/matrix-org/matrix-react-sdk/pull/6696)). Fixes #18587 and #18587.
 * Fix client forgetting which capabilities a widget was approved for ([\#6685](https://github.com/matrix-org/matrix-react-sdk/pull/6685)). Fixes #18786 and #18786.
 * Fix left panel widgets not remembering collapsed state ([\#6687](https://github.com/matrix-org/matrix-react-sdk/pull/6687)). Fixes #17803 and #17803.
 * Fix changelog link colour back to blue ([\#6692](https://github.com/matrix-org/matrix-react-sdk/pull/6692)). Fixes #18726 and #18726.
 * Soften codeblock border color ([\#6564](https://github.com/matrix-org/matrix-react-sdk/pull/6564)). Fixes #18367 and #18367. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Pause ringing more aggressively ([\#6691](https://github.com/matrix-org/matrix-react-sdk/pull/6691)). Fixes #18588 and #18588. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix command autocomplete ([\#6680](https://github.com/matrix-org/matrix-react-sdk/pull/6680)). Fixes #18670 and #18670. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Don't re-sort the room-list based on profile/status changes ([\#6595](https://github.com/matrix-org/matrix-react-sdk/pull/6595)). Fixes #110 and #110. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix codeblock formatting with syntax highlighting on ([\#6681](https://github.com/matrix-org/matrix-react-sdk/pull/6681)). Fixes #18739 #18365 and #18739. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add padding to the Add button in the notification settings ([\#6665](https://github.com/matrix-org/matrix-react-sdk/pull/6665)). Fixes #18706 and #18706. Contributed by [SimonBrandner](https://github.com/SimonBrandner).

Changes in [1.8.4](https://github.com/vector-im/element-web/releases/tag/v1.8.4) (2021-09-13)
=================================================================================================

## 🔒 SECURITY FIXES
 * Fix a security issue with message key sharing. See https://matrix.org/blog/2021/09/13/vulnerability-disclosure-key-sharing
   for details.

Changes in [1.8.2](https://github.com/vector-im/element-desktop/releases/tag/v1.8.2) (2021-08-31)
=================================================================================================

## ✨ Features
 * Documentation for sentry config ([\#18608](https://github.com/vector-im/element-web/pull/18608)). Contributed by [novocaine](https://github.com/novocaine).
 * [Release]Increase general app performance by optimizing layers ([\#6672](https://github.com/matrix-org/matrix-react-sdk/pull/6672)). Fixes #18730 and #18730. Contributed by [Palid](https://github.com/Palid).
 * Add a warning on E2EE rooms if you try to make them public ([\#5698](https://github.com/matrix-org/matrix-react-sdk/pull/5698)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Allow pagination of the space hierarchy and use new APIs ([\#6507](https://github.com/matrix-org/matrix-react-sdk/pull/6507)). Fixes #18089 and #18427.
 * Improve emoji in composer ([\#6650](https://github.com/matrix-org/matrix-react-sdk/pull/6650)). Fixes #18593 and #18593. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Allow playback of replied-to voice message ([\#6629](https://github.com/matrix-org/matrix-react-sdk/pull/6629)). Fixes #18599 and #18599. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Format autocomplete suggestions vertically ([\#6620](https://github.com/matrix-org/matrix-react-sdk/pull/6620)). Fixes #17574 and #17574. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Remember last `MemberList` search query per-room ([\#6640](https://github.com/matrix-org/matrix-react-sdk/pull/6640)). Fixes #18613 and #18613. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Sentry rageshakes ([\#6597](https://github.com/matrix-org/matrix-react-sdk/pull/6597)). Fixes #11111 and #11111. Contributed by [novocaine](https://github.com/novocaine).
 * Autocomplete has been updated to match modern accessibility standards. Navigate via up/down arrows rather than Tab. Enter or Tab to confirm a suggestion. This should be familiar to Slack & Discord users. You can now use Tab to navigate around the application and do more without touching your mouse. No more accidentally sending half of people's names because the completion didn't fire on Enter! ([\#5659](https://github.com/matrix-org/matrix-react-sdk/pull/5659)). Fixes #4872, #11071, #17171, #15646 #4872 and #4872.
 * Add new call tile states ([\#6610](https://github.com/matrix-org/matrix-react-sdk/pull/6610)). Fixes #18521 and #18521. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Left align call tiles ([\#6609](https://github.com/matrix-org/matrix-react-sdk/pull/6609)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Make loading encrypted images look snappier ([\#6590](https://github.com/matrix-org/matrix-react-sdk/pull/6590)). Fixes #17878 and #17862. Contributed by [Palid](https://github.com/Palid).
 * Offer a way to create a space based on existing community ([\#6543](https://github.com/matrix-org/matrix-react-sdk/pull/6543)). Fixes #18092.
 * Accessibility improvements in and around Spaces ([\#6569](https://github.com/matrix-org/matrix-react-sdk/pull/6569)). Fixes #18094 and #18094.

## 🐛 Bug Fixes
 * [Release] Fix commit edit history ([\#6690](https://github.com/matrix-org/matrix-react-sdk/pull/6690)). Fixes #18742 and #18742. Contributed by [Palid](https://github.com/Palid).
 * Fix images not rendering when sent from other clients. ([\#6661](https://github.com/matrix-org/matrix-react-sdk/pull/6661)). Fixes #18702 and #18702.
 * Fix autocomplete scrollbar and make the autocomplete a little smaller ([\#6655](https://github.com/matrix-org/matrix-react-sdk/pull/6655)). Fixes #18682 and #18682. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix replies on the bubble layout ([\#6451](https://github.com/matrix-org/matrix-react-sdk/pull/6451)). Fixes #18184. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Show "Enable encryption in settings" only when the user can do that ([\#6646](https://github.com/matrix-org/matrix-react-sdk/pull/6646)). Fixes #18646 and #18646. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix cross signing setup from settings screen ([\#6633](https://github.com/matrix-org/matrix-react-sdk/pull/6633)). Fixes #17761 and #17761.
 * Fix call tiles on the bubble layout ([\#6647](https://github.com/matrix-org/matrix-react-sdk/pull/6647)). Fixes #18648 and #18648. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix error on accessing encrypted media without encryption keys ([\#6625](https://github.com/matrix-org/matrix-react-sdk/pull/6625)). Contributed by [Palid](https://github.com/Palid).
 * Fix jitsi widget sometimes being permanently stuck in the bottom-right corner ([\#6632](https://github.com/matrix-org/matrix-react-sdk/pull/6632)). Fixes #17226 and #17226. Contributed by [Palid](https://github.com/Palid).
 * Fix FilePanel pagination in E2EE rooms ([\#6630](https://github.com/matrix-org/matrix-react-sdk/pull/6630)). Fixes #18415 and #18415. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix call tile buttons ([\#6624](https://github.com/matrix-org/matrix-react-sdk/pull/6624)). Fixes #18565 and #18565. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix vertical call tile spacing issues ([\#6621](https://github.com/matrix-org/matrix-react-sdk/pull/6621)). Fixes #18558 and #18558. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix long display names in call tiles ([\#6618](https://github.com/matrix-org/matrix-react-sdk/pull/6618)). Fixes #18562 and #18562. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Avoid access token overflow ([\#6616](https://github.com/matrix-org/matrix-react-sdk/pull/6616)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Properly handle media errors  ([\#6615](https://github.com/matrix-org/matrix-react-sdk/pull/6615)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix glare related regressions ([\#6614](https://github.com/matrix-org/matrix-react-sdk/pull/6614)). Fixes #18538 and #18538. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix long display names in call toasts ([\#6617](https://github.com/matrix-org/matrix-react-sdk/pull/6617)). Fixes #18557 and #18557. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix PiP of held calls ([\#6611](https://github.com/matrix-org/matrix-react-sdk/pull/6611)). Fixes #18539 and #18539. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix call tile behaviour on narrow layouts ([\#6556](https://github.com/matrix-org/matrix-react-sdk/pull/6556)). Fixes #18398. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix video call persisting when widget removed ([\#6608](https://github.com/matrix-org/matrix-react-sdk/pull/6608)). Fixes #15703 and #15703.
 * Fix toast colors ([\#6606](https://github.com/matrix-org/matrix-react-sdk/pull/6606)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Remove tiny scrollbar dot from code blocks ([\#6596](https://github.com/matrix-org/matrix-react-sdk/pull/6596)). Fixes #18474. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve handling of pills in the composer ([\#6353](https://github.com/matrix-org/matrix-react-sdk/pull/6353)). Fixes #10134 #10896 and #15037. Contributed by [SimonBrandner](https://github.com/SimonBrandner).

Changes in [1.8.1](https://github.com/vector-im/element-desktop/releases/tag/v1.8.1) (2021-08-17)
=================================================================================================

## 🐛 Bug Fixes
 * Fix multiple VoIP regressions ([matrix-org/matrix-js-sdk#1860](https://github.com/matrix-org/matrix-js-sdk/pull/1860)).

Changes in [1.8.0](https://github.com/vector-im/element-desktop/releases/tag/v1.8.0) (2021-08-16)
=================================================================================================

## ✨ Features
 * Show how long a call was on call tiles ([\#6570](https://github.com/matrix-org/matrix-react-sdk/pull/6570)). Fixes #18405. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add regional indicators to emoji picker ([\#6490](https://github.com/matrix-org/matrix-react-sdk/pull/6490)). Fixes #14963. Contributed by [robintown](https://github.com/robintown).
 * Make call control buttons accessible to screen reader users ([\#6181](https://github.com/matrix-org/matrix-react-sdk/pull/6181)). Fixes #18358. Contributed by [pvagner](https://github.com/pvagner).
 * Skip sending a thumbnail if it is not a sufficient saving over the original ([\#6559](https://github.com/matrix-org/matrix-react-sdk/pull/6559)). Fixes #17906.
 * Increase PiP snapping speed ([\#6539](https://github.com/matrix-org/matrix-react-sdk/pull/6539)). Fixes #18371. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve and move the incoming call toast ([\#6470](https://github.com/matrix-org/matrix-react-sdk/pull/6470)). Fixes #17912. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Allow all of the URL schemes that Firefox allows ([\#6457](https://github.com/matrix-org/matrix-react-sdk/pull/6457)). Contributed by [aaronraimist](https://github.com/aaronraimist).
 * Improve bubble layout colors ([\#6452](https://github.com/matrix-org/matrix-react-sdk/pull/6452)). Fixes #18081. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Spaces let users switch between Home and All Rooms behaviours ([\#6497](https://github.com/matrix-org/matrix-react-sdk/pull/6497)). Fixes #18093.
 * Support for MSC2285 (hidden read receipts) ([\#6390](https://github.com/matrix-org/matrix-react-sdk/pull/6390)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Group pinned message events with MELS ([\#6349](https://github.com/matrix-org/matrix-react-sdk/pull/6349)). Fixes #17938. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Make version copiable ([\#6227](https://github.com/matrix-org/matrix-react-sdk/pull/6227)). Fixes #17603 and #18329. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve voice messages uploading state ([\#6530](https://github.com/matrix-org/matrix-react-sdk/pull/6530)). Fixes #18226 and #18224.
 * Add surround with feature ([\#5510](https://github.com/matrix-org/matrix-react-sdk/pull/5510)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve call event tile wording ([\#6545](https://github.com/matrix-org/matrix-react-sdk/pull/6545)). Fixes #18376. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Show an avatar/a turned off microphone icon for muted users ([\#6486](https://github.com/matrix-org/matrix-react-sdk/pull/6486)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Prompt user to leave rooms/subspaces in a space when leaving space ([\#6424](https://github.com/matrix-org/matrix-react-sdk/pull/6424)). Fixes #18071.
 * Add support for screen sharing in 1:1 calls ([\#5992](https://github.com/matrix-org/matrix-react-sdk/pull/5992)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * Dismiss electron download toast when clicking Open ([\#18267](https://github.com/vector-im/element-web/pull/18267)). Fixes #18266.
 * [Release] Fix glare related regressions ([\#6622](https://github.com/matrix-org/matrix-react-sdk/pull/6622)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * [Release] Fix PiP of held calls ([\#6612](https://github.com/matrix-org/matrix-react-sdk/pull/6612)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * [Release] Fix toast colors ([\#6607](https://github.com/matrix-org/matrix-react-sdk/pull/6607)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix [object Object] in Widget Permissions ([\#6560](https://github.com/matrix-org/matrix-react-sdk/pull/6560)). Fixes #18384. Contributed by [Palid](https://github.com/Palid).
 * Fix right margin for events on IRC layout ([\#6542](https://github.com/matrix-org/matrix-react-sdk/pull/6542)). Fixes #18354.
 * Mirror only usermedia feeds ([\#6512](https://github.com/matrix-org/matrix-react-sdk/pull/6512)). Fixes #5633. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix LogoutDialog warning + TypeScript migration ([\#6533](https://github.com/matrix-org/matrix-react-sdk/pull/6533)).
 * Fix the wrong font being used in the room topic field ([\#6527](https://github.com/matrix-org/matrix-react-sdk/pull/6527)). Fixes #18339. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix inconsistent styling for links on hover ([\#6513](https://github.com/matrix-org/matrix-react-sdk/pull/6513)). Contributed by [janogarcia](https://github.com/janogarcia).
 * Fix incorrect height for encoded placeholder images ([\#6514](https://github.com/matrix-org/matrix-react-sdk/pull/6514)). Contributed by [Palid](https://github.com/Palid).
 * Fix call events layout for message bubble ([\#6465](https://github.com/matrix-org/matrix-react-sdk/pull/6465)). Fixes #18144.
 * Improve subspaces and some utilities around room/space creation ([\#6458](https://github.com/matrix-org/matrix-react-sdk/pull/6458)). Fixes #18090 #18091 and #17256.
 * Restore pointer cursor for SenderProfile in message bubbles ([\#6501](https://github.com/matrix-org/matrix-react-sdk/pull/6501)). Fixes #18249.
 * Fix issues with the Call View ([\#6472](https://github.com/matrix-org/matrix-react-sdk/pull/6472)). Fixes #18221. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Align event list summary read receipts when using message bubbles ([\#6500](https://github.com/matrix-org/matrix-react-sdk/pull/6500)). Fixes #18143.
 * Better positioning for unbubbled events in timeline ([\#6477](https://github.com/matrix-org/matrix-react-sdk/pull/6477)). Fixes #18132.
 * Realign reactions row with messages in modern layout ([\#6491](https://github.com/matrix-org/matrix-react-sdk/pull/6491)). Fixes #18118. Contributed by [robintown](https://github.com/robintown).
 * Fix CreateRoomDialog exploding when making public room outside of a space ([\#6492](https://github.com/matrix-org/matrix-react-sdk/pull/6492)). Fixes #18275.
 * Fix call crashing because `element` was undefined ([\#6488](https://github.com/matrix-org/matrix-react-sdk/pull/6488)). Fixes #18270. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Upscale thumbnails to the container size ([\#6589](https://github.com/matrix-org/matrix-react-sdk/pull/6589)). Fixes #18307.
 * Fix create room dialog in spaces no longer adding to the space ([\#6587](https://github.com/matrix-org/matrix-react-sdk/pull/6587)). Fixes #18465.
 * Don't show a modal on call reject/user hangup ([\#6580](https://github.com/matrix-org/matrix-react-sdk/pull/6580)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fade Call View Buttons after `componentDidMount` ([\#6581](https://github.com/matrix-org/matrix-react-sdk/pull/6581)). Fixes #18439. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix missing expand button on codeblocks ([\#6565](https://github.com/matrix-org/matrix-react-sdk/pull/6565)). Fixes #18388. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * allow customizing the bubble layout colors ([\#6568](https://github.com/matrix-org/matrix-react-sdk/pull/6568)). Fixes #18408. Contributed by [benneti](https://github.com/benneti).
 * Don't flash "Missed call" when accepting a call ([\#6567](https://github.com/matrix-org/matrix-react-sdk/pull/6567)). Fixes #18404. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix clicking whitespaces on replies ([\#6571](https://github.com/matrix-org/matrix-react-sdk/pull/6571)). Fixes #18327. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix composer not being disabled when sending voice messages ([\#6562](https://github.com/matrix-org/matrix-react-sdk/pull/6562)). Fixes #18413.
 * Fix sizing issues of the screen picker ([\#6498](https://github.com/matrix-org/matrix-react-sdk/pull/6498)). Fixes #18281. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Stop voice messages that are playing when starting a recording ([\#6563](https://github.com/matrix-org/matrix-react-sdk/pull/6563)). Fixes #18410.
 * Fix random box appearing when clicking room list headers. ([\#6561](https://github.com/matrix-org/matrix-react-sdk/pull/6561)). Fixes #18414.
 * Null guard space inviter to prevent the app exploding ([\#6558](https://github.com/matrix-org/matrix-react-sdk/pull/6558)).
 * Make the ringing sound mutable/disablable ([\#6534](https://github.com/matrix-org/matrix-react-sdk/pull/6534)). Fixes #15591. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix wrong cursor being used in PiP ([\#6551](https://github.com/matrix-org/matrix-react-sdk/pull/6551)). Fixes #18383. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Re-pin Jitsi if the widget already exists ([\#6226](https://github.com/matrix-org/matrix-react-sdk/pull/6226)). Fixes #17679. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix broken call notification regression ([\#6526](https://github.com/matrix-org/matrix-react-sdk/pull/6526)). Fixes #18335. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * createRoom, only send join rule event if we have a join rule to put in it ([\#6516](https://github.com/matrix-org/matrix-react-sdk/pull/6516)). Fixes #18301.
 * Fix clicking pills inside replies ([\#6508](https://github.com/matrix-org/matrix-react-sdk/pull/6508)). Fixes #18283. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix grecaptcha regression ([\#6503](https://github.com/matrix-org/matrix-react-sdk/pull/6503)). Fixes #18284. Contributed by [Palid](https://github.com/Palid).
 * Fix compatibility with accounts where the security passphrase was created on a mobile device ([\#1819](https://github.com/matrix-org/matrix-js-sdk/pull/1819)).

Changes in [1.7.34](https://github.com/vector-im/element-desktop/releases/tag/v1.7.34) (2021-08-02)
===================================================================================================

## 🔒 SECURITY FIXES
 * Sanitize untrusted variables from message previews before translation
   Fixes vector-im/element-web#18314

## ✨ Features
 * Fix editing of `<sub>` & `<sup`> & `<u>`
   [\#6469](https://github.com/matrix-org/matrix-react-sdk/pull/6469)
   Fixes #18211
 * Zoom images in lightbox to where the cursor points
   [\#6418](https://github.com/matrix-org/matrix-react-sdk/pull/6418)
   Fixes #17870
 * Avoid hitting the settings store from TextForEvent
   [\#6205](https://github.com/matrix-org/matrix-react-sdk/pull/6205)
   Fixes #17650
 * Initial MSC3083 + MSC3244 support
   [\#6212](https://github.com/matrix-org/matrix-react-sdk/pull/6212)
   Fixes #17686 and #17661
 * Navigate to the first room with notifications when clicked on space notification dot
   [\#5974](https://github.com/matrix-org/matrix-react-sdk/pull/5974)
 * Add matrix: to the list of permitted URL schemes
   [\#6388](https://github.com/matrix-org/matrix-react-sdk/pull/6388)
 * Add "Copy Link" to room context menu
   [\#6374](https://github.com/matrix-org/matrix-react-sdk/pull/6374)
 * 💭 Message bubble layout
   [\#6291](https://github.com/matrix-org/matrix-react-sdk/pull/6291)
   Fixes #4635, #17773 #16220 and #7687
 * Play only one audio file at a time
   [\#6417](https://github.com/matrix-org/matrix-react-sdk/pull/6417)
   Fixes #17439
 * Move download button for media to the action bar
   [\#6386](https://github.com/matrix-org/matrix-react-sdk/pull/6386)
   Fixes #17943
 * Improved display of one-to-one call history with summary boxes for each call
   [\#6121](https://github.com/matrix-org/matrix-react-sdk/pull/6121)
   Fixes #16409
 * Notification settings UI refresh
   [\#6352](https://github.com/matrix-org/matrix-react-sdk/pull/6352)
   Fixes #17782
 * Fix EventIndex double handling events and erroring
   [\#6385](https://github.com/matrix-org/matrix-react-sdk/pull/6385)
   Fixes #18008
 * Improve reply rendering
   [\#3553](https://github.com/matrix-org/matrix-react-sdk/pull/3553)
   Fixes vector-im/riot-web#9217, vector-im/riot-web#7633, vector-im/riot-web#7530, vector-im/riot-web#7169, vector-im/riot-web#7151, vector-im/riot-web#6692 vector-im/riot-web#6579 and #17440
 * Improve performance of room name calculation
   [\#1801](https://github.com/matrix-org/matrix-js-sdk/pull/1801)

## 🐛 Bug Fixes
 * Fix browser history getting stuck looping back to the same room
   [\#18053](https://github.com/vector-im/element-web/pull/18053)
 * Fix space shortcuts on layouts with non-English keys in the places of numbers
   [\#17780](https://github.com/vector-im/element-web/pull/17780)
   Fixes #17776
 * Fix CreateRoomDialog exploding when making public room outside of a space
   [\#6493](https://github.com/matrix-org/matrix-react-sdk/pull/6493)
 * Fix regression where registration would soft-crash on captcha
   [\#6505](https://github.com/matrix-org/matrix-react-sdk/pull/6505)
   Fixes #18284
 * only send join rule event if we have a join rule to put in it
   [\#6517](https://github.com/matrix-org/matrix-react-sdk/pull/6517)
 * Improve the new download button's discoverability and interactions.
   [\#6510](https://github.com/matrix-org/matrix-react-sdk/pull/6510)
 * Fix voice recording UI looking broken while microphone permissions are being requested.
   [\#6479](https://github.com/matrix-org/matrix-react-sdk/pull/6479)
   Fixes #18223
 * Match colors of room and user avatars in DMs
   [\#6393](https://github.com/matrix-org/matrix-react-sdk/pull/6393)
   Fixes #2449
 * Fix onPaste handler to work with copying files from Finder
   [\#5389](https://github.com/matrix-org/matrix-react-sdk/pull/5389)
   Fixes #15536 and #16255
 * Fix infinite pagination loop when offline
   [\#6478](https://github.com/matrix-org/matrix-react-sdk/pull/6478)
   Fixes #18242
 * Fix blurhash rounded corners missing regression
   [\#6467](https://github.com/matrix-org/matrix-react-sdk/pull/6467)
   Fixes #18110
 * Fix position of the space hierarchy spinner
   [\#6462](https://github.com/matrix-org/matrix-react-sdk/pull/6462)
   Fixes #18182
 * Fix display of image messages that lack thumbnails
   [\#6456](https://github.com/matrix-org/matrix-react-sdk/pull/6456)
   Fixes #18175
 * Fix crash with large audio files.
   [\#6436](https://github.com/matrix-org/matrix-react-sdk/pull/6436)
   Fixes #18149
 * Make diff colors in codeblocks more pleasant
   [\#6355](https://github.com/matrix-org/matrix-react-sdk/pull/6355)
   Fixes #17939
 * Show the correct audio file duration while loading the file.
   [\#6435](https://github.com/matrix-org/matrix-react-sdk/pull/6435)
   Fixes #18160
 * Fix various timeline settings not applying immediately.
   [\#6261](https://github.com/matrix-org/matrix-react-sdk/pull/6261)
   Fixes #17748
 * Fix issues with room list duplication
   [\#6391](https://github.com/matrix-org/matrix-react-sdk/pull/6391)
   Fixes #14508
 * Fix grecaptcha throwing useless error sometimes
   [\#6401](https://github.com/matrix-org/matrix-react-sdk/pull/6401)
   Fixes #15142
 * Update Emojibase and Twemoji and switch to IamCal (Slack-style) shortcodes
   [\#6347](https://github.com/matrix-org/matrix-react-sdk/pull/6347)
   Fixes #13857 and #13334
 * Respect compound emojis in default avatar initial generation
   [\#6397](https://github.com/matrix-org/matrix-react-sdk/pull/6397)
   Fixes #18040
 * Fix bug where the 'other homeserver' field in the server selection dialog would become briefly focus and then unfocus when clicked.
   [\#6394](https://github.com/matrix-org/matrix-react-sdk/pull/6394)
   Fixes #18031
 * Standardise spelling and casing of homeserver, identity server, and integration manager
   [\#6365](https://github.com/matrix-org/matrix-react-sdk/pull/6365)
 * Fix widgets not receiving decrypted events when they have permission.
   [\#6371](https://github.com/matrix-org/matrix-react-sdk/pull/6371)
   Fixes #17615
 * Prevent client hangs when calculating blurhashes
   [\#6366](https://github.com/matrix-org/matrix-react-sdk/pull/6366)
   Fixes #17945
 * Exclude state events from widgets reading room events
   [\#6378](https://github.com/matrix-org/matrix-react-sdk/pull/6378)
 * Cache feature_spaces\* flags to improve performance
   [\#6381](https://github.com/matrix-org/matrix-react-sdk/pull/6381)

Changes in [1.7.33](https://github.com/vector-im/element-web/releases/tag/v1.7.33) (2021-07-19)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.33-rc.1...v1.7.33)

 * No changes from rc.1

Changes in [1.7.33-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.33-rc.1) (2021-07-14)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.32...v1.7.33-rc.1)

 * Translations update from Weblate
   [\#17991](https://github.com/vector-im/element-web/pull/17991)
 * Revert "Don't run nginx as root in docker"
   [\#17990](https://github.com/vector-im/element-web/pull/17990)
 * Don't run nginx as root in docker
   [\#17927](https://github.com/vector-im/element-web/pull/17927)
 * Add VS Code to gitignore
   [\#17982](https://github.com/vector-im/element-web/pull/17982)
 * Remove canvas native dependencies from Dockerfile
   [\#17973](https://github.com/vector-im/element-web/pull/17973)
 * Remove node-canvas devDependency
   [\#17967](https://github.com/vector-im/element-web/pull/17967)
 * Add `reskindex` to development steps
   [\#17926](https://github.com/vector-im/element-web/pull/17926)
 * Update Modernizr and stop it from polluting classes on the html tag
   [\#17921](https://github.com/vector-im/element-web/pull/17921)
 * Convert a few files to TS
   [\#17895](https://github.com/vector-im/element-web/pull/17895)
 * Do not generate a lockfile when running in CI
   [\#17902](https://github.com/vector-im/element-web/pull/17902)
 * Fix lockfile to match listed dependencies
   [\#17888](https://github.com/vector-im/element-web/pull/17888)
 * Remove PostCSS calc() processing
   [\#17856](https://github.com/vector-im/element-web/pull/17856)
 * Make issue template styling more consistent and improve PR template
   [\#17691](https://github.com/vector-im/element-web/pull/17691)
 * Update jsrsasign to ^10.2.0 (Includes fix for CVE-2021-30246)
   [\#17170](https://github.com/vector-im/element-web/pull/17170)
 * Migrate to `eslint-plugin-matrix-org`
   [\#17847](https://github.com/vector-im/element-web/pull/17847)
 * Remove spurious overflow: auto on #matrixchat element
   [\#17647](https://github.com/vector-im/element-web/pull/17647)
 * Enhance security by disallowing CSP object-src rule
   [\#17818](https://github.com/vector-im/element-web/pull/17818)

Changes in [1.7.32](https://github.com/vector-im/element-web/releases/tag/v1.7.32) (2021-07-05)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.32-rc.1...v1.7.32)

 * No changes from rc.1

Changes in [1.7.32-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.32-rc.1) (2021-06-29)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.31...v1.7.32-rc.1)

 * Update to react-sdk v3.25.0-rc.1 and js-sdk v12.0.1-rc.1
 * Translations update from Weblate
   [\#17832](https://github.com/vector-im/element-web/pull/17832)
 * Fix canvas-filter-polyfill mock path
   [\#17785](https://github.com/vector-im/element-web/pull/17785)
 * Mock context-filter-polyfill for app-tests
   [\#17774](https://github.com/vector-im/element-web/pull/17774)
 * Add libera.chat to default room directory
   [\#17772](https://github.com/vector-im/element-web/pull/17772)
 * Improve typing of Event Index Manager / Seshat
   [\#17704](https://github.com/vector-im/element-web/pull/17704)
 * Bump dns-packet from 1.3.1 to 1.3.4
   [\#17478](https://github.com/vector-im/element-web/pull/17478)
 * Update matrix-widget-api to fix build issues
   [\#17747](https://github.com/vector-im/element-web/pull/17747)
 * Fix whitespace in Dockerfile
   [\#17742](https://github.com/vector-im/element-web/pull/17742)
 * Upgrade @types/react and @types/react-dom
   [\#17723](https://github.com/vector-im/element-web/pull/17723)
 * Spaces keyboard shortcuts first cut
   [\#17457](https://github.com/vector-im/element-web/pull/17457)
 * Labs: feature_report_to_moderators
   [\#17694](https://github.com/vector-im/element-web/pull/17694)

Changes in [1.7.31](https://github.com/vector-im/element-web/releases/tag/v1.7.31) (2021-06-21)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.31-rc.1...v1.7.31)

 * Upgrade to React SDK 3.24.0 and JS SDK 12.0.0

Changes in [1.7.31-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.31-rc.1) (2021-06-15)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.30...v1.7.31-rc.1)

 * Upgrade to React SDK 3.24.0-rc.1 and JS SDK 12.0.0-rc.1
 * Translations update from Weblate
   [\#17655](https://github.com/vector-im/element-web/pull/17655)
 * Upgrade matrix-react-test-utils for React 17 peer deps
   [\#17653](https://github.com/vector-im/element-web/pull/17653)
 * Fix lint errors in Webpack config
   [\#17626](https://github.com/vector-im/element-web/pull/17626)
 * Preload only `woff2` fonts
   [\#17614](https://github.com/vector-im/element-web/pull/17614)
 * ⚛️ Upgrade to React@17
   [\#17601](https://github.com/vector-im/element-web/pull/17601)

Changes in [1.7.30](https://github.com/vector-im/element-web/releases/tag/v1.7.30) (2021-06-07)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.30-rc.1...v1.7.30)

 * Upgrade to React SDK 3.23.0 and JS SDK 11.2.0

Changes in [1.7.30-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.30-rc.1) (2021-06-01)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.29...v1.7.30-rc.1)

 * Upgrade to React SDK 3.23.0-rc.1 and JS SDK 11.2.0-rc.1
 * Translations update from Weblate
   [\#17526](https://github.com/vector-im/element-web/pull/17526)
 * Add Modernizr test for Promise.allSettled given js-sdk and react-sdk depend
   on it
   [\#17464](https://github.com/vector-im/element-web/pull/17464)
 * Bump libolm dependency, and update package name.
   [\#17433](https://github.com/vector-im/element-web/pull/17433)
 * Remove logo spinner
   [\#17423](https://github.com/vector-im/element-web/pull/17423)

Changes in [1.7.29](https://github.com/vector-im/element-web/releases/tag/v1.7.29) (2021-05-24)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.29-rc.1...v1.7.29)

## Security notice

Element Web 1.7.29 fixes (by upgrading to olm 3.2.3) an issue in code used for
decrypting server-side stored secrets. The issue could potentially allow a
malicious homeserver to cause a stack buffer overflow in the affected function
and to control that function's local variables.

## All changes

 * Upgrade to React SDK 3.22.0 and JS SDK 11.1.0
 * [Release] Bump libolm dependency, and update package name
   [\#17456](https://github.com/vector-im/element-web/pull/17456)

Changes in [1.7.29-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.29-rc.1) (2021-05-19)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.28...v1.7.29-rc.1)

 * Upgrade to React SDK 3.22.0-rc.1 and JS SDK 11.1.0-rc.1
 * Translations update from Weblate
   [\#17384](https://github.com/vector-im/element-web/pull/17384)
 * Prevent minification of `.html` files
   [\#17349](https://github.com/vector-im/element-web/pull/17349)
 * Update matrix-widget-api/react-sdk dependency reference
   [\#17346](https://github.com/vector-im/element-web/pull/17346)
 * Add `yarn start:https`
   [\#16989](https://github.com/vector-im/element-web/pull/16989)
 * Translations update from Weblate
   [\#17239](https://github.com/vector-im/element-web/pull/17239)
 * Remove "in development" flag from voice messages labs documentation
   [\#17204](https://github.com/vector-im/element-web/pull/17204)
 * Add required webpack+jest config to load Safari support modules
   [\#17193](https://github.com/vector-im/element-web/pull/17193)

Changes in [1.7.28](https://github.com/vector-im/element-web/releases/tag/v1.7.28) (2021-05-17)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.28-rc.1...v1.7.28)

## Security notice

Element Web 1.7.28 fixes (by upgrading to matrix-react-sdk 3.21.0) a low
severity issue (GHSA-8796-gc9j-63rv) related to file upload. When uploading a
file, the local file preview can lead to execution of scripts embedded in the
uploaded file, but only after several user interactions to open the preview in
a separate tab. This only impacts the local user while in the process of
uploading. It cannot be exploited remotely or by other users. Thanks to
[Muhammad Zaid Ghifari](https://github.com/MR-ZHEEV) for responsibly disclosing
this via Matrix's Security Disclosure Policy.

## All changes

 * Upgrade to React SDK 3.21.0 and JS SDK 11.0.0

Changes in [1.7.28-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.28-rc.1) (2021-05-11)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.27...v1.7.28-rc.1)

 * Upgrade to React SDK 3.21.0-rc.1 and JS SDK 11.0.0-rc.1
 * Switch back to release version of `sanitize-html`
   [\#17231](https://github.com/vector-im/element-web/pull/17231)
 * Bump url-parse from 1.4.7 to 1.5.1
   [\#17199](https://github.com/vector-im/element-web/pull/17199)
 * Bump lodash from 4.17.20 to 4.17.21
   [\#17205](https://github.com/vector-im/element-web/pull/17205)
 * Bump hosted-git-info from 2.8.8 to 2.8.9
   [\#17219](https://github.com/vector-im/element-web/pull/17219)
 * Disable host checking on the webpack dev server
   [\#17194](https://github.com/vector-im/element-web/pull/17194)
 * Bump ua-parser-js from 0.7.23 to 0.7.24
   [\#17190](https://github.com/vector-im/element-web/pull/17190)

Changes in [1.7.27](https://github.com/vector-im/element-web/releases/tag/v1.7.27) (2021-05-10)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.27-rc.1...v1.7.27)

 * Upgrade to React SDK 3.20.0 and JS SDK 10.1.0

Changes in [1.7.27-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.27-rc.1) (2021-05-04)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.26...v1.7.27-rc.1)

 * Upgrade to React SDK 3.20.0-rc.1 and JS SDK 10.1.0-rc.1
 * Translations update from Weblate
   [\#17160](https://github.com/vector-im/element-web/pull/17160)
 * Document option for obeying asserted identity
   [\#17008](https://github.com/vector-im/element-web/pull/17008)
 * Implement IPC call to Electron to set language
   [\#17052](https://github.com/vector-im/element-web/pull/17052)
 * Convert Vector skin react components to Typescript
   [\#17061](https://github.com/vector-im/element-web/pull/17061)
 * Add code quality review policy
   [\#16980](https://github.com/vector-im/element-web/pull/16980)
 * Register RecorderWorklet from react-sdk
   [\#17013](https://github.com/vector-im/element-web/pull/17013)
 * Preload Inter font to avoid FOIT on slow connections
   [\#17039](https://github.com/vector-im/element-web/pull/17039)
 * Disable `postcss-calc`'s noisy `warnWhenCannotResolve` option
   [\#17041](https://github.com/vector-im/element-web/pull/17041)

Changes in [1.7.26](https://github.com/vector-im/element-web/releases/tag/v1.7.26) (2021-04-26)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.26-rc.1...v1.7.26)

 * Upgrade to React SDK 3.19.0 and JS SDK 10.0.0

Changes in [1.7.26-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.26-rc.1) (2021-04-21)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.25...v1.7.26-rc.1)

 * Upgrade to React SDK 3.19.0-rc.1 and JS SDK 10.0.0-rc.1
 * Translations update from Weblate
   [\#17031](https://github.com/vector-im/element-web/pull/17031)
 * Bump ssri from 6.0.1 to 6.0.2
   [\#17010](https://github.com/vector-im/element-web/pull/17010)
 * Fix `NODE_ENV` value for CI environments
   [\#17003](https://github.com/vector-im/element-web/pull/17003)
 * Use React production mode in CI builds
   [\#16969](https://github.com/vector-im/element-web/pull/16969)
 * Labs documentation for DND mode
   [\#16962](https://github.com/vector-im/element-web/pull/16962)
 * Rename blackboxing to new option ignore list
   [\#16965](https://github.com/vector-im/element-web/pull/16965)
 * Remove velocity-animate from lockfile
   [\#16963](https://github.com/vector-im/element-web/pull/16963)
 * Add mobile download link configuration
   [\#16890](https://github.com/vector-im/element-web/pull/16890)
 * Switch develop to not-staging Scalar by default
   [\#16883](https://github.com/vector-im/element-web/pull/16883)
 * Support a config option to skip login/welcome and go to SSO
   [\#16880](https://github.com/vector-im/element-web/pull/16880)

Changes in [1.7.25](https://github.com/vector-im/element-web/releases/tag/v1.7.25) (2021-04-12)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.25-rc.1...v1.7.25)

 * Upgrade to React SDK 3.18.0 and JS SDK 9.11.0

Changes in [1.7.25-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.25-rc.1) (2021-04-07)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.24...v1.7.25-rc.1)

 * Upgrade to React SDK 3.18.0-rc.1 and JS SDK 9.11.0-rc.1
 * Translations update from Weblate
   [\#16882](https://github.com/vector-im/element-web/pull/16882)
 * Revert "Docker image: serve pre-compressed assets using gzip_static"
   [\#16838](https://github.com/vector-im/element-web/pull/16838)
 * Move native node modules documentation to element-desktop
   [\#16814](https://github.com/vector-im/element-web/pull/16814)
 * Add user settings for warn before exit
   [\#16781](https://github.com/vector-im/element-web/pull/16781)
 * Change ISSUE_TEMPLATE bold lines to proper headers
   [\#16768](https://github.com/vector-im/element-web/pull/16768)
 * Add example for deployment into Kubernetes
   [\#16447](https://github.com/vector-im/element-web/pull/16447)
 * Create bare-bones `PULL_REQUEST_TEMPLATE.md`
   [\#16770](https://github.com/vector-im/element-web/pull/16770)
 * Add webpack config and labs flag docs for voice messages
   [\#16705](https://github.com/vector-im/element-web/pull/16705)

Changes in [1.7.24](https://github.com/vector-im/element-web/releases/tag/v1.7.24) (2021-03-29)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.24-rc.1...v1.7.24)

 * Upgrade to React SDK 3.17.0 and JS SDK 9.10.0

Changes in [1.7.24-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.24-rc.1) (2021-03-25)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.23...v1.7.24-rc.1)

 * Upgrade to React SDK 3.17.0-rc.2 and JS SDK 9.10.0-rc.1
 * Translations update from Weblate
   [\#16766](https://github.com/vector-im/element-web/pull/16766)
 * Docker image: serve pre-compressed assets using gzip_static
   [\#16698](https://github.com/vector-im/element-web/pull/16698)
 * Fix style lint issues
   [\#16732](https://github.com/vector-im/element-web/pull/16732)
 * Updated expected webpack output in setup guide
   [\#16740](https://github.com/vector-im/element-web/pull/16740)
 * Docs for `loginForWelcome`
   [\#16468](https://github.com/vector-im/element-web/pull/16468)
 * Disable rageshake persistence if no logs would be submitted
   [\#16697](https://github.com/vector-im/element-web/pull/16697)

Changes in [1.7.23](https://github.com/vector-im/element-web/releases/tag/v1.7.23) (2021-03-15)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.23-rc.1...v1.7.23)

 * Upgrade to React SDK 3.16.0 and JS SDK 9.9.0

Changes in [1.7.23-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.23-rc.1) (2021-03-10)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.22...v1.7.23-rc.1)

 * Upgrade to React SDK 3.16.0-rc.2 and JS SDK 9.9.0-rc.1
 * Translations update from Weblate
   [\#16655](https://github.com/vector-im/element-web/pull/16655)
 * Improve docs for customisations
   [\#16652](https://github.com/vector-im/element-web/pull/16652)
 * Update triage guide to match the new label scheme
   [\#16612](https://github.com/vector-im/element-web/pull/16612)
 * Remove a couple useless 'use strict' calls
   [\#16650](https://github.com/vector-im/element-web/pull/16650)
 * Remove old conferencing doc
   [\#16648](https://github.com/vector-im/element-web/pull/16648)
 * Bump elliptic from 6.5.3 to 6.5.4
   [\#16644](https://github.com/vector-im/element-web/pull/16644)
 * Add option for audio live streaming
   [\#16604](https://github.com/vector-im/element-web/pull/16604)
 * Update velocity-animate dependency
   [\#16605](https://github.com/vector-im/element-web/pull/16605)
 * Add Edge to the supported tier
   [\#16611](https://github.com/vector-im/element-web/pull/16611)
 * Add multi language spell check
   [\#15851](https://github.com/vector-im/element-web/pull/15851)
 * Document feature_spaces
   [\#16538](https://github.com/vector-im/element-web/pull/16538)

Changes in [1.7.22](https://github.com/vector-im/element-web/releases/tag/v1.7.22) (2021-03-01)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.22-rc.1...v1.7.22)

## Security notice

Element Web 1.7.22 fixes (by upgrading to matrix-react-sdk 3.15.0) a moderate
severity issue (CVE-2021-21320) where the user content sandbox can be abused to
trick users into opening unexpected documents after several user interactions.
The content can be opened with a `blob` origin from the Matrix client, so it is
possible for a malicious document to access user messages and secrets. Thanks to
@keerok for responsibly disclosing this via Matrix's Security Disclosure Policy.

## All changes

 * Upgrade to React SDK 3.15.0 and JS SDK 9.8.0

Changes in [1.7.22-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.22-rc.1) (2021-02-24)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.21...v1.7.22-rc.1)

 * Upgrade to React SDK 3.15.0-rc.1 and JS SDK 9.8.0-rc.1
 * Translations update from Weblate
   [\#16529](https://github.com/vector-im/element-web/pull/16529)
 * Add hostSignup config for element.io clients
   [\#16515](https://github.com/vector-im/element-web/pull/16515)
 * VoIP virtual rooms, mkII
   [\#16442](https://github.com/vector-im/element-web/pull/16442)
 * Jitsi widget: Read room name from query parameters
   [\#16456](https://github.com/vector-im/element-web/pull/16456)
 * fix / sso: make sure to delete only loginToken after redirect
   [\#16415](https://github.com/vector-im/element-web/pull/16415)
 * Disable Countly
   [\#16433](https://github.com/vector-im/element-web/pull/16433)

Changes in [1.7.21](https://github.com/vector-im/element-web/releases/tag/v1.7.21) (2021-02-16)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.21-rc.1...v1.7.21)

 * Upgrade to React SDK 3.14.0 and JS SDK 9.7.0

Changes in [1.7.21-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.21-rc.1) (2021-02-10)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.20...v1.7.21-rc.1)

 * Upgrade to React SDK 3.14.0-rc.1 and JS SDK 9.7.0-rc.1
 * Translations update from Weblate
   [\#16427](https://github.com/vector-im/element-web/pull/16427)
 * Add RegExp dotAll feature test
   [\#16408](https://github.com/vector-im/element-web/pull/16408)
 * Fix Electron type merging
   [\#16405](https://github.com/vector-im/element-web/pull/16405)
 * README: remove Jenkins reference
   [\#16381](https://github.com/vector-im/element-web/pull/16381)
 * Enable PostCSS Calc in webpack builds
   [\#16307](https://github.com/vector-im/element-web/pull/16307)
 * Add configuration security best practices to the README.
   [\#16367](https://github.com/vector-im/element-web/pull/16367)
 * Upgrade matrix-widget-api
   [\#16347](https://github.com/vector-im/element-web/pull/16347)

Changes in [1.7.20](https://github.com/vector-im/element-web/releases/tag/v1.7.20) (2021-02-04)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.19...v1.7.20)

 * Upgrade to React SDK 3.13.1

Changes in [1.7.19](https://github.com/vector-im/element-web/releases/tag/v1.7.19) (2021-02-03)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.19-rc.1...v1.7.19)

 * Upgrade to React SDK 3.13.0 and JS SDK 9.6.0
 * [Release] Upgrade matrix-widget-api
   [\#16348](https://github.com/vector-im/element-web/pull/16348)

Changes in [1.7.19-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.19-rc.1) (2021-01-29)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.18...v1.7.19-rc.1)

 * Upgrade to React SDK 3.13.0-rc.1 and JS SDK 9.6.0-rc.1
 * Translations update from Weblate
   [\#16314](https://github.com/vector-im/element-web/pull/16314)
 * Use history replaceState instead of redirect for SSO flow
   [\#16292](https://github.com/vector-im/element-web/pull/16292)
 * Document the mobile guide toast option
   [\#16301](https://github.com/vector-im/element-web/pull/16301)
 * Update widget-api to beta.12
   [\#16303](https://github.com/vector-im/element-web/pull/16303)
 * Upgrade deps 2021-01
   [\#16294](https://github.com/vector-im/element-web/pull/16294)
 * Move to newer base image for Docker builds
   [\#16275](https://github.com/vector-im/element-web/pull/16275)
 * Docs for the VoIP translate pattern option
   [\#16236](https://github.com/vector-im/element-web/pull/16236)
 * Fix Riot->Element in permalinkPrefix docs
   [\#16227](https://github.com/vector-im/element-web/pull/16227)
 * Supply server_name for optional federation-capable Jitsi auth
   [\#16215](https://github.com/vector-im/element-web/pull/16215)
 * Fix Widget API version confusion
   [\#16212](https://github.com/vector-im/element-web/pull/16212)
 * Add Hebrew language
   [\#16210](https://github.com/vector-im/element-web/pull/16210)
 * Update widget-api to beta 11
   [\#16177](https://github.com/vector-im/element-web/pull/16177)
 * Fix develop Docker builds
   [\#16192](https://github.com/vector-im/element-web/pull/16192)
 * Skip the service worker for Electron
   [\#16157](https://github.com/vector-im/element-web/pull/16157)
 * Use isolated IPC API
   [\#16137](https://github.com/vector-im/element-web/pull/16137)

Changes in [1.7.18](https://github.com/vector-im/element-web/releases/tag/v1.7.18) (2021-01-26)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.17...v1.7.18)

 * Upgrade to React SDK 3.12.1 and JS SDK 9.5.1

Changes in [1.7.17](https://github.com/vector-im/element-web/releases/tag/v1.7.17) (2021-01-18)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.17-rc.1...v1.7.17)

 * Upgrade to React SDK 3.12.0 and JS SDK 9.5.0

Changes in [1.7.17-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.17-rc.1) (2021-01-13)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.16...v1.7.17-rc.1)

 * Upgrade to React SDK 3.12.0-rc.1 and JS SDK 9.5.0-rc.1
 * Translations update from Weblate
   [\#16131](https://github.com/vector-im/element-web/pull/16131)
 * webplatform: Fix notification closing
   [\#16028](https://github.com/vector-im/element-web/pull/16028)
 * Stop building code and types for Element layer
   [\#15999](https://github.com/vector-im/element-web/pull/15999)

Changes in [1.7.16](https://github.com/vector-im/element-web/releases/tag/v1.7.16) (2020-12-21)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.16-rc.1...v1.7.16)

 * Upgrade to React SDK 3.11.1 and JS SDK 9.4.1

Changes in [1.7.16-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.16-rc.1) (2020-12-16)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.15...v1.7.16-rc.1)

 * Upgrade to React SDK 3.11.0-rc.2 and JS SDK 9.4.0-rc.2
 * Translations update from Weblate
   [\#15979](https://github.com/vector-im/element-web/pull/15979)
 * Bump ini from 1.3.5 to 1.3.7
   [\#15949](https://github.com/vector-im/element-web/pull/15949)
 * Document pull request previews
   [\#15937](https://github.com/vector-im/element-web/pull/15937)
 * Improve asset path for KaTeX fonts
   [\#15939](https://github.com/vector-im/element-web/pull/15939)
 * Fix an important semicolon
   [\#15912](https://github.com/vector-im/element-web/pull/15912)
 * Bump highlight.js from 10.1.2 to 10.4.1
   [\#15898](https://github.com/vector-im/element-web/pull/15898)
 * Add gitter.im to room directory
   [\#15894](https://github.com/vector-im/element-web/pull/15894)
 * Extend Platform to support idpId for SSO flows
   [\#15771](https://github.com/vector-im/element-web/pull/15771)
 * Include KaTeX CSS as a dependency
   [\#15843](https://github.com/vector-im/element-web/pull/15843)

Changes in [1.7.15](https://github.com/vector-im/element-web/releases/tag/v1.7.15) (2020-12-07)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.15-rc.1...v1.7.15)

 * Upgrade to React SDK 3.10.0 and JS SDK 9.3.0

Changes in [1.7.15-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.15-rc.1) (2020-12-02)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.14...v1.7.15-rc.1)

 * Upgrade to React SDK 3.10.0-rc.1 and JS SDK 9.3.0-rc.1
 * Include KaTeX CSS as a dependency
   [\#15843](https://github.com/vector-im/element-web/pull/15843)
 * Translations update from Weblate
   [\#15884](https://github.com/vector-im/element-web/pull/15884)
 * added katex.min.css to webpack for math support (main PR in matrix-react-
   sdk)
   [\#15277](https://github.com/vector-im/element-web/pull/15277)
 * Rebrand package name and other details
   [\#15828](https://github.com/vector-im/element-web/pull/15828)
 * Bump highlight.js from 9.18.1 to 10.1.2
   [\#15819](https://github.com/vector-im/element-web/pull/15819)
 * Update branding of packaging artifacts
   [\#15810](https://github.com/vector-im/element-web/pull/15810)
 * Update the react-sdk reference in the lockfile
   [\#15814](https://github.com/vector-im/element-web/pull/15814)
 * Update widget API for good measure in Element Web
   [\#15812](https://github.com/vector-im/element-web/pull/15812)
 * Stop publishing Element to NPM
   [\#15811](https://github.com/vector-im/element-web/pull/15811)
 * Add inotify instance limit info to README
   [\#15795](https://github.com/vector-im/element-web/pull/15795)

Changes in [1.7.14](https://github.com/vector-im/element-web/releases/tag/v1.7.14) (2020-11-23)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.14-rc.1...v1.7.14)

 * Upgrade to React SDK 3.9.0 and JS SDK 9.2.0

Changes in [1.7.14-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.14-rc.1) (2020-11-18)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.13...v1.7.14-rc.1)

 * Upgrade to React SDK 3.9.0-rc.1 and JS SDK 9.2.0-rc.1
 * Translations update from Weblate
   [\#15767](https://github.com/vector-im/element-web/pull/15767)
 * Update the widget-api for element-web
   [\#15717](https://github.com/vector-im/element-web/pull/15717)

Changes in [1.7.13](https://github.com/vector-im/element-web/releases/tag/v1.7.13) (2020-11-09)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.13-rc.1...v1.7.13)

 * Upgrade to React SDK 3.8.0 and JS SDK 9.1.0

Changes in [1.7.13-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.13-rc.1) (2020-11-04)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.12...v1.7.13-rc.1)

 * Upgrade to React SDK 3.8.0-rc.1 and JS SDK 9.1.0-rc.1
 * Translations update from Weblate
   [\#15644](https://github.com/vector-im/element-web/pull/15644)
 * Add countly experiment to develop/nightly configs
   [\#15614](https://github.com/vector-im/element-web/pull/15614)
 * Add documentation for new UIFeature flag regarding room history settings
   [\#15592](https://github.com/vector-im/element-web/pull/15592)
 * Rename Docker repo in docs
   [\#15590](https://github.com/vector-im/element-web/pull/15590)
 * Fix Jitsi regressions with custom themes
   [\#15575](https://github.com/vector-im/element-web/pull/15575)

Changes in [1.7.12](https://github.com/vector-im/element-web/releases/tag/v1.7.12) (2020-10-28)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.11...v1.7.12)

 * Upgrade to React SDK 3.7.1 and JS SDK 9.0.1
 * [Release] Fix Jitsi regressions with custom themes
   [\#15577](https://github.com/vector-im/element-web/pull/15577)

Changes in [1.7.11](https://github.com/vector-im/element-web/releases/tag/v1.7.11) (2020-10-26)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.11-rc.1...v1.7.11)

 * Upgrade to React SDK 3.7.0 and JS SDK 9.0.0

Changes in [1.7.11-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.11-rc.1) (2020-10-21)
=========================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.10...v1.7.11-rc.1)

 * Upgrade to React SDK 3.7.0-rc.2 and JS SDK 9.0.0-rc.1
 * Update Weblate URL
   [\#15516](https://github.com/vector-im/element-web/pull/15516)
 * Translations update from Weblate
   [\#15517](https://github.com/vector-im/element-web/pull/15517)
 * Jitsi accept theme variable and restyle
   [\#15499](https://github.com/vector-im/element-web/pull/15499)
 * Skip editor confirmation of upgrades
   [\#15506](https://github.com/vector-im/element-web/pull/15506)
 * Adjust for new widget messaging APIs
   [\#15495](https://github.com/vector-im/element-web/pull/15495)
 * Use HTTPS_PROXY environment variable for downloading external_api.min…
   [\#15479](https://github.com/vector-im/element-web/pull/15479)
 * Document customisation points
   [\#15475](https://github.com/vector-im/element-web/pull/15475)
 * Don't fatally end the Jitsi widget when it's not being used as a widget
   [\#15466](https://github.com/vector-im/element-web/pull/15466)
 * electron-platform: Pass the user/devce id pair when initializing the event
   index.
   [\#15455](https://github.com/vector-im/element-web/pull/15455)

Changes in [1.7.10](https://github.com/vector-im/element-web/releases/tag/v1.7.10) (2020-10-20)
===============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.9...v1.7.10)

 * [Release] Adjust for new widget messaging APIs
   [\#15497](https://github.com/vector-im/element-web/pull/15497)
 * Upgrade to React SDK 3.6.1

Changes in [1.7.9](https://github.com/vector-im/element-web/releases/tag/v1.7.9) (2020-10-12)
=============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.9-rc.1...v1.7.9)

 * Upgrade to React SDK 3.6.0 and JS SDK 8.5.0

Changes in [1.7.9-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.9-rc.1) (2020-10-07)
=======================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.8...v1.7.9-rc.1)

 * Upgrade to React SDK 3.6.0-rc.1 and JS SDK 8.5.0-rc.1
 * Update from Weblate
   [\#15406](https://github.com/vector-im/element-web/pull/15406)
 * Update Jest and JSDOM
   [\#15402](https://github.com/vector-im/element-web/pull/15402)
 * Add support for dehydration/fallback keys
   [\#15398](https://github.com/vector-im/element-web/pull/15398)
 * Remove riot-bot from sample config
   [\#15376](https://github.com/vector-im/element-web/pull/15376)
 * Switch to using the Widget API SDK for Jitsi widgets
   [\#15102](https://github.com/vector-im/element-web/pull/15102)
 * Remove workbox
   [\#15352](https://github.com/vector-im/element-web/pull/15352)
 * Disable workbox when running in webpack dev server, not in dev mode
   [\#15345](https://github.com/vector-im/element-web/pull/15345)
 * Update Riot -> Element in contribute.json
   [\#15326](https://github.com/vector-im/element-web/pull/15326)
 * Update Riot -> Element in redeploy.py
   [\#15336](https://github.com/vector-im/element-web/pull/15336)
 * Update Riot -> Element in docs/feature-flags.md
   [\#15325](https://github.com/vector-im/element-web/pull/15325)
 * Update Riot -> Element in element.io/README.md
   [\#15327](https://github.com/vector-im/element-web/pull/15327)
 * Update Riot -> Element in VectorAuthFooter
   [\#15328](https://github.com/vector-im/element-web/pull/15328)
 * Update Riot -> Element in VectorEmbeddedPage
   [\#15329](https://github.com/vector-im/element-web/pull/15329)
 * Update Riot -> Element in docs/review.md
   [\#15330](https://github.com/vector-im/element-web/pull/15330)
 * Update Riot -> Element in welcome.html
   [\#15332](https://github.com/vector-im/element-web/pull/15332)
 * Update Riot -> Element in issues-burndown.pl
   [\#15333](https://github.com/vector-im/element-web/pull/15333)
 * Update Riot -> Element in redeploy.py
   [\#15334](https://github.com/vector-im/element-web/pull/15334)
 * Update Riot -> Element in index.ts
   [\#15335](https://github.com/vector-im/element-web/pull/15335)
 * Update Riot -> Element Web in issue templates
   [\#15324](https://github.com/vector-im/element-web/pull/15324)
 * Give the Jitsi widget an icon to help with discovery
   [\#15316](https://github.com/vector-im/element-web/pull/15316)
 * Jitsi widget wrapper updates for hangup button
   [\#15219](https://github.com/vector-im/element-web/pull/15219)
 * Tidy up Service Worker, only run Workbox in production
   [\#15271](https://github.com/vector-im/element-web/pull/15271)
 * Remove conference handler
   [\#15274](https://github.com/vector-im/element-web/pull/15274)
 * Rebrand the webpack pipeline for Element
   [\#15266](https://github.com/vector-im/element-web/pull/15266)
 * Replace dummy sw.js with pre-caching and runtime-caching workbox SW
   [\#15196](https://github.com/vector-im/element-web/pull/15196)

Changes in [1.7.8](https://github.com/vector-im/element-web/releases/tag/v1.7.8) (2020-09-28)
=============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.8-rc.1...v1.7.8)

 * Upgrade to React SDK 3.5.0 and JS SDK 8.4.1

Changes in [1.7.8-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.8-rc.1) (2020-09-23)
=======================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.7...v1.7.8-rc.1)

 * Upgrade to React SDK 3.5.0-rc.1 and JS SDK 8.4.0-rc.1
 * Update from Weblate
   [\#15262](https://github.com/vector-im/element-web/pull/15262)
 * Upgrade sanitize-html
   [\#15260](https://github.com/vector-im/element-web/pull/15260)
 * Document config for preferring Secure Backup setup methods
   [\#15251](https://github.com/vector-im/element-web/pull/15251)
 * Add end-user documentation for UI features
   [\#15190](https://github.com/vector-im/element-web/pull/15190)
 * Update git checkout instructions
   [\#15218](https://github.com/vector-im/element-web/pull/15218)
 * If no bug_report_endpoint_url, hide rageshaking from the App
   [\#15201](https://github.com/vector-im/element-web/pull/15201)
 * Bump node-fetch from 2.6.0 to 2.6.1
   [\#15153](https://github.com/vector-im/element-web/pull/15153)
 * Remove references to Travis CI
   [\#15137](https://github.com/vector-im/element-web/pull/15137)
 * Fix onNewScreen to use replace when going from roomId->roomAlias
   [\#15127](https://github.com/vector-im/element-web/pull/15127)
 * Enable Estonian in language menu
   [\#15136](https://github.com/vector-im/element-web/pull/15136)

Changes in [1.7.7](https://github.com/vector-im/element-web/releases/tag/v1.7.7) (2020-09-14)
=============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.6...v1.7.7)

 * Upgrade to React SDK 3.4.1

Changes in [1.7.6](https://github.com/vector-im/element-web/releases/tag/v1.7.6) (2020-09-14)
=============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.6-rc.1...v1.7.6)

 * Upgrade to React SDK 3.4.0 and JS SDK 8.3.0

Changes in [1.7.6-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.6-rc.1) (2020-09-09)
=======================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.5...v1.7.6-rc.1)

 * Upgrade to React SDK 3.4.0-rc.1 and JS SDK 8.3.0-rc.1
 * Update from Weblate
   [\#15125](https://github.com/vector-im/element-web/pull/15125)
 * Support usage of Jitsi widgets with "openidtoken-jwt" auth
   [\#15114](https://github.com/vector-im/element-web/pull/15114)
 * Fix eslint ts override tsx matching and delint
   [\#15064](https://github.com/vector-im/element-web/pull/15064)
 * Add testing to review guidelines
   [\#15050](https://github.com/vector-im/element-web/pull/15050)

Changes in [1.7.5](https://github.com/vector-im/element-web/releases/tag/v1.7.5) (2020-09-01)
=============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.5-rc.1...v1.7.5)

## Security notice

Element Web 1.7.5 fixes an issue where encrypted state events could break incoming call handling.
Thanks to @awesome-michael from Awesome Technologies for responsibly disclosing this via Matrix's
Security Disclosure Policy.

## All changes

 * Upgrade to React SDK 3.3.0 and JS SDK 8.2.0

Changes in [1.7.5-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.5-rc.1) (2020-08-26)
=======================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.4...v1.7.5-rc.1)

 * Upgrade to React SDK 3.3.0-rc.1 and JS SDK 8.2.0-rc.1
 * Update from Weblate
   [\#15045](https://github.com/vector-im/element-web/pull/15045)
 * Document .well-known E2EE secure backup setting
   [\#15003](https://github.com/vector-im/element-web/pull/15003)
 * Add docs for communities v2 prototyping feature flag
   [\#15013](https://github.com/vector-im/element-web/pull/15013)
 * Update links in README.md to point to Element
   [\#14973](https://github.com/vector-im/element-web/pull/14973)
 * Make kabyle translation available
   [\#15027](https://github.com/vector-im/element-web/pull/15027)
 * Change Riot to Element in readme
   [\#15016](https://github.com/vector-im/element-web/pull/15016)
 * Update links to element in the readme
   [\#15014](https://github.com/vector-im/element-web/pull/15014)
 * Link to Element in F-Droid as well
   [\#15002](https://github.com/vector-im/element-web/pull/15002)
 * Settings v3: Update documentation and configs for new feature flag behaviour
   [\#14986](https://github.com/vector-im/element-web/pull/14986)
 * Update jitsi.md with Element Android details
   [\#14952](https://github.com/vector-im/element-web/pull/14952)
 * TypeScript: enable es2019 lib for newer definitions
   [\#14983](https://github.com/vector-im/element-web/pull/14983)
 * Add reaction preview labs flags to develop
   [\#14979](https://github.com/vector-im/element-web/pull/14979)
 * Document new labs tweaks
   [\#14958](https://github.com/vector-im/element-web/pull/14958)

Changes in [1.7.4](https://github.com/vector-im/element-web/releases/tag/v1.7.4) (2020-08-17)
=============================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.4-rc.1...v1.7.4)

 * Upgrade to React SDK 3.2.0 and JS SDK 8.1.0

Changes in [1.7.4-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.7.4-rc.1) (2020-08-13)
=======================================================================================================
[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.3...v1.7.4-rc.1)

 * Upgrade to React SDK 3.2.0-rc.1 and JS SDK 8.1.0-rc.1
 * Update policy links to element.io
   [\#14905](https://github.com/vector-im/element-web/pull/14905)
 * Update from Weblate
   [\#14949](https://github.com/vector-im/element-web/pull/14949)
 * Try to close notification on all platforms which support it, not just
   electron
   [\#14939](https://github.com/vector-im/element-web/pull/14939)
 * Update bug report submission URL
   [\#14903](https://github.com/vector-im/element-web/pull/14903)
 * Fix arm docker build
   [\#14522](https://github.com/vector-im/element-web/pull/14522)

Changes in [1.7.3](https://github.com/vector-im/element-web/releases/tag/v1.7.3) (2020-08-05)
=============================================================================================

## Security notice

Element Web 1.7.3 (as well as the earlier release 1.7.2) fixes an issue where
replying to a specially formatted message would make it seem like the replier
said something they did not. Thanks to Sorunome for responsibly disclosing this
via Matrix's Security Disclosure Policy.

Element Web 1.7.3 (as well as the earlier release 1.7.2) fixes an issue where an
unexpected language ID in a code block could cause Element to crash. Thanks to
SakiiR for responsibly disclosing this via Matrix's Security Disclosure Policy.

## All changes

[Full Changelog](https://github.com/vector-im/element-web/compare/v1.7.3-rc.1...v1.7.3)

 * Upgrade to React SDK 3.1.0 and JS SDK 8.0.1

Changes in [1.7.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.7.3-rc.1) (2020-07-31)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.7.2...v1.7.3-rc.1)

 * Upgrade to React SDK 3.1.0-rc.1 and JS SDK 8.0.1-rc.1
 * Make Lojban translation available
   [\#14703](https://github.com/vector-im/riot-web/pull/14703)
 * Update from Weblate
   [\#14841](https://github.com/vector-im/riot-web/pull/14841)
 * Remove redundant lint dependencies
   [\#14810](https://github.com/vector-im/riot-web/pull/14810)
 * Bump elliptic from 6.5.2 to 6.5.3
   [\#14826](https://github.com/vector-im/riot-web/pull/14826)
 * Update mobile config intercept URL
   [\#14796](https://github.com/vector-im/riot-web/pull/14796)
 * Fix typo in https://
   [\#14791](https://github.com/vector-im/riot-web/pull/14791)

Changes in [1.7.2](https://github.com/vector-im/riot-web/releases/tag/v1.7.2) (2020-07-27)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.7.1...v1.7.2)

 * Upgrade to React SDK 3.0.0 and JS SDK 8.0.0
 * Update from Weblate
   [\#14778](https://github.com/vector-im/riot-web/pull/14778)
 * Capitalize letters
   [\#14566](https://github.com/vector-im/riot-web/pull/14566)
 * Configure eslint package and fix lint issues
   [\#14673](https://github.com/vector-im/riot-web/pull/14673)
 * Riot → Element
   [\#14581](https://github.com/vector-im/riot-web/pull/14581)
 * Remove labs info for the new room list
   [\#14603](https://github.com/vector-im/riot-web/pull/14603)
 * Convince Webpack to use development on CI
   [\#14593](https://github.com/vector-im/riot-web/pull/14593)
 * Move dev dep to the right place
   [\#14572](https://github.com/vector-im/riot-web/pull/14572)
 * Bump lodash from 4.17.15 to 4.17.19
   [\#14552](https://github.com/vector-im/riot-web/pull/14552)
 * Update all mobile links to match marketing site
   [\#14541](https://github.com/vector-im/riot-web/pull/14541)

Changes in [1.7.1](https://github.com/vector-im/riot-web/releases/tag/v1.7.1) (2020-07-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.7.0...v1.7.1)

 * Upgrade to React SDK 2.10.1
 * Fix SSO session ID paramater
   [\#14544](https://github.com/vector-im/riot-web/pull/14544)
 * Run pngcrush on vector-icons
   [\#14488](https://github.com/vector-im/riot-web/pull/14488)
 * Fix hosting signup link
   [\#14502](https://github.com/vector-im/riot-web/pull/14502)
 * Use the right protocol for SSO URLs
   [\#14513](https://github.com/vector-im/riot-web/pull/14513)
 * Fix mstile-310x150 by renaming it
   [\#14485](https://github.com/vector-im/riot-web/pull/14485)
 * Update blog and twitter links to point to Element
   [\#14478](https://github.com/vector-im/riot-web/pull/14478)

Changes in [1.7.0](https://github.com/vector-im/riot-web/releases/tag/v1.7.0) (2020-07-15)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.8...v1.7.0)

 * App name changed from Riot to Element
 * Upgrade to React SDK 2.10.0
 * Remove redundant enum
   [\#14472](https://github.com/vector-im/riot-web/pull/14472)
 * Remove font scaling from labs
   [\#14355](https://github.com/vector-im/riot-web/pull/14355)
 * Update documentation and remove labs flag for new room list
   [\#14375](https://github.com/vector-im/riot-web/pull/14375)
 * Update from Weblate
   [\#14434](https://github.com/vector-im/riot-web/pull/14434)
 * Release the irc layout from labs
   [\#14350](https://github.com/vector-im/riot-web/pull/14350)
 * Fix welcomeBackgroundUrl array causing background to change during use
   [\#14368](https://github.com/vector-im/riot-web/pull/14368)
 * Be more explicit about type when calling platform startUpdater
   [\#14299](https://github.com/vector-im/riot-web/pull/14299)

Changes in [1.6.8](https://github.com/vector-im/riot-web/releases/tag/v1.6.8) (2020-07-03)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.8-rc.1...v1.6.8)

 * Upgrade to JS SDK 7.1.0 and React SDK 2.9.0

Changes in [1.6.8-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.6.8-rc.1) (2020-07-01)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.7...v1.6.8-rc.1)

 * Upgrade to JS SDK 7.1.0-rc.1 and React SDK 2.9.0-rc.1
 * Update from Weblate
   [\#14282](https://github.com/vector-im/riot-web/pull/14282)
 * Show a download completed toast in electron
   [\#14248](https://github.com/vector-im/riot-web/pull/14248)
 * Add the new spinner feature labs flag
   [\#14213](https://github.com/vector-im/riot-web/pull/14213)
 * Fix loading-test for SSO plaf changes
   [\#14212](https://github.com/vector-im/riot-web/pull/14212)
 * Fix spelling on startup error page
   [\#14199](https://github.com/vector-im/riot-web/pull/14199)
 * Document fonts in custom theme
   [\#14175](https://github.com/vector-im/riot-web/pull/14175)
 * Update from Weblate
   [\#14129](https://github.com/vector-im/riot-web/pull/14129)
 * ElectronPlatform: Implement the isRoomIndexed method.
   [\#13957](https://github.com/vector-im/riot-web/pull/13957)
 * ElectronPlatform: Add support to set and get the index user version.
   [\#14080](https://github.com/vector-im/riot-web/pull/14080)
 * Mark the new room list as ready for general testing
   [\#14102](https://github.com/vector-im/riot-web/pull/14102)

Changes in [1.6.7](https://github.com/vector-im/riot-web/releases/tag/v1.6.7) (2020-06-29)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.6...v1.6.7)

 * Upgrade to React SDK 2.8.1

Changes in [1.6.6](https://github.com/vector-im/riot-web/releases/tag/v1.6.6) (2020-06-23)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.6-rc.1...v1.6.6)

 * Upgrade to JS SDK 7.0.0 and React SDK 2.8.0

Changes in [1.6.6-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.6.6-rc.1) (2020-06-17)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.5...v1.6.6-rc.1)

 * Upgrade to JS SDK 7.0.0-rc.1 and React SDK 2.8.0-rc.1
 * Update from Weblate
   [\#14067](https://github.com/vector-im/riot-web/pull/14067)
 * Update from Weblate
   [\#14032](https://github.com/vector-im/riot-web/pull/14032)
 * Attempt to fix decoder ring for relative hosted riots
   [\#13987](https://github.com/vector-im/riot-web/pull/13987)
 * Upgrade deps
   [\#13952](https://github.com/vector-im/riot-web/pull/13952)
 * Fix riot-desktop manual update check getting stuck on Downloading...
   [\#13946](https://github.com/vector-im/riot-web/pull/13946)
 * Bump websocket-extensions from 0.1.3 to 0.1.4
   [\#13943](https://github.com/vector-im/riot-web/pull/13943)
 * Add e2ee-default:false docs
   [\#13914](https://github.com/vector-im/riot-web/pull/13914)
 * make IPC calls to get pickle key
   [\#13846](https://github.com/vector-im/riot-web/pull/13846)
 * fix loading test for new sso pattern
   [\#13913](https://github.com/vector-im/riot-web/pull/13913)
 * Fix login loop where the sso flow returns to `#/login`
   [\#13889](https://github.com/vector-im/riot-web/pull/13889)
 * Fix typo in docs
   [\#13905](https://github.com/vector-im/riot-web/pull/13905)
 * Remove cross-signing from labs
   [\#13904](https://github.com/vector-im/riot-web/pull/13904)
 * Add PWA Platform with PWA-specific badge controls
   [\#13890](https://github.com/vector-im/riot-web/pull/13890)
 * Modernizr check for subtle crypto as we require it all over the place
   [\#13828](https://github.com/vector-im/riot-web/pull/13828)

Changes in [1.6.5](https://github.com/vector-im/riot-web/releases/tag/v1.6.5) (2020-06-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.4...v1.6.5)

* Upgrade to JS SDK 6.2.2 and React SDK 2.7.2

Changes in [1.6.4](https://github.com/vector-im/riot-web/releases/tag/v1.6.4) (2020-06-05)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.3...v1.6.4)

* Upgrade to JS SDK 6.2.1 and React SDK 2.7.1

Changes in [1.6.3](https://github.com/vector-im/riot-web/releases/tag/v1.6.3) (2020-06-04)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.3-rc.1...v1.6.3)

## Security notice

Riot Web 1.6.3 fixes a vulnerability in single sign-on (SSO) deployments where Riot Web could be confused into sending authentication details to an attacker-controlled server. Thanks to Quentin Gliech for responsibly disclosing this via Matrix's Security Disclosure Policy.

## All changes

 * Fix login loop where the sso flow returns to `#/login` to release
   [\#13915](https://github.com/vector-im/riot-web/pull/13915)

Changes in [1.6.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.6.3-rc.1) (2020-06-02)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.2...v1.6.3-rc.1)

 * Upgrade to JS SDK 6.2.0-rc.1 and React SDK 2.7.0-rc.2
 * Get rid of welcome.html's Chat with Riot Bot button
   [\#13842](https://github.com/vector-im/riot-web/pull/13842)
 * Update from Weblate
   [\#13886](https://github.com/vector-im/riot-web/pull/13886)
 * Allow deferring of Update Toast until the next morning
   [\#13864](https://github.com/vector-im/riot-web/pull/13864)
 * Give contextual feedback for manual update check instead of banner
   [\#13862](https://github.com/vector-im/riot-web/pull/13862)
 * Add app-load doc
   [\#13834](https://github.com/vector-im/riot-web/pull/13834)
 * Update Modular hosting link
   [\#13777](https://github.com/vector-im/riot-web/pull/13777)
 * Replace New Version Bar with a Toast
   [\#13776](https://github.com/vector-im/riot-web/pull/13776)
 * Remove webpack-build-notifier from lockfile
   [\#13814](https://github.com/vector-im/riot-web/pull/13814)
 *  Add media queries and mobile viewport (#12142)
   [\#13818](https://github.com/vector-im/riot-web/pull/13818)
 * Fix @types/react conflict in matrix-react-sdk
   [\#13809](https://github.com/vector-im/riot-web/pull/13809)
 * Fix manual update checking, super in arrow funcs doesn't work
   [\#13808](https://github.com/vector-im/riot-web/pull/13808)
 * Update from Weblate
   [\#13806](https://github.com/vector-im/riot-web/pull/13806)
 * Convert platforms to Typescript
   [\#13756](https://github.com/vector-im/riot-web/pull/13756)
 * Fix EventEmitter typescript signature in node typings
   [\#13764](https://github.com/vector-im/riot-web/pull/13764)
 * Add docs and labs flag for new room list implementation
   [\#13675](https://github.com/vector-im/riot-web/pull/13675)
 * Add font scaling labs setting.
   [\#13352](https://github.com/vector-im/riot-web/pull/13352)
 * Add labs flag for alternate message layouts
   [\#13350](https://github.com/vector-im/riot-web/pull/13350)
 * Move dispatcher references in support of TypeScript conversion
   [\#13666](https://github.com/vector-im/riot-web/pull/13666)
 * Update from Weblate
   [\#13704](https://github.com/vector-im/riot-web/pull/13704)
 * Replace favico.js dependency with simplified variant grown from it
   [\#13649](https://github.com/vector-im/riot-web/pull/13649)
 * Remove Electron packaging scripts
   [\#13688](https://github.com/vector-im/riot-web/pull/13688)
 * Fix postcss order to allow mixin variables to work
   [\#13674](https://github.com/vector-im/riot-web/pull/13674)
 * Pass screenAfterLogin through SSO in the callback url
   [\#13650](https://github.com/vector-im/riot-web/pull/13650)

Changes in [1.6.2](https://github.com/vector-im/riot-web/releases/tag/v1.6.2) (2020-05-22)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.1...v1.6.2)

 * Upgrade to React SDK 2.6.1

Changes in [1.6.1](https://github.com/vector-im/riot-web/releases/tag/v1.6.1) (2020-05-19)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.1-rc.1...v1.6.1)

 * Upgrade to React SDK 2.6.0 and JS SDK 6.1.0

Changes in [1.6.1-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.6.1-rc.1) (2020-05-14)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0...v1.6.1-rc.1)

 * Upgrade to React SDK 2.6.0-rc.1 and JS SDK 6.1.0-rc.1
 * Update from Weblate
   [\#13673](https://github.com/vector-im/riot-web/pull/13673)
 * Add notranslate class to matrixchat to prevent translation by Google
   Translate
   [\#13669](https://github.com/vector-im/riot-web/pull/13669)
 * Added Anchor Link to the development of matrix sdk
   [\#13638](https://github.com/vector-im/riot-web/pull/13638)
 * Prefetch the formatting button mask svg images
   [\#13631](https://github.com/vector-im/riot-web/pull/13631)
 * use a different image in previews
   [\#13488](https://github.com/vector-im/riot-web/pull/13488)
 * Update from Weblate
   [\#13625](https://github.com/vector-im/riot-web/pull/13625)
 * Remove electron_app as we now have riot-desktop repo
   [\#13544](https://github.com/vector-im/riot-web/pull/13544)
 * add new images for PWA icons
   [\#13556](https://github.com/vector-im/riot-web/pull/13556)
 * Remove unused feature flag from config
   [\#13504](https://github.com/vector-im/riot-web/pull/13504)
 * Update from Weblate
   [\#13486](https://github.com/vector-im/riot-web/pull/13486)
 * Developer tool: convert rageshake error locations back to sourcecode
   locations
   [\#13357](https://github.com/vector-im/riot-web/pull/13357)
 * App load tweaks, improve error pages
   [\#13329](https://github.com/vector-im/riot-web/pull/13329)
 * Tweak default device name to be more compact
   [\#13465](https://github.com/vector-im/riot-web/pull/13465)
 * Tweak default device name on macOS
   [\#13460](https://github.com/vector-im/riot-web/pull/13460)
 * Update docs with custom theming changes
   [\#13406](https://github.com/vector-im/riot-web/pull/13406)
 * Update from Weblate
   [\#13395](https://github.com/vector-im/riot-web/pull/13395)
 * Remove docs and config for invite only padlocks
   [\#13374](https://github.com/vector-im/riot-web/pull/13374)
 * Revert "Add font scaling labs setting."
   [\#13351](https://github.com/vector-im/riot-web/pull/13351)
 * Expand feature flag docs to cover additional release channels
   [\#13341](https://github.com/vector-im/riot-web/pull/13341)
 * Optimized image assets by recompressing without affecting quality.
   [\#13034](https://github.com/vector-im/riot-web/pull/13034)
 * Add font scaling labs setting.
   [\#13199](https://github.com/vector-im/riot-web/pull/13199)
 * Remove encrypted message search feature flag
   [\#13325](https://github.com/vector-im/riot-web/pull/13325)
 * Fix `default_federate` settting description
   [\#13312](https://github.com/vector-im/riot-web/pull/13312)
 * Clarify that the .well-known method for Jitsi isn't available yet
   [\#13314](https://github.com/vector-im/riot-web/pull/13314)
 * add config option to tsc resolveJsonModule
   [\#13296](https://github.com/vector-im/riot-web/pull/13296)
 * Fix dispatcher import to be extension agnostic
   [\#13297](https://github.com/vector-im/riot-web/pull/13297)
 * Document more config options in config.md (fixes #13089)
   [\#13260](https://github.com/vector-im/riot-web/pull/13260)
 * Fix tests post-js-sdk-filters change
   [\#13295](https://github.com/vector-im/riot-web/pull/13295)
 * Make Jitsi download script a JS script
   [\#13227](https://github.com/vector-im/riot-web/pull/13227)
 * Use matrix-react-sdk type extensions as a base
   [\#13271](https://github.com/vector-im/riot-web/pull/13271)
 * Allow Riot Web to randomly pick welcome backgrounds
   [\#13235](https://github.com/vector-im/riot-web/pull/13235)
 * Update cross-signing feature docs and document fallback procedures
   [\#13224](https://github.com/vector-im/riot-web/pull/13224)

Changes in [1.6.0](https://github.com/vector-im/riot-web/releases/tag/v1.6.0) (2020-05-05)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0-rc.6...v1.6.0)

 * Cross-signing and E2EE by default for DMs and private rooms enabled
 * Upgrade to React SDK 2.5.0 and JS SDK 6.0.0

Changes in [1.6.0-rc.6](https://github.com/vector-im/riot-web/releases/tag/v1.6.0-rc.6) (2020-05-01)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0-rc.5...v1.6.0-rc.6)

 * Upgrade to React SDK 2.5.0-rc.6 and JS SDK 6.0.0-rc.2

Changes in [1.6.0-rc.5](https://github.com/vector-im/riot-web/releases/tag/v1.6.0-rc.5) (2020-04-30)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0-rc.4...v1.6.0-rc.5)

 * Upgrade to React SDK 2.5.0-rc.5 and JS SDK 6.0.0-rc.1
 * Remove feature flag docs from docs on release
   [\#13375](https://github.com/vector-im/riot-web/pull/13375)

Changes in [1.6.0-rc.4](https://github.com/vector-im/riot-web/releases/tag/v1.6.0-rc.4) (2020-04-23)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0-rc.3...v1.6.0-rc.4)

 * Upgrade to React SDK 2.5.0-rc.4 and JS SDK 5.3.1-rc.4

Changes in [1.6.0-rc.3](https://github.com/vector-im/riot-web/releases/tag/v1.6.0-rc.3) (2020-04-17)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0-rc.2...v1.6.0-rc.3)

 * Upgrade to React SDK 2.5.0-rc.3 and JS SDK 5.3.1-rc.3

Changes in [1.6.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.6.0-rc.2) (2020-04-16)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.6.0-rc.1...v1.6.0-rc.2)

 * Upgrade to React SDK 2.5.0-rc.2 and JS SDK 5.3.1-rc.2
 * Enable cross-signing / E2EE by default for DM without config changes

Changes in [1.6.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.6.0-rc.1) (2020-04-15)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.16-rc.1...v1.6.0-rc.1)

 * Enable cross-signing / E2EE by default for DM on release
   [\#13179](https://github.com/vector-im/riot-web/pull/13179)
 * Upgrade to React SDK 2.5.0-rc.1 and JS SDK 5.3.1-rc.1
 * Add instruction to resolve the inotify watch limit issue
   [\#13128](https://github.com/vector-im/riot-web/pull/13128)
 * docs: labs: add a pointer to config.md
   [\#13149](https://github.com/vector-im/riot-web/pull/13149)
 * Fix Electron SSO handling to support multiple profiles
   [\#13028](https://github.com/vector-im/riot-web/pull/13028)
 * Add riot-desktop shortcuts for forward/back matching browsers&slack
   [\#13133](https://github.com/vector-im/riot-web/pull/13133)
 * Allow rageshake to fail in init
   [\#13164](https://github.com/vector-im/riot-web/pull/13164)
 * Fix broken yarn install link in README.md
   [\#13125](https://github.com/vector-im/riot-web/pull/13125)
 * fix build:jitsi scripts crash caused by a missing folder
   [\#13122](https://github.com/vector-im/riot-web/pull/13122)
 * App load order changes to catch errors better
   [\#13095](https://github.com/vector-im/riot-web/pull/13095)
 * Upgrade deps
   [\#13080](https://github.com/vector-im/riot-web/pull/13080)

Changes in [1.5.16-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.16-rc.1) (2020-04-08)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.15...v1.5.16-rc.1)

 * Upgrade React SDK to 2.4.0-rc.1 and JS SDK to 5.3.0-rc.1
 * Update from Weblate
   [\#13078](https://github.com/vector-im/riot-web/pull/13078)
 * Mention Jitsi support at the .well-known level in Jitsi docs
   [\#13047](https://github.com/vector-im/riot-web/pull/13047)
 * Add new default home page fallback
   [\#13049](https://github.com/vector-im/riot-web/pull/13049)
 * App load order tweaks for code splitting
   [\#13032](https://github.com/vector-im/riot-web/pull/13032)
 * Add some docs about Jitsi widgets and Jitsi configuration
   [\#13027](https://github.com/vector-im/riot-web/pull/13027)
 * Bump minimist from 1.2.2 to 1.2.3 in /electron_app
   [\#13030](https://github.com/vector-im/riot-web/pull/13030)
 * Fix Electron mac-specific shortcut being registered on Web too.
   [\#13020](https://github.com/vector-im/riot-web/pull/13020)
 * Add a console warning that errors from Jitsi Meet are fine
   [\#12968](https://github.com/vector-im/riot-web/pull/12968)
 * Fix popout support for jitsi widgets
   [\#12975](https://github.com/vector-im/riot-web/pull/12975)
 * Some grammar and clarifications
   [\#12925](https://github.com/vector-im/riot-web/pull/12925)
 * Don't immediately remove notifications from notification trays
   [\#12861](https://github.com/vector-im/riot-web/pull/12861)
 * Remove welcome user from config
   [\#12894](https://github.com/vector-im/riot-web/pull/12894)

Changes in [1.5.15](https://github.com/vector-im/riot-web/releases/tag/v1.5.15) (2020-04-01)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.14...v1.5.15)

## Security notice

The `jitsi.html` widget wrapper introduced in Riot 1.5.14 could be used to extract user data by tricking the user into adding a custom widget or opening a link in the browser used to run Riot. Jitsi widgets created through Riot UI do not pose a risk and do not need to be recreated.

It is important to purge any copies of Riot 1.5.14 so that the vulnerable `jitsi.html` wrapper from that version is no longer accessible.

## All changes

 * Upgrade React SDK to 2.3.1 for Jitsi fixes
 * Fix popout support for jitsi widgets
   [\#12980](https://github.com/vector-im/riot-web/pull/12980)

Changes in [1.5.14](https://github.com/vector-im/riot-web/releases/tag/v1.5.14) (2020-03-30)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.14-rc.1...v1.5.14)

 * Upgrade JS SDK to 5.2.0 and React SDK to 2.3.0

Changes in [1.5.14-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.14-rc.1) (2020-03-26)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.13...v1.5.14-rc.1)

 * Upgrade JS SDK to 5.2.0-rc.1 and React SDK to 2.3.0-rc.1
 * Update from Weblate
   [\#12890](https://github.com/vector-im/riot-web/pull/12890)
 * App load tweaks
   [\#12869](https://github.com/vector-im/riot-web/pull/12869)
 * Add review policy doc
   [\#12730](https://github.com/vector-im/riot-web/pull/12730)
 * Fix artifact searching in redeployer
   [\#12875](https://github.com/vector-im/riot-web/pull/12875)
 * Fix Jitsi wrapper being large by getting the config from elsewhere
   [\#12845](https://github.com/vector-im/riot-web/pull/12845)
 * Add webpack stats which will be used by CI and stored to artifacts
   [\#12832](https://github.com/vector-im/riot-web/pull/12832)
 * Revert "Remove useless app preloading from Jitsi widget wrapper"
   [\#12842](https://github.com/vector-im/riot-web/pull/12842)
 * Remove useless app preloading from Jitsi widget wrapper
   [\#12836](https://github.com/vector-im/riot-web/pull/12836)
 * Update from Weblate
   [\#12829](https://github.com/vector-im/riot-web/pull/12829)
 * Fix version for Docker builds
   [\#12799](https://github.com/vector-im/riot-web/pull/12799)
 * Register Mac electron specific Cmd+, shortcut to User Settings
   [\#12800](https://github.com/vector-im/riot-web/pull/12800)
 * Use a local widget wrapper for Jitsi calls
   [\#12780](https://github.com/vector-im/riot-web/pull/12780)
 * Delete shortcuts.md
   [\#12786](https://github.com/vector-im/riot-web/pull/12786)
 * Remove remainders of gemini-scrollbar and react-gemini-scrollbar
   [\#12756](https://github.com/vector-im/riot-web/pull/12756)
 * Update electron to v7.1.14
   [\#12762](https://github.com/vector-im/riot-web/pull/12762)
 * Add url tests to Modernizr
   [\#12735](https://github.com/vector-im/riot-web/pull/12735)
 * ElectronPlatform: Add support to remove events from the event index.
   [\#12703](https://github.com/vector-im/riot-web/pull/12703)
 * Bump minimist from 1.2.0 to 1.2.2 in /electron_app
   [\#12744](https://github.com/vector-im/riot-web/pull/12744)
 * Add docs and flag for custom theme support
   [\#12731](https://github.com/vector-im/riot-web/pull/12731)
 * Declare jsx in tsconfig for IDEs
   [\#12716](https://github.com/vector-im/riot-web/pull/12716)
 * Remove stuff that yarn install doesn't think we need
   [\#12713](https://github.com/vector-im/riot-web/pull/12713)
 * yarn upgrade
   [\#12691](https://github.com/vector-im/riot-web/pull/12691)
 * Support TypeScript for React components
   [\#12696](https://github.com/vector-im/riot-web/pull/12696)

Changes in [1.5.13](https://github.com/vector-im/riot-web/releases/tag/v1.5.13) (2020-03-17)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.13-rc.1...v1.5.13)

 * Upgrade to JS SDK 5.1.1 and React SDK 2.2.3

Changes in [1.5.13-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.13-rc.1) (2020-03-11)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.12...v1.5.13-rc.1)

 * Update from Weblate
   [\#12688](https://github.com/vector-im/riot-web/pull/12688)
 * Fix Docker image version for develop builds
   [\#12670](https://github.com/vector-im/riot-web/pull/12670)
 * docker: optimize custom sdk builds
   [\#12612](https://github.com/vector-im/riot-web/pull/12612)
 * riot-desktop open SSO in browser so user doesn't have to auth twice
   [\#12590](https://github.com/vector-im/riot-web/pull/12590)
 * Fix SSO flows for electron 8.0.2 by re-breaking will-navigate
   [\#12585](https://github.com/vector-im/riot-web/pull/12585)
 * index.html: Place noscript on top of the page
   [\#12563](https://github.com/vector-im/riot-web/pull/12563)
 * Remove will-navigate comment after Electron fix
   [\#12561](https://github.com/vector-im/riot-web/pull/12561)
 * Update loading test for JS SDK IDB change
   [\#12552](https://github.com/vector-im/riot-web/pull/12552)
 * Upgrade deps
   [\#12528](https://github.com/vector-im/riot-web/pull/12528)

Changes in [1.5.12](https://github.com/vector-im/riot-web/releases/tag/v1.5.12) (2020-03-04)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.11...v1.5.12)

 * Upgrade to React SDK 2.2.1
 * Revert to Electron 7.1.12 to fix Arch Linux tray icon
 * Fix image download links so they open in a new tab

Changes in [1.5.11](https://github.com/vector-im/riot-web/releases/tag/v1.5.11) (2020-03-02)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.11-rc.1...v1.5.11)

 * Upgrade to JS SDK 5.1.0 and React SDK 2.2.0
 * Fix SSO flows for Electron 8.0.2 by disabling will-navigate
   [\#12585](https://github.com/vector-im/riot-web/pull/12585)

Changes in [1.5.11-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.11-rc.1) (2020-02-26)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.10...v1.5.11-rc.1)

 * Upgrade to JS SDK 5.1.0-rc.1 and React SDK 2.2.0-rc.1
 * Change Windows signing to warning when missing token
   [\#12523](https://github.com/vector-im/riot-web/pull/12523)
 * Modernizr remove t3st/es6/contains
   [\#12524](https://github.com/vector-im/riot-web/pull/12524)
 * Switch out any eval-using Modernizr rules
   [\#12519](https://github.com/vector-im/riot-web/pull/12519)
 * Update from Weblate
   [\#12522](https://github.com/vector-im/riot-web/pull/12522)
 * Notify electron of language changes
   [\#12487](https://github.com/vector-im/riot-web/pull/12487)
 * Relax macOS notarisation check to print a warning
   [\#12503](https://github.com/vector-im/riot-web/pull/12503)
 * Clarify supported tier means desktop OSes
   [\#12486](https://github.com/vector-im/riot-web/pull/12486)
 * Use noreferrer in addition to noopener for edge case browsers
   [\#12477](https://github.com/vector-im/riot-web/pull/12477)
 * Document start / end composer shortcuts
   [\#12466](https://github.com/vector-im/riot-web/pull/12466)
 * Update from Weblate
   [\#12480](https://github.com/vector-im/riot-web/pull/12480)
 * Remove buildkite pipeline
   [\#12464](https://github.com/vector-im/riot-web/pull/12464)
 * Remove exec so release script continues
   [\#12435](https://github.com/vector-im/riot-web/pull/12435)
 * Use Persistent Storage where possible
   [\#12425](https://github.com/vector-im/riot-web/pull/12425)

Changes in [1.5.10](https://github.com/vector-im/riot-web/releases/tag/v1.5.10) (2020-02-19)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.9...v1.5.10)

 * Get rid of dependence on usercontent.riot.im
   [\#12292](https://github.com/vector-im/riot-web/pull/12292)
 * Add experimental support tier
   [\#12377](https://github.com/vector-im/riot-web/pull/12377)

Changes in [1.5.9](https://github.com/vector-im/riot-web/releases/tag/v1.5.9) (2020-02-17)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.9-rc.1...v1.5.9)

 * Automate SDK dep upgrades for release
   [\#12374](https://github.com/vector-im/riot-web/pull/12374)

Changes in [1.5.9-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.9-rc.1) (2020-02-13)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.8...v1.5.9-rc.1)

 * Upgrade JS SDK to 5.0.0-rc.1 and React SDK 2.1.0-rc.2
 * Update from Weblate
   [\#12354](https://github.com/vector-im/riot-web/pull/12354)
 * Add top left menu shortcut
   [\#12310](https://github.com/vector-im/riot-web/pull/12310)
 * Remove modernizr rules for features on which we only soft depend
   [\#12272](https://github.com/vector-im/riot-web/pull/12272)
 * Embed CSP meta tag and stop using script-src unsafe-inline
   [\#12258](https://github.com/vector-im/riot-web/pull/12258)
 * Add contribute.json
   [\#12251](https://github.com/vector-im/riot-web/pull/12251)
 * Improve Browser checks
   [\#12232](https://github.com/vector-im/riot-web/pull/12232)
 * Document padlock flag
   [\#12173](https://github.com/vector-im/riot-web/pull/12173)
 * Enable cross-signing on /develop
   [\#12126](https://github.com/vector-im/riot-web/pull/12126)
 * Switch back to legacy decorators
   [\#12110](https://github.com/vector-im/riot-web/pull/12110)
 * Update babel targets
   [\#12102](https://github.com/vector-im/riot-web/pull/12102)
 * Install deps for linting
   [\#12076](https://github.com/vector-im/riot-web/pull/12076)
 * Update from Weblate
   [\#12062](https://github.com/vector-im/riot-web/pull/12062)
 * Change to minimal Webpack output
   [\#12049](https://github.com/vector-im/riot-web/pull/12049)
 * Remove docs for new invite dialog labs feature
   [\#12015](https://github.com/vector-im/riot-web/pull/12015)
 * ElectronPlatform: Add the indexSize method.
   [\#11529](https://github.com/vector-im/riot-web/pull/11529)
 * ElectronPlatform: Add the ability to load file events from the event index
   [\#11907](https://github.com/vector-im/riot-web/pull/11907)
 * Fix the remainder of the cookie links
   [\#12008](https://github.com/vector-im/riot-web/pull/12008)
 * Use bash in Docker scripts
   [\#12001](https://github.com/vector-im/riot-web/pull/12001)
 * Use debian to build the Docker image
   [\#11999](https://github.com/vector-im/riot-web/pull/11999)
 * Update cookie policy urls on /app and /develop config.json
   [\#11998](https://github.com/vector-im/riot-web/pull/11998)
 * BuildKite: Only deploy to /develop if everything else passed
   [\#11996](https://github.com/vector-im/riot-web/pull/11996)
 * Add docs for admin report content message
   [\#11995](https://github.com/vector-im/riot-web/pull/11995)
 * Load as little as possible in index.js for the skinner
   [\#11959](https://github.com/vector-im/riot-web/pull/11959)
 * Fix webpack config (by stealing Dave's config)
   [\#11956](https://github.com/vector-im/riot-web/pull/11956)
 * Force Jest to resolve the js-sdk and react-sdk to src directories
   [\#11954](https://github.com/vector-im/riot-web/pull/11954)
 * Fix build to not babel modules inside js/react sdk
   [\#11949](https://github.com/vector-im/riot-web/pull/11949)
 * Fix webpack to babel js-sdk & react-sdk but no other deps
   [\#11944](https://github.com/vector-im/riot-web/pull/11944)

Changes in [1.5.8](https://github.com/vector-im/riot-web/releases/tag/v1.5.8) (2020-01-27)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.8-rc.2...v1.5.8)

 * Fixes for alias display and copy / paste on composer

Changes in [1.5.8-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.5.8-rc.2) (2020-01-22)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.8-rc.1...v1.5.8-rc.2)

 * Fix incorrect version of react-sdk

Changes in [1.5.8-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.8-rc.1) (2020-01-22)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.7...v1.5.8-rc.1)

This version contains an upgrade to the cryptography database
version. Once users run this version, their session's indexeddb
store will be upgraded and older version of Riot will no longer
be able to read it. Users will have to log out and log in if
the version of Riot is downgraded back to a previous version.

 * Fix webpack config (by stealing Dave's config)
   [\#11994](https://github.com/vector-im/riot-web/pull/11994)
 * Fix webpack to babel js-sdk & react-sdk but no other deps
   [\#11947](https://github.com/vector-im/riot-web/pull/11947)
 * Update from Weblate
   [\#11934](https://github.com/vector-im/riot-web/pull/11934)
 * Fix rageshake post-sourcemaps
   [\#11926](https://github.com/vector-im/riot-web/pull/11926)
 * Fix yarn start concurrent commands
   [\#11895](https://github.com/vector-im/riot-web/pull/11895)
 * Run the react-sdk reskindexer for developers
   [\#11894](https://github.com/vector-im/riot-web/pull/11894)
 * Update labs documentation for feature_ftue_dms given new scope
   [\#11893](https://github.com/vector-im/riot-web/pull/11893)
 * Fix indentation on webpack config and make sourcemapped files legible
   [\#11892](https://github.com/vector-im/riot-web/pull/11892)
 * Remove spinner check
   [\#11891](https://github.com/vector-im/riot-web/pull/11891)
 * Don't minifiy builds of develop through CI packaging
   [\#11867](https://github.com/vector-im/riot-web/pull/11867)
 * Use Jest for tests
   [\#11869](https://github.com/vector-im/riot-web/pull/11869)
 * Support application/wasm in Docker image
   [\#11858](https://github.com/vector-im/riot-web/pull/11858)
 * Fix sourcemaps by refactoring the build system
   [\#11843](https://github.com/vector-im/riot-web/pull/11843)
 * Disable event indexing on develop
   [\#11850](https://github.com/vector-im/riot-web/pull/11850)
 * Updated blog url
   [\#11792](https://github.com/vector-im/riot-web/pull/11792)
 * Enable and document presence in room list feature flag
   [\#11829](https://github.com/vector-im/riot-web/pull/11829)
 * Add stub service worker so users can install on desktop with Chrome
   [\#11774](https://github.com/vector-im/riot-web/pull/11774)
 * Update from Weblate
   [\#11826](https://github.com/vector-im/riot-web/pull/11826)
 * Sourcemaps: develop -> feature branch
   [\#11802](https://github.com/vector-im/riot-web/pull/11802)
 * Update build scripts for new process
   [\#11801](https://github.com/vector-im/riot-web/pull/11801)
 * Make the webpack config work for us
   [\#11712](https://github.com/vector-im/riot-web/pull/11712)
 * Updates URL for Electron Command Line Switches
   [\#11810](https://github.com/vector-im/riot-web/pull/11810)
 * Import from src/ for the react-sdk and js-sdk
   [\#11714](https://github.com/vector-im/riot-web/pull/11714)
 * Convert components to ES6 exports
   [\#11713](https://github.com/vector-im/riot-web/pull/11713)
 * Remove now-retired package.json property
   [\#11660](https://github.com/vector-im/riot-web/pull/11660)

Changes in [1.5.7](https://github.com/vector-im/riot-web/releases/tag/v1.5.7) (2020-01-13)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.7-rc.2...v1.5.7)

 * Enable and document presence in room list feature flag
   [\#11830](https://github.com/vector-im/riot-web/pull/11830)

Changes in [1.5.7-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.5.7-rc.2) (2020-01-08)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.7-rc.1...v1.5.7-rc.2)

 * Update to react-sdk rc.2 to fix build

Changes in [1.5.7-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.7-rc.1) (2020-01-06)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.6...v1.5.7-rc.1)

 * Update from Weblate
   [\#11784](https://github.com/vector-im/riot-web/pull/11784)
 * Add docs for feature_bridge_state flag
   [\#11778](https://github.com/vector-im/riot-web/pull/11778)
 * Add docs for feature_ftue_dms flag
   [\#11758](https://github.com/vector-im/riot-web/pull/11758)
 * Fix version file for Docker images
   [\#11721](https://github.com/vector-im/riot-web/pull/11721)
 * Add accelerators to context menu options like cut&paste in electron
   [\#11690](https://github.com/vector-im/riot-web/pull/11690)
 * electron-main: Provide a better error message if Seshat isn't installed.
   [\#11691](https://github.com/vector-im/riot-web/pull/11691)
 * Update from Weblate
   [\#11672](https://github.com/vector-im/riot-web/pull/11672)
 * Remove babel-plugin-transform-async-to-bluebird
   [\#11662](https://github.com/vector-im/riot-web/pull/11662)
 * Clarify which versions of what we support
   [\#11658](https://github.com/vector-im/riot-web/pull/11658)
 * Remove the code that calls the origin migrator
   [\#11631](https://github.com/vector-im/riot-web/pull/11631)
 * yarn upgrade
   [\#11617](https://github.com/vector-im/riot-web/pull/11617)
 * Remove draft-js dependency
   [\#11616](https://github.com/vector-im/riot-web/pull/11616)

Changes in [1.5.6](https://github.com/vector-im/riot-web/releases/tag/v1.5.6) (2019-12-09)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.6-rc.1...v1.5.6)

 * No changes since rc.1

Changes in [1.5.6-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.6-rc.1) (2019-12-04)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.5...v1.5.6-rc.1)

 * Update Lithuanian language name
   [\#11599](https://github.com/vector-im/riot-web/pull/11599)
 * Enable more languages
   [\#11592](https://github.com/vector-im/riot-web/pull/11592)
 * Fix Docker build for develop and publish a /version file
   [\#11588](https://github.com/vector-im/riot-web/pull/11588)
 * Remove unused translations
   [\#11540](https://github.com/vector-im/riot-web/pull/11540)
 * Update from Weblate
   [\#11591](https://github.com/vector-im/riot-web/pull/11591)
 * Update riot.im enable_presence_by_hs_url for new matrix.org client URL
   [\#11565](https://github.com/vector-im/riot-web/pull/11565)
 * Remove mention of vector.im as default identity server on mobile guide
   [\#11544](https://github.com/vector-im/riot-web/pull/11544)
 * Clean up and standardise app config
   [\#11549](https://github.com/vector-im/riot-web/pull/11549)
 * make it clear that seshat requires electron-build-env (at least on macOS)
   [\#11527](https://github.com/vector-im/riot-web/pull/11527)
 * Add postcss-easings
   [\#11521](https://github.com/vector-im/riot-web/pull/11521)
 * ElectronPlatform: Add support for a event index using Seshat.
   [\#11125](https://github.com/vector-im/riot-web/pull/11125)
 * Sign all of the Windows executable files
   [\#11516](https://github.com/vector-im/riot-web/pull/11516)
 * Clarify that cross-signing is in development
   [\#11493](https://github.com/vector-im/riot-web/pull/11493)
 * get rid of bluebird
   [\#11301](https://github.com/vector-im/riot-web/pull/11301)
 * Update from Weblate
   [\#11488](https://github.com/vector-im/riot-web/pull/11488)
 * Add note in README about self-hosted riot installs requiring custom caching
   headers
   [\#8702](https://github.com/vector-im/riot-web/pull/8702)
 * De-dup theming code
   [\#11445](https://github.com/vector-im/riot-web/pull/11445)
 * Add eslint-plugin-jest because we inherit js-sdk's eslintrc and it wants
   [\#11448](https://github.com/vector-im/riot-web/pull/11448)

Changes in [1.5.5](https://github.com/vector-im/riot-web/releases/tag/v1.5.5) (2019-11-27)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.4...v1.5.5)

* Upgrade to JS SDK 2.5.4 to relax identity server discovery and E2EE debugging
* Upgrade to React SDK 1.7.4 to fix override behaviour of themes
* Clarify that cross-signing is in development
* Sign all of the Windows executable files

Changes in [1.5.4](https://github.com/vector-im/riot-web/releases/tag/v1.5.4) (2019-11-25)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.4-rc.2...v1.5.4)

 * No changes since rc.2

Changes in [1.5.4-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.5.4-rc.2) (2019-11-22)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.4-rc.1...v1.5.4-rc.2)

 * react-sdk rc.2 to fix an error in Safari and some cosmetic
   bugs

Changes in [1.5.4-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.4-rc.1) (2019-11-20)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.3...v1.5.4-rc.1)

 * Add doc for custom themes
   [\#11444](https://github.com/vector-im/riot-web/pull/11444)
 * Use new theme API in react-sdk
   [\#11442](https://github.com/vector-im/riot-web/pull/11442)
 * preload warning triangle
   [\#11441](https://github.com/vector-im/riot-web/pull/11441)
 * Update from Weblate
   [\#11440](https://github.com/vector-im/riot-web/pull/11440)
 * Add entitlements file for mic & camera permissions on macOS
   [\#11435](https://github.com/vector-im/riot-web/pull/11435)
 * Fix error/exception in electron signing script
   [\#11429](https://github.com/vector-im/riot-web/pull/11429)
 * Merge the `feature_user_info_panel` flag into `feature_dm_verification`
   [\#11426](https://github.com/vector-im/riot-web/pull/11426)
 * Let the user's homeserver config override the build config
   [\#11409](https://github.com/vector-im/riot-web/pull/11409)
 * Add cross-signing labs flag to develop and document
   [\#11408](https://github.com/vector-im/riot-web/pull/11408)
 * Update from Weblate
   [\#11405](https://github.com/vector-im/riot-web/pull/11405)
 * Trigger a theme change on startup, not just a tint change
   [\#11381](https://github.com/vector-im/riot-web/pull/11381)
 * Perform favicon updates twice in Chrome
   [\#11375](https://github.com/vector-im/riot-web/pull/11375)
 * Add labs documentation for Mjolnir
   [\#11275](https://github.com/vector-im/riot-web/pull/11275)
 * Add description of user info feature in labs doc
   [\#11360](https://github.com/vector-im/riot-web/pull/11360)
 * Update from Weblate
   [\#11359](https://github.com/vector-im/riot-web/pull/11359)
 * Add DM verification feature to labs.md
   [\#11356](https://github.com/vector-im/riot-web/pull/11356)
 * Add feature_dm_verification to labs
   [\#11355](https://github.com/vector-im/riot-web/pull/11355)
 * Document feature flag process
   [\#11341](https://github.com/vector-im/riot-web/pull/11341)
 * Remove unused feature flags
   [\#11343](https://github.com/vector-im/riot-web/pull/11343)

Changes in [1.5.3](https://github.com/vector-im/riot-web/releases/tag/v1.5.3) (2019-11-06)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.2...v1.5.3)

 * Remove the 'auto hide menu bar' option on Mac
   [\#11326](https://github.com/vector-im/riot-web/pull/11326)
 * Expose feature_user_info_panel on riot.im/develop
   [\#11304](https://github.com/vector-im/riot-web/pull/11304)
 * Upgrade electron-notarize
   [\#11312](https://github.com/vector-im/riot-web/pull/11312)
 * Fix close window behaviour on Macos
   [\#11309](https://github.com/vector-im/riot-web/pull/11309)
 * Merge: Add dependency to eslint-plugin-react-hooks as react-sdk did
   [\#11307](https://github.com/vector-im/riot-web/pull/11307)
 * Add dependency to eslint-plugin-react-hooks as react-sdk did
   [\#11306](https://github.com/vector-im/riot-web/pull/11306)
 * Update from Weblate
   [\#11300](https://github.com/vector-im/riot-web/pull/11300)

Changes in [1.5.2](https://github.com/vector-im/riot-web/releases/tag/v1.5.2) (2019-11-04)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.1...v1.5.2)

 * Fix close window behaviour on Macos
   [\#11311](https://github.com/vector-im/riot-web/pull/11311)

Changes in [1.5.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.1) (2019-11-04)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.1-rc.2...v1.5.1)

 * No changes since rc.2

Changes in [1.5.1-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.5.1-rc.2) (2019-11-01)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.1-rc.1...v1.5.1-rc.2)

 * Updated react-sdk with fix for bug that caused room filtering to
   omit results.

Changes in [1.5.1-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.1-rc.1) (2019-10-30)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.0...v1.5.1-rc.1)

 * Add ability to hide tray icon on non-Mac (which has no tray icon)
   [\#11258](https://github.com/vector-im/riot-web/pull/11258)
 * Fix bug preventing display from sleeping after a call
   [\#11264](https://github.com/vector-im/riot-web/pull/11264)
 * Remove mention of CI scripts from docs
   [\#11257](https://github.com/vector-im/riot-web/pull/11257)
 * Fix skinning replaces being broken since being rewritten as React FC's
   [\#11254](https://github.com/vector-im/riot-web/pull/11254)
 * Update config docs about identity servers
   [\#11249](https://github.com/vector-im/riot-web/pull/11249)
 * Remove unneeded help about identity servers
   [\#11248](https://github.com/vector-im/riot-web/pull/11248)
 * Update from Weblate
   [\#11243](https://github.com/vector-im/riot-web/pull/11243)
 * Update sample config for new matrix.org CS API URL
   [\#11207](https://github.com/vector-im/riot-web/pull/11207)
 * clarify where the e2e tests are located
   [\#11115](https://github.com/vector-im/riot-web/pull/11115)
 * Update from Weblate
   [\#11171](https://github.com/vector-im/riot-web/pull/11171)
 * Prevent referrers from being sent
   [\#6155](https://github.com/vector-im/riot-web/pull/6155)
 * Add darkModeSupport to allow dark themed title bar.
   [\#11140](https://github.com/vector-im/riot-web/pull/11140)
 * Fix the label of Turkish language
   [\#11124](https://github.com/vector-im/riot-web/pull/11124)
 * Update default HS config to match well-known
   [\#11112](https://github.com/vector-im/riot-web/pull/11112)

Changes in [1.5.0](https://github.com/vector-im/riot-web/releases/tag/v1.5.0) (2019-10-18)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.5.0-rc.1...v1.5.0)

 * Upgrade to JS SDK v2.4.2 and React SDK v1.7.0
 * Port Windows signing and macOS notarization to release
   [\#11158](https://github.com/vector-im/riot-web/pull/11158)
 * Sign main Windows executable
   [\#11126](https://github.com/vector-im/riot-web/pull/11126)
 * Notarise the macOS app
   [\#11119](https://github.com/vector-im/riot-web/pull/11119)

Changes in [1.5.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.5.0-rc.1) (2019-10-09)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.4.2...v1.5.0-rc.1)

 * Update from Weblate
   [\#11104](https://github.com/vector-im/riot-web/pull/11104)
 * Bump Olm to 3.1.4 for olm_session_describe
   [\#11103](https://github.com/vector-im/riot-web/pull/11103)
 * Enable Webpack production mode for start:js:prod
   [\#11098](https://github.com/vector-im/riot-web/pull/11098)
 * add settingDefaults to sample config
   [\#9919](https://github.com/vector-im/riot-web/pull/9919)
 * Add config.json copy instruction to 'Development' as well
   [\#11062](https://github.com/vector-im/riot-web/pull/11062)
 * Revert "Run yarn upgrade"
   [\#11055](https://github.com/vector-im/riot-web/pull/11055)
 * Run yarn upgrade
   [\#11050](https://github.com/vector-im/riot-web/pull/11050)
 * Request persistent storage on Electron
   [\#11052](https://github.com/vector-im/riot-web/pull/11052)
 * Remove docs for CIDER feature
   [\#11047](https://github.com/vector-im/riot-web/pull/11047)

Changes in [1.4.2](https://github.com/vector-im/riot-web/releases/tag/v1.4.2) (2019-10-04)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.4.2-rc.1...v1.4.2)

 * Document troubleshooting for memory leaks and getting profiles
   [\#11031](https://github.com/vector-im/riot-web/pull/11031)

Changes in [1.4.2-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.4.2-rc.1) (2019-10-02)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.4.1...v1.4.2-rc.1)

 * Custom themes MVP
   [\#11017](https://github.com/vector-im/riot-web/pull/11017)
 * Document permalinkPrefix setting
   [\#11007](https://github.com/vector-im/riot-web/pull/11007)

Changes in [1.4.1](https://github.com/vector-im/riot-web/releases/tag/v1.4.1) (2019-10-01)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.4.0...v1.4.1)

 * Upgrade to React SDK 1.6.1 to fix critical
   [blank screen issue](https://github.com/vector-im/riot-web/issues/10983)
 * Upgrade to JS SDK 2.4.1 to to ignore crypto events with empty content
 * Update from Weblate
   [\#11010](https://github.com/vector-im/riot-web/pull/11010)
 * Update from Weblate
   [\#11001](https://github.com/vector-im/riot-web/pull/11001)
 * Upgrade deps
   [\#10980](https://github.com/vector-im/riot-web/pull/10980)

Changes in [1.4.0](https://github.com/vector-im/riot-web/releases/tag/v1.4.0) (2019-09-27)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.4.0-rc.2...v1.4.0)

* Many improvements related to privacy and user control of identity services and integration managers
* Upgrade to React SDK 1.6.0 and JS SDK 2.4.0

Changes in [1.4.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.4.0-rc.2) (2019-09-26)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.4.0-rc.1...v1.4.0-rc.2)

 * Upgrade to React SDK 1.6.0-rc.2
 * Work around Yarn confusion with `react-gemini-scrollbar` package

Changes in [1.4.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.4.0-rc.1) (2019-09-25)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.6...v1.4.0-rc.1)

 * Upgrade to React SDK 1.6.0-rc.1 and JS SDK 2.4.0-rc.1
 * Update from Weblate
   [\#10961](https://github.com/vector-im/riot-web/pull/10961)
 * Don't log query parameters as they may contain secrets
   [\#10929](https://github.com/vector-im/riot-web/pull/10929)
 * Document more shortcuts
   [\#10906](https://github.com/vector-im/riot-web/pull/10906)
 * Point to #develop and use the same gemini-scrollbar version as the react-sdk
   [\#10893](https://github.com/vector-im/riot-web/pull/10893)
 * Tweak lock file to pull in only one React version
   [\#10874](https://github.com/vector-im/riot-web/pull/10874)
 * document disable_custom_urls
   [\#10844](https://github.com/vector-im/riot-web/pull/10844)
 * Install guide tweaks
   [\#10838](https://github.com/vector-im/riot-web/pull/10838)
 * Switch to React 16
   [\#10480](https://github.com/vector-im/riot-web/pull/10480)
 * Update install guide
   [\#10810](https://github.com/vector-im/riot-web/pull/10810)
 * Clarify that HTTPS is not just needed for VoIP
   [\#6146](https://github.com/vector-im/riot-web/pull/6146)
 * Bump eslint-utils from 1.4.0 to 1.4.2
   [\#10692](https://github.com/vector-im/riot-web/pull/10692)
 * Add docs for tabbed integration managers labs flag
   [\#10641](https://github.com/vector-im/riot-web/pull/10641)
 * Change integrations_widgets_urls default configuration
   [\#10656](https://github.com/vector-im/riot-web/pull/10656)
 * Add docs for the CIDER composer flag
   [\#10638](https://github.com/vector-im/riot-web/pull/10638)
 * add cider composer labs flag
   [\#10626](https://github.com/vector-im/riot-web/pull/10626)
 * Upgrade to Electron 6.0.3
   [\#10601](https://github.com/vector-im/riot-web/pull/10601)
 * Upgrade to Electron 6
   [\#10596](https://github.com/vector-im/riot-web/pull/10596)
 * Update from Weblate
   [\#10591](https://github.com/vector-im/riot-web/pull/10591)
 * Upgrade electron-builder to 21.2.0
   [\#10579](https://github.com/vector-im/riot-web/pull/10579)
 * Set SUID bit on chrome-sandbox for Debian
   [\#10580](https://github.com/vector-im/riot-web/pull/10580)
 * Load config.json before loading language so default can apply
   [\#10551](https://github.com/vector-im/riot-web/pull/10551)
 * Bump matrix-react-test-utils for React 16 compatibility
   [\#10543](https://github.com/vector-im/riot-web/pull/10543)
 * Add --help to electron app
   [\#10530](https://github.com/vector-im/riot-web/pull/10530)
 * Allow setting electron autoHideMenuBar and persist it
   [\#10503](https://github.com/vector-im/riot-web/pull/10503)
 * Upgrade dependencies
   [\#10475](https://github.com/vector-im/riot-web/pull/10475)

Changes in [1.3.6](https://github.com/vector-im/riot-web/releases/tag/v1.3.6) (2019-09-19)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.5...v1.3.6)

 * Fix origin migrator for SSO logins
   [\#10920](https://github.com/vector-im/riot-web/pull/10920)

Changes in [1.3.5](https://github.com/vector-im/riot-web/releases/tag/v1.3.5) (2019-09-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.5-rc.3...v1.3.5)

 * Updated js-sdk and react-sdk for some more minor bugfixes

Changes in [1.3.5-rc.3](https://github.com/vector-im/riot-web/releases/tag/v1.3.5-rc.3) (2019-09-13)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.5-rc.2...v1.3.5-rc.3)

 * js-sdk rc.1 to include report API

Changes in [1.3.5-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.3.5-rc.2) (2019-09-13)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.5-rc.1...v1.3.5-rc.2)

 * Pull in more fixes from react-sdk rc.2

Changes in [1.3.5-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.3.5-rc.1) (2019-09-12)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.4...v1.3.5-rc.1)

 * Cosmetic fixes from react-sdk rc.1

Changes in [1.3.4](https://github.com/vector-im/riot-web/releases/tag/v1.3.4) (2019-09-12)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.4-rc.1...v1.3.4)

 * Updated react-sdk and tweaks to mobile install guide

Changes in [1.3.4-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.3.4-rc.1) (2019-09-11)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.3...v1.3.4-rc.1)

 * Update install guide
   [\#10831](https://github.com/vector-im/riot-web/pull/10831)

Changes in [1.3.3](https://github.com/vector-im/riot-web/releases/tag/v1.3.3) (2019-08-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.2...v1.3.3)

 * Linux-only release to fix sandboxing with Electron 5 on Debian
   [\#10580](https://github.com/vector-im/riot-web/pull/10580)

Changes in [1.3.2](https://github.com/vector-im/riot-web/releases/tag/v1.3.2) (2019-08-05)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.1...v1.3.2)

 * Updated react-sdk for deactivated account error message on login

Changes in [1.3.1](https://github.com/vector-im/riot-web/releases/tag/v1.3.1) (2019-08-05)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.1-rc.1...v1.3.1)

 * Updated js-sdk for notifications fix and react-sdk for registration fix

Changes in [1.3.1-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.3.1-rc.1) (2019-07-31)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.0...v1.3.1-rc.1)

 * Upgrade to JS SDK 2.3.0-rc.1 and React SDK 1.5.0-rc.1
 * Update from Weblate
   [\#10436](https://github.com/vector-im/riot-web/pull/10436)
 * Describe our existing features better in documentation
   [\#10418](https://github.com/vector-im/riot-web/pull/10418)
 * Upgrade to Electron 5
   [\#10392](https://github.com/vector-im/riot-web/pull/10392)
 * Remove edits and reactions feature flags from docs and config
   [\#10363](https://github.com/vector-im/riot-web/pull/10363)
 * Cachebust config file requests
   [\#10349](https://github.com/vector-im/riot-web/pull/10349)
 * Convert install-app-deps to subcommand
   [\#10334](https://github.com/vector-im/riot-web/pull/10334)
 * Add riot.im configuration files
   [\#10327](https://github.com/vector-im/riot-web/pull/10327)
 * Require descriptions in mxSendRageshake and remove infinite loop in issue
   templates
   [\#10321](https://github.com/vector-im/riot-web/pull/10321)
 * Remove unused disable_identity_server config flag
   [\#10322](https://github.com/vector-im/riot-web/pull/10322)
 * Verify i18n in CI
   [\#10320](https://github.com/vector-im/riot-web/pull/10320)

Changes in [1.3.0](https://github.com/vector-im/riot-web/releases/tag/v1.3.0) (2019-07-18)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.0-rc.3...v1.3.0)

 * Upgrade to React SDK 1.4.0 and JS SDK 2.2.0
 * Message editing and reactions features enabled
 * Remove edits and reactions feature flags from docs and config
   [\#10365](https://github.com/vector-im/riot-web/pull/10365)

Changes in [1.3.0-rc.3](https://github.com/vector-im/riot-web/releases/tag/v1.3.0-rc.3) (2019-07-15)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.0-rc.2...v1.3.0-rc.3)

 * Update to react-sdk rc.3 to fix a bug where a room admin could generate a room
   that would cause Riot to error, and some stuck notifications.

Changes in [1.3.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.3.0-rc.2) (2019-07-12)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.3.0-rc.1...v1.3.0-rc.2)

 * Upgrade to React SDK 1.4.0-rc.2 and JS SDK 2.2.0-rc.2
 * Fix regression from Riot 1.3.0-rc.1 when listing devices in user settings

Changes in [1.3.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.3.0-rc.1) (2019-07-12)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.4...v1.3.0-rc.1)

 * Upgrade to React SDK 1.4.0-rc.1 and JS SDK 2.2.0-rc.1
 * Update from Weblate
   [\#10328](https://github.com/vector-im/riot-web/pull/10328)
 * Upgrade dependencies
   [\#10308](https://github.com/vector-im/riot-web/pull/10308)
 * Upgrade dependencies
   [\#10260](https://github.com/vector-im/riot-web/pull/10260)

Changes in [1.2.4](https://github.com/vector-im/riot-web/releases/tag/v1.2.4) (2019-07-11)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.3...v1.2.4)

 * Upgrade to React SDK 1.3.1 and JS SDK 2.1.1
 * Upgrade lodash dependencies
 * JS SDK 2.1.1 includes a fix for ephemeral event processing
 * React SDK 1.3.1 includes a fix for account deactivation

Changes in [1.2.3](https://github.com/vector-im/riot-web/releases/tag/v1.2.3) (2019-07-08)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.3-rc.1...v1.2.3)

 * Upgrade to React SDK 1.3.0 and JS SDK 2.1.0
 * JS SDK 2.1.0 includes a fix for an exception whilst syncing

Changes in [1.2.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.2.3-rc.1) (2019-07-03)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.2...v1.2.3-rc.1)

 * Change update URL to match new host
   [\#10247](https://github.com/vector-im/riot-web/pull/10247)
 * Update from Weblate
   [\#10219](https://github.com/vector-im/riot-web/pull/10219)
 * Extract configuration docs to separate file
   [\#10195](https://github.com/vector-im/riot-web/pull/10195)
 * Add e2e/warning.svg to preload
   [\#10197](https://github.com/vector-im/riot-web/pull/10197)
 * Fix Electron vector: links
   [\#10196](https://github.com/vector-im/riot-web/pull/10196)
 * Display a red box of anger for config syntax errors
   [\#10193](https://github.com/vector-im/riot-web/pull/10193)
 * Move config-getting to VectorBasePlatform
   [\#10181](https://github.com/vector-im/riot-web/pull/10181)
 * Update from Weblate
   [\#10124](https://github.com/vector-im/riot-web/pull/10124)
 * Fix default Electron window and tray icons
   [\#10097](https://github.com/vector-im/riot-web/pull/10097)

Changes in [1.2.2](https://github.com/vector-im/riot-web/releases/tag/v1.2.2) (2019-06-19)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.2-rc.2...v1.2.2)

 No changes since rc.2

Changes in [1.2.2-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.2.2-rc.2) (2019-06-18)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.2-rc.1...v1.2.2-rc.2)

 * Update to react-sdk and js-sdk rc.2 for registration fixes,
   redaction local echo fix and removing unnecessary calls
   to the integration manager.

Changes in [1.2.2-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.2.2-rc.1) (2019-06-12)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.1...v1.2.2-rc.1)

 * Update from Weblate
   [\#10012](https://github.com/vector-im/riot-web/pull/10012)
 * Add funding details for GitHub sponsor button
   [\#9982](https://github.com/vector-im/riot-web/pull/9982)
 * Do not fail on server liveliness checks during startup
   [\#9960](https://github.com/vector-im/riot-web/pull/9960)
 * Hide guest functions on the welcome page if not logged in
   [\#9957](https://github.com/vector-im/riot-web/pull/9957)
 * Add Albanian and West Flemish languages
   [\#9953](https://github.com/vector-im/riot-web/pull/9953)
 * Update from Weblate
   [\#9951](https://github.com/vector-im/riot-web/pull/9951)
 * Add docs for defaultCountryCode
   [\#9927](https://github.com/vector-im/riot-web/pull/9927)
 * Use the user's pre-existing HS when config validation fails
   [\#9892](https://github.com/vector-im/riot-web/pull/9892)
 * Low bandwidth mode
   [\#9909](https://github.com/vector-im/riot-web/pull/9909)
 * Fix Twemoji loading on Windows dev machines
   [\#9869](https://github.com/vector-im/riot-web/pull/9869)
 * Base Docker image on nginx:alpine, not the larger nginx:latest
   [\#9848](https://github.com/vector-im/riot-web/pull/9848)
 * Validate homeserver configuration prior to loading the app
   [\#9779](https://github.com/vector-im/riot-web/pull/9779)
 * Show resolved homeserver configuration on the mobile guide
   [\#9726](https://github.com/vector-im/riot-web/pull/9726)
 * Flag the validated config as the default config
   [\#9721](https://github.com/vector-im/riot-web/pull/9721)
 * Clarify comment on is_url and hs_url handling
   [\#9719](https://github.com/vector-im/riot-web/pull/9719)
 * Validate default homeserver config before loading the app
   [\#9496](https://github.com/vector-im/riot-web/pull/9496)

Changes in [1.2.1](https://github.com/vector-im/riot-web/releases/tag/v1.2.1) (2019-05-31)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.0...v1.2.1)

 * Upgrade JS SDK to 2.0.0 and React SDK to 1.2.1 to fix key backup and native emoji height

Changes in [1.2.0](https://github.com/vector-im/riot-web/releases/tag/v1.2.0) (2019-05-29)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.2.0-rc.1...v1.2.0)

 * Upgrade to JS SDK v1.2.0 and React SDK v1.2.0 to fix some regressions

Changes in [1.2.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.2.0-rc.1) (2019-05-23)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.1.2...v1.2.0-rc.1)

 * Update from Weblate
   [\#9802](https://github.com/vector-im/riot-web/pull/9802)
 * remove emojione
   [\#9766](https://github.com/vector-im/riot-web/pull/9766)
 * Make Dockerfile work for develop and other branches
   [\#9736](https://github.com/vector-im/riot-web/pull/9736)
 * add description of new labs feature for message editing
   [\#9728](https://github.com/vector-im/riot-web/pull/9728)
 * Remove karma junit output
   [\#9628](https://github.com/vector-im/riot-web/pull/9628)
 * yarn upgrade
   [\#9626](https://github.com/vector-im/riot-web/pull/9626)
 * Respond quickly to buildkite pokes
   [\#9617](https://github.com/vector-im/riot-web/pull/9617)
 * Delay creating the `Favico` instance
   [\#9616](https://github.com/vector-im/riot-web/pull/9616)
 * Add reactions feature to config sample
   [\#9598](https://github.com/vector-im/riot-web/pull/9598)

Changes in [1.1.2](https://github.com/vector-im/riot-web/releases/tag/v1.1.2) (2019-05-15)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.1.1...v1.1.2)

 * react-sdk v1.1.2 to fix single sign-on and GIF autoplaying

Changes in [1.1.1](https://github.com/vector-im/riot-web/releases/tag/v1.1.1) (2019-05-14)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.1.0...v1.1.1)

 * react-sdk v1.1.1 to fix regressions with registration

Changes in [1.1.0](https://github.com/vector-im/riot-web/releases/tag/v1.1.0) (2019-05-07)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.1.0-rc.1...v1.1.0)

 * Add Dockerfile
   [\#9632](https://github.com/vector-im/riot-web/pull/9632)
 * Add Dockerfile (part 2)
   [\#9426](https://github.com/vector-im/riot-web/pull/9426)
 * Add new scalar staging url
   [\#9601](https://github.com/vector-im/riot-web/pull/9601)

Changes in [1.1.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.1.0-rc.1) (2019-04-30)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.8...v1.1.0-rc.1)

 * Convert redeploy.py to buildkite
   [\#9577](https://github.com/vector-im/riot-web/pull/9577)
 * Add package step to buildkite pipeline
   [\#9568](https://github.com/vector-im/riot-web/pull/9568)
 * Don't fail if there's no local config to remove
   [\#9571](https://github.com/vector-im/riot-web/pull/9571)
 * Change jenkins script to package script
   [\#9567](https://github.com/vector-im/riot-web/pull/9567)
 * Remove config.json from package dir
   [\#9555](https://github.com/vector-im/riot-web/pull/9555)
 * use the release version of olm 3.1.0
   [\#9550](https://github.com/vector-im/riot-web/pull/9550)
 * Fix default for --include arg
   [\#9517](https://github.com/vector-im/riot-web/pull/9517)
 * update installation instructions with new repo
   [\#9500](https://github.com/vector-im/riot-web/pull/9500)
 * Use packages.matrix.org for Olm
   [\#9498](https://github.com/vector-im/riot-web/pull/9498)
 * Add separate platform electron build commands
   [\#9412](https://github.com/vector-im/riot-web/pull/9412)
 * Add support for custom profile directory
   [\#9408](https://github.com/vector-im/riot-web/pull/9408)
 * Improved mobile install guide
   [\#9410](https://github.com/vector-im/riot-web/pull/9410)
 * Remove vector-electron-desktop from README
   [\#9404](https://github.com/vector-im/riot-web/pull/9404)
 * Update from Weblate
   [\#9398](https://github.com/vector-im/riot-web/pull/9398)
 * bump olm version to 3.1.0-pre3
   [\#9392](https://github.com/vector-im/riot-web/pull/9392)
 * Add expiration to mobile guide cookie
   [\#9383](https://github.com/vector-im/riot-web/pull/9383)
 * Fix autolaunch setting appearing toggled off
   [\#9368](https://github.com/vector-im/riot-web/pull/9368)
 * Don't try to save files the user didn't want to save
   [\#9352](https://github.com/vector-im/riot-web/pull/9352)
 * Setup crypto store for restore session tests
   [\#9325](https://github.com/vector-im/riot-web/pull/9325)
 * Update from Weblate
   [\#9333](https://github.com/vector-im/riot-web/pull/9333)
 * Add "Save image as..." button to context menu on images
   [\#9326](https://github.com/vector-im/riot-web/pull/9326)
 * Configure auth footer links through Riot config
   [\#9297](https://github.com/vector-im/riot-web/pull/9297)

Changes in [1.0.8](https://github.com/vector-im/riot-web/releases/tag/v1.0.8) (2019-04-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.7...v1.0.8)

 * No changes in this release. This is the same code as v1.0.7 from our new clean-room
   packaging and signing infrastructure.

Changes in [1.0.7](https://github.com/vector-im/riot-web/releases/tag/v1.0.7) (2019-04-08)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.6...v1.0.7)

 * Hotfix: bump js-sdk to 1.0.4, see https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.4

Changes in [1.0.6](https://github.com/vector-im/riot-web/releases/tag/v1.0.6) (2019-04-01)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.6-rc.1...v1.0.6)

 * Add "Save image as..." button to context menu on images
   [\#9327](https://github.com/vector-im/riot-web/pull/9327)

Changes in [1.0.6-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.0.6-rc.1) (2019-03-27)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.5...v1.0.6-rc.1)

 * Use `on_logged_in` action in tests
   [\#9279](https://github.com/vector-im/riot-web/pull/9279)
 * Convert away from `Promise.defer`
   [\#9278](https://github.com/vector-im/riot-web/pull/9278)
 * update react-sdk version in yarn lockfile
   [\#9233](https://github.com/vector-im/riot-web/pull/9233)
 * "Render simple counters in room header" details
   [\#9154](https://github.com/vector-im/riot-web/pull/9154)
 * Use medium agents for the more resource intensive builds
   [\#9238](https://github.com/vector-im/riot-web/pull/9238)
 * Add log grouping to buildkite
   [\#9223](https://github.com/vector-im/riot-web/pull/9223)
 * Switch to `git` protocol for CI dependencies
   [\#9222](https://github.com/vector-im/riot-web/pull/9222)
 * Support CI for matching branches on forks
   [\#9212](https://github.com/vector-im/riot-web/pull/9212)
 * Update from Weblate
   [\#9199](https://github.com/vector-im/riot-web/pull/9199)
 * Declare the officially supported browsers in the README
   [\#9177](https://github.com/vector-im/riot-web/pull/9177)
 * Document some desktop app things
   [\#9011](https://github.com/vector-im/riot-web/pull/9011)
 * Use Buildkite for CI
   [\#9165](https://github.com/vector-im/riot-web/pull/9165)
 * Update version number in issue templates
   [\#9170](https://github.com/vector-im/riot-web/pull/9170)
 * Remove node 8.x from the build matrix
   [\#9159](https://github.com/vector-im/riot-web/pull/9159)
 * Update Electron help menu link
   [\#9157](https://github.com/vector-im/riot-web/pull/9157)

Changes in [1.0.5](https://github.com/vector-im/riot-web/releases/tag/v1.0.5) (2019-03-21)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.4...v1.0.5)

 * Hotfix for [\#9205](https://github.com/vector-im/riot-web/issues/9205) disabling jump prevention for typing notifications, while we're reworking this functionally to enable it again soon.

Changes in [1.0.4](https://github.com/vector-im/riot-web/releases/tag/v1.0.4) (2019-03-18)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.4-rc.1...v1.0.4)

 * No changes since rc.1

Changes in [1.0.4-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.0.4-rc.1) (2019-03-13)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.3...v1.0.4-rc.1)

 * Update from Weblate
   [\#9152](https://github.com/vector-im/riot-web/pull/9152)
 * Use modern Yarn version on Travis CI
   [\#9151](https://github.com/vector-im/riot-web/pull/9151)
 * Switch to `yarn` for dependency management
   [\#9132](https://github.com/vector-im/riot-web/pull/9132)
 * Update from Weblate
   [\#9104](https://github.com/vector-im/riot-web/pull/9104)
 * Don't copy the 32 bit linux deb
   [\#9075](https://github.com/vector-im/riot-web/pull/9075)
 * Change olm dependency to normal dep
   [\#9068](https://github.com/vector-im/riot-web/pull/9068)
 * Add modular.im hosting link to electron app config
   [\#9047](https://github.com/vector-im/riot-web/pull/9047)
 * Nudge karma to 3.1.2
   [\#8991](https://github.com/vector-im/riot-web/pull/8991)
 * Add support for localConfig at $appData/config.json.
   [\#8983](https://github.com/vector-im/riot-web/pull/8983)

Changes in [1.0.3](https://github.com/vector-im/riot-web/releases/tag/v1.0.3) (2019-03-06)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.2...v1.0.3)

 * react-sdk 1.0.3 to fix ctrl+k shortcut and room list bugs

Changes in [1.0.2](https://github.com/vector-im/riot-web/releases/tag/v1.0.2) (2019-03-06)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.2-rc.3...v1.0.2)

 * New react-sdk for minor hosting link fixes

Changes in [1.0.2-rc.3](https://github.com/vector-im/riot-web/releases/tag/v1.0.2-rc.3) (2019-03-05)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.2-rc.2...v1.0.2-rc.3)

 * Add modular.im hosting link to electron app config
   [\#9051](https://github.com/vector-im/riot-web/pull/9051)

Changes in [1.0.2-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.0.2-rc.2) (2019-03-01)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.2-rc.1...v1.0.2-rc.2)

 * Update to react-sdk rc.3

Changes in [1.0.2-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.0.2-rc.1) (2019-03-01)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.1...v1.0.2-rc.1)

 * Set a require alias for the webapp directory
   [\#9014](https://github.com/vector-im/riot-web/pull/9014)
 * Update from Weblate.
   [\#8973](https://github.com/vector-im/riot-web/pull/8973)
 * set chrome path for travis CI explicitly
   [\#8987](https://github.com/vector-im/riot-web/pull/8987)
 * Updated install spinner
   [\#8984](https://github.com/vector-im/riot-web/pull/8984)
 * Allow disabling update mechanism
   [\#8911](https://github.com/vector-im/riot-web/pull/8911)
 * Allow configuration of whether closing window closes or minimizes to tray
   [\#8908](https://github.com/vector-im/riot-web/pull/8908)
 * Fix language file path for Jenkins
   [\#8854](https://github.com/vector-im/riot-web/pull/8854)
 * Document and recommend `default_server_name`
   [\#8832](https://github.com/vector-im/riot-web/pull/8832)
 * Cache busting for icons & language files
   [\#8710](https://github.com/vector-im/riot-web/pull/8710)
 * Remove redesign issue template
   [\#8722](https://github.com/vector-im/riot-web/pull/8722)
 * Make scripts/make-icons.sh work on linux
   [\#8550](https://github.com/vector-im/riot-web/pull/8550)

Changes in [1.0.1](https://github.com/vector-im/riot-web/releases/tag/v1.0.1) (2019-02-15)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.0...v1.0.1)


Changes in [1.0.0](https://github.com/vector-im/riot-web/releases/tag/v1.0.0) (2019-02-14)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.0-rc.2...v1.0.0)

 * Add snipping lines to welcome page without guests
   [\#8634](https://github.com/vector-im/riot-web/pull/8634)
 * Add home page to fix loading tests
   [\#8625](https://github.com/vector-im/riot-web/pull/8625)

Changes in [1.0.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v1.0.0-rc.2) (2019-02-14)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v1.0.0-rc.1...v1.0.0-rc.2)

 * Update from Weblate.
   [\#8615](https://github.com/vector-im/riot-web/pull/8615)
 * Replace favicon assets to ones with transparent backgrounds
   [\#8600](https://github.com/vector-im/riot-web/pull/8600)
 * Refreshed icons
   [\#8594](https://github.com/vector-im/riot-web/pull/8594)
 * Fix order of fetch-develop-deps / npm install
   [\#8566](https://github.com/vector-im/riot-web/pull/8566)
 * Revive building dark theme
   [\#8540](https://github.com/vector-im/riot-web/pull/8540)
 * Update from Weblate.
   [\#8546](https://github.com/vector-im/riot-web/pull/8546)
 * Repair app loading tests after welcome page
   [\#8525](https://github.com/vector-im/riot-web/pull/8525)
 * Support configurable welcome background and logo
   [\#8528](https://github.com/vector-im/riot-web/pull/8528)
 * Update from Weblate.
   [\#8518](https://github.com/vector-im/riot-web/pull/8518)
 * Document `embeddedPages` configuration
   [\#8514](https://github.com/vector-im/riot-web/pull/8514)
 * README.md : Syntax Coloring
   [\#8502](https://github.com/vector-im/riot-web/pull/8502)

Changes in [1.0.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v1.0.0-rc.1) (2019-02-08)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.9...v1.0.0-rc.1)

 * Update from Weblate.
   [\#8475](https://github.com/vector-im/riot-web/pull/8475)
 * Add configurable welcome page
   [\#8466](https://github.com/vector-im/riot-web/pull/8466)
 * fix app tests after force enabling lazy loading + removing feature flag
   [\#8464](https://github.com/vector-im/riot-web/pull/8464)
 * Allow Electron to zoom with CommandOrControl+=
   [\#8381](https://github.com/vector-im/riot-web/pull/8381)
 * Hide sign in / create account for logged in users
   [\#8368](https://github.com/vector-im/riot-web/pull/8368)
 * Fix home page link target
   [\#8365](https://github.com/vector-im/riot-web/pull/8365)
 * Add auth background image and update Riot logo
   [\#8364](https://github.com/vector-im/riot-web/pull/8364)
 * New homepage
   [\#8363](https://github.com/vector-im/riot-web/pull/8363)
 * Spell homeserver correctly
   [\#8358](https://github.com/vector-im/riot-web/pull/8358)
 * Merge redesign into develop
   [\#8321](https://github.com/vector-im/riot-web/pull/8321)
 * Disable room directory test because it doesn't work
   [\#8318](https://github.com/vector-im/riot-web/pull/8318)
 * Tweak auth overflow on Windows and Linux
   [\#8307](https://github.com/vector-im/riot-web/pull/8307)
 * Clean up Custom Server Help dialog
   [\#8296](https://github.com/vector-im/riot-web/pull/8296)
 * Cache-bust olm.wasm
   [\#8283](https://github.com/vector-im/riot-web/pull/8283)
 * Completely disable other themes for now (#8277)
   [\#8280](https://github.com/vector-im/riot-web/pull/8280)
 * Remove support for team servers
   [\#8271](https://github.com/vector-im/riot-web/pull/8271)
 * Add target="_blank" to footer links
   [\#8248](https://github.com/vector-im/riot-web/pull/8248)
 * Fix device names on desktop
   [\#8241](https://github.com/vector-im/riot-web/pull/8241)
 * Fix literal &lt/&gt in notifications
   [\#8238](https://github.com/vector-im/riot-web/pull/8238)
 * Fix registration nextLink on desktop
   [\#8239](https://github.com/vector-im/riot-web/pull/8239)
 * Add returns to fetch-develop-deps
   [\#8233](https://github.com/vector-im/riot-web/pull/8233)
 * Update electron builder
   [\#8231](https://github.com/vector-im/riot-web/pull/8231)
 * Try fetching more branches for PRs
   [\#8225](https://github.com/vector-im/riot-web/pull/8225)
 * Use content hashing for font and image URLs
   [\#8159](https://github.com/vector-im/riot-web/pull/8159)
 * Develop->Experimental
   [\#8156](https://github.com/vector-im/riot-web/pull/8156)
 * Update from Weblate.
   [\#8150](https://github.com/vector-im/riot-web/pull/8150)
 * Correct the copying of e-mail addresses in the electron app
   [\#8124](https://github.com/vector-im/riot-web/pull/8124)
 * Start documenting keyboard shortcuts
   [\#7165](https://github.com/vector-im/riot-web/pull/7165)
 * Update issue templates
   [\#7948](https://github.com/vector-im/riot-web/pull/7948)
 * Added new colour var to all themes
   [\#7927](https://github.com/vector-im/riot-web/pull/7927)
 * Redesign: apply changes from dharma theme to status theme
   [\#7541](https://github.com/vector-im/riot-web/pull/7541)
 * Redesign: ignore setting and always show dharma theme for now
   [\#7540](https://github.com/vector-im/riot-web/pull/7540)

Changes in [0.17.9](https://github.com/vector-im/riot-web/releases/tag/v0.17.9) (2019-01-22)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.9-rc.1...v0.17.9)

 * Bugfix in react-sdk for setting DM rooms

Changes in [0.17.9-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.17.9-rc.1) (2019-01-17)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.8...v0.17.9-rc.1)

 * Merge develop into experimental
   [\#8003](https://github.com/vector-im/riot-web/pull/8003)
 * Electron: Load app from custom protocol
   [\#7943](https://github.com/vector-im/riot-web/pull/7943)
 * Fix the IndexedDB worker
   [\#7920](https://github.com/vector-im/riot-web/pull/7920)
 * Make clear that the Debian package is for desktop
   [\#7919](https://github.com/vector-im/riot-web/pull/7919)
 * Run the Desktop app in a sandbox
   [\#7907](https://github.com/vector-im/riot-web/pull/7907)
 * Update to new electron single instance API
   [\#7908](https://github.com/vector-im/riot-web/pull/7908)
 * Update the tests to match https://github.com/matrix-org/matrix-react-
   sdk/pull/2340
   [\#7834](https://github.com/vector-im/riot-web/pull/7834)

Changes in [0.17.8](https://github.com/vector-im/riot-web/releases/tag/v0.17.8) (2018-12-10)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.8-rc.1...v0.17.8)

 * No changes since rc.1

Changes in [0.17.8-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.17.8-rc.1) (2018-12-06)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.7...v0.17.8-rc.1)

 * Update from Weblate.
   [\#7784](https://github.com/vector-im/riot-web/pull/7784)
 * Add a function to send a rageshake from the console
   [\#7755](https://github.com/vector-im/riot-web/pull/7755)
 * Re-apply "Run lint on travis builds and use modern node versions"
   [\#7738](https://github.com/vector-im/riot-web/pull/7738)
 * Revert "Run lint on travis builds and use modern node versions"
   [\#7737](https://github.com/vector-im/riot-web/pull/7737)
 * Run lint on travis builds and use modern node versions
   [\#7490](https://github.com/vector-im/riot-web/pull/7490)
 * Fix missing js-sdk logging
   [\#7736](https://github.com/vector-im/riot-web/pull/7736)
 * Add $accent-color-50pct as a CSS variable to the Status theme
   [\#7710](https://github.com/vector-im/riot-web/pull/7710)

Changes in [0.17.7](https://github.com/vector-im/riot-web/releases/tag/v0.17.7) (2018-11-22)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.6...v0.17.7)

 * Warning when crypto DB is too new to use.
 * Fix missing entries from js-sdk in rageshake logs

Changes in [0.17.6](https://github.com/vector-im/riot-web/releases/tag/v0.17.6) (2018-11-19)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.6-rc.2...v0.17.6)

 * No changes since rc.2

Changes in [0.17.6-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.17.6-rc.2) (2018-11-15)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.6-rc.1...v0.17.6-rc.2)

 * Update to js-sdk 0.14 and react-sdk rc.2. rc.1 was broken as it was built against
   js-sdk 0.13 which does not use the new Olm 3.0 API.

Changes in [0.17.6-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.17.6-rc.1) (2018-11-15)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.5...v0.17.6-rc.1)

 * Update from Weblate.
   [\#7708](https://github.com/vector-im/riot-web/pull/7708)
 * Add Japanese (#7599)
   [\#7673](https://github.com/vector-im/riot-web/pull/7673)
 * Allow Webpack dev server to listen to all interfaces
   [\#7674](https://github.com/vector-im/riot-web/pull/7674)
 * Remove the request-only stuff we don't need anymore
   [\#7637](https://github.com/vector-im/riot-web/pull/7637)
 * Correct the author of the electron app
   [\#7615](https://github.com/vector-im/riot-web/pull/7615)
 * Mock fs, tls, and net to support request in the browser
   [\#7552](https://github.com/vector-im/riot-web/pull/7552)
 * Update chokidar to transitively get newer fsevents
   [\#7598](https://github.com/vector-im/riot-web/pull/7598)
 * Support WebAssembly version of Olm
   [\#7385](https://github.com/vector-im/riot-web/pull/7385)

Changes in [0.17.5](https://github.com/vector-im/riot-web/releases/tag/v0.17.5) (2018-11-13)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.4...v0.17.5)

 * Include change that was supposed to be included in orevious version

Changes in [0.17.4](https://github.com/vector-im/riot-web/releases/tag/v0.17.4) (2018-11-13)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.3...v0.17.4)

 * Add banner with login/register links for users who aren't logged in

Changes in [0.17.3](https://github.com/vector-im/riot-web/releases/tag/v0.17.3) (2018-10-29)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.3-rc.1...v0.17.3)

 * Fix for autocompleting text emoji from react-sdk v0.14.2

Changes in [0.17.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.17.3-rc.1) (2018-10-24)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.2...v0.17.3-rc.1)

 * Update from Weblate.
   [\#7549](https://github.com/vector-im/riot-web/pull/7549)
 * Don't set tags on notifications
   [\#7518](https://github.com/vector-im/riot-web/pull/7518)
 * Update to latest electron builder
   [\#7498](https://github.com/vector-im/riot-web/pull/7498)
 * Fix Tinter.setTheme to not fire using Firefox
   [\#6831](https://github.com/vector-im/riot-web/pull/6831)

Changes in [0.17.2](https://github.com/vector-im/riot-web/releases/tag/v0.17.2) (2018-10-19)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.1...v0.17.2)

 * Update react-sdk version to "Apply the user's tint once the MatrixClientPeg is moderately ready"
 * Electron: don't set tags on notifications
   [\#7518](https://github.com/vector-im/riot-web/pull/7518)

Changes in [0.17.1](https://github.com/vector-im/riot-web/releases/tag/v0.17.1) (2018-10-18)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.0...v0.17.1)

 * Stop electron crashing
   [\#7517](https://github.com/vector-im/riot-web/pull/7517)

Changes in [0.17.0](https://github.com/vector-im/riot-web/releases/tag/v0.17.0) (2018-10-16)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.17.0-rc.1...v0.17.0)

 * Phased rollout of lazyloading
   [\#7503](https://github.com/vector-im/riot-web/pull/7503)
 * Update to latest electron builder
   [\#7501](https://github.com/vector-im/riot-web/pull/7501)

Changes in [0.17.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.17.0-rc.1) (2018-10-11)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.5...v0.17.0-rc.1)

 * Revert "also commit the lock file when bumping version as it is now
   committed to the repo"
   [\#7483](https://github.com/vector-im/riot-web/pull/7483)
 * Update from Weblate.
   [\#7478](https://github.com/vector-im/riot-web/pull/7478)
 *  Fix riot-web Promise.defer warnings (#7409)
   [\#7444](https://github.com/vector-im/riot-web/pull/7444)
 * Use HTTPS cloning for riot-web too
   [\#7459](https://github.com/vector-im/riot-web/pull/7459)
 * Disable webpack-dev-server auto reload
   [\#7463](https://github.com/vector-im/riot-web/pull/7463)
 * Silence bluebird warnings
   [\#7462](https://github.com/vector-im/riot-web/pull/7462)
 * Fix reskindex on matrix-react-side not being called if using build script
   [\#7443](https://github.com/vector-im/riot-web/pull/7443)
 * Fix double-closed tags
   [\#7454](https://github.com/vector-im/riot-web/pull/7454)
 * Document how to turn off Piwik and bug reports (#6738)
   [\#7435](https://github.com/vector-im/riot-web/pull/7435)
 * also commit the lock file when bumping version as it is now committed to the
   repo
   [\#7429](https://github.com/vector-im/riot-web/pull/7429)
 * Update a bunch of deps
   [\#7393](https://github.com/vector-im/riot-web/pull/7393)
 * Don't show mobile guide if deep linking
   [\#7415](https://github.com/vector-im/riot-web/pull/7415)
 * Don't show custom server bit on matrix.org
   [\#7408](https://github.com/vector-im/riot-web/pull/7408)
 * Update Webpack to version 4
   [\#6620](https://github.com/vector-im/riot-web/pull/6620)
 * Webpack4
   [\#7387](https://github.com/vector-im/riot-web/pull/7387)

Changes in [0.16.6](https://github.com/vector-im/riot-web/releases/tag/v0.16.6) (2018-10-08)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.5...v0.16.6)

 * Update to matrix-react-sdk v0.13.6

Changes in [0.16.5](https://github.com/vector-im/riot-web/releases/tag/v0.16.5) (2018-10-01)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.5-rc.1...v0.16.5)

 * Don't show mobile guide if deep linking
   [\#7415](https://github.com/vector-im/riot-web/pull/7415)
 * Don't show custom server bit on matrix.org
   [\#7408](https://github.com/vector-im/riot-web/pull/7408)

Changes in [0.16.5-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.16.5-rc.1) (2018-09-27)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.4...v0.16.5-rc.1)

 * Update from Weblate.
   [\#7395](https://github.com/vector-im/riot-web/pull/7395)
 * Reduce the number of terminals required to build riot-web to 1
   [\#7355](https://github.com/vector-im/riot-web/pull/7355)
 * Small typo in release notes v0.16.3
   [\#7274](https://github.com/vector-im/riot-web/pull/7274)

Changes in [0.16.4](https://github.com/vector-im/riot-web/releases/tag/v0.16.4) (2018-09-10)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.4-rc.1...v0.16.4)

 * No changes since rc.1

Changes in [0.16.4-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.16.4-rc.1) (2018-09-07)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.3...v0.16.4-rc.1)

 * Update from Weblate.
   [\#7296](https://github.com/vector-im/riot-web/pull/7296)
 * Fix config not loading & mobileguide script being loaded in riot
   [\#7288](https://github.com/vector-im/riot-web/pull/7288)
 * Instructions for installing mobile apps
   [\#7272](https://github.com/vector-im/riot-web/pull/7272)
 * Tidy up index.js
   [\#7265](https://github.com/vector-im/riot-web/pull/7265)

Changes in [0.16.3](https://github.com/vector-im/riot-web/releases/tag/v0.16.3) (2018-09-03)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.3-rc.2...v0.16.3)

 * SECURITY FIX: This version (and release candidates) pull in an upstream security
   fix from electron to fix CVE-2018-15685. Electron users should update as soon as
   possible. Riot-web run outside of Electron is unaffected.

Changes in [0.16.3-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.16.3-rc.2) (2018-08-31)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.3-rc.1...v0.16.3-rc.2)

 * Update js-sdk to fix an exception causing the room list to become unresponsive.

Changes in [0.16.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.16.3-rc.1) (2018-08-30)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.2...v0.16.3-rc.1)

 * Update from Weblate.
   [\#7245](https://github.com/vector-im/riot-web/pull/7245)
 * Revert "Remove package-lock.json for now"
   [\#7128](https://github.com/vector-im/riot-web/pull/7128)
 * Remove package-lock.json for now
   [\#7115](https://github.com/vector-im/riot-web/pull/7115)

Changes in [0.16.2](https://github.com/vector-im/riot-web/releases/tag/v0.16.2) (2018-08-23)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.1...v0.16.2)

 * Support new server notices format

Changes in [0.16.1](https://github.com/vector-im/riot-web/releases/tag/v0.16.1) (2018-08-20)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.1-rc.1...v0.16.1)

 * No changes since rc.1

Changes in [0.16.1-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.16.1-rc.1) (2018-08-16)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.0...v0.16.1-rc.1)

 * Update from Weblate.
   [\#7178](https://github.com/vector-im/riot-web/pull/7178)
 * CSS for MAU warning bar
   [\#7152](https://github.com/vector-im/riot-web/pull/7152)
 * CSS for user limit error
   [\#7139](https://github.com/vector-im/riot-web/pull/7139)
 * Unpin sanitize-html
   [\#7132](https://github.com/vector-im/riot-web/pull/7132)
 * Pin sanitize-html to 0.18.2
   [\#7129](https://github.com/vector-im/riot-web/pull/7129)

Changes in [0.16.0](https://github.com/vector-im/riot-web/releases/tag/v0.16.0) (2018-07-30)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.0-rc.2...v0.16.0)

* Update react-sdk version for bugfixes with Jitsi widgets and the new composer

Changes in [0.16.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.16.0-rc.2) (2018-07-24)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.16.0-rc.1...v0.16.0-rc.2)

 * Update to react-sdk rc.2 to remove Jitsi conference calling from labs

Changes in [0.16.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.16.0-rc.1) (2018-07-24)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.7...v0.16.0-rc.1)

 * Update from Weblate.
   [\#7082](https://github.com/vector-im/riot-web/pull/7082)
 * Sample config for jitsi integration URL
   [\#7055](https://github.com/vector-im/riot-web/pull/7055)

Changes in [0.15.7](https://github.com/vector-im/riot-web/releases/tag/v0.15.7) (2018-07-09)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.7-rc.2...v0.15.7)

 * No changes since rc.2

Changes in [0.15.7-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.15.7-rc.2) (2018-07-06)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.7-rc.1...v0.15.7-rc.2)

 * Update react-sdk and js-sdk

Changes in [0.15.7-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.15.7-rc.1) (2018-07-04)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.6...v0.15.7-rc.1)

 * add override for colour of room tile text within memberinfo (unreadable)
   [\#6889](https://github.com/vector-im/riot-web/pull/6889)

Changes in [0.15.6](https://github.com/vector-im/riot-web/releases/tag/v0.15.6) (2018-06-29)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.6-rc.2...v0.15.6)

 * Pull in bug fixes from react-sdk

Changes in [0.15.6-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.15.6-rc.2) (2018-06-22)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.6-rc.1...v0.15.6-rc.2)

 * Update to react-sdk rc.2 for fix to slash commands

Changes in [0.15.6-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.15.6-rc.1) (2018-06-21)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.5...v0.15.6-rc.1)

 * Update from Weblate.
   [\#6915](https://github.com/vector-im/riot-web/pull/6915)
 * [electron] Fix desktop app --hidden flag
   [\#6805](https://github.com/vector-im/riot-web/pull/6805)

Changes in [0.15.5](https://github.com/vector-im/riot-web/releases/tag/v0.15.5) (2018-06-12)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.5-rc.1...v0.15.5)

 * No changes since rc.1

Changes in [0.15.5-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.15.5-rc.1) (2018-06-06)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.4...v0.15.5-rc.1)

 * Update from Weblate.
   [\#6846](https://github.com/vector-im/riot-web/pull/6846)

Changes in [0.15.4](https://github.com/vector-im/riot-web/releases/tag/v0.15.4) (2018-05-25)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.4-rc.1...v0.15.4)

 * Add cookie policy link to desktop app config

Changes in [0.15.4-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.15.4-rc.1) (2018-05-24)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.3...v0.15.4-rc.1)

 * Update from Weblate.
   [\#6792](https://github.com/vector-im/riot-web/pull/6792)
 * Hide URL options for e2e blob: URL images
   [\#6765](https://github.com/vector-im/riot-web/pull/6765)
 * Fix right click menu in electron
   [\#6763](https://github.com/vector-im/riot-web/pull/6763)
 * Update to electron 2.0.1
   [\#6764](https://github.com/vector-im/riot-web/pull/6764)
 * Add instructions for changing translated strings
   [\#6528](https://github.com/vector-im/riot-web/pull/6528)

Changes in [0.15.3](https://github.com/vector-im/riot-web/releases/tag/v0.15.3) (2018-05-18)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.2...v0.15.3)

 * Fix right click menu in electron
   [\#6763](https://github.com/vector-im/riot-web/pull/6763)
 * Update to electron 2.0.1
   [\#6764](https://github.com/vector-im/riot-web/pull/6764)
 * Hide URL options for e2e blob: URL images
   [\#6765](https://github.com/vector-im/riot-web/pull/6765)

Changes in [0.15.2](https://github.com/vector-im/riot-web/releases/tag/v0.15.2) (2018-05-17)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.1...v0.15.2)

 * Update to matrix-react-sdk v0.12.5 to fix image size jumps

Changes in [0.15.1](https://github.com/vector-im/riot-web/releases/tag/v0.15.1) (2018-05-16)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0...v0.15.1)

 * Fix package-lock.json which was causing errors building the Electron app
 * Update Electron version

Changes in [0.15.0](https://github.com/vector-im/riot-web/releases/tag/v0.15.0) (2018-05-16)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0-rc.6...v0.15.0)

 * No changes since rc.6

Changes in [0.15.0-rc.6](https://github.com/vector-im/riot-web/releases/tag/v0.15.0-rc.6) (2018-05-15)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0-rc.5...v0.15.0-rc.6)

 * Update to matrix-react-sdk 0.12.4-rc.6

Changes in [0.15.0-rc.5](https://github.com/vector-im/riot-web/releases/tag/v0.15.0-rc.5) (2018-05-15)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0-rc.4...v0.15.0-rc.5)

 * Update to matrix-react-sdk 0.12.4-rc.5

Changes in [0.15.0-rc.4](https://github.com/vector-im/riot-web/releases/tag/v0.15.0-rc.4) (2018-05-14)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0-rc.3...v0.15.0-rc.4)

 * Update from Weblate.
   [\#6726](https://github.com/vector-im/riot-web/pull/6726)
 * Update to matrix-react-sdk 0.12.4-rc.4

Changes in [0.15.0-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.15.0-rc.3) (2018-05-11)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0-rc.2...v0.15.0-rc.3)

 * Update to matrix-react-sdk 0.12.4-rc.3

Changes in [0.15.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.15.0-rc.2) (2018-05-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.15.0-rc.1...v0.15.0-rc.2)

 * Update to matrix-react-sdk 0.12.4-rc.2

Changes in [0.15.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.15.0-rc.1) (2018-05-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.3-rc.1...v0.15.0-rc.1)

 * No changes since 0.14.3-rc.1

Changes in [0.14.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.14.3-rc.1) (2018-05-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.2...v0.14.3-rc.1)

 * Update from Weblate.
   [\#6688](https://github.com/vector-im/riot-web/pull/6688)
 * Don't show presence on matrix.org
   [\#6638](https://github.com/vector-im/riot-web/pull/6638)
 * Enforce loading babel-polyfill first
   [\#6625](https://github.com/vector-im/riot-web/pull/6625)
 * Update hoek
   [\#6624](https://github.com/vector-im/riot-web/pull/6624)
 * Fix args in the release wrapper script
   [\#6614](https://github.com/vector-im/riot-web/pull/6614)

Changes in [0.14.2](https://github.com/vector-im/riot-web/releases/tag/v0.14.2) (2018-04-30)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.2-rc.3...v0.14.2)

 * No changes since rc.3

Changes in [0.14.2-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.14.2-rc.3) (2018-04-26)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.2-rc.2...v0.14.2-rc.3)

 * Fix CSS dependency versions to be the same as those in react-sdk to fix
   left panel header positions.

Changes in [0.14.2-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.14.2-rc.2) (2018-04-26)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.2-rc.1...v0.14.2-rc.2)

 * Fix Download of attachments in e2e encrypted rooms in Firefox

Changes in [0.14.2-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.14.2-rc.1) (2018-04-25)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.1...v0.14.2-rc.1)

 * Update from Weblate.
   [\#6602](https://github.com/vector-im/riot-web/pull/6602)
 * Add readme bit on cross-origin renderer
   [\#6600](https://github.com/vector-im/riot-web/pull/6600)
 * Update from Weblate.
   [\#6573](https://github.com/vector-im/riot-web/pull/6573)
 * Copy media from react-sdk
   [\#6588](https://github.com/vector-im/riot-web/pull/6588)
 * Fix favicon
   [\#6580](https://github.com/vector-im/riot-web/pull/6580)
 * Update from Weblate.
   [\#6569](https://github.com/vector-im/riot-web/pull/6569)
 * move everything not explicitly riot (or status) branded into matrix-react-
   sdk
   [\#6500](https://github.com/vector-im/riot-web/pull/6500)
 * Remove presence management
   [\#5881](https://github.com/vector-im/riot-web/pull/5881)
 * change vector-web repo to riot-web in changelog
   [\#6480](https://github.com/vector-im/riot-web/pull/6480)
 * Update from Weblate.
   [\#6473](https://github.com/vector-im/riot-web/pull/6473)
 * Bump source-map-loader version to avoid bug /w inline base64 maps
   [\#6472](https://github.com/vector-im/riot-web/pull/6472)
 * Add CSS for new group admin radio button
   [\#6415](https://github.com/vector-im/riot-web/pull/6415)
 * Rxl881/sticker picker styling
   [\#6447](https://github.com/vector-im/riot-web/pull/6447)
 * Stickerpacks
   [\#6242](https://github.com/vector-im/riot-web/pull/6242)
 * Force gemini on HomePage
   [\#6368](https://github.com/vector-im/riot-web/pull/6368)
 * Rename the Riot-Web Translations Room
   [\#6348](https://github.com/vector-im/riot-web/pull/6348)
 * Add disable-presence-by-hs option to sample config
   [\#6350](https://github.com/vector-im/riot-web/pull/6350)
 * Reword the BugReportDialog.js as per @lampholder
   [\#6354](https://github.com/vector-im/riot-web/pull/6354)

Changes in [0.14.1](https://github.com/vector-im/riot-web/releases/tag/v0.14.1) (2018-04-12)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0...v0.14.1)

 * Remove presence management feature from labs
 * Fix an issue where Riot would fail to load at all if certain
   extensions were installed on Firefox
 * Fix an issue where e2e cryptography could be disabled due to
   a migration error.

Changes in [0.14.0](https://github.com/vector-im/riot-web/releases/tag/v0.14.0) (2018-04-11)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0-rc.6...v0.14.0)

 * Cosmetic changes for group UI

Changes in [0.14.0-rc.6](https://github.com/vector-im/riot-web/releases/tag/v0.14.0-rc.6) (2018-04-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0-rc.5...v0.14.0-rc.6)

 * Bump react-sdk to [rc.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.6)

Changes in [0.14.0-rc.5](https://github.com/vector-im/riot-web/releases/tag/v0.14.0-rc.5) (2018-04-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0-rc.4...v0.14.0-rc.5)

* Add CSS for new control to set group join policy

Changes in [0.14.0-rc.4](https://github.com/vector-im/riot-web/releases/tag/v0.14.0-rc.4) (2018-03-22)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0-rc.3...v0.14.0-rc.4)

 * Fix tagging rooms as direct messages

Changes in [0.14.0-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.14.0-rc.3) (2018-03-20)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0-rc.2...v0.14.0-rc.3)

 * Fix a bug where the badge on a room tile would not update
   when a room was read from a different device.

Changes in [0.14.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.14.0-rc.2) (2018-03-19)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.14.0-rc.1...v0.14.0-rc.2)

 * Take TagPanel out of labs
   [\#6347](https://github.com/vector-im/riot-web/pull/6347)
 * Add languages (czech, galician and serbian)
   [\#6343](https://github.com/vector-im/riot-web/pull/6343)

Changes in [0.14.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.14.0-rc.1) (2018-03-19)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.5...v0.14.0-rc.1)

 * Force update RoomSubList after reading a room
   [\#6342](https://github.com/vector-im/riot-web/pull/6342)
 * Ensure entire LeftPanel is faded when settings open
   [\#6340](https://github.com/vector-im/riot-web/pull/6340)
 * Update from Weblate.
   [\#6330](https://github.com/vector-im/riot-web/pull/6330)
 * Implement a simple shouldComponentUpdate for DNDRoomTile
   [\#6313](https://github.com/vector-im/riot-web/pull/6313)
 * Remove og:image with status.im URL
   [\#6317](https://github.com/vector-im/riot-web/pull/6317)
 * Add change delay warning in GroupView settings
   [\#6316](https://github.com/vector-im/riot-web/pull/6316)
 * Correctly position mx_TagPanel_clearButton
   [\#6289](https://github.com/vector-im/riot-web/pull/6289)
 * Fix gap between avatar and border
   [\#6290](https://github.com/vector-im/riot-web/pull/6290)
 * Fix bug where cannot send group invite on GroupMemberInfo phase
   [\#6303](https://github.com/vector-im/riot-web/pull/6303)
 * Fix themeing bug with Firefox where "disabled" ignored
   [\#6301](https://github.com/vector-im/riot-web/pull/6301)
 * Changes for E2E "fudge-button"
   [\#6288](https://github.com/vector-im/riot-web/pull/6288)
 * Make sure mx_TagPanel_tagTileContainer occupies full height
   [\#6286](https://github.com/vector-im/riot-web/pull/6286)
 * Add transparent CSS class for RoomTile
   [\#6281](https://github.com/vector-im/riot-web/pull/6281)
 * Fix crash; fs event received /w langauge file empty
   [\#6273](https://github.com/vector-im/riot-web/pull/6273)
 * Add setting to disable TagPanel
   [\#6269](https://github.com/vector-im/riot-web/pull/6269)
 * CSS for my groups microcopy
   [\#6257](https://github.com/vector-im/riot-web/pull/6257)
 * Add Bulgarian to the list of languages
   [\#6246](https://github.com/vector-im/riot-web/pull/6246)
 * Make media dropdown wider
   [\#6245](https://github.com/vector-im/riot-web/pull/6245)
 * Make dropdowns with long options degrade more gracefully
   [\#6244](https://github.com/vector-im/riot-web/pull/6244)
 * Fix un-tinted "View Community" icon in TagTile context menu
   [\#6223](https://github.com/vector-im/riot-web/pull/6223)
 * Fix RoomDropTarget and emptySubListTip to have containers
   [\#6160](https://github.com/vector-im/riot-web/pull/6160)
 * Fix syntax error of wrong use of self-closing HTML tag
   [\#6154](https://github.com/vector-im/riot-web/pull/6154)
 * Use translucent black for RoomSubList bg to fix tinting
   [\#6227](https://github.com/vector-im/riot-web/pull/6227)
 * CSS for changing "R" to "X" for clearing group filter
   [\#6216](https://github.com/vector-im/riot-web/pull/6216)
 * CSS for new global TagPanel filter
   [\#6187](https://github.com/vector-im/riot-web/pull/6187)
 * Separate the middle panel from the room list
   [\#6194](https://github.com/vector-im/riot-web/pull/6194)
 * Only use DNDRoomTile for editable sub lists
   [\#6176](https://github.com/vector-im/riot-web/pull/6176)
 * Adjust CSS to prevent scrollbars on message panel spinner
   [\#6131](https://github.com/vector-im/riot-web/pull/6131)
 * Implement riot-web side of dragging GroupTile avatars to TagPanel
   [\#6143](https://github.com/vector-im/riot-web/pull/6143)
 * Fix LeftPanel size being incorrect when TagPanel disabled
   [\#6140](https://github.com/vector-im/riot-web/pull/6140)
 * Fix TagPanel from collapsing to < 60px when LP collapsed
   [\#6134](https://github.com/vector-im/riot-web/pull/6134)
 * Temporary hack to constrain LLP container size.
   [\#6138](https://github.com/vector-im/riot-web/pull/6138)
 * Fix typo
   [\#6137](https://github.com/vector-im/riot-web/pull/6137)
 * Add context menu to TagPanel
   [\#6127](https://github.com/vector-im/riot-web/pull/6127)
 * Make room tagging flux-y
   [\#6096](https://github.com/vector-im/riot-web/pull/6096)
 * Move groups button to TagPanel
   [\#6130](https://github.com/vector-im/riot-web/pull/6130)
 * Fix long group name pushing settings cog into void
   [\#6106](https://github.com/vector-im/riot-web/pull/6106)
 * Fix horizontal scrollbar under certain circumstances
   [\#6103](https://github.com/vector-im/riot-web/pull/6103)
 * Split MImageBody into MFileBody to match JS Classes.
   [\#6067](https://github.com/vector-im/riot-web/pull/6067)
 * Add Catalan
   [\#6040](https://github.com/vector-im/riot-web/pull/6040)
 * Update from Weblate.
   [\#5777](https://github.com/vector-im/riot-web/pull/5777)
 * make FilteredList controlled, such that it can externally persist filter
   [\#5718](https://github.com/vector-im/riot-web/pull/5718)
 * Linear Rich Quoting
   [\#6017](https://github.com/vector-im/riot-web/pull/6017)
 * Highlight ViewSource and Devtools ViewSource
   [\#5995](https://github.com/vector-im/riot-web/pull/5995)
 * default url, not domain
   [\#6022](https://github.com/vector-im/riot-web/pull/6022)
 * T3chguy/num members tooltip
   [\#5929](https://github.com/vector-im/riot-web/pull/5929)
 * Swap RoomList to react-beautiful-dnd
   [\#6008](https://github.com/vector-im/riot-web/pull/6008)
 * CSS required as part of moving TagPanel from react-dnd to react-beautiful-
   dnd
   [\#5992](https://github.com/vector-im/riot-web/pull/5992)
 * fix&refactor DateSeparator and MessageTimestamp
   [\#5984](https://github.com/vector-im/riot-web/pull/5984)
 * Iterative fixes on Rich Quoting
   [\#5978](https://github.com/vector-im/riot-web/pull/5978)
 * move piwik whitelists to conf and add piwik config.json info to readme
   [\#5653](https://github.com/vector-im/riot-web/pull/5653)
 * Implement Rich Quoting/Replies
   [\#5804](https://github.com/vector-im/riot-web/pull/5804)
 * Change author
   [\#5950](https://github.com/vector-im/riot-web/pull/5950)
 * Revert "Add a &nbsp; after timestamp"
   [\#5944](https://github.com/vector-im/riot-web/pull/5944)
 * Add a &nbsp; after timestamp
   [\#3046](https://github.com/vector-im/riot-web/pull/3046)
 * Corrected language name
   [\#5938](https://github.com/vector-im/riot-web/pull/5938)
 * Hide Options button from copy to clipboard
   [\#2892](https://github.com/vector-im/riot-web/pull/2892)
 * Fix for `If riot is narrow enough, such that 'Send a message (unecrypted)'
   wraps to a second line, the timeline doesn't fit the window.`
   [\#5900](https://github.com/vector-im/riot-web/pull/5900)
 * Screenshot UI
   [\#5849](https://github.com/vector-im/riot-web/pull/5849)
 * add missing config.json entry such that scalar-staging widgets work
   [\#5855](https://github.com/vector-im/riot-web/pull/5855)
 * add dark theme styling to devtools input box
   [\#5610](https://github.com/vector-im/riot-web/pull/5610)
 * Fixes #1953 by adding oivoodoo as author
   [\#5851](https://github.com/vector-im/riot-web/pull/5851)
 * Instructions on security issues
   [\#5824](https://github.com/vector-im/riot-web/pull/5824)
 * Move DND wrapper to top level component
   [\#5790](https://github.com/vector-im/riot-web/pull/5790)
 * Widget title bar max / min visual cues.
   [\#5786](https://github.com/vector-im/riot-web/pull/5786)
 * Implement renumeration of ordered tags upon collision
   [\#5759](https://github.com/vector-im/riot-web/pull/5759)
 * Update imports for accessing KeyCode
   [\#5751](https://github.com/vector-im/riot-web/pull/5751)
 * Set html lang attribute from language setting
   [\#5685](https://github.com/vector-im/riot-web/pull/5685)
 * CSS for new TagPanel
   [\#5723](https://github.com/vector-im/riot-web/pull/5723)
 * getGroupStore no longer needs a matrix client
   [\#5707](https://github.com/vector-im/riot-web/pull/5707)
 * CSS required for moving group publication toggles to UserSettings
   [\#5702](https://github.com/vector-im/riot-web/pull/5702)
 * Make sure the SettingsStore is ready to load the theme before loading it
   [\#5630](https://github.com/vector-im/riot-web/pull/5630)
 * Add some aria-labels to RightPanel
   [\#5661](https://github.com/vector-im/riot-web/pull/5661)
 * Use badge count format for member count in RightPanel
   [\#5657](https://github.com/vector-im/riot-web/pull/5657)
 * Exclude the default language on page load
   [\#5640](https://github.com/vector-im/riot-web/pull/5640)
 * Use SettingsStore to get the default theme
   [\#5615](https://github.com/vector-im/riot-web/pull/5615)
 * Refactor translations
   [\#5613](https://github.com/vector-im/riot-web/pull/5613)
 * TintableSvgButton styling
   [\#5605](https://github.com/vector-im/riot-web/pull/5605)
 * Granular settings
   [\#5468](https://github.com/vector-im/riot-web/pull/5468)
 * CSS/components for custom presence controls
   [\#5286](https://github.com/vector-im/riot-web/pull/5286)
 * Set widget tile background colour
   [\#5574](https://github.com/vector-im/riot-web/pull/5574)
 * Widget styling tweaks
   [\#5573](https://github.com/vector-im/riot-web/pull/5573)
 * Center mixed content warnings in panel.
   [\#5567](https://github.com/vector-im/riot-web/pull/5567)
 * Status.im theme
   [\#5578](https://github.com/vector-im/riot-web/pull/5578)

Changes in [0.13.5](https://github.com/vector-im/riot-web/releases/tag/v0.13.5) (2018-02-09)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.4...v0.13.5)

 * SECURITY UPDATE: Sanitise URLs from 'external_url'. Thanks to walle303 for contacting
   us about this vulnerability.

Changes in [0.13.4](https://github.com/vector-im/riot-web/releases/tag/v0.13.4) (2018-01-03)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.3...v0.13.4)

 * Change config of riot.im electron build to fix some widgets not working. This only affects
   electron builds using the riot.im config - for all other builds, this is identical to
   v0.13.3.

Changes in [0.13.3](https://github.com/vector-im/riot-web/releases/tag/v0.13.3) (2017-12-04)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.2...v0.13.3)

 * Bump js-sdk, react-sdk version to pull in fix for [setting room publicity in a group](https://github.com/matrix-org/matrix-js-sdk/commit/aa3201ebb0fff5af2fb733080aa65ed1f7213de6).

Changes in [0.13.2](https://github.com/vector-im/riot-web/releases/tag/v0.13.2) (2017-11-28)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.1...v0.13.2)


Changes in [0.13.1](https://github.com/vector-im/riot-web/releases/tag/v0.13.1) (2017-11-17)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.0...v0.13.1)

 * SECURITY UPDATE: Fix the force TURN option for inbound calls. This option forced the use
   of TURN but only worked for outbound calls and not inbound calls. This means that if you
   enabled this option expecting it to mask your IP address in calls, your IP would still
   have been revealed to the room if you accepted an incoming call.
 * Also adds the Slovak translation.

Changes in [0.13.0](https://github.com/vector-im/riot-web/releases/tag/v0.13.0) (2017-11-15)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.0-rc.3...v0.13.0)


Changes in [0.13.0-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.13.0-rc.3) (2017-11-14)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.0-rc.2...v0.13.0-rc.3)


Changes in [0.13.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.13.0-rc.2) (2017-11-10)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.13.0-rc.1...v0.13.0-rc.2)

 * Make groups a fully-fleged baked-in feature
   [\#5566](https://github.com/vector-im/riot-web/pull/5566)

Changes in [0.13.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.13.0-rc.1) (2017-11-10)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.7...v0.13.0-rc.1)

 * Fix app tile margins.
   [\#5561](https://github.com/vector-im/riot-web/pull/5561)
 * Fix wrapping of long room topics (and overlap with apps)
   [\#5549](https://github.com/vector-im/riot-web/pull/5549)
 * Don't display widget iframes whilst loading.
   [\#5555](https://github.com/vector-im/riot-web/pull/5555)
 * Update from Weblate.
   [\#5558](https://github.com/vector-im/riot-web/pull/5558)
 * Adjust CSS for GroupView
   [\#5543](https://github.com/vector-im/riot-web/pull/5543)
 * CSS for adding rooms to a group with visibility
   [\#5546](https://github.com/vector-im/riot-web/pull/5546)
 * CSS for pinned indicators
   [\#5511](https://github.com/vector-im/riot-web/pull/5511)
 * Implement general-purpose tooltip "(?)"-style
   [\#5540](https://github.com/vector-im/riot-web/pull/5540)
 * CSS for improving group creation UX, namely setting long description
   [\#5535](https://github.com/vector-im/riot-web/pull/5535)
 * CSS for room notif pills in composer
   [\#5531](https://github.com/vector-im/riot-web/pull/5531)
 * Do not init a group store when no groupId specified
   [\#5520](https://github.com/vector-im/riot-web/pull/5520)
 * CSS for new pinned events indicator
   [\#5293](https://github.com/vector-im/riot-web/pull/5293)
 * T3chguy/devtools 1
   [\#5471](https://github.com/vector-im/riot-web/pull/5471)
 * Use margin to separate "perms" in the room directory
   [\#5498](https://github.com/vector-im/riot-web/pull/5498)
 * Add CSS for CreateGroupDialog to give group ID input suffix and prefix style
   [\#5505](https://github.com/vector-im/riot-web/pull/5505)
 * Fix group invites such that they look similar to room invites
   [\#5504](https://github.com/vector-im/riot-web/pull/5504)
 * CSS for Your Communities scrollbar
   [\#5501](https://github.com/vector-im/riot-web/pull/5501)
 * Add toggle to alter visibility of room-group association
   [\#5497](https://github.com/vector-im/riot-web/pull/5497)
 * CSS for room notification pills
   [\#5494](https://github.com/vector-im/riot-web/pull/5494)
 * Implement simple GroupRoomInfo
   [\#5493](https://github.com/vector-im/riot-web/pull/5493)
 * Add back bottom border to widget title bar
   [\#5458](https://github.com/vector-im/riot-web/pull/5458)
 * Prevent group name looking clickable for non-members
   [\#5478](https://github.com/vector-im/riot-web/pull/5478)
 * Fix instanceof check, was checking against the Package rather than class
   [\#5472](https://github.com/vector-im/riot-web/pull/5472)
 * Use correct group store state when rendering "Invite to this community"
   [\#5455](https://github.com/vector-im/riot-web/pull/5455)
 * Leverages ES6 in Notifications
   [\#5453](https://github.com/vector-im/riot-web/pull/5453)
 * Re-PR #4412
   [\#5437](https://github.com/vector-im/riot-web/pull/5437)
 * fix comma error of features example
   [\#5410](https://github.com/vector-im/riot-web/pull/5410)
 * Devtools: make filtering case-insensitive
   [\#5387](https://github.com/vector-im/riot-web/pull/5387)
 * Highlight group members icon in group member info
   [\#5432](https://github.com/vector-im/riot-web/pull/5432)
 * Use CSS to stop greyed Right/LeftPanel UI from being interactable
   [\#5422](https://github.com/vector-im/riot-web/pull/5422)
 * CSS for preventing editing of UI requiring user privilege if user
   unprivileged
   [\#5417](https://github.com/vector-im/riot-web/pull/5417)
 * Only show UI for adding rooms/users to groups to privileged users
   [\#5409](https://github.com/vector-im/riot-web/pull/5409)
 * Only show "Invite to this community" when viewing group members
   [\#5407](https://github.com/vector-im/riot-web/pull/5407)
 * Add trash can icon for delete widget
   [\#5397](https://github.com/vector-im/riot-web/pull/5397)
 * CSS to improve MyGroups in general, and add placeholder
   [\#5375](https://github.com/vector-im/riot-web/pull/5375)
 * Rxl881/parallelshell
   [\#4881](https://github.com/vector-im/riot-web/pull/4881)
 * Custom server text was i18ned by key
   [\#5371](https://github.com/vector-im/riot-web/pull/5371)
 * Run prunei18n
   [\#5370](https://github.com/vector-im/riot-web/pull/5370)
 * Update from Weblate.
   [\#5369](https://github.com/vector-im/riot-web/pull/5369)
 * Add script to prune unused translations
   [\#5339](https://github.com/vector-im/riot-web/pull/5339)
 * CSS for improved MyGroups page
   [\#5360](https://github.com/vector-im/riot-web/pull/5360)
 * Add padding-right to Dialogs
   [\#5346](https://github.com/vector-im/riot-web/pull/5346)
 * Add div.warning and use the scss var
   [\#5344](https://github.com/vector-im/riot-web/pull/5344)
 * Groups->Communities
   [\#5343](https://github.com/vector-im/riot-web/pull/5343)
 * Make the 'add rooms' button clickable
   [\#5342](https://github.com/vector-im/riot-web/pull/5342)
 * Switch to gen-i18n script
   [\#5338](https://github.com/vector-im/riot-web/pull/5338)
 * Use _t as _t
   [\#5334](https://github.com/vector-im/riot-web/pull/5334)
 * fix groupview header editing visuals (pt 1)
   [\#5330](https://github.com/vector-im/riot-web/pull/5330)
 * bump version to prevent eslint errors
   [\#5316](https://github.com/vector-im/riot-web/pull/5316)
 * CSS for invited group members section
   [\#5303](https://github.com/vector-im/riot-web/pull/5303)
 * Handle long names in EntityTiles by overflowing correctly
   [\#5302](https://github.com/vector-im/riot-web/pull/5302)
 * Disable labs in electron
   [\#5296](https://github.com/vector-im/riot-web/pull/5296)
 * CSS for Modifying GroupView UI matrix-org/matrix-react-sdk#1475
   [\#5295](https://github.com/vector-im/riot-web/pull/5295)
 * Message/event pinning
   [\#5142](https://github.com/vector-im/riot-web/pull/5142)
 * Sorting of networks within a protocol based on name
   [\#4054](https://github.com/vector-im/riot-web/pull/4054)
 * allow hiding of notification body for privacy reasons
   [\#4988](https://github.com/vector-im/riot-web/pull/4988)
 * Don't use MXIDs on the lightbox if possible
   [\#5281](https://github.com/vector-im/riot-web/pull/5281)
 * CSS for lonely room message
   [\#5267](https://github.com/vector-im/riot-web/pull/5267)
 * Bring back dark theme code block border
   [\#5037](https://github.com/vector-im/riot-web/pull/5037)
 * CSS for remove avatar buttons
   [\#5282](https://github.com/vector-im/riot-web/pull/5282)

Changes in [0.12.7](https://github.com/vector-im/riot-web/releases/tag/v0.12.7) (2017-10-16)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.7-rc.3...v0.12.7)

 * Released versions of react-sdk & js-sdk

Changes in [0.12.7-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.12.7-rc.3) (2017-10-13)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.7-rc.2...v0.12.7-rc.3)

 * Hide the join group button
   [\#5275](https://github.com/vector-im/riot-web/pull/5275)

Changes in [0.12.7-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.12.7-rc.2) (2017-10-13)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.7-rc.1...v0.12.7-rc.2)


Changes in [0.12.7-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.12.7-rc.1) (2017-10-13)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.6...v0.12.7-rc.1)

 * switch to new logos, and use import rather than VAR
   [\#5203](https://github.com/vector-im/riot-web/pull/5203)
 * Clarify what an integrations server is
   [\#5266](https://github.com/vector-im/riot-web/pull/5266)
 * Update from Weblate.
   [\#5269](https://github.com/vector-im/riot-web/pull/5269)
 * Remove trailing comma in JSON
   [\#5167](https://github.com/vector-im/riot-web/pull/5167)
 * Added default_federate property
   [\#3849](https://github.com/vector-im/riot-web/pull/3849)
 * CSS for greying out login form
   [\#5197](https://github.com/vector-im/riot-web/pull/5197)
 * Fix bug that made sub list placeholders not show for ILAG etc.
   [\#5164](https://github.com/vector-im/riot-web/pull/5164)
 * Factor out EditableItemList component from AliasSettings
   [\#5161](https://github.com/vector-im/riot-web/pull/5161)
 * Mark and remove some translations
   [\#5110](https://github.com/vector-im/riot-web/pull/5110)
 * CSS for "remove" button on GroupRoomTile
   [\#5141](https://github.com/vector-im/riot-web/pull/5141)
 * Create basic icon for the GroupRoomList tab and adding rooms to groups
   [\#5140](https://github.com/vector-im/riot-web/pull/5140)
 * Add button to get to MyGroups
   [\#5131](https://github.com/vector-im/riot-web/pull/5131)
 * Remove `key` prop pass-thru on HeaderButton
   [\#5137](https://github.com/vector-im/riot-web/pull/5137)
 * Implement "Add room to group" feature
   [\#5125](https://github.com/vector-im/riot-web/pull/5125)
 * Add Jitsi screensharing support in electron app
   [\#4967](https://github.com/vector-im/riot-web/pull/4967)
 * Refactor right panel header buttons
   [\#5117](https://github.com/vector-im/riot-web/pull/5117)
 * CSS for publicity status & toggle button
   [\#5104](https://github.com/vector-im/riot-web/pull/5104)
 * CSS for "X" in top right of features users/rooms
   [\#5103](https://github.com/vector-im/riot-web/pull/5103)
 * Include Finnish translation
   [\#5051](https://github.com/vector-im/riot-web/pull/5051)
 * Redesign membership section of GroupView
   [\#5096](https://github.com/vector-im/riot-web/pull/5096)
 * Make --config accept globs
   [\#5090](https://github.com/vector-im/riot-web/pull/5090)
 * CSS for GroupView: Add a User
   [\#5093](https://github.com/vector-im/riot-web/pull/5093)
 * T3chguy/devtools 1
   [\#5074](https://github.com/vector-im/riot-web/pull/5074)
 * Alter opacity for flair
   [\#5085](https://github.com/vector-im/riot-web/pull/5085)
 * Fix ugly integ button
   [\#5082](https://github.com/vector-im/riot-web/pull/5082)
 * Group Membership UI
   [\#4830](https://github.com/vector-im/riot-web/pull/4830)

Changes in [0.12.6](https://github.com/vector-im/riot-web/releases/tag/v0.12.6) (2017-09-21)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.5...v0.12.6)

 * Use matrix-js-sdk v0.8.4 to fix build

Changes in [0.12.5](https://github.com/vector-im/riot-web/releases/tag/v0.12.5) (2017-09-21)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.4...v0.12.5)

 * Use react-sdk v0.10.5 to fix build

Changes in [0.12.4](https://github.com/vector-im/riot-web/releases/tag/v0.12.4) (2017-09-20)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.4-rc.1...v0.12.4)

 * No changes

Changes in [0.12.4-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.12.4-rc.1) (2017-09-19)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.3...v0.12.4-rc.1)

 * Fix test for new behaviour of 'joining' flag
   [\#5053](https://github.com/vector-im/riot-web/pull/5053)
 * fix really dumb blunder/typo preventing system from going to sleep.
   [\#5080](https://github.com/vector-im/riot-web/pull/5080)
 * T3chguy/devtools
   [\#4735](https://github.com/vector-im/riot-web/pull/4735)
 * CSS for unignore button in UserSettings
   [\#5042](https://github.com/vector-im/riot-web/pull/5042)
 * Fix alias on home page for identity room
   [\#5044](https://github.com/vector-im/riot-web/pull/5044)
 * generic contextual menu for tooltip/responses
   [\#4989](https://github.com/vector-im/riot-web/pull/4989)
 * Update from Weblate.
   [\#5018](https://github.com/vector-im/riot-web/pull/5018)
 * Avoid re-rendering RoomList on room switch
   [\#5015](https://github.com/vector-im/riot-web/pull/5015)
 * Fix menu on change keyboard language issue #4345
   [\#4623](https://github.com/vector-im/riot-web/pull/4623)
 * Make isInvite default to false
   [\#4999](https://github.com/vector-im/riot-web/pull/4999)
 * Revert "Implement sticky date separators"
   [\#4991](https://github.com/vector-im/riot-web/pull/4991)
 * Implement sticky date separators
   [\#4939](https://github.com/vector-im/riot-web/pull/4939)

Changes in [0.12.3](https://github.com/vector-im/riot-web/releases/tag/v0.12.3) (2017-09-06)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.3-rc.3...v0.12.3)

 * No changes

Changes in [0.12.3-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.12.3-rc.3) (2017-09-05)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.3-rc.2...v0.12.3-rc.3)

 * Fix plurals in translations
   [\#4971](https://github.com/vector-im/riot-web/pull/4971)
 * Update from Weblate.
   [\#4968](https://github.com/vector-im/riot-web/pull/4968)

Changes in [0.12.3-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.12.3-rc.2) (2017-09-05)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.3-rc.1...v0.12.3-rc.2)

 * New react-sdk version to pull in new translations and fix some translation bugs.


Changes in [0.12.3-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.12.3-rc.1) (2017-09-01)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.2...v0.12.3-rc.1)

 * Fix overflowing login/register buttons on some languages issue #4804
   [\#4858](https://github.com/vector-im/riot-web/pull/4858)
 * Update vector-im to riot-im on Login
   [\#4943](https://github.com/vector-im/riot-web/pull/4943)
 * lets let people know that the bug report actually sent properly :)
   [\#4910](https://github.com/vector-im/riot-web/pull/4910)
 * another s/vector/riot/ in README
   [\#4934](https://github.com/vector-im/riot-web/pull/4934)
 * fix two room list regressions
   [\#4907](https://github.com/vector-im/riot-web/pull/4907)

Changes in [0.12.2](https://github.com/vector-im/riot-web/releases/tag/v0.12.2) (2017-08-24)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.1...v0.12.2)

 * Update react-sdk and js-sdk to fix bugs with incoming calls, messages and notifications
   in encrypted rooms.

Changes in [0.12.1](https://github.com/vector-im/riot-web/releases/tag/v0.12.1) (2017-08-23)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.1-rc.1...v0.12.1)

 * [No changes]

Changes in [0.12.1-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.12.1-rc.1) (2017-08-22)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.12.0-rc.2...v0.12.1-rc.1)

 * Update from Weblate.
   [\#4832](https://github.com/vector-im/riot-web/pull/4832)
 * Misc styling fixes.
   [\#4826](https://github.com/vector-im/riot-web/pull/4826)
 * Show / Hide apps icons
   [\#4774](https://github.com/vector-im/riot-web/pull/4774)

Changes in [0.12.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.12.0-rc.1) (2017-08-16)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.4...v0.12.0-rc.1)

 * Update from Weblate.
   [\#4797](https://github.com/vector-im/riot-web/pull/4797)
 * move focus-via-up/down cursors to LeftPanel
   [\#4777](https://github.com/vector-im/riot-web/pull/4777)
 * Remove userId property on RightPanel
   [\#4775](https://github.com/vector-im/riot-web/pull/4775)
 * Make member device info buttons fluid and stackable with flexbox
   [\#4776](https://github.com/vector-im/riot-web/pull/4776)
 * un-i18n Modal Analytics
   [\#4688](https://github.com/vector-im/riot-web/pull/4688)
 * Quote using innerText
   [\#4773](https://github.com/vector-im/riot-web/pull/4773)
 * Karma tweaks for riot-web
   [\#4765](https://github.com/vector-im/riot-web/pull/4765)
 * Fix typo with scripts/fetch-develop-deps.sh in Building From Source
   [\#4764](https://github.com/vector-im/riot-web/pull/4764)
 * Adjust CSS for optional avatars in pills
   [\#4757](https://github.com/vector-im/riot-web/pull/4757)
 * Fix crypto on develop
   [\#4754](https://github.com/vector-im/riot-web/pull/4754)
 * Fix signing key url in readme
   [\#4464](https://github.com/vector-im/riot-web/pull/4464)
 * update gitignore to allow .idea directory to exist in subdirs
   [\#4749](https://github.com/vector-im/riot-web/pull/4749)
 * tweak compact theme
   [\#4665](https://github.com/vector-im/riot-web/pull/4665)
 * Update draft-js from 0.10.1 to 0.11.0-alpha
   [\#4740](https://github.com/vector-im/riot-web/pull/4740)
 * electron support for mouse forward/back buttons in Windows
   [\#4739](https://github.com/vector-im/riot-web/pull/4739)
 * Update draft-js from 0.8.1 to 0.10.1
   [\#4730](https://github.com/vector-im/riot-web/pull/4730)
 * Make pills, emoji translucent when sending
   [\#4693](https://github.com/vector-im/riot-web/pull/4693)
 * Widget permissions styling and icon
   [\#4690](https://github.com/vector-im/riot-web/pull/4690)
 * CSS required for composer autoscroll
   [\#4682](https://github.com/vector-im/riot-web/pull/4682)
 * CSS for group edit UI
   [\#4608](https://github.com/vector-im/riot-web/pull/4608)
 * Fix a couple of minor errors in the room list
   [\#4671](https://github.com/vector-im/riot-web/pull/4671)
 * Styling for beta testing icon.
   [\#4584](https://github.com/vector-im/riot-web/pull/4584)
 * Increase the timeout for clearing indexeddbs
   [\#4650](https://github.com/vector-im/riot-web/pull/4650)
 * Make some adjustments to mx_UserPill and mx_RoomPill
   [\#4597](https://github.com/vector-im/riot-web/pull/4597)
 * Apply CSS to <pre> tags to distinguish them from each other
   [\#4639](https://github.com/vector-im/riot-web/pull/4639)
 * Use `catch` instead of `fail` to handle room tag error
   [\#4643](https://github.com/vector-im/riot-web/pull/4643)
 * CSS for decorated matrix.to links in the composer
   [\#4583](https://github.com/vector-im/riot-web/pull/4583)
 * Deflake the joining test
   [\#4579](https://github.com/vector-im/riot-web/pull/4579)
 * Bump react to 15.6 to fix build problems
   [\#4577](https://github.com/vector-im/riot-web/pull/4577)
 * Improve AppTile menu bar button styling.
   [\#4567](https://github.com/vector-im/riot-web/pull/4567)
 * Transform `async` functions to bluebird promises
   [\#4572](https://github.com/vector-im/riot-web/pull/4572)
 * use flushAllExpected in joining test
   [\#4570](https://github.com/vector-im/riot-web/pull/4570)
 * Switch riot-web to bluebird
   [\#4565](https://github.com/vector-im/riot-web/pull/4565)
 * loading tests: wait for login component
   [\#4564](https://github.com/vector-im/riot-web/pull/4564)
 * Remove CSS for the MessageComposerInputOld
   [\#4568](https://github.com/vector-im/riot-web/pull/4568)
 * Implement the focus_room_filter action
   [\#4560](https://github.com/vector-im/riot-web/pull/4560)
 * CSS for Rooms in Group View
   [\#4530](https://github.com/vector-im/riot-web/pull/4530)
 * more HomePage tweaks
   [\#4557](https://github.com/vector-im/riot-web/pull/4557)
 * Give HomePage an unmounted guard
   [\#4556](https://github.com/vector-im/riot-web/pull/4556)
 * Take RTE out of labs
   [\#4500](https://github.com/vector-im/riot-web/pull/4500)
 * CSS for Groups page
   [\#4468](https://github.com/vector-im/riot-web/pull/4468)
 * CSS for GroupView
   [\#4442](https://github.com/vector-im/riot-web/pull/4442)
 * remove unused class
   [\#4525](https://github.com/vector-im/riot-web/pull/4525)
 * Fix long words causing MessageComposer to widen
   [\#4466](https://github.com/vector-im/riot-web/pull/4466)
 * Add visual bell animation for RTE
   [\#4516](https://github.com/vector-im/riot-web/pull/4516)
 * Truncate auto-complete pills properly
   [\#4502](https://github.com/vector-im/riot-web/pull/4502)
 * Use chrome headless instead of phantomjs
   [\#4512](https://github.com/vector-im/riot-web/pull/4512)
 * Use external mock-request
   [\#4489](https://github.com/vector-im/riot-web/pull/4489)
 * fix Quote not closing contextual menu
   [\#4443](https://github.com/vector-im/riot-web/pull/4443)
 * Apply white-space: pre-wrap to mx_MEmoteBody
   [\#4470](https://github.com/vector-im/riot-web/pull/4470)
 * Add some style improvements to autocompletions
   [\#4456](https://github.com/vector-im/riot-web/pull/4456)
 * Styling for apps / widgets
   [\#4447](https://github.com/vector-im/riot-web/pull/4447)
 * Attempt to flush the rageshake logs on close
   [\#4400](https://github.com/vector-im/riot-web/pull/4400)
 * Update from Weblate.
   [\#4401](https://github.com/vector-im/riot-web/pull/4401)
 * improve update polling electron and provide a manual check for updates
   button
   [\#4176](https://github.com/vector-im/riot-web/pull/4176)
 * Fix load failure in firefox when indexedDB is disabled
   [\#4395](https://github.com/vector-im/riot-web/pull/4395)
 * Change missed 'Redact' to 'Remove' in ImageView.
   [\#4362](https://github.com/vector-im/riot-web/pull/4362)
 * explicit convert to nativeImage to stabilise trayIcon on Windows [Electron]
   [\#4355](https://github.com/vector-im/riot-web/pull/4355)
 * Use _tJsx for PasswordNagBar (because it has <u>)
   [\#4373](https://github.com/vector-im/riot-web/pull/4373)
 * Clean up some log outputs from the integ tests
   [\#4376](https://github.com/vector-im/riot-web/pull/4376)
 * CSS for redeisng of password warning
   [\#4367](https://github.com/vector-im/riot-web/pull/4367)
 * Give _t to PasswordNagBar, add CSS for UserSettings password warning
   [\#4366](https://github.com/vector-im/riot-web/pull/4366)
 * Update from Weblate.
   [\#4361](https://github.com/vector-im/riot-web/pull/4361)
 * Update from Weblate.
   [\#4360](https://github.com/vector-im/riot-web/pull/4360)
 * Test 'return-to-app' functionality
   [\#4352](https://github.com/vector-im/riot-web/pull/4352)
 * Update from Weblate.
   [\#4354](https://github.com/vector-im/riot-web/pull/4354)
 * onLoadCompleted is now onTokenLoginCompleted
   [\#4335](https://github.com/vector-im/riot-web/pull/4335)
 * Tweak tests to match updates to matrixchat
   [\#4325](https://github.com/vector-im/riot-web/pull/4325)
 * Update from Weblate.
   [\#4346](https://github.com/vector-im/riot-web/pull/4346)
 * change dispatcher forward_event signature
   [\#4337](https://github.com/vector-im/riot-web/pull/4337)
 * Add border on hover for code blocks
   [\#4259](https://github.com/vector-im/riot-web/pull/4259)

Changes in [0.11.4](https://github.com/vector-im/riot-web/releases/tag/v0.11.4) (2017-06-22)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.3...v0.11.4)

 * Update matrix-js-sdk and react-sdk to fix a regression where the
   background indexedb worker was disabled, failures to open indexeddb
   causing the app to fail to start, a race when starting that could break
   switching to rooms, and the inability to invite users with mixed case
   usernames.

Changes in [0.11.3](https://github.com/vector-im/riot-web/releases/tag/v0.11.3) (2017-06-20)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.2...v0.11.3)

 * Update to matrix-react-sdk 0.9.6 to fix infinite spinner bugs
   and some parts of the app that had missed translation.

Changes in [0.11.2](https://github.com/vector-im/riot-web/releases/tag/v0.11.2) (2017-06-19)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.2-rc.2...v0.11.2)

 * Add more languages and translations
 * Add a 'register' button

Changes in [0.11.2-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.11.2-rc.2) (2017-06-16)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.2-rc.1...v0.11.2-rc.2)

 * Update react-sdk to pull in fixes for URL previews, CAS
   login, h2 in markdown and CAPTCHA forms.
 * Enable Korean translation
 * Update from Weblate.
   [\#4323](https://github.com/vector-im/riot-web/pull/4323)
 * Fix h2 in markdown being weird
   [\#4332](https://github.com/vector-im/riot-web/pull/4332)

Changes in [0.11.2-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.11.2-rc.1) (2017-06-15)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.1...v0.11.2-rc.1)

 * Attempts to deflakify the joining test
   [\#4313](https://github.com/vector-im/riot-web/pull/4313)
 * Add a test for the login flow when there is a teamserver
   [\#4315](https://github.com/vector-im/riot-web/pull/4315)
 * Remove onload simulator from loading test
   [\#4314](https://github.com/vector-im/riot-web/pull/4314)
 * Update from Weblate.
   [\#4305](https://github.com/vector-im/riot-web/pull/4305)
 * Test that we handle stored mx_last_room_id correctly
   [\#4292](https://github.com/vector-im/riot-web/pull/4292)
 * Ask for email address after setting password for the first time
   [\#4301](https://github.com/vector-im/riot-web/pull/4301)
 * i18n for setting email after password flow
   [\#4299](https://github.com/vector-im/riot-web/pull/4299)
 * Update from Weblate.
   [\#4290](https://github.com/vector-im/riot-web/pull/4290)
 * Don't show the tooltips when filtering rooms
   [\#4282](https://github.com/vector-im/riot-web/pull/4282)
 * Update from Weblate.
   [\#4272](https://github.com/vector-im/riot-web/pull/4272)
 * Add missing VOIP Dropdown width
   [\#4266](https://github.com/vector-im/riot-web/pull/4266)
 * Update import and directory path in the Translations dev guide
   [\#4261](https://github.com/vector-im/riot-web/pull/4261)
 * Use Thai string for Thai in Language-Chooser
   [\#4260](https://github.com/vector-im/riot-web/pull/4260)

Changes in [0.11.1](https://github.com/vector-im/riot-web/releases/tag/v0.11.1) (2017-06-14)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.0...v0.11.1)

 * Update to react-sdk 0.9.4 to prompt to set an
   email address when setting a password and make
   DM guessing smarter.

Changes in [0.11.0](https://github.com/vector-im/riot-web/releases/tag/v0.11.0) (2017-06-12)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.0-rc.2...v0.11.0)

 * More translations & minor fixes

Changes in [0.11.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.11.0-rc.2) (2017-06-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.11.0-rc.1...v0.11.0-rc.2)

 * Update to matrix-react-sdk rc.2 which fixes the flux
   dependency version and an issue with the conference
   call bar translation.


Changes in [0.11.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.11.0-rc.1) (2017-06-09)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.10.2...v0.11.0-rc.1)

 * Update from Weblate.
   [\#4258](https://github.com/vector-im/riot-web/pull/4258)
 * Update from Weblate.
   [\#4254](https://github.com/vector-im/riot-web/pull/4254)
 * Update from Weblate.
   [\#4253](https://github.com/vector-im/riot-web/pull/4253)
 * Expect to see HTTP /join/#some:alias when we the view knows it
   [\#4252](https://github.com/vector-im/riot-web/pull/4252)
 * Update from Weblate.
   [\#4250](https://github.com/vector-im/riot-web/pull/4250)
 * add explicit import to utf8 polyfill and rip out unused imports
   [\#4169](https://github.com/vector-im/riot-web/pull/4169)
 * Added styling for copy to clipboard button
   [\#4204](https://github.com/vector-im/riot-web/pull/4204)
 * Update from Weblate.
   [\#4231](https://github.com/vector-im/riot-web/pull/4231)
 * Update from Weblate.
   [\#4218](https://github.com/vector-im/riot-web/pull/4218)
 * Update CSS for ChatInviteDialog
   [\#4226](https://github.com/vector-im/riot-web/pull/4226)
 * change electron -> electron_app which was previously missed
   [\#4212](https://github.com/vector-im/riot-web/pull/4212)
 * New guest access
   [\#4039](https://github.com/vector-im/riot-web/pull/4039)
 * Align message timestamp centrally about the avatar mid-point
   [\#4219](https://github.com/vector-im/riot-web/pull/4219)
 * Remove '/' from homepage URL
   [\#4221](https://github.com/vector-im/riot-web/pull/4221)
 * Chop off 'origin/'
   [\#4220](https://github.com/vector-im/riot-web/pull/4220)
 * Update from Weblate.
   [\#4214](https://github.com/vector-im/riot-web/pull/4214)
 * adjust alignment of message menu button in compact layout
   [\#4211](https://github.com/vector-im/riot-web/pull/4211)
 * Update from Weblate.
   [\#4207](https://github.com/vector-im/riot-web/pull/4207)
 * Fix Tests in ILAG
   [\#4209](https://github.com/vector-im/riot-web/pull/4209)
 * Update from Weblate.
   [\#4197](https://github.com/vector-im/riot-web/pull/4197)
 * Fix tests for new-guest-access
   [\#4201](https://github.com/vector-im/riot-web/pull/4201)
 * i18n for SetPasswordDialog
   [\#4198](https://github.com/vector-im/riot-web/pull/4198)
 * Update from Weblate.
   [\#4193](https://github.com/vector-im/riot-web/pull/4193)
 * to make the windows volume mixer not explode as it can't resize icons.
   [\#4183](https://github.com/vector-im/riot-web/pull/4183)
 * provide react devtools in electron dev runs
   [\#4186](https://github.com/vector-im/riot-web/pull/4186)
 * Fix DeprecationWarning
   [\#4184](https://github.com/vector-im/riot-web/pull/4184)
 * room link should be a matrix.to one
   [\#4178](https://github.com/vector-im/riot-web/pull/4178)
 * Update home.html
   [\#4163](https://github.com/vector-im/riot-web/pull/4163)
 * Add missing translation for room directory
   [\#4160](https://github.com/vector-im/riot-web/pull/4160)
 * i18n welcome
   [\#4129](https://github.com/vector-im/riot-web/pull/4129)
 * Tom welcome page
   [\#4038](https://github.com/vector-im/riot-web/pull/4038)
 * Fix some tests that expect Directory (they should expect HomePage)
   [\#4076](https://github.com/vector-im/riot-web/pull/4076)
 * Add "Login" button to RHS when user is a guest
   [\#4037](https://github.com/vector-im/riot-web/pull/4037)
 * Rejig the PaswordNagBar
   [\#4026](https://github.com/vector-im/riot-web/pull/4026)
 * Allow team server config to be missing
   [\#4024](https://github.com/vector-im/riot-web/pull/4024)
 * Remove GuestWarningBar
   [\#4020](https://github.com/vector-im/riot-web/pull/4020)
 * Make left panel better for new users (mk III)
   [\#4023](https://github.com/vector-im/riot-web/pull/4023)
 * Implement default welcome page and allow custom URL /w config
   [\#4015](https://github.com/vector-im/riot-web/pull/4015)
 * Add warm-fuzzy for successful password entry
   [\#3989](https://github.com/vector-im/riot-web/pull/3989)
 * autoFocus new password input in SetPasswordDialog
   [\#3982](https://github.com/vector-im/riot-web/pull/3982)
 * Implement dialog to set password
   [\#3921](https://github.com/vector-im/riot-web/pull/3921)
 * Replace NeedToRegister with SetMxId dialog
   [\#3924](https://github.com/vector-im/riot-web/pull/3924)
 * Add welcomeUserId to sample config
   [\#3906](https://github.com/vector-im/riot-web/pull/3906)
 * CSS for mxIdDialog redesign
   [\#3885](https://github.com/vector-im/riot-web/pull/3885)
 * Implement PasswordNagBar
   [\#3817](https://github.com/vector-im/riot-web/pull/3817)
 * CSS for new SetMxIdDialog
   [\#3762](https://github.com/vector-im/riot-web/pull/3762)

Changes in [0.10.2](https://github.com/vector-im/riot-web/releases/tag/v0.10.2) (2017-06-06)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.10.1...v0.10.2)

 * Hotfix for bugs where navigating straight to a URL like /#/login and
   and /#/forgot_password


Changes in [0.10.1](https://github.com/vector-im/riot-web/releases/tag/v0.10.1) (2017-06-02)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.10.0...v0.10.1)

 * Update to matrix-react-sdk 0.9.1 to fix i18n error which broke start chat in some circumstances

Changes in [0.10.0](https://github.com/vector-im/riot-web/releases/tag/v0.10.0) (2017-06-02)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.10.0-rc.2...v0.10.0)

 * Update from Weblate.
   [\#4152](https://github.com/vector-im/riot-web/pull/4152)

Changes in [0.10.0-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.10.0-rc.2) (2017-06-02)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.10.0-rc.1...v0.10.0-rc.2)

 * Update from Weblate.
   [\#4150](https://github.com/vector-im/riot-web/pull/4150)
 * styling for webrtc settings
   [\#4019](https://github.com/vector-im/riot-web/pull/4019)
 * Update from Weblate.
   [\#4140](https://github.com/vector-im/riot-web/pull/4140)
 * add styles for compact layout
   [\#4132](https://github.com/vector-im/riot-web/pull/4132)
 * Various tweaks to fetch-develop-deps
   [\#4147](https://github.com/vector-im/riot-web/pull/4147)
 * Don't try to build with node 6.0
   [\#4145](https://github.com/vector-im/riot-web/pull/4145)
 * Support 12hr time on DateSeparator
   [\#4143](https://github.com/vector-im/riot-web/pull/4143)
 * Update from Weblate.
   [\#4137](https://github.com/vector-im/riot-web/pull/4137)
 * Update from Weblate.
   [\#4105](https://github.com/vector-im/riot-web/pull/4105)
 * Update from Weblate.
   [\#4094](https://github.com/vector-im/riot-web/pull/4094)
 * Update from Weblate.
   [\#4091](https://github.com/vector-im/riot-web/pull/4091)
 * Update from Weblate.
   [\#4089](https://github.com/vector-im/riot-web/pull/4089)
 * Update from Weblate.
   [\#4083](https://github.com/vector-im/riot-web/pull/4083)

Changes in [0.10.0-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.10.0-rc.1) (2017-06-01)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.10...v0.10.0-rc.1)

 * basic electron profile support
   [\#4030](https://github.com/vector-im/riot-web/pull/4030)
 * Finish translations for vector-im/riot-web
   [\#4122](https://github.com/vector-im/riot-web/pull/4122)
 * Translate src/vector
   [\#4119](https://github.com/vector-im/riot-web/pull/4119)
 * electron flashFrame was way too annoying
   [\#4128](https://github.com/vector-im/riot-web/pull/4128)
 * auto-launch support [Electron]
   [\#4012](https://github.com/vector-im/riot-web/pull/4012)
 * Show 12hr time on hover too
   [\#4092](https://github.com/vector-im/riot-web/pull/4092)
 * Translate src/notifications
   [\#4087](https://github.com/vector-im/riot-web/pull/4087)
 * Translate src/components/structures
   [\#4084](https://github.com/vector-im/riot-web/pull/4084)
 * Smaller font size on timestamp to better fit in the available space
   [\#4085](https://github.com/vector-im/riot-web/pull/4085)
 * Make travis run the build with several versions of node
   [\#4079](https://github.com/vector-im/riot-web/pull/4079)
 * Piwik Analytics
   [\#4056](https://github.com/vector-im/riot-web/pull/4056)
 * Update from Weblate.
   [\#4077](https://github.com/vector-im/riot-web/pull/4077)
 * managed to eat the eventStatus check, can't redact a local-echo etc
   [\#4078](https://github.com/vector-im/riot-web/pull/4078)
 * show redact in context menu only if has PL to/sent message
   [\#3925](https://github.com/vector-im/riot-web/pull/3925)
 * Update from Weblate.
   [\#4064](https://github.com/vector-im/riot-web/pull/4064)
 * Change redact -> remove to improve clarity
   [\#3722](https://github.com/vector-im/riot-web/pull/3722)
 * Update from Weblate.
   [\#4058](https://github.com/vector-im/riot-web/pull/4058)
 * Message Forwarding
   [\#3688](https://github.com/vector-im/riot-web/pull/3688)
 * Update from Weblate.
   [\#4057](https://github.com/vector-im/riot-web/pull/4057)
 * Fixed an input field's background color in dark theme
   [\#4053](https://github.com/vector-im/riot-web/pull/4053)
 * Update from Weblate.
   [\#4051](https://github.com/vector-im/riot-web/pull/4051)
 * Update from Weblate.
   [\#4049](https://github.com/vector-im/riot-web/pull/4049)
 * Update from Weblate.
   [\#4048](https://github.com/vector-im/riot-web/pull/4048)
 * Update from Weblate.
   [\#4040](https://github.com/vector-im/riot-web/pull/4040)
 * Update translating.md: Minor suggestions
   [\#4041](https://github.com/vector-im/riot-web/pull/4041)
 * tidy electron files, they weren't pwetty
   [\#3993](https://github.com/vector-im/riot-web/pull/3993)
 * Prevent Power Save when in call (Electron)
   [\#3992](https://github.com/vector-im/riot-web/pull/3992)
 * Translations!
   [\#4035](https://github.com/vector-im/riot-web/pull/4035)
 * Kieran gould/12hourtimestamp
   [\#3961](https://github.com/vector-im/riot-web/pull/3961)
 * Don't include src in the test resolve root
   [\#4033](https://github.com/vector-im/riot-web/pull/4033)
 * add moar context menus [Electron]
   [\#4021](https://github.com/vector-im/riot-web/pull/4021)
 * Add `Chat` to Linux app categories
   [\#4022](https://github.com/vector-im/riot-web/pull/4022)
 * add menu category for linux build of app
   [\#3975](https://github.com/vector-im/riot-web/pull/3975)
 * Electron Tray Improvements
   [\#3909](https://github.com/vector-im/riot-web/pull/3909)
 * More riot-web test deflakification
   [\#3966](https://github.com/vector-im/riot-web/pull/3966)
 * Script to fetch corresponding branches of dependent projects
   [\#3945](https://github.com/vector-im/riot-web/pull/3945)
 * Add type="text/css" to SVG logos
   [\#3964](https://github.com/vector-im/riot-web/pull/3964)
 * Fix some setState-after-unmount in roomdirectory
   [\#3958](https://github.com/vector-im/riot-web/pull/3958)
 * Attempt to deflakify joining test
   [\#3956](https://github.com/vector-im/riot-web/pull/3956)

Changes in [0.9.10](https://github.com/vector-im/riot-web/releases/tag/v0.9.10) (2017-05-22)
============================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.10-rc.1...v0.9.10)

 * No changes


Changes in [0.9.10-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.10-rc.1) (2017-05-19)
======================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.9...v0.9.10-rc.1)

 * CSS for left_aligned Dropdowns, and adjustments for Country dd in Login
   [\#3959](https://github.com/vector-im/riot-web/pull/3959)
 * Add square flag pngs /w genflags.sh script
   [\#3953](https://github.com/vector-im/riot-web/pull/3953)
 * Add config for riot-bot on desktop app build
   [\#3954](https://github.com/vector-im/riot-web/pull/3954)
 * Desktop: 'copy link address'
   [\#3952](https://github.com/vector-im/riot-web/pull/3952)
 * Reduce rageshake log size to 1MB
   [\#3943](https://github.com/vector-im/riot-web/pull/3943)
 * CSS for putting country dd on same line as phone input
   [\#3942](https://github.com/vector-im/riot-web/pull/3942)
 * fix #3894
   [\#3919](https://github.com/vector-im/riot-web/pull/3919)
 * change vector->riot on the surface
   [\#3894](https://github.com/vector-im/riot-web/pull/3894)
 * move manifest.json outward so it is scoped properly
   [\#3888](https://github.com/vector-im/riot-web/pull/3888)
 * add to manifest
   [\#3799](https://github.com/vector-im/riot-web/pull/3799)
 * Automatically update component-index
   [\#3886](https://github.com/vector-im/riot-web/pull/3886)
 * move electron -> electron_app because npm smart
   [\#3877](https://github.com/vector-im/riot-web/pull/3877)
 * Fix bug report endpoint in config.sample.json.
   [\#3863](https://github.com/vector-im/riot-web/pull/3863)
 * Update 2 missed icons to the new icon
   [\#3851](https://github.com/vector-im/riot-web/pull/3851)
 * Make left panel better for new users (mk II)
   [\#3804](https://github.com/vector-im/riot-web/pull/3804)
 * match primary package.json
   [\#3839](https://github.com/vector-im/riot-web/pull/3839)
 * Re-add productName
   [\#3829](https://github.com/vector-im/riot-web/pull/3829)
 * Remove leading v in /version file, for SemVer and to match Electron ver
   [\#3683](https://github.com/vector-im/riot-web/pull/3683)
 * Fix scope of callback
   [\#3790](https://github.com/vector-im/riot-web/pull/3790)
 * Remember and Recall window layout/position state
   [\#3622](https://github.com/vector-im/riot-web/pull/3622)
 * Remove babelcheck
   [\#3808](https://github.com/vector-im/riot-web/pull/3808)
 * Include MXID and device id in rageshakes
   [\#3809](https://github.com/vector-im/riot-web/pull/3809)
 * import Modal
   [\#3791](https://github.com/vector-im/riot-web/pull/3791)
 * Pin filesize ver to fix break upstream
   [\#3775](https://github.com/vector-im/riot-web/pull/3775)
 * Improve Room Directory Look & Feel
   [\#3751](https://github.com/vector-im/riot-web/pull/3751)
 * Fix emote RRs alignment
   [\#3742](https://github.com/vector-im/riot-web/pull/3742)
 * Remove unused `placeholder` prop on RoomDropTarget
   [\#3741](https://github.com/vector-im/riot-web/pull/3741)
 * Modify CSS for matrix-org/matrix-react-sdk#833
   [\#3732](https://github.com/vector-im/riot-web/pull/3732)
 * Warn when exiting due to single-instance
   [\#3727](https://github.com/vector-im/riot-web/pull/3727)
 * Electron forgets it was maximized when you click on a notification
   [\#3709](https://github.com/vector-im/riot-web/pull/3709)
 * CSS to make h1 and h2 the same size as h1.
   [\#3719](https://github.com/vector-im/riot-web/pull/3719)
 * Prevent long room names/topics from pushing UI of the screen
   [\#3721](https://github.com/vector-im/riot-web/pull/3721)
 * Disable dropdown highlight on focus
   [\#3717](https://github.com/vector-im/riot-web/pull/3717)
 * Escape HTML Tags from Linux Notifications (electron)
   [\#3564](https://github.com/vector-im/riot-web/pull/3564)
 * styling for spoilerized access token view in Settings
   [\#3651](https://github.com/vector-im/riot-web/pull/3651)
 * Fix Webpack conf
   [\#3690](https://github.com/vector-im/riot-web/pull/3690)
 * Add config.json to .gitignore
   [\#3599](https://github.com/vector-im/riot-web/pull/3599)
 * add command line arg (--hidden) for electron app
   [\#3641](https://github.com/vector-im/riot-web/pull/3641)
 * fix ImageView Download functionality
   [\#3640](https://github.com/vector-im/riot-web/pull/3640)
 * Add cross-env into the mix
   [\#3693](https://github.com/vector-im/riot-web/pull/3693)
 * Remember acceptance for unsupported browsers.
   [\#3694](https://github.com/vector-im/riot-web/pull/3694)
 * Cosmetics to go with matrix-org/matrix-react-sdk#811
   [\#3692](https://github.com/vector-im/riot-web/pull/3692)
 * Cancel quicksearch on ESC
   [\#3680](https://github.com/vector-im/riot-web/pull/3680)
 * Optimise RoomList and implement quick-search functionality on it.
   [\#3654](https://github.com/vector-im/riot-web/pull/3654)
 * Progress updates for rageshake uploads
   [\#3648](https://github.com/vector-im/riot-web/pull/3648)
 * Factor out rageshake upload to a separate file
   [\#3645](https://github.com/vector-im/riot-web/pull/3645)
 * rageshake: fix race when collecting logs
   [\#3644](https://github.com/vector-im/riot-web/pull/3644)
 * Fix a flaky test
   [\#3649](https://github.com/vector-im/riot-web/pull/3649)

Changes in [0.9.9](https://github.com/vector-im/riot-web/releases/tag/v0.9.9) (2017-04-25)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.9-rc.2...v0.9.9)

 * No changes


Changes in [0.9.9-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.9.9-rc.2) (2017-04-24)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.9-rc.1...v0.9.9-rc.2)

 * Fix bug where links to Riot would fail to open.


Changes in [0.9.9-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.9-rc.1) (2017-04-21)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.8...v0.9.9-rc.1)

 * Update js-sdk and matrix-react-sdk to fix registration without a captcha (https://github.com/vector-im/riot-web/issues/3621)


Changes in [0.9.8](https://github.com/vector-im/riot-web/releases/tag/v0.9.8) (2017-04-12)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.8-rc.3...v0.9.8)

 * No changes

Changes in [0.9.8-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.9.8-rc.3) (2017-04-11)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.8-rc.2...v0.9.8-rc.3)

 * Make the clear cache button work on desktop
   [\#3598](https://github.com/vector-im/riot-web/pull/3598)

Changes in [0.9.8-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.9.8-rc.2) (2017-04-10)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.8-rc.1...v0.9.8-rc.2)

 * Redacted events bg: black lozenge -> torn paper
   [\#3596](https://github.com/vector-im/riot-web/pull/3596)
 * Add 'app' parameter to rageshake report
   [\#3594](https://github.com/vector-im/riot-web/pull/3594)

Changes in [0.9.8-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.8-rc.1) (2017-04-07)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.7...v0.9.8-rc.1)

 * Add support for indexeddb sync in webworker
   [\#3578](https://github.com/vector-im/riot-web/pull/3578)
 * Add CSS to make Emote sender cursor : pointer
   [\#3574](https://github.com/vector-im/riot-web/pull/3574)
 * Remove rageshake server
   [\#3565](https://github.com/vector-im/riot-web/pull/3565)
 * Adjust CSS for matrix-org/matrix-react-sdk#789
   [\#3566](https://github.com/vector-im/riot-web/pull/3566)
 * Fix tests to reflect recent changes
   [\#3537](https://github.com/vector-im/riot-web/pull/3537)
 * Do not assume getTs will return comparable integer
   [\#3536](https://github.com/vector-im/riot-web/pull/3536)
 * Rename ReactPerf to Perf
   [\#3535](https://github.com/vector-im/riot-web/pull/3535)
 * Don't show phone number as target for email notifs
   [\#3530](https://github.com/vector-im/riot-web/pull/3530)
 * Fix people section again
   [\#3458](https://github.com/vector-im/riot-web/pull/3458)
 * dark theme invert inconsistent across browsers
   [\#3479](https://github.com/vector-im/riot-web/pull/3479)
 * CSS for adding phone number in UserSettings
   [\#3451](https://github.com/vector-im/riot-web/pull/3451)
 * Support for phone number registration/signin, mk2
   [\#3426](https://github.com/vector-im/riot-web/pull/3426)
 * Confirm redactions with a dialog
   [\#3470](https://github.com/vector-im/riot-web/pull/3470)
 * Better CSS for redactions
   [\#3453](https://github.com/vector-im/riot-web/pull/3453)
 * Fix the people section
   [\#3448](https://github.com/vector-im/riot-web/pull/3448)
 * Merge the two RoomTile context menus into one
   [\#3395](https://github.com/vector-im/riot-web/pull/3395)
 * Refactor screen set after login
   [\#3385](https://github.com/vector-im/riot-web/pull/3385)
 * CSS for redacted EventTiles
   [\#3379](https://github.com/vector-im/riot-web/pull/3379)
 * Height:100% for welcome pages on Safari
   [\#3340](https://github.com/vector-im/riot-web/pull/3340)
 * `view_room` dispatch from `onClick` RoomTile
   [\#3376](https://github.com/vector-im/riot-web/pull/3376)
 * Hide statusAreaBox_line entirely when inCall
   [\#3350](https://github.com/vector-im/riot-web/pull/3350)
 * Set padding-bottom: 0px for .mx_Dialog spinner
   [\#3351](https://github.com/vector-im/riot-web/pull/3351)
 * Support InteractiveAuth based registration
   [\#3333](https://github.com/vector-im/riot-web/pull/3333)
 * Expose notification option for username/MXID
   [\#3334](https://github.com/vector-im/riot-web/pull/3334)
 * Float the toggle in the top right of MELS
   [\#3190](https://github.com/vector-im/riot-web/pull/3190)
 * More aggressive rageshake log culling
   [\#3311](https://github.com/vector-im/riot-web/pull/3311)
 * Don't overflow directory network options
   [\#3282](https://github.com/vector-im/riot-web/pull/3282)
 * CSS for ban / kick reason prompt
   [\#3250](https://github.com/vector-im/riot-web/pull/3250)
 * Allow forgetting rooms you're banned from
   [\#3246](https://github.com/vector-im/riot-web/pull/3246)
 * Fix icon paths in manifest
   [\#3245](https://github.com/vector-im/riot-web/pull/3245)
 * Fix broken tests caused by adding IndexedDB support
   [\#3242](https://github.com/vector-im/riot-web/pull/3242)
 * CSS for un-ban button in RoomSettings
   [\#3227](https://github.com/vector-im/riot-web/pull/3227)
 * Remove z-index property on avatar initials
   [\#3239](https://github.com/vector-im/riot-web/pull/3239)
 * Reposition certain icons in the status bar
   [\#3233](https://github.com/vector-im/riot-web/pull/3233)
 * CSS for kick/ban confirmation dialog
   [\#3224](https://github.com/vector-im/riot-web/pull/3224)
 * Style for split-out interactive auth
   [\#3217](https://github.com/vector-im/riot-web/pull/3217)
 * Use the teamToken threaded through from react sdk
   [\#3196](https://github.com/vector-im/riot-web/pull/3196)
 * rageshake: Add file server with basic auth
   [\#3169](https://github.com/vector-im/riot-web/pull/3169)
 * Fix bug with home icon not appearing when logged in as team member
   [\#3162](https://github.com/vector-im/riot-web/pull/3162)
 * Add ISSUE_TEMPLATE
   [\#2836](https://github.com/vector-im/riot-web/pull/2836)
 * Store bug reports in separate directories
   [\#3150](https://github.com/vector-im/riot-web/pull/3150)
 * Quick and dirty support for custom welcome pages.
   [\#2575](https://github.com/vector-im/riot-web/pull/2575)
 * RTS Welcome Pages
   [\#3103](https://github.com/vector-im/riot-web/pull/3103)
 * rageshake: Abide by Go standards
   [\#3149](https://github.com/vector-im/riot-web/pull/3149)
 * Bug report server script
   [\#3072](https://github.com/vector-im/riot-web/pull/3072)
 * Bump olm version
   [\#3125](https://github.com/vector-im/riot-web/pull/3125)

Changes in [0.9.7](https://github.com/vector-im/riot-web/releases/tag/v0.9.7) (2017-02-04)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.7-rc.3...v0.9.7)

 * Update to matrix-js-sdk 0.7.5 (no changes from 0.7.5-rc.3)
 * Update to matrix-react-sdk 0.8.6 (no changes from 0.8.6-rc.3)

Changes in [0.9.7-rc.3](https://github.com/vector-im/riot-web/releases/tag/v0.9.7-rc.3) (2017-02-03)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.7-rc.2...v0.9.7-rc.3)
 * Update to latest Olm to fix key import/export and use of megolm sessions
   created on more recent versions
 * Update to latest matrix-react-sdk and matrix-js-sdk to fix e2e device
   handling

Changes in [0.9.7-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.9.7-rc.2) (2017-02-03)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.7-rc.1...v0.9.7-rc.2)

 * Update matrix-js-sdk to get new device change
   notifications interface for more reliable e2e crypto

Changes in [0.9.7-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.7-rc.1) (2017-02-03)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.6...v0.9.7-rc.1)

 * Better user interface for screen readers and keyboard navigation
   [\#2946](https://github.com/vector-im/riot-web/pull/2946)
 * Allow mxc: URLs for icons in the NetworkDropdown
   [\#3118](https://github.com/vector-im/riot-web/pull/3118)
 * make TopRightMenu more intuitive
   [\#3117](https://github.com/vector-im/riot-web/pull/3117)
 * Handle icons with width > height
   [\#3110](https://github.com/vector-im/riot-web/pull/3110)
 * Fix jenkins build
   [\#3105](https://github.com/vector-im/riot-web/pull/3105)
 * Add CSS for a support box in login
   [\#3081](https://github.com/vector-im/riot-web/pull/3081)
 * Allow a custom login logo to be displayed on login
   [\#3082](https://github.com/vector-im/riot-web/pull/3082)
 * Fix the width of input fields within login/reg box
   [\#3080](https://github.com/vector-im/riot-web/pull/3080)
 * Set BaseAvatar_image bg colour = #fff
   [\#3057](https://github.com/vector-im/riot-web/pull/3057)
 * only recalculate favicon if it changes
   [\#3067](https://github.com/vector-im/riot-web/pull/3067)
 * CSS tweak for email address lookup
   [\#3064](https://github.com/vector-im/riot-web/pull/3064)
 * Glue the dialog to rageshake: honour sendLogs flag.
   [\#3061](https://github.com/vector-im/riot-web/pull/3061)
 * Don't use hash-named directory for dev server
   [\#3049](https://github.com/vector-im/riot-web/pull/3049)
 * Implement bug reporting logic
   [\#3000](https://github.com/vector-im/riot-web/pull/3000)
 * Add css for bug report dialog
   [\#3045](https://github.com/vector-im/riot-web/pull/3045)
 * Increase the max-height of the expanded status bar
   [\#3043](https://github.com/vector-im/riot-web/pull/3043)
 * Hopefully, fix intermittent test failure
   [\#3040](https://github.com/vector-im/riot-web/pull/3040)
 * CSS for 'searching known users'
   [\#2971](https://github.com/vector-im/riot-web/pull/2971)
 * Animate status bar max-height and margin-top
   [\#2981](https://github.com/vector-im/riot-web/pull/2981)
 * Add eslint config
   [\#3032](https://github.com/vector-im/riot-web/pull/3032)
 * Re-position typing avatars relative to "is typing"
   [\#3030](https://github.com/vector-im/riot-web/pull/3030)
 * CSS for avatars that appear when users are typing
   [\#2998](https://github.com/vector-im/riot-web/pull/2998)
 * Add StartupWMClass
   [\#3001](https://github.com/vector-im/riot-web/pull/3001)
 * Fix link to image for event options menu
   [\#3002](https://github.com/vector-im/riot-web/pull/3002)
 * Make riot desktop single instance
   [\#2999](https://github.com/vector-im/riot-web/pull/2999)
 * Add electron tray icon
   [\#2997](https://github.com/vector-im/riot-web/pull/2997)
 * Fixes to electron desktop notifs
   [\#2994](https://github.com/vector-im/riot-web/pull/2994)
 * Auto-hide the electron menu bar
   [\#2975](https://github.com/vector-im/riot-web/pull/2975)
 * A couple of tweaks to the karma config
   [\#2987](https://github.com/vector-im/riot-web/pull/2987)
 * Deploy script
   [\#2974](https://github.com/vector-im/riot-web/pull/2974)
 * Use the postcss-webpack-loader
   [\#2990](https://github.com/vector-im/riot-web/pull/2990)
 * Switch CSS to using postcss, and implement a dark theme.
   [\#2973](https://github.com/vector-im/riot-web/pull/2973)
 * Update redeploy script to keep old bundles
   [\#2969](https://github.com/vector-im/riot-web/pull/2969)
 * Include current version in update check explicitly
   [\#2967](https://github.com/vector-im/riot-web/pull/2967)
 * Add another layer of directory to webpack chunks
   [\#2966](https://github.com/vector-im/riot-web/pull/2966)
 * Fix links to fonts and images from CSS
   [\#2965](https://github.com/vector-im/riot-web/pull/2965)
 * Put parent build hash in webpack output filenames
   [\#2961](https://github.com/vector-im/riot-web/pull/2961)
 * update README to point to new names/locations
   [\#2846](https://github.com/vector-im/riot-web/pull/2846)

Changes in [0.9.6](https://github.com/vector-im/riot-web/releases/tag/v0.9.6) (2017-01-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.6-rc.1...v0.9.6)

 * Update to matrix-js-sdk 0.9.6 for video calling fix

Changes in [0.9.6-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.6-rc.1) (2017-01-13)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.5...v0.9.6-rc.1)

 * Build the js-sdk in the CI script
   [\#2920](https://github.com/vector-im/riot-web/pull/2920)
 * Hopefully fix Windows shortcuts
   [\#2917](https://github.com/vector-im/riot-web/pull/2917)
 * Update README now the js-sdk has a transpile step
   [\#2921](https://github.com/vector-im/riot-web/pull/2921)
 * Use the role for 'toggle dev tools'
   [\#2915](https://github.com/vector-im/riot-web/pull/2915)
 * Enable screen sharing easter-egg in desktop app
   [\#2909](https://github.com/vector-im/riot-web/pull/2909)
 * make electron send email validation URLs with a nextlink of riot.im
   [\#2808](https://github.com/vector-im/riot-web/pull/2808)
 * add Debian Stretch install steps to readme
   [\#2809](https://github.com/vector-im/riot-web/pull/2809)
 * Update desktop build instructions fixes #2792
   [\#2793](https://github.com/vector-im/riot-web/pull/2793)
 * CSS for the delete threepid button
   [\#2784](https://github.com/vector-im/riot-web/pull/2784)

Changes in [0.9.5](https://github.com/vector-im/riot-web/releases/tag/v0.9.5) (2016-12-24)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.4...v0.9.5)

 * make electron send email validation URLs with a nextlink of riot.im rather than file:///
 * add gnu-tar to debian electron build deps
 * fix win32 shortcut in start menu

Changes in [0.9.4](https://github.com/vector-im/riot-web/releases/tag/v0.9.4) (2016-12-22)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.3...v0.9.4)

 * Update to libolm 2.1.0. This should help resolve a problem with browser
   sessions being logged out ([\#2726](https://github.com/vector-im/riot-web/issues/2726)).

Changes in [0.9.3](https://github.com/vector-im/riot-web/releases/tag/v0.9.3) (2016-12-22)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.2...v0.9.3)

 * (from matrix-react-sdk) Fix regression where the date separator would be displayed
   at the wrong time of day.
 * README.md: fix GFMD for nativefier
   [\#2755](https://github.com/vector-im/riot-web/pull/2755)

Changes in [0.9.2](https://github.com/vector-im/riot-web/releases/tag/v0.9.2) (2016-12-16)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.1...v0.9.2)

 * Remove the client side filtering from the room dir
   [\#2750](https://github.com/vector-im/riot-web/pull/2750)
 * Configure olm memory size
   [\#2745](https://github.com/vector-im/riot-web/pull/2745)
 * Support room dir 3rd party network filtering
   [\#2747](https://github.com/vector-im/riot-web/pull/2747)

Changes in [0.9.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.1) (2016-12-09)
==========================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.1-rc.2...v0.9.1)

 * Update README to say how to build the desktop app
   [\#2732](https://github.com/vector-im/riot-web/pull/2732)
 * Add signing ID in release_config.yaml
   [\#2731](https://github.com/vector-im/riot-web/pull/2731)
 * Makeover!
   [\#2722](https://github.com/vector-im/riot-web/pull/2722)
 * Fix broken tests
   [\#2730](https://github.com/vector-im/riot-web/pull/2730)
 * Make the 'loading' tests work in isolation
   [\#2727](https://github.com/vector-im/riot-web/pull/2727)
 * Use a PNG for the icon on non-Windows
   [\#2708](https://github.com/vector-im/riot-web/pull/2708)
 * Add missing brackets to call to toUpperCase
   [\#2703](https://github.com/vector-im/riot-web/pull/2703)

Changes in [0.9.1-rc.2](https://github.com/vector-im/riot-web/releases/tag/v0.9.1-rc.2) (2016-12-06)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.1-rc.1...v0.9.1-rc.2)

 * Fix clicking on notifications
   [\#2700](https://github.com/vector-im/riot-web/pull/2700)
 * Desktop app: Only show window when ready
   [\#2697](https://github.com/vector-im/riot-web/pull/2697)

Changes in [0.9.1-rc.1](https://github.com/vector-im/riot-web/releases/tag/v0.9.1-rc.1) (2016-12-05)
====================================================================================================
[Full Changelog](https://github.com/vector-im/riot-web/compare/v0.9.0...v0.9.1-rc.1)

 * Final bits to prepare electron distribtion:
   [\#2653](https://github.com/vector-im/riot-web/pull/2653)
 * Update name & repo to reflect renamed repository
   [\#2692](https://github.com/vector-im/riot-web/pull/2692)
 * Document cross_origin_renderer_url
   [\#2680](https://github.com/vector-im/riot-web/pull/2680)
 * Add css for the iframes for e2e attachments
   [\#2659](https://github.com/vector-im/riot-web/pull/2659)
 * Fix config location in some more places
   [\#2670](https://github.com/vector-im/riot-web/pull/2670)
 * CSS updates for s/block/blacklist for e2e
   [\#2662](https://github.com/vector-im/riot-web/pull/2662)
 * Update to electron 1.4.8
   [\#2660](https://github.com/vector-im/riot-web/pull/2660)
 * Add electron config
   [\#2644](https://github.com/vector-im/riot-web/pull/2644)
 * Move getDefaultDeviceName into the Platforms
   [\#2643](https://github.com/vector-im/riot-web/pull/2643)
 * Add Freenode & Mozilla domains
   [\#2641](https://github.com/vector-im/riot-web/pull/2641)
 * Include config.sample.json in dist tarball
   [\#2614](https://github.com/vector-im/riot-web/pull/2614)

Changes in [0.9.0](https://github.com/vector-im/vector-web/releases/tag/v0.9.0) (2016-11-19)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.4...v0.9.0)

 * Add a cachebuster to /version
   [\#2596](https://github.com/vector-im/vector-web/pull/2596)
 * Add a 'View decrypted source' button
   [\#2587](https://github.com/vector-im/vector-web/pull/2587)
 * Fix changelog dialog to  read new version format
   [\#2577](https://github.com/vector-im/vector-web/pull/2577)
 * Build all of the vector dir in the build process
   [\#2558](https://github.com/vector-im/vector-web/pull/2558)
 * Support for get_app_version
   [\#2553](https://github.com/vector-im/vector-web/pull/2553)
 * Add CSS for mlist truncation
   [\#2565](https://github.com/vector-im/vector-web/pull/2565)
 * Add menu option for `external_url` if present
   [\#2560](https://github.com/vector-im/vector-web/pull/2560)
 * Make auto-update configureable
   [\#2555](https://github.com/vector-im/vector-web/pull/2555)
 * Missed files electron windows fixes
   [\#2556](https://github.com/vector-im/vector-web/pull/2556)
 * Add some CSS for  scalar error popup
   [\#2554](https://github.com/vector-im/vector-web/pull/2554)
 * Catch unhandled errors in the electron process
   [\#2552](https://github.com/vector-im/vector-web/pull/2552)
 * Slight grab-bag of fixes for electron on Windows
   [\#2551](https://github.com/vector-im/vector-web/pull/2551)
 * Electron app (take 3)
   [\#2535](https://github.com/vector-im/vector-web/pull/2535)
 * Use webpack-dev-server instead of http-server
   [\#2542](https://github.com/vector-im/vector-web/pull/2542)
 * Better support no-config when loading from file
   [\#2541](https://github.com/vector-im/vector-web/pull/2541)
 * Fix loading with no config from HTTP
   [\#2540](https://github.com/vector-im/vector-web/pull/2540)
 * Move 'new version' support into Platform
   [\#2532](https://github.com/vector-im/vector-web/pull/2532)
 * Add Notification support to the Web Platform
   [\#2533](https://github.com/vector-im/vector-web/pull/2533)
 * Use the defaults if given a blank config file
   [\#2534](https://github.com/vector-im/vector-web/pull/2534)
 * Implement Platforms
   [\#2531](https://github.com/vector-im/vector-web/pull/2531)

Changes in [0.8.4](https://github.com/vector-im/vector-web/releases/tag/v0.8.4) (2016-11-04)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.4-rc.2...v0.8.4)

 * No changes

Changes in [0.8.4-rc.2](https://github.com/vector-im/vector-web/releases/tag/v0.8.4-rc.2) (2016-11-02)
======================================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.4-rc.1...v0.8.4-rc.2)

 * Fix the version in the generated distribution package

Changes in [0.8.4-rc.1](https://github.com/vector-im/vector-web/releases/tag/v0.8.4-rc.1) (2016-11-02)
======================================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.3...v0.8.4-rc.1)

Breaking Changes
----------------
 * End-to-end encryption now requires one-time keys to be
   signed, so end-to-end encryption will not interoperate
   with previous releases of vector-web. End-to-end encryption
   remains in beta.

Other Changes
-------------
 * Rename the package script/output dir to 'dist'
   [\#2528](https://github.com/vector-im/vector-web/pull/2528)
 * Avoid errors if olm is missing
   [\#2518](https://github.com/vector-im/vector-web/pull/2518)
 * Put a cachebuster in the names of CSS and JS files
   [\#2515](https://github.com/vector-im/vector-web/pull/2515)
 * Bump to olm 2.0.0
   [\#2517](https://github.com/vector-im/vector-web/pull/2517)
 * Don't include the world in the published packages
   [\#2516](https://github.com/vector-im/vector-web/pull/2516)
 * Use webpack to copy olm.js
   [\#2514](https://github.com/vector-im/vector-web/pull/2514)
 * Don't include two copies of the CSS in the tarball
   [\#2513](https://github.com/vector-im/vector-web/pull/2513)
 * Correct text alignment on room directory search
   [\#2512](https://github.com/vector-im/vector-web/pull/2512)
 * Correct spelling of 'rel'
   [\#2510](https://github.com/vector-im/vector-web/pull/2510)
 * readme tweaks
   [\#2507](https://github.com/vector-im/vector-web/pull/2507)
 * s/vector/riot/ in the readme
   [\#2491](https://github.com/vector-im/vector-web/pull/2491)
 * Switch to babel 6, again
   [\#2480](https://github.com/vector-im/vector-web/pull/2480)
 * Revert "Switch to babel 6"
   [\#2472](https://github.com/vector-im/vector-web/pull/2472)
 * Switch to babel 6
   [\#2461](https://github.com/vector-im/vector-web/pull/2461)

Changes in [0.8.3](https://github.com/vector-im/vector-web/releases/tag/v0.8.3) (2016-10-12)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.2...v0.8.3)

 * Centre images in dialog buttons
   [\#2453](https://github.com/vector-im/vector-web/pull/2453)
 * Only show quote option if RTE is enabled
   [\#2448](https://github.com/vector-im/vector-web/pull/2448)
 * Fix join button for 'matrix' networks
   [\#2443](https://github.com/vector-im/vector-web/pull/2443)
 * Don't stop paginating if no rooms match
   [\#2422](https://github.com/vector-im/vector-web/pull/2422)

Changes in [0.8.2](https://github.com/vector-im/vector-web/releases/tag/v0.8.2) (2016-10-05)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.1...v0.8.2)

 * Add native joining of 3p networks to room dir
   [\#2379](https://github.com/vector-im/vector-web/pull/2379)
 * Update to linkify 2.1.3
   [\#2406](https://github.com/vector-im/vector-web/pull/2406)
 * Use 'Sign In' / 'Sign Out' universally
   [\#2383](https://github.com/vector-im/vector-web/pull/2383)
 * Prevent network dropdown resizing slightly
   [\#2382](https://github.com/vector-im/vector-web/pull/2382)
 * Room directory: indicate when there are no results
   [\#2380](https://github.com/vector-im/vector-web/pull/2380)
 * Room dir: New filtering & 3rd party networks
   [\#2362](https://github.com/vector-im/vector-web/pull/2362)
 * Update linkify version
   [\#2359](https://github.com/vector-im/vector-web/pull/2359)
 * Directory search join button
   [\#2339](https://github.com/vector-im/vector-web/pull/2339)

Changes in [0.8.1](https://github.com/vector-im/vector-web/releases/tag/v0.8.1) (2016-09-21)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.8.0...v0.8.1)


Changes in [0.8.0](https://github.com/vector-im/vector-web/releases/tag/v0.8.0) (2016-09-21)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.5-r3...v0.8.0)

 * Dbkr/rebrand
   [\#2285](https://github.com/vector-im/vector-web/pull/2285)
 * Listen for close_scalar and close the dialog box when received
   [\#2282](https://github.com/vector-im/vector-web/pull/2282)
 * Revert "improve lipstick and support scalar logout"
   [\#2281](https://github.com/vector-im/vector-web/pull/2281)
 * improve lipstick and support scalar logout
   [\#2280](https://github.com/vector-im/vector-web/pull/2280)
 * Fix changelog links
   [\#2071](https://github.com/vector-im/vector-web/pull/2071)
 * Paginate Room Directory
   [\#2241](https://github.com/vector-im/vector-web/pull/2241)
 * Make redeploy script symlink config
   [\#2240](https://github.com/vector-im/vector-web/pull/2240)
 * Update the version of olm to 1.3.0
   [\#2210](https://github.com/vector-im/vector-web/pull/2210)
 * Directory network selector
   [\#2219](https://github.com/vector-im/vector-web/pull/2219)
 * Wmwragg/two state sublist headers
   [\#2235](https://github.com/vector-im/vector-web/pull/2235)
 * Wmwragg/correct incoming call positioning
   [\#2222](https://github.com/vector-im/vector-web/pull/2222)
 * Wmwragg/remove old filter
   [\#2211](https://github.com/vector-im/vector-web/pull/2211)
 * Wmwragg/multi invite bugfix
   [\#2198](https://github.com/vector-im/vector-web/pull/2198)
 * Wmwragg/chat multi invite
   [\#2181](https://github.com/vector-im/vector-web/pull/2181)
 * shuffle bottomleftmenu around a bit
   [\#2182](https://github.com/vector-im/vector-web/pull/2182)
 * Improve autocomplete behaviour (styling)
   [\#2175](https://github.com/vector-im/vector-web/pull/2175)
 * First wave of E2E visuals
   [\#2163](https://github.com/vector-im/vector-web/pull/2163)
 * FilePanel and NotificationPanel support
   [\#2113](https://github.com/vector-im/vector-web/pull/2113)
 * Cursor: pointer on member info create room button
   [\#2151](https://github.com/vector-im/vector-web/pull/2151)
 * Support for adding DM rooms to the MemberInfo Panel
   [\#2147](https://github.com/vector-im/vector-web/pull/2147)
 * Wmwragg/one to one indicators
   [\#2139](https://github.com/vector-im/vector-web/pull/2139)
 * Added back the Directory listing button, with new tootlip
   [\#2136](https://github.com/vector-im/vector-web/pull/2136)
 * wmwragg/chat invite dialog fix
   [\#2134](https://github.com/vector-im/vector-web/pull/2134)
 * Wmwragg/one to one chat
   [\#2110](https://github.com/vector-im/vector-web/pull/2110)
 * Support toggling DM status of rooms
   [\#2111](https://github.com/vector-im/vector-web/pull/2111)
 * Formatting toolbar for RTE message composer.
   [\#2082](https://github.com/vector-im/vector-web/pull/2082)
 * jenkins.sh: install olm from jenkins artifacts
   [\#2092](https://github.com/vector-im/vector-web/pull/2092)
 * e2e device CSS
   [\#2085](https://github.com/vector-im/vector-web/pull/2085)
 * Bump to olm 1.1.0
   [\#2069](https://github.com/vector-im/vector-web/pull/2069)
 * Improve readability of the changelog dialog
   [\#2056](https://github.com/vector-im/vector-web/pull/2056)
 * Turn react consistency checks back on in develop builds
   [\#2009](https://github.com/vector-im/vector-web/pull/2009)
 * Wmwragg/direct chat sublist
   [\#2028](https://github.com/vector-im/vector-web/pull/2028)

Changes in [0.7.5-r3](https://github.com/vector-im/vector-web/releases/tag/v0.7.5-r3) (2016-09-02)
==================================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.5-r2...v0.7.5-r3)

 * Bump to matrix-react-sdk 0.6.5-r3 in order to fix bug #2020 (tightloop when flooded with join events)


Changes in [0.7.5-r2](https://github.com/vector-im/vector-web/releases/tag/v0.7.5-r2) (2016-09-01)
==================================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.5-r1...v0.7.5-r2)

 * Bump to matrix-react-sdk 0.6.5-r1 in order to fix guest access

Changes in [0.7.5-r1](https://github.com/vector-im/vector-web/releases/tag/v0.7.5-r1) (2016-08-28)
==================================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.5...v0.7.5-r1)

 * Correctly pin deps :(

Changes in [0.7.5](https://github.com/vector-im/vector-web/releases/tag/v0.7.5) (2016-08-28)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.4-r1...v0.7.5)

 * re-add leave button in RoomSettings
 * add /user URLs
 * recognise matrix.to links and other vector links
 * fix linkify dependency
 * fix avatar clicking in MemberInfo
 * fix RoomTagContextMenu so it works on historical rooms
 * warn people to put their Matrix HS on a separate domain to Vector
 * fix zalgos again
 * Add .travis.yml
   [\#2007](https://github.com/vector-im/vector-web/pull/2007)
 * add fancy changelog dialog
   [\#1972](https://github.com/vector-im/vector-web/pull/1972)
 * Update autocomplete design
   [\#1978](https://github.com/vector-im/vector-web/pull/1978)
 * Update encryption info in README
   [\#2001](https://github.com/vector-im/vector-web/pull/2001)
 * Added event/info message avatars back in
   [\#2000](https://github.com/vector-im/vector-web/pull/2000)
 * Wmwragg/chat message presentation
   [\#1987](https://github.com/vector-im/vector-web/pull/1987)
 * Make the notification slider work
   [\#1982](https://github.com/vector-im/vector-web/pull/1982)
 * Use cpx to copy olm.js, and add watcher
   [\#1966](https://github.com/vector-im/vector-web/pull/1966)
 * Make up a device display name
   [\#1959](https://github.com/vector-im/vector-web/pull/1959)

Changes in [0.7.4-r1](https://github.com/vector-im/vector-web/releases/tag/v0.7.4-r1) (2016-08-12)
==================================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.4...v0.7.4-r1)
 * Update to matrix-react-sdk 0.6.4-r1 to fix inviting multiple people


Changes in [0.7.4](https://github.com/vector-im/vector-web/releases/tag/v0.7.4) (2016-08-11)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.3...v0.7.4)

 * Don't show border on composer when not in RTE mode
   [\#1954](https://github.com/vector-im/vector-web/pull/1954)
 * Wmwragg/room tag menu
   [\#1941](https://github.com/vector-im/vector-web/pull/1941)
 * Don't redirect to mobile app if verifying 3pid
   [\#1951](https://github.com/vector-im/vector-web/pull/1951)
 * Make sure that we clear localstorage before *all* tests
   [\#1950](https://github.com/vector-im/vector-web/pull/1950)
 * Basic CSS for multi-invite dialog
   [\#1942](https://github.com/vector-im/vector-web/pull/1942)
 * More tests for the loading process:
   [\#1947](https://github.com/vector-im/vector-web/pull/1947)
 * Support for refactored login token handling
   [\#1946](https://github.com/vector-im/vector-web/pull/1946)
 * Various fixes and improvements to emojification.
   [\#1935](https://github.com/vector-im/vector-web/pull/1935)
 * More app-loading tests
   [\#1938](https://github.com/vector-im/vector-web/pull/1938)
 * Some tests of the application load process
   [\#1936](https://github.com/vector-im/vector-web/pull/1936)
 * Add 'enable labs' setting to sample config
   [\#1930](https://github.com/vector-im/vector-web/pull/1930)
 * Matthew/scalar
   [\#1928](https://github.com/vector-im/vector-web/pull/1928)
 * Fix unit tests
   [\#1929](https://github.com/vector-im/vector-web/pull/1929)
 * Wmwragg/mute mention state fix
   [\#1926](https://github.com/vector-im/vector-web/pull/1926)
 * CSS for deactivate account dialog
   [\#1919](https://github.com/vector-im/vector-web/pull/1919)
 * Wmwragg/mention state menu
   [\#1900](https://github.com/vector-im/vector-web/pull/1900)
 * Fix UnknownBody styling for #1901
   [\#1913](https://github.com/vector-im/vector-web/pull/1913)
 * Exclude olm from the webpack
   [\#1914](https://github.com/vector-im/vector-web/pull/1914)
 * Wmwragg/button updates
   [\#1912](https://github.com/vector-im/vector-web/pull/1912)
 * Wmwragg/button updates
   [\#1828](https://github.com/vector-im/vector-web/pull/1828)
 * CSS for device management UI
   [\#1909](https://github.com/vector-im/vector-web/pull/1909)
 * Fix a warning from RoomSubList
   [\#1908](https://github.com/vector-im/vector-web/pull/1908)
 * Fix notifications warning layout
   [\#1907](https://github.com/vector-im/vector-web/pull/1907)
 * Remove relayoutOnUpdate prop on gemini-scrollbar
   [\#1883](https://github.com/vector-im/vector-web/pull/1883)
 * Bump dependency versions
   [\#1842](https://github.com/vector-im/vector-web/pull/1842)
 * Wmwragg/mention state indicator round 2
   [\#1835](https://github.com/vector-im/vector-web/pull/1835)
 * Wmwragg/spinner fix
   [\#1822](https://github.com/vector-im/vector-web/pull/1822)
 * Wmwragg/mention state indicator
   [\#1823](https://github.com/vector-im/vector-web/pull/1823)
 * Revert "Presentation for inline link"
   [\#1809](https://github.com/vector-im/vector-web/pull/1809)
 * Wmwragg/modal restyle
   [\#1806](https://github.com/vector-im/vector-web/pull/1806)
 * Presentation for inline link
   [\#1799](https://github.com/vector-im/vector-web/pull/1799)
 * CSS for offline user colours
   [\#1798](https://github.com/vector-im/vector-web/pull/1798)
 * Wmwragg/typography updates
   [\#1776](https://github.com/vector-im/vector-web/pull/1776)
 * webpack: always use the olm from vector-web
   [\#1766](https://github.com/vector-im/vector-web/pull/1766)
 * feat: large emoji support
   [\#1718](https://github.com/vector-im/vector-web/pull/1718)
 * Autocomplete
   [\#1717](https://github.com/vector-im/vector-web/pull/1717)
 * #1664 Set a maximum height for codeblocks
   [\#1670](https://github.com/vector-im/vector-web/pull/1670)
 * CSS for device blocking
   [\#1688](https://github.com/vector-im/vector-web/pull/1688)
 * Fix joining rooms by typing the alias
   [\#1685](https://github.com/vector-im/vector-web/pull/1685)
 * Add ability to delete an alias from room directory
   [\#1680](https://github.com/vector-im/vector-web/pull/1680)
 * package.json: add olm as optionalDependency
   [\#1678](https://github.com/vector-im/vector-web/pull/1678)
 * Another go at enabling olm on vector.im/develop
   [\#1675](https://github.com/vector-im/vector-web/pull/1675)
 * CSS for unverify button
   [\#1661](https://github.com/vector-im/vector-web/pull/1661)
 * CSS fix for rooms with crypto enabled
   [\#1660](https://github.com/vector-im/vector-web/pull/1660)
 * Karma: fix warning by ignoring olm
   [\#1652](https://github.com/vector-im/vector-web/pull/1652)
 * Update for react-sdk dbkr/fix_peeking branch
   [\#1639](https://github.com/vector-im/vector-web/pull/1639)
 * Update README.md
   [\#1641](https://github.com/vector-im/vector-web/pull/1641)
 * Fix karma tests
   [\#1643](https://github.com/vector-im/vector-web/pull/1643)
 * Rich Text Editor
   [\#1553](https://github.com/vector-im/vector-web/pull/1553)
 * Fix RoomDirectory to join by alias whenever possible.
   [\#1615](https://github.com/vector-im/vector-web/pull/1615)
 * Make the config optional
   [\#1612](https://github.com/vector-im/vector-web/pull/1612)
 * CSS support for device verification
   [\#1610](https://github.com/vector-im/vector-web/pull/1610)
 * Don't use SdkConfig
   [\#1609](https://github.com/vector-im/vector-web/pull/1609)
 * serve config.json statically instead of bundling it
   [\#1516](https://github.com/vector-im/vector-web/pull/1516)

Changes in [0.7.3](https://github.com/vector-im/vector-web/releases/tag/v0.7.3) (2016-06-03)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.2...v0.7.3)

* Update to react-sdk 0.6.3

Changes in [0.7.2](https://github.com/vector-im/vector-web/releases/tag/v0.7.2) (2016-06-02)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.1...v0.7.2)

 * Correctly bump the dep on new matrix-js-sdk and matrix-react-sdk

Changes in [0.7.1](https://github.com/vector-im/vector-web/releases/tag/v0.7.1) (2016-06-02)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.7.0...v0.7.1)

 * Fix accidentally committed local changes to the default config.json (doh!)

Changes in [0.7.0](https://github.com/vector-im/vector-web/releases/tag/v0.7.0) (2016-06-02)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.6.1...v0.7.0)

 * Update to matrix-react-sdk 0.6.0 - see
   [changelog](https://github.com/matrix-org/matrix-react-sdk/blob/v0.6.0/CHANGELOG.md)
 * Style selection color.
   [\#1557](https://github.com/vector-im/vector-web/pull/1557)
 * Fix NPE when loading the Settings page which infini-spinnered
   [\#1518](https://github.com/vector-im/vector-web/pull/1518)
 * Add option to enable email notifications
   [\#1469](https://github.com/vector-im/vector-web/pull/1469)

Changes in [0.6.1](https://github.com/vector-im/vector-web/releases/tag/v0.6.1) (2016-04-22)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.6.0...v0.6.1)

 * Update to matrix-react-sdk 0.5.2 - see
   [changelog](https://github.com/matrix-org/matrix-react-sdk/blob/v0.5.2/CHANGELOG.md)
 * Don't relayout scrollpanels every time something changes
   [\#1438](https://github.com/vector-im/vector-web/pull/1438)
 * Include react-addons-perf for non-production builds
   [\#1431](https://github.com/vector-im/vector-web/pull/1431)

Changes in [0.6.0](https://github.com/vector-im/vector-web/releases/tag/v0.6.0) (2016-04-19)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.5.0...v0.6.0)

 * Matthew/design tweaks
   [\#1402](https://github.com/vector-im/vector-web/pull/1402)
 * Improve handling of notification rules we can't parse
   [\#1399](https://github.com/vector-im/vector-web/pull/1399)
 * Do less mangling of jenkins builds
   [\#1391](https://github.com/vector-im/vector-web/pull/1391)
 * Start Notifications component refactor
   [\#1386](https://github.com/vector-im/vector-web/pull/1386)
 * make the UI fadable to help with decluttering
   [\#1376](https://github.com/vector-im/vector-web/pull/1376)
 * Get and display a user's pushers in settings
   [\#1374](https://github.com/vector-im/vector-web/pull/1374)
 * URL previewing support
   [\#1343](https://github.com/vector-im/vector-web/pull/1343)
 * 😄 Emoji autocomplete and unicode emoji to image conversion using emojione.
   [\#1332](https://github.com/vector-im/vector-web/pull/1332)
 * Show full-size avatar on MemberInfo avatar click
   [\#1340](https://github.com/vector-im/vector-web/pull/1340)
 * Numerous other changes via [matrix-react-sdk 0.5.1](https://github.com/matrix-org/matrix-react-sdk/blob/v0.5.1/CHANGELOG.md)

Changes in [0.5.0](https://github.com/vector-im/vector-web/releases/tag/v0.5.0) (2016-03-30)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.4.1...v0.5.0)

 * Prettier, animated placeholder :D
   [\#1292](https://github.com/vector-im/vector-web/pull/1292)
   (Disabled for now due to high CPU usage)
 * RoomDirectory: use SimpleRoomHeader instead of RoomHeader
   [\#1307](https://github.com/vector-im/vector-web/pull/1307)
 * Tell webpack not to parse the highlight.js languages
   [\#1277](https://github.com/vector-im/vector-web/pull/1277)
 * CSS for https://github.com/matrix-org/matrix-react-sdk/pull/247
   [\#1249](https://github.com/vector-im/vector-web/pull/1249)
 * URI-decode the hash-fragment
   [\#1254](https://github.com/vector-im/vector-web/pull/1254)

Changes in [0.4.1](https://github.com/vector-im/vector-web/releases/tag/v0.4.1) (2016-03-23)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.4.0...v0.4.1)
 * Update to matrix-react-sdk 0.3.1; see
   https://github.com/matrix-org/matrix-react-sdk/blob/v0.3.1/CHANGELOG.md
   (Disables debug logging)

Changes in [0.4.0](https://github.com/vector-im/vector-web/releases/tag/v0.4.0) (2016-03-23)
============================================================================================
[Full Changelog](https://github.com/vector-im/vector-web/compare/v0.3.0...v0.4.0)

 * Update to matrix-react-sdk 0.3.0; see
   https://github.com/matrix-org/matrix-react-sdk/blob/master/CHANGELOG.md

Other changes
 * permalink button
   [\#1232](https://github.com/vector-im/vector-web/pull/1232)
 * make senderprofiles clickable
   [\#1191](https://github.com/vector-im/vector-web/pull/1191)
 * fix notif spam when logging in from a guest session by correctly logging out
   first.
   [\#1180](https://github.com/vector-im/vector-web/pull/1180)
 * use new start_login_from_guest dispatch for cancellable logins from guest
   accounts
   [\#1165](https://github.com/vector-im/vector-web/pull/1165)
 * Use then() chaining rather than manual callbacks
   [\#1171](https://github.com/vector-im/vector-web/pull/1171)
 * Remove trailing whitespace
   [\#1163](https://github.com/vector-im/vector-web/pull/1163)
 * Update the actions of default rules instead of overriding.
   [\#1037](https://github.com/vector-im/vector-web/pull/1037)
 * Update README to include `npm install` in react-sdk
   [\#1137](https://github.com/vector-im/vector-web/pull/1137)

Changes in vector v0.3.0 (2016-03-11)
======================================
 * Lots of new bug fixes and updates

Changes in vector v0.2.0 (2016-02-24)
======================================
 * Refactor of matrix-react-sdk and vector to remove separation between views and
   controllers
 * Temporarily break the layering abstraction between vector and matrix-react-sdk
   for expedience in developing vector.
 * Vast numbers of new features, including read receipts, read-up-to markers,
   updated look and feel, search, new room and user settings, and email invites.

Changes in vector v0.1.2 (2015-10-28)
======================================
 * Support Room Avatars
 * Fullscreen video calls
 * Mute mic in VoIP calls
 * Fix bug with multiple desktop notifications
 * Context menu on messages
 * Better hover-over on member list
 * Support CAS auth
 * Many other bug fixes

Changes in vector v0.1.1 (2015-08-10)
======================================

 * Support logging in with an email address
 * Use the Vector identity server
 * Fix a bug where the client was not stopped properly on logout
 * Fix bugs where field values would be forgotten if login or registration failed
 * Improve URL bar navigation
 * Add explanatory help text on advanced server options
 * Fix a bug which caused execptions on malformed VoIP invitations
 * Remove superfluous scrollbars on Firefox
 * Numerous CSS fixes
 * Improved accessibility
 * Support command-click / middle click to open image in a new tab
 * Improved room directory
 * Fix display of text with many combining unicode points

Changes in vector v0.1.0 (2015-08-10)
======================================
Initial release
