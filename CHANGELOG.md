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
