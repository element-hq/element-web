Changes in [1.11.17](https://github.com/vector-im/element-web/releases/tag/v1.11.17) (2022-12-21)
=================================================================================================

## ✨ Features
 * Add inline code formatting to rich text editor ([\#9720](https://github.com/matrix-org/matrix-react-sdk/pull/9720)).
 * Add emoji handling for plain text mode of the new rich text editor ([\#9727](https://github.com/matrix-org/matrix-react-sdk/pull/9727)).
 * Overlay virtual room call events into main timeline ([\#9626](https://github.com/matrix-org/matrix-react-sdk/pull/9626)). Fixes #22929.
 * Adds a new section under "Room Settings" > "Roles & Permissions" which adds the possibility to multiselect users from this room and grant them more permissions. ([\#9596](https://github.com/matrix-org/matrix-react-sdk/pull/9596)). Contributed by @GoodGuyMarco.
 * Add emoji handling for rich text mode ([\#9661](https://github.com/matrix-org/matrix-react-sdk/pull/9661)).
 * Add setting to hide bold notifications ([\#9705](https://github.com/matrix-org/matrix-react-sdk/pull/9705)).
 * Further password reset flow enhancements ([\#9662](https://github.com/matrix-org/matrix-react-sdk/pull/9662)).
 * Snooze the bulk unverified sessions reminder on dismiss ([\#9706](https://github.com/matrix-org/matrix-react-sdk/pull/9706)).
 * Honor advanced audio processing settings when recording voice messages ([\#9610](https://github.com/matrix-org/matrix-react-sdk/pull/9610)). Contributed by @MrAnno.
 * Improve the visual balance of bubble layout ([\#9704](https://github.com/matrix-org/matrix-react-sdk/pull/9704)).
 * Add config setting to disable bulk unverified sessions nag ([\#9657](https://github.com/matrix-org/matrix-react-sdk/pull/9657)).
 * Only display bulk unverified sessions nag when current sessions is verified ([\#9656](https://github.com/matrix-org/matrix-react-sdk/pull/9656)).
 * Separate labs and betas more clearly ([\#8969](https://github.com/matrix-org/matrix-react-sdk/pull/8969)). Fixes #22706.
 * Show user an error if we fail to create a DM for verification. ([\#9624](https://github.com/matrix-org/matrix-react-sdk/pull/9624)).

## 🐛 Bug Fixes
 * Prevent unnecessary m.direct updates ([\#9805](https://github.com/matrix-org/matrix-react-sdk/pull/9805)). Fixes #24059.
 * Fix checkForPreJoinUISI for thread roots ([\#9803](https://github.com/matrix-org/matrix-react-sdk/pull/9803)). Fixes #24054.
 * Load RTE components only when RTE labs is enabled ([\#9804](https://github.com/matrix-org/matrix-react-sdk/pull/9804)).
 * Fix issue where thread panel did not update correctly ([\#9746](https://github.com/matrix-org/matrix-react-sdk/pull/9746)). Fixes #23971.
 * Remove async call to get virtual room from room load ([\#9743](https://github.com/matrix-org/matrix-react-sdk/pull/9743)). Fixes #23968.
 * Check each thread for unread messages. ([\#9723](https://github.com/matrix-org/matrix-react-sdk/pull/9723)).
 * Device manage - handle sessions that don't support encryption ([\#9717](https://github.com/matrix-org/matrix-react-sdk/pull/9717)). Fixes #23722.
 * Fix hover state for formatting buttons (Rich text editor) (fix vector-im/element-web/issues/23832) ([\#9715](https://github.com/matrix-org/matrix-react-sdk/pull/9715)).
 * Don't allow group calls to be unterminated ([\#9710](https://github.com/matrix-org/matrix-react-sdk/pull/9710)).
 * Fix replies to emotes not showing as inline ([\#9707](https://github.com/matrix-org/matrix-react-sdk/pull/9707)). Fixes #23903.
 * Update copy of 'Change layout' button to match Element Call ([\#9703](https://github.com/matrix-org/matrix-react-sdk/pull/9703)).
 * Fix call splitbrains when switching between rooms ([\#9692](https://github.com/matrix-org/matrix-react-sdk/pull/9692)).
 * bugfix: fix an issue where the Notifier would incorrectly fire for non-timeline events ([\#9664](https://github.com/matrix-org/matrix-react-sdk/pull/9664)). Fixes #17263.
 * Fix power selector being wrongly disabled for admins themselves ([\#9681](https://github.com/matrix-org/matrix-react-sdk/pull/9681)). Fixes #23882.
 * Show day counts in call durations ([\#9641](https://github.com/matrix-org/matrix-react-sdk/pull/9641)).

Changes in [1.11.16](https://github.com/vector-im/element-web/releases/tag/v1.11.16) (2022-12-06)
=================================================================================================

## ✨ Features
 * Further improve replies ([\#6396](https://github.com/matrix-org/matrix-react-sdk/pull/6396)). Fixes #19074, #18194 #18027 and #19179.
 * Enable users to join group calls from multiple devices ([\#9625](https://github.com/matrix-org/matrix-react-sdk/pull/9625)).
 * fix(visual): make cursor a pointer for summaries ([\#9419](https://github.com/matrix-org/matrix-react-sdk/pull/9419)). Contributed by @r00ster91.
 * Add placeholder for rich text editor ([\#9613](https://github.com/matrix-org/matrix-react-sdk/pull/9613)).
 * Consolidate public room search experience ([\#9605](https://github.com/matrix-org/matrix-react-sdk/pull/9605)). Fixes #22846.
 * New password reset flow ([\#9581](https://github.com/matrix-org/matrix-react-sdk/pull/9581)). Fixes #23131.
 * Device manager - add tooltip to device details toggle ([\#9594](https://github.com/matrix-org/matrix-react-sdk/pull/9594)).
 * sliding sync: add lazy-loading member support ([\#9530](https://github.com/matrix-org/matrix-react-sdk/pull/9530)).
 * Limit formatting bar offset to top of composer ([\#9365](https://github.com/matrix-org/matrix-react-sdk/pull/9365)). Fixes #12359. Contributed by @owi92.

## 🐛 Bug Fixes
 * Fix issues around up arrow event edit shortcut ([\#9645](https://github.com/matrix-org/matrix-react-sdk/pull/9645)). Fixes #18497 and #18964.
 * Fix search not being cleared when clicking on a result ([\#9635](https://github.com/matrix-org/matrix-react-sdk/pull/9635)). Fixes #23845.
 * Fix screensharing in 1:1 calls ([\#9612](https://github.com/matrix-org/matrix-react-sdk/pull/9612)). Fixes #23808.
 * Fix the background color flashing when joining a call ([\#9640](https://github.com/matrix-org/matrix-react-sdk/pull/9640)).
 * Fix the size of the 'Private space' icon ([\#9638](https://github.com/matrix-org/matrix-react-sdk/pull/9638)).
 * Fix reply editing in rich text editor (https ([\#9615](https://github.com/matrix-org/matrix-react-sdk/pull/9615)).
 * Fix thread list jumping back down while scrolling ([\#9606](https://github.com/matrix-org/matrix-react-sdk/pull/9606)). Fixes #23727.
 * Fix regression with TimelinePanel props updates not taking effect ([\#9608](https://github.com/matrix-org/matrix-react-sdk/pull/9608)). Fixes #23794.
 * Fix form tooltip positioning ([\#9598](https://github.com/matrix-org/matrix-react-sdk/pull/9598)). Fixes #22861.
 * Extract Search handling from RoomView into its own Component ([\#9574](https://github.com/matrix-org/matrix-react-sdk/pull/9574)). Fixes #498.
 * Fix call splitbrains when switching between rooms ([\#9692](https://github.com/matrix-org/matrix-react-sdk/pull/9692)).
 * [Backport staging] Fix replies to emotes not showing as inline ([\#9708](https://github.com/matrix-org/matrix-react-sdk/pull/9708)).

Changes in [1.11.15](https://github.com/vector-im/element-web/releases/tag/v1.11.15) (2022-11-22)
=================================================================================================

## ✨ Features
 * Make clear notifications work with threads ([\#9575](https://github.com/matrix-org/matrix-react-sdk/pull/9575)). Fixes #23751.
 * Change "None" to "Off" in notification options ([\#9539](https://github.com/matrix-org/matrix-react-sdk/pull/9539)). Contributed by @Arnei.
 * Advanced audio processing settings ([\#8759](https://github.com/matrix-org/matrix-react-sdk/pull/8759)). Fixes #6278. Contributed by @MrAnno.
 * Add way to create a user notice via config.json ([\#9559](https://github.com/matrix-org/matrix-react-sdk/pull/9559)).
 * Improve design of the rich text editor ([\#9533](https://github.com/matrix-org/matrix-react-sdk/pull/9533)). Contributed by @florianduros.
 * Enable user to zoom beyond image size ([\#5949](https://github.com/matrix-org/matrix-react-sdk/pull/5949)). Contributed by @jaiwanth-v.
 * Fix: Move "Leave Space" option to the bottom of space context menu ([\#9535](https://github.com/matrix-org/matrix-react-sdk/pull/9535)). Contributed by @hanadi92.

## 🐛 Bug Fixes
 * Make build scripts work on NixOS ([\#23740](https://github.com/vector-im/element-web/pull/23740)).
 * Fix integration manager `get_open_id_token` action and add E2E tests ([\#9520](https://github.com/matrix-org/matrix-react-sdk/pull/9520)).
 * Fix links being mangled by markdown processing ([\#9570](https://github.com/matrix-org/matrix-react-sdk/pull/9570)). Fixes #23743.
 * Fix: inline links selecting radio button ([\#9543](https://github.com/matrix-org/matrix-react-sdk/pull/9543)). Contributed by @hanadi92.
 * Fix wrong error message in registration when phone number threepid is in use. ([\#9571](https://github.com/matrix-org/matrix-react-sdk/pull/9571)). Contributed by @bagvand.
 * Fix missing avatar for show current profiles ([\#9563](https://github.com/matrix-org/matrix-react-sdk/pull/9563)). Fixes #23733.
 * Fix read receipts trickling down correctly ([\#9567](https://github.com/matrix-org/matrix-react-sdk/pull/9567)). Fixes #23746.
 * Resilience fix for homeserver without thread notification support ([\#9565](https://github.com/matrix-org/matrix-react-sdk/pull/9565)).
 * Don't switch to the home page needlessly after leaving a room ([\#9477](https://github.com/matrix-org/matrix-react-sdk/pull/9477)).
 * Differentiate download and decryption errors when showing images ([\#9562](https://github.com/matrix-org/matrix-react-sdk/pull/9562)). Fixes #3892.
 * Close context menu when a modal is opened to prevent user getting stuck ([\#9560](https://github.com/matrix-org/matrix-react-sdk/pull/9560)). Fixes #15610 and #10781.
 * Fix TimelineReset handling when no room associated ([\#9553](https://github.com/matrix-org/matrix-react-sdk/pull/9553)).
 * Always use current profile on thread events ([\#9524](https://github.com/matrix-org/matrix-react-sdk/pull/9524)). Fixes #23648.
 * Fix `ThreadView` tests not using thread flag ([\#9547](https://github.com/matrix-org/matrix-react-sdk/pull/9547)). Contributed by @MadLittleMods.
 * Handle deletion of `m.call` events ([\#9540](https://github.com/matrix-org/matrix-react-sdk/pull/9540)). Fixes #23663.
 * Fix incorrect notification count after leaving a room with notifications ([\#9518](https://github.com/matrix-org/matrix-react-sdk/pull/9518)). Contributed by @Arnei.

Changes in [1.11.14](https://github.com/vector-im/element-web/releases/tag/v1.11.14) (2022-11-08)
=================================================================================================

## ✨ Features
 * Loading threads with server-side assistance ([\#9356](https://github.com/matrix-org/matrix-react-sdk/pull/9356)). Fixes #21807, #21799, #21911, #22141, #22157, #22641, #22501 #22438 and #21678. Contributed by @justjanne.
 * Make thread replies trigger a room list re-ordering ([\#9510](https://github.com/matrix-org/matrix-react-sdk/pull/9510)). Fixes #21700.
 * Device manager - add extra details to device security and renaming ([\#9501](https://github.com/matrix-org/matrix-react-sdk/pull/9501)). Contributed by @kerryarchibald.
 * Add plain text mode to the wysiwyg composer ([\#9503](https://github.com/matrix-org/matrix-react-sdk/pull/9503)). Contributed by @florianduros.
 * Sliding Sync: improve sort order, show subspace rooms, better tombstoned room handling ([\#9484](https://github.com/matrix-org/matrix-react-sdk/pull/9484)).
 * Device manager - add learn more popups to filtered sessions section ([\#9497](https://github.com/matrix-org/matrix-react-sdk/pull/9497)). Contributed by @kerryarchibald.
 * Show thread notification if thread timeline is closed ([\#9495](https://github.com/matrix-org/matrix-react-sdk/pull/9495)). Fixes #23589.
 * Add message editing to wysiwyg composer ([\#9488](https://github.com/matrix-org/matrix-react-sdk/pull/9488)). Contributed by @florianduros.
 * Device manager - confirm sign out of other sessions ([\#9487](https://github.com/matrix-org/matrix-react-sdk/pull/9487)). Contributed by @kerryarchibald.
 * Automatically request logs from other users in a call when submitting logs ([\#9492](https://github.com/matrix-org/matrix-react-sdk/pull/9492)).
 * Add thread notification with server assistance (MSC3773) ([\#9400](https://github.com/matrix-org/matrix-react-sdk/pull/9400)). Fixes #21114, #21413, #21416, #21433, #21481, #21798, #21823 #23192 and #21765.
 * Support for login + E2EE set up with QR ([\#9403](https://github.com/matrix-org/matrix-react-sdk/pull/9403)). Contributed by @hughns.
 * Allow pressing Enter to send messages in new composer ([\#9451](https://github.com/matrix-org/matrix-react-sdk/pull/9451)). Contributed by @andybalaam.

## 🐛 Bug Fixes
 * Fix regressions around media uploads failing and causing soft crashes ([\#9549](https://github.com/matrix-org/matrix-react-sdk/pull/9549)). Fixes matrix-org/element-web-rageshakes#16831, matrix-org/element-web-rageshakes#16824 matrix-org/element-web-rageshakes#16810 and vector-im/element-web#23641.
 * Fix /myroomavatar slash command ([\#9536](https://github.com/matrix-org/matrix-react-sdk/pull/9536)). Fixes matrix-org/synapse#14321.
 * Fix config.json failing to load for Jitsi wrapper in non-root deployment ([\#23577](https://github.com/vector-im/element-web/pull/23577)).
 * Fix NotificationBadge unsent color ([\#9522](https://github.com/matrix-org/matrix-react-sdk/pull/9522)). Fixes #23646.
 * Fix room list sorted by recent on app startup ([\#9515](https://github.com/matrix-org/matrix-react-sdk/pull/9515)). Fixes #23635.
 * Reset custom power selector when blurred on empty ([\#9508](https://github.com/matrix-org/matrix-react-sdk/pull/9508)). Fixes #23481.
 * Reinstate timeline/redaction callbacks when updating notification state ([\#9494](https://github.com/matrix-org/matrix-react-sdk/pull/9494)). Fixes #23554.
 * Only render NotificationBadge when needed ([\#9493](https://github.com/matrix-org/matrix-react-sdk/pull/9493)). Fixes #23584.
 * Fix embedded Element Call screen sharing ([\#9485](https://github.com/matrix-org/matrix-react-sdk/pull/9485)). Fixes #23571.
 * Send Content-Type: application/json header for integration manager /register API ([\#9490](https://github.com/matrix-org/matrix-react-sdk/pull/9490)). Fixes #23580.
 * Fix joining calls without audio or video inputs ([\#9486](https://github.com/matrix-org/matrix-react-sdk/pull/9486)). Fixes #23511.
 * Ensure spaces in the spotlight dialog have rounded square avatars ([\#9480](https://github.com/matrix-org/matrix-react-sdk/pull/9480)). Fixes #23515.
 * Only show mini avatar uploader in room intro when no avatar yet exists ([\#9479](https://github.com/matrix-org/matrix-react-sdk/pull/9479)). Fixes #23552.
 * Fix threads fallback incorrectly targets root event ([\#9229](https://github.com/matrix-org/matrix-react-sdk/pull/9229)). Fixes #23147.
 * Align video call icon with banner text ([\#9460](https://github.com/matrix-org/matrix-react-sdk/pull/9460)).
 * Set relations helper when creating event tile context menu ([\#9253](https://github.com/matrix-org/matrix-react-sdk/pull/9253)). Fixes #22018.
 * Device manager - put client/browser device metadata in correct section ([\#9447](https://github.com/matrix-org/matrix-react-sdk/pull/9447)). Contributed by @kerryarchibald.
 * Update the room unread notification counter when the server changes the value without any related read receipt ([\#9438](https://github.com/matrix-org/matrix-react-sdk/pull/9438)).

Changes in [1.11.13](https://github.com/vector-im/element-web/releases/tag/v1.11.13) (2022-11-01)
=================================================================================================

## 🐛 Bug Fixes
 * Fix default behavior of Room.getBlacklistUnverifiedDevices ([\#2830](https://github.com/matrix-org/matrix-js-sdk/pull/2830)). Contributed by @duxovni.
 * Catch server versions API call exception when starting the client ([\#2828](https://github.com/matrix-org/matrix-js-sdk/pull/2828)). Fixes vector-im/element-web#23634.
 * Fix authedRequest including `Authorization: Bearer undefined` for password resets ([\#2822](https://github.com/matrix-org/matrix-js-sdk/pull/2822)). Fixes vector-im/element-web#23655.

Changes in [1.11.12](https://github.com/vector-im/element-web/releases/tag/v1.11.12) (2022-10-26)
=================================================================================================

## 🐛 Bug Fixes
 * Fix config.json failing to load for Jitsi wrapper in non-root deployment ([\#23577](https://github.com/vector-im/element-web/pull/23577)).

Changes in [1.11.11](https://github.com/vector-im/element-web/releases/tag/v1.11.11) (2022-10-25)
=================================================================================================

## ✨ Features
 * Device manager - tweak string formatting of default device name ([\#23457](https://github.com/vector-im/element-web/pull/23457)).
 * Add Element Call participant limit ([\#23431](https://github.com/vector-im/element-web/pull/23431)).
 * Add Element Call `brand` ([\#23443](https://github.com/vector-im/element-web/pull/23443)).
 * Include a file-safe room name and ISO date in chat exports ([\#9440](https://github.com/matrix-org/matrix-react-sdk/pull/9440)). Fixes #21812 and #19724.
 * Room call banner ([\#9378](https://github.com/matrix-org/matrix-react-sdk/pull/9378)). Fixes #23453. Contributed by @toger5.
 * Device manager - spinners while devices are signing out ([\#9433](https://github.com/matrix-org/matrix-react-sdk/pull/9433)). Fixes #15865.
 * Device manager - silence call ringers when local notifications are silenced ([\#9420](https://github.com/matrix-org/matrix-react-sdk/pull/9420)).
 * Pass the current language to Element Call ([\#9427](https://github.com/matrix-org/matrix-react-sdk/pull/9427)).
 * Hide screen-sharing button in Element Call on desktop ([\#9423](https://github.com/matrix-org/matrix-react-sdk/pull/9423)).
 * Add reply support to WysiwygComposer ([\#9422](https://github.com/matrix-org/matrix-react-sdk/pull/9422)). Contributed by @florianduros.
 * Disconnect other connected devices (of the same user) when joining an Element call ([\#9379](https://github.com/matrix-org/matrix-react-sdk/pull/9379)).
 * Device manager - device tile main click target ([\#9409](https://github.com/matrix-org/matrix-react-sdk/pull/9409)).
 * Add formatting buttons to the rich text editor ([\#9410](https://github.com/matrix-org/matrix-react-sdk/pull/9410)). Contributed by @florianduros.
 * Device manager - current session context menu ([\#9386](https://github.com/matrix-org/matrix-react-sdk/pull/9386)).
 * Remove piwik config fallback for privacy policy URL ([\#9390](https://github.com/matrix-org/matrix-react-sdk/pull/9390)).
 * Add the first step to integrate the matrix wysiwyg composer ([\#9374](https://github.com/matrix-org/matrix-react-sdk/pull/9374)). Contributed by @florianduros.
 * Device manager - UA parsing tweaks ([\#9382](https://github.com/matrix-org/matrix-react-sdk/pull/9382)).
 * Device manager - remove client information events when disabling setting ([\#9384](https://github.com/matrix-org/matrix-react-sdk/pull/9384)).
 * Add Element Call participant limit ([\#9358](https://github.com/matrix-org/matrix-react-sdk/pull/9358)).
 * Add Element Call room settings ([\#9347](https://github.com/matrix-org/matrix-react-sdk/pull/9347)).
 * Device manager - render extended device information ([\#9360](https://github.com/matrix-org/matrix-react-sdk/pull/9360)).
 * New group call experience: Room header and PiP designs ([\#9351](https://github.com/matrix-org/matrix-react-sdk/pull/9351)).
 * Pass language to Jitsi Widget ([\#9346](https://github.com/matrix-org/matrix-react-sdk/pull/9346)). Contributed by @Fox32.
 * Add notifications and toasts for Element Call calls ([\#9337](https://github.com/matrix-org/matrix-react-sdk/pull/9337)).
 * Device manager - device type icon ([\#9355](https://github.com/matrix-org/matrix-react-sdk/pull/9355)).
 * Delete the remainder of groups ([\#9357](https://github.com/matrix-org/matrix-react-sdk/pull/9357)). Fixes #22770.
 * Device manager - display client information in device details ([\#9315](https://github.com/matrix-org/matrix-react-sdk/pull/9315)).

## 🐛 Bug Fixes
 * Send Content-Type: application/json header for integration manager /register API ([\#9490](https://github.com/matrix-org/matrix-react-sdk/pull/9490)). Fixes #23580.
 * Make ErrorView & CompatibilityView scrollable ([\#23468](https://github.com/vector-im/element-web/pull/23468)). Fixes #23376.
 * Device manager - put client/browser device metadata in correct section ([\#9447](https://github.com/matrix-org/matrix-react-sdk/pull/9447)).
 * update the room unread notification counter when the server changes the value without any related read receipt ([\#9438](https://github.com/matrix-org/matrix-react-sdk/pull/9438)).
 * Don't show call banners in video rooms ([\#9441](https://github.com/matrix-org/matrix-react-sdk/pull/9441)).
 * Prevent useContextMenu isOpen from being true if the button ref goes away ([\#9418](https://github.com/matrix-org/matrix-react-sdk/pull/9418)). Fixes matrix-org/element-web-rageshakes#15637.
 * Automatically focus the WYSIWYG composer when you enter a room ([\#9412](https://github.com/matrix-org/matrix-react-sdk/pull/9412)).
 * Improve the tooltips on the call lobby join button ([\#9428](https://github.com/matrix-org/matrix-react-sdk/pull/9428)).
 * Pass the homeserver's base URL to Element Call ([\#9429](https://github.com/matrix-org/matrix-react-sdk/pull/9429)). Fixes #23301.
 * Better accommodate long room names in call toasts ([\#9426](https://github.com/matrix-org/matrix-react-sdk/pull/9426)).
 * Hide virtual widgets from the room info panel ([\#9424](https://github.com/matrix-org/matrix-react-sdk/pull/9424)). Fixes #23494.
 * Inhibit clicking on sender avatar in threads list ([\#9417](https://github.com/matrix-org/matrix-react-sdk/pull/9417)). Fixes #23482.
 * Correct the dir parameter of MSC3715 ([\#9391](https://github.com/matrix-org/matrix-react-sdk/pull/9391)). Contributed by @dhenneke.
 * Use a more correct subset of users in `/remakeolm` developer command ([\#9402](https://github.com/matrix-org/matrix-react-sdk/pull/9402)).
 * use correct default for notification silencing ([\#9388](https://github.com/matrix-org/matrix-react-sdk/pull/9388)). Fixes #23456.
 * Device manager - eagerly create `m.local_notification_settings` events ([\#9353](https://github.com/matrix-org/matrix-react-sdk/pull/9353)).
 * Close incoming Element call toast when viewing the call lobby ([\#9375](https://github.com/matrix-org/matrix-react-sdk/pull/9375)).
 * Always allow enabling sending read receipts ([\#9367](https://github.com/matrix-org/matrix-react-sdk/pull/9367)). Fixes #23433.
 * Fixes (vector-im/element-web/issues/22609) where the white theme is not applied when `white -> dark -> white` sequence is done. ([\#9320](https://github.com/matrix-org/matrix-react-sdk/pull/9320)). Contributed by @florianduros.
 * Fix applying programmatically set height for "top" room layout ([\#9339](https://github.com/matrix-org/matrix-react-sdk/pull/9339)). Contributed by @Fox32.

Changes in [1.11.10](https://github.com/vector-im/element-web/releases/tag/v1.11.10) (2022-10-11)
=================================================================================================

## 🐛 Bug Fixes
 * Use correct default for notification silencing ([\#9388](https://github.com/matrix-org/matrix-react-sdk/pull/9388)). Fixes vector-im/element-web#23456.

Changes in [1.11.9](https://github.com/vector-im/element-web/releases/tag/v1.11.9) (2022-10-11)
===============================================================================================

##   Deprecations
 * Legacy Piwik config.json option `piwik.policy_url` is deprecated in favour of `privacy_policy_url`. Support will be removed in the next release.

## ✨ Features
 * Device manager - select all devices ([\#9330](https://github.com/matrix-org/matrix-react-sdk/pull/9330)). Contributed by @kerryarchibald.
 * New group call experience: Call tiles ([\#9332](https://github.com/matrix-org/matrix-react-sdk/pull/9332)).
 * Add Shift key to FormatQuote keyboard shortcut ([\#9298](https://github.com/matrix-org/matrix-react-sdk/pull/9298)). Contributed by @owi92.
 * Device manager - sign out of multiple sessions ([\#9325](https://github.com/matrix-org/matrix-react-sdk/pull/9325)). Contributed by @kerryarchibald.
 * Display push toggle for web sessions (MSC3890) ([\#9327](https://github.com/matrix-org/matrix-react-sdk/pull/9327)).
 * Add device notifications enabled switch ([\#9324](https://github.com/matrix-org/matrix-react-sdk/pull/9324)).
 * Implement push notification toggle in device detail ([\#9308](https://github.com/matrix-org/matrix-react-sdk/pull/9308)).
 * New group call experience: Starting and ending calls ([\#9318](https://github.com/matrix-org/matrix-react-sdk/pull/9318)).
 * New group call experience: Room header call buttons ([\#9311](https://github.com/matrix-org/matrix-react-sdk/pull/9311)).
 * Make device ID copyable in device list ([\#9297](https://github.com/matrix-org/matrix-react-sdk/pull/9297)). Contributed by @duxovni.
 * Use display name instead of user ID when rendering power events ([\#9295](https://github.com/matrix-org/matrix-react-sdk/pull/9295)).
 * Read receipts for threads ([\#9239](https://github.com/matrix-org/matrix-react-sdk/pull/9239)). Fixes #23191.

## 🐛 Bug Fixes
 * Use the correct sender key when checking shared secret ([\#2730](https://github.com/matrix-org/matrix-js-sdk/pull/2730)). Fixes vector-im/element-web#23374.
 * Fix device selection in pre-join screen for Element Call video rooms ([\#9321](https://github.com/matrix-org/matrix-react-sdk/pull/9321)). Fixes #23331.
 * Don't render a 1px high room topic if the room topic is empty ([\#9317](https://github.com/matrix-org/matrix-react-sdk/pull/9317)). Contributed by @Arnei.
 * Don't show feedback prompts when that UIFeature is disabled ([\#9305](https://github.com/matrix-org/matrix-react-sdk/pull/9305)). Fixes #23327.
 * Fix soft crash around unknown room pills ([\#9301](https://github.com/matrix-org/matrix-react-sdk/pull/9301)). Fixes matrix-org/element-web-rageshakes#15465.
 * Fix spaces feedback prompt wrongly showing when feedback is disabled ([\#9302](https://github.com/matrix-org/matrix-react-sdk/pull/9302)). Fixes #23314.
 * Fix tile soft crash in ReplyInThreadButton ([\#9300](https://github.com/matrix-org/matrix-react-sdk/pull/9300)). Fixes matrix-org/element-web-rageshakes#15493.

Changes in [1.11.8](https://github.com/vector-im/element-web/releases/tag/v1.11.8) (2022-09-28)
===============================================================================================

## 🐛 Bug Fixes
 * Bump IDB crypto store version ([\#2705](https://github.com/matrix-org/matrix-js-sdk/pull/2705)).

Changes in [1.11.7](https://github.com/vector-im/element-web/releases/tag/v1.11.7) (2022-09-28)
===============================================================================================

## 🔒 Security
* Fix for [CVE-2022-39249](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39249)
* Fix for [CVE-2022-39250](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39250)
* Fix for [CVE-2022-39251](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39251)
* Fix for [CVE-2022-39236](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39236)

Changes in [1.11.6](https://github.com/vector-im/element-web/releases/tag/v1.11.6) (2022-09-20)
=========================================================================================================

## ✨ Features
 * Element Call video rooms ([\#9267](https://github.com/matrix-org/matrix-react-sdk/pull/9267)).
 * Device manager - rename session ([\#9282](https://github.com/matrix-org/matrix-react-sdk/pull/9282)).
 * Allow widgets to read related events ([\#9210](https://github.com/matrix-org/matrix-react-sdk/pull/9210)). Contributed by @dhenneke.
 * Device manager - logout of other session ([\#9280](https://github.com/matrix-org/matrix-react-sdk/pull/9280)).
 * Device manager - logout current session ([\#9275](https://github.com/matrix-org/matrix-react-sdk/pull/9275)).
 * Device manager - verify other devices ([\#9274](https://github.com/matrix-org/matrix-react-sdk/pull/9274)).
 * Allow integration managers to remove users ([\#9211](https://github.com/matrix-org/matrix-react-sdk/pull/9211)).
 * Device manager - add verify current session button ([\#9252](https://github.com/matrix-org/matrix-react-sdk/pull/9252)).
 * Add NotifPanel dot back. ([\#9242](https://github.com/matrix-org/matrix-react-sdk/pull/9242)). Fixes #17641.
 * Implement MSC3575: Sliding Sync ([\#8328](https://github.com/matrix-org/matrix-react-sdk/pull/8328)).
 * Add the clipboard read permission for widgets ([\#9250](https://github.com/matrix-org/matrix-react-sdk/pull/9250)). Contributed by @stefanmuhle.

## 🐛 Bug Fixes
 * Make autocomplete pop-up wider in thread view ([\#9289](https://github.com/matrix-org/matrix-react-sdk/pull/9289)).
 * Fix soft crash around inviting invalid MXIDs in start DM on first message flow ([\#9281](https://github.com/matrix-org/matrix-react-sdk/pull/9281)). Fixes matrix-org/element-web-rageshakes#15060 and matrix-org/element-web-rageshakes#15140.
 * Fix in-reply-to previews not disappearing when swapping rooms ([\#9278](https://github.com/matrix-org/matrix-react-sdk/pull/9278)).
 * Fix invalid instanceof operand window.OffscreenCanvas ([\#9276](https://github.com/matrix-org/matrix-react-sdk/pull/9276)). Fixes #23275.
 * Fix memory leak caused by unremoved listener ([\#9273](https://github.com/matrix-org/matrix-react-sdk/pull/9273)).
 * Fix thumbnail generation when offscreen canvas fails ([\#9272](https://github.com/matrix-org/matrix-react-sdk/pull/9272)). Fixes #23265.
 * Prevent sliding sync from showing a room under multiple sublists ([\#9266](https://github.com/matrix-org/matrix-react-sdk/pull/9266)).
 * Fix tile crash around tooltipify links ([\#9270](https://github.com/matrix-org/matrix-react-sdk/pull/9270)). Fixes #23253.
 * Device manager - filter out nulled metadatas in device tile properly ([\#9251](https://github.com/matrix-org/matrix-react-sdk/pull/9251)).
 * Fix a sliding sync bug which could cause rooms to loop ([\#9268](https://github.com/matrix-org/matrix-react-sdk/pull/9268)).
 * Remove the grey gradient on images in bubbles in the timeline ([\#9241](https://github.com/matrix-org/matrix-react-sdk/pull/9241)). Fixes #21651.
 * Fix html export not including images ([\#9260](https://github.com/matrix-org/matrix-react-sdk/pull/9260)). Fixes #22059.
 * Fix possible soft crash from a race condition in space hierarchies ([\#9254](https://github.com/matrix-org/matrix-react-sdk/pull/9254)). Fixes matrix-org/element-web-rageshakes#15225.
 * Disable all types of autocorrect, -complete, -capitalize, etc on Spotlight's search field ([\#9259](https://github.com/matrix-org/matrix-react-sdk/pull/9259)).
 * Handle M_INVALID_USERNAME on /register/available ([\#9237](https://github.com/matrix-org/matrix-react-sdk/pull/9237)). Fixes #23161.
 * Fix issue with quiet zone around QR code ([\#9243](https://github.com/matrix-org/matrix-react-sdk/pull/9243)). Fixes #23199.

Changes in [1.11.5](https://github.com/vector-im/element-web/releases/tag/v1.11.5) (2022-09-13)
===============================================================================================

## ✨ Features
 * Device manager - hide unverified security recommendation when only current session is unverified ([\#9228](https://github.com/matrix-org/matrix-react-sdk/pull/9228)). Contributed by @kerryarchibald.
 * Device manager - scroll to filtered list from security recommendations ([\#9227](https://github.com/matrix-org/matrix-react-sdk/pull/9227)). Contributed by @kerryarchibald.
 * Device manager - updated dropdown style in filtered device list ([\#9226](https://github.com/matrix-org/matrix-react-sdk/pull/9226)). Contributed by @kerryarchibald.
 * Device manager - device type and verification icons on device tile ([\#9197](https://github.com/matrix-org/matrix-react-sdk/pull/9197)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Description of DM room with more than two other people is now being displayed correctly ([\#9231](https://github.com/matrix-org/matrix-react-sdk/pull/9231)). Fixes #23094.
 * Fix voice messages with multiple composers ([\#9208](https://github.com/matrix-org/matrix-react-sdk/pull/9208)). Fixes #23023. Contributed by @grimhilt.
 * Fix suggested rooms going missing ([\#9236](https://github.com/matrix-org/matrix-react-sdk/pull/9236)). Fixes #23190.
 * Fix tooltip infinitely recursing ([\#9235](https://github.com/matrix-org/matrix-react-sdk/pull/9235)). Fixes matrix-org/element-web-rageshakes#15107, matrix-org/element-web-rageshakes#15093 matrix-org/element-web-rageshakes#15092 and matrix-org/element-web-rageshakes#15077.
 * Fix plain text export saving ([\#9230](https://github.com/matrix-org/matrix-react-sdk/pull/9230)). Contributed by @jryans.
 * Add missing space in SecurityRoomSettingsTab ([\#9222](https://github.com/matrix-org/matrix-react-sdk/pull/9222)). Contributed by @gefgu.
 * Make use of js-sdk roomNameGenerator to handle i18n for generated room names ([\#9209](https://github.com/matrix-org/matrix-react-sdk/pull/9209)). Fixes #21369.
 * Fix progress bar regression throughout the app ([\#9219](https://github.com/matrix-org/matrix-react-sdk/pull/9219)). Fixes #23121.
 * Reuse empty string & space string logic for event types in devtools ([\#9218](https://github.com/matrix-org/matrix-react-sdk/pull/9218)). Fixes #23115.

Changes in [1.11.4](https://github.com/vector-im/element-web/releases/tag/v1.11.4) (2022-08-31)
===============================================================================================

## 🔒 Security
* Fixes for [CVE-2022-36059](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D36059) and [CVE-2022-36060](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D36060)

Learn more about what we've been up to at https://element.io/blog/element-web-desktop-1-11-4-a-security-update-deferred-dms-and-more/
Find more details of the vulnerabilities at https://matrix.org/blog/2022/08/31/security-releases-matrix-js-sdk-19-4-0-and-matrix-react-sdk-3-53-0

## ✨ Features
 * Device manager - scroll to filtered list from security recommendations ([\#9227](https://github.com/matrix-org/matrix-react-sdk/pull/9227)). Contributed by @kerryarchibald.
 * Device manager - updated dropdown style in filtered device list ([\#9226](https://github.com/matrix-org/matrix-react-sdk/pull/9226)). Contributed by @kerryarchibald.
 * Device manager - device type and verification icons on device tile ([\#9197](https://github.com/matrix-org/matrix-react-sdk/pull/9197)). Contributed by @kerryarchibald.
 * Ignore unreads in low priority rooms in the space panel ([\#6518](https://github.com/matrix-org/matrix-react-sdk/pull/6518)). Fixes #16836.
 * Release message right-click context menu out of labs ([\#8613](https://github.com/matrix-org/matrix-react-sdk/pull/8613)).
 * Device manager - expandable session details in device list ([\#9188](https://github.com/matrix-org/matrix-react-sdk/pull/9188)). Contributed by @kerryarchibald.
 * Device manager - device list filtering ([\#9181](https://github.com/matrix-org/matrix-react-sdk/pull/9181)). Contributed by @kerryarchibald.
 * Device manager - add verification details to session details ([\#9187](https://github.com/matrix-org/matrix-react-sdk/pull/9187)). Contributed by @kerryarchibald.
 * Device manager - current session expandable details ([\#9185](https://github.com/matrix-org/matrix-react-sdk/pull/9185)). Contributed by @kerryarchibald.
 * Device manager - security recommendations section ([\#9179](https://github.com/matrix-org/matrix-react-sdk/pull/9179)). Contributed by @kerryarchibald.
 * The Welcome Home Screen: Return Button ([\#9089](https://github.com/matrix-org/matrix-react-sdk/pull/9089)). Fixes #22917. Contributed by @justjanne.
 * Device manager - label devices as inactive ([\#9175](https://github.com/matrix-org/matrix-react-sdk/pull/9175)). Contributed by @kerryarchibald.
 * Device manager - other sessions list ([\#9155](https://github.com/matrix-org/matrix-react-sdk/pull/9155)). Contributed by @kerryarchibald.
 * Implement MSC3846: Allowing widgets to access TURN servers ([\#9061](https://github.com/matrix-org/matrix-react-sdk/pull/9061)).
 * Allow widgets to send/receive to-device messages ([\#8885](https://github.com/matrix-org/matrix-react-sdk/pull/8885)).

## 🐛 Bug Fixes
 * Add super cool feature ([\#9222](https://github.com/matrix-org/matrix-react-sdk/pull/9222)). Contributed by @gefgu.
 * Make use of js-sdk roomNameGenerator to handle i18n for generated room names ([\#9209](https://github.com/matrix-org/matrix-react-sdk/pull/9209)). Fixes #21369.
 * Fix progress bar regression throughout the app ([\#9219](https://github.com/matrix-org/matrix-react-sdk/pull/9219)). Fixes #23121.
 * Reuse empty string & space string logic for event types in devtools ([\#9218](https://github.com/matrix-org/matrix-react-sdk/pull/9218)). Fixes #23115.
 * Reduce amount of requests done by the onboarding task list ([\#9194](https://github.com/matrix-org/matrix-react-sdk/pull/9194)). Fixes #23085. Contributed by @justjanne.
 * Avoid hardcoding branding in user onboarding ([\#9206](https://github.com/matrix-org/matrix-react-sdk/pull/9206)). Fixes #23111. Contributed by @justjanne.
 * End jitsi call when member is banned ([\#8879](https://github.com/matrix-org/matrix-react-sdk/pull/8879)). Contributed by @maheichyk.
 * Fix context menu being opened when clicking message action bar buttons ([\#9200](https://github.com/matrix-org/matrix-react-sdk/pull/9200)). Fixes #22279 and #23100.
 * Add gap between checkbox and text in report dialog following the same pattern (8px) used in the gap between the two buttons. It fixes vector-im/element-web#23060 ([\#9195](https://github.com/matrix-org/matrix-react-sdk/pull/9195)). Contributed by @gefgu.
 * Fix url preview AXE and layout issue & add percy test ([\#9189](https://github.com/matrix-org/matrix-react-sdk/pull/9189)). Fixes #23083.
 * Wrap long space names ([\#9201](https://github.com/matrix-org/matrix-react-sdk/pull/9201)). Fixes #23095.
 * Attempt to fix `Failed to execute 'removeChild' on 'Node'` ([\#9196](https://github.com/matrix-org/matrix-react-sdk/pull/9196)).
 * Fix soft crash around space hierarchy changing between spaces ([\#9191](https://github.com/matrix-org/matrix-react-sdk/pull/9191)). Fixes matrix-org/element-web-rageshakes#14613.
 * Fix soft crash around room view store metrics ([\#9190](https://github.com/matrix-org/matrix-react-sdk/pull/9190)). Fixes matrix-org/element-web-rageshakes#14361.
 * Fix the same person appearing multiple times when searching for them. ([\#9177](https://github.com/matrix-org/matrix-react-sdk/pull/9177)). Fixes #22851.
 * Fix space panel subspace indentation going missing ([\#9167](https://github.com/matrix-org/matrix-react-sdk/pull/9167)). Fixes #23049.
 * Fix invisible power levels tile when showing hidden events ([\#9162](https://github.com/matrix-org/matrix-react-sdk/pull/9162)). Fixes #23013.
 * Space panel accessibility improvements ([\#9157](https://github.com/matrix-org/matrix-react-sdk/pull/9157)). Fixes #22995.
 * Fix inverted logic for showing UserWelcomeTop component ([\#9164](https://github.com/matrix-org/matrix-react-sdk/pull/9164)). Fixes #23037.

Changes in [1.11.3](https://github.com/vector-im/element-web/releases/tag/v1.11.3) (2022-08-16)
===============================================================================================

## ✨ Features
 * Improve auth aria attributes and semantics ([\#22948](https://github.com/vector-im/element-web/pull/22948)).
 * Device manager - New device tile info design ([\#9122](https://github.com/matrix-org/matrix-react-sdk/pull/9122)). Contributed by @kerryarchibald.
 * Device manager generic settings subsection component ([\#9147](https://github.com/matrix-org/matrix-react-sdk/pull/9147)). Contributed by @kerryarchibald.
 * Migrate the hidden read receipts flag to new "send read receipts" option ([\#9141](https://github.com/matrix-org/matrix-react-sdk/pull/9141)).
 * Live location sharing - share location at most every 5 seconds ([\#9148](https://github.com/matrix-org/matrix-react-sdk/pull/9148)). Contributed by @kerryarchibald.
 * Increase max length of voice messages to 15m ([\#9133](https://github.com/matrix-org/matrix-react-sdk/pull/9133)). Fixes #18620.
 * Move pin drop out of labs ([\#9135](https://github.com/matrix-org/matrix-react-sdk/pull/9135)).
 * Start DM on first message ([\#8612](https://github.com/matrix-org/matrix-react-sdk/pull/8612)). Fixes #14736.
 * Remove "Add Space" button from RoomListHeader when user cannot create spaces ([\#9129](https://github.com/matrix-org/matrix-react-sdk/pull/9129)).
 * The Welcome Home Screen: Dedicated Download Apps Dialog ([\#9120](https://github.com/matrix-org/matrix-react-sdk/pull/9120)). Fixes #22921. Contributed by @justjanne.
 * The Welcome Home Screen: "Submit Feedback" pane ([\#9090](https://github.com/matrix-org/matrix-react-sdk/pull/9090)). Fixes #22918. Contributed by @justjanne.
 * New User Onboarding Task List ([\#9083](https://github.com/matrix-org/matrix-react-sdk/pull/9083)). Fixes #22919. Contributed by @justjanne.
 * Add support for disabling spell checking ([\#8604](https://github.com/matrix-org/matrix-react-sdk/pull/8604)). Fixes #21901.
 * Live location share - leave maximised map open when beacons expire ([\#9098](https://github.com/matrix-org/matrix-react-sdk/pull/9098)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Some slash-commands (`/myroomnick`) have temporarily been disabled before the first message in a DM is sent. ([\#9193](https://github.com/matrix-org/matrix-react-sdk/pull/9193)).
 * Use stable reference for active tab in tabbedView ([\#9145](https://github.com/matrix-org/matrix-react-sdk/pull/9145)). Contributed by @kerryarchibald.
 * Fix pillification sometimes doubling up ([\#9152](https://github.com/matrix-org/matrix-react-sdk/pull/9152)). Fixes #23036.
 * Fix highlights not being applied to plaintext messages ([\#9126](https://github.com/matrix-org/matrix-react-sdk/pull/9126)). Fixes #22787.
 * Fix dismissing edit composer when change was undone ([\#9109](https://github.com/matrix-org/matrix-react-sdk/pull/9109)). Fixes #22932.
 * 1-to-1 DM rooms with bots now act like DM rooms instead of multi-user-rooms before ([\#9124](https://github.com/matrix-org/matrix-react-sdk/pull/9124)). Fixes #22894.
 * Apply inline start padding to selected lines on modern layout only ([\#9006](https://github.com/matrix-org/matrix-react-sdk/pull/9006)). Fixes #22768. Contributed by @luixxiul.
 * Peek into world-readable rooms from spotlight ([\#9115](https://github.com/matrix-org/matrix-react-sdk/pull/9115)). Fixes #22862.
 * Use default styling on nested numbered lists due to MD being sensitive ([\#9110](https://github.com/matrix-org/matrix-react-sdk/pull/9110)). Fixes #22935.
 * Fix replying using chat effect commands ([\#9101](https://github.com/matrix-org/matrix-react-sdk/pull/9101)). Fixes #22824.

Changes in [1.11.2](https://github.com/vector-im/element-web/releases/tag/v1.11.2) (2022-08-03)
===============================================================================================

## ✨ Features
 * Live location share -  focus on user location on list item click ([\#9051](https://github.com/matrix-org/matrix-react-sdk/pull/9051)). Contributed by @kerryarchibald.
 * Live location sharing - don't trigger unread counts for beacon location events ([\#9071](https://github.com/matrix-org/matrix-react-sdk/pull/9071)). Contributed by @kerryarchibald.
 * Support for sending voice messages as replies and in threads ([\#9097](https://github.com/matrix-org/matrix-react-sdk/pull/9097)). Fixes #22031.
 * Add `Reply in thread` button to the right-click message context-menu ([\#9004](https://github.com/matrix-org/matrix-react-sdk/pull/9004)). Fixes #22745.
 * Starred_Messages_Feature_Contd_II/Outreachy ([\#9086](https://github.com/matrix-org/matrix-react-sdk/pull/9086)).
 * Use "frequently used emojis" for autocompletion in composer ([\#8998](https://github.com/matrix-org/matrix-react-sdk/pull/8998)). Fixes #18978. Contributed by @grimhilt.
 * Improve clickability of view source event toggle button  ([\#9068](https://github.com/matrix-org/matrix-react-sdk/pull/9068)). Fixes #21856. Contributed by @luixxiul.
 * Improve clickability of "collapse" link button on bubble layout ([\#9037](https://github.com/matrix-org/matrix-react-sdk/pull/9037)). Fixes #22864. Contributed by @luixxiul.
 * Starred_Messages_Feature/Outreachy ([\#8842](https://github.com/matrix-org/matrix-react-sdk/pull/8842)).
 * Implement Use Case Selection screen ([\#8984](https://github.com/matrix-org/matrix-react-sdk/pull/8984)). Contributed by @justjanne.
 * Live location share - handle insufficient permissions in location sharing ([\#9047](https://github.com/matrix-org/matrix-react-sdk/pull/9047)). Contributed by @kerryarchibald.
 * Improve _FilePanel.scss ([\#9031](https://github.com/matrix-org/matrix-react-sdk/pull/9031)). Contributed by @luixxiul.
 * Improve spotlight accessibility by adding context menus ([\#8907](https://github.com/matrix-org/matrix-react-sdk/pull/8907)). Fixes #20875 and #22675. Contributed by @justjanne.

## 🐛 Bug Fixes
 * Replace mask-images with svg components in MessageActionBar ([\#9088](https://github.com/matrix-org/matrix-react-sdk/pull/9088)). Fixes #22912. Contributed by @kerryarchibald.
 * Unbreak in-app permalink tooltips ([\#9087](https://github.com/matrix-org/matrix-react-sdk/pull/9087)). Fixes #22874.
 * Show a back button when viewing a space member ([\#9095](https://github.com/matrix-org/matrix-react-sdk/pull/9095)). Fixes #22898.
 * Align the right edge of info tile lines with normal ones on IRC layout ([\#9058](https://github.com/matrix-org/matrix-react-sdk/pull/9058)). Fixes #22871. Contributed by @luixxiul.
 * Prevent email verification from overriding existing sessions ([\#9075](https://github.com/matrix-org/matrix-react-sdk/pull/9075)). Fixes #22881. Contributed by @justjanne.
 * Fix wrong buttons being used when exploring public rooms ([\#9062](https://github.com/matrix-org/matrix-react-sdk/pull/9062)). Fixes #22862.
 * Re-add padding to generic event list summary on IRC layout ([\#9063](https://github.com/matrix-org/matrix-react-sdk/pull/9063)). Fixes #22869. Contributed by @luixxiul.
 * Joining federated rooms via the spotlight search should no longer cause a "No known servers" error. ([\#9055](https://github.com/matrix-org/matrix-react-sdk/pull/9055)). Fixes #22845. Contributed by @Half-Shot.

Changes in [1.11.1](https://github.com/vector-im/element-web/releases/tag/v1.11.1) (2022-07-26)
===============================================================================================

## ✨ Features
 * Enable URL tooltips on hover for Element Desktop ([\#22286](https://github.com/vector-im/element-web/pull/22286)). Fixes undefined/element-web#6532.
 * Hide screenshare button in video rooms on Desktop ([\#9045](https://github.com/matrix-org/matrix-react-sdk/pull/9045)).
 * Add a developer command to reset Megolm and Olm sessions ([\#9044](https://github.com/matrix-org/matrix-react-sdk/pull/9044)).
 * add spaces to TileErrorBoundary ([\#9012](https://github.com/matrix-org/matrix-react-sdk/pull/9012)). Contributed by @HarHarLinks.
 * Location sharing - add localised strings to map ([\#9025](https://github.com/matrix-org/matrix-react-sdk/pull/9025)). Fixes #21443. Contributed by @kerryarchibald.
 * Added trim to ignore whitespaces in email check ([\#9027](https://github.com/matrix-org/matrix-react-sdk/pull/9027)). Contributed by @ankur12-1610.
 * Improve _GenericEventListSummary.scss ([\#9005](https://github.com/matrix-org/matrix-react-sdk/pull/9005)). Contributed by @luixxiul.
 * Live location share - tiles without tile server (PSG-591) ([\#8962](https://github.com/matrix-org/matrix-react-sdk/pull/8962)). Contributed by @kerryarchibald.
 * Add option to display tooltip on link hover ([\#8394](https://github.com/matrix-org/matrix-react-sdk/pull/8394)). Fixes #21907.
 * Support a module API surface for custom functionality ([\#8246](https://github.com/matrix-org/matrix-react-sdk/pull/8246)).
 * Adjust encryption copy when creating a video room ([\#8989](https://github.com/matrix-org/matrix-react-sdk/pull/8989)). Fixes #22737.
 * Add bidirectonal isolation for pills ([\#8985](https://github.com/matrix-org/matrix-react-sdk/pull/8985)). Contributed by @sha-265.
 * Delabs `Show current avatar and name for users in message history` ([\#8764](https://github.com/matrix-org/matrix-react-sdk/pull/8764)). Fixes #22336.
 * Live location share - open latest location in map site ([\#8981](https://github.com/matrix-org/matrix-react-sdk/pull/8981)). Contributed by @kerryarchibald.
 * Improve LinkPreviewWidget ([\#8881](https://github.com/matrix-org/matrix-react-sdk/pull/8881)). Fixes #22634. Contributed by @luixxiul.
 * Render HTML topics in rooms on space home ([\#8939](https://github.com/matrix-org/matrix-react-sdk/pull/8939)).
 * Hide timestamp on event tiles being edited on every layout ([\#8956](https://github.com/matrix-org/matrix-react-sdk/pull/8956)). Contributed by @luixxiul.
 * Introduce new copy icon ([\#8942](https://github.com/matrix-org/matrix-react-sdk/pull/8942)).
 * Allow finding group DMs by members in spotlight ([\#8922](https://github.com/matrix-org/matrix-react-sdk/pull/8922)). Fixes #22564. Contributed by @justjanne.
 * Live location share - explicitly stop beacons replaced beacons ([\#8933](https://github.com/matrix-org/matrix-react-sdk/pull/8933)). Contributed by @kerryarchibald.
 * Remove unpin from widget kebab menu ([\#8924](https://github.com/matrix-org/matrix-react-sdk/pull/8924)).
 * Live location share - redact related locations on beacon redaction ([\#8926](https://github.com/matrix-org/matrix-react-sdk/pull/8926)). Contributed by @kerryarchibald.
 * Live location share - disallow message pinning ([\#8928](https://github.com/matrix-org/matrix-react-sdk/pull/8928)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Remove the ability to hide yourself in video rooms ([\#22806](https://github.com/vector-im/element-web/pull/22806)). Fixes #22805.
 * Unbreak in-app permalink tooltips  ([\#9100](https://github.com/matrix-org/matrix-react-sdk/pull/9100)).
 * Add space for the stroke on message editor on IRC layout ([\#9030](https://github.com/matrix-org/matrix-react-sdk/pull/9030)). Fixes #22785. Contributed by @luixxiul.
 * Fix pinned messages not re-linkifying on edit ([\#9042](https://github.com/matrix-org/matrix-react-sdk/pull/9042)). Fixes #22726.
 * Don't unnecessarily persist the host signup dialog ([\#9043](https://github.com/matrix-org/matrix-react-sdk/pull/9043)). Fixes #22778.
 * Fix URL previews causing messages to become unrenderable ([\#9028](https://github.com/matrix-org/matrix-react-sdk/pull/9028)). Fixes #22766.
 * Fix event list summaries including invalid events ([\#9041](https://github.com/matrix-org/matrix-react-sdk/pull/9041)). Fixes #22790.
 * Correct accessibility labels for unread rooms in spotlight ([\#9003](https://github.com/matrix-org/matrix-react-sdk/pull/9003)). Contributed by @justjanne.
 * Enable search strings highlight on bubble layout ([\#9032](https://github.com/matrix-org/matrix-react-sdk/pull/9032)). Fixes #22786. Contributed by @luixxiul.
 * Unbreak URL preview for formatted links with tooltips ([\#9022](https://github.com/matrix-org/matrix-react-sdk/pull/9022)). Fixes #22764.
 * Re-add margin to tiles based on EventTileBubble ([\#9015](https://github.com/matrix-org/matrix-react-sdk/pull/9015)). Fixes #22772. Contributed by @luixxiul.
 * Fix Shortcut prompt for Search showing in minimized Roomlist ([\#9014](https://github.com/matrix-org/matrix-react-sdk/pull/9014)). Fixes #22739. Contributed by @justjanne.
 * Fix avatar position on event info line for hidden events on a thread ([\#9019](https://github.com/matrix-org/matrix-react-sdk/pull/9019)). Fixes #22777. Contributed by @luixxiul.
 * Fix lost padding of event tile info line ([\#9009](https://github.com/matrix-org/matrix-react-sdk/pull/9009)). Fixes #22754 and #22759. Contributed by @luixxiul.
 * Align verification bubble with normal event tiles on IRC layout ([\#9001](https://github.com/matrix-org/matrix-react-sdk/pull/9001)). Fixes #22758. Contributed by @luixxiul.
 * Ensure timestamp on generic event list summary is not hidden from TimelineCard ([\#9000](https://github.com/matrix-org/matrix-react-sdk/pull/9000)). Fixes #22755. Contributed by @luixxiul.
 * Fix headings margin on security user settings tab ([\#8826](https://github.com/matrix-org/matrix-react-sdk/pull/8826)). Contributed by @luixxiul.
 * Fix timestamp position on file panel ([\#8976](https://github.com/matrix-org/matrix-react-sdk/pull/8976)). Fixes #22718. Contributed by @luixxiul.
 * Stop using :not() pseudo class for mx_GenericEventListSummary ([\#8944](https://github.com/matrix-org/matrix-react-sdk/pull/8944)). Fixes #22602. Contributed by @luixxiul.
 * Don't show the same user twice in Spotlight ([\#8978](https://github.com/matrix-org/matrix-react-sdk/pull/8978)). Fixes #22697.
 * Align the right edge of expand / collapse link buttons of generic event list summary in bubble layout with a variable ([\#8992](https://github.com/matrix-org/matrix-react-sdk/pull/8992)). Fixes #22743. Contributed by @luixxiul.
 * Display own avatars on search results panel in bubble layout ([\#8990](https://github.com/matrix-org/matrix-react-sdk/pull/8990)). Contributed by @luixxiul.
 * Fix text flow of thread summary content on threads list ([\#8991](https://github.com/matrix-org/matrix-react-sdk/pull/8991)). Fixes #22738. Contributed by @luixxiul.
 * Fix the size of the clickable area of images ([\#8987](https://github.com/matrix-org/matrix-react-sdk/pull/8987)). Fixes #22282.
 * Fix font size of MessageTimestamp on TimelineCard ([\#8950](https://github.com/matrix-org/matrix-react-sdk/pull/8950)). Contributed by @luixxiul.
 * Improve security room settings tab style rules ([\#8844](https://github.com/matrix-org/matrix-react-sdk/pull/8844)). Fixes #22575. Contributed by @luixxiul.
 * Align E2E icon and avatar of info tile in compact modern layout ([\#8965](https://github.com/matrix-org/matrix-react-sdk/pull/8965)). Fixes #22652. Contributed by @luixxiul.
 * Fix clickable area of general event list summary toggle ([\#8979](https://github.com/matrix-org/matrix-react-sdk/pull/8979)). Fixes #22722. Contributed by @luixxiul.
 * Fix resizing room topic ([\#8966](https://github.com/matrix-org/matrix-react-sdk/pull/8966)). Fixes #22689.
 * Dismiss the search dialogue when starting a DM ([\#8967](https://github.com/matrix-org/matrix-react-sdk/pull/8967)). Fixes #22700.
 * Fix "greyed out" text style inconsistency on search result panel ([\#8974](https://github.com/matrix-org/matrix-react-sdk/pull/8974)). Contributed by @luixxiul.
 * Add top padding to EventTilePreview loader ([\#8977](https://github.com/matrix-org/matrix-react-sdk/pull/8977)). Fixes #22719. Contributed by @luixxiul.
 * Fix read receipts group position on TimelineCard in compact modern/group layout ([\#8971](https://github.com/matrix-org/matrix-react-sdk/pull/8971)). Fixes #22715. Contributed by @luixxiul.
 * Fix calls on homeservers without the unstable thirdparty endpoints. ([\#8931](https://github.com/matrix-org/matrix-react-sdk/pull/8931)). Fixes #21680. Contributed by @deepbluev7.
 * Enable ReplyChain text to be expanded on IRC layout ([\#8959](https://github.com/matrix-org/matrix-react-sdk/pull/8959)). Fixes #22709. Contributed by @luixxiul.
 * Fix hidden timestamp on message edit history dialog ([\#8955](https://github.com/matrix-org/matrix-react-sdk/pull/8955)). Fixes #22701. Contributed by @luixxiul.
 * Enable ReplyChain text to be expanded on bubble layout ([\#8958](https://github.com/matrix-org/matrix-react-sdk/pull/8958)). Fixes #22709. Contributed by @luixxiul.
 * Fix expand/collapse state wrong in metaspaces ([\#8952](https://github.com/matrix-org/matrix-react-sdk/pull/8952)). Fixes #22632.
 * Location (live) share replies now provide a fallback content ([\#8949](https://github.com/matrix-org/matrix-react-sdk/pull/8949)).
 * Fix space settings not opening for script-created spaces ([\#8957](https://github.com/matrix-org/matrix-react-sdk/pull/8957)). Fixes #22703.
 * Respect `filename` field on `m.file` events ([\#8951](https://github.com/matrix-org/matrix-react-sdk/pull/8951)).
 * Fix PlatformSettingsHandler always returning true due to returning a Promise ([\#8954](https://github.com/matrix-org/matrix-react-sdk/pull/8954)). Fixes #22616.
 * Improve high-contrast support for spotlight ([\#8948](https://github.com/matrix-org/matrix-react-sdk/pull/8948)). Fixes #22481. Contributed by @justjanne.
 * Fix wrong assertions that all media events have a mimetype ([\#8946](https://github.com/matrix-org/matrix-react-sdk/pull/8946)). Fixes matrix-org/element-web-rageshakes#13727.
 * Make invite dialogue fixed height ([\#8934](https://github.com/matrix-org/matrix-react-sdk/pull/8934)). Fixes #22659.
 * Fix all megolm error reported as unknown ([\#8916](https://github.com/matrix-org/matrix-react-sdk/pull/8916)).
 * Remove line-height declarations from _ReplyTile.scss ([\#8932](https://github.com/matrix-org/matrix-react-sdk/pull/8932)). Fixes #22687. Contributed by @luixxiul.
 * Reduce video rooms log spam ([\#8913](https://github.com/matrix-org/matrix-react-sdk/pull/8913)).
 * Correct new search input’s rounded corners ([\#8921](https://github.com/matrix-org/matrix-react-sdk/pull/8921)). Fixes #22576. Contributed by @justjanne.
 * Align unread notification dot on threads list in compact modern=group layout ([\#8911](https://github.com/matrix-org/matrix-react-sdk/pull/8911)). Fixes #22677. Contributed by @luixxiul.

Changes in [1.11.0](https://github.com/vector-im/element-web/releases/tag/v1.11.0) (2022-07-05)
===============================================================================================

## 🚨 BREAKING CHANGES
 * Remove Piwik support ([\#8835](https://github.com/matrix-org/matrix-react-sdk/pull/8835)).

## ✨ Features
 * Document how to configure a custom `home.html`. ([\#21066](https://github.com/vector-im/element-web/pull/21066)). Contributed by @johannes-krude.
 * Move New Search Experience out of beta ([\#8859](https://github.com/matrix-org/matrix-react-sdk/pull/8859)). Contributed by @justjanne.
 * Switch video rooms to spotlight layout when in PiP mode ([\#8912](https://github.com/matrix-org/matrix-react-sdk/pull/8912)). Fixes #22574.
 * Live location sharing - render message deleted tile for redacted beacons ([\#8905](https://github.com/matrix-org/matrix-react-sdk/pull/8905)). Contributed by @kerryarchibald.
 * Improve view source dialog style ([\#8883](https://github.com/matrix-org/matrix-react-sdk/pull/8883)). Fixes #22636. Contributed by @luixxiul.
 * Improve integration manager dialog style ([\#8888](https://github.com/matrix-org/matrix-react-sdk/pull/8888)). Fixes #22642. Contributed by @luixxiul.
 * Implement MSC3827: Filtering of `/publicRooms` by room type ([\#8866](https://github.com/matrix-org/matrix-react-sdk/pull/8866)). Fixes #22578.
 * Show chat panel when opening a video room with unread messages ([\#8812](https://github.com/matrix-org/matrix-react-sdk/pull/8812)). Fixes #22527.
 * Live location share - forward latest location ([\#8860](https://github.com/matrix-org/matrix-react-sdk/pull/8860)). Contributed by @kerryarchibald.
 * Allow integration managers to validate user identity after opening ([\#8782](https://github.com/matrix-org/matrix-react-sdk/pull/8782)). Contributed by @Half-Shot.
 * Create a common header on right panel cards on BaseCard ([\#8808](https://github.com/matrix-org/matrix-react-sdk/pull/8808)). Contributed by @luixxiul.
 * Integrate searching public rooms and people into the new search experience ([\#8707](https://github.com/matrix-org/matrix-react-sdk/pull/8707)). Fixes #21354 and #19349. Contributed by @justjanne.
 * Bring back waveform for voice messages and retain seeking ([\#8843](https://github.com/matrix-org/matrix-react-sdk/pull/8843)). Fixes #21904.
 * Improve colors in settings  ([\#7283](https://github.com/matrix-org/matrix-react-sdk/pull/7283)).
 * Keep draft in composer when a slash command syntax errors ([\#8811](https://github.com/matrix-org/matrix-react-sdk/pull/8811)). Fixes #22384.
 * Release video rooms as a beta feature ([\#8431](https://github.com/matrix-org/matrix-react-sdk/pull/8431)).
 * Clarify logout key backup warning dialog. Contributed by @notramo. ([\#8741](https://github.com/matrix-org/matrix-react-sdk/pull/8741)). Fixes #15565. Contributed by @MadLittleMods.
 * Slightly improve the look of the `Message edits` dialog ([\#8763](https://github.com/matrix-org/matrix-react-sdk/pull/8763)). Fixes #22410.
 * Add support for MD / HTML in room topics ([\#8215](https://github.com/matrix-org/matrix-react-sdk/pull/8215)). Fixes #5180. Contributed by @Johennes.
 * Live location share - link to timeline tile from share warning ([\#8752](https://github.com/matrix-org/matrix-react-sdk/pull/8752)). Contributed by @kerryarchibald.
 * Improve composer visiblity ([\#8578](https://github.com/matrix-org/matrix-react-sdk/pull/8578)). Fixes #22072 and #17362.
 * Makes the avatar of the user menu non-draggable ([\#8765](https://github.com/matrix-org/matrix-react-sdk/pull/8765)). Contributed by @luixxiul.
 * Improve widget buttons behaviour and layout ([\#8734](https://github.com/matrix-org/matrix-react-sdk/pull/8734)).
 * Use AccessibleButton for 'Reset All' link button on SetupEncryptionBody ([\#8730](https://github.com/matrix-org/matrix-react-sdk/pull/8730)). Contributed by @luixxiul.
 * Adjust message timestamp position on TimelineCard in non-bubble layouts ([\#8745](https://github.com/matrix-org/matrix-react-sdk/pull/8745)). Fixes #22426. Contributed by @luixxiul.
 * Use AccessibleButton for 'In reply to' link button on ReplyChain ([\#8726](https://github.com/matrix-org/matrix-react-sdk/pull/8726)). Fixes #22407. Contributed by @luixxiul.
 * Live location share - enable reply and react to tiles ([\#8721](https://github.com/matrix-org/matrix-react-sdk/pull/8721)). Contributed by @kerryarchibald.
 * Change dash to em dash issues fixed ([\#8455](https://github.com/matrix-org/matrix-react-sdk/pull/8455)). Fixes #21895. Contributed by @goelesha.

## 🐛 Bug Fixes
 * Reduce video rooms log spam ([\#22665](https://github.com/vector-im/element-web/pull/22665)).
 * Connect to Jitsi unmuted by default ([\#22660](https://github.com/vector-im/element-web/pull/22660)). Fixes #22637.
 * Work around a Jitsi bug with display name encoding ([\#22525](https://github.com/vector-im/element-web/pull/22525)). Fixes #22521.
 * Make invite dialogue fixed height ([\#8945](https://github.com/matrix-org/matrix-react-sdk/pull/8945)).
 * Correct issue with tab order in new search experience ([\#8919](https://github.com/matrix-org/matrix-react-sdk/pull/8919)). Fixes #22670. Contributed by @justjanne.
 * Clicking location replies now redirects to the replied event instead of opening the map ([\#8918](https://github.com/matrix-org/matrix-react-sdk/pull/8918)). Fixes #22667.
 * Keep clicks on pills within the app ([\#8917](https://github.com/matrix-org/matrix-react-sdk/pull/8917)). Fixes #22653.
 * Don't overlap tile bubbles with timestamps in modern layout ([\#8908](https://github.com/matrix-org/matrix-react-sdk/pull/8908)). Fixes #22425.
 * Connect to Jitsi unmuted by default ([\#8909](https://github.com/matrix-org/matrix-react-sdk/pull/8909)).
 * Maximize width value of display name on TimelineCard with IRC/modern layout ([\#8904](https://github.com/matrix-org/matrix-react-sdk/pull/8904)). Fixes #22651. Contributed by @luixxiul.
 * Align the avatar and the display name on TimelineCard ([\#8900](https://github.com/matrix-org/matrix-react-sdk/pull/8900)). Contributed by @luixxiul.
 * Remove inline margin from reactions row on IRC layout ([\#8891](https://github.com/matrix-org/matrix-react-sdk/pull/8891)). Fixes #22644. Contributed by @luixxiul.
 * Align "From a thread" on search result panel on IRC layout ([\#8892](https://github.com/matrix-org/matrix-react-sdk/pull/8892)). Fixes #22645. Contributed by @luixxiul.
 * Display description of E2E advanced panel as subsection text ([\#8889](https://github.com/matrix-org/matrix-react-sdk/pull/8889)). Contributed by @luixxiul.
 * Remove inline end margin from images on file panel ([\#8886](https://github.com/matrix-org/matrix-react-sdk/pull/8886)). Fixes #22640. Contributed by @luixxiul.
 * Disable option to `Quote` when we don't have sufficient permissions ([\#8893](https://github.com/matrix-org/matrix-react-sdk/pull/8893)). Fixes #22643.
 * Add padding to font scaling loader for message bubble layout ([\#8875](https://github.com/matrix-org/matrix-react-sdk/pull/8875)). Fixes #22626. Contributed by @luixxiul.
 * Set 100% max-width to display name on reply tiles ([\#8867](https://github.com/matrix-org/matrix-react-sdk/pull/8867)). Fixes #22615. Contributed by @luixxiul.
 * Fix alignment of pill letter ([\#8874](https://github.com/matrix-org/matrix-react-sdk/pull/8874)). Fixes #22622. Contributed by @luixxiul.
 * Move the beta pill to the right side and display the pill on video room only ([\#8873](https://github.com/matrix-org/matrix-react-sdk/pull/8873)). Fixes #22619 and #22620. Contributed by @luixxiul.
 * Stop using absolute property to place beta pill on RoomPreviewCard ([\#8872](https://github.com/matrix-org/matrix-react-sdk/pull/8872)). Fixes #22617. Contributed by @luixxiul.
 * Make the pill text single line ([\#8744](https://github.com/matrix-org/matrix-react-sdk/pull/8744)). Fixes #22427. Contributed by @luixxiul.
 * Hide overflow of public room description on spotlight dialog result ([\#8870](https://github.com/matrix-org/matrix-react-sdk/pull/8870)). Contributed by @luixxiul.
 * Fix position of message action bar on the info tile on TimelineCard in message bubble layout ([\#8865](https://github.com/matrix-org/matrix-react-sdk/pull/8865)). Fixes #22614. Contributed by @luixxiul.
 * Remove inline start margin from display name on reply tiles on TimelineCard ([\#8864](https://github.com/matrix-org/matrix-react-sdk/pull/8864)). Fixes #22613. Contributed by @luixxiul.
 * Improve homeserver dropdown dialog styling ([\#8850](https://github.com/matrix-org/matrix-react-sdk/pull/8850)). Fixes #22552. Contributed by @justjanne.
 * Fix crash when drawing blurHash for portrait videos PSB-139 ([\#8855](https://github.com/matrix-org/matrix-react-sdk/pull/8855)). Fixes #22597. Contributed by @andybalaam.
 * Fix grid blowout on pinned event tiles ([\#8816](https://github.com/matrix-org/matrix-react-sdk/pull/8816)). Fixes #22543. Contributed by @luixxiul.
 * Fix temporary sync errors if there's weird settings stored in account data ([\#8857](https://github.com/matrix-org/matrix-react-sdk/pull/8857)).
 * Fix reactions row overflow and gap between reactions ([\#8813](https://github.com/matrix-org/matrix-react-sdk/pull/8813)). Fixes #22093. Contributed by @luixxiul.
 * Fix issues with the Create new room button in Spotlight ([\#8851](https://github.com/matrix-org/matrix-react-sdk/pull/8851)). Contributed by @justjanne.
 * Remove margin from E2E icon between avatar and hidden event ([\#8584](https://github.com/matrix-org/matrix-react-sdk/pull/8584)). Fixes #22186. Contributed by @luixxiul.
 * Fix waveform on a message bubble ([\#8852](https://github.com/matrix-org/matrix-react-sdk/pull/8852)). Contributed by @luixxiul.
 * Location sharing maps are now loaded after reconnection ([\#8848](https://github.com/matrix-org/matrix-react-sdk/pull/8848)). Fixes #20993.
 * Update the avatar mask so it doesn’t cut off spaces’ avatars anymore ([\#8849](https://github.com/matrix-org/matrix-react-sdk/pull/8849)). Contributed by @justjanne.
 * Add a bit of safety around timestamp handling for threads ([\#8845](https://github.com/matrix-org/matrix-react-sdk/pull/8845)).
 * Remove top margin from event tile on a narrow viewport ([\#8814](https://github.com/matrix-org/matrix-react-sdk/pull/8814)). Contributed by @luixxiul.
 * Fix keyboard shortcuts on settings tab being wrapped ([\#8825](https://github.com/matrix-org/matrix-react-sdk/pull/8825)). Fixes #22547. Contributed by @luixxiul.
 * Add try-catch around blurhash loading ([\#8830](https://github.com/matrix-org/matrix-react-sdk/pull/8830)).
 * Prevent new composer from overflowing from non-breakable text ([\#8829](https://github.com/matrix-org/matrix-react-sdk/pull/8829)). Fixes #22507. Contributed by @justjanne.
 * Use common subheading on sidebar user settings tab ([\#8823](https://github.com/matrix-org/matrix-react-sdk/pull/8823)). Contributed by @luixxiul.
 * Fix clickable area of advanced toggle on appearance user settings tab ([\#8820](https://github.com/matrix-org/matrix-react-sdk/pull/8820)). Fixes #22546. Contributed by @luixxiul.
 * Disable redacting reactions if we don't have sufficient permissions  ([\#8767](https://github.com/matrix-org/matrix-react-sdk/pull/8767)). Fixes #22262.
 * Update the live timeline when the JS SDK resets it ([\#8806](https://github.com/matrix-org/matrix-react-sdk/pull/8806)). Fixes #22421.
 * Fix flex blowout on image reply ([\#8809](https://github.com/matrix-org/matrix-react-sdk/pull/8809)). Fixes #22509 and #22510. Contributed by @luixxiul.
 * Enable background color on hover for chat panel and thread panel ([\#8644](https://github.com/matrix-org/matrix-react-sdk/pull/8644)). Fixes #22273. Contributed by @luixxiul.
 * Fix #20026: send read marker as soon as we change it ([\#8802](https://github.com/matrix-org/matrix-react-sdk/pull/8802)). Fixes #20026. Contributed by @andybalaam.
 * Allow AppTiles to shrink as much as necessary ([\#8805](https://github.com/matrix-org/matrix-react-sdk/pull/8805)). Fixes #22499.
 * Make widgets in video rooms immutable again ([\#8803](https://github.com/matrix-org/matrix-react-sdk/pull/8803)). Fixes #22497.
 * Use MessageActionBar style declarations on pinned message card ([\#8757](https://github.com/matrix-org/matrix-react-sdk/pull/8757)). Fixes #22444. Contributed by @luixxiul.
 * Expire video member events after 1 hour ([\#8776](https://github.com/matrix-org/matrix-react-sdk/pull/8776)).
 * Name lists on invite dialog ([\#8046](https://github.com/matrix-org/matrix-react-sdk/pull/8046)). Fixes #21400 and #19463. Contributed by @luixxiul.
 * Live location share - show loading UI for beacons with start timestamp in the future ([\#8775](https://github.com/matrix-org/matrix-react-sdk/pull/8775)). Fixes #22437. Contributed by @kerryarchibald.
 * Fix scroll jump issue with the composer ([\#8788](https://github.com/matrix-org/matrix-react-sdk/pull/8788)). Fixes #22464.
 * Fix the incorrect nesting of download button on MessageActionBar ([\#8785](https://github.com/matrix-org/matrix-react-sdk/pull/8785)). Contributed by @luixxiul.
 * Revert link color change in composer ([\#8784](https://github.com/matrix-org/matrix-react-sdk/pull/8784)). Fixes #22468.
 * Fix 'Logout' inline link on the splash screen ([\#8770](https://github.com/matrix-org/matrix-react-sdk/pull/8770)). Fixes #22449. Contributed by @luixxiul.
 * Fix disappearing widget poput button when changing the widget layout ([\#8754](https://github.com/matrix-org/matrix-react-sdk/pull/8754)).
 * Reduce gutter with the new read receipt UI ([\#8736](https://github.com/matrix-org/matrix-react-sdk/pull/8736)). Fixes #21890.
 * Add ellipsis effect to hidden beacon status ([\#8755](https://github.com/matrix-org/matrix-react-sdk/pull/8755)). Fixes #22441. Contributed by @luixxiul.
 * Make the pill on the basic message composer compatible with display name in RTL languages ([\#8758](https://github.com/matrix-org/matrix-react-sdk/pull/8758)). Fixes #22445. Contributed by @luixxiul.
 * Prevent the banner text from being selected, replacing the spacing values with the variable ([\#8756](https://github.com/matrix-org/matrix-react-sdk/pull/8756)). Fixes #22442. Contributed by @luixxiul.
 * Ensure the first device on a newly-registered account gets cross-signed properly ([\#8750](https://github.com/matrix-org/matrix-react-sdk/pull/8750)). Fixes #21977. Contributed by @duxovni.
 * Hide live location option in threads composer ([\#8746](https://github.com/matrix-org/matrix-react-sdk/pull/8746)). Fixes #22424. Contributed by @kerryarchibald.
 * Make sure MessageTimestamp is not hidden by EventTile_line on TimelineCard ([\#8748](https://github.com/matrix-org/matrix-react-sdk/pull/8748)). Contributed by @luixxiul.
 * Make PiP motion smoother and react to window resizes correctly ([\#8747](https://github.com/matrix-org/matrix-react-sdk/pull/8747)). Fixes #22292.
 * Prevent Invite and DevTools dialogs from being cut off ([\#8646](https://github.com/matrix-org/matrix-react-sdk/pull/8646)). Fixes #20911 and undefined/matrix-react-sdk#8165. Contributed by @justjanne.
 * Squish event bubble tiles less ([\#8740](https://github.com/matrix-org/matrix-react-sdk/pull/8740)).
 * Use random widget IDs for video rooms ([\#8739](https://github.com/matrix-org/matrix-react-sdk/pull/8739)). Fixes #22417.
 * Fix read avatars overflow from the right chat panel with a maximized widget on bubble message layout ([\#8470](https://github.com/matrix-org/matrix-react-sdk/pull/8470)). Contributed by @luixxiul.
 * Fix `CallView` crash ([\#8735](https://github.com/matrix-org/matrix-react-sdk/pull/8735)). Fixes #22394.

Changes in [1.10.15](https://github.com/vector-im/element-web/releases/tag/v1.10.15) (2022-06-14)
=================================================================================================

## 🐛 Bug Fixes
 * Fix missing element desktop preferences ([\#8798](https://github.com/matrix-org/matrix-react-sdk/pull/8798)). Contributed by @t3chguy.

Changes in [1.10.14](https://github.com/vector-im/element-web/releases/tag/v1.10.14) (2022-06-07)
=================================================================================================

## ✨ Features
 * Make Lao translation available ([\#22358](https://github.com/vector-im/element-web/pull/22358)). Fixes #22327.
 * Option to disable hardware acceleration on Element Desktop ([\#22295](https://github.com/vector-im/element-web/pull/22295)). Contributed by @novocaine.
 * Configure custom home.html via `.well-known/matrix/client["io.element.embedded_pages"]["home_url"]` for all your element-web/desktop users ([\#7790](https://github.com/matrix-org/matrix-react-sdk/pull/7790)). Contributed by @johannes-krude.
 * Live location sharing - open location in OpenStreetMap ([\#8695](https://github.com/matrix-org/matrix-react-sdk/pull/8695)). Contributed by @kerryarchibald.
 * Show a dialog when Jitsi encounters an error ([\#8701](https://github.com/matrix-org/matrix-react-sdk/pull/8701)). Fixes #22284.
 * Add support for setting the `avatar_url` of widgets by integration managers. ([\#8550](https://github.com/matrix-org/matrix-react-sdk/pull/8550)). Contributed by @Fox32.
 * Add an option to ignore (block) a user when reporting their events ([\#8471](https://github.com/matrix-org/matrix-react-sdk/pull/8471)).
 * Add the option to disable hardware acceleration ([\#8655](https://github.com/matrix-org/matrix-react-sdk/pull/8655)). Contributed by @novocaine.
 * Slightly better presentation of read receipts to screen reader users ([\#8662](https://github.com/matrix-org/matrix-react-sdk/pull/8662)). Fixes #22293. Contributed by @pvagner.
 * Add jump to related event context menu item ([\#6775](https://github.com/matrix-org/matrix-react-sdk/pull/6775)). Fixes #19883.
 * Add public room directory hook ([\#8626](https://github.com/matrix-org/matrix-react-sdk/pull/8626)).

## 🐛 Bug Fixes
 * Stop Jitsi if we time out while connecting to a video room ([\#22301](https://github.com/vector-im/element-web/pull/22301)). Fixes #22283.
 * Remove inline margin from UTD error message inside a reply tile on ThreadView ([\#8708](https://github.com/matrix-org/matrix-react-sdk/pull/8708)). Fixes #22376. Contributed by @luixxiul.
 * Move unread notification dots of the threads list to the expected position ([\#8700](https://github.com/matrix-org/matrix-react-sdk/pull/8700)). Fixes #22350. Contributed by @luixxiul.
 * Prevent overflow of grid items on a bubble with UTD generally ([\#8697](https://github.com/matrix-org/matrix-react-sdk/pull/8697)). Contributed by @luixxiul.
 * Create 'Unable To Decrypt' grid layout for hidden events on a bubble layout ([\#8704](https://github.com/matrix-org/matrix-react-sdk/pull/8704)). Fixes #22365. Contributed by @luixxiul.
 * Fix - AccessibleButton does not set disabled attribute ([\#8682](https://github.com/matrix-org/matrix-react-sdk/pull/8682)). Contributed by @kerryarchibald.
 * Fix font not resetting when logging out ([\#8670](https://github.com/matrix-org/matrix-react-sdk/pull/8670)). Fixes #17228.
 * Fix local aliases section of room settings not working for some homeservers (ie ([\#8698](https://github.com/matrix-org/matrix-react-sdk/pull/8698)). Fixes #22337.
 * Align EventTile_line with display name on message bubble ([\#8692](https://github.com/matrix-org/matrix-react-sdk/pull/8692)). Fixes #22343. Contributed by @luixxiul.
 * Convert references to direct chat -> direct message ([\#8694](https://github.com/matrix-org/matrix-react-sdk/pull/8694)). Contributed by @novocaine.
 * Improve combining diacritics for U+20D0 to U+20F0 in Chrome ([\#8687](https://github.com/matrix-org/matrix-react-sdk/pull/8687)).
 * Make the empty thread panel fill BaseCard ([\#8690](https://github.com/matrix-org/matrix-react-sdk/pull/8690)). Fixes #22338. Contributed by @luixxiul.
 * Fix edge case around composer handling gendered facepalm emoji ([\#8686](https://github.com/matrix-org/matrix-react-sdk/pull/8686)).
 * Fix a grid blowout due to nowrap displayName on a bubble with UTD ([\#8688](https://github.com/matrix-org/matrix-react-sdk/pull/8688)). Fixes #21914. Contributed by @luixxiul.
 * Apply the same max-width to image tile on the thread timeline as message bubble ([\#8669](https://github.com/matrix-org/matrix-react-sdk/pull/8669)). Fixes #22313. Contributed by @luixxiul.
 * Fix dropdown button size for picture-in-picture CallView ([\#8680](https://github.com/matrix-org/matrix-react-sdk/pull/8680)). Fixes #22316. Contributed by @luixxiul.
 * Live location sharing - fix square border for image-less avatar (PSF-1052) ([\#8679](https://github.com/matrix-org/matrix-react-sdk/pull/8679)). Contributed by @kerryarchibald.
 * Stop connecting to a video room if the widget messaging disappears ([\#8660](https://github.com/matrix-org/matrix-react-sdk/pull/8660)).
 * Fix file button and audio player overflowing from message bubble ([\#8666](https://github.com/matrix-org/matrix-react-sdk/pull/8666)). Fixes #22308. Contributed by @luixxiul.
 * Don't show broken composer format bar when selection is whitespace ([\#8673](https://github.com/matrix-org/matrix-react-sdk/pull/8673)). Fixes #10788.
 * Fix media upload http 413 handling ([\#8674](https://github.com/matrix-org/matrix-react-sdk/pull/8674)).
 * Fix emoji picker for editing thread responses ([\#8671](https://github.com/matrix-org/matrix-react-sdk/pull/8671)). Fixes matrix-org/element-web-rageshakes#13129.
 * Map attribution while sharing live location is now visible ([\#8621](https://github.com/matrix-org/matrix-react-sdk/pull/8621)). Fixes #22236. Contributed by @weeman1337.
 * Fix info tile overlapping the time stamp on TimelineCard ([\#8639](https://github.com/matrix-org/matrix-react-sdk/pull/8639)). Fixes #22256. Contributed by @luixxiul.
 * Fix position of wide images on IRC / modern layout ([\#8667](https://github.com/matrix-org/matrix-react-sdk/pull/8667)). Fixes #22309. Contributed by @luixxiul.
 * Fix other user's displayName being wrapped on the bubble message layout ([\#8456](https://github.com/matrix-org/matrix-react-sdk/pull/8456)). Fixes #22004. Contributed by @luixxiul.
 * Set spacing declarations to elements in mx_EventTile_mediaLine ([\#8665](https://github.com/matrix-org/matrix-react-sdk/pull/8665)). Fixes #22307. Contributed by @luixxiul.
 * Fix wide image overflowing from the thumbnail container ([\#8663](https://github.com/matrix-org/matrix-react-sdk/pull/8663)). Fixes #22303. Contributed by @luixxiul.
 * Fix styles of "Show all" link button on ReactionsRow ([\#8658](https://github.com/matrix-org/matrix-react-sdk/pull/8658)). Fixes #22300. Contributed by @luixxiul.
 * Automatically log in after registration ([\#8654](https://github.com/matrix-org/matrix-react-sdk/pull/8654)). Fixes #19305. Contributed by @justjanne.
 * Fix offline status in window title not working reliably ([\#8656](https://github.com/matrix-org/matrix-react-sdk/pull/8656)).
 * Align input area with event body's first letter in a thread on IRC/modern layout ([\#8636](https://github.com/matrix-org/matrix-react-sdk/pull/8636)). Fixes #22252. Contributed by @luixxiul.
 * Fix crash on null idp for SSO buttons ([\#8650](https://github.com/matrix-org/matrix-react-sdk/pull/8650)). Contributed by @hughns.
 * Don't open the regular browser or our context menu on right-clicking the `Options` button in the message action bar ([\#8648](https://github.com/matrix-org/matrix-react-sdk/pull/8648)). Fixes #22279.
 * Show notifications even when Element is focused ([\#8590](https://github.com/matrix-org/matrix-react-sdk/pull/8590)). Contributed by @sumnerevans.
 * Remove padding from the buttons on edit message composer of a event tile on a thread ([\#8632](https://github.com/matrix-org/matrix-react-sdk/pull/8632)). Contributed by @luixxiul.
 * ensure metaspace changes correctly notify listeners ([\#8611](https://github.com/matrix-org/matrix-react-sdk/pull/8611)). Fixes #21006. Contributed by @justjanne.
 * Hide image banner on stickers, they have a tooltip already ([\#8641](https://github.com/matrix-org/matrix-react-sdk/pull/8641)). Fixes #22244.
 * Adjust EditMessageComposer style declarations ([\#8631](https://github.com/matrix-org/matrix-react-sdk/pull/8631)). Fixes #22231. Contributed by @luixxiul.

Changes in [1.10.13](https://github.com/vector-im/element-web/releases/tag/v1.10.13) (2022-05-24)
=================================================================================================

## ✨ Features
 * Go to space landing page when clicking on a selected space ([\#6442](https://github.com/matrix-org/matrix-react-sdk/pull/6442)). Fixes #20296.
 * Fall back to untranslated string rather than showing missing translation error ([\#8609](https://github.com/matrix-org/matrix-react-sdk/pull/8609)).
 * Show file name and size on images on hover ([\#6511](https://github.com/matrix-org/matrix-react-sdk/pull/6511)). Fixes #18197.
 * Iterate on search results for message bubbles ([\#7047](https://github.com/matrix-org/matrix-react-sdk/pull/7047)). Fixes #20315.
 * registration: redesign email verification page ([\#8554](https://github.com/matrix-org/matrix-react-sdk/pull/8554)). Fixes #21984.
 * Show full thread message in hover title on thread summary ([\#8568](https://github.com/matrix-org/matrix-react-sdk/pull/8568)). Fixes #22037.
 * Tweak video rooms copy ([\#8582](https://github.com/matrix-org/matrix-react-sdk/pull/8582)). Fixes #22176.
 * Live location share - beacon tooltip in maximised view ([\#8572](https://github.com/matrix-org/matrix-react-sdk/pull/8572)).
 * Add dialog to navigate long room topics ([\#8517](https://github.com/matrix-org/matrix-react-sdk/pull/8517)). Fixes #9623.
 * Change spaceroomfacepile tooltip if memberlist is shown ([\#8571](https://github.com/matrix-org/matrix-react-sdk/pull/8571)). Fixes #17406.
 * Improve message editing UI ([\#8483](https://github.com/matrix-org/matrix-react-sdk/pull/8483)). Fixes #9752 and #22108.
 * Make date changes more obvious ([\#6410](https://github.com/matrix-org/matrix-react-sdk/pull/6410)). Fixes #16221.
 * Enable forwarding static locations ([\#8553](https://github.com/matrix-org/matrix-react-sdk/pull/8553)).
 * Log `TimelinePanel` debugging info when opening the bug report modal ([\#8502](https://github.com/matrix-org/matrix-react-sdk/pull/8502)).
 * Improve welcome screen, add opt-out analytics ([\#8474](https://github.com/matrix-org/matrix-react-sdk/pull/8474)). Fixes #21946.
 * Converting selected text to MD link when pasting a URL ([\#8242](https://github.com/matrix-org/matrix-react-sdk/pull/8242)). Fixes #21634. Contributed by @Sinharitik589.
 * Support Inter on custom themes ([\#8399](https://github.com/matrix-org/matrix-react-sdk/pull/8399)). Fixes #16293.
 * Add a `Copy link` button to the right-click message context-menu labs feature ([\#8527](https://github.com/matrix-org/matrix-react-sdk/pull/8527)).
 * Move widget screenshots labs flag to devtools ([\#8522](https://github.com/matrix-org/matrix-react-sdk/pull/8522)).
 * Remove some labs features which don't get used or create maintenance burden: custom status, multiple integration managers, and do not disturb ([\#8521](https://github.com/matrix-org/matrix-react-sdk/pull/8521)).
 * Add a way to toggle `ScrollPanel` and `TimelinePanel` debug logs ([\#8513](https://github.com/matrix-org/matrix-react-sdk/pull/8513)).
 * Spaces: remove blue beta dot ([\#8511](https://github.com/matrix-org/matrix-react-sdk/pull/8511)). Fixes #22061.
 * Order new search dialog results by recency ([\#8444](https://github.com/matrix-org/matrix-react-sdk/pull/8444)).
 * Improve pills ([\#6398](https://github.com/matrix-org/matrix-react-sdk/pull/6398)). Fixes #16948 and #21281.
 * Add a way to maximize/pin widget from the PiP view ([\#7672](https://github.com/matrix-org/matrix-react-sdk/pull/7672)). Fixes #20723.
 * Iterate video room designs in labs ([\#8499](https://github.com/matrix-org/matrix-react-sdk/pull/8499)).
 * Improve UI/UX in calls ([\#7791](https://github.com/matrix-org/matrix-react-sdk/pull/7791)). Fixes #19937.
 * Add ability to change audio and video devices during a call ([\#7173](https://github.com/matrix-org/matrix-react-sdk/pull/7173)). Fixes #15595.

## 🐛 Bug Fixes
 * Fix video rooms sometimes connecting muted when they shouldn't ([\#22125](https://github.com/vector-im/element-web/pull/22125)).
 * Avoid flashing the 'join conference' button at the user in video rooms ([\#22120](https://github.com/vector-im/element-web/pull/22120)).
 * Fully close Jitsi conferences on errors ([\#22060](https://github.com/vector-im/element-web/pull/22060)).
 * Fix click behavior of notification badges on spaces ([\#8627](https://github.com/matrix-org/matrix-react-sdk/pull/8627)). Fixes #22241.
 * Add missing return values in Read Receipt animation code ([\#8625](https://github.com/matrix-org/matrix-react-sdk/pull/8625)). Fixes #22175.
 * Fix 'continue' button not working after accepting identity server terms of service ([\#8619](https://github.com/matrix-org/matrix-react-sdk/pull/8619)). Fixes #20003.
 * Proactively fix stuck devices in video rooms ([\#8587](https://github.com/matrix-org/matrix-react-sdk/pull/8587)). Fixes #22131.
 * Fix position of the message action bar on left side bubbles ([\#8398](https://github.com/matrix-org/matrix-react-sdk/pull/8398)). Fixes #21879. Contributed by @luixxiul.
 * Fix edge case thread summaries around events without a msgtype ([\#8576](https://github.com/matrix-org/matrix-react-sdk/pull/8576)).
 * Fix favourites metaspace not updating ([\#8594](https://github.com/matrix-org/matrix-react-sdk/pull/8594)). Fixes #22156.
 * Stop spaces from displaying as rooms in new breadcrumbs ([\#8595](https://github.com/matrix-org/matrix-react-sdk/pull/8595)). Fixes #22165.
 * Fix avatar position of hidden event on ThreadView ([\#8592](https://github.com/matrix-org/matrix-react-sdk/pull/8592)). Fixes #22199. Contributed by @luixxiul.
 * Fix MessageTimestamp position next to redacted messages on IRC/modern layout ([\#8591](https://github.com/matrix-org/matrix-react-sdk/pull/8591)). Fixes #22181. Contributed by @luixxiul.
 * Fix padding of messages in threads ([\#8574](https://github.com/matrix-org/matrix-react-sdk/pull/8574)). Contributed by @luixxiul.
 * Enable overflow of hidden events content ([\#8585](https://github.com/matrix-org/matrix-react-sdk/pull/8585)). Fixes #22187. Contributed by @luixxiul.
 * Increase composer line height to avoid cutting off emoji ([\#8583](https://github.com/matrix-org/matrix-react-sdk/pull/8583)). Fixes #22170.
 * Don't consider threads for breaking continuation until actually created ([\#8581](https://github.com/matrix-org/matrix-react-sdk/pull/8581)). Fixes #22164.
 * Fix displaying hidden events on threads  ([\#8555](https://github.com/matrix-org/matrix-react-sdk/pull/8555)). Fixes #22058. Contributed by @luixxiul.
 * Fix button width and align 絵文字 (emoji) on the user panel ([\#8562](https://github.com/matrix-org/matrix-react-sdk/pull/8562)). Fixes #22142. Contributed by @luixxiul.
 * Standardise the margin for settings tabs ([\#7963](https://github.com/matrix-org/matrix-react-sdk/pull/7963)). Fixes #20767. Contributed by @yuktea.
 * Fix room history not being visible even if we have historical keys ([\#8563](https://github.com/matrix-org/matrix-react-sdk/pull/8563)). Fixes #16983.
 * Fix oblong avatars in video room lobbies ([\#8565](https://github.com/matrix-org/matrix-react-sdk/pull/8565)).
 * Update thread summary when latest event gets decrypted ([\#8564](https://github.com/matrix-org/matrix-react-sdk/pull/8564)). Fixes #22151.
 * Fix codepath which can wrongly cause automatic space switch from all rooms ([\#8560](https://github.com/matrix-org/matrix-react-sdk/pull/8560)). Fixes #21373.
 * Fix effect of URL preview toggle not updating live ([\#8561](https://github.com/matrix-org/matrix-react-sdk/pull/8561)). Fixes #22148.
 * Fix visual bugs on AccessSecretStorageDialog ([\#8160](https://github.com/matrix-org/matrix-react-sdk/pull/8160)). Fixes #19426. Contributed by @luixxiul.
 * Fix the width bounce of the clock on the AudioPlayer ([\#8320](https://github.com/matrix-org/matrix-react-sdk/pull/8320)). Fixes #21788. Contributed by @luixxiul.
 * Hide the verification left stroke only on the thread list ([\#8525](https://github.com/matrix-org/matrix-react-sdk/pull/8525)). Fixes #22132. Contributed by @luixxiul.
 * Hide recently_viewed dropdown when other modal opens ([\#8538](https://github.com/matrix-org/matrix-react-sdk/pull/8538)). Contributed by @yaya-usman.
 * Only jump to date after pressing the 'go' button ([\#8548](https://github.com/matrix-org/matrix-react-sdk/pull/8548)). Fixes #20799.
 * Fix download button not working on events that were decrypted too late ([\#8556](https://github.com/matrix-org/matrix-react-sdk/pull/8556)). Fixes #19427.
 * Align thread summary button with bubble messages on the left side ([\#8388](https://github.com/matrix-org/matrix-react-sdk/pull/8388)). Fixes #21873. Contributed by @luixxiul.
 * Fix unresponsive notification toggles ([\#8549](https://github.com/matrix-org/matrix-react-sdk/pull/8549)). Fixes #22109.
 * Set color-scheme property in themes ([\#8547](https://github.com/matrix-org/matrix-react-sdk/pull/8547)). Fixes #22124.
 * Improve the styling of error messages during search initialization. ([\#6899](https://github.com/matrix-org/matrix-react-sdk/pull/6899)). Fixes #19245 and #18164. Contributed by @KalleStruik.
 * Don't leave button tooltips open when closing modals ([\#8546](https://github.com/matrix-org/matrix-react-sdk/pull/8546)). Fixes #22121.
 * update matrix-analytics-events ([\#8543](https://github.com/matrix-org/matrix-react-sdk/pull/8543)).
 * Handle Jitsi Meet crashes more gracefully ([\#8541](https://github.com/matrix-org/matrix-react-sdk/pull/8541)).
 * Fix regression around pasting links ([\#8537](https://github.com/matrix-org/matrix-react-sdk/pull/8537)). Fixes #22117.
 * Fixes suggested room not ellipsized on shrinking ([\#8536](https://github.com/matrix-org/matrix-react-sdk/pull/8536)). Contributed by @yaya-usman.
 * Add global spacing between display name and location body ([\#8523](https://github.com/matrix-org/matrix-react-sdk/pull/8523)). Fixes #22111. Contributed by @luixxiul.
 * Add box-shadow to the reply preview on the main (left) panel only ([\#8397](https://github.com/matrix-org/matrix-react-sdk/pull/8397)). Fixes #21894. Contributed by @luixxiul.
 * Set line-height: 1 to RedactedBody inside GenericEventListSummary for IRC/modern layout ([\#8529](https://github.com/matrix-org/matrix-react-sdk/pull/8529)). Fixes #22112. Contributed by @luixxiul.
 * Fix position of timestamp on the chat panel in IRC layout and message edits history modal window ([\#8464](https://github.com/matrix-org/matrix-react-sdk/pull/8464)). Fixes #22011 and #22014. Contributed by @luixxiul.
 * Fix unexpected and inconsistent inheritance of line-height property for mx_TextualEvent ([\#8485](https://github.com/matrix-org/matrix-react-sdk/pull/8485)). Fixes #22041. Contributed by @luixxiul.
 * Set the same margin to the right side of NewRoomIntro on TimelineCard ([\#8453](https://github.com/matrix-org/matrix-react-sdk/pull/8453)). Contributed by @luixxiul.
 * Remove duplicate tooltip from user pills ([\#8512](https://github.com/matrix-org/matrix-react-sdk/pull/8512)).
 * Set max-width for MLocationBody and MLocationBody_map by default ([\#8519](https://github.com/matrix-org/matrix-react-sdk/pull/8519)). Fixes #21983. Contributed by @luixxiul.
 * Simplify ReplyPreview UI implementation ([\#8516](https://github.com/matrix-org/matrix-react-sdk/pull/8516)). Fixes #22091. Contributed by @luixxiul.
 * Fix thread summary overflow on narrow message panel on bubble message layout ([\#8520](https://github.com/matrix-org/matrix-react-sdk/pull/8520)). Fixes #22097. Contributed by @luixxiul.
 * Live location sharing - refresh beacon timers on tab becoming active ([\#8515](https://github.com/matrix-org/matrix-react-sdk/pull/8515)).
 * Enlarge emoji again ([\#8509](https://github.com/matrix-org/matrix-react-sdk/pull/8509)). Fixes #22086.
 * Order receipts with the most recent on the right ([\#8506](https://github.com/matrix-org/matrix-react-sdk/pull/8506)). Fixes #22044.
 * Disconnect from video rooms when leaving ([\#8500](https://github.com/matrix-org/matrix-react-sdk/pull/8500)).
 * Fix soft crash around threads when room isn't yet in store ([\#8496](https://github.com/matrix-org/matrix-react-sdk/pull/8496)). Fixes #22047.
 * Fix reading of cached room device setting values ([\#8491](https://github.com/matrix-org/matrix-react-sdk/pull/8491)).
 * Add loading spinners to threads panels ([\#8490](https://github.com/matrix-org/matrix-react-sdk/pull/8490)). Fixes #21335.
 * Fix forwarding UI papercuts ([\#8482](https://github.com/matrix-org/matrix-react-sdk/pull/8482)). Fixes #17616.

Changes in [1.10.12](https://github.com/vector-im/element-web/releases/tag/v1.10.12) (2022-05-10)
=================================================================================================

## ✨ Features
 * Made the location map change the cursor to a pointer so it looks like it's clickable (https ([\#8451](https://github.com/matrix-org/matrix-react-sdk/pull/8451)). Fixes #21991. Contributed by @Odyssey346.
 * Implement improved spacing for the thread list and timeline ([\#8337](https://github.com/matrix-org/matrix-react-sdk/pull/8337)). Fixes #21759. Contributed by @luixxiul.
 * LLS: expose way to enable live sharing labs flag from location dialog ([\#8416](https://github.com/matrix-org/matrix-react-sdk/pull/8416)).
 * Fix source text boxes in View Source modal should have full width ([\#8425](https://github.com/matrix-org/matrix-react-sdk/pull/8425)). Fixes #21938. Contributed by @EECvision.
 * Read Receipts: never show +1, if it’s just 4, show all of them ([\#8428](https://github.com/matrix-org/matrix-react-sdk/pull/8428)). Fixes #21935.
 * Add opt-in analytics to onboarding tasks ([\#8409](https://github.com/matrix-org/matrix-react-sdk/pull/8409)). Fixes #21705.
 * Allow user to control if they are signed out of all devices when changing password ([\#8259](https://github.com/matrix-org/matrix-react-sdk/pull/8259)). Fixes #2671.
 * Implement new Read Receipt design ([\#8389](https://github.com/matrix-org/matrix-react-sdk/pull/8389)). Fixes #20574.
 * Stick connected video rooms to the top of the room list ([\#8353](https://github.com/matrix-org/matrix-react-sdk/pull/8353)).
 * LLS: fix jumpy maximised map ([\#8387](https://github.com/matrix-org/matrix-react-sdk/pull/8387)).
 * Persist audio and video mute state in video rooms ([\#8376](https://github.com/matrix-org/matrix-react-sdk/pull/8376)).
 * Forcefully disconnect from video rooms on logout and tab close ([\#8375](https://github.com/matrix-org/matrix-react-sdk/pull/8375)).
 * Add local echo of connected devices in video rooms ([\#8368](https://github.com/matrix-org/matrix-react-sdk/pull/8368)).
 * Improve text of account deactivation dialog ([\#8371](https://github.com/matrix-org/matrix-react-sdk/pull/8371)). Fixes #17421.
 * Live location sharing: own live beacon status on maximised view ([\#8374](https://github.com/matrix-org/matrix-react-sdk/pull/8374)).
 * Show a lobby screen in video rooms ([\#8287](https://github.com/matrix-org/matrix-react-sdk/pull/8287)).
 * Settings toggle to disable Composer Markdown ([\#8358](https://github.com/matrix-org/matrix-react-sdk/pull/8358)). Fixes #20321.
 * Cache localStorage objects for SettingsStore ([\#8366](https://github.com/matrix-org/matrix-react-sdk/pull/8366)).
 * Bring `View Source` back from behind developer mode ([\#8369](https://github.com/matrix-org/matrix-react-sdk/pull/8369)). Fixes #21771.

## 🐛 Bug Fixes
 * Fix Jitsi Meet getting wedged at startup in some cases ([\#21995](https://github.com/vector-im/element-web/pull/21995)).
 * Fix camera getting muted when disconnecting from a video room ([\#21958](https://github.com/vector-im/element-web/pull/21958)).
 * Fix race conditions around threads ([\#8448](https://github.com/matrix-org/matrix-react-sdk/pull/8448)). Fixes #21627.
 * Fix reading of cached room device setting values ([\#8495](https://github.com/matrix-org/matrix-react-sdk/pull/8495)).
 * Fix issue with dispatch happening mid-dispatch due to js-sdk emit ([\#8473](https://github.com/matrix-org/matrix-react-sdk/pull/8473)). Fixes #22019.
 * Match MSC behaviour for threads when disabled (thread-aware mode) ([\#8476](https://github.com/matrix-org/matrix-react-sdk/pull/8476)). Fixes #22033.
 * Specify position of DisambiguatedProfile inside a thread on bubble message layout ([\#8452](https://github.com/matrix-org/matrix-react-sdk/pull/8452)). Fixes #21998. Contributed by @luixxiul.
 * Location sharing: do not trackuserlocation in location picker ([\#8466](https://github.com/matrix-org/matrix-react-sdk/pull/8466)). Fixes #22013.
 * fix text and map indent in thread view ([\#8462](https://github.com/matrix-org/matrix-react-sdk/pull/8462)). Fixes #21997.
 * Live location sharing: don't group beacon info with room creation summary ([\#8468](https://github.com/matrix-org/matrix-react-sdk/pull/8468)).
 * Don't linkify code blocks ([\#7859](https://github.com/matrix-org/matrix-react-sdk/pull/7859)). Fixes #9613.
 * read receipts: improve tooltips to show names of users ([\#8438](https://github.com/matrix-org/matrix-react-sdk/pull/8438)). Fixes #21940.
 * Fix poll overflowing a reply tile on bubble message layout ([\#8459](https://github.com/matrix-org/matrix-react-sdk/pull/8459)). Fixes #22005. Contributed by @luixxiul.
 * Fix text link buttons on UserInfo panel ([\#8247](https://github.com/matrix-org/matrix-react-sdk/pull/8247)). Fixes #21702. Contributed by @luixxiul.
 * Clear local storage settings handler cache on logout ([\#8454](https://github.com/matrix-org/matrix-react-sdk/pull/8454)). Fixes #21994.
 * Fix jump to bottom button being always displayed in non-overflowing timelines ([\#8460](https://github.com/matrix-org/matrix-react-sdk/pull/8460)). Fixes #22003.
 * fix timeline search with empty text box should do nothing ([\#8262](https://github.com/matrix-org/matrix-react-sdk/pull/8262)). Fixes #21714. Contributed by @EECvision.
 * Fixes "space panel kebab menu is rendered out of view on sub spaces"  ([\#8350](https://github.com/matrix-org/matrix-react-sdk/pull/8350)). Contributed by @yaya-usman.
 * Add margin to the location map inside ThreadView ([\#8442](https://github.com/matrix-org/matrix-react-sdk/pull/8442)). Fixes #21982. Contributed by @luixxiul.
 * Patch: "Reloading the registration page should warn about data loss" ([\#8377](https://github.com/matrix-org/matrix-react-sdk/pull/8377)). Contributed by @yaya-usman.
 * Live location sharing: fix safari timestamps pt 2 ([\#8443](https://github.com/matrix-org/matrix-react-sdk/pull/8443)).
 * Fix issue with thread notification state ignoring initial events ([\#8417](https://github.com/matrix-org/matrix-react-sdk/pull/8417)). Fixes #21927.
 * Fix event text overflow on bubble message layout ([\#8391](https://github.com/matrix-org/matrix-react-sdk/pull/8391)). Fixes #21882. Contributed by @luixxiul.
 * Disable the message action bar when hovering over the 1px border between threads on the list ([\#8429](https://github.com/matrix-org/matrix-react-sdk/pull/8429)). Fixes #21955. Contributed by @luixxiul.
 * correctly align read receipts to state events in bubble layout ([\#8419](https://github.com/matrix-org/matrix-react-sdk/pull/8419)). Fixes #21899.
 * Fix issue with underfilled timelines when barren of content ([\#8432](https://github.com/matrix-org/matrix-react-sdk/pull/8432)). Fixes #21930.
 * Fix baseline misalignment of thread panel summary by deduplication ([\#8413](https://github.com/matrix-org/matrix-react-sdk/pull/8413)).
 * Fix editing of non-html replies ([\#8418](https://github.com/matrix-org/matrix-react-sdk/pull/8418)). Fixes #21928.
 * Read Receipts "Fall from the Sky" ([\#8414](https://github.com/matrix-org/matrix-react-sdk/pull/8414)). Fixes #21888.
 * Make read receipts handle nullable roomMembers correctly ([\#8410](https://github.com/matrix-org/matrix-react-sdk/pull/8410)). Fixes #21896.
 * Don't form continuations on either side of a thread root ([\#8408](https://github.com/matrix-org/matrix-react-sdk/pull/8408)). Fixes #20908.
 * Fix centering issue with sticker placeholder ([\#8404](https://github.com/matrix-org/matrix-react-sdk/pull/8404)). Fixes #18014 and #6449.
 * Disable download option on <video/> , preferring dedicated download button ([\#8403](https://github.com/matrix-org/matrix-react-sdk/pull/8403)). Fixes #21902.
 * Fix infinite loop when pinning/unpinning persistent widgets ([\#8396](https://github.com/matrix-org/matrix-react-sdk/pull/8396)). Fixes #21864.
 * Tweak ReadReceiptGroup to better handle disambiguation ([\#8402](https://github.com/matrix-org/matrix-react-sdk/pull/8402)). Fixes #21897.
 * stop the bottom edge of buttons getting clipped in devtools ([\#8400](https://github.com/matrix-org/matrix-react-sdk/pull/8400)).
 * Fix issue with threads timelines with few events cropping events ([\#8392](https://github.com/matrix-org/matrix-react-sdk/pull/8392)). Fixes #20594.
 * Changed font-weight to 400 to support light weight font ([\#8345](https://github.com/matrix-org/matrix-react-sdk/pull/8345)). Fixes #21171. Contributed by @goelesha.
 * Fix issue with thread panel not updating when it loads on first render ([\#8382](https://github.com/matrix-org/matrix-react-sdk/pull/8382)). Fixes #21737.
 * fix: "Mention highlight and cursor hover highlight has different corner radius" ([\#8384](https://github.com/matrix-org/matrix-react-sdk/pull/8384)). Contributed by @yaya-usman.
 * Fix regression around haveRendererForEvent for hidden events ([\#8379](https://github.com/matrix-org/matrix-react-sdk/pull/8379)). Fixes #21862 and #21725.
 * Fix regression around the room list treeview keyboard a11y ([\#8385](https://github.com/matrix-org/matrix-react-sdk/pull/8385)). Fixes #21436.
 * Remove float property to let the margin between events appear on bubble message layout ([\#8373](https://github.com/matrix-org/matrix-react-sdk/pull/8373)). Fixes #21861. Contributed by @luixxiul.
 * Fix race in Registration between server change and flows fetch ([\#8359](https://github.com/matrix-org/matrix-react-sdk/pull/8359)). Fixes #21800.
 * fix rainbow breaks compound emojis ([\#8245](https://github.com/matrix-org/matrix-react-sdk/pull/8245)). Fixes #21371. Contributed by @EECvision.
 * Fix RightPanelStore handling first room on app launch wrong ([\#8370](https://github.com/matrix-org/matrix-react-sdk/pull/8370)). Fixes #21741.
 * Fix UnknownBody error message unalignment ([\#8346](https://github.com/matrix-org/matrix-react-sdk/pull/8346)). Fixes #21828. Contributed by @luixxiul.
 * Use -webkit-line-clamp for the room header topic overflow ([\#8367](https://github.com/matrix-org/matrix-react-sdk/pull/8367)). Fixes #21852. Contributed by @luixxiul.
 * Fix issue with ServerInfo crashing the modal ([\#8364](https://github.com/matrix-org/matrix-react-sdk/pull/8364)).
 * Fixes around threads beta in degraded mode ([\#8319](https://github.com/matrix-org/matrix-react-sdk/pull/8319)). Fixes #21762.

Changes in [1.10.11](https://github.com/vector-im/element-web/releases/tag/v1.10.11) (2022-04-26)
=================================================================================================

## ✨ Features
 * Handle forced disconnects from Jitsi ([\#21697](https://github.com/vector-im/element-web/pull/21697)). Fixes #21517.
 * Improve performance of switching to rooms with lots of servers and ACLs ([\#8347](https://github.com/matrix-org/matrix-react-sdk/pull/8347)).
 * Avoid a reflow when setting caret position on an empty composer ([\#8348](https://github.com/matrix-org/matrix-react-sdk/pull/8348)).
 * Add message right-click context menu as a labs feature ([\#5672](https://github.com/matrix-org/matrix-react-sdk/pull/5672)).
 * Live location sharing - basic maximised beacon map ([\#8310](https://github.com/matrix-org/matrix-react-sdk/pull/8310)).
 * Live location sharing - render users own beacons in timeline ([\#8296](https://github.com/matrix-org/matrix-react-sdk/pull/8296)).
 * Improve Threads beta around degraded mode ([\#8318](https://github.com/matrix-org/matrix-react-sdk/pull/8318)).
 * Live location sharing -  beacon in timeline happy path ([\#8285](https://github.com/matrix-org/matrix-react-sdk/pull/8285)).
 * Add copy button to View Source screen ([\#8278](https://github.com/matrix-org/matrix-react-sdk/pull/8278)). Fixes #21482. Contributed by @olivialivia.
 * Add heart effect ([\#6188](https://github.com/matrix-org/matrix-react-sdk/pull/6188)). Contributed by @CicadaCinema.
 * Update new room icon ([\#8239](https://github.com/matrix-org/matrix-react-sdk/pull/8239)).

## 🐛 Bug Fixes
 * Fix: "Code formatting button does not escape backticks" ([\#8181](https://github.com/matrix-org/matrix-react-sdk/pull/8181)). Contributed by @yaya-usman.
 * Fix beta indicator dot causing excessive CPU usage ([\#8340](https://github.com/matrix-org/matrix-react-sdk/pull/8340)). Fixes #21793.
 * Fix overlapping timestamps on empty messages ([\#8205](https://github.com/matrix-org/matrix-react-sdk/pull/8205)). Fixes #21381. Contributed by @goelesha.
 * Fix power selector not showing up in user info when state_default undefined ([\#8297](https://github.com/matrix-org/matrix-react-sdk/pull/8297)). Fixes #21669.
 * Avoid looking up settings during timeline rendering ([\#8313](https://github.com/matrix-org/matrix-react-sdk/pull/8313)). Fixes #21740.
 * Fix a soft crash with video rooms ([\#8333](https://github.com/matrix-org/matrix-react-sdk/pull/8333)).
 * Fixes call tiles overflow ([\#8096](https://github.com/matrix-org/matrix-react-sdk/pull/8096)). Fixes #20254. Contributed by @luixxiul.
 * Fix a bug with emoji autocomplete sorting where adding the final "&#58;" would cause the emoji with the typed shortcode to no longer be at the top of the autocomplete list. ([\#8086](https://github.com/matrix-org/matrix-react-sdk/pull/8086)). Fixes #19302. Contributed by @commonlawfeature.
 * Fix image preview sizing for edge cases ([\#8322](https://github.com/matrix-org/matrix-react-sdk/pull/8322)). Fixes #20088.
 * Refactor SecurityRoomSettingsTab and remove unused state ([\#8306](https://github.com/matrix-org/matrix-react-sdk/pull/8306)). Fixes matrix-org/element-web-rageshakes#12002.
 * Don't show the prompt to enable desktop notifications immediately after registration ([\#8274](https://github.com/matrix-org/matrix-react-sdk/pull/8274)).
 * Stop tracking threads if threads support is disabled ([\#8308](https://github.com/matrix-org/matrix-react-sdk/pull/8308)). Fixes #21766.
 * Fix some issues with threads rendering ([\#8305](https://github.com/matrix-org/matrix-react-sdk/pull/8305)). Fixes #21670.
 * Fix threads rendering issue in Safari ([\#8298](https://github.com/matrix-org/matrix-react-sdk/pull/8298)). Fixes #21757.
 * Fix space panel width change on hovering over space item ([\#8299](https://github.com/matrix-org/matrix-react-sdk/pull/8299)). Fixes #19891.
 * Hide the reply in thread button in deployments where beta is forcibly disabled ([\#8294](https://github.com/matrix-org/matrix-react-sdk/pull/8294)). Fixes #21753.
 * Prevent soft crash around room list header context menu when space changes ([\#8289](https://github.com/matrix-org/matrix-react-sdk/pull/8289)). Fixes matrix-org/element-web-rageshakes#11416, matrix-org/element-web-rageshakes#11692, matrix-org/element-web-rageshakes#11739, matrix-org/element-web-rageshakes#11772, matrix-org/element-web-rageshakes#11891 matrix-org/element-web-rageshakes#11858 and matrix-org/element-web-rageshakes#11456.
 * When selecting reply in thread on a thread response open existing thread ([\#8291](https://github.com/matrix-org/matrix-react-sdk/pull/8291)). Fixes #21743.
 * Handle thread bundled relationships coming from the server via MSC3666 ([\#8292](https://github.com/matrix-org/matrix-react-sdk/pull/8292)). Fixes #21450.
 * Fix: Avatar preview does not update when same file is selected repeatedly ([\#8288](https://github.com/matrix-org/matrix-react-sdk/pull/8288)). Fixes #20098.
 * Fix a bug where user gets a warning when changing powerlevel from **Admin** to **custom level (100)** ([\#8248](https://github.com/matrix-org/matrix-react-sdk/pull/8248)). Fixes #21682. Contributed by @Jumeb.
 * Use a consistent alignment for all text items in a list ([\#8276](https://github.com/matrix-org/matrix-react-sdk/pull/8276)). Fixes #21731. Contributed by @luixxiul.
 * Fixes button labels being collapsed per a character in CJK languages ([\#8212](https://github.com/matrix-org/matrix-react-sdk/pull/8212)). Fixes #21287. Contributed by @luixxiul.
 * Fix: Remove jittery timeline scrolling after jumping to an event ([\#8263](https://github.com/matrix-org/matrix-react-sdk/pull/8263)).
 * Fix regression of edits showing up in the timeline with hidden events shown ([\#8260](https://github.com/matrix-org/matrix-react-sdk/pull/8260)). Fixes #21694.
 * Fix reporting events not working ([\#8257](https://github.com/matrix-org/matrix-react-sdk/pull/8257)). Fixes #21713.
 * Make Jitsi widgets in video rooms immutable ([\#8244](https://github.com/matrix-org/matrix-react-sdk/pull/8244)). Fixes #21647.
 * Fix: Ensure links to events scroll the correct events into view ([\#8250](https://github.com/matrix-org/matrix-react-sdk/pull/8250)). Fixes #19934.

Changes in [1.10.10](https://github.com/vector-im/element-web/releases/tag/v1.10.10) (2022-04-14)
=================================================================================================

## 🐛 Bug Fixes
 * Fixes around threads beta in degraded mode ([\#8319](https://github.com/matrix-org/matrix-react-sdk/pull/8319)). Fixes #21762.

Changes in [1.10.9](https://github.com/vector-im/element-web/releases/tag/v1.10.9) (2022-04-12)
===============================================================================================

## ✨ Features
 * Release threads as a beta feature ([\#8081](https://github.com/matrix-org/matrix-react-sdk/pull/8081)). Fixes #21351.
 * More video rooms design updates ([\#8222](https://github.com/matrix-org/matrix-react-sdk/pull/8222)).
 * Update video rooms to new design specs ([\#8207](https://github.com/matrix-org/matrix-react-sdk/pull/8207)). Fixes #21515, #21516 #21519 and #21526.
 * Live Location Sharing - left panel warning with error ([\#8201](https://github.com/matrix-org/matrix-react-sdk/pull/8201)).
 * Live location sharing - Stop publishing location to beacons with consecutive errors ([\#8194](https://github.com/matrix-org/matrix-react-sdk/pull/8194)).
 * Live location sharing: allow retry when stop sharing fails ([\#8193](https://github.com/matrix-org/matrix-react-sdk/pull/8193)).
 * Allow voice messages to be scrubbed in the timeline ([\#8079](https://github.com/matrix-org/matrix-react-sdk/pull/8079)). Fixes #18713.
 * Live location sharing - stop sharing to beacons in rooms you left ([\#8187](https://github.com/matrix-org/matrix-react-sdk/pull/8187)).
 * Allow sending and thumbnailing AVIF images ([\#8172](https://github.com/matrix-org/matrix-react-sdk/pull/8172)).
 * Live location sharing - handle geolocation errors ([\#8179](https://github.com/matrix-org/matrix-react-sdk/pull/8179)).
 * Show voice room participants when not connected ([\#8136](https://github.com/matrix-org/matrix-react-sdk/pull/8136)). Fixes #21513.
 * Add margins between labs sections ([\#8169](https://github.com/matrix-org/matrix-react-sdk/pull/8169)).
 * Live location sharing - send geolocation beacon events - happy path ([\#8127](https://github.com/matrix-org/matrix-react-sdk/pull/8127)).
 * Add support for Animated (A)PNG ([\#8158](https://github.com/matrix-org/matrix-react-sdk/pull/8158)). Fixes #12967.
 * Don't form continuations from thread roots ([\#8166](https://github.com/matrix-org/matrix-react-sdk/pull/8166)). Fixes #20908.
 * Improve handling of animated GIF and WEBP images ([\#8153](https://github.com/matrix-org/matrix-react-sdk/pull/8153)). Fixes #16193 and #6684.
 * Wire up file preview for video files ([\#8140](https://github.com/matrix-org/matrix-react-sdk/pull/8140)). Fixes #21539.
 * When showing thread, always auto-focus its composer ([\#8115](https://github.com/matrix-org/matrix-react-sdk/pull/8115)). Fixes #21438.
 * Live location sharing - refresh beacon expiry in room ([\#8116](https://github.com/matrix-org/matrix-react-sdk/pull/8116)).
 * Use styled mxids in member list v2 ([\#8110](https://github.com/matrix-org/matrix-react-sdk/pull/8110)). Fixes #14825. Contributed by @SimonBrandner.
 * Delete groups (legacy communities system) ([\#8027](https://github.com/matrix-org/matrix-react-sdk/pull/8027)). Fixes #17532.
 * Add a prototype of voice rooms in labs ([\#8084](https://github.com/matrix-org/matrix-react-sdk/pull/8084)). Fixes #3546.

## 🐛 Bug Fixes
 * Avoid flashing the Jitsi prejoin screen at the user before skipping it ([\#21665](https://github.com/vector-im/element-web/pull/21665)).
 * Fix editing `<ol>` tags with a non-1 start attribute ([\#8211](https://github.com/matrix-org/matrix-react-sdk/pull/8211)). Fixes #21625.
 * Fix URL previews being enabled when room first created ([\#8227](https://github.com/matrix-org/matrix-react-sdk/pull/8227)). Fixes #21659.
 * Don't use m.call for Jitsi video rooms ([\#8223](https://github.com/matrix-org/matrix-react-sdk/pull/8223)).
 * Scale emoji with size of surrounding text ([\#8224](https://github.com/matrix-org/matrix-react-sdk/pull/8224)).
 * Make "Jump to date" translatable ([\#8218](https://github.com/matrix-org/matrix-react-sdk/pull/8218)).
 * Normalize call buttons ([\#8129](https://github.com/matrix-org/matrix-react-sdk/pull/8129)). Fixes #21493. Contributed by @luixxiul.
 * Show room preview bar with maximised widgets ([\#8180](https://github.com/matrix-org/matrix-react-sdk/pull/8180)). Fixes #21542.
 * Update more strings to not wrongly mention room when it is/could be a space ([\#7722](https://github.com/matrix-org/matrix-react-sdk/pull/7722)). Fixes #20243 and #20910.
 * Fix issue with redacting via edit composer flow causing stuck editStates ([\#8184](https://github.com/matrix-org/matrix-react-sdk/pull/8184)).
 * Fix some image/video scroll jumps ([\#8182](https://github.com/matrix-org/matrix-react-sdk/pull/8182)).
 * Fix "react error on share dialog" ([\#8170](https://github.com/matrix-org/matrix-react-sdk/pull/8170)). Contributed by @yaya-usman.
 * Fix disambiguated profile in threads in bubble layout ([\#8168](https://github.com/matrix-org/matrix-react-sdk/pull/8168)). Fixes #21570. Contributed by @SimonBrandner.
 * Responsive BetaCard on Labs ([\#8154](https://github.com/matrix-org/matrix-react-sdk/pull/8154)). Fixes #21554. Contributed by @luixxiul.
 * Display button as inline in room directory dialog ([\#8164](https://github.com/matrix-org/matrix-react-sdk/pull/8164)). Fixes #21567. Contributed by @luixxiul.
 * Null guard TimelinePanel unmount edge ([\#8171](https://github.com/matrix-org/matrix-react-sdk/pull/8171)).
 * Fix beta pill label breaking ([\#8162](https://github.com/matrix-org/matrix-react-sdk/pull/8162)). Fixes #21566. Contributed by @luixxiul.
 * Strip relations when forwarding ([\#7929](https://github.com/matrix-org/matrix-react-sdk/pull/7929)). Fixes #19769, #18067 #21015 and #10924.
 * Don't try (and fail) to show replies for redacted events ([\#8141](https://github.com/matrix-org/matrix-react-sdk/pull/8141)). Fixes #21435.
 * Fix 3pid member info for space member list ([\#8128](https://github.com/matrix-org/matrix-react-sdk/pull/8128)). Fixes #21534.
 * Set max-width to user context menu ([\#8089](https://github.com/matrix-org/matrix-react-sdk/pull/8089)). Fixes #21486. Contributed by @luixxiul.
 * Fix issue with falsey hrefs being sent in events ([\#8113](https://github.com/matrix-org/matrix-react-sdk/pull/8113)). Fixes #21417.
 * Make video sizing consistent with images ([\#8102](https://github.com/matrix-org/matrix-react-sdk/pull/8102)). Fixes #20072.

Changes in [1.10.9-rc.4](https://github.com/vector-im/element-web/releases/tag/v1.10.9-rc.4) (2022-04-11)
=========================================================================================================

Changes in [1.10.9-rc.3](https://github.com/vector-im/element-web/releases/tag/v1.10.9-rc.3) (2022-04-08)
=========================================================================================================

Changes in [1.10.9-rc.2](https://github.com/vector-im/element-web/releases/tag/v1.10.9-rc.2) (2022-04-06)
=========================================================================================================

Changes in [1.10.9-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.10.9-rc.1) (2022-04-05)
=========================================================================================================

## ✨ Features
 * Release threads as a beta feature ([\#8081](https://github.com/matrix-org/matrix-react-sdk/pull/8081)). Fixes #21351.
 * More video rooms design updates ([\#8222](https://github.com/matrix-org/matrix-react-sdk/pull/8222)).
 * Update video rooms to new design specs ([\#8207](https://github.com/matrix-org/matrix-react-sdk/pull/8207)). Fixes #21515, #21516 #21519 and #21526.
 * Live Location Sharing - left panel warning with error ([\#8201](https://github.com/matrix-org/matrix-react-sdk/pull/8201)).
 * Live location sharing - Stop publishing location to beacons with consecutive errors ([\#8194](https://github.com/matrix-org/matrix-react-sdk/pull/8194)).
 * Live location sharing: allow retry when stop sharing fails ([\#8193](https://github.com/matrix-org/matrix-react-sdk/pull/8193)).
 * Allow voice messages to be scrubbed in the timeline ([\#8079](https://github.com/matrix-org/matrix-react-sdk/pull/8079)). Fixes #18713.
 * Live location sharing - stop sharing to beacons in rooms you left ([\#8187](https://github.com/matrix-org/matrix-react-sdk/pull/8187)).
 * Allow sending and thumbnailing AVIF images ([\#8172](https://github.com/matrix-org/matrix-react-sdk/pull/8172)).
 * Live location sharing - handle geolocation errors ([\#8179](https://github.com/matrix-org/matrix-react-sdk/pull/8179)).
 * Show voice room participants when not connected ([\#8136](https://github.com/matrix-org/matrix-react-sdk/pull/8136)). Fixes #21513.
 * Add margins between labs sections ([\#8169](https://github.com/matrix-org/matrix-react-sdk/pull/8169)).
 * Live location sharing - send geolocation beacon events - happy path ([\#8127](https://github.com/matrix-org/matrix-react-sdk/pull/8127)).
 * Add support for Animated (A)PNG ([\#8158](https://github.com/matrix-org/matrix-react-sdk/pull/8158)). Fixes #12967.
 * Don't form continuations from thread roots ([\#8166](https://github.com/matrix-org/matrix-react-sdk/pull/8166)). Fixes #20908.
 * Improve handling of animated GIF and WEBP images ([\#8153](https://github.com/matrix-org/matrix-react-sdk/pull/8153)). Fixes #16193 and #6684.
 * Wire up file preview for video files ([\#8140](https://github.com/matrix-org/matrix-react-sdk/pull/8140)). Fixes #21539.
 * When showing thread, always auto-focus its composer ([\#8115](https://github.com/matrix-org/matrix-react-sdk/pull/8115)). Fixes #21438.
 * Live location sharing - refresh beacon expiry in room ([\#8116](https://github.com/matrix-org/matrix-react-sdk/pull/8116)).
 * Use styled mxids in member list v2 ([\#8110](https://github.com/matrix-org/matrix-react-sdk/pull/8110)). Fixes #14825. Contributed by @SimonBrandner.
 * Delete groups (legacy communities system) ([\#8027](https://github.com/matrix-org/matrix-react-sdk/pull/8027)). Fixes #17532.
 * Add a prototype of voice rooms in labs ([\#8084](https://github.com/matrix-org/matrix-react-sdk/pull/8084)). Fixes #3546.

## 🐛 Bug Fixes
 * Fix URL previews being enabled when room first created ([\#8227](https://github.com/matrix-org/matrix-react-sdk/pull/8227)). Fixes #21659.
 * Don't use m.call for Jitsi video rooms ([\#8223](https://github.com/matrix-org/matrix-react-sdk/pull/8223)).
 * Scale emoji with size of surrounding text ([\#8224](https://github.com/matrix-org/matrix-react-sdk/pull/8224)).
 * Make "Jump to date" translatable ([\#8218](https://github.com/matrix-org/matrix-react-sdk/pull/8218)).
 * Normalize call buttons ([\#8129](https://github.com/matrix-org/matrix-react-sdk/pull/8129)). Fixes #21493. Contributed by @luixxiul.
 * Fix editing <ol> tags with a non-1 start attribute ([\#8211](https://github.com/matrix-org/matrix-react-sdk/pull/8211)). Fixes #21625.
 * Show room preview bar with maximised widgets ([\#8180](https://github.com/matrix-org/matrix-react-sdk/pull/8180)). Fixes #21542.
 * Update more strings to not wrongly mention room when it is/could be a space ([\#7722](https://github.com/matrix-org/matrix-react-sdk/pull/7722)). Fixes #20243 and #20910.
 * Fix issue with redacting via edit composer flow causing stuck editStates ([\#8184](https://github.com/matrix-org/matrix-react-sdk/pull/8184)).
 * Fix some image/video scroll jumps ([\#8182](https://github.com/matrix-org/matrix-react-sdk/pull/8182)).
 * Fix "react error on share dialog" ([\#8170](https://github.com/matrix-org/matrix-react-sdk/pull/8170)). Contributed by @yaya-usman.
 * Fix disambiguated profile in threads in bubble layout ([\#8168](https://github.com/matrix-org/matrix-react-sdk/pull/8168)). Fixes #21570. Contributed by @SimonBrandner.
 * Responsive BetaCard on Labs ([\#8154](https://github.com/matrix-org/matrix-react-sdk/pull/8154)). Fixes #21554. Contributed by @luixxiul.
 * Display button as inline in room directory dialog ([\#8164](https://github.com/matrix-org/matrix-react-sdk/pull/8164)). Fixes #21567. Contributed by @luixxiul.
 * Null guard TimelinePanel unmount edge ([\#8171](https://github.com/matrix-org/matrix-react-sdk/pull/8171)).
 * Fix beta pill label breaking ([\#8162](https://github.com/matrix-org/matrix-react-sdk/pull/8162)). Fixes #21566. Contributed by @luixxiul.
 * Strip relations when forwarding ([\#7929](https://github.com/matrix-org/matrix-react-sdk/pull/7929)). Fixes #19769, #18067 #21015 and #10924.
 * Don't try (and fail) to show replies for redacted events ([\#8141](https://github.com/matrix-org/matrix-react-sdk/pull/8141)). Fixes #21435.
 * Fix 3pid member info for space member list ([\#8128](https://github.com/matrix-org/matrix-react-sdk/pull/8128)). Fixes #21534.
 * Set max-width to user context menu ([\#8089](https://github.com/matrix-org/matrix-react-sdk/pull/8089)). Fixes #21486. Contributed by @luixxiul.
 * Fix issue with falsey hrefs being sent in events ([\#8113](https://github.com/matrix-org/matrix-react-sdk/pull/8113)). Fixes #21417.
 * Make video sizing consistent with images ([\#8102](https://github.com/matrix-org/matrix-react-sdk/pull/8102)). Fixes #20072.

Changes in [1.10.8-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.10.8-rc.1) (2022-03-22)
=========================================================================================================

## ✨ Features
 * Live location sharing: live share warning in room ([\#8100](https://github.com/matrix-org/matrix-react-sdk/pull/8100)).
 * Add simple live share warning ([\#8066](https://github.com/matrix-org/matrix-react-sdk/pull/8066)).
 * extract reusable styled live beacon icon ([\#8103](https://github.com/matrix-org/matrix-react-sdk/pull/8103)).
 * Don't restore MemberInfo from RightPanel history when viewing a room ([\#8090](https://github.com/matrix-org/matrix-react-sdk/pull/8090)). Fixes #21487.
 * Allow sending files as replies as per MSC3676 ([\#8020](https://github.com/matrix-org/matrix-react-sdk/pull/8020)). Fixes #7156.
 * kill beacons on expiry ([\#8075](https://github.com/matrix-org/matrix-react-sdk/pull/8075)).
 * enable geolocation behaviour in location picker for live share type ([\#8068](https://github.com/matrix-org/matrix-react-sdk/pull/8068)).
 * Improve formatting features in the editor ([\#7104](https://github.com/matrix-org/matrix-react-sdk/pull/7104)). Fixes #19501. Contributed by @alexanderstephan.
 * Support MSC3026 busy presence ([\#8043](https://github.com/matrix-org/matrix-react-sdk/pull/8043)).
 * Show displayname in non-narrow thread summeries ([\#8036](https://github.com/matrix-org/matrix-react-sdk/pull/8036)). Fixes #19646.
 * Tweak search dialog based on new designs ([\#7980](https://github.com/matrix-org/matrix-react-sdk/pull/7980)). Fixes #21285 and #21289.
 * fallback to event text in location body when map unavailable ([\#7982](https://github.com/matrix-org/matrix-react-sdk/pull/7982)). Fixes #20655.
 * Send pin drop location share events ([\#7967](https://github.com/matrix-org/matrix-react-sdk/pull/7967)).

## 🐛 Bug Fixes
 * fix quicktime video thumbnailing ([\#8108](https://github.com/matrix-org/matrix-react-sdk/pull/8108)). Fixes #21505.
 * Fix scroll behaviour in space panel ([\#8111](https://github.com/matrix-org/matrix-react-sdk/pull/8111)). Fixes #21467.
 * Fix emoting with emoji or pills ([\#8105](https://github.com/matrix-org/matrix-react-sdk/pull/8105)). Fixes #21497.
 * Remove padding of InviteDialog & fix visual regression ([\#8076](https://github.com/matrix-org/matrix-react-sdk/pull/8076)). Fixes #20631. Contributed by @luixxiul.
 * Fixes mx_MLocationBody_markerBorder ([\#8069](https://github.com/matrix-org/matrix-react-sdk/pull/8069)). Fixes #21444. Contributed by @luixxiul.
 * Make margin and padding of mx_InviteDialog_other consistent ([\#8063](https://github.com/matrix-org/matrix-react-sdk/pull/8063)). Fixes #20631. Contributed by @luixxiul.
 * Fix freeze/crash when 1:1 calling ([\#8057](https://github.com/matrix-org/matrix-react-sdk/pull/8057)). Fixes #21181.
 * Don't assume that widget IDs are unique ([\#8052](https://github.com/matrix-org/matrix-react-sdk/pull/8052)). Fixes #21399.
 * Fix the header of Space landing page ([\#8048](https://github.com/matrix-org/matrix-react-sdk/pull/8048)). Fixes #21402. Contributed by @luixxiul.
 * Fix buttons alignment of Space list header ([\#8047](https://github.com/matrix-org/matrix-react-sdk/pull/8047)). Fixes #21401. Contributed by @luixxiul.
 * Fix null-guarding regression around reply_to_event dispatch ([\#8039](https://github.com/matrix-org/matrix-react-sdk/pull/8039)).
 * Fix clicking on copy link to thread wrongly opening thread ([\#8038](https://github.com/matrix-org/matrix-react-sdk/pull/8038)). Fixes #20653.
 * Fix regression around replying to search results ([\#8035](https://github.com/matrix-org/matrix-react-sdk/pull/8035)). Fixes #21389.
 * Share shared history keys in the background ([\#8031](https://github.com/matrix-org/matrix-react-sdk/pull/8031)). Fixes #21192.
 * Paginate responses to pinned polls ([\#8025](https://github.com/matrix-org/matrix-react-sdk/pull/8025)). Fixes #21382.
 * Fix incorrect usage of unstable variant of `is_falling_back` ([\#8016](https://github.com/matrix-org/matrix-react-sdk/pull/8016)).
 * Fix issues with ThreadSummary in msc-enabled mode ([\#8018](https://github.com/matrix-org/matrix-react-sdk/pull/8018)). Fixes matrix-org/element-web-rageshakes#11401 and matrix-org/element-web-rageshakes#11400.
 * Fix alignment of polls within threads ([\#8017](https://github.com/matrix-org/matrix-react-sdk/pull/8017)). Fixes #21235.
 * Fix issues with thread summaries being wrong or stale ([\#8015](https://github.com/matrix-org/matrix-react-sdk/pull/8015)). Fixes #21363 and #21204.
 * Fix button border color of LeaveSpaceDialog ([\#8010](https://github.com/matrix-org/matrix-react-sdk/pull/8010)). Fixes #21365. Contributed by @luixxiul.
 * Fix room list scroll jumps ([\#7991](https://github.com/matrix-org/matrix-react-sdk/pull/7991)). Fixes #19322.
 * Fix a variety of issues with HTML → Markdown conversion ([\#8004](https://github.com/matrix-org/matrix-react-sdk/pull/8004)). Fixes #10648, #20718, #10722, #10389, #17610 #9984 and #20140.
 * Wrap EventTile rather than its children in an error boundary ([\#7945](https://github.com/matrix-org/matrix-react-sdk/pull/7945)).
 * Normalized shortcut formatting for quote expansion control ([\#7995](https://github.com/matrix-org/matrix-react-sdk/pull/7995)). Fixes #19685. Contributed by @Sinharitik589.
 * Fix buttons and text layout on Security Key dialog ([\#7996](https://github.com/matrix-org/matrix-react-sdk/pull/7996)). Fixes #21330. Contributed by @luixxiul.
 * Fix formatting not being applied after links ([\#7990](https://github.com/matrix-org/matrix-react-sdk/pull/7990)). Fixes #20091.

Changes in [1.10.7](https://github.com/vector-im/element-web/releases/tag/v1.10.7) (2022-03-15)
===============================================================================================

## 🔒 SECURITY FIXES

 * Fix a bug where URL previews could be enabled in the left-panel when they
   should not have been.

## ✨ Features
 * Add a config.json option to skip the built-in Jitsi welcome screen ([\#21190](https://github.com/vector-im/element-web/pull/21190)).
 * Add unexposed account setting for hiding poll creation ([\#7972](https://github.com/matrix-org/matrix-react-sdk/pull/7972)).
 * Allow pinning polls ([\#7922](https://github.com/matrix-org/matrix-react-sdk/pull/7922)). Fixes #20152.
 * Make trailing `:` into a setting ([\#6711](https://github.com/matrix-org/matrix-react-sdk/pull/6711)). Fixes #16682. Contributed by @SimonBrandner.
 * Location sharing > back button ([\#7958](https://github.com/matrix-org/matrix-react-sdk/pull/7958)).
 * use LocationAssetType ([\#7965](https://github.com/matrix-org/matrix-react-sdk/pull/7965)).
 * Location share type UI ([\#7924](https://github.com/matrix-org/matrix-react-sdk/pull/7924)).
 * Add a few more UIComponent flags, and ensure they are used in existing code ([\#7937](https://github.com/matrix-org/matrix-react-sdk/pull/7937)).
 * Add support for overriding strings in the app ([\#7886](https://github.com/matrix-org/matrix-react-sdk/pull/7886)).
 * Add support for redirecting to external pages after logout ([\#7905](https://github.com/matrix-org/matrix-react-sdk/pull/7905)).
 * Expose redaction power level in room settings ([\#7599](https://github.com/matrix-org/matrix-react-sdk/pull/7599)). Fixes #20590. Contributed by @SimonBrandner.
 * Update and expand ways to access pinned messages ([\#7906](https://github.com/matrix-org/matrix-react-sdk/pull/7906)). Fixes #21209 and #21211.
 * Add slash command to switch to a room's virtual room ([\#7839](https://github.com/matrix-org/matrix-react-sdk/pull/7839)).

## 🐛 Bug Fixes
 * Remove Lojban translation ([\#21302](https://github.com/vector-im/element-web/pull/21302)).
 * Merge pull request from GHSA-qmf4-7w7j-vf23 ([\#8059](https://github.com/matrix-org/matrix-react-sdk/pull/8059)).
 * Add another null guard for member ([\#7984](https://github.com/matrix-org/matrix-react-sdk/pull/7984)). Fixes #21319.
 * Fix room account settings ([\#7999](https://github.com/matrix-org/matrix-react-sdk/pull/7999)).
 * Fix missing summary text for pinned message changes ([\#7989](https://github.com/matrix-org/matrix-react-sdk/pull/7989)). Fixes #19823.
 * Pass room to getRoomTombstone to avoid racing with setState ([\#7986](https://github.com/matrix-org/matrix-react-sdk/pull/7986)).
 * Hide composer and call buttons when the room is tombstoned ([\#7975](https://github.com/matrix-org/matrix-react-sdk/pull/7975)). Fixes #21286.
 * Fix bad ternary statement in autocomplete user pill insertions ([\#7977](https://github.com/matrix-org/matrix-react-sdk/pull/7977)). Fixes #21307.
 * Fix sending locations into threads and fix i18n ([\#7943](https://github.com/matrix-org/matrix-react-sdk/pull/7943)). Fixes #21267.
 * Fix location map attribution rendering over message action bar ([\#7974](https://github.com/matrix-org/matrix-react-sdk/pull/7974)). Fixes #21297.
 * Fix wrongly asserting that PushRule::conditions is non-null ([\#7973](https://github.com/matrix-org/matrix-react-sdk/pull/7973)). Fixes #21305.
 * Fix account & room settings race condition ([\#7953](https://github.com/matrix-org/matrix-react-sdk/pull/7953)). Fixes #21163.
 * Fix bug with some space selections not being applied ([\#7971](https://github.com/matrix-org/matrix-react-sdk/pull/7971)). Fixes #21290.
 * Revert "replace all require(.svg) with esm import" ([\#7969](https://github.com/matrix-org/matrix-react-sdk/pull/7969)). Fixes #21293.
 * Hide unpinnable pinned messages in more cases ([\#7921](https://github.com/matrix-org/matrix-react-sdk/pull/7921)).
 * Fix room list being laggy while scrolling 🐌 ([\#7939](https://github.com/matrix-org/matrix-react-sdk/pull/7939)). Fixes #21262.
 * Make pinned messages more reliably reflect edits ([\#7920](https://github.com/matrix-org/matrix-react-sdk/pull/7920)). Fixes #17098.
 * Improve accessibility of the BetaPill ([\#7949](https://github.com/matrix-org/matrix-react-sdk/pull/7949)). Fixes #21255.
 * Autofocus correct composer after sending reaction ([\#7950](https://github.com/matrix-org/matrix-react-sdk/pull/7950)). Fixes #21273.
 * Consider polls as message events for rendering redactions ([\#7944](https://github.com/matrix-org/matrix-react-sdk/pull/7944)). Fixes #21125.
 * Prevent event tiles being shrunk/collapsed by flexbox ([\#7942](https://github.com/matrix-org/matrix-react-sdk/pull/7942)). Fixes #21269.
 * Fix ExportDialog title on export cancellation ([\#7936](https://github.com/matrix-org/matrix-react-sdk/pull/7936)). Fixes #21260. Contributed by @luixxiul.
 * Mandate use of js-sdk/src/matrix import over js-sdk/src ([\#7933](https://github.com/matrix-org/matrix-react-sdk/pull/7933)). Fixes #21253.
 * Fix backspace not working in the invite dialog ([\#7931](https://github.com/matrix-org/matrix-react-sdk/pull/7931)). Fixes #21249. Contributed by @SimonBrandner.
 * Fix right panel soft crashes due to missing room prop ([\#7923](https://github.com/matrix-org/matrix-react-sdk/pull/7923)). Fixes #21243.
 * fix color of location share caret ([\#7917](https://github.com/matrix-org/matrix-react-sdk/pull/7917)).
 * Wrap all EventTiles with a TileErrorBoundary and guard parsePermalink ([\#7916](https://github.com/matrix-org/matrix-react-sdk/pull/7916)). Fixes #21216.
 * Fix changing space sometimes bouncing to the wrong space ([\#7910](https://github.com/matrix-org/matrix-react-sdk/pull/7910)). Fixes #20425.
 * Ensure EventListSummary key does not change during backpagination ([\#7915](https://github.com/matrix-org/matrix-react-sdk/pull/7915)). Fixes #9192.
 * Fix positioning of the thread context menu ([\#7918](https://github.com/matrix-org/matrix-react-sdk/pull/7918)). Fixes #21236.
 * Inject sender into pinned messages ([\#7904](https://github.com/matrix-org/matrix-react-sdk/pull/7904)). Fixes #20314.
 * Tweak info message padding in right panel timeline ([\#7901](https://github.com/matrix-org/matrix-react-sdk/pull/7901)). Fixes #21212.
 * Fix another freeze on room switch ([\#7900](https://github.com/matrix-org/matrix-react-sdk/pull/7900)). Fixes #21127.
 * Fix out of memory error when failing to acquire location ([\#7902](https://github.com/matrix-org/matrix-react-sdk/pull/7902)). Fixes #21213.
 * Fix edge case in context menu chevron positioning ([\#7899](https://github.com/matrix-org/matrix-react-sdk/pull/7899)).
 * Fix composer format buttons on WebKit ([\#7898](https://github.com/matrix-org/matrix-react-sdk/pull/7898)). Fixes #20868.
 * manage voicerecording state when deleting or sending a voice message ([\#7896](https://github.com/matrix-org/matrix-react-sdk/pull/7896)). Fixes #21151.
 * Fix bug with useRoomHierarchy tight-looping loadMore on error ([\#7893](https://github.com/matrix-org/matrix-react-sdk/pull/7893)).
 * Fix upload button & shortcut not working for narrow composer mode ([\#7894](https://github.com/matrix-org/matrix-react-sdk/pull/7894)). Fixes #21175 and #21142.
 * Fix emoji insertion in thread composer going to the main composer ([\#7895](https://github.com/matrix-org/matrix-react-sdk/pull/7895)). Fixes #21202.
 * Try harder to keep context menus inside the window ([\#7863](https://github.com/matrix-org/matrix-react-sdk/pull/7863)). Fixes #17527 and #18377.
 * Fix edge case around event list summary layout ([\#7891](https://github.com/matrix-org/matrix-react-sdk/pull/7891)). Fixes #21180.
 * Fix event list summary 1 hidden message pluralisation ([\#7890](https://github.com/matrix-org/matrix-react-sdk/pull/7890)). Fixes #21196.
 * Fix vanishing recently viewed menu ([\#7887](https://github.com/matrix-org/matrix-react-sdk/pull/7887)). Fixes #20827.
 * Fix freeze on room switch ([\#7884](https://github.com/matrix-org/matrix-react-sdk/pull/7884)). Fixes #21127.
 * Check 'useSystemTheme' in quick settings theme switcher ([\#7809](https://github.com/matrix-org/matrix-react-sdk/pull/7809)). Fixes #21061.
 * Fix 'my threads' filtering to include participated threads ([\#7882](https://github.com/matrix-org/matrix-react-sdk/pull/7882)). Fixes #20877.
 * Remove log line to try to fix freeze on answering VoIP call ([\#7883](https://github.com/matrix-org/matrix-react-sdk/pull/7883)).
 * Support social login & password on soft logout page ([\#7879](https://github.com/matrix-org/matrix-react-sdk/pull/7879)). Fixes #21099.
 * Fix missing padding on server picker ([\#7864](https://github.com/matrix-org/matrix-react-sdk/pull/7864)).
 * Throttle RoomState.members handlers ([\#7876](https://github.com/matrix-org/matrix-react-sdk/pull/7876)). Fixes #21127.
 * Only show joined/invited in search dialog ([\#7875](https://github.com/matrix-org/matrix-react-sdk/pull/7875)). Fixes #21161.
 * Don't pillify code blocks ([\#7861](https://github.com/matrix-org/matrix-react-sdk/pull/7861)). Fixes #20851 and #18687.
 * Fix keyboard shortcut icons on macOS ([\#7869](https://github.com/matrix-org/matrix-react-sdk/pull/7869)).

Changes in [1.10.7-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.10.7-rc.1) (2022-03-08)
=========================================================================================================

## ✨ Features
 * Add a config.json option to skip the built-in Jitsi welcome screen ([\#21190](https://github.com/vector-im/element-web/pull/21190)).
 * Add unexposed account setting for hiding poll creation ([\#7972](https://github.com/matrix-org/matrix-react-sdk/pull/7972)).
 * Allow pinning polls ([\#7922](https://github.com/matrix-org/matrix-react-sdk/pull/7922)). Fixes #20152.
 * Make trailing `:` into a setting ([\#6711](https://github.com/matrix-org/matrix-react-sdk/pull/6711)). Fixes #16682. Contributed by @SimonBrandner.
 * Location sharing > back button ([\#7958](https://github.com/matrix-org/matrix-react-sdk/pull/7958)).
 * use LocationAssetType ([\#7965](https://github.com/matrix-org/matrix-react-sdk/pull/7965)).
 * Location share type UI ([\#7924](https://github.com/matrix-org/matrix-react-sdk/pull/7924)).
 * Add a few more UIComponent flags, and ensure they are used in existing code ([\#7937](https://github.com/matrix-org/matrix-react-sdk/pull/7937)).
 * Add support for overriding strings in the app ([\#7886](https://github.com/matrix-org/matrix-react-sdk/pull/7886)).
 * Add support for redirecting to external pages after logout ([\#7905](https://github.com/matrix-org/matrix-react-sdk/pull/7905)).
 * Expose redaction power level in room settings ([\#7599](https://github.com/matrix-org/matrix-react-sdk/pull/7599)). Fixes #20590. Contributed by @SimonBrandner.
 * Update and expand ways to access pinned messages ([\#7906](https://github.com/matrix-org/matrix-react-sdk/pull/7906)). Fixes #21209 and #21211.
 * Add slash command to switch to a room's virtual room ([\#7839](https://github.com/matrix-org/matrix-react-sdk/pull/7839)).

## 🐛 Bug Fixes
 * Remove Lojban translation ([\#21302](https://github.com/vector-im/element-web/pull/21302)).
 * Add another null guard for member ([\#7984](https://github.com/matrix-org/matrix-react-sdk/pull/7984)). Fixes #21319.
 * Fix room account settings ([\#7999](https://github.com/matrix-org/matrix-react-sdk/pull/7999)).
 * Fix missing summary text for pinned message changes ([\#7989](https://github.com/matrix-org/matrix-react-sdk/pull/7989)). Fixes #19823.
 * Pass room to getRoomTombstone to avoid racing with setState ([\#7986](https://github.com/matrix-org/matrix-react-sdk/pull/7986)).
 * Hide composer and call buttons when the room is tombstoned ([\#7975](https://github.com/matrix-org/matrix-react-sdk/pull/7975)). Fixes #21286.
 * Fix bad ternary statement in autocomplete user pill insertions ([\#7977](https://github.com/matrix-org/matrix-react-sdk/pull/7977)). Fixes #21307.
 * Fix sending locations into threads and fix i18n ([\#7943](https://github.com/matrix-org/matrix-react-sdk/pull/7943)). Fixes #21267.
 * Fix location map attribution rendering over message action bar ([\#7974](https://github.com/matrix-org/matrix-react-sdk/pull/7974)). Fixes #21297.
 * Fix wrongly asserting that PushRule::conditions is non-null ([\#7973](https://github.com/matrix-org/matrix-react-sdk/pull/7973)). Fixes #21305.
 * Fix account & room settings race condition ([\#7953](https://github.com/matrix-org/matrix-react-sdk/pull/7953)). Fixes #21163.
 * Fix bug with some space selections not being applied ([\#7971](https://github.com/matrix-org/matrix-react-sdk/pull/7971)). Fixes #21290.
 * Revert "replace all require(.svg) with esm import" ([\#7969](https://github.com/matrix-org/matrix-react-sdk/pull/7969)). Fixes #21293.
 * Hide unpinnable pinned messages in more cases ([\#7921](https://github.com/matrix-org/matrix-react-sdk/pull/7921)).
 * Fix room list being laggy while scrolling 🐌 ([\#7939](https://github.com/matrix-org/matrix-react-sdk/pull/7939)). Fixes #21262.
 * Make pinned messages more reliably reflect edits ([\#7920](https://github.com/matrix-org/matrix-react-sdk/pull/7920)). Fixes #17098.
 * Improve accessibility of the BetaPill ([\#7949](https://github.com/matrix-org/matrix-react-sdk/pull/7949)). Fixes #21255.
 * Autofocus correct composer after sending reaction ([\#7950](https://github.com/matrix-org/matrix-react-sdk/pull/7950)). Fixes #21273.
 * Consider polls as message events for rendering redactions ([\#7944](https://github.com/matrix-org/matrix-react-sdk/pull/7944)). Fixes #21125.
 * Prevent event tiles being shrunk/collapsed by flexbox ([\#7942](https://github.com/matrix-org/matrix-react-sdk/pull/7942)). Fixes #21269.
 * Fix ExportDialog title on export cancellation ([\#7936](https://github.com/matrix-org/matrix-react-sdk/pull/7936)). Fixes #21260. Contributed by @luixxiul.
 * Mandate use of js-sdk/src/matrix import over js-sdk/src ([\#7933](https://github.com/matrix-org/matrix-react-sdk/pull/7933)). Fixes #21253.
 * Fix backspace not working in the invite dialog ([\#7931](https://github.com/matrix-org/matrix-react-sdk/pull/7931)). Fixes #21249. Contributed by @SimonBrandner.
 * Fix right panel soft crashes due to missing room prop ([\#7923](https://github.com/matrix-org/matrix-react-sdk/pull/7923)). Fixes #21243.
 * fix color of location share caret ([\#7917](https://github.com/matrix-org/matrix-react-sdk/pull/7917)).
 * Wrap all EventTiles with a TileErrorBoundary and guard parsePermalink ([\#7916](https://github.com/matrix-org/matrix-react-sdk/pull/7916)). Fixes #21216.
 * Fix changing space sometimes bouncing to the wrong space ([\#7910](https://github.com/matrix-org/matrix-react-sdk/pull/7910)). Fixes #20425.
 * Ensure EventListSummary key does not change during backpagination ([\#7915](https://github.com/matrix-org/matrix-react-sdk/pull/7915)). Fixes #9192.
 * Fix positioning of the thread context menu ([\#7918](https://github.com/matrix-org/matrix-react-sdk/pull/7918)). Fixes #21236.
 * Inject sender into pinned messages ([\#7904](https://github.com/matrix-org/matrix-react-sdk/pull/7904)). Fixes #20314.
 * Tweak info message padding in right panel timeline ([\#7901](https://github.com/matrix-org/matrix-react-sdk/pull/7901)). Fixes #21212.
 * Fix another freeze on room switch ([\#7900](https://github.com/matrix-org/matrix-react-sdk/pull/7900)). Fixes #21127.
 * Fix out of memory error when failing to acquire location ([\#7902](https://github.com/matrix-org/matrix-react-sdk/pull/7902)). Fixes #21213.
 * Fix edge case in context menu chevron positioning ([\#7899](https://github.com/matrix-org/matrix-react-sdk/pull/7899)).
 * Fix composer format buttons on WebKit ([\#7898](https://github.com/matrix-org/matrix-react-sdk/pull/7898)). Fixes #20868.
 * manage voicerecording state when deleting or sending a voice message ([\#7896](https://github.com/matrix-org/matrix-react-sdk/pull/7896)). Fixes #21151.
 * Fix bug with useRoomHierarchy tight-looping loadMore on error ([\#7893](https://github.com/matrix-org/matrix-react-sdk/pull/7893)).
 * Fix upload button & shortcut not working for narrow composer mode ([\#7894](https://github.com/matrix-org/matrix-react-sdk/pull/7894)). Fixes #21175 and #21142.
 * Fix emoji insertion in thread composer going to the main composer ([\#7895](https://github.com/matrix-org/matrix-react-sdk/pull/7895)). Fixes #21202.
 * Try harder to keep context menus inside the window ([\#7863](https://github.com/matrix-org/matrix-react-sdk/pull/7863)). Fixes #17527 and #18377.
 * Fix edge case around event list summary layout ([\#7891](https://github.com/matrix-org/matrix-react-sdk/pull/7891)). Fixes #21180.
 * Fix event list summary 1 hidden message pluralisation ([\#7890](https://github.com/matrix-org/matrix-react-sdk/pull/7890)). Fixes #21196.
 * Fix vanishing recently viewed menu ([\#7887](https://github.com/matrix-org/matrix-react-sdk/pull/7887)). Fixes #20827.
 * Fix freeze on room switch ([\#7884](https://github.com/matrix-org/matrix-react-sdk/pull/7884)). Fixes #21127.
 * Check 'useSystemTheme' in quick settings theme switcher ([\#7809](https://github.com/matrix-org/matrix-react-sdk/pull/7809)). Fixes #21061.
 * Fix 'my threads' filtering to include participated threads ([\#7882](https://github.com/matrix-org/matrix-react-sdk/pull/7882)). Fixes #20877.
 * Remove log line to try to fix freeze on answering VoIP call ([\#7883](https://github.com/matrix-org/matrix-react-sdk/pull/7883)).
 * Support social login & password on soft logout page ([\#7879](https://github.com/matrix-org/matrix-react-sdk/pull/7879)). Fixes #21099.
 * Fix missing padding on server picker ([\#7864](https://github.com/matrix-org/matrix-react-sdk/pull/7864)).
 * Throttle RoomState.members handlers ([\#7876](https://github.com/matrix-org/matrix-react-sdk/pull/7876)). Fixes #21127.
 * Only show joined/invited in search dialog ([\#7875](https://github.com/matrix-org/matrix-react-sdk/pull/7875)). Fixes #21161.
 * Don't pillify code blocks ([\#7861](https://github.com/matrix-org/matrix-react-sdk/pull/7861)). Fixes #20851 and #18687.
 * Fix keyboard shortcut icons on macOS ([\#7869](https://github.com/matrix-org/matrix-react-sdk/pull/7869)).

Changes in [1.10.6](https://github.com/vector-im/element-web/releases/tag/v1.10.6) (2022-03-01)
===============================================================================================

## 🐛 Bug Fixes
 * Fix some crashes in the right panel

Changes in [1.10.5](https://github.com/vector-im/element-web/releases/tag/v1.10.5) (2022-02-28)
===============================================================================================

## 🌐 Translations
 * This release contains a significant update to the Japanese translations, contributed by Suguru Hirahara (@luixxiul). ありがとうございます!

## ✨ Features
 * Support "closed" polls whose votes are not visible until they are ended ([\#7842](https://github.com/matrix-org/matrix-react-sdk/pull/7842)).
 * Focus trap in poll creation dialog ([\#7847](https://github.com/matrix-org/matrix-react-sdk/pull/7847)). Fixes #20281.
 * Add labs flag: Show only current profile on historical messages ([\#7815](https://github.com/matrix-org/matrix-react-sdk/pull/7815)).
 * Keep unsent voice messages in memory until they are deleted or sent ([\#7840](https://github.com/matrix-org/matrix-react-sdk/pull/7840)). Fixes #17979.
 * A link to `#/dm` in a custom home.html will open the "Direct Messages" dialog. ([\#7783](https://github.com/matrix-org/matrix-react-sdk/pull/7783)). Contributed by @johannes-krude.
 * set icon-button-color to be configurable via quaternary-content variable ([\#7725](https://github.com/matrix-org/matrix-react-sdk/pull/7725)). Fixes #20925. Contributed by @acxz.
 * Allow editing polls ([\#7806](https://github.com/matrix-org/matrix-react-sdk/pull/7806)).
 * Abstract spotlight to allow non-room results too ([\#7804](https://github.com/matrix-org/matrix-react-sdk/pull/7804)). Fixes #20968, matrix-org/element-web-rageshakes#10766, matrix-org/element-web-rageshakes#10777, matrix-org/element-web-rageshakes#10767 matrix-org/element-web-rageshakes#10760 and matrix-org/element-web-rageshakes#10752.
 * Display '(edited)' next to edited polls ([\#7789](https://github.com/matrix-org/matrix-react-sdk/pull/7789)).
 * Use the resize observer polyfill consistently ([\#7796](https://github.com/matrix-org/matrix-react-sdk/pull/7796)). Fixes matrix-org/element-web-rageshakes#10700.
 * Consolidate, simplify and improve copied tooltips ([\#7799](https://github.com/matrix-org/matrix-react-sdk/pull/7799)). Fixes #21069.
 * Suggest `@room` when `@channel`, `@everyone`, or `@here` is typed in composer ([\#7737](https://github.com/matrix-org/matrix-react-sdk/pull/7737)). Fixes #20972. Contributed by @aaronraimist.
 * Add customisation point to disable space creation ([\#7766](https://github.com/matrix-org/matrix-react-sdk/pull/7766)).
 * Consolidate RedactionGrouper and HiddenEventGrouper into MELS ([\#7739](https://github.com/matrix-org/matrix-react-sdk/pull/7739)). Fixes #20958.
 * Unify widget header actions with those in right panel ([\#7734](https://github.com/matrix-org/matrix-react-sdk/pull/7734)).
 * Improve new search dialog context text for exactly 2 parent spaces ([\#7761](https://github.com/matrix-org/matrix-react-sdk/pull/7761)).

## 🐛 Bug Fixes
 * Fix command key missing in keyboard shortcuts tab ([\#21102](https://github.com/vector-im/element-web/pull/21102)). Contributed by @SimonBrandner.
 * [Release] Tweak info message padding in right panel timeline ([\#7909](https://github.com/matrix-org/matrix-react-sdk/pull/7909)).
 * [Release] Fix edge case around event list summary layout ([\#7892](https://github.com/matrix-org/matrix-react-sdk/pull/7892)).
 * Wire up CallEventGroupers for Search Results ([\#7866](https://github.com/matrix-org/matrix-react-sdk/pull/7866)). Fixes #21150.
 * Fix edge case around event list summary layout ([\#7867](https://github.com/matrix-org/matrix-react-sdk/pull/7867)). Fixes #21153.
 * Fix misalignment with Event List Summaries ([\#7865](https://github.com/matrix-org/matrix-react-sdk/pull/7865)). Fixes #21149.
 * Fix non-customizable keybindings not working as expected ([\#7855](https://github.com/matrix-org/matrix-react-sdk/pull/7855)). Fixes #21136 and matrix-org/element-web-rageshakes#10830.
 * Fix accessibility around the room list treeview and new search beta ([\#7856](https://github.com/matrix-org/matrix-react-sdk/pull/7856)). Fixes matrix-org/element-web-rageshakes#10873.
 * Inhibit tooltip on timeline pill avatars, the whole pill has its own ([\#7854](https://github.com/matrix-org/matrix-react-sdk/pull/7854)). Fixes #21135.
 * Fix virtual / native room mapping on call transfers ([\#7848](https://github.com/matrix-org/matrix-react-sdk/pull/7848)).
 * Fix ScrollPanel data-scrollbar not responding to window resizing ([\#7841](https://github.com/matrix-org/matrix-react-sdk/pull/7841)). Fixes #20594.
 * add cursor: pointer to actionable poll options ([\#7826](https://github.com/matrix-org/matrix-react-sdk/pull/7826)). Fixes #21033.
 * Tear down AppTile using lifecycle tracking ([\#7833](https://github.com/matrix-org/matrix-react-sdk/pull/7833)). Fixes #21025.
 * Fix layout inconsistencies with the room search minimized button ([\#7824](https://github.com/matrix-org/matrix-react-sdk/pull/7824)). Fixes #21106.
 * Fix space panel notification badge behaviour and metrics ([\#7823](https://github.com/matrix-org/matrix-react-sdk/pull/7823)). Fixes #21092.
 * Fix left panel widgets causing app crashes (again) ([\#7814](https://github.com/matrix-org/matrix-react-sdk/pull/7814)).
 * Fix right panel data flow ([\#7811](https://github.com/matrix-org/matrix-react-sdk/pull/7811)). Fixes #20929.
 * set mask-size for icons ([\#7812](https://github.com/matrix-org/matrix-react-sdk/pull/7812)). Fixes #21047.
 * Fix room create tile not showing up with hidden events shown ([\#7810](https://github.com/matrix-org/matrix-react-sdk/pull/7810)). Fixes #20893.
 * Fix delayed badge update for mentions in encrypted rooms ([\#7813](https://github.com/matrix-org/matrix-react-sdk/pull/7813)). Fixes #20859.
 * Fix add existing space not showing any spaces ([\#7801](https://github.com/matrix-org/matrix-react-sdk/pull/7801)). Fixes #21087. Contributed by @c-cal.
 * Fix edge cases around event list summaries with hidden events and redactions ([\#7797](https://github.com/matrix-org/matrix-react-sdk/pull/7797)). Fixes #21030 #21050 and #21055.
 * Improve styling of edge case devtools state keys ([\#7794](https://github.com/matrix-org/matrix-react-sdk/pull/7794)). Fixes #21056.
 * Don't scroll to bottom when executing non-message slash commands ([\#7793](https://github.com/matrix-org/matrix-react-sdk/pull/7793)). Fixes #21065.
 * Fix cutout misalignment on some decorated room avatars ([\#7784](https://github.com/matrix-org/matrix-react-sdk/pull/7784)). Fixes #21038.
 * Fix desktop notifications for invites showing user IDs instead of displaynames ([\#7780](https://github.com/matrix-org/matrix-react-sdk/pull/7780)). Fixes #21022. Contributed by @c-cal.
 * Fix bad pluralisation on event list summary hidden message handling ([\#7778](https://github.com/matrix-org/matrix-react-sdk/pull/7778)).
 * Properly recurse subspaces for leave space dialog options ([\#7775](https://github.com/matrix-org/matrix-react-sdk/pull/7775)). Fixes #20949 and #21012.
 * Fix translation for keyboard shortcut displaynames ([\#7758](https://github.com/matrix-org/matrix-react-sdk/pull/7758)). Fixes #20992. Contributed by @c-cal.
 * Fix space member list opening with back button ([\#7773](https://github.com/matrix-org/matrix-react-sdk/pull/7773)). Fixes #21009. Contributed by @c-cal.
 * Fix sort order for facepiles which was exactly reverse ([\#7771](https://github.com/matrix-org/matrix-react-sdk/pull/7771)).
 * Fix state events being wrongly hidden when redacted ([\#7768](https://github.com/matrix-org/matrix-react-sdk/pull/7768)). Fixes #20959.
 * Event List Summary guard against missing event senders ([\#7767](https://github.com/matrix-org/matrix-react-sdk/pull/7767)). Fixes #21004.
 * Fix all settings button opening sidebar settings tab ([\#7765](https://github.com/matrix-org/matrix-react-sdk/pull/7765)). Fixes #20998. Contributed by @c-cal.
 * Fix theme selector dropdown overflow ([\#7764](https://github.com/matrix-org/matrix-react-sdk/pull/7764)). Fixes #20996. Contributed by @c-cal.
 * Fix widget and mjolnir state events showing with mxid not name ([\#7760](https://github.com/matrix-org/matrix-react-sdk/pull/7760)). Fixes #20986.
 * Fix space member list not opening ([\#7747](https://github.com/matrix-org/matrix-react-sdk/pull/7747)). Fixes #20982. Contributed by @c-cal.
 * Handle highlight notifications in timeline card button ([\#7762](https://github.com/matrix-org/matrix-react-sdk/pull/7762)). Fixes #20987. Contributed by @SimonBrandner.
 * Fix add existing space not showing any spaces ([\#7751](https://github.com/matrix-org/matrix-react-sdk/pull/7751)).
 * Inhibit Room List keyboard pass-thru when the search beta is enabled ([\#7752](https://github.com/matrix-org/matrix-react-sdk/pull/7752)). Fixes #20984.
 * Add unread notification dot to timeline card button ([\#7749](https://github.com/matrix-org/matrix-react-sdk/pull/7749)). Fixes #20946. Contributed by @SimonBrandner.

Changes in [1.10.5-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.10.5-rc.1) (2022-02-22)
=========================================================================================================

## 🌐 Translations
 * This release contains a significant update to the Japanese translations, contributed by Suguru Hirahara (@luixxiul). ありがとうございます!

## ✨ Features
 * Support "closed" polls whose votes are not visible until they are ended ([\#7842](https://github.com/matrix-org/matrix-react-sdk/pull/7842)).
 * Focus trap in poll creation dialog ([\#7847](https://github.com/matrix-org/matrix-react-sdk/pull/7847)). Fixes #20281.
 * Add labs flag: Show only current profile on historical messages ([\#7815](https://github.com/matrix-org/matrix-react-sdk/pull/7815)).
 * Keep unsent voice messages in memory until they are deleted or sent ([\#7840](https://github.com/matrix-org/matrix-react-sdk/pull/7840)). Fixes #17979.
 * A link to `#/dm` in a custom home.html will open the "Direct Messages" dialog. ([\#7783](https://github.com/matrix-org/matrix-react-sdk/pull/7783)). Contributed by @johannes-krude.
 * set icon-button-color to be configurable via quaternary-content variable ([\#7725](https://github.com/matrix-org/matrix-react-sdk/pull/7725)). Fixes #20925. Contributed by @acxz.
 * Allow editing polls ([\#7806](https://github.com/matrix-org/matrix-react-sdk/pull/7806)).
 * Abstract spotlight to allow non-room results too ([\#7804](https://github.com/matrix-org/matrix-react-sdk/pull/7804)). Fixes #20968, matrix-org/element-web-rageshakes#10766, matrix-org/element-web-rageshakes#10777, matrix-org/element-web-rageshakes#10767 matrix-org/element-web-rageshakes#10760 and matrix-org/element-web-rageshakes#10752.
 * Display '(edited)' next to edited polls ([\#7789](https://github.com/matrix-org/matrix-react-sdk/pull/7789)).
 * Use the resize observer polyfill consistently ([\#7796](https://github.com/matrix-org/matrix-react-sdk/pull/7796)). Fixes matrix-org/element-web-rageshakes#10700.
 * Consolidate, simplify and improve copied tooltips ([\#7799](https://github.com/matrix-org/matrix-react-sdk/pull/7799)). Fixes #21069.
 * Suggest `@room` when `@channel`, `@everyone`, or `@here` is typed in composer ([\#7737](https://github.com/matrix-org/matrix-react-sdk/pull/7737)). Fixes #20972. Contributed by @aaronraimist.
 * Add customisation point to disable space creation ([\#7766](https://github.com/matrix-org/matrix-react-sdk/pull/7766)).
 * Consolidate RedactionGrouper and HiddenEventGrouper into MELS ([\#7739](https://github.com/matrix-org/matrix-react-sdk/pull/7739)). Fixes #20958.
 * Unify widget header actions with those in right panel ([\#7734](https://github.com/matrix-org/matrix-react-sdk/pull/7734)).
 * Improve new search dialog context text for exactly 2 parent spaces ([\#7761](https://github.com/matrix-org/matrix-react-sdk/pull/7761)).

## 🐛 Bug Fixes
 * Fix command key missing in keyboard shortcuts tab ([\#21102](https://github.com/vector-im/element-web/pull/21102)). Contributed by @SimonBrandner.
 * Wire up CallEventGroupers for Search Results ([\#7866](https://github.com/matrix-org/matrix-react-sdk/pull/7866)). Fixes #21150.
 * Fix edge case around event list summary layout ([\#7867](https://github.com/matrix-org/matrix-react-sdk/pull/7867)). Fixes #21153.
 * Fix misalignment with Event List Summaries ([\#7865](https://github.com/matrix-org/matrix-react-sdk/pull/7865)). Fixes #21149.
 * Fix non-customizable keybindings not working as expected ([\#7855](https://github.com/matrix-org/matrix-react-sdk/pull/7855)). Fixes #21136 and matrix-org/element-web-rageshakes#10830.
 * Fix accessibility around the room list treeview and new search beta ([\#7856](https://github.com/matrix-org/matrix-react-sdk/pull/7856)). Fixes matrix-org/element-web-rageshakes#10873.
 * Inhibit tooltip on timeline pill avatars, the whole pill has its own ([\#7854](https://github.com/matrix-org/matrix-react-sdk/pull/7854)). Fixes #21135.
 * Fix virtual / native room mapping on call transfers ([\#7848](https://github.com/matrix-org/matrix-react-sdk/pull/7848)).
 * Fix ScrollPanel data-scrollbar not responding to window resizing ([\#7841](https://github.com/matrix-org/matrix-react-sdk/pull/7841)). Fixes #20594.
 * add cursor: pointer to actionable poll options ([\#7826](https://github.com/matrix-org/matrix-react-sdk/pull/7826)). Fixes #21033.
 * Tear down AppTile using lifecycle tracking ([\#7833](https://github.com/matrix-org/matrix-react-sdk/pull/7833)). Fixes #21025.
 * Fix layout inconsistencies with the room search minimized button ([\#7824](https://github.com/matrix-org/matrix-react-sdk/pull/7824)). Fixes #21106.
 * Fix space panel notification badge behaviour and metrics ([\#7823](https://github.com/matrix-org/matrix-react-sdk/pull/7823)). Fixes #21092.
 * Fix left panel widgets causing app crashes (again) ([\#7814](https://github.com/matrix-org/matrix-react-sdk/pull/7814)).
 * Fix right panel data flow ([\#7811](https://github.com/matrix-org/matrix-react-sdk/pull/7811)). Fixes #20929.
 * set mask-size for icons ([\#7812](https://github.com/matrix-org/matrix-react-sdk/pull/7812)). Fixes #21047.
 * Fix room create tile not showing up with hidden events shown ([\#7810](https://github.com/matrix-org/matrix-react-sdk/pull/7810)). Fixes #20893.
 * Fix delayed badge update for mentions in encrypted rooms ([\#7813](https://github.com/matrix-org/matrix-react-sdk/pull/7813)). Fixes #20859.
 * Fix add existing space not showing any spaces ([\#7801](https://github.com/matrix-org/matrix-react-sdk/pull/7801)). Fixes #21087. Contributed by @c-cal.
 * Fix edge cases around event list summaries with hidden events and redactions ([\#7797](https://github.com/matrix-org/matrix-react-sdk/pull/7797)). Fixes #21030 #21050 and #21055.
 * Improve styling of edge case devtools state keys ([\#7794](https://github.com/matrix-org/matrix-react-sdk/pull/7794)). Fixes #21056.
 * Don't scroll to bottom when executing non-message slash commands ([\#7793](https://github.com/matrix-org/matrix-react-sdk/pull/7793)). Fixes #21065.
 * Fix cutout misalignment on some decorated room avatars ([\#7784](https://github.com/matrix-org/matrix-react-sdk/pull/7784)). Fixes #21038.
 * Fix desktop notifications for invites showing user IDs instead of displaynames ([\#7780](https://github.com/matrix-org/matrix-react-sdk/pull/7780)). Fixes #21022. Contributed by @c-cal.
 * Fix bad pluralisation on event list summary hidden message handling ([\#7778](https://github.com/matrix-org/matrix-react-sdk/pull/7778)).
 * Properly recurse subspaces for leave space dialog options ([\#7775](https://github.com/matrix-org/matrix-react-sdk/pull/7775)). Fixes #20949 and #21012.
 * Fix translation for keyboard shortcut displaynames ([\#7758](https://github.com/matrix-org/matrix-react-sdk/pull/7758)). Fixes #20992. Contributed by @c-cal.
 * Fix space member list opening with back button ([\#7773](https://github.com/matrix-org/matrix-react-sdk/pull/7773)). Fixes #21009. Contributed by @c-cal.
 * Fix sort order for facepiles which was exactly reverse ([\#7771](https://github.com/matrix-org/matrix-react-sdk/pull/7771)).
 * Fix state events being wrongly hidden when redacted ([\#7768](https://github.com/matrix-org/matrix-react-sdk/pull/7768)). Fixes #20959.
 * Event List Summary guard against missing event senders ([\#7767](https://github.com/matrix-org/matrix-react-sdk/pull/7767)). Fixes #21004.
 * Fix all settings button opening sidebar settings tab ([\#7765](https://github.com/matrix-org/matrix-react-sdk/pull/7765)). Fixes #20998. Contributed by @c-cal.
 * Fix theme selector dropdown overflow ([\#7764](https://github.com/matrix-org/matrix-react-sdk/pull/7764)). Fixes #20996. Contributed by @c-cal.
 * Fix widget and mjolnir state events showing with mxid not name ([\#7760](https://github.com/matrix-org/matrix-react-sdk/pull/7760)). Fixes #20986.
 * Fix space member list not opening ([\#7747](https://github.com/matrix-org/matrix-react-sdk/pull/7747)). Fixes #20982. Contributed by @c-cal.
 * Handle highlight notifications in timeline card button ([\#7762](https://github.com/matrix-org/matrix-react-sdk/pull/7762)). Fixes #20987. Contributed by @SimonBrandner.
 * Fix add existing space not showing any spaces ([\#7751](https://github.com/matrix-org/matrix-react-sdk/pull/7751)).
 * Inhibit Room List keyboard pass-thru when the search beta is enabled ([\#7752](https://github.com/matrix-org/matrix-react-sdk/pull/7752)). Fixes #20984.
 * Add unread notification dot to timeline card button ([\#7749](https://github.com/matrix-org/matrix-react-sdk/pull/7749)). Fixes #20946. Contributed by @SimonBrandner.

Changes in [1.10.4](https://github.com/vector-im/element-web/releases/tag/v1.10.4) (2022-02-17)
===============================================================================================

## 🐛 Bug Fixes
 * Fix bug where badge colour on encrypted rooms may not be correct until anothe rmessage is sent

Changes in [1.10.3](https://github.com/vector-im/element-web/releases/tag/v1.10.3) (2022-02-14)
===============================================================================================

 * Add map tile URL for location sharing maps to sample config (and element.io release app config)

Changes in [1.10.2](https://github.com/vector-im/element-web/releases/tag/v1.10.2) (2022-02-14)
===============================================================================================

## ✨ Features
 * Support a config option to change the default device name ([\#20790](https://github.com/vector-im/element-web/pull/20790)).
 * Capitalize "Privacy" in UserMenu ([\#7738](https://github.com/matrix-org/matrix-react-sdk/pull/7738)). Contributed by @aaronraimist.
 * Move new search experience to a Beta ([\#7718](https://github.com/matrix-org/matrix-react-sdk/pull/7718)). Fixes vector-im/element-meta#139 #20618 and #20339.
 * Auto select "Other homeserver" when user press "Edit" in homeserver field ([\#7337](https://github.com/matrix-org/matrix-react-sdk/pull/7337)). Fixes #20125. Contributed by @SimonBrandner.
 * Add unread badges and avatar decorations to spotlight search ([\#7696](https://github.com/matrix-org/matrix-react-sdk/pull/7696)). Fixes #20821.
 * Enable location sharing ([\#7703](https://github.com/matrix-org/matrix-react-sdk/pull/7703)).
 * Simplify Composer buttons ([\#7678](https://github.com/matrix-org/matrix-react-sdk/pull/7678)).
 * Add a warning to the console to discourage attacks and encourage contributing ([\#7673](https://github.com/matrix-org/matrix-react-sdk/pull/7673)). Fixes #2803. Contributed by @SimonBrandner.
 * Don't show replaced calls in the timeline ([\#7452](https://github.com/matrix-org/matrix-react-sdk/pull/7452)). Contributed by @SimonBrandner.
 * Tweak `/addwidget` widget names ([\#7681](https://github.com/matrix-org/matrix-react-sdk/pull/7681)).
 * Chat export parameter customisation ([\#7647](https://github.com/matrix-org/matrix-react-sdk/pull/7647)).
 * Put call on hold when transfer dialog is opened ([\#7669](https://github.com/matrix-org/matrix-react-sdk/pull/7669)).
 * Share e2ee keys when using /invite SlashCommand ([\#7655](https://github.com/matrix-org/matrix-react-sdk/pull/7655)). Fixes #20778 and #16982.
 * Tweak spotlight roving behaviour to reset when changing query ([\#7656](https://github.com/matrix-org/matrix-react-sdk/pull/7656)). Fixes #20537 #20612 and #20184.
 * Look up tile server info in homeserver's .well-known area ([\#7623](https://github.com/matrix-org/matrix-react-sdk/pull/7623)).
 * Add grouper for hidden events ([\#7649](https://github.com/matrix-org/matrix-react-sdk/pull/7649)).
 * The keyboard shortcut is control (or cmd) shift h. ([\#7584](https://github.com/matrix-org/matrix-react-sdk/pull/7584)). Contributed by @UwUnyaa.

## 🐛 Bug Fixes
 * [Release] Fix cutout misalignment on some decorated room avatars ([\#7785](https://github.com/matrix-org/matrix-react-sdk/pull/7785)).
 * [Release] Fix add existing space not showing any spaces ([\#7756](https://github.com/matrix-org/matrix-react-sdk/pull/7756)).
 * [Release] Inhibit Room List keyboard pass-thru when the search beta is enabled ([\#7754](https://github.com/matrix-org/matrix-react-sdk/pull/7754)).
 * [Release] Fix space member list not opening ([\#7755](https://github.com/matrix-org/matrix-react-sdk/pull/7755)).
 * Null-guard ELS from null summaryMembers ([\#7744](https://github.com/matrix-org/matrix-react-sdk/pull/7744)). Fixes #20807.
 * Improve responsiveness of the layout switcher ([\#7736](https://github.com/matrix-org/matrix-react-sdk/pull/7736)).
 * Tweak timeline card layout ([\#7743](https://github.com/matrix-org/matrix-react-sdk/pull/7743)). Fixes #20846.
 * Ensure location bodies have a width in bubbles ([\#7742](https://github.com/matrix-org/matrix-react-sdk/pull/7742)). Fixes #20916.
 * Tune aria-live regions around clocks/timers ([\#7735](https://github.com/matrix-org/matrix-react-sdk/pull/7735)). Fixes #20967.
 * Fix instances of decorated room avatar wrongly having their own tabIndex ([\#7730](https://github.com/matrix-org/matrix-react-sdk/pull/7730)).
 * Remove weird padding on stickers ([\#6271](https://github.com/matrix-org/matrix-react-sdk/pull/6271)). Fixes #17787. Contributed by @SimonBrandner.
 * Fix width issue of the composer overflow menu items ([\#7731](https://github.com/matrix-org/matrix-react-sdk/pull/7731)). Fixes #20898.
 * Properly handle persistent widgets when room is left ([\#7724](https://github.com/matrix-org/matrix-react-sdk/pull/7724)). Fixes #20901.
 * Null guard space hierarchy ([\#7729](https://github.com/matrix-org/matrix-react-sdk/pull/7729)). Fixes matrix-org/element-web-rageshakes#10433.
 * Fix add existing rooms button ([\#7728](https://github.com/matrix-org/matrix-react-sdk/pull/7728)). Fixes #20924. Contributed by @SimonBrandner.
 * Truncate long server names on login/register screen ([\#7702](https://github.com/matrix-org/matrix-react-sdk/pull/7702)). Fixes #18452.
 * Update PollCreateDialog-test to snapshot the html and not react tree ([\#7712](https://github.com/matrix-org/matrix-react-sdk/pull/7712)).
 * Fix creating polls outside of threads ([\#7711](https://github.com/matrix-org/matrix-react-sdk/pull/7711)). Fixes #20882.
 * Open native room when clicking notification from a virtual room ([\#7709](https://github.com/matrix-org/matrix-react-sdk/pull/7709)).
 * Fix relative link handling in Element Desktop ([\#7708](https://github.com/matrix-org/matrix-react-sdk/pull/7708)). Fixes #20783.
 * Reuse CopyableText component in all places it can be ([\#7701](https://github.com/matrix-org/matrix-react-sdk/pull/7701)). Fixes #20855.
 * Fit location into the width of the container ([\#7705](https://github.com/matrix-org/matrix-react-sdk/pull/7705)). Fixes #20861.
 * Make Spotlight Dialog roving reset more stable ([\#7698](https://github.com/matrix-org/matrix-react-sdk/pull/7698)). Fixes #20826.
 * Fix incorrect sizing of DecoratedRoomAvatar in RoomHeader ([\#7697](https://github.com/matrix-org/matrix-react-sdk/pull/7697)). Fixes #20090.
 * Use a more correct test for emoji ([\#7685](https://github.com/matrix-org/matrix-react-sdk/pull/7685)). Fixes #20824. Contributed by @robintown.
 * Fix vertical spacing in `compact` `<ContextMenu>` ([\#7684](https://github.com/matrix-org/matrix-react-sdk/pull/7684)). Fixes #20801.
 * Fix the sticker picker ([\#7692](https://github.com/matrix-org/matrix-react-sdk/pull/7692)). Fixes #20797.
 * Fix publishing address wrongly demanding the alias be available ([\#7690](https://github.com/matrix-org/matrix-react-sdk/pull/7690)). Fixes #12013 and #20833.
 * Prevent MemberAvatar soft-crashing when rendered with null member prop ([\#7691](https://github.com/matrix-org/matrix-react-sdk/pull/7691)). Fixes #20714.
 * Ensure UserInfo can be rendered without a room ([\#7687](https://github.com/matrix-org/matrix-react-sdk/pull/7687)). Fixes #20830.
 * Make polls fill column width in bubbles layout ([\#7661](https://github.com/matrix-org/matrix-react-sdk/pull/7661)). Fixes #20712.
 * Add a background to expanded nick name in IRC layout to make it readable. ([\#7652](https://github.com/matrix-org/matrix-react-sdk/pull/7652)). Fixes #20757. Contributed by @UwUnyaa.
 * Fix accessibility and consistency of MessageComposerButtons ([\#7679](https://github.com/matrix-org/matrix-react-sdk/pull/7679)). Fixes #20814.
 * Don't show shield next to deleted messages ([\#7671](https://github.com/matrix-org/matrix-react-sdk/pull/7671)). Fixes #20475. Contributed by @SimonBrandner.
 * Fix font size of spaces between big emoji ([\#7675](https://github.com/matrix-org/matrix-react-sdk/pull/7675)). Contributed by @robintown.
 * Fix shift-enter repeating last character ([\#7665](https://github.com/matrix-org/matrix-react-sdk/pull/7665)). Fixes #17215. Contributed by @SimonBrandner.
 * Remove Unpin option from maximised widget context menu ([\#7657](https://github.com/matrix-org/matrix-react-sdk/pull/7657)).
 * Fix new call event grouper implementation for encrypted rooms ([\#7654](https://github.com/matrix-org/matrix-react-sdk/pull/7654)).
 * Fix issue with tile error boundaries collapsing in bubbles layout ([\#7653](https://github.com/matrix-org/matrix-react-sdk/pull/7653)).
 * Fix emojis getting cropped in irc & bubble layouts by anti-zalgo ([\#7637](https://github.com/matrix-org/matrix-react-sdk/pull/7637)). Fixes #20744.
 * Fix space panel edge gradient not applying on load ([\#7644](https://github.com/matrix-org/matrix-react-sdk/pull/7644)). Fixes #20756.
 * Fix search results view for layouts other than Group/Modern ([\#7648](https://github.com/matrix-org/matrix-react-sdk/pull/7648)). Fixes #20745.

Changes in [1.10.2-rc.2](https://github.com/vector-im/element-web/releases/tag/v1.10.2-rc.2) (2022-02-09)
=========================================================================================================

## 🐛 Bug Fixes
 * [Release] Fix add existing space not showing any spaces ([\#7756](https://github.com/matrix-org/matrix-react-sdk/pull/7756)).
 * [Release] Inhibit Room List keyboard pass-thru when the search beta is enabled ([\#7754](https://github.com/matrix-org/matrix-react-sdk/pull/7754)).
 * [Release] Fix space member list not opening ([\#7755](https://github.com/matrix-org/matrix-react-sdk/pull/7755)).

Changes in [1.10.2-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.10.2-rc.1) (2022-02-08)
=========================================================================================================

## ✨ Features
 * Support a config option to change the default device name ([\#20790](https://github.com/vector-im/element-web/pull/20790)).
 * Move new search experience to a Beta ([\#7718](https://github.com/matrix-org/matrix-react-sdk/pull/7718)). Fixes vector-im/element-meta#139 #20618 and #20339.
 * Capitalize "Privacy" in UserMenu ([\#7738](https://github.com/matrix-org/matrix-react-sdk/pull/7738)). Contributed by @aaronraimist.
 * Auto select "Other homeserver" when user press "Edit" in homeserver field ([\#7337](https://github.com/matrix-org/matrix-react-sdk/pull/7337)). Fixes #20125. Contributed by @SimonBrandner.
 * Add unread badges and avatar decorations to spotlight search ([\#7696](https://github.com/matrix-org/matrix-react-sdk/pull/7696)). Fixes #20821.
 * Enable location sharing ([\#7703](https://github.com/matrix-org/matrix-react-sdk/pull/7703)).
 * Simplify Composer buttons ([\#7678](https://github.com/matrix-org/matrix-react-sdk/pull/7678)).
 * Add a warning to the console to discourage attacks and encourage contributing ([\#7673](https://github.com/matrix-org/matrix-react-sdk/pull/7673)). Fixes #2803. Contributed by @SimonBrandner.
 * Don't show replaced calls in the timeline ([\#7452](https://github.com/matrix-org/matrix-react-sdk/pull/7452)). Contributed by @SimonBrandner.
 * Tweak `/addwidget` widget names ([\#7681](https://github.com/matrix-org/matrix-react-sdk/pull/7681)).
 * Chat export parameter customisation ([\#7647](https://github.com/matrix-org/matrix-react-sdk/pull/7647)).
 * Put call on hold when transfer dialog is opened ([\#7669](https://github.com/matrix-org/matrix-react-sdk/pull/7669)).
 * Share e2ee keys when using /invite SlashCommand ([\#7655](https://github.com/matrix-org/matrix-react-sdk/pull/7655)). Fixes #20778 and #16982.
 * Tweak spotlight roving behaviour to reset when changing query ([\#7656](https://github.com/matrix-org/matrix-react-sdk/pull/7656)). Fixes #20537 #20612 and #20184.
 * Look up tile server info in homeserver's .well-known area ([\#7623](https://github.com/matrix-org/matrix-react-sdk/pull/7623)).
 * Add grouper for hidden events ([\#7649](https://github.com/matrix-org/matrix-react-sdk/pull/7649)).
 * The keyboard shortcut is control (or cmd) shift h. ([\#7584](https://github.com/matrix-org/matrix-react-sdk/pull/7584)). Contributed by @UwUnyaa.

## 🐛 Bug Fixes
 * Null-guard ELS from null summaryMembers ([\#7744](https://github.com/matrix-org/matrix-react-sdk/pull/7744)). Fixes #20807.
 * Improve responsiveness of the layout switcher ([\#7736](https://github.com/matrix-org/matrix-react-sdk/pull/7736)).
 * Tweak timeline card layout ([\#7743](https://github.com/matrix-org/matrix-react-sdk/pull/7743)). Fixes #20846.
 * Ensure location bodies have a width in bubbles ([\#7742](https://github.com/matrix-org/matrix-react-sdk/pull/7742)). Fixes #20916.
 * Tune aria-live regions around clocks/timers ([\#7735](https://github.com/matrix-org/matrix-react-sdk/pull/7735)). Fixes #20967.
 * Fix instances of decorated room avatar wrongly having their own tabIndex ([\#7730](https://github.com/matrix-org/matrix-react-sdk/pull/7730)).
 * Remove weird padding on stickers ([\#6271](https://github.com/matrix-org/matrix-react-sdk/pull/6271)). Fixes #17787. Contributed by @SimonBrandner.
 * Fix width issue of the composer overflow menu items ([\#7731](https://github.com/matrix-org/matrix-react-sdk/pull/7731)). Fixes #20898.
 * Properly handle persistent widgets when room is left ([\#7724](https://github.com/matrix-org/matrix-react-sdk/pull/7724)). Fixes #20901.
 * Null guard space hierarchy ([\#7729](https://github.com/matrix-org/matrix-react-sdk/pull/7729)). Fixes matrix-org/element-web-rageshakes#10433.
 * Fix add existing rooms button ([\#7728](https://github.com/matrix-org/matrix-react-sdk/pull/7728)). Fixes #20924. Contributed by @SimonBrandner.
 * Truncate long server names on login/register screen ([\#7702](https://github.com/matrix-org/matrix-react-sdk/pull/7702)). Fixes #18452.
 * Update PollCreateDialog-test to snapshot the html and not react tree ([\#7712](https://github.com/matrix-org/matrix-react-sdk/pull/7712)).
 * Fix creating polls outside of threads ([\#7711](https://github.com/matrix-org/matrix-react-sdk/pull/7711)). Fixes #20882.
 * Open native room when clicking notification from a virtual room ([\#7709](https://github.com/matrix-org/matrix-react-sdk/pull/7709)).
 * Fix relative link handling in Element Desktop ([\#7708](https://github.com/matrix-org/matrix-react-sdk/pull/7708)). Fixes #20783.
 * Reuse CopyableText component in all places it can be ([\#7701](https://github.com/matrix-org/matrix-react-sdk/pull/7701)). Fixes #20855.
 * Fit location into the width of the container ([\#7705](https://github.com/matrix-org/matrix-react-sdk/pull/7705)). Fixes #20861.
 * Make Spotlight Dialog roving reset more stable ([\#7698](https://github.com/matrix-org/matrix-react-sdk/pull/7698)). Fixes #20826.
 * Fix incorrect sizing of DecoratedRoomAvatar in RoomHeader ([\#7697](https://github.com/matrix-org/matrix-react-sdk/pull/7697)). Fixes #20090.
 * Use a more correct test for emoji ([\#7685](https://github.com/matrix-org/matrix-react-sdk/pull/7685)). Fixes #20824. Contributed by @robintown.
 * Fix vertical spacing in `compact` `<ContextMenu>` ([\#7684](https://github.com/matrix-org/matrix-react-sdk/pull/7684)). Fixes #20801.
 * Fix the sticker picker ([\#7692](https://github.com/matrix-org/matrix-react-sdk/pull/7692)). Fixes #20797.
 * Fix publishing address wrongly demanding the alias be available ([\#7690](https://github.com/matrix-org/matrix-react-sdk/pull/7690)). Fixes #12013 and #20833.
 * Prevent MemberAvatar soft-crashing when rendered with null member prop ([\#7691](https://github.com/matrix-org/matrix-react-sdk/pull/7691)). Fixes #20714.
 * Ensure UserInfo can be rendered without a room ([\#7687](https://github.com/matrix-org/matrix-react-sdk/pull/7687)). Fixes #20830.
 * Make polls fill column width in bubbles layout ([\#7661](https://github.com/matrix-org/matrix-react-sdk/pull/7661)). Fixes #20712.
 * Add a background to expanded nick name in IRC layout to make it readable. ([\#7652](https://github.com/matrix-org/matrix-react-sdk/pull/7652)). Fixes #20757. Contributed by @UwUnyaa.
 * Fix accessibility and consistency of MessageComposerButtons ([\#7679](https://github.com/matrix-org/matrix-react-sdk/pull/7679)). Fixes #20814.
 * Don't show shield next to deleted messages ([\#7671](https://github.com/matrix-org/matrix-react-sdk/pull/7671)). Fixes #20475. Contributed by @SimonBrandner.
 * Fix font size of spaces between big emoji ([\#7675](https://github.com/matrix-org/matrix-react-sdk/pull/7675)). Contributed by @robintown.
 * Fix shift-enter repeating last character ([\#7665](https://github.com/matrix-org/matrix-react-sdk/pull/7665)). Fixes #17215. Contributed by @SimonBrandner.
 * Remove Unpin option from maximised widget context menu ([\#7657](https://github.com/matrix-org/matrix-react-sdk/pull/7657)).
 * Fix new call event grouper implementation for encrypted rooms ([\#7654](https://github.com/matrix-org/matrix-react-sdk/pull/7654)).
 * Fix issue with tile error boundaries collapsing in bubbles layout ([\#7653](https://github.com/matrix-org/matrix-react-sdk/pull/7653)).
 * Fix emojis getting cropped in irc & bubble layouts by anti-zalgo ([\#7637](https://github.com/matrix-org/matrix-react-sdk/pull/7637)). Fixes #20744.
 * Fix space panel edge gradient not applying on load ([\#7644](https://github.com/matrix-org/matrix-react-sdk/pull/7644)). Fixes #20756.
 * Fix search results view for layouts other than Group/Modern ([\#7648](https://github.com/matrix-org/matrix-react-sdk/pull/7648)). Fixes #20745.

Changes in [1.10.1](https://github.com/vector-im/element-web/releases/tag/v1.10.1) (2022-02-01)
===============================================================================================

## 🐛 Bug Fixes
 * Fix the sticker picker ([\#7692](https://github.com/matrix-org/matrix-react-sdk/pull/7692)). Fixes vector-im/element-web#20797.
 * Ensure UserInfo can be rendered without a room ([\#7687](https://github.com/matrix-org/matrix-react-sdk/pull/7687)). Fixes vector-im/element-web#20830.
 * Fix publishing address wrongly demanding the alias be available ([\#7690](https://github.com/matrix-org/matrix-react-sdk/pull/7690)). Fixes vector-im/element-web#12013 and vector-im/element-web#20833.

Changes in [1.10.0](https://github.com/vector-im/element-web/releases/tag/v1.10.0) (2022-01-31)
===============================================================================================

## ✨ Features
 * Tweak room list header menu for when space is active ([\#7577](https://github.com/matrix-org/matrix-react-sdk/pull/7577)). Fixes #20601.
 * Tweak light hover & active color for bubble layout ([\#7626](https://github.com/matrix-org/matrix-react-sdk/pull/7626)). Fixes #19475.
 * De-labs Metaspaces ([\#7613](https://github.com/matrix-org/matrix-react-sdk/pull/7613)).
 * De-labs Message Bubbles layout ([\#7612](https://github.com/matrix-org/matrix-react-sdk/pull/7612)).
 * Add customisation point for mxid display ([\#7595](https://github.com/matrix-org/matrix-react-sdk/pull/7595)).
 * Add labs flag for default open right panel ([\#7618](https://github.com/matrix-org/matrix-react-sdk/pull/7618)). Fixes #20666.
 * Tweak copy for the Sidebar tab in User Settings ([\#7578](https://github.com/matrix-org/matrix-react-sdk/pull/7578)). Fixes #20619.
 * Make widgets not reload (persistent) between center and top container  ([\#7575](https://github.com/matrix-org/matrix-react-sdk/pull/7575)). Fixes #20596. Contributed by @toger5.
 * Don't render a bubble around emotes in bubble layout ([\#7573](https://github.com/matrix-org/matrix-react-sdk/pull/7573)). Fixes #20617.
 * Add ability to switch between voice & video in calls ([\#7155](https://github.com/matrix-org/matrix-react-sdk/pull/7155)). Fixes #18619. Contributed by @SimonBrandner.
 * Re-renable Share option for location messages ([\#7596](https://github.com/matrix-org/matrix-react-sdk/pull/7596)).
 * Make room ID copyable ([\#7600](https://github.com/matrix-org/matrix-react-sdk/pull/7600)). Fixes #20675. Contributed by @SimonBrandner.
 * Improve the look of the keyboard settings tab ([\#7562](https://github.com/matrix-org/matrix-react-sdk/pull/7562)). Contributed by @SimonBrandner.
 * Add tooltips to emoji in messages ([\#7592](https://github.com/matrix-org/matrix-react-sdk/pull/7592)). Fixes #9911 and #20661. Contributed by @robintown.
 * Improve redundant tooltip on send button in forward dialog ([\#7594](https://github.com/matrix-org/matrix-react-sdk/pull/7594)). Contributed by @twigleingrid.
 * Allow downloads from widgets. ([\#7502](https://github.com/matrix-org/matrix-react-sdk/pull/7502)). Contributed by @Fox32.
 * Parse matrix-schemed URIs ([\#7453](https://github.com/matrix-org/matrix-react-sdk/pull/7453)).
 * Show a tile at beginning of visible history ([\#5887](https://github.com/matrix-org/matrix-react-sdk/pull/5887)). Fixes #16818 #16679 and #19888. Contributed by @robintown.
 * Enable the polls feature ([\#7581](https://github.com/matrix-org/matrix-react-sdk/pull/7581)).
 * Display general marker on non-self location shares ([\#7574](https://github.com/matrix-org/matrix-react-sdk/pull/7574)).
 * Improve/add notifications for location and poll events ([\#7552](https://github.com/matrix-org/matrix-react-sdk/pull/7552)). Fixes #20561. Contributed by @SimonBrandner.
 * Upgrade linkify to v3.0 ([\#7282](https://github.com/matrix-org/matrix-react-sdk/pull/7282)). Fixes #17133 #16825 and #5808. Contributed by @Palid.
 * Update sidebar icon from Compound ([\#7572](https://github.com/matrix-org/matrix-react-sdk/pull/7572)). Fixes #20615.
 * Replace home icon with new one ([\#7571](https://github.com/matrix-org/matrix-react-sdk/pull/7571)). Fixes #20606.
 * Make the `Keyboard Shortcuts` dialog into a settings tab ([\#7198](https://github.com/matrix-org/matrix-react-sdk/pull/7198)). Fixes #19866. Contributed by @SimonBrandner.
 * Add setting for enabling location sharing ([\#7547](https://github.com/matrix-org/matrix-react-sdk/pull/7547)).
 * Add a developer mode 'view source' button to crashed event tiles ([\#7537](https://github.com/matrix-org/matrix-react-sdk/pull/7537)).
 * Replace `kick` terminology with `Remove from chat` ([\#7469](https://github.com/matrix-org/matrix-react-sdk/pull/7469)). Fixes #9547.
 * Render events as extensible events (behind labs) ([\#7462](https://github.com/matrix-org/matrix-react-sdk/pull/7462)).
 * Render Jitsi (and other sticky widgets) in PiP container, so it can be dragged and the "jump to room functionality" is provided ([\#7450](https://github.com/matrix-org/matrix-react-sdk/pull/7450)). Fixes #15682. Contributed by @toger5.
 * Allow bubble layout in Thread View ([\#7478](https://github.com/matrix-org/matrix-react-sdk/pull/7478)). Fixes #20419.
 * Make LocationPicker appearance cleaner ([\#7516](https://github.com/matrix-org/matrix-react-sdk/pull/7516)).
 * Limit max-width for bubble layout to 1200px ([\#7458](https://github.com/matrix-org/matrix-react-sdk/pull/7458)). Fixes #18072.
 * Improve look of call events in bubble layout ([\#7445](https://github.com/matrix-org/matrix-react-sdk/pull/7445)). Fixes #20324. Contributed by @SimonBrandner.
 * Make files & voice memos in bubble layout match colouring ([\#7457](https://github.com/matrix-org/matrix-react-sdk/pull/7457)). Fixes #20326.
 * Allow cancelling events whilst they are encrypting ([\#7483](https://github.com/matrix-org/matrix-react-sdk/pull/7483)). Fixes #17726.

## 🐛 Bug Fixes
 * [Release] Fix left panel widgets causing app-wide crash ([\#7660](https://github.com/matrix-org/matrix-react-sdk/pull/7660)).
 * Load light theme prior to HTML export to ensure it is present ([\#7643](https://github.com/matrix-org/matrix-react-sdk/pull/7643)). Fixes #20276.
 * Fix soft-crash when hanging up Jitsi via PIP ([\#7645](https://github.com/matrix-org/matrix-react-sdk/pull/7645)). Fixes #20766.
 * Fix RightPanelStore assuming isViewingRoom is false on load ([\#7642](https://github.com/matrix-org/matrix-react-sdk/pull/7642)).
 * Correctly handle Room.timeline events which have a nullable `Room` ([\#7635](https://github.com/matrix-org/matrix-react-sdk/pull/7635)). Fixes matrix-org/element-web-rageshakes#9490.
 * Translate keyboard shortcut alternate key names ([\#7633](https://github.com/matrix-org/matrix-react-sdk/pull/7633)). Fixes #20739.
 * Fix unfocused paste handling and focus return for file uploads ([\#7625](https://github.com/matrix-org/matrix-react-sdk/pull/7625)).
 * Changed MacOS hotkey for GoToHome view. ([\#7631](https://github.com/matrix-org/matrix-react-sdk/pull/7631)). Contributed by @aj-ya.
 * Fix issue with the new composer EmojiPart which caused infinite loops ([\#7629](https://github.com/matrix-org/matrix-react-sdk/pull/7629)). Fixes #20746.
 * Upgrade linkifyjs to fix schemes as domain prefixes ([\#7628](https://github.com/matrix-org/matrix-react-sdk/pull/7628)). Fixes #20720.
 * Show bubble tile timestamps for bubble layout inside the bubble ([\#7622](https://github.com/matrix-org/matrix-react-sdk/pull/7622)). Fixes #20562.
 *  Improve taken username warning in registration for when request fails ([\#7621](https://github.com/matrix-org/matrix-react-sdk/pull/7621)).
 * Avoid double dialog after clicking to remove a public room ([\#7604](https://github.com/matrix-org/matrix-react-sdk/pull/7604)). Fixes #20681. Contributed by @c-cal.
 * Fix space member list right panel state ([\#7617](https://github.com/matrix-org/matrix-react-sdk/pull/7617)). Fixes #20716.
 * Fall back to legacy analytics for guest users ([\#7616](https://github.com/matrix-org/matrix-react-sdk/pull/7616)).
 * Always emit a space filter update when the space is actually changed ([\#7611](https://github.com/matrix-org/matrix-react-sdk/pull/7611)). Fixes #20664.
 * Enlarge emoji in composer ([\#7602](https://github.com/matrix-org/matrix-react-sdk/pull/7602)). Fixes #20665 #15635 and #20688. Contributed by @robintown.
 * Disable location sharing button on Desktop ([\#7590](https://github.com/matrix-org/matrix-react-sdk/pull/7590)).
 * Make pills more natural to navigate around ([\#7607](https://github.com/matrix-org/matrix-react-sdk/pull/7607)). Fixes #20678. Contributed by @robintown.
 * Fix excessive padding on inline images ([\#7605](https://github.com/matrix-org/matrix-react-sdk/pull/7605)). Contributed by @robintown.
 * Prevent pills from being split by formatting actions ([\#7606](https://github.com/matrix-org/matrix-react-sdk/pull/7606)). Contributed by @robintown.
 * Fix translation of "powerText" ([\#7603](https://github.com/matrix-org/matrix-react-sdk/pull/7603)). Contributed by @c-cal.
 * Unhide display names when switching back to modern layout ([\#7601](https://github.com/matrix-org/matrix-react-sdk/pull/7601)). Fixes #20676. Contributed by @robintown.
 * Fix space member list not opening ([\#7609](https://github.com/matrix-org/matrix-react-sdk/pull/7609)). Fixes #20679. Contributed by @SimonBrandner.
 * Fix translation for the "Add room" tooltip ([\#7532](https://github.com/matrix-org/matrix-react-sdk/pull/7532)). Contributed by @c-cal.
 * Make the close button of the location share dialog visible in high-contrast theme ([\#7597](https://github.com/matrix-org/matrix-react-sdk/pull/7597)).
 * Cancel pending events in virtual room when call placed ([\#7583](https://github.com/matrix-org/matrix-react-sdk/pull/7583)). Fixes #17594.
 * Fix alignment of unread badge in thread list ([\#7582](https://github.com/matrix-org/matrix-react-sdk/pull/7582)). Fixes #20643.
 * Fix left positioned tooltips being wrong and offset by fixed value ([\#7551](https://github.com/matrix-org/matrix-react-sdk/pull/7551)).
 * Fix MAB overlapping or overflowing in bubbles layout and threads regressions ([\#7569](https://github.com/matrix-org/matrix-react-sdk/pull/7569)). Fixes #20403 and #20404.
 * Fix wrong icon being used for appearance tab in space preferences dialog ([\#7570](https://github.com/matrix-org/matrix-react-sdk/pull/7570)). Fixes #20608.
 * Fix `/jumptodate` using wrong MSC feature flag ([\#7563](https://github.com/matrix-org/matrix-react-sdk/pull/7563)).
 * Ensure maps show up in replies and threads, by creating unique IDs ([\#7568](https://github.com/matrix-org/matrix-react-sdk/pull/7568)).
 * Differentiate between hover and roving focus in spotlight dialog ([\#7564](https://github.com/matrix-org/matrix-react-sdk/pull/7564)). Fixes #20597.
 * Fix timeline jumping issues related to bubble layout ([\#7529](https://github.com/matrix-org/matrix-react-sdk/pull/7529)). Fixes #20302.
 * Start a conference in a room with 2 people + invitee rather than a 1:1 call ([\#7557](https://github.com/matrix-org/matrix-react-sdk/pull/7557)). Fixes #1202. Contributed by @SimonBrandner.
 * Wait for initial profile load before displaying widget ([\#7556](https://github.com/matrix-org/matrix-react-sdk/pull/7556)).
 * Make widgets and calls span across the whole room width when using bubble layout ([\#7553](https://github.com/matrix-org/matrix-react-sdk/pull/7553)). Fixes #20560. Contributed by @SimonBrandner.
 * Always show right panel after setting a card ([\#7544](https://github.com/matrix-org/matrix-react-sdk/pull/7544)). Contributed by @toger5.
 * Support deserialising HR tags for editing ([\#7543](https://github.com/matrix-org/matrix-react-sdk/pull/7543)). Fixes #20553.
 * Refresh ThreadView after React state has been updated ([\#7539](https://github.com/matrix-org/matrix-react-sdk/pull/7539)). Fixes #20549.
 * Set initial zoom level to 1 to make zooming to location faster ([\#7541](https://github.com/matrix-org/matrix-react-sdk/pull/7541)).
 * truncate room name on pip header ([\#7538](https://github.com/matrix-org/matrix-react-sdk/pull/7538)).
 * Prevent enter to send edit weirdness when no change has been made ([\#7522](https://github.com/matrix-org/matrix-react-sdk/pull/7522)). Fixes #20507.
 * Allow using room pills in slash commands ([\#7513](https://github.com/matrix-org/matrix-react-sdk/pull/7513)). Fixes #20343.

Changes in [1.9.10-rc.2](https://github.com/vector-im/element-web/releases/tag/v1.9.10-rc.2) (2022-01-26)
=========================================================================================================

## 🐛 Bug Fixes
 * Fix crash in settings / appearance

Changes in [1.9.10-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.9.10-rc.1) (2022-01-26)
=========================================================================================================

## ✨ Features
 * Enable posthog on app.element.io ([\#20539](https://github.com/vector-im/element-web/pull/20539)).
 * Tweak room list header menu for when space is active ([\#7577](https://github.com/matrix-org/matrix-react-sdk/pull/7577)). Fixes #20601.
 * Tweak light hover & active color for bubble layout ([\#7626](https://github.com/matrix-org/matrix-react-sdk/pull/7626)). Fixes #19475.
 * De-labs Metaspaces ([\#7613](https://github.com/matrix-org/matrix-react-sdk/pull/7613)).
 * De-labs Message Bubbles layout ([\#7612](https://github.com/matrix-org/matrix-react-sdk/pull/7612)).
 * Add customisation point for mxid display ([\#7595](https://github.com/matrix-org/matrix-react-sdk/pull/7595)).
 * Add labs flag for default open right panel ([\#7618](https://github.com/matrix-org/matrix-react-sdk/pull/7618)). Fixes #20666.
 * Tweak copy for the Sidebar tab in User Settings ([\#7578](https://github.com/matrix-org/matrix-react-sdk/pull/7578)). Fixes #20619.
 * Make widgets not reload (persistent) between center and top container  ([\#7575](https://github.com/matrix-org/matrix-react-sdk/pull/7575)). Fixes #20596. Contributed by @toger5.
 * Don't render a bubble around emotes in bubble layout ([\#7573](https://github.com/matrix-org/matrix-react-sdk/pull/7573)). Fixes #20617.
 * Add ability to switch between voice & video in calls ([\#7155](https://github.com/matrix-org/matrix-react-sdk/pull/7155)). Fixes #18619. Contributed by @SimonBrandner.
 * Re-renable Share option for location messages ([\#7596](https://github.com/matrix-org/matrix-react-sdk/pull/7596)).
 * Make room ID copyable ([\#7600](https://github.com/matrix-org/matrix-react-sdk/pull/7600)). Fixes #20675. Contributed by @SimonBrandner.
 * Improve the look of the keyboard settings tab ([\#7562](https://github.com/matrix-org/matrix-react-sdk/pull/7562)). Contributed by @SimonBrandner.
 * Add tooltips to emoji in messages ([\#7592](https://github.com/matrix-org/matrix-react-sdk/pull/7592)). Fixes #9911 and #20661. Contributed by @robintown.
 * Improve redundant tooltip on send button in forward dialog ([\#7594](https://github.com/matrix-org/matrix-react-sdk/pull/7594)). Contributed by @twigleingrid.
 * Allow downloads from widgets. ([\#7502](https://github.com/matrix-org/matrix-react-sdk/pull/7502)). Contributed by @Fox32.
 * Parse matrix-schemed URIs ([\#7453](https://github.com/matrix-org/matrix-react-sdk/pull/7453)).
 * Show a tile at beginning of visible history ([\#5887](https://github.com/matrix-org/matrix-react-sdk/pull/5887)). Fixes #16818 #16679 and #19888. Contributed by @robintown.
 * Enable the polls feature ([\#7581](https://github.com/matrix-org/matrix-react-sdk/pull/7581)).
 * Display general marker on non-self location shares ([\#7574](https://github.com/matrix-org/matrix-react-sdk/pull/7574)).
 * Improve/add notifications for location and poll events ([\#7552](https://github.com/matrix-org/matrix-react-sdk/pull/7552)). Fixes #20561. Contributed by @SimonBrandner.
 * Upgrade linkify to v3.0 ([\#7282](https://github.com/matrix-org/matrix-react-sdk/pull/7282)). Fixes #17133 #16825 and #5808. Contributed by @Palid.
 * Update sidebar icon from Compound ([\#7572](https://github.com/matrix-org/matrix-react-sdk/pull/7572)). Fixes #20615.
 * Replace home icon with new one ([\#7571](https://github.com/matrix-org/matrix-react-sdk/pull/7571)). Fixes #20606.
 * Make the `Keyboard Shortcuts` dialog into a settings tab ([\#7198](https://github.com/matrix-org/matrix-react-sdk/pull/7198)). Fixes #19866. Contributed by @SimonBrandner.
 * Add setting for enabling location sharing ([\#7547](https://github.com/matrix-org/matrix-react-sdk/pull/7547)).
 * Add a developer mode 'view source' button to crashed event tiles ([\#7537](https://github.com/matrix-org/matrix-react-sdk/pull/7537)).
 * Replace `kick` terminology with `Remove from chat` ([\#7469](https://github.com/matrix-org/matrix-react-sdk/pull/7469)). Fixes #9547.
 * Render events as extensible events (behind labs) ([\#7462](https://github.com/matrix-org/matrix-react-sdk/pull/7462)).
 * Render Jitsi (and other sticky widgets) in PiP container, so it can be dragged and the "jump to room functionality" is provided ([\#7450](https://github.com/matrix-org/matrix-react-sdk/pull/7450)). Fixes #15682. Contributed by @toger5.
 * Allow bubble layout in Thread View ([\#7478](https://github.com/matrix-org/matrix-react-sdk/pull/7478)). Fixes #20419.
 * Make LocationPicker appearance cleaner ([\#7516](https://github.com/matrix-org/matrix-react-sdk/pull/7516)).
 * Limit max-width for bubble layout to 1200px ([\#7458](https://github.com/matrix-org/matrix-react-sdk/pull/7458)). Fixes #18072.
 * Improve look of call events in bubble layout ([\#7445](https://github.com/matrix-org/matrix-react-sdk/pull/7445)). Fixes #20324. Contributed by @SimonBrandner.
 * Make files & voice memos in bubble layout match colouring ([\#7457](https://github.com/matrix-org/matrix-react-sdk/pull/7457)). Fixes #20326.
 * Allow cancelling events whilst they are encrypting ([\#7483](https://github.com/matrix-org/matrix-react-sdk/pull/7483)). Fixes #17726.

## 🐛 Bug Fixes
 * Load light theme prior to HTML export to ensure it is present ([\#7643](https://github.com/matrix-org/matrix-react-sdk/pull/7643)). Fixes #20276.
 * Fix soft-crash when hanging up Jitsi via PIP ([\#7645](https://github.com/matrix-org/matrix-react-sdk/pull/7645)). Fixes #20766.
 * Fix RightPanelStore assuming isViewingRoom is false on load ([\#7642](https://github.com/matrix-org/matrix-react-sdk/pull/7642)).
 * Correctly handle Room.timeline events which have a nullable `Room` ([\#7635](https://github.com/matrix-org/matrix-react-sdk/pull/7635)). Fixes matrix-org/element-web-rageshakes#9490.
 * Translate keyboard shortcut alternate key names ([\#7633](https://github.com/matrix-org/matrix-react-sdk/pull/7633)). Fixes #20739.
 * Fix unfocused paste handling and focus return for file uploads ([\#7625](https://github.com/matrix-org/matrix-react-sdk/pull/7625)).
 * Changed MacOS hotkey for GoToHome view. ([\#7631](https://github.com/matrix-org/matrix-react-sdk/pull/7631)). Contributed by @aj-ya.
 * Fix issue with the new composer EmojiPart which caused infinite loops ([\#7629](https://github.com/matrix-org/matrix-react-sdk/pull/7629)). Fixes #20746.
 * Upgrade linkifyjs to fix schemes as domain prefixes ([\#7628](https://github.com/matrix-org/matrix-react-sdk/pull/7628)). Fixes #20720.
 * Show bubble tile timestamps for bubble layout inside the bubble ([\#7622](https://github.com/matrix-org/matrix-react-sdk/pull/7622)). Fixes #20562.
 *  Improve taken username warning in registration for when request fails ([\#7621](https://github.com/matrix-org/matrix-react-sdk/pull/7621)).
 * Avoid double dialog after clicking to remove a public room ([\#7604](https://github.com/matrix-org/matrix-react-sdk/pull/7604)). Fixes #20681. Contributed by @c-cal.
 * Fix space member list right panel state ([\#7617](https://github.com/matrix-org/matrix-react-sdk/pull/7617)). Fixes #20716.
 * Fall back to legacy analytics for guest users ([\#7616](https://github.com/matrix-org/matrix-react-sdk/pull/7616)).
 * Always emit a space filter update when the space is actually changed ([\#7611](https://github.com/matrix-org/matrix-react-sdk/pull/7611)). Fixes #20664.
 * Enlarge emoji in composer ([\#7602](https://github.com/matrix-org/matrix-react-sdk/pull/7602)). Fixes #20665 #15635 and #20688. Contributed by @robintown.
 * Disable location sharing button on Desktop ([\#7590](https://github.com/matrix-org/matrix-react-sdk/pull/7590)).
 * Make pills more natural to navigate around ([\#7607](https://github.com/matrix-org/matrix-react-sdk/pull/7607)). Fixes #20678. Contributed by @robintown.
 * Fix excessive padding on inline images ([\#7605](https://github.com/matrix-org/matrix-react-sdk/pull/7605)). Contributed by @robintown.
 * Prevent pills from being split by formatting actions ([\#7606](https://github.com/matrix-org/matrix-react-sdk/pull/7606)). Contributed by @robintown.
 * Fix translation of "powerText" ([\#7603](https://github.com/matrix-org/matrix-react-sdk/pull/7603)). Contributed by @c-cal.
 * Unhide display names when switching back to modern layout ([\#7601](https://github.com/matrix-org/matrix-react-sdk/pull/7601)). Fixes #20676. Contributed by @robintown.
 * Fix space member list not opening ([\#7609](https://github.com/matrix-org/matrix-react-sdk/pull/7609)). Fixes #20679. Contributed by @SimonBrandner.
 * Fix translation for the "Add room" tooltip ([\#7532](https://github.com/matrix-org/matrix-react-sdk/pull/7532)). Contributed by @c-cal.
 * Make the close button of the location share dialog visible in high-contrast theme ([\#7597](https://github.com/matrix-org/matrix-react-sdk/pull/7597)).
 * Cancel pending events in virtual room when call placed ([\#7583](https://github.com/matrix-org/matrix-react-sdk/pull/7583)). Fixes #17594.
 * Fix alignment of unread badge in thread list ([\#7582](https://github.com/matrix-org/matrix-react-sdk/pull/7582)). Fixes #20643.
 * Fix left positioned tooltips being wrong and offset by fixed value ([\#7551](https://github.com/matrix-org/matrix-react-sdk/pull/7551)).
 * Fix MAB overlapping or overflowing in bubbles layout and threads regressions ([\#7569](https://github.com/matrix-org/matrix-react-sdk/pull/7569)). Fixes #20403 and #20404.
 * Fix wrong icon being used for appearance tab in space preferences dialog ([\#7570](https://github.com/matrix-org/matrix-react-sdk/pull/7570)). Fixes #20608.
 * Fix `/jumptodate` using wrong MSC feature flag ([\#7563](https://github.com/matrix-org/matrix-react-sdk/pull/7563)).
 * Ensure maps show up in replies and threads, by creating unique IDs ([\#7568](https://github.com/matrix-org/matrix-react-sdk/pull/7568)).
 * Differentiate between hover and roving focus in spotlight dialog ([\#7564](https://github.com/matrix-org/matrix-react-sdk/pull/7564)). Fixes #20597.
 * Fix timeline jumping issues related to bubble layout ([\#7529](https://github.com/matrix-org/matrix-react-sdk/pull/7529)). Fixes #20302.
 * Start a conference in a room with 2 people + invitee rather than a 1:1 call ([\#7557](https://github.com/matrix-org/matrix-react-sdk/pull/7557)). Fixes #1202. Contributed by @SimonBrandner.
 * Wait for initial profile load before displaying widget ([\#7556](https://github.com/matrix-org/matrix-react-sdk/pull/7556)).
 * Make widgets and calls span across the whole room width when using bubble layout ([\#7553](https://github.com/matrix-org/matrix-react-sdk/pull/7553)). Fixes #20560. Contributed by @SimonBrandner.
 * Always show right panel after setting a card ([\#7544](https://github.com/matrix-org/matrix-react-sdk/pull/7544)). Contributed by @toger5.
 * Support deserialising HR tags for editing ([\#7543](https://github.com/matrix-org/matrix-react-sdk/pull/7543)). Fixes #20553.
 * Refresh ThreadView after React state has been updated ([\#7539](https://github.com/matrix-org/matrix-react-sdk/pull/7539)). Fixes #20549.
 * Set initial zoom level to 1 to make zooming to location faster ([\#7541](https://github.com/matrix-org/matrix-react-sdk/pull/7541)).
 * truncate room name on pip header ([\#7538](https://github.com/matrix-org/matrix-react-sdk/pull/7538)).
 * Prevent enter to send edit weirdness when no change has been made ([\#7522](https://github.com/matrix-org/matrix-react-sdk/pull/7522)). Fixes #20507.
 * Allow using room pills in slash commands ([\#7513](https://github.com/matrix-org/matrix-react-sdk/pull/7513)). Fixes #20343.

Changes in [1.9.9](https://github.com/vector-im/element-web/releases/tag/v1.9.9) (2022-01-17)
=============================================================================================

## ✨ Features
 * Add permission dropdown for sending reactions ([\#7492](https://github.com/matrix-org/matrix-react-sdk/pull/7492)). Fixes #20450.
 * Ship maximised widgets and remove feature flag ([\#7509](https://github.com/matrix-org/matrix-react-sdk/pull/7509)).
 * Properly maintain aspect ratio of inline images ([\#7503](https://github.com/matrix-org/matrix-react-sdk/pull/7503)).
 * Add zoom buttons to the location view ([\#7482](https://github.com/matrix-org/matrix-react-sdk/pull/7482)).
 * Remove bubble from around location events ([\#7459](https://github.com/matrix-org/matrix-react-sdk/pull/7459)). Fixes #20323.
 * Disable "Publish this room" option in invite only rooms ([\#7441](https://github.com/matrix-org/matrix-react-sdk/pull/7441)). Fixes #6596. Contributed by @aaronraimist.
 * Give secret key field an `id` ([\#7489](https://github.com/matrix-org/matrix-react-sdk/pull/7489)). Fixes #20390. Contributed by @SimonBrandner.
 * Display a tooltip when you hover over a location ([\#7472](https://github.com/matrix-org/matrix-react-sdk/pull/7472)).
 * Open map in a dialog when it is clicked ([\#7465](https://github.com/matrix-org/matrix-react-sdk/pull/7465)).
 * a11y - wrap notification level radios in fieldsets ([\#7471](https://github.com/matrix-org/matrix-react-sdk/pull/7471)).
 * Wrap inputs in fieldsets in Space visibility settings ([\#7350](https://github.com/matrix-org/matrix-react-sdk/pull/7350)).
 * History based navigation with new right panel store ([\#7398](https://github.com/matrix-org/matrix-react-sdk/pull/7398)). Fixes #19686 #19660 and #19634.
 * Associate room alias warning with public option in settings ([\#7430](https://github.com/matrix-org/matrix-react-sdk/pull/7430)).
 * Disable quick reactions button when no permissions ([\#7412](https://github.com/matrix-org/matrix-react-sdk/pull/7412)). Fixes #20270.
 * Allow opening a map view in OpenStreetMap ([\#7428](https://github.com/matrix-org/matrix-react-sdk/pull/7428)).
 * Display the user's avatar when they shared their location ([\#7424](https://github.com/matrix-org/matrix-react-sdk/pull/7424)).
 * Remove the Forward and Share buttons for location messages only ([\#7423](https://github.com/matrix-org/matrix-react-sdk/pull/7423)).
 * Add configuration to disable relative date markers in timeline ([\#7405](https://github.com/matrix-org/matrix-react-sdk/pull/7405)).
 * Space preferences for whether or not you see DMs in a Space ([\#7250](https://github.com/matrix-org/matrix-react-sdk/pull/7250)). Fixes #19529 and #19955.
 * Have LocalEchoWrapper emit updates so the app can react faster ([\#7358](https://github.com/matrix-org/matrix-react-sdk/pull/7358)). Fixes #19749.
 * Use semantic heading on dialog component ([\#7383](https://github.com/matrix-org/matrix-react-sdk/pull/7383)).
 * Add `/jumptodate` slash command ([\#7372](https://github.com/matrix-org/matrix-react-sdk/pull/7372)). Fixes #7677.
 * Update room context menu copy ([\#7361](https://github.com/matrix-org/matrix-react-sdk/pull/7361)). Fixes #20133.
 * Use lazy rendering in the AddExistingToSpaceDialog ([\#7369](https://github.com/matrix-org/matrix-react-sdk/pull/7369)). Fixes #18784.
 * Tweak FacePile tooltip to include whether or not you are included ([\#7367](https://github.com/matrix-org/matrix-react-sdk/pull/7367)). Fixes #17278.

## 🐛 Bug Fixes
 * Ensure group audio-only calls don't switch on the webcam on join ([\#20234](https://github.com/vector-im/element-web/pull/20234)). Fixes #20212.
 * Fix wrongly wrapping code blocks, breaking line numbers ([\#7507](https://github.com/matrix-org/matrix-react-sdk/pull/7507)). Fixes #20316.
 * Set header buttons to no phase when right panel is closed ([\#7506](https://github.com/matrix-org/matrix-react-sdk/pull/7506)).
 * Fix active Jitsi calls (and other active widgets) not being visible on screen, by showing them in PiP if they are not visible in any other container ([\#7435](https://github.com/matrix-org/matrix-react-sdk/pull/7435)). Fixes #15169 and #20275.
 * Fix layout of message bubble preview in settings ([\#7497](https://github.com/matrix-org/matrix-react-sdk/pull/7497)).
 * Prevent mutations of js-sdk owned objects as it breaks accountData ([\#7504](https://github.com/matrix-org/matrix-react-sdk/pull/7504)). Fixes matrix-org/element-web-rageshakes#7822.
 * fallback properly with pluralized strings ([\#7495](https://github.com/matrix-org/matrix-react-sdk/pull/7495)). Fixes #20455.
 * Consider continuations when resolving whether a tile is last in section ([\#7461](https://github.com/matrix-org/matrix-react-sdk/pull/7461)). Fixes #20368 and #20369.
 * Fix read receipts and sent indicators for bubble layout ([\#7460](https://github.com/matrix-org/matrix-react-sdk/pull/7460)). Fixes #18298 and #20345.
 * null-guard dataset mxTheme to prevent html exports from exploding ([\#7493](https://github.com/matrix-org/matrix-react-sdk/pull/7493)). Fixes #20453.
 * Fix avatar container overlapping give feedback cta ([\#7491](https://github.com/matrix-org/matrix-react-sdk/pull/7491)). Fixes matrix-org/element-web-rageshakes#7987.
 * Fix jump to bottom button working when on a permalink ([\#7494](https://github.com/matrix-org/matrix-react-sdk/pull/7494)). Fixes #19813.
 * Remove the Description from the location picker ([\#7485](https://github.com/matrix-org/matrix-react-sdk/pull/7485)).
 * Fix look of the untrusted device dialog ([\#7487](https://github.com/matrix-org/matrix-react-sdk/pull/7487)). Fixes #20447. Contributed by @SimonBrandner.
 * Hide maximise button in the sticker picker  ([\#7488](https://github.com/matrix-org/matrix-react-sdk/pull/7488)). Fixes #20443. Contributed by @SimonBrandner.
 * Fix space ordering to match newer spec ([\#7481](https://github.com/matrix-org/matrix-react-sdk/pull/7481)).
 * Fix typing notification colors ([\#7490](https://github.com/matrix-org/matrix-react-sdk/pull/7490)). Fixes #20144. Contributed by @SimonBrandner.
 * fix fallback for pluralized strings ([\#7480](https://github.com/matrix-org/matrix-react-sdk/pull/7480)). Fixes #20426.
 * Fix right panel soft crashes chat rooms ([\#7479](https://github.com/matrix-org/matrix-react-sdk/pull/7479)). Fixes #20433.
 * update yarn.lock and i18n ([\#7476](https://github.com/matrix-org/matrix-react-sdk/pull/7476)). Fixes #20426 and #20423.
 * Don't send typing notification when restoring composer draft ([\#7477](https://github.com/matrix-org/matrix-react-sdk/pull/7477)). Fixes #20424.
 * Fix room joining spinner being incorrect if you change room mid-join ([\#7473](https://github.com/matrix-org/matrix-react-sdk/pull/7473)).
 * Only return the approved widget capabilities instead of accepting all requested capabilities ([\#7454](https://github.com/matrix-org/matrix-react-sdk/pull/7454)). Contributed by @dhenneke.
 * Fix quoting messages from the search view ([\#7466](https://github.com/matrix-org/matrix-react-sdk/pull/7466)). Fixes #20353.
 * Attribute fallback i18n strings with lang attribute ([\#7323](https://github.com/matrix-org/matrix-react-sdk/pull/7323)).
 * Fix spotlight cmd-k wrongly expanding left panel ([\#7463](https://github.com/matrix-org/matrix-react-sdk/pull/7463)). Fixes #20399.
 * Fix room_id check when adding user widgets ([\#7448](https://github.com/matrix-org/matrix-react-sdk/pull/7448)). Fixes #19382. Contributed by @bink.
 * Add new line in settings label ([\#7451](https://github.com/matrix-org/matrix-react-sdk/pull/7451)). Fixes #20365.
 * Fix handling incoming redactions in EventIndex ([\#7443](https://github.com/matrix-org/matrix-react-sdk/pull/7443)). Fixes #19326.
 * Fix room alias address isn't checked for validity before being shown as added ([\#7107](https://github.com/matrix-org/matrix-react-sdk/pull/7107)). Fixes #19609. Contributed by @Palid.
 * Call view accessibility fixes ([\#7439](https://github.com/matrix-org/matrix-react-sdk/pull/7439)). Fixes #18516.
 * Fix offscreen canvas breaking with split-brained firefox support ([\#7440](https://github.com/matrix-org/matrix-react-sdk/pull/7440)).
 * Removed red shield in forwarding preview. ([\#7447](https://github.com/matrix-org/matrix-react-sdk/pull/7447)). Contributed by @ankur12-1610.
 * Wrap status message ([\#7325](https://github.com/matrix-org/matrix-react-sdk/pull/7325)). Fixes #20092. Contributed by @SimonBrandner.
 * Move hideSender logic into state so it causes re-render ([\#7413](https://github.com/matrix-org/matrix-react-sdk/pull/7413)). Fixes #18448.
 * Fix dialpad positioning ([\#7446](https://github.com/matrix-org/matrix-react-sdk/pull/7446)). Fixes #20175. Contributed by @SimonBrandner.
 * Hide non-functional list options on Suggested sublist ([\#7410](https://github.com/matrix-org/matrix-react-sdk/pull/7410)). Fixes #20252.
 * Fix width overflow in mini composer overflow menu ([\#7411](https://github.com/matrix-org/matrix-react-sdk/pull/7411)). Fixes #20263.
 * Fix being wrongly sent to Home space when creating/joining/leaving rooms ([\#7418](https://github.com/matrix-org/matrix-react-sdk/pull/7418)). Fixes matrix-org/element-web-rageshakes#7331 #20246 and #20240.
 * Fix HTML Export where the data-mx-theme is `Light` not `light` ([\#7415](https://github.com/matrix-org/matrix-react-sdk/pull/7415)).
 * Don't disable username/password fields whilst doing wk-lookup ([\#7438](https://github.com/matrix-org/matrix-react-sdk/pull/7438)). Fixes #20121.
 * Prevent keyboard propagation out of context menus ([\#7437](https://github.com/matrix-org/matrix-react-sdk/pull/7437)). Fixes #20317.
 * Fix nulls leaking into geo urls ([\#7433](https://github.com/matrix-org/matrix-react-sdk/pull/7433)).
 * Fix zIndex of peristent apps in miniMode ([\#7429](https://github.com/matrix-org/matrix-react-sdk/pull/7429)).
 * Space panel should watch spaces for space name changes ([\#7432](https://github.com/matrix-org/matrix-react-sdk/pull/7432)).
 * Fix list formatting alternating on edit ([\#7422](https://github.com/matrix-org/matrix-react-sdk/pull/7422)). Fixes #20073. Contributed by @renancleyson-dev.
 * Don't show `Testing small changes` without UIFeature.Feedback ([\#7427](https://github.com/matrix-org/matrix-react-sdk/pull/7427)). Fixes #20298.
 * Fix invisible toggle space panel button ([\#7426](https://github.com/matrix-org/matrix-react-sdk/pull/7426)). Fixes #20279.
 * Fix legacy breadcrumbs wrongly showing up ([\#7425](https://github.com/matrix-org/matrix-react-sdk/pull/7425)).
 * Space Panel use SettingsStore instead of SpaceStore as source of truth ([\#7404](https://github.com/matrix-org/matrix-react-sdk/pull/7404)). Fixes #20250.
 * Fix inline code block nowrap issue ([\#7406](https://github.com/matrix-org/matrix-react-sdk/pull/7406)).
 * Fix notification badge for All Rooms space ([\#7401](https://github.com/matrix-org/matrix-react-sdk/pull/7401)). Fixes #20229.
 * Show error if could not load space hierarchy ([\#7399](https://github.com/matrix-org/matrix-react-sdk/pull/7399)). Fixes #20221.
 * Increase gap between ELS and the subsequent event to prevent overlap ([\#7391](https://github.com/matrix-org/matrix-react-sdk/pull/7391)). Fixes #18319.
 * Fix list of members in space preview ([\#7356](https://github.com/matrix-org/matrix-react-sdk/pull/7356)). Fixes #19781.
 * Fix sizing of e2e shield in bubble layout ([\#7394](https://github.com/matrix-org/matrix-react-sdk/pull/7394)). Fixes #19090.
 * Fix bubble radius wrong when followed by a state event from same user ([\#7393](https://github.com/matrix-org/matrix-react-sdk/pull/7393)). Fixes #18982.
 * Fix alignment between ELS and Events in bubble layout ([\#7392](https://github.com/matrix-org/matrix-react-sdk/pull/7392)). Fixes #19652 and #19057.
 * Don't include the accuracy parameter in location events if accuracy could not be determined. ([\#7375](https://github.com/matrix-org/matrix-react-sdk/pull/7375)).
 * Make compact layout only apply to Modern layout ([\#7382](https://github.com/matrix-org/matrix-react-sdk/pull/7382)). Fixes #18412.
 * Pin qrcode to fix e2e verification bug ([\#7378](https://github.com/matrix-org/matrix-react-sdk/pull/7378)). Fixes #20188.
 * Add internationalisation to progress strings in room export dialog ([\#7385](https://github.com/matrix-org/matrix-react-sdk/pull/7385)). Fixes #20208.
 * Prevent escape to cancel edit from also scrolling to bottom ([\#7380](https://github.com/matrix-org/matrix-react-sdk/pull/7380)). Fixes #20182.
 * Fix narrow mode composer buttons for polls labs ([\#7386](https://github.com/matrix-org/matrix-react-sdk/pull/7386)). Fixes #20067.
 * Fix useUserStatusMessage exploding on unknown user ([\#7365](https://github.com/matrix-org/matrix-react-sdk/pull/7365)).
 * Fix room join spinner in room list header ([\#7364](https://github.com/matrix-org/matrix-react-sdk/pull/7364)). Fixes #20139.
 * Fix room search sometimes not opening spotlight ([\#7363](https://github.com/matrix-org/matrix-react-sdk/pull/7363)). Fixes matrix-org/element-web-rageshakes#7288.

Changes in [1.9.9-rc.1](https://github.com/vector-im/element-web/releases/tag/v1.9.9-rc.1) (2022-01-11)
=======================================================================================================

## ✨ Features
 * Ship maximised widgets and remove feature flag ([\#7509](https://github.com/matrix-org/matrix-react-sdk/pull/7509)).
 * Properly maintain aspect ratio of inline images ([\#7503](https://github.com/matrix-org/matrix-react-sdk/pull/7503)).
 * Add zoom buttons to the location view ([\#7482](https://github.com/matrix-org/matrix-react-sdk/pull/7482)).
 * Remove bubble from around location events ([\#7459](https://github.com/matrix-org/matrix-react-sdk/pull/7459)). Fixes #20323.
 * Disable "Publish this room" option in invite only rooms ([\#7441](https://github.com/matrix-org/matrix-react-sdk/pull/7441)). Fixes #6596. Contributed by @aaronraimist.
 * Add permission dropdown for sending reactions ([\#7492](https://github.com/matrix-org/matrix-react-sdk/pull/7492)). Fixes #20450.
 * Give secret key field an `id` ([\#7489](https://github.com/matrix-org/matrix-react-sdk/pull/7489)). Fixes #20390. Contributed by @SimonBrandner.
 * Display a tooltip when you hover over a location ([\#7472](https://github.com/matrix-org/matrix-react-sdk/pull/7472)).
 * Open map in a dialog when it is clicked ([\#7465](https://github.com/matrix-org/matrix-react-sdk/pull/7465)).
 * a11y - wrap notification level radios in fieldsets ([\#7471](https://github.com/matrix-org/matrix-react-sdk/pull/7471)).
 * Wrap inputs in fieldsets in Space visibility settings ([\#7350](https://github.com/matrix-org/matrix-react-sdk/pull/7350)).
 * History based navigation with new right panel store ([\#7398](https://github.com/matrix-org/matrix-react-sdk/pull/7398)). Fixes #19686 #19660 and #19634.
 * Associate room alias warning with public option in settings ([\#7430](https://github.com/matrix-org/matrix-react-sdk/pull/7430)).
 * Disable quick reactions button when no permissions ([\#7412](https://github.com/matrix-org/matrix-react-sdk/pull/7412)). Fixes #20270.
 * Allow opening a map view in OpenStreetMap ([\#7428](https://github.com/matrix-org/matrix-react-sdk/pull/7428)).
 * Display the user's avatar when they shared their location ([\#7424](https://github.com/matrix-org/matrix-react-sdk/pull/7424)).
 * Remove the Forward and Share buttons for location messages only ([\#7423](https://github.com/matrix-org/matrix-react-sdk/pull/7423)).
 * Add configuration to disable relative date markers in timeline ([\#7405](https://github.com/matrix-org/matrix-react-sdk/pull/7405)).
 * Space preferences for whether or not you see DMs in a Space ([\#7250](https://github.com/matrix-org/matrix-react-sdk/pull/7250)). Fixes #19529 and #19955.
 * Have LocalEchoWrapper emit updates so the app can react faster ([\#7358](https://github.com/matrix-org/matrix-react-sdk/pull/7358)). Fixes #19749.
 * Use semantic heading on dialog component ([\#7383](https://github.com/matrix-org/matrix-react-sdk/pull/7383)).
 * Add `/jumptodate` slash command ([\#7372](https://github.com/matrix-org/matrix-react-sdk/pull/7372)). Fixes #7677.
 * Update room context menu copy ([\#7361](https://github.com/matrix-org/matrix-react-sdk/pull/7361)). Fixes #20133.
 * Use lazy rendering in the AddExistingToSpaceDialog ([\#7369](https://github.com/matrix-org/matrix-react-sdk/pull/7369)). Fixes #18784.
 * Tweak FacePile tooltip to include whether or not you are included ([\#7367](https://github.com/matrix-org/matrix-react-sdk/pull/7367)). Fixes #17278.

## 🐛 Bug Fixes
 * Ensure group audio-only calls don't switch on the webcam on join ([\#20234](https://github.com/vector-im/element-web/pull/20234)). Fixes #20212.
 * Fix wrongly wrapping code blocks, breaking line numbers ([\#7507](https://github.com/matrix-org/matrix-react-sdk/pull/7507)). Fixes #20316.
 * Set header buttons to no phase when right panel is closed ([\#7506](https://github.com/matrix-org/matrix-react-sdk/pull/7506)).
 * Fix active Jitsi calls (and other active widgets) not being visible on screen, by showing them in PiP if they are not visible in any other container ([\#7435](https://github.com/matrix-org/matrix-react-sdk/pull/7435)). Fixes #15169 and #20275.
 * Fix layout of message bubble preview in settings ([\#7497](https://github.com/matrix-org/matrix-react-sdk/pull/7497)).
 * Prevent mutations of js-sdk owned objects as it breaks accountData ([\#7504](https://github.com/matrix-org/matrix-react-sdk/pull/7504)). Fixes matrix-org/element-web-rageshakes#7822.
 * fallback properly with pluralized strings ([\#7495](https://github.com/matrix-org/matrix-react-sdk/pull/7495)). Fixes #20455.
 * Consider continuations when resolving whether a tile is last in section ([\#7461](https://github.com/matrix-org/matrix-react-sdk/pull/7461)). Fixes #20368 and #20369.
 * Fix read receipts and sent indicators for bubble layout ([\#7460](https://github.com/matrix-org/matrix-react-sdk/pull/7460)). Fixes #18298 and #20345.
 * null-guard dataset mxTheme to prevent html exports from exploding ([\#7493](https://github.com/matrix-org/matrix-react-sdk/pull/7493)). Fixes #20453.
 * Fix avatar container overlapping give feedback cta ([\#7491](https://github.com/matrix-org/matrix-react-sdk/pull/7491)). Fixes matrix-org/element-web-rageshakes#7987.
 * Fix jump to bottom button working when on a permalink ([\#7494](https://github.com/matrix-org/matrix-react-sdk/pull/7494)). Fixes #19813.
 * Remove the Description from the location picker ([\#7485](https://github.com/matrix-org/matrix-react-sdk/pull/7485)).
 * Fix look of the untrusted device dialog ([\#7487](https://github.com/matrix-org/matrix-react-sdk/pull/7487)). Fixes #20447. Contributed by @SimonBrandner.
 * Hide maximise button in the sticker picker  ([\#7488](https://github.com/matrix-org/matrix-react-sdk/pull/7488)). Fixes #20443. Contributed by @SimonBrandner.
 * Fix space ordering to match newer spec ([\#7481](https://github.com/matrix-org/matrix-react-sdk/pull/7481)).
 * Fix typing notification colors ([\#7490](https://github.com/matrix-org/matrix-react-sdk/pull/7490)). Fixes #20144. Contributed by @SimonBrandner.
 * fix fallback for pluralized strings ([\#7480](https://github.com/matrix-org/matrix-react-sdk/pull/7480)). Fixes #20426.
 * Fix right panel soft crashes chat rooms ([\#7479](https://github.com/matrix-org/matrix-react-sdk/pull/7479)). Fixes #20433.
 * update yarn.lock and i18n ([\#7476](https://github.com/matrix-org/matrix-react-sdk/pull/7476)). Fixes #20426 and #20423.
 * Don't send typing notification when restoring composer draft ([\#7477](https://github.com/matrix-org/matrix-react-sdk/pull/7477)). Fixes #20424.
 * Fix room joining spinner being incorrect if you change room mid-join ([\#7473](https://github.com/matrix-org/matrix-react-sdk/pull/7473)).
 * Only return the approved widget capabilities instead of accepting all requested capabilities ([\#7454](https://github.com/matrix-org/matrix-react-sdk/pull/7454)). Contributed by @dhenneke.
 * Fix quoting messages from the search view ([\#7466](https://github.com/matrix-org/matrix-react-sdk/pull/7466)). Fixes #20353.
 * Attribute fallback i18n strings with lang attribute ([\#7323](https://github.com/matrix-org/matrix-react-sdk/pull/7323)).
 * Fix spotlight cmd-k wrongly expanding left panel ([\#7463](https://github.com/matrix-org/matrix-react-sdk/pull/7463)). Fixes #20399.
 * Fix room_id check when adding user widgets ([\#7448](https://github.com/matrix-org/matrix-react-sdk/pull/7448)). Fixes #19382. Contributed by @bink.
 * Add new line in settings label ([\#7451](https://github.com/matrix-org/matrix-react-sdk/pull/7451)). Fixes #20365.
 * Fix handling incoming redactions in EventIndex ([\#7443](https://github.com/matrix-org/matrix-react-sdk/pull/7443)). Fixes #19326.
 * Fix room alias address isn't checked for validity before being shown as added ([\#7107](https://github.com/matrix-org/matrix-react-sdk/pull/7107)). Fixes #19609. Contributed by @Palid.
 * Call view accessibility fixes ([\#7439](https://github.com/matrix-org/matrix-react-sdk/pull/7439)). Fixes #18516.
 * Fix offscreen canvas breaking with split-brained firefox support ([\#7440](https://github.com/matrix-org/matrix-react-sdk/pull/7440)).
 * Removed red shield in forwarding preview. ([\#7447](https://github.com/matrix-org/matrix-react-sdk/pull/7447)). Contributed by @ankur12-1610.
 * Wrap status message ([\#7325](https://github.com/matrix-org/matrix-react-sdk/pull/7325)). Fixes #20092. Contributed by @SimonBrandner.
 * Move hideSender logic into state so it causes re-render ([\#7413](https://github.com/matrix-org/matrix-react-sdk/pull/7413)). Fixes #18448.
 * Fix dialpad positioning ([\#7446](https://github.com/matrix-org/matrix-react-sdk/pull/7446)). Fixes #20175. Contributed by @SimonBrandner.
 * Hide non-functional list options on Suggested sublist ([\#7410](https://github.com/matrix-org/matrix-react-sdk/pull/7410)). Fixes #20252.
 * Fix width overflow in mini composer overflow menu ([\#7411](https://github.com/matrix-org/matrix-react-sdk/pull/7411)). Fixes #20263.
 * Fix being wrongly sent to Home space when creating/joining/leaving rooms ([\#7418](https://github.com/matrix-org/matrix-react-sdk/pull/7418)). Fixes matrix-org/element-web-rageshakes#7331 #20246 and #20240.
 * Fix HTML Export where the data-mx-theme is `Light` not `light` ([\#7415](https://github.com/matrix-org/matrix-react-sdk/pull/7415)).
 * Don't disable username/password fields whilst doing wk-lookup ([\#7438](https://github.com/matrix-org/matrix-react-sdk/pull/7438)). Fixes #20121.
 * Prevent keyboard propagation out of context menus ([\#7437](https://github.com/matrix-org/matrix-react-sdk/pull/7437)). Fixes #20317.
 * Fix nulls leaking into geo urls ([\#7433](https://github.com/matrix-org/matrix-react-sdk/pull/7433)).
 * Fix zIndex of peristent apps in miniMode ([\#7429](https://github.com/matrix-org/matrix-react-sdk/pull/7429)).
 * Space panel should watch spaces for space name changes ([\#7432](https://github.com/matrix-org/matrix-react-sdk/pull/7432)).
 * Fix list formatting alternating on edit ([\#7422](https://github.com/matrix-org/matrix-react-sdk/pull/7422)). Fixes #20073. Contributed by @renancleyson-dev.
 * Don't show `Testing small changes` without UIFeature.Feedback ([\#7427](https://github.com/matrix-org/matrix-react-sdk/pull/7427)). Fixes #20298.
 * Fix invisible toggle space panel button ([\#7426](https://github.com/matrix-org/matrix-react-sdk/pull/7426)). Fixes #20279.
 * Fix legacy breadcrumbs wrongly showing up ([\#7425](https://github.com/matrix-org/matrix-react-sdk/pull/7425)).
 * Space Panel use SettingsStore instead of SpaceStore as source of truth ([\#7404](https://github.com/matrix-org/matrix-react-sdk/pull/7404)). Fixes #20250.
 * Fix inline code block nowrap issue ([\#7406](https://github.com/matrix-org/matrix-react-sdk/pull/7406)).
 * Fix notification badge for All Rooms space ([\#7401](https://github.com/matrix-org/matrix-react-sdk/pull/7401)). Fixes #20229.
 * Show error if could not load space hierarchy ([\#7399](https://github.com/matrix-org/matrix-react-sdk/pull/7399)). Fixes #20221.
 * Increase gap between ELS and the subsequent event to prevent overlap ([\#7391](https://github.com/matrix-org/matrix-react-sdk/pull/7391)). Fixes #18319.
 * Fix list of members in space preview ([\#7356](https://github.com/matrix-org/matrix-react-sdk/pull/7356)). Fixes #19781.
 * Fix sizing of e2e shield in bubble layout ([\#7394](https://github.com/matrix-org/matrix-react-sdk/pull/7394)). Fixes #19090.
 * Fix bubble radius wrong when followed by a state event from same user ([\#7393](https://github.com/matrix-org/matrix-react-sdk/pull/7393)). Fixes #18982.
 * Fix alignment between ELS and Events in bubble layout ([\#7392](https://github.com/matrix-org/matrix-react-sdk/pull/7392)). Fixes #19652 and #19057.
 * Don't include the accuracy parameter in location events if accuracy could not be determined. ([\#7375](https://github.com/matrix-org/matrix-react-sdk/pull/7375)).
 * Make compact layout only apply to Modern layout ([\#7382](https://github.com/matrix-org/matrix-react-sdk/pull/7382)). Fixes #18412.
 * Pin qrcode to fix e2e verification bug ([\#7378](https://github.com/matrix-org/matrix-react-sdk/pull/7378)). Fixes #20188.
 * Add internationalisation to progress strings in room export dialog ([\#7385](https://github.com/matrix-org/matrix-react-sdk/pull/7385)). Fixes #20208.
 * Prevent escape to cancel edit from also scrolling to bottom ([\#7380](https://github.com/matrix-org/matrix-react-sdk/pull/7380)). Fixes #20182.
 * Fix narrow mode composer buttons for polls labs ([\#7386](https://github.com/matrix-org/matrix-react-sdk/pull/7386)). Fixes #20067.
 * Fix useUserStatusMessage exploding on unknown user ([\#7365](https://github.com/matrix-org/matrix-react-sdk/pull/7365)).
 * Fix room join spinner in room list header ([\#7364](https://github.com/matrix-org/matrix-react-sdk/pull/7364)). Fixes #20139.
 * Fix room search sometimes not opening spotlight ([\#7363](https://github.com/matrix-org/matrix-react-sdk/pull/7363)). Fixes matrix-org/element-web-rageshakes#7288.

**Changelogs for older versions can be found [here](CHANGELOG-pre-2022.md).**
