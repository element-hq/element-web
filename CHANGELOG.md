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
