Changes in [15.3.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.3.0) (2021-12-20)
==================================================================================================

## ✨ Features
 * Improve fallback key behaviour ([\#2037](https://github.com/matrix-org/matrix-js-sdk/pull/2037)).
 * Add new room event filter fields ([\#2051](https://github.com/matrix-org/matrix-js-sdk/pull/2051)).
 * Add method to fetch /account/whoami ([\#2046](https://github.com/matrix-org/matrix-js-sdk/pull/2046)).

## 🐛 Bug Fixes
 * Filter out falsey opts in /relations API hits ([\#2059](https://github.com/matrix-org/matrix-js-sdk/pull/2059)). Fixes vector-im/element-web#20137.
 * Fix paginateEventTimeline resolve to boolean ([\#2054](https://github.com/matrix-org/matrix-js-sdk/pull/2054)).
 * Fix incorrect MSC3089 typings and add null checks ([\#2049](https://github.com/matrix-org/matrix-js-sdk/pull/2049)).

Changes in [15.3.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.3.0-rc.1) (2021-12-14)
============================================================================================================

## ✨ Features
 * Improve fallback key behaviour ([\#2037](https://github.com/matrix-org/matrix-js-sdk/pull/2037)).
 * Add new room event filter fields ([\#2051](https://github.com/matrix-org/matrix-js-sdk/pull/2051)).
 * Add method to fetch /account/whoami ([\#2046](https://github.com/matrix-org/matrix-js-sdk/pull/2046)).

## 🐛 Bug Fixes
 * Filter out falsey opts in /relations API hits ([\#2059](https://github.com/matrix-org/matrix-js-sdk/pull/2059)). Fixes vector-im/element-web#20137.
 * Fix paginateEventTimeline resolve to boolean ([\#2054](https://github.com/matrix-org/matrix-js-sdk/pull/2054)).
 * Fix incorrect MSC3089 typings and add null checks ([\#2049](https://github.com/matrix-org/matrix-js-sdk/pull/2049)).

Changes in [15.2.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.2.1) (2021-12-13)
==================================================================================================

 * Security release with updated version of Olm to fix https://matrix.org/blog/2021/12/03/pre-disclosure-upcoming-security-release-of-libolm-and-matrix-js-sdk

Changes in [15.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.2.0) (2021-12-06)
==================================================================================================

## ✨ Features
 * Remove support for `ArrayBuffer` in unstable MSC3089 `createFile()` and `createNewVersion()` and instead use same content types as handled by `MatrixClient.uploadContent()`. This enables support for Node.js. ([\#2014](https://github.com/matrix-org/matrix-js-sdk/pull/2014)).
 * Support for password-based backup on Node.js ([\#2021](https://github.com/matrix-org/matrix-js-sdk/pull/2021)).
 * Add optional force parameter when ensuring Olm sessions ([\#2027](https://github.com/matrix-org/matrix-js-sdk/pull/2027)).

## 🐛 Bug Fixes
 * Fix call upgrades ([\#2024](https://github.com/matrix-org/matrix-js-sdk/pull/2024)). Contributed by @SimonBrandner.

Changes in [15.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.2.0-rc.1) (2021-11-30)
============================================================================================================

## ✨ Features
 * Remove support for `ArrayBuffer` in unstable MSC3089 `createFile()` and `createNewVersion()` and instead use same content types as handled by `MatrixClient.uploadContent()`. This enables support for Node.js. ([\#2014](https://github.com/matrix-org/matrix-js-sdk/pull/2014)).
 * Support for password-based backup on Node.js ([\#2021](https://github.com/matrix-org/matrix-js-sdk/pull/2021)).
 * Add optional force parameter when ensuring Olm sessions ([\#2027](https://github.com/matrix-org/matrix-js-sdk/pull/2027)).

## 🐛 Bug Fixes
 * Fix call upgrades ([\#2024](https://github.com/matrix-org/matrix-js-sdk/pull/2024)). Contributed by @SimonBrandner.

Changes in [15.1.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.1.1) (2021-11-22)
==================================================================================================

## 🐛 Bug Fixes
 * Fix edit history being broken after editing an unencrypted event with an encrypted event ([\#2013](https://github.com/matrix-org/matrix-js-sdk/pull/2013)). Fixes vector-im/element-web#19651 and vector-im/element-web#19651. Contributed by @aaronraimist.
 * Make events pagination responses parse threads ([\#2011](https://github.com/matrix-org/matrix-js-sdk/pull/2011)). Fixes vector-im/element-web#19587 and vector-im/element-web#19587.

Changes in [15.1.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.1.1-rc.1) (2021-11-17)
============================================================================================================

## 🐛 Bug Fixes
 * Fix edit history being broken after editing an unencrypted event with an encrypted event ([\#2013](https://github.com/matrix-org/matrix-js-sdk/pull/2013)). Fixes vector-im/element-web#19651 and vector-im/element-web#19651. Contributed by @aaronraimist.
 * Make events pagination responses parse threads ([\#2011](https://github.com/matrix-org/matrix-js-sdk/pull/2011)). Fixes vector-im/element-web#19587 and vector-im/element-web#19587.

Changes in [15.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.1.0) (2021-11-08)
==================================================================================================

## 🦖 Deprecations
 * Mark old verification methods as deprecated ([\#1994](https://github.com/matrix-org/matrix-js-sdk/pull/1994)).

## ✨ Features
 * Try to set a sender on search result events if possible ([\#2004](https://github.com/matrix-org/matrix-js-sdk/pull/2004)).
 * Port some changes from group calls branch to develop ([\#2001](https://github.com/matrix-org/matrix-js-sdk/pull/2001)). Contributed by @SimonBrandner.
 * Fetch room membership from server rather than relying on stored data ([\#1998](https://github.com/matrix-org/matrix-js-sdk/pull/1998)).
 * Add method to fetch the MSC3266 Room Summary of a Room ([\#1988](https://github.com/matrix-org/matrix-js-sdk/pull/1988)).

## 🐛 Bug Fixes
 * Don't show `Unable to access microphone` when cancelling screensharing dialog ([\#2005](https://github.com/matrix-org/matrix-js-sdk/pull/2005)). Fixes vector-im/element-web#19533 and vector-im/element-web#19533. Contributed by @SimonBrandner.
 * Strip direction override characters from display names ([\#1992](https://github.com/matrix-org/matrix-js-sdk/pull/1992)). Fixes vector-im/element-web#1712 and vector-im/element-web#1712.

Changes in [15.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v15.1.0-rc.1) (2021-11-02)
============================================================================================================

## 🦖 Deprecations
 * Mark old verification methods as deprecated ([\#1994](https://github.com/matrix-org/matrix-js-sdk/pull/1994)).

## ✨ Features
 * Try to set a sender on search result events if possible ([\#2004](https://github.com/matrix-org/matrix-js-sdk/pull/2004)).
 * Port some changes from group calls branch to develop ([\#2001](https://github.com/matrix-org/matrix-js-sdk/pull/2001)). Contributed by @SimonBrandner.
 * Fetch room membership from server rather than relying on stored data ([\#1998](https://github.com/matrix-org/matrix-js-sdk/pull/1998)).
 * Add method to fetch the MSC3266 Room Summary of a Room ([\#1988](https://github.com/matrix-org/matrix-js-sdk/pull/1988)).

## 🐛 Bug Fixes
 * Don't show `Unable to access microphone` when cancelling screensharing dialog ([\#2005](https://github.com/matrix-org/matrix-js-sdk/pull/2005)). Fixes vector-im/element-web#19533 and vector-im/element-web#19533. Contributed by @SimonBrandner.
 * Strip direction override characters from display names ([\#1992](https://github.com/matrix-org/matrix-js-sdk/pull/1992)). Fixes vector-im/element-web#1712 and vector-im/element-web#1712.

Changes in [15.0.0](https://github.com/vector-im/element-desktop/releases/tag/v15.0.0) (2021-10-25)
===================================================================================================

## 🚨 BREAKING CHANGES
 * Use `ICallFeedOpts` in the `CallFeed` constructor. To construct a new `CallFeed` object you have to pass `ICallFeedOpts` e.g. `const callFeed = new CallFeed({client ([\#1964](https://github.com/matrix-org/matrix-js-sdk/pull/1964)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## ✨ Features
 * Make threads use 'm.thread' relation ([\#1980](https://github.com/matrix-org/matrix-js-sdk/pull/1980)).
 * Try to answer a call without video if we can't access the camera  ([\#1972](https://github.com/matrix-org/matrix-js-sdk/pull/1972)). Fixes vector-im/element-web#17975 and vector-im/element-web#17975. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Make `opts` in `importRoomKeys()` optional ([\#1974](https://github.com/matrix-org/matrix-js-sdk/pull/1974)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Enable TypeScript declaration maps ([\#1966](https://github.com/matrix-org/matrix-js-sdk/pull/1966)). Contributed by [Alexendoo](https://github.com/Alexendoo).

## 🐛 Bug Fixes
 * Fix `requestVerificationDM` with chronological `pendingEventOrdering` ([\#1943](https://github.com/matrix-org/matrix-js-sdk/pull/1943)). Contributed by [freaktechnik](https://github.com/freaktechnik).

Changes in [15.0.0-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v15.0.0-rc.1) (2021-10-19)
=============================================================================================================

## 🚨 BREAKING CHANGES
 * Use `ICallFeedOpts` in the `CallFeed` constructor. To construct a new `CallFeed` object you have to pass `ICallFeedOpts` e.g. `const callFeed = new CallFeed({client ([\#1964](https://github.com/matrix-org/matrix-js-sdk/pull/1964)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## ✨ Features
 * Make threads use 'm.thread' relation ([\#1980](https://github.com/matrix-org/matrix-js-sdk/pull/1980)).
 * Try to answer a call without video if we can't access the camera  ([\#1972](https://github.com/matrix-org/matrix-js-sdk/pull/1972)). Fixes vector-im/element-web#17975 and vector-im/element-web#17975. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Make `opts` in `importRoomKeys()` optional ([\#1974](https://github.com/matrix-org/matrix-js-sdk/pull/1974)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Enable TypeScript declaration maps ([\#1966](https://github.com/matrix-org/matrix-js-sdk/pull/1966)). Contributed by [Alexendoo](https://github.com/Alexendoo).

## 🐛 Bug Fixes
 * Fix `requestVerificationDM` with chronological `pendingEventOrdering` ([\#1943](https://github.com/matrix-org/matrix-js-sdk/pull/1943)). Contributed by [freaktechnik](https://github.com/freaktechnik).

Changes in [14.0.1](https://github.com/vector-im/element-desktop/releases/tag/v14.0.1) (2021-10-12)
===================================================================================================

## 🚨 BREAKING CHANGES
 * Support for call upgrades. `setLocalVideoMuted()` and `setMicrophoneMuted()` are now `async` and return the new mute state ([\#1827](https://github.com/matrix-org/matrix-js-sdk/pull/1827)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## ✨ Features
 * Implement file versioning for tree spaces ([\#1952](https://github.com/matrix-org/matrix-js-sdk/pull/1952)).
 * Allow answering calls without audio/video ([\#1950](https://github.com/matrix-org/matrix-js-sdk/pull/1950)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `bound` to `IThreepid` ([\#1941](https://github.com/matrix-org/matrix-js-sdk/pull/1941)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `trusted_locally` to `TrustInfo` ([\#1942](https://github.com/matrix-org/matrix-js-sdk/pull/1942)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * Fix incorrect return value type in getJoinedRooms() ([\#1959](https://github.com/matrix-org/matrix-js-sdk/pull/1959)). Contributed by [psrpinto](https://github.com/psrpinto).
 * Make sure to set `callLengthInterval` only once ([\#1958](https://github.com/matrix-org/matrix-js-sdk/pull/1958)). Fixes vector-im/element-web#19221 and vector-im/element-web#19221. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix event partitioning from non threading ready clients ([\#1948](https://github.com/matrix-org/matrix-js-sdk/pull/1948)).
 * Ensure unencrypted fields get exposed by getEffectiveEvent() ([\#1938](https://github.com/matrix-org/matrix-js-sdk/pull/1938)). Fixes vector-im/element-web#19062 and vector-im/element-web#19062.


Changes in [14.0.0-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v14.0.0-rc.1) (2021-10-04)
=============================================================================================================

## 🚨 BREAKING CHANGES
 * Support for call upgrades. `setLocalVideoMuted()` and `setMicrophoneMuted()` are now `async` and return the new mute state ([\#1827](https://github.com/matrix-org/matrix-js-sdk/pull/1827)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## ✨ Features
 * Implement file versioning for tree spaces ([\#1952](https://github.com/matrix-org/matrix-js-sdk/pull/1952)).
 * Allow answering calls without audio/video ([\#1950](https://github.com/matrix-org/matrix-js-sdk/pull/1950)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `bound` to `IThreepid` ([\#1941](https://github.com/matrix-org/matrix-js-sdk/pull/1941)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `trusted_locally` to `TrustInfo` ([\#1942](https://github.com/matrix-org/matrix-js-sdk/pull/1942)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * Fix incorrect return value type in getJoinedRooms() ([\#1959](https://github.com/matrix-org/matrix-js-sdk/pull/1959)). Contributed by [psrpinto](https://github.com/psrpinto).
 * Make sure to set `callLengthInterval` only once ([\#1958](https://github.com/matrix-org/matrix-js-sdk/pull/1958)). Fixes vector-im/element-web#19221 and vector-im/element-web#19221. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix event partitioning from non threading ready clients ([\#1948](https://github.com/matrix-org/matrix-js-sdk/pull/1948)).
 * Ensure unencrypted fields get exposed by getEffectiveEvent() ([\#1938](https://github.com/matrix-org/matrix-js-sdk/pull/1938)). Fixes vector-im/element-web#19062 and vector-im/element-web#19062.

Changes in [13.0.0](https://github.com/vector-im/element-desktop/releases/tag/v13.0.0) (2021-09-27)
===================================================================================================

## ✨ Features
 * Add `getHistoryVisibility()` and `getGuestAccess()` ([\#1940](https://github.com/matrix-org/matrix-js-sdk/pull/1940)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `getBuffer()` to `QRCodeData` ([\#1927](https://github.com/matrix-org/matrix-js-sdk/pull/1927)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Added `createDataChannel()` and `CallEvent.DataChannel` to `MatrixCall` for creating and listening for WebRTC datachannels. ([\#1929](https://github.com/matrix-org/matrix-js-sdk/pull/1929)). Contributed by [robertlong](https://github.com/robertlong).
 * Add file locking to MSC3089 branches ([\#1909](https://github.com/matrix-org/matrix-js-sdk/pull/1909)).
 * Add `hasBeenCancelled` to `VerificationBase` ([\#1915](https://github.com/matrix-org/matrix-js-sdk/pull/1915)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `ISasEvent` ([\#1908](https://github.com/matrix-org/matrix-js-sdk/pull/1908)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Count notifications in encrypted rooms client-side ([\#1872](https://github.com/matrix-org/matrix-js-sdk/pull/1872)). Fixes vector-im/element-web#15393 and vector-im/element-web#15393. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Exclude opt-in Element performance metrics from encryption ([\#1897](https://github.com/matrix-org/matrix-js-sdk/pull/1897)).

## 🐛 Bug Fixes
 * Fix race on automatic backup restore ([\#1936](https://github.com/matrix-org/matrix-js-sdk/pull/1936)). Fixes vector-im/element-web#17781 and vector-im/element-web#17781.

Changes in [13.0.0-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v13.0.0-rc.1) (2021-09-21)
=============================================================================================================

## ✨ Features
 * Add `getHistoryVisibility()` and `getGuestAccess()` ([\#1940](https://github.com/matrix-org/matrix-js-sdk/pull/1940)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `getBuffer()` to `QRCodeData` ([\#1927](https://github.com/matrix-org/matrix-js-sdk/pull/1927)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Added `createDataChannel()` and `CallEvent.DataChannel` to `MatrixCall` for creating and listening for WebRTC datachannels. ([\#1929](https://github.com/matrix-org/matrix-js-sdk/pull/1929)). Contributed by [robertlong](https://github.com/robertlong).
 * Add file locking to MSC3089 branches ([\#1909](https://github.com/matrix-org/matrix-js-sdk/pull/1909)).
 * Add `hasBeenCancelled` to `VerificationBase` ([\#1915](https://github.com/matrix-org/matrix-js-sdk/pull/1915)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add `ISasEvent` ([\#1908](https://github.com/matrix-org/matrix-js-sdk/pull/1908)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Count notifications in encrypted rooms client-side ([\#1872](https://github.com/matrix-org/matrix-js-sdk/pull/1872)). Fixes vector-im/element-web#15393 and vector-im/element-web#15393. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Exclude opt-in Element performance metrics from encryption ([\#1897](https://github.com/matrix-org/matrix-js-sdk/pull/1897)).

## 🐛 Bug Fixes
 * Fix race on automatic backup restore ([\#1936](https://github.com/matrix-org/matrix-js-sdk/pull/1936)). Fixes vector-im/element-web#17781 and vector-im/element-web#17781.

Changes in [12.5.0](https://github.com/vector-im/element-desktop/releases/tag/v12.5.0) (2021-09-14)
===================================================================================================

## ✨ Features
 * [Release] Exclude opt-in Element performance metrics from encryption ([\#1901](https://github.com/matrix-org/matrix-js-sdk/pull/1901)).
 * Give `MatrixCall` the capability to emit `LengthChanged` events ([\#1873](https://github.com/matrix-org/matrix-js-sdk/pull/1873)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve browser example ([\#1875](https://github.com/matrix-org/matrix-js-sdk/pull/1875)). Contributed by [psrpinto](https://github.com/psrpinto).
 * Give `CallFeed` the capability to emit on volume changes ([\#1865](https://github.com/matrix-org/matrix-js-sdk/pull/1865)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * Fix verification request cancellation ([\#1871](https://github.com/matrix-org/matrix-js-sdk/pull/1871)).

Changes in [12.4.1](https://github.com/vector-im/element-desktop/releases/tag/v12.4.1) (2021-09-13)
===================================================================================================

## 🔒 SECURITY FIXES
 * Fix a security issue with message key sharing. See https://matrix.org/blog/2021/09/13/vulnerability-disclosure-key-sharing
   for details.

Changes in [12.4.0](https://github.com/vector-im/element-desktop/releases/tag/v12.4.0) (2021-08-31)
===================================================================================================

## 🦖 Deprecations
 * Deprecate groups APIs. Groups are no longer supported, only Synapse has support. They are being replaced by Spaces which build off of Rooms and are far more flexible. ([\#1792](https://github.com/matrix-org/matrix-js-sdk/pull/1792)).

## ✨ Features
 * Add method for including extra fields when uploading to a tree space ([\#1850](https://github.com/matrix-org/matrix-js-sdk/pull/1850)).

## 🐛 Bug Fixes
 * Fix broken voice calls, no ringing and broken call notifications ([\#1858](https://github.com/matrix-org/matrix-js-sdk/pull/1858)). Fixes vector-im/element-web#18578 vector-im/element-web#18538 and vector-im/element-web#18578. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Revert "Fix glare related regressions" ([\#1857](https://github.com/matrix-org/matrix-js-sdk/pull/1857)).
 * Fix glare related regressions ([\#1851](https://github.com/matrix-org/matrix-js-sdk/pull/1851)). Fixes vector-im/element-web#18538 and vector-im/element-web#18538. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix temporary call messages being handled without call  ([\#1834](https://github.com/matrix-org/matrix-js-sdk/pull/1834)). Contributed by [Palid](https://github.com/Palid).
 * Fix conditional on returning file tree spaces ([\#1841](https://github.com/matrix-org/matrix-js-sdk/pull/1841)).

Changes in [12.3.1](https://github.com/vector-im/element-desktop/releases/tag/v12.3.1) (2021-08-17)
===================================================================================================

## 🐛 Bug Fixes
 * Fix multiple VoIP regressions ([\#1860](https://github.com/matrix-org/matrix-js-sdk/pull/1860)).

Changes in [12.3.0](https://github.com/vector-im/element-desktop/releases/tag/v12.3.0) (2021-08-16)
===================================================================================================

## ✨ Features
 * Support for MSC3291: Muting in VoIP calls ([\#1812](https://github.com/matrix-org/matrix-js-sdk/pull/1812)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Support for screen-sharing using multi-stream VoIP (MSC3077) ([\#1685](https://github.com/matrix-org/matrix-js-sdk/pull/1685)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Handle DTMF support ([\#1813](https://github.com/matrix-org/matrix-js-sdk/pull/1813)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * [Release] Fix glare related regressions ([\#1854](https://github.com/matrix-org/matrix-js-sdk/pull/1854)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix the types in shipped package ([\#1842](https://github.com/matrix-org/matrix-js-sdk/pull/1842)). Fixes vector-im/element-web#18503 and vector-im/element-web#18503.
 * Fix error on turning off screensharing ([\#1833](https://github.com/matrix-org/matrix-js-sdk/pull/1833)). Fixes vector-im/element-web#18449. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix blank profile in join events ([\#1837](https://github.com/matrix-org/matrix-js-sdk/pull/1837)). Fixes vector-im/element-web#18321.
 * fix TURN by fixing regression preventing multiple ICE candidates from sending. ([\#1838](https://github.com/matrix-org/matrix-js-sdk/pull/1838)).
 * Send `user_hangup` reason if the opponent supports it ([\#1820](https://github.com/matrix-org/matrix-js-sdk/pull/1820)). Fixes vector-im/element-web#18219. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Apply hidden char check to rawDisplayName too ([\#1816](https://github.com/matrix-org/matrix-js-sdk/pull/1816)).
 * Only clear bit 63 when we create the IV ([\#1819](https://github.com/matrix-org/matrix-js-sdk/pull/1819)).

Changes in [12.2.0](https://github.com/vector-im/element-desktop/releases/tag/v12.2.0) (2021-08-02)
===================================================================================================

## ✨ Features
 * Improve calculateRoomName performances by using Intl.Collator
   [\#1801](https://github.com/matrix-org/matrix-js-sdk/pull/1801)
 * Switch callEventHandler from listening on `event` to `Room.timeline`
   [\#1789](https://github.com/matrix-org/matrix-js-sdk/pull/1789)
 * Expose MatrixEvent's internal clearEvent as a function
   [\#1784](https://github.com/matrix-org/matrix-js-sdk/pull/1784)

## 🐛 Bug Fixes
 * Clean up Event.clearEvent handling to fix a bug where malformed events with falsey content wouldn't be considered decrypted
   [\#1807](https://github.com/matrix-org/matrix-js-sdk/pull/1807)
 * Standardise spelling and casing of homeserver, identity server, and integration manager
   [\#1782](https://github.com/matrix-org/matrix-js-sdk/pull/1782)

Changes in [12.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v12.1.0) (2021-07-19)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v12.1.0-rc.1...v12.1.0)

 * No changes from rc.1

Changes in [12.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v12.1.0-rc.1) (2021-07-14)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v12.0.1...v12.1.0-rc.1)

 * Add VS Code to gitignore
   [\#1783](https://github.com/matrix-org/matrix-js-sdk/pull/1783)
 * Make `Crypto::inRoomVerificationRequests` public
   [\#1781](https://github.com/matrix-org/matrix-js-sdk/pull/1781)
 * Call `setEventMetadata()` for filtered `timelineSet`s
   [\#1765](https://github.com/matrix-org/matrix-js-sdk/pull/1765)
 * Symmetric backup
   [\#1775](https://github.com/matrix-org/matrix-js-sdk/pull/1775)
 * Attempt to fix megolm key not being in SSSS
   [\#1776](https://github.com/matrix-org/matrix-js-sdk/pull/1776)
 * Convert SecretStorage to TypeScript
   [\#1774](https://github.com/matrix-org/matrix-js-sdk/pull/1774)
 * Strip hash from urls being previewed to de-duplicate
   [\#1721](https://github.com/matrix-org/matrix-js-sdk/pull/1721)
 * Do not generate a lockfile when running in CI
   [\#1773](https://github.com/matrix-org/matrix-js-sdk/pull/1773)
 * Tidy up secret requesting code
   [\#1766](https://github.com/matrix-org/matrix-js-sdk/pull/1766)
 * Convert Sync and SyncAccumulator to Typescript
   [\#1763](https://github.com/matrix-org/matrix-js-sdk/pull/1763)
 * Convert EventTimeline, EventTimelineSet and TimelineWindow to TS
   [\#1762](https://github.com/matrix-org/matrix-js-sdk/pull/1762)
 * Comply with new member-delimiter-style rule
   [\#1764](https://github.com/matrix-org/matrix-js-sdk/pull/1764)
 * Do not honor string power levels
   [\#1754](https://github.com/matrix-org/matrix-js-sdk/pull/1754)
 * Typescriptify some crypto stuffs
   [\#1508](https://github.com/matrix-org/matrix-js-sdk/pull/1508)
 * Make filterId read/write and optional
   [\#1760](https://github.com/matrix-org/matrix-js-sdk/pull/1760)

Changes in [12.0.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v12.0.1) (2021-07-05)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v12.0.1-rc.1...v12.0.1)

 * No changes from rc.1

Changes in [12.0.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v12.0.1-rc.1) (2021-06-29)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v12.0.0...v12.0.1-rc.1)

 * Fix broken /messages filtering due to internal field changes in
   FilterComponent
   [\#1759](https://github.com/matrix-org/matrix-js-sdk/pull/1759)
 * Convert crypto index to TS
   [\#1749](https://github.com/matrix-org/matrix-js-sdk/pull/1749)
 * Fix typescript return types for membership update events
   [\#1739](https://github.com/matrix-org/matrix-js-sdk/pull/1739)
 * Fix types of MatrixEvent sender & target
   [\#1753](https://github.com/matrix-org/matrix-js-sdk/pull/1753)
 * Add keysharing on invites to File Tree Spaces
   [\#1744](https://github.com/matrix-org/matrix-js-sdk/pull/1744)
 * Convert Room and RoomState to Typescript
   [\#1746](https://github.com/matrix-org/matrix-js-sdk/pull/1746)
 * Improve type of IContent msgtype
   [\#1752](https://github.com/matrix-org/matrix-js-sdk/pull/1752)
 * Add PR template
   [\#1747](https://github.com/matrix-org/matrix-js-sdk/pull/1747)
 * Add functions to assist in immutability of Event objects
   [\#1738](https://github.com/matrix-org/matrix-js-sdk/pull/1738)
 * Convert Event Context to TS
   [\#1742](https://github.com/matrix-org/matrix-js-sdk/pull/1742)
 * Bump lodash from 4.17.20 to 4.17.21
   [\#1743](https://github.com/matrix-org/matrix-js-sdk/pull/1743)
 * Add invite retries to file trees
   [\#1740](https://github.com/matrix-org/matrix-js-sdk/pull/1740)
 * Convert IndexedDBStore to TS
   [\#1741](https://github.com/matrix-org/matrix-js-sdk/pull/1741)
 * Convert additional files to typescript
   [\#1736](https://github.com/matrix-org/matrix-js-sdk/pull/1736)

Changes in [12.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v12.0.0) (2021-06-21)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v12.0.0-rc.1...v12.0.0)

 * No changes since rc.1

Changes in [12.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v12.0.0-rc.1) (2021-06-15)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v11.2.0...v12.0.0-rc.1)

 * Rework how disambiguation is handled
   [\#1730](https://github.com/matrix-org/matrix-js-sdk/pull/1730)
 * Fix baseToString for n=0 edge case to match inverse stringToBase
   [\#1735](https://github.com/matrix-org/matrix-js-sdk/pull/1735)
 * Move various types from the react-sdk to the js-sdk
   [\#1734](https://github.com/matrix-org/matrix-js-sdk/pull/1734)
 * Unstable implementation of MSC3089: File Trees
   [\#1732](https://github.com/matrix-org/matrix-js-sdk/pull/1732)
 * Add MSC3230 event type to enum
   [\#1729](https://github.com/matrix-org/matrix-js-sdk/pull/1729)
 * Add separate reason code for transferred calls
   [\#1731](https://github.com/matrix-org/matrix-js-sdk/pull/1731)
 * Use sendonly for call hold
   [\#1728](https://github.com/matrix-org/matrix-js-sdk/pull/1728)
 * Stop breeding sync listeners
   [\#1727](https://github.com/matrix-org/matrix-js-sdk/pull/1727)
 * Fix semicolons in TS files
   [\#1724](https://github.com/matrix-org/matrix-js-sdk/pull/1724)
 * [BREAKING] Convert MatrixClient to TypeScript
   [\#1718](https://github.com/matrix-org/matrix-js-sdk/pull/1718)
 * Factor out backup management to a separate module
   [\#1697](https://github.com/matrix-org/matrix-js-sdk/pull/1697)
 * Ignore power_levels events with unknown state_key on room-state
   initialization
   [\#1723](https://github.com/matrix-org/matrix-js-sdk/pull/1723)
 * Revert 1579 (Fix extra negotiate message in Firefox)
   [\#1725](https://github.com/matrix-org/matrix-js-sdk/pull/1725)

Changes in [11.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v11.2.0) (2021-06-07)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v11.2.0-rc.1...v11.2.0)

 * No changes since rc.1

Changes in [11.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v11.2.0-rc.1) (2021-06-01)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v11.1.0...v11.2.0-rc.1)

 * Switch to stable endpoint/fields for MSC2858
   [\#1720](https://github.com/matrix-org/matrix-js-sdk/pull/1720)
 * Bump ws from 7.4.2 to 7.4.6
   [\#1715](https://github.com/matrix-org/matrix-js-sdk/pull/1715)
 * Make consistent call event type checks
   [\#1712](https://github.com/matrix-org/matrix-js-sdk/pull/1712)
 * Apply new Babel linting config
   [\#1714](https://github.com/matrix-org/matrix-js-sdk/pull/1714)
 * Bump browserslist from 4.16.1 to 4.16.6
   [\#1709](https://github.com/matrix-org/matrix-js-sdk/pull/1709)
 * Add user_busy call hangup reason
   [\#1713](https://github.com/matrix-org/matrix-js-sdk/pull/1713)
 * 👕 New linting rules
   [\#1688](https://github.com/matrix-org/matrix-js-sdk/pull/1688)
 * Emit relations created when target event added later
   [\#1710](https://github.com/matrix-org/matrix-js-sdk/pull/1710)
 * Bump libolm version and update package name.
   [\#1705](https://github.com/matrix-org/matrix-js-sdk/pull/1705)
 * Fix uploadContent not rejecting promise when http status code >= 400
   [\#1703](https://github.com/matrix-org/matrix-js-sdk/pull/1703)
 * Reduce noise in tests
   [\#1702](https://github.com/matrix-org/matrix-js-sdk/pull/1702)
 * Only log once if a Room lacks an m.room.create event
   [\#1700](https://github.com/matrix-org/matrix-js-sdk/pull/1700)
 * Cache normalized room name
   [\#1701](https://github.com/matrix-org/matrix-js-sdk/pull/1701)
 * Change call event handlers to adapt to undecrypted events
   [\#1698](https://github.com/matrix-org/matrix-js-sdk/pull/1698)

Changes in [11.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v11.1.0) (2021-05-24)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v11.1.0-rc.1...v11.1.0)

 * [Release] Bump libolm version and update package name
   [\#1707](https://github.com/matrix-org/matrix-js-sdk/pull/1707)
 * [Release] Change call event handlers to adapt to undecrypted events
   [\#1699](https://github.com/matrix-org/matrix-js-sdk/pull/1699)

Changes in [11.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v11.1.0-rc.1) (2021-05-19)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v11.0.0...v11.1.0-rc.1)

 * Fix regressed glare
   [\#1690](https://github.com/matrix-org/matrix-js-sdk/pull/1690)
 * Add m.reaction to EventType enum
   [\#1692](https://github.com/matrix-org/matrix-js-sdk/pull/1692)
 * Prioritise and reduce the amount of events decrypted on application startup
   [\#1684](https://github.com/matrix-org/matrix-js-sdk/pull/1684)
 * Decrypt relations before applying them to target event
   [\#1696](https://github.com/matrix-org/matrix-js-sdk/pull/1696)
 * Guard against duplicates in `Relations` model

Changes in [11.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v11.0.0) (2021-05-17)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v11.0.0-rc.1...v11.0.0)

 * [Release] Fix regressed glare
   [\#1695](https://github.com/matrix-org/matrix-js-sdk/pull/1695)

Changes in [11.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v11.0.0-rc.1) (2021-05-11)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v10.1.0...v11.0.0-rc.1)

BREAKING CHANGES
---

 * `MatrixCall` and related APIs have been redesigned to support multiple streams 
   (see [\#1660](https://github.com/matrix-org/matrix-js-sdk/pull/1660) for more details)

All changes
---

 * Switch from MSC1772 unstable prefixes to stable
   [\#1679](https://github.com/matrix-org/matrix-js-sdk/pull/1679)
 * Update the VoIP example to work with the new changes
   [\#1680](https://github.com/matrix-org/matrix-js-sdk/pull/1680)
 * Bump hosted-git-info from 2.8.8 to 2.8.9
   [\#1687](https://github.com/matrix-org/matrix-js-sdk/pull/1687)
 * Support for multiple streams (not MSC3077)
   [\#1660](https://github.com/matrix-org/matrix-js-sdk/pull/1660)
 * Tweak missing m.room.create errors to describe their source
   [\#1683](https://github.com/matrix-org/matrix-js-sdk/pull/1683)

Changes in [10.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v10.1.0) (2021-05-10)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v10.1.0-rc.1...v10.1.0)

 * No changes since rc.1

Changes in [10.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v10.1.0-rc.1) (2021-05-04)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v10.0.0...v10.1.0-rc.1)

 * Revert "Raise logging dramatically to chase pending event errors"
   [\#1681](https://github.com/matrix-org/matrix-js-sdk/pull/1681)
 * Add test coverage collection script
   [\#1677](https://github.com/matrix-org/matrix-js-sdk/pull/1677)
 * Raise logging dramatically to chase pending event errors
   [\#1678](https://github.com/matrix-org/matrix-js-sdk/pull/1678)
 * Support MSC3086 asserted identity
   [\#1674](https://github.com/matrix-org/matrix-js-sdk/pull/1674)
 * Fix `/search` with no results field work again
   [\#1670](https://github.com/matrix-org/matrix-js-sdk/pull/1670)
 * Add room.getMembers method
   [\#1672](https://github.com/matrix-org/matrix-js-sdk/pull/1672)

Changes in [10.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v10.0.0) (2021-04-26)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v10.0.0-rc.1...v10.0.0)

 * No changes since rc.1

Changes in [10.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v10.0.0-rc.1) (2021-04-21)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.11.0...v10.0.0-rc.1)

BREAKING CHANGES
---

 * The `RoomState.members` event is now only emitted when the room member's power level or the room's normal power level actually changes

All changes
---

 * Restrict event emit for room members that had power levels changed
   [\#1675](https://github.com/matrix-org/matrix-js-sdk/pull/1675)
 * Fix sync with misconfigured push rules
   [\#1669](https://github.com/matrix-org/matrix-js-sdk/pull/1669)
 * Add missing await
   [\#1665](https://github.com/matrix-org/matrix-js-sdk/pull/1665)
 * Migrate to `eslint-plugin-matrix-org`
   [\#1642](https://github.com/matrix-org/matrix-js-sdk/pull/1642)
 * Add missing event type enum for key verification done
   [\#1664](https://github.com/matrix-org/matrix-js-sdk/pull/1664)
 * Fix timeline jumpiness by setting correct txnId
   [\#1663](https://github.com/matrix-org/matrix-js-sdk/pull/1663)
 * Fix calling addEventListener if it does not exist
   [\#1661](https://github.com/matrix-org/matrix-js-sdk/pull/1661)
 * Persist unsent messages for subsequent sessions
   [\#1655](https://github.com/matrix-org/matrix-js-sdk/pull/1655)

Changes in [9.11.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.11.0) (2021-04-12)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.11.0-rc.1...v9.11.0)

 * No changes since rc.1

Changes in [9.11.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.11.0-rc.1) (2021-04-07)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.10.0...v9.11.0-rc.1)

 * Only try to cache private keys we know exist
   [\#1657](https://github.com/matrix-org/matrix-js-sdk/pull/1657)
 * Properly terminate screen-share calls if NoUserMedia
   [\#1654](https://github.com/matrix-org/matrix-js-sdk/pull/1654)
 * Attended transfer
   [\#1652](https://github.com/matrix-org/matrix-js-sdk/pull/1652)
 * Remove catch handlers in private key retrieval
   [\#1653](https://github.com/matrix-org/matrix-js-sdk/pull/1653)
 * Fixed the media fail error on caller's side
   [\#1651](https://github.com/matrix-org/matrix-js-sdk/pull/1651)
 * Add function to share megolm keys for historical messages, take 2
   [\#1640](https://github.com/matrix-org/matrix-js-sdk/pull/1640)
 * Cache cross-signing private keys if needed on bootstrap
   [\#1649](https://github.com/matrix-org/matrix-js-sdk/pull/1649)

Changes in [9.10.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.10.0) (2021-03-29)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.10.0-rc.1...v9.10.0)

 * No changes since rc.1

Changes in [9.10.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.10.0-rc.1) (2021-03-25)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.9.0...v9.10.0-rc.1)

 * Don't send m.call.hangup if m.call.invite wasn't sent either
   [\#1647](https://github.com/matrix-org/matrix-js-sdk/pull/1647)
 * docs: registerGuest()
   [\#1641](https://github.com/matrix-org/matrix-js-sdk/pull/1641)
 * Download device keys in chunks of 250
   [\#1639](https://github.com/matrix-org/matrix-js-sdk/pull/1639)
 * More VoIP connectivity fixes
   [\#1646](https://github.com/matrix-org/matrix-js-sdk/pull/1646)
 * Make selectDesktopCapturerSource param optional
   [\#1644](https://github.com/matrix-org/matrix-js-sdk/pull/1644)
 * Expose APIs needed for reworked cross-signing login flow
   [\#1632](https://github.com/matrix-org/matrix-js-sdk/pull/1632)

Changes in [9.9.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.9.0) (2021-03-15)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.9.0-rc.1...v9.9.0)

 * No changes since rc.1

Changes in [9.9.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.9.0-rc.1) (2021-03-10)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.8.0...v9.9.0-rc.1)

 * Remove detailed Olm session logging
   [\#1638](https://github.com/matrix-org/matrix-js-sdk/pull/1638)
 * Add space summary suggested only param
   [\#1637](https://github.com/matrix-org/matrix-js-sdk/pull/1637)
 * Check TURN servers periodically, and at start of calls
   [\#1634](https://github.com/matrix-org/matrix-js-sdk/pull/1634)
 * Support sending invite reasons
   [\#1624](https://github.com/matrix-org/matrix-js-sdk/pull/1624)
 * Bump elliptic from 6.5.3 to 6.5.4
   [\#1636](https://github.com/matrix-org/matrix-js-sdk/pull/1636)
 * Add a function to get a room's MXC URI
   [\#1635](https://github.com/matrix-org/matrix-js-sdk/pull/1635)
 * Stop streams if the call has ended
   [\#1633](https://github.com/matrix-org/matrix-js-sdk/pull/1633)
 * Remove export keyword from global.d.ts
   [\#1631](https://github.com/matrix-org/matrix-js-sdk/pull/1631)
 * Fix IndexedDB store creation example
   [\#1445](https://github.com/matrix-org/matrix-js-sdk/pull/1445)
 * An attempt to  cleanup how constraints are handled in calls
   [\#1613](https://github.com/matrix-org/matrix-js-sdk/pull/1613)
 * Extract display name patterns to constants
   [\#1628](https://github.com/matrix-org/matrix-js-sdk/pull/1628)
 * Bump pug-code-gen from 2.0.2 to 2.0.3
   [\#1630](https://github.com/matrix-org/matrix-js-sdk/pull/1630)
 * Avoid deadlocks when ensuring Olm sessions for devices
   [\#1627](https://github.com/matrix-org/matrix-js-sdk/pull/1627)
 * Filter out edits from other senders in history
   [\#1626](https://github.com/matrix-org/matrix-js-sdk/pull/1626)
 * Fix ContentHelpers export
   [\#1618](https://github.com/matrix-org/matrix-js-sdk/pull/1618)
 * Add logging to in progress Olm sessions
   [\#1621](https://github.com/matrix-org/matrix-js-sdk/pull/1621)
 * Don't ignore ICE candidates received before offer/answer
   [\#1623](https://github.com/matrix-org/matrix-js-sdk/pull/1623)
 * Better handling of send failures on VoIP events
   [\#1622](https://github.com/matrix-org/matrix-js-sdk/pull/1622)
 * Log when turn creds expire
   [\#1620](https://github.com/matrix-org/matrix-js-sdk/pull/1620)
 * Initial Spaces [MSC1772] support
   [\#1563](https://github.com/matrix-org/matrix-js-sdk/pull/1563)
 * Add logging to crypto store transactions
   [\#1617](https://github.com/matrix-org/matrix-js-sdk/pull/1617)
 * Room helper for getting type and checking if it is a space room
   [\#1610](https://github.com/matrix-org/matrix-js-sdk/pull/1610)

Changes in [9.8.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.8.0) (2021-03-01)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.8.0-rc.1...v9.8.0)

 * No changes since rc.1

Changes in [9.8.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.8.0-rc.1) (2021-02-24)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.7.0...v9.8.0-rc.1)

 * Optimise prefixed logger
   [\#1615](https://github.com/matrix-org/matrix-js-sdk/pull/1615)
 * Add debug logs to encryption prep, take 3
   [\#1614](https://github.com/matrix-org/matrix-js-sdk/pull/1614)
 * Add functions for upper & lowercase random strings
   [\#1612](https://github.com/matrix-org/matrix-js-sdk/pull/1612)
 * Room helpers for invite permissions and join rules
   [\#1609](https://github.com/matrix-org/matrix-js-sdk/pull/1609)
 * Fixed wording in "Adding video track with id" log
   [\#1606](https://github.com/matrix-org/matrix-js-sdk/pull/1606)
 * Add more debug logs to encryption prep
   [\#1605](https://github.com/matrix-org/matrix-js-sdk/pull/1605)
 * Add option to set ice candidate pool size
   [\#1604](https://github.com/matrix-org/matrix-js-sdk/pull/1604)
 * Cancel call if no source was selected
   [\#1601](https://github.com/matrix-org/matrix-js-sdk/pull/1601)

Changes in [9.7.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.7.0) (2021-02-16)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.7.0-rc.1...v9.7.0)

 * No changes since rc.1

Changes in [9.7.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.7.0-rc.1) (2021-02-10)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.6.0...v9.7.0-rc.1)

 * Handle undefined peerconn
   [\#1600](https://github.com/matrix-org/matrix-js-sdk/pull/1600)
 * ReEmitter: Don't throw if no error handler is attached
   [\#1599](https://github.com/matrix-org/matrix-js-sdk/pull/1599)
 * Convert ReEmitter to TS
   [\#1598](https://github.com/matrix-org/matrix-js-sdk/pull/1598)
 * Fix typo in main readme
   [\#1597](https://github.com/matrix-org/matrix-js-sdk/pull/1597)
 * Remove rogue plus character
   [\#1596](https://github.com/matrix-org/matrix-js-sdk/pull/1596)
 * Fix call ID NaN
   [\#1595](https://github.com/matrix-org/matrix-js-sdk/pull/1595)
 * Fix Electron type merging
   [\#1594](https://github.com/matrix-org/matrix-js-sdk/pull/1594)
 * Fix browser screen share
   [\#1593](https://github.com/matrix-org/matrix-js-sdk/pull/1593)
 * Fix desktop Matrix screen sharing
   [\#1570](https://github.com/matrix-org/matrix-js-sdk/pull/1570)
 * Guard against confused server retry times
   [\#1591](https://github.com/matrix-org/matrix-js-sdk/pull/1591)
 * Decrypt redaction events
   [\#1589](https://github.com/matrix-org/matrix-js-sdk/pull/1589)
 * Fix edge cases with peeking where a room is re-peeked
   [\#1587](https://github.com/matrix-org/matrix-js-sdk/pull/1587)

Changes in [9.6.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.6.0) (2021-02-03)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.6.0-rc.1...v9.6.0)

 * [Release] Fix edge cases with peeking where a room is re-peeked
   [\#1588](https://github.com/matrix-org/matrix-js-sdk/pull/1588)

Changes in [9.6.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.6.0-rc.1) (2021-01-29)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.5.1...v9.6.0-rc.1)

 * Add support for getting call stats
   [\#1584](https://github.com/matrix-org/matrix-js-sdk/pull/1584)
 * Fix compatibility with v0 calls
   [\#1583](https://github.com/matrix-org/matrix-js-sdk/pull/1583)
 * Upgrade deps 2021-01
   [\#1582](https://github.com/matrix-org/matrix-js-sdk/pull/1582)
 * Log the call ID when logging that we've received VoIP events
   [\#1581](https://github.com/matrix-org/matrix-js-sdk/pull/1581)
 * Fix extra negotiate message in Firefox
   [\#1579](https://github.com/matrix-org/matrix-js-sdk/pull/1579)
 * Add debug logs to encryption prep
   [\#1580](https://github.com/matrix-org/matrix-js-sdk/pull/1580)
 * Expose getPresence endpoint
   [\#1578](https://github.com/matrix-org/matrix-js-sdk/pull/1578)
 * Queue keys for backup even if backup isn't enabled yet
   [\#1577](https://github.com/matrix-org/matrix-js-sdk/pull/1577)
 * Stop retrying TURN access when forbidden
   [\#1576](https://github.com/matrix-org/matrix-js-sdk/pull/1576)
 * Add DTMF sending support
   [\#1573](https://github.com/matrix-org/matrix-js-sdk/pull/1573)

Changes in [9.5.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.5.1) (2021-01-26)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.5.0...v9.5.1)

 * [Release] Fix compatibility with v0 calls
   [\#1585](https://github.com/matrix-org/matrix-js-sdk/pull/1585)

Changes in [9.5.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.5.0) (2021-01-18)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.5.0-rc.1...v9.5.0)

 * No changes since rc.1

Changes in [9.5.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.5.0-rc.1) (2021-01-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.4.1...v9.5.0-rc.1)

 * Don't log if no WebRTC
   [\#1574](https://github.com/matrix-org/matrix-js-sdk/pull/1574)
 * Add _unstable_getSharedRooms
   [\#1417](https://github.com/matrix-org/matrix-js-sdk/pull/1417)
 * Bump node-notifier from 8.0.0 to 8.0.1
   [\#1568](https://github.com/matrix-org/matrix-js-sdk/pull/1568)
 * Ignore party ID if opponent is v0
   [\#1567](https://github.com/matrix-org/matrix-js-sdk/pull/1567)
 * Basic call transfer initiation support
   [\#1566](https://github.com/matrix-org/matrix-js-sdk/pull/1566)
 * Room version 6 is now a thing
   [\#1572](https://github.com/matrix-org/matrix-js-sdk/pull/1572)
 * Store keys with same index but better trust level
   [\#1571](https://github.com/matrix-org/matrix-js-sdk/pull/1571)
 * Use TypeScript source for development, swap to build during release
   [\#1561](https://github.com/matrix-org/matrix-js-sdk/pull/1561)
 * Revert "Ignore party ID if opponent is v0"
   [\#1565](https://github.com/matrix-org/matrix-js-sdk/pull/1565)
 * Basic call transfer initiation support
   [\#1558](https://github.com/matrix-org/matrix-js-sdk/pull/1558)
 * Ignore party ID if opponent is v0
   [\#1559](https://github.com/matrix-org/matrix-js-sdk/pull/1559)
 * Honour a call reject event from another of our own devices
   [\#1562](https://github.com/matrix-org/matrix-js-sdk/pull/1562)

Changes in [9.4.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.4.1) (2020-12-21)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.4.0...v9.4.1)

 * Further script tweaks to get all layers building again

Changes in [9.4.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.4.0) (2020-12-21)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.4.0-rc.2...v9.4.0)

 * Revert `postinstall` script change, causes issues for other layers

Changes in [9.4.0-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.4.0-rc.2) (2020-12-16)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.4.0-rc.1...v9.4.0-rc.2)

 * Remove `postinstall` script which also runs as a dependency
   [\#1560](https://github.com/matrix-org/matrix-js-sdk/pull/1560)

Changes in [9.4.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.4.0-rc.1) (2020-12-16)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.3.0...v9.4.0-rc.1)

 * Fixes to support line 1 / 2
   [\#1553](https://github.com/matrix-org/matrix-js-sdk/pull/1553)
 * Add API for listening to remote hold status, advertise VoIP V1
   [\#1549](https://github.com/matrix-org/matrix-js-sdk/pull/1549)
 * A hangup from another client is still valid
   [\#1555](https://github.com/matrix-org/matrix-js-sdk/pull/1555)
 * Remove temporary build step for tests
   [\#1554](https://github.com/matrix-org/matrix-js-sdk/pull/1554)
 * Move browser build steps to prepublish only
   [\#1552](https://github.com/matrix-org/matrix-js-sdk/pull/1552)
 * Extend getSsoLoginUrl for MSC2858
   [\#1541](https://github.com/matrix-org/matrix-js-sdk/pull/1541)

Changes in [9.3.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.3.0) (2020-12-07)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.3.0-rc.1...v9.3.0)

* No changes since rc.1

Changes in [9.3.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.3.0-rc.1) (2020-12-02)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.2.0...v9.3.0-rc.1)

 * Export CallError
   [\#1551](https://github.com/matrix-org/matrix-js-sdk/pull/1551)
 * Upgrade dependencies
   [\#1550](https://github.com/matrix-org/matrix-js-sdk/pull/1550)
 * Don't log error when environment does not support WebRTC
   [\#1547](https://github.com/matrix-org/matrix-js-sdk/pull/1547)
 * Fix dehydration method name
   [\#1544](https://github.com/matrix-org/matrix-js-sdk/pull/1544)

Changes in [9.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.2.0) (2020-11-23)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.2.0-rc.1...v9.2.0)

 * [Release] Fix dehydration method name
   [\#1545](https://github.com/matrix-org/matrix-js-sdk/pull/1545)

Changes in [9.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.2.0-rc.1) (2020-11-18)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.1.0...v9.2.0-rc.1)

 * Implement call holding functionality
   [\#1532](https://github.com/matrix-org/matrix-js-sdk/pull/1532)
 * Support awaitable one-time dehydration
   [\#1537](https://github.com/matrix-org/matrix-js-sdk/pull/1537)
 * Client set profile methods update own user
   [\#1534](https://github.com/matrix-org/matrix-js-sdk/pull/1534)

Changes in [9.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.1.0) (2020-11-09)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.1.0-rc.1...v9.1.0)

* No changes since rc.1

Changes in [9.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.1.0-rc.1) (2020-11-04)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.0.1...v9.1.0-rc.1)

 * Fix spelling error in the server ACL event type
   [\#1535](https://github.com/matrix-org/matrix-js-sdk/pull/1535)
 * await idb operations from crypto store for dehydration
   [\#1533](https://github.com/matrix-org/matrix-js-sdk/pull/1533)
 * Fix stuck never-sending messages
   [\#1531](https://github.com/matrix-org/matrix-js-sdk/pull/1531)
 * Await key cache check to avoid prompts
   [\#1529](https://github.com/matrix-org/matrix-js-sdk/pull/1529)
 * Improve ICE candidate batching
   [\#1524](https://github.com/matrix-org/matrix-js-sdk/pull/1524)
 * Convert logger to typescript
   [\#1527](https://github.com/matrix-org/matrix-js-sdk/pull/1527)
 * Fix logger typo
   [\#1525](https://github.com/matrix-org/matrix-js-sdk/pull/1525)
 * bind online listener to window instead of document
   [\#1523](https://github.com/matrix-org/matrix-js-sdk/pull/1523)
 * Support m.call.select_answer
   [\#1522](https://github.com/matrix-org/matrix-js-sdk/pull/1522)

Changes in [9.0.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.0.1) (2020-10-28)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.0.0...v9.0.1)

 * [Release] Await key cache check to avoid prompts
   [\#1530](https://github.com/matrix-org/matrix-js-sdk/pull/1530)

Changes in [9.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.0.0) (2020-10-26)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v9.0.0-rc.1...v9.0.0)

 * Fix logger typo
   [\#1528](https://github.com/matrix-org/matrix-js-sdk/pull/1528)

Changes in [9.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v9.0.0-rc.1) (2020-10-21)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.5.0...v9.0.0-rc.1)

BREAKING CHANGES
---

 * `hasPendingEvent` now returns false instead of throwing when pending ordering mode is not `detached`

All changes
---

 * Don't cache failures when fetching /versions
   [\#1521](https://github.com/matrix-org/matrix-js-sdk/pull/1521)
 * Install deps first as part of release
   [\#1518](https://github.com/matrix-org/matrix-js-sdk/pull/1518)
 * [Breaking] Change hasPendingEvent to return false if pending ordering
   !detached
   [\#1517](https://github.com/matrix-org/matrix-js-sdk/pull/1517)
 * Skip editor prompts for merges
   [\#1519](https://github.com/matrix-org/matrix-js-sdk/pull/1519)
 * Convert call test to TypeScript
   [\#1516](https://github.com/matrix-org/matrix-js-sdk/pull/1516)
 * Support party_id
   [\#1512](https://github.com/matrix-org/matrix-js-sdk/pull/1512)
 * Support m.call.reject
   [\#1510](https://github.com/matrix-org/matrix-js-sdk/pull/1510)
 * Remove specbuild from .gitignore
   [\#1515](https://github.com/matrix-org/matrix-js-sdk/pull/1515)
 * Log the error when we failed to send candidates
   [\#1514](https://github.com/matrix-org/matrix-js-sdk/pull/1514)
 * Fixes for call state machine
   [\#1503](https://github.com/matrix-org/matrix-js-sdk/pull/1503)
 * Fix call event handler listener removing
   [\#1506](https://github.com/matrix-org/matrix-js-sdk/pull/1506)
 * Set the type of the call based on the tracks
   [\#1501](https://github.com/matrix-org/matrix-js-sdk/pull/1501)
 * Use new local timestamp for calls
   [\#1499](https://github.com/matrix-org/matrix-js-sdk/pull/1499)
 * Adjust types and APIs to match React SDK
   [\#1502](https://github.com/matrix-org/matrix-js-sdk/pull/1502)
 * Make an accurate version of 'age' for events
   [\#1495](https://github.com/matrix-org/matrix-js-sdk/pull/1495)
 * Make 'options' parameter optional
   [\#1498](https://github.com/matrix-org/matrix-js-sdk/pull/1498)
 * Create a giant event type enum
   [\#1497](https://github.com/matrix-org/matrix-js-sdk/pull/1497)
 * Convert call.js to Typescript & update WebRTC APIs (re-apply)
   [\#1494](https://github.com/matrix-org/matrix-js-sdk/pull/1494)

Changes in [8.5.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.5.0) (2020-10-12)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.5.0-rc.1...v8.5.0)

* No changes since rc.1

Changes in [8.5.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.5.0-rc.1) (2020-10-07)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.4.1...v8.5.0-rc.1)

 * Add support for olm fallback keys
   [\#1467](https://github.com/matrix-org/matrix-js-sdk/pull/1467)
 * Fix editing local echoes not updating them in real time
   [\#1492](https://github.com/matrix-org/matrix-js-sdk/pull/1492)
 * Fix re-emit of Event.replaced to be on client and not room
   [\#1491](https://github.com/matrix-org/matrix-js-sdk/pull/1491)
 * Add space to log line
   [\#1496](https://github.com/matrix-org/matrix-js-sdk/pull/1496)
 * Revert "Convert call.js to Typescript & update WebRTC APIs"
   [\#1493](https://github.com/matrix-org/matrix-js-sdk/pull/1493)
 * Convert call.js to Typescript & update WebRTC APIs
   [\#1487](https://github.com/matrix-org/matrix-js-sdk/pull/1487)
 * Dehydrate and rehydrate devices
   [\#1436](https://github.com/matrix-org/matrix-js-sdk/pull/1436)
 * Keep local device after processing device list sync
   [\#1490](https://github.com/matrix-org/matrix-js-sdk/pull/1490)
 * Enforce logger module via lint rules
   [\#1489](https://github.com/matrix-org/matrix-js-sdk/pull/1489)
 * Extend method redactEvent with reason
   [\#1462](https://github.com/matrix-org/matrix-js-sdk/pull/1462)
 * Catch exception from call event handler
   [\#1484](https://github.com/matrix-org/matrix-js-sdk/pull/1484)
 * Ignore invalid candidates
   [\#1483](https://github.com/matrix-org/matrix-js-sdk/pull/1483)
 * Always push docs if they are generated
   [\#1478](https://github.com/matrix-org/matrix-js-sdk/pull/1478)
 * Only sign key backup with cross-signing keys when available
   [\#1481](https://github.com/matrix-org/matrix-js-sdk/pull/1481)
 * Upgrade dependencies
   [\#1479](https://github.com/matrix-org/matrix-js-sdk/pull/1479)

Changes in [8.4.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.4.1) (2020-09-28)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.4.0...v8.4.1)

 * Catch exception from call event handler
   [\#1486](https://github.com/matrix-org/matrix-js-sdk/pull/1486)
 * Ignore invalid candidates
   [\#1485](https://github.com/matrix-org/matrix-js-sdk/pull/1485)

Changes in [8.4.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.4.0) (2020-09-28)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.4.0-rc.1...v8.4.0)

 * Only sign key backup with cross-signing keys when available
   [\#1482](https://github.com/matrix-org/matrix-js-sdk/pull/1482)

Changes in [8.4.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.4.0-rc.1) (2020-09-23)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.3.0...v8.4.0-rc.1)

 * If there are extraParams set, ensure that queryParams is defined
   [\#1477](https://github.com/matrix-org/matrix-js-sdk/pull/1477)
 * Add diagnostics to security bootstrap paths
   [\#1475](https://github.com/matrix-org/matrix-js-sdk/pull/1475)
 * Switch to a combination of better-docs and docdash
   [\#1459](https://github.com/matrix-org/matrix-js-sdk/pull/1459)
 * Undo attempts to cache private keys aggressively
   [\#1474](https://github.com/matrix-org/matrix-js-sdk/pull/1474)
 * Repair secret storage reset, cache keys when missing
   [\#1472](https://github.com/matrix-org/matrix-js-sdk/pull/1472)
 * Prevent parallel getVersions calls
   [\#1471](https://github.com/matrix-org/matrix-js-sdk/pull/1471)
 * Send end-of-candidates
   [\#1473](https://github.com/matrix-org/matrix-js-sdk/pull/1473)
 * Add a function for checking the /versions flag for forced e2ee
   [\#1470](https://github.com/matrix-org/matrix-js-sdk/pull/1470)
 * Add option to allow users of pantialaimon to use the SDK
   [\#1469](https://github.com/matrix-org/matrix-js-sdk/pull/1469)
 * Fixed Yarn broken link
   [\#1468](https://github.com/matrix-org/matrix-js-sdk/pull/1468)
 * some TypeScript and doc fixes
   [\#1466](https://github.com/matrix-org/matrix-js-sdk/pull/1466)
 * Remove Travis CI reference
   [\#1464](https://github.com/matrix-org/matrix-js-sdk/pull/1464)
 * Inject identity server token for 3pid invites on createRoom
   [\#1463](https://github.com/matrix-org/matrix-js-sdk/pull/1463)

Changes in [8.3.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.3.0) (2020-09-14)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.3.0-rc.1...v8.3.0)

* No changes since rc.1

Changes in [8.3.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.3.0-rc.1) (2020-09-09)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.2.0...v8.3.0-rc.1)

 * Add missing options in ICreateClientOpts
   [\#1452](https://github.com/matrix-org/matrix-js-sdk/pull/1452)
 * Ensure ready functions return boolean values
   [\#1457](https://github.com/matrix-org/matrix-js-sdk/pull/1457)
 * Handle missing cross-signing keys gracefully
   [\#1456](https://github.com/matrix-org/matrix-js-sdk/pull/1456)
 * Fix eslint ts override tsx matching
   [\#1451](https://github.com/matrix-org/matrix-js-sdk/pull/1451)
 * Untangle cross-signing and secret storage
   [\#1450](https://github.com/matrix-org/matrix-js-sdk/pull/1450)

Changes in [8.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.2.0) (2020-09-01)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.2.0-rc.1...v8.2.0)

## Security notice

JS SDK 8.2.0 fixes an issue where encrypted state events could break incoming call handling.
Thanks to @awesome-michael from Awesome Technologies for responsibly disclosing this via Matrix's
Security Disclosure Policy.

## All changes

* No changes since rc.1

Changes in [8.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.2.0-rc.1) (2020-08-26)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.1.0...v8.2.0-rc.1)

 * Add state event check
   [\#1449](https://github.com/matrix-org/matrix-js-sdk/pull/1449)
 * Add method to check whether client .well-known has been fetched
   [\#1444](https://github.com/matrix-org/matrix-js-sdk/pull/1444)
 * Handle auth errors during cross-signing key upload
   [\#1443](https://github.com/matrix-org/matrix-js-sdk/pull/1443)
 * Don't fail if the requested audio output isn't available
   [\#1448](https://github.com/matrix-org/matrix-js-sdk/pull/1448)
 * Fix logging failures
   [\#1447](https://github.com/matrix-org/matrix-js-sdk/pull/1447)
 * Log the constraints we pass to getUserMedia
   [\#1446](https://github.com/matrix-org/matrix-js-sdk/pull/1446)
 * Use SAS emoji data from matrix-doc
   [\#1440](https://github.com/matrix-org/matrix-js-sdk/pull/1440)

Changes in [8.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.1.0) (2020-08-17)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.1.0-rc.1...v8.1.0)

* No changes since rc.1

Changes in [8.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.1.0-rc.1) (2020-08-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.0.1...v8.1.0-rc.1)

 * Update on Promises
   [\#1438](https://github.com/matrix-org/matrix-js-sdk/pull/1438)
 * Store and request master cross-signing key
   [\#1437](https://github.com/matrix-org/matrix-js-sdk/pull/1437)
 * Filter out non-string display names
   [\#1433](https://github.com/matrix-org/matrix-js-sdk/pull/1433)
 * Bump elliptic from 6.5.2 to 6.5.3
   [\#1427](https://github.com/matrix-org/matrix-js-sdk/pull/1427)
 * Replace Riot with Element in docs and comments
   [\#1431](https://github.com/matrix-org/matrix-js-sdk/pull/1431)
 * Remove leftover bits of TSLint
   [\#1430](https://github.com/matrix-org/matrix-js-sdk/pull/1430)

Changes in [8.0.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.0.1) (2020-08-05)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.0.1-rc.1...v8.0.1)

 * Filter out non-string display names
   [\#1434](https://github.com/matrix-org/matrix-js-sdk/pull/1434)

Changes in [8.0.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.0.1-rc.1) (2020-07-31)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v8.0.0...v8.0.1-rc.1)

 * Remove redundant lint dependencies
   [\#1426](https://github.com/matrix-org/matrix-js-sdk/pull/1426)
 * Upload all keys when we start using a new key backup version
   [\#1428](https://github.com/matrix-org/matrix-js-sdk/pull/1428)
 * Expose countSessionsNeedingBackup
   [\#1429](https://github.com/matrix-org/matrix-js-sdk/pull/1429)
 * Configure and use new eslint package
   [\#1422](https://github.com/matrix-org/matrix-js-sdk/pull/1422)

Changes in [8.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v8.0.0) (2020-07-27)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v7.1.0...v8.0.0)

BREAKING CHANGES
---

* `RoomState` events changed to use a Map instead of an object, which changes the collection APIs available to access them.
 
All Changes
---

 * Properly support txnId
   [\#1424](https://github.com/matrix-org/matrix-js-sdk/pull/1424)
 * [BREAKING] Remove deprecated getIdenticonUri
   [\#1423](https://github.com/matrix-org/matrix-js-sdk/pull/1423)
 * Bump lodash from 4.17.15 to 4.17.19
   [\#1421](https://github.com/matrix-org/matrix-js-sdk/pull/1421)
 * [BREAKING] Convert RoomState's stored state map to a real map
   [\#1419](https://github.com/matrix-org/matrix-js-sdk/pull/1419)

Changes in [7.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v7.1.0) (2020-07-03)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v7.1.0-rc.1...v7.1.0)

* No changes since rc.1

Changes in [7.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v7.1.0-rc.1) (2020-07-01)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v7.0.0...v7.1.0-rc.1)

 * Ask general crypto callbacks for 4S privkey if operation adapter doesn't
   have it yet
   [\#1414](https://github.com/matrix-org/matrix-js-sdk/pull/1414)
 * Fix ICreateClientOpts missing idBaseUrl
   [\#1413](https://github.com/matrix-org/matrix-js-sdk/pull/1413)
 * Increase max event listeners for rooms
   [\#1411](https://github.com/matrix-org/matrix-js-sdk/pull/1411)
 * Don't trust keys megolm received from backup for verifying the sender
   [\#1406](https://github.com/matrix-org/matrix-js-sdk/pull/1406)
 * Raise the last known account data / state event for an update
   [\#1410](https://github.com/matrix-org/matrix-js-sdk/pull/1410)
 * Isolate encryption bootstrap side-effects
   [\#1380](https://github.com/matrix-org/matrix-js-sdk/pull/1380)
 * Add method to get current in-flight to-device requests
   [\#1405](https://github.com/matrix-org/matrix-js-sdk/pull/1405)

Changes in [7.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v7.0.0) (2020-06-23)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v7.0.0-rc.1...v7.0.0)

* No changes since rc.1

Changes in [7.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v7.0.0-rc.1) (2020-06-17)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.2.2...v7.0.0-rc.1)

BREAKING CHANGES
---

 * Presence lists were removed from the spec in r0.5.0, and the corresponding methods have now been removed here as well:
   * `getPresenceList`
   * `inviteToPresenceList`
   * `dropFromPresenceList`

All changes
---

 * Remove support for unspecced device-specific push rules
   [\#1404](https://github.com/matrix-org/matrix-js-sdk/pull/1404)
 * Use existing session id for fetching flows as to not get a new session
   [\#1403](https://github.com/matrix-org/matrix-js-sdk/pull/1403)
 * Upgrade deps
   [\#1400](https://github.com/matrix-org/matrix-js-sdk/pull/1400)
 * Bring back backup key format migration
   [\#1398](https://github.com/matrix-org/matrix-js-sdk/pull/1398)
 * Fix: more informative error message when we cant find a key to decrypt with
   [\#1313](https://github.com/matrix-org/matrix-js-sdk/pull/1313)
 * Add js-sdk mechanism for polling client well-known for config
   [\#1394](https://github.com/matrix-org/matrix-js-sdk/pull/1394)
 * Fix verification request timeouts to match spec
   [\#1388](https://github.com/matrix-org/matrix-js-sdk/pull/1388)
 * Drop presence list methods
   [\#1391](https://github.com/matrix-org/matrix-js-sdk/pull/1391)
 * Batch up URL previews to prevent excessive requests
   [\#1395](https://github.com/matrix-org/matrix-js-sdk/pull/1395)

Changes in [6.2.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.2.2) (2020-06-16)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.2.1...v6.2.2)

 * Use existing session id for fetching flows as to not get a new session
   [\#1407](https://github.com/matrix-org/matrix-js-sdk/pull/1407)

Changes in [6.2.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.2.1) (2020-06-05)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.2.0...v6.2.1)

 * Bring back backup key format migration
   [\#1399](https://github.com/matrix-org/matrix-js-sdk/pull/1399)

Changes in [6.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.2.0) (2020-06-04)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.2.0-rc.1...v6.2.0)

 * No changes since rc.1

Changes in [6.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.2.0-rc.1) (2020-06-02)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.1.0...v6.2.0-rc.1)

 * Make auth argument in the register request compliant with r0.6.0
   [\#1304](https://github.com/matrix-org/matrix-js-sdk/pull/1304)
 * Send the wrong auth params with the right auth params
   [\#1393](https://github.com/matrix-org/matrix-js-sdk/pull/1393)
 * encrypt cached keys with pickle key
   [\#1387](https://github.com/matrix-org/matrix-js-sdk/pull/1387)
 * Fix replying to key share requests
   [\#1385](https://github.com/matrix-org/matrix-js-sdk/pull/1385)
 * Add dist to package.json files so CDNs can serve it
   [\#1384](https://github.com/matrix-org/matrix-js-sdk/pull/1384)
 * Fix getVersion warning saying undefined room
   [\#1382](https://github.com/matrix-org/matrix-js-sdk/pull/1382)
 * Combine the two places we processed client-level default push rules
   [\#1379](https://github.com/matrix-org/matrix-js-sdk/pull/1379)
 * make MAC check robust against unpadded vs padded base64 differences
   [\#1378](https://github.com/matrix-org/matrix-js-sdk/pull/1378)
 * Remove key backup format migration
   [\#1375](https://github.com/matrix-org/matrix-js-sdk/pull/1375)
 * Add simple browserify browser-matrix.js tests
   [\#1241](https://github.com/matrix-org/matrix-js-sdk/pull/1241)
 * support new key agreement method for SAS
   [\#1376](https://github.com/matrix-org/matrix-js-sdk/pull/1376)

Changes in [6.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.1.0) (2020-05-19)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.1.0-rc.1...v6.1.0)

 * No changes since rc.1

Changes in [6.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.1.0-rc.1) (2020-05-14)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.0.0...v6.1.0-rc.1)

 * Remove support for asymmetric 4S encryption
   [\#1373](https://github.com/matrix-org/matrix-js-sdk/pull/1373)
 * Increase timeout for 2nd phase of Olm session creation
   [\#1367](https://github.com/matrix-org/matrix-js-sdk/pull/1367)
 * Add logging on decryption retries
   [\#1366](https://github.com/matrix-org/matrix-js-sdk/pull/1366)
 * Emit event when a trusted self-key is stored
   [\#1364](https://github.com/matrix-org/matrix-js-sdk/pull/1364)
 * Customize error payload for oversized messages
   [\#1352](https://github.com/matrix-org/matrix-js-sdk/pull/1352)
 * Return null for key backup state when we haven't checked yet
   [\#1363](https://github.com/matrix-org/matrix-js-sdk/pull/1363)
 * Added a progressCallback for backup key loading
   [\#1351](https://github.com/matrix-org/matrix-js-sdk/pull/1351)
 * Add initialFetch param to willUpdateDevices / devicesUpdated
   [\#1360](https://github.com/matrix-org/matrix-js-sdk/pull/1360)
 * Fix race between sending .request and receiving .ready over to_device
   [\#1359](https://github.com/matrix-org/matrix-js-sdk/pull/1359)
 * Handle race between sending and await next event from other party
   [\#1357](https://github.com/matrix-org/matrix-js-sdk/pull/1357)
 * Add crypto.willUpdateDevices event and make
   getStoredDevices/getStoredDevicesForUser synchronous
   [\#1354](https://github.com/matrix-org/matrix-js-sdk/pull/1354)
 * Fix sender of local echo events in unsigned redactions
   [\#1350](https://github.com/matrix-org/matrix-js-sdk/pull/1350)
 * Remove redundant key backup setup path
   [\#1353](https://github.com/matrix-org/matrix-js-sdk/pull/1353)
 * Remove some dead code from _retryDecryption
   [\#1349](https://github.com/matrix-org/matrix-js-sdk/pull/1349)
 * Don't send key requests until after sync processing is finished
   [\#1348](https://github.com/matrix-org/matrix-js-sdk/pull/1348)
 * Prevent attempts to send olm messages to ourselves
   [\#1346](https://github.com/matrix-org/matrix-js-sdk/pull/1346)
 * Retry account data upload requests
   [\#1345](https://github.com/matrix-org/matrix-js-sdk/pull/1345)
 * Log first known index with megolm session updates
   [\#1344](https://github.com/matrix-org/matrix-js-sdk/pull/1344)
 * Prune to_device messages to avoid sending empty messages
   [\#1343](https://github.com/matrix-org/matrix-js-sdk/pull/1343)
 * Convert bunch of things to TypeScript
   [\#1335](https://github.com/matrix-org/matrix-js-sdk/pull/1335)
 * Add logging when making new Olm sessions
   [\#1342](https://github.com/matrix-org/matrix-js-sdk/pull/1342)
 * Fix: handle filter not found
   [\#1340](https://github.com/matrix-org/matrix-js-sdk/pull/1340)
 * Make getAccountDataFromServer return null if not found
   [\#1338](https://github.com/matrix-org/matrix-js-sdk/pull/1338)
 * Fix setDefaultKeyId to fail if the request fails
   [\#1336](https://github.com/matrix-org/matrix-js-sdk/pull/1336)
 * Document setRoomEncryption not modifying room state
   [\#1328](https://github.com/matrix-org/matrix-js-sdk/pull/1328)
 * Fix: don't do extra /filter request when enabling lazy loading of members
   [\#1332](https://github.com/matrix-org/matrix-js-sdk/pull/1332)
 * Reject attemptAuth promise if no auth flow found
   [\#1329](https://github.com/matrix-org/matrix-js-sdk/pull/1329)
 * Fix FilterComponent allowed_values check
   [\#1327](https://github.com/matrix-org/matrix-js-sdk/pull/1327)
 * Serialise Olm prekey decryptions
   [\#1326](https://github.com/matrix-org/matrix-js-sdk/pull/1326)
 * Fix: crash when backup key needs fixing from corruption issue
   [\#1324](https://github.com/matrix-org/matrix-js-sdk/pull/1324)
 * Fix cross-signing/SSSS reset
   [\#1322](https://github.com/matrix-org/matrix-js-sdk/pull/1322)
 * Implement QR code reciprocate for self-verification with untrusted MSK
   [\#1320](https://github.com/matrix-org/matrix-js-sdk/pull/1320)

Changes in [6.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.0.0) (2020-05-05)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.0.0-rc.2...v6.0.0)

 * Add progress callback for key backups
   [\#1368](https://github.com/matrix-org/matrix-js-sdk/pull/1368)

Changes in [6.0.0-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.0.0-rc.2) (2020-05-01)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v6.0.0-rc.1...v6.0.0-rc.2)

 * Emit event when a trusted self-key is stored
   [\#1365](https://github.com/matrix-org/matrix-js-sdk/pull/1365)

Changes in [6.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v6.0.0-rc.1) (2020-04-30)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.3.1-rc.4...v6.0.0-rc.1)

BREAKING CHANGES
---

 * client.getStoredDevicesForUser and client.getStoredDevices are no longer async

All Changes
---

 * Add initialFetch param to willUpdateDevices / devicesUpdated
   [\#1362](https://github.com/matrix-org/matrix-js-sdk/pull/1362)
 * Fix race between sending .request and receiving .ready over to_device
   [\#1361](https://github.com/matrix-org/matrix-js-sdk/pull/1361)
 * Handle race between sending and await next event from other party
   [\#1358](https://github.com/matrix-org/matrix-js-sdk/pull/1358)
 * Add crypto.willUpdateDevices event and make
   getStoredDevices/getStoredDevicesForUser synchronous
   [\#1356](https://github.com/matrix-org/matrix-js-sdk/pull/1356)
 * Remove redundant key backup setup path
   [\#1355](https://github.com/matrix-org/matrix-js-sdk/pull/1355)

Changes in [5.3.1-rc.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.3.1-rc.4) (2020-04-23)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.3.1-rc.3...v5.3.1-rc.4)

 * Retry account data upload requests
   [\#1347](https://github.com/matrix-org/matrix-js-sdk/pull/1347)
 * Fix: handle filter not found
   [\#1341](https://github.com/matrix-org/matrix-js-sdk/pull/1341)
 * Make getAccountDataFromServer return null if not found
   [\#1339](https://github.com/matrix-org/matrix-js-sdk/pull/1339)
 * Fix setDefaultKeyId to fail if the request fails
   [\#1337](https://github.com/matrix-org/matrix-js-sdk/pull/1337)
 * Fix: don't do extra /filter request when enabling lazy loading of members
   [\#1333](https://github.com/matrix-org/matrix-js-sdk/pull/1333)
 * Reject attemptAuth promise if no auth flow found
   [\#1331](https://github.com/matrix-org/matrix-js-sdk/pull/1331)
 * Serialise Olm prekey decryptions
   [\#1330](https://github.com/matrix-org/matrix-js-sdk/pull/1330)

Changes in [5.3.1-rc.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.3.1-rc.3) (2020-04-17)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.3.1-rc.2...v5.3.1-rc.3)

 * Fix cross-signing/SSSS reset
   [\#1323](https://github.com/matrix-org/matrix-js-sdk/pull/1323)
 * Fix: crash when backup key needs fixing from corruption issue
   [\#1325](https://github.com/matrix-org/matrix-js-sdk/pull/1325)

Changes in [5.3.1-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.3.1-rc.2) (2020-04-16)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.3.1-rc.1...v5.3.1-rc.2)

 * Implement QR code reciprocate for self-verification with untrusted MSK
   [\#1321](https://github.com/matrix-org/matrix-js-sdk/pull/1321)

Changes in [5.3.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.3.1-rc.1) (2020-04-15)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.3.0-rc.1...v5.3.1-rc.1)

 * Adapt release script for riot-desktop
   [\#1319](https://github.com/matrix-org/matrix-js-sdk/pull/1319)
 * Fix: prevent spurious notifications from indexer
   [\#1318](https://github.com/matrix-org/matrix-js-sdk/pull/1318)
 * Always create our own user object
   [\#1317](https://github.com/matrix-org/matrix-js-sdk/pull/1317)
 * Fix incorrect backup key format in SSSS
   [\#1311](https://github.com/matrix-org/matrix-js-sdk/pull/1311)
 * Fix e2ee crash after refreshing after having received a cross-singing key
   reset
   [\#1315](https://github.com/matrix-org/matrix-js-sdk/pull/1315)
 * Fix: catch send errors in SAS verifier
   [\#1314](https://github.com/matrix-org/matrix-js-sdk/pull/1314)
 * Clear cross-signing keys when detecting the keys have changed
   [\#1312](https://github.com/matrix-org/matrix-js-sdk/pull/1312)
 * Upgrade deps
   [\#1310](https://github.com/matrix-org/matrix-js-sdk/pull/1310)

Changes in [5.3.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.3.0-rc.1) (2020-04-08)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.2.0...v5.3.0-rc.1)

 * Store key backup key in cache as Uint8Array
   [\#1308](https://github.com/matrix-org/matrix-js-sdk/pull/1308)
 * Use the correct request body for the /keys/query endpoint.
   [\#1307](https://github.com/matrix-org/matrix-js-sdk/pull/1307)
 * Avoid creating two devices on registration
   [\#1305](https://github.com/matrix-org/matrix-js-sdk/pull/1305)
 * Lower max-warnings to 81
   [\#1306](https://github.com/matrix-org/matrix-js-sdk/pull/1306)
 * Move key backup key creation before caching
   [\#1303](https://github.com/matrix-org/matrix-js-sdk/pull/1303)
 * Expose function to force-reset outgoing room key requests
   [\#1298](https://github.com/matrix-org/matrix-js-sdk/pull/1298)
 * Add isSelfVerification property to VerificationRequest
   [\#1302](https://github.com/matrix-org/matrix-js-sdk/pull/1302)
 * QR code reciprocation
   [\#1297](https://github.com/matrix-org/matrix-js-sdk/pull/1297)
 * Add ability to check symmetric SSSS key before we try to use it
   [\#1294](https://github.com/matrix-org/matrix-js-sdk/pull/1294)
 * Add some debug logging for events stuck to bottom of timeline
   [\#1296](https://github.com/matrix-org/matrix-js-sdk/pull/1296)
 * Fix: spontanous verification request cancellation under some circumstances
   [\#1295](https://github.com/matrix-org/matrix-js-sdk/pull/1295)
 * Receive private key for caching from the app layer
   [\#1293](https://github.com/matrix-org/matrix-js-sdk/pull/1293)
 * Track whether we have verified a user before
   [\#1292](https://github.com/matrix-org/matrix-js-sdk/pull/1292)
 * Fix: error during tests
   [\#1222](https://github.com/matrix-org/matrix-js-sdk/pull/1222)
 * Send .done event for to_device verification
   [\#1288](https://github.com/matrix-org/matrix-js-sdk/pull/1288)
 * Request the key backup key & restore backup
   [\#1291](https://github.com/matrix-org/matrix-js-sdk/pull/1291)
 * Make screen sharing works on Chrome using getDisplayMedia()
   [\#1276](https://github.com/matrix-org/matrix-js-sdk/pull/1276)
 * Fix isVerified returning false
   [\#1289](https://github.com/matrix-org/matrix-js-sdk/pull/1289)
 * Fix: verification gets cancelled when event gets duplicated
   [\#1286](https://github.com/matrix-org/matrix-js-sdk/pull/1286)
 * Use requestSecret on the client to request secrets
   [\#1287](https://github.com/matrix-org/matrix-js-sdk/pull/1287)
 * Allow guests to fetch TURN servers
   [\#1277](https://github.com/matrix-org/matrix-js-sdk/pull/1277)

Changes in [5.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.2.0) (2020-03-30)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.2.0-rc.1...v5.2.0)

 * Fix isVerified returning false
   [\#1290](https://github.com/matrix-org/matrix-js-sdk/pull/1290)

Changes in [5.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.2.0-rc.1) (2020-03-26)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.1.1...v5.2.0-rc.1)

 * Add a flag for whether cross signing signatures are trusted
   [\#1285](https://github.com/matrix-org/matrix-js-sdk/pull/1285)
 * Cache user and self signing keys during bootstrap
   [\#1282](https://github.com/matrix-org/matrix-js-sdk/pull/1282)
 * remove unnecessary promise
   [\#1283](https://github.com/matrix-org/matrix-js-sdk/pull/1283)
 * Functions to cache session backups key automatically
   [\#1281](https://github.com/matrix-org/matrix-js-sdk/pull/1281)
 * Add function for checking cross-signing is ready
   [\#1279](https://github.com/matrix-org/matrix-js-sdk/pull/1279)
 * Use symmetric encryption for SSSS
   [\#1228](https://github.com/matrix-org/matrix-js-sdk/pull/1228)
 * Migrate SSSS to use symmetric algorithm
   [\#1238](https://github.com/matrix-org/matrix-js-sdk/pull/1238)
 * Migration to symmetric SSSS
   [\#1272](https://github.com/matrix-org/matrix-js-sdk/pull/1272)
 * Reduce number of one-time-key requests
   [\#1280](https://github.com/matrix-org/matrix-js-sdk/pull/1280)
 * Fix: assume the requested method is supported by other party with to_device
   [\#1275](https://github.com/matrix-org/matrix-js-sdk/pull/1275)
 * Use checkDeviceTrust when computing untrusted devices
   [\#1278](https://github.com/matrix-org/matrix-js-sdk/pull/1278)
 * Add a store for backup keys
   [\#1271](https://github.com/matrix-org/matrix-js-sdk/pull/1271)
 * Upload only new device signature of master key
   [\#1268](https://github.com/matrix-org/matrix-js-sdk/pull/1268)
 * Expose prepareToEncrypt in the client API
   [\#1270](https://github.com/matrix-org/matrix-js-sdk/pull/1270)
 * Don't kill the whole device download if one device gives an error
   [\#1269](https://github.com/matrix-org/matrix-js-sdk/pull/1269)
 * Handle racing .start event during self verification
   [\#1267](https://github.com/matrix-org/matrix-js-sdk/pull/1267)
 * A crypto.keySignatureUploadFailure event reported the wrong source
   [\#1266](https://github.com/matrix-org/matrix-js-sdk/pull/1266)
 * Fix editing of unsent messages by waiting for actual event id
   [\#1263](https://github.com/matrix-org/matrix-js-sdk/pull/1263)
 * Fix: ensureOlmSessionsForDevices parameter format
   [\#1264](https://github.com/matrix-org/matrix-js-sdk/pull/1264)
 * Remove stuff that yarn install doesn't think we need
   [\#1261](https://github.com/matrix-org/matrix-js-sdk/pull/1261)
 * Fix: prevent error being thrown during sync in some cases
   [\#1258](https://github.com/matrix-org/matrix-js-sdk/pull/1258)
 * Force `is_verified` for key backups to bool and fix computation
   [\#1259](https://github.com/matrix-org/matrix-js-sdk/pull/1259)
 * Add a method for legacy single device verification, returning a verification
   request
   [\#1257](https://github.com/matrix-org/matrix-js-sdk/pull/1257)
 * yarn upgrade
   [\#1256](https://github.com/matrix-org/matrix-js-sdk/pull/1256)

Changes in [5.1.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.1.1) (2020-03-17)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.1.1-rc.1...v5.1.1)

 * Fix: ensureOlmSessionsForDevices parameter format
   [\#1265](https://github.com/matrix-org/matrix-js-sdk/pull/1265)
 * Fix: prevent error being thrown during sync in some cases
   [\#1262](https://github.com/matrix-org/matrix-js-sdk/pull/1262)
 * Force `is_verified` for key backups to bool and fix computation
   [\#1260](https://github.com/matrix-org/matrix-js-sdk/pull/1260)

Changes in [5.1.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.1.1-rc.1) (2020-03-11)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.1.0...v5.1.1-rc.1)

 * refactor megolm encryption to improve perceived speed
   [\#1252](https://github.com/matrix-org/matrix-js-sdk/pull/1252)
 * Remove v1 identity server fallbacks
   [\#1253](https://github.com/matrix-org/matrix-js-sdk/pull/1253)
 * Use alt_aliases instead of local ones for room names
   [\#1251](https://github.com/matrix-org/matrix-js-sdk/pull/1251)
 * Upload cross-signing key signatures in the background
   [\#1250](https://github.com/matrix-org/matrix-js-sdk/pull/1250)
 * Fix secret sharing names to match spec
   [\#1249](https://github.com/matrix-org/matrix-js-sdk/pull/1249)
 * Cleanup: remove crypto.verification.start event
   [\#1248](https://github.com/matrix-org/matrix-js-sdk/pull/1248)
 * Fix regression in key backup request params
   [\#1246](https://github.com/matrix-org/matrix-js-sdk/pull/1246)
 * Use cross-signing trust to mark backups verified
   [\#1244](https://github.com/matrix-org/matrix-js-sdk/pull/1244)
 * Check both cross-signing and local trust for key sharing
   [\#1243](https://github.com/matrix-org/matrix-js-sdk/pull/1243)
 * Fixed up tests to match new way that crypto stores are created
   [\#1242](https://github.com/matrix-org/matrix-js-sdk/pull/1242)
 * Store USK and SSK locally
   [\#1235](https://github.com/matrix-org/matrix-js-sdk/pull/1235)
 * Use unpadded base64 for QR code secrets
   [\#1236](https://github.com/matrix-org/matrix-js-sdk/pull/1236)
 * Don't require .done event for finishing self-verification
   [\#1239](https://github.com/matrix-org/matrix-js-sdk/pull/1239)
 * Don't cancel as 3rd party in verification request
   [\#1237](https://github.com/matrix-org/matrix-js-sdk/pull/1237)
 * Verification: log when switching start event
   [\#1234](https://github.com/matrix-org/matrix-js-sdk/pull/1234)
 * Perform crypto store operations directly after transaction
   [\#1233](https://github.com/matrix-org/matrix-js-sdk/pull/1233)
 * More verification request logging
   [\#1232](https://github.com/matrix-org/matrix-js-sdk/pull/1232)
 * Upgrade deps
   [\#1231](https://github.com/matrix-org/matrix-js-sdk/pull/1231)

Changes in [5.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.1.0) (2020-03-02)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.1.0-rc.1...v5.1.0)

 * No changes since rc.1

Changes in [5.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.1.0-rc.1) (2020-02-26)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.0.1...v5.1.0-rc.1)

 * Add latest dist-tag for releases
   [\#1230](https://github.com/matrix-org/matrix-js-sdk/pull/1230)
 * Add room method for alt_aliases
   [\#1225](https://github.com/matrix-org/matrix-js-sdk/pull/1225)
 * Remove buildkite pipeline
   [\#1227](https://github.com/matrix-org/matrix-js-sdk/pull/1227)
 * don't assume verify has been called when receiving a cancellation in
   verifier
   [\#1226](https://github.com/matrix-org/matrix-js-sdk/pull/1226)
 * Reduce secret size for new binary packing
   [\#1221](https://github.com/matrix-org/matrix-js-sdk/pull/1221)
 * misc rageshake fixes
   [\#1223](https://github.com/matrix-org/matrix-js-sdk/pull/1223)
 * Fix cancelled historical requests not appearing as cancelled
   [\#1220](https://github.com/matrix-org/matrix-js-sdk/pull/1220)
 * Fix renaming error that broke QR code verification
   [\#1217](https://github.com/matrix-org/matrix-js-sdk/pull/1217)

Changes in [5.0.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.0.1) (2020-02-19)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.0.0...v5.0.1)

 * add method for new /aliases endpoint
   [\#1219](https://github.com/matrix-org/matrix-js-sdk/pull/1219)
 * method for checking if other party supports verification method
   [\#1213](https://github.com/matrix-org/matrix-js-sdk/pull/1213)
 * add local echo state for accepting or declining a verif req
   [\#1210](https://github.com/matrix-org/matrix-js-sdk/pull/1210)
 * make logging compatible with rageshakes
   [\#1214](https://github.com/matrix-org/matrix-js-sdk/pull/1214)
 * Find existing requests when starting a new verification request
   [\#1209](https://github.com/matrix-org/matrix-js-sdk/pull/1209)
 * log MAC calculation during SAS
   [\#1211](https://github.com/matrix-org/matrix-js-sdk/pull/1211)

Changes in [5.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.0.0) (2020-02-17)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v5.0.0-rc.1...v5.0.0)

 * No changes since rc.1

Changes in [5.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v5.0.0-rc.1) (2020-02-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v4.0.0...v5.0.0-rc.1)

BREAKING CHANGES
---

 * The verification methods API has removed an argument ([\#1206](https://github.com/matrix-org/matrix-js-sdk/pull/1206))

All Changes
---

 * Remove methods argument to verification
   [\#1206](https://github.com/matrix-org/matrix-js-sdk/pull/1206)
 * don't do a dynamic import of request
   [\#1207](https://github.com/matrix-org/matrix-js-sdk/pull/1207)
 * QR self-verification fixes
   [\#1201](https://github.com/matrix-org/matrix-js-sdk/pull/1201)
 * Log every verification event
   [\#1204](https://github.com/matrix-org/matrix-js-sdk/pull/1204)
 * dont require .done event from other party
   [\#1203](https://github.com/matrix-org/matrix-js-sdk/pull/1203)
 * New option to fully reset Secret Storage keys in boostrapSecretStorage
   [\#1202](https://github.com/matrix-org/matrix-js-sdk/pull/1202)
 * Add function to estimate target device for a VerificationRequest
   [\#1190](https://github.com/matrix-org/matrix-js-sdk/pull/1190)
 * pass ssss item name to callback so we can differentiate UI on it
   [\#1200](https://github.com/matrix-org/matrix-js-sdk/pull/1200)
 * add export/import of Olm devices
   [\#1167](https://github.com/matrix-org/matrix-js-sdk/pull/1167)
 * Convert utils.js -> utils.ts
   [\#1199](https://github.com/matrix-org/matrix-js-sdk/pull/1199)
 * Don't sign ourselves as a user
   [\#1197](https://github.com/matrix-org/matrix-js-sdk/pull/1197)
 * Add a bunch of logging to verification
   [\#1196](https://github.com/matrix-org/matrix-js-sdk/pull/1196)
 * Fix: always return a valid string from InRoomChannel.getEventType
   [\#1198](https://github.com/matrix-org/matrix-js-sdk/pull/1198)
 * add logging when a request is being cancelled
   [\#1195](https://github.com/matrix-org/matrix-js-sdk/pull/1195)
 * Don't explode verification validation if we don't have an event type
   [\#1194](https://github.com/matrix-org/matrix-js-sdk/pull/1194)
 * Fix: verification request appearing for users that are not the receiver or
   sender if they are in room
   [\#1193](https://github.com/matrix-org/matrix-js-sdk/pull/1193)
 * Fix getting secrets encoded with passthrough keys
   [\#1192](https://github.com/matrix-org/matrix-js-sdk/pull/1192)
 * Update QR code handling for new spec
   [\#1175](https://github.com/matrix-org/matrix-js-sdk/pull/1175)
 * Don't add ephemeral events to timeline when peeking
   [\#1188](https://github.com/matrix-org/matrix-js-sdk/pull/1188)
 * Fix typo
   [\#1189](https://github.com/matrix-org/matrix-js-sdk/pull/1189)
 * Verification: resolve race between .start events from both parties
   [\#1187](https://github.com/matrix-org/matrix-js-sdk/pull/1187)
 * Add option to bootstrap to start new key backup
   [\#1184](https://github.com/matrix-org/matrix-js-sdk/pull/1184)
 * Add a bunch of null guards to feature checks
   [\#1182](https://github.com/matrix-org/matrix-js-sdk/pull/1182)
 * docs: fix MatrixClient reference
   [\#1183](https://github.com/matrix-org/matrix-js-sdk/pull/1183)
 * Add helper to obtain the cancellation code for a verification request
   [\#1180](https://github.com/matrix-org/matrix-js-sdk/pull/1180)
 * Publish pre-releases as a separate tag on npm
   [\#1178](https://github.com/matrix-org/matrix-js-sdk/pull/1178)
 * Fix support for passthrough keys
   [\#1177](https://github.com/matrix-org/matrix-js-sdk/pull/1177)
 * Trust our own cross-signing keys if we verify them with another device
   [\#1174](https://github.com/matrix-org/matrix-js-sdk/pull/1174)
 * Ensure cross-signing keys are downloaded when checking trust
   [\#1176](https://github.com/matrix-org/matrix-js-sdk/pull/1176)
 * Don't log verification validation errors for normal messages
   [\#1172](https://github.com/matrix-org/matrix-js-sdk/pull/1172)
 * Fix bootstrap cleanup
   [\#1173](https://github.com/matrix-org/matrix-js-sdk/pull/1173)
 * QR code verification
   [\#1155](https://github.com/matrix-org/matrix-js-sdk/pull/1155)
 * expose deviceId prop on device channel
   [\#1171](https://github.com/matrix-org/matrix-js-sdk/pull/1171)
 * Move & upgrade babel runtime into dependencies (like it wants)
   [\#1169](https://github.com/matrix-org/matrix-js-sdk/pull/1169)
 * Add unit tests for verifying your own device, remove .event property on
   verification request
   [\#1166](https://github.com/matrix-org/matrix-js-sdk/pull/1166)
 * For dm-verification, also consider events sent by other devices of same user
   as "our" events
   [\#1163](https://github.com/matrix-org/matrix-js-sdk/pull/1163)
 * Add a prepare script
   [\#1161](https://github.com/matrix-org/matrix-js-sdk/pull/1161)
 * Remove :deviceId from /keys/upload/:deviceId as not spec-compliant
   [\#1162](https://github.com/matrix-org/matrix-js-sdk/pull/1162)
 * Refactor and expose some logic publicly for the TimelineWindow class.
   [\#1159](https://github.com/matrix-org/matrix-js-sdk/pull/1159)
 * Allow a device key upload request without auth
   [\#1158](https://github.com/matrix-org/matrix-js-sdk/pull/1158)
 * Support for .ready verification event (MSC2366) & other things
   [\#1140](https://github.com/matrix-org/matrix-js-sdk/pull/1140)

Changes in [4.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v4.0.0) (2020-01-27)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v4.0.0-rc.1...v4.0.0)

 * Move & upgrade babel runtime into dependencies (like it wants)
   [\#1170](https://github.com/matrix-org/matrix-js-sdk/pull/1170)
 * Add a prepare script
   [\#1164](https://github.com/matrix-org/matrix-js-sdk/pull/1164)

Changes in [4.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v4.0.0-rc.1) (2020-01-20)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v3.0.0...v4.0.0-rc.1)

BREAKING CHANGES
================
 * The js-sdk node module now exports ES6 rather than ES5. If you
   wish to supports target that aren't compatible with ES6, you
   will need to transpile the js-sdk to a suitable dialect.

All Changes
===========
 * Convert secret storage to new account data API
   [\#1154](https://github.com/matrix-org/matrix-js-sdk/pull/1154)
 * Add v5 as a safe room version
   [\#1157](https://github.com/matrix-org/matrix-js-sdk/pull/1157)
 * Add API to get account data from server
   [\#1153](https://github.com/matrix-org/matrix-js-sdk/pull/1153)
 * Fix sourcemaps by refactoring the build system
   [\#1151](https://github.com/matrix-org/matrix-js-sdk/pull/1151)
 * record, report, and notify about olm errors
   [\#1146](https://github.com/matrix-org/matrix-js-sdk/pull/1146)
 * Send device messages for the same user in same API call.
   [\#1148](https://github.com/matrix-org/matrix-js-sdk/pull/1148)
 * Add an option to ignore unverified devices
   [\#1150](https://github.com/matrix-org/matrix-js-sdk/pull/1150)
 * Sign key backup with cross-signing key on upgrade
   [\#1144](https://github.com/matrix-org/matrix-js-sdk/pull/1144)
 * Emoji verification: Change name of 🔒 to lock
   [\#1145](https://github.com/matrix-org/matrix-js-sdk/pull/1145)
 * use a separate object for each encrypted content
   [\#1147](https://github.com/matrix-org/matrix-js-sdk/pull/1147)
 * Sourcemaps: develop -> feature branch
   [\#1143](https://github.com/matrix-org/matrix-js-sdk/pull/1143)
 * Use a safer import/export scheme for the ContentRepo utilities
   [\#1134](https://github.com/matrix-org/matrix-js-sdk/pull/1134)
 * Fix error handling in decryptGroupMessage
   [\#1142](https://github.com/matrix-org/matrix-js-sdk/pull/1142)
 * Add additional properties to package.json for riot-web's webpack
   [\#1131](https://github.com/matrix-org/matrix-js-sdk/pull/1131)
 * Fix import for indexeddb crypto store
   [\#1133](https://github.com/matrix-org/matrix-js-sdk/pull/1133)
 * Use the right request when creating clients
   [\#1132](https://github.com/matrix-org/matrix-js-sdk/pull/1132)
 * Target NodeJS 10, minified browser bundle, and other publishing/package
   things
   [\#1127](https://github.com/matrix-org/matrix-js-sdk/pull/1127)
 * Re-focus sourcemap generation
   [\#1126](https://github.com/matrix-org/matrix-js-sdk/pull/1126)
 * Remove ancient polyfill for prototype inheritance
   [\#1125](https://github.com/matrix-org/matrix-js-sdk/pull/1125)
 * Remove "source-map-support" from tests because it makes sourcemaps worse
   [\#1124](https://github.com/matrix-org/matrix-js-sdk/pull/1124)
 * Remove ancient "use strict" annotations
   [\#1123](https://github.com/matrix-org/matrix-js-sdk/pull/1123)
 * Use ES6 imports/exports instead of older CommonJS ones
   [\#1122](https://github.com/matrix-org/matrix-js-sdk/pull/1122)
 * [BREAKING] Refactor the entire build process
   [\#1113](https://github.com/matrix-org/matrix-js-sdk/pull/1113)

Changes in [3.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v3.0.0) (2020-01-13)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v3.0.0-rc.1...v3.0.0)

 * No changes from rc.1

Changes in [3.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v3.0.0-rc.1) (2020-01-06)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.6...v3.0.0-rc.1)

BREAKING CHANGES
================
 * matrix-js-sdk no longer uses bluebird promises, so promises returned
   by the js-sdk no longer support the done() method. Code that calls
   done() on promises returned by the js-sdk will break and will need
   to be updated to remove the done() call.

All Changes
===========
 * Make displayName disambiguation more fuzzy especially against RTL/LTR
   content
   [\#1141](https://github.com/matrix-org/matrix-js-sdk/pull/1141)
 * stop trying to resend event if we get M_TOO_LARGE
   [\#1129](https://github.com/matrix-org/matrix-js-sdk/pull/1129)
 * Fix creating a key backup with cross signing diabled
   [\#1139](https://github.com/matrix-org/matrix-js-sdk/pull/1139)
 * Use checkDeviceTrust with key backup
   [\#1138](https://github.com/matrix-org/matrix-js-sdk/pull/1138)
 * Add support for passthrough SSSS secrets
   [\#1128](https://github.com/matrix-org/matrix-js-sdk/pull/1128)
 * Add support for key backups using secret storage
   [\#1118](https://github.com/matrix-org/matrix-js-sdk/pull/1118)
 * Remove unused user verification event
   [\#1117](https://github.com/matrix-org/matrix-js-sdk/pull/1117)
 * Fix check for private keys
   [\#1116](https://github.com/matrix-org/matrix-js-sdk/pull/1116)
 * Restore watching mode for `start:watch`
   [\#1115](https://github.com/matrix-org/matrix-js-sdk/pull/1115)
 * Add secret storage bootstrap flow
   [\#1079](https://github.com/matrix-org/matrix-js-sdk/pull/1079)
 * Part 1 of many: Upgrade to babel@7 and TypeScript
   [\#1112](https://github.com/matrix-org/matrix-js-sdk/pull/1112)
 * Remove Bluebird: phase 2.5
   [\#1100](https://github.com/matrix-org/matrix-js-sdk/pull/1100)
 * Remove Bluebird: phase 3
   [\#1088](https://github.com/matrix-org/matrix-js-sdk/pull/1088)
 * ignore m.key.verification.done messages when we don't expect any more
   messages
   [\#1104](https://github.com/matrix-org/matrix-js-sdk/pull/1104)
 * dont cancel on remote echo of own .request event
   [\#1111](https://github.com/matrix-org/matrix-js-sdk/pull/1111)
 * Refactor verification request code
   [\#1109](https://github.com/matrix-org/matrix-js-sdk/pull/1109)
 * Fix device list's cross-signing storage path
   [\#1105](https://github.com/matrix-org/matrix-js-sdk/pull/1105)
 * yarn upgrade
   [\#1103](https://github.com/matrix-org/matrix-js-sdk/pull/1103)

Changes in [2.4.6](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.6) (2019-12-09)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.6-rc.1...v2.4.6)

 * No changes since rc.1

Changes in [2.4.6-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.6-rc.1) (2019-12-04)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.5...v2.4.6-rc.1)

 * Update alias handling
   [\#1102](https://github.com/matrix-org/matrix-js-sdk/pull/1102)
 * increase timeout on flush to fix failing unit test
   [\#1096](https://github.com/matrix-org/matrix-js-sdk/pull/1096)
 * Disable broken cross-signing test
   [\#1095](https://github.com/matrix-org/matrix-js-sdk/pull/1095)
 * Fix a couple SAS tests
   [\#1094](https://github.com/matrix-org/matrix-js-sdk/pull/1094)
 * Fix Olm unwedging test
   [\#1093](https://github.com/matrix-org/matrix-js-sdk/pull/1093)
 * Fix empty string handling in push notifications
   [\#1089](https://github.com/matrix-org/matrix-js-sdk/pull/1089)
 * expand e2ee logging to better debug UISIs
   [\#1090](https://github.com/matrix-org/matrix-js-sdk/pull/1090)
 * Remove Bluebird: phase 2
   [\#1087](https://github.com/matrix-org/matrix-js-sdk/pull/1087)
 * Relax identity server discovery checks to FAIL_PROMPT
   [\#1062](https://github.com/matrix-org/matrix-js-sdk/pull/1062)
 * Fix incorrect return value of MatrixClient.prototype.uploadKeys
   [\#1061](https://github.com/matrix-org/matrix-js-sdk/pull/1061)
 * Fix calls in e2e rooms
   [\#1086](https://github.com/matrix-org/matrix-js-sdk/pull/1086)
 * Monitor verification request over DM as well
   [\#1085](https://github.com/matrix-org/matrix-js-sdk/pull/1085)
 * Remove 'check' npm script
   [\#1084](https://github.com/matrix-org/matrix-js-sdk/pull/1084)
 * Always process call events in batches
   [\#1083](https://github.com/matrix-org/matrix-js-sdk/pull/1083)
 * Fix ringing chirp on loading
   [\#1082](https://github.com/matrix-org/matrix-js-sdk/pull/1082)
 * Remove *most* bluebird specific things
   [\#1081](https://github.com/matrix-org/matrix-js-sdk/pull/1081)
 * Switch to Jest
   [\#1080](https://github.com/matrix-org/matrix-js-sdk/pull/1080)

Changes in [2.4.5](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.5) (2019-11-27)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.4...v2.4.5)

* Relax identity server discovery checks to FAIL_PROMPT
* Expand E2EE debug logging to diagnose "unable to decrypt" errors

Changes in [2.4.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.4) (2019-11-25)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.4-rc.1...v2.4.4)

 * No changes since rc.1

Changes in [2.4.4-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.4-rc.1) (2019-11-20)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.3...v2.4.4-rc.1)

 * Fix SAS verification in encrypted DMs
   [\#1077](https://github.com/matrix-org/matrix-js-sdk/pull/1077)
 * Cross-signing / secret storage tweaks
   [\#1078](https://github.com/matrix-org/matrix-js-sdk/pull/1078)
 * Fix local trust for key backups
   [\#1075](https://github.com/matrix-org/matrix-js-sdk/pull/1075)
 * Add method to get last active timestamp in room
   [\#1072](https://github.com/matrix-org/matrix-js-sdk/pull/1072)
 * Check the right Synapse endpoint for determining admin capabilities
   [\#1071](https://github.com/matrix-org/matrix-js-sdk/pull/1071)
 * Cross Signing Support
   [\#832](https://github.com/matrix-org/matrix-js-sdk/pull/832)
 * Don't double cancel verification request
   [\#1064](https://github.com/matrix-org/matrix-js-sdk/pull/1064)
 * Support for verification requests in the timeline
   [\#1067](https://github.com/matrix-org/matrix-js-sdk/pull/1067)
 * Use stable API prefix for 3PID APIs when supported
   [\#1066](https://github.com/matrix-org/matrix-js-sdk/pull/1066)
 * Remove Jenkins scripts
   [\#1063](https://github.com/matrix-org/matrix-js-sdk/pull/1063)

Changes in [2.4.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.3) (2019-11-04)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.3-rc.1...v2.4.3)

 * No changes since rc.1

Changes in [2.4.3-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.3-rc.1) (2019-10-30)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.2...v2.4.3-rc.1)

 * fix the path in references to logger.js
   [\#1056](https://github.com/matrix-org/matrix-js-sdk/pull/1056)
 * verification in DMs
   [\#1050](https://github.com/matrix-org/matrix-js-sdk/pull/1050)
 * Properly documented the function possible returns
   [\#1054](https://github.com/matrix-org/matrix-js-sdk/pull/1054)
 * Downgrade to Bluebird 3.5.5 to fix Firefox
   [\#1055](https://github.com/matrix-org/matrix-js-sdk/pull/1055)
 * Upgrade safe deps to latest major version
   [\#1053](https://github.com/matrix-org/matrix-js-sdk/pull/1053)
 * Don't include .js in the import string.
   [\#1052](https://github.com/matrix-org/matrix-js-sdk/pull/1052)

Changes in [2.4.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.2) (2019-10-18)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.2-rc.1...v2.4.2)

 * No changes since v2.4.2-rc.1

Changes in [2.4.2-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.2-rc.1) (2019-10-09)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.1...v2.4.2-rc.1)

 * Log state of Olm sessions
   [\#1047](https://github.com/matrix-org/matrix-js-sdk/pull/1047)
 * Add method to get access to all timelines
   [\#1048](https://github.com/matrix-org/matrix-js-sdk/pull/1048)

Changes in [2.4.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.1) (2019-10-01)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.0...v2.4.1)

 * Upgrade deps
   [\#1046](https://github.com/matrix-org/matrix-js-sdk/pull/1046)
 * Ignore crypto events with no content
   [\#1043](https://github.com/matrix-org/matrix-js-sdk/pull/1043)

Changes in [2.4.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.0) (2019-09-27)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.4.0-rc.1...v2.4.0)

 * Clean Yarn cache during release
   [\#1045](https://github.com/matrix-org/matrix-js-sdk/pull/1045)

Changes in [2.4.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.4.0-rc.1) (2019-09-25)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.3.2...v2.4.0-rc.1)

 * Remove id_server from creds for interactive auth
   [\#1044](https://github.com/matrix-org/matrix-js-sdk/pull/1044)
 * Remove IS details from requestToken to HS
   [\#1041](https://github.com/matrix-org/matrix-js-sdk/pull/1041)
 * Add support for sending MSISDN tokens to alternate URLs
   [\#1040](https://github.com/matrix-org/matrix-js-sdk/pull/1040)
 * Add separate 3PID add and bind APIs
   [\#1038](https://github.com/matrix-org/matrix-js-sdk/pull/1038)
 * Bump eslint-utils from 1.4.0 to 1.4.2
   [\#1037](https://github.com/matrix-org/matrix-js-sdk/pull/1037)
 * Handle WebRTC security errors as non-fatal
   [\#1036](https://github.com/matrix-org/matrix-js-sdk/pull/1036)
 * Check for r0.6.0 support in addition to unstable feature flags
   [\#1035](https://github.com/matrix-org/matrix-js-sdk/pull/1035)
 * Update room members on member event redaction
   [\#1030](https://github.com/matrix-org/matrix-js-sdk/pull/1030)
 * Support hidden read receipts
   [\#1028](https://github.com/matrix-org/matrix-js-sdk/pull/1028)
 * Do 3pid lookups in lowercase
   [\#1029](https://github.com/matrix-org/matrix-js-sdk/pull/1029)
 * Add Synapse admin functions for deactivating a user
   [\#1027](https://github.com/matrix-org/matrix-js-sdk/pull/1027)
 * Fix addPendingEvent with pending event order == chronological
   [\#1026](https://github.com/matrix-org/matrix-js-sdk/pull/1026)
 * Add AutoDiscovery.getRawClientConfig() for easy .well-known lookups
   [\#1024](https://github.com/matrix-org/matrix-js-sdk/pull/1024)
 * Don't convert errors to JSON if they are JSON already
   [\#1025](https://github.com/matrix-org/matrix-js-sdk/pull/1025)
 * Send id_access_token to HS for use in proxied IS requests
   [\#1022](https://github.com/matrix-org/matrix-js-sdk/pull/1022)
 * Clean up JSON handling in identity server requests
   [\#1023](https://github.com/matrix-org/matrix-js-sdk/pull/1023)
 * Use the v2 (hashed) lookup for identity server queries
   [\#1021](https://github.com/matrix-org/matrix-js-sdk/pull/1021)
 * Add getIdServer() & doesServerRequireIdServerParam()
   [\#1018](https://github.com/matrix-org/matrix-js-sdk/pull/1018)
 * Make requestToken endpoints work without ID Server
   [\#1019](https://github.com/matrix-org/matrix-js-sdk/pull/1019)
 * Fix setIdentityServer
   [\#1016](https://github.com/matrix-org/matrix-js-sdk/pull/1016)
 * Change ICE fallback server and make fallback opt-in
   [\#1015](https://github.com/matrix-org/matrix-js-sdk/pull/1015)
 * Throw an exception if trying to do an ID server request with no ID server
   [\#1014](https://github.com/matrix-org/matrix-js-sdk/pull/1014)
 * Add setIdentityServerUrl
   [\#1013](https://github.com/matrix-org/matrix-js-sdk/pull/1013)
 * Add matrix base API to report an event
   [\#1011](https://github.com/matrix-org/matrix-js-sdk/pull/1011)
 * Fix POST body for v2 IS requests
   [\#1010](https://github.com/matrix-org/matrix-js-sdk/pull/1010)
 * Add API for bulk lookup on the Identity Server
   [\#1009](https://github.com/matrix-org/matrix-js-sdk/pull/1009)
 * Remove deprecated authedRequestWithPrefix and requestWithPrefix
   [\#1000](https://github.com/matrix-org/matrix-js-sdk/pull/1000)
 * Add API for checking IS account info
   [\#1007](https://github.com/matrix-org/matrix-js-sdk/pull/1007)
 * Support rewriting push rules when our internal defaults change
   [\#1006](https://github.com/matrix-org/matrix-js-sdk/pull/1006)
 * Upgrade dependencies
   [\#1005](https://github.com/matrix-org/matrix-js-sdk/pull/1005)

Changes in [2.3.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.3.2) (2019-09-16)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.3.2-rc.1...v2.3.2)

 * [Release] Fix addPendingEvent with pending event order == chronological
   [\#1034](https://github.com/matrix-org/matrix-js-sdk/pull/1034)

Changes in [2.3.2-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.3.2-rc.1) (2019-09-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.3.1...v2.3.2-rc.1)

 * Synapse admin functions to release
   [\#1033](https://github.com/matrix-org/matrix-js-sdk/pull/1033)
 * [To Release] Add matrix base API to report an event
   [\#1032](https://github.com/matrix-org/matrix-js-sdk/pull/1032)

Changes in [2.3.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.3.1) (2019-09-12)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.3.1-rc.1...v2.3.1)

 * No changes since rc.1

Changes in [2.3.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.3.1-rc.1) (2019-09-11)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.3.0...v2.3.1-rc.1)

 * Update room members on member event redaction
   [\#1031](https://github.com/matrix-org/matrix-js-sdk/pull/1031)

Changes in [2.3.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.3.0) (2019-08-05)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.3.0-rc.1...v2.3.0)

 * [release] Support rewriting push rules when our internal defaults change
   [\#1008](https://github.com/matrix-org/matrix-js-sdk/pull/1008)

Changes in [2.3.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.3.0-rc.1) (2019-07-31)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.2.0...v2.3.0-rc.1)

 * Add support for IS v2 API with authentication
   [\#1002](https://github.com/matrix-org/matrix-js-sdk/pull/1002)
 * Tombstone bugfixes
   [\#1001](https://github.com/matrix-org/matrix-js-sdk/pull/1001)
 * Support for MSC2140 (terms of service for IS/IM)
   [\#988](https://github.com/matrix-org/matrix-js-sdk/pull/988)
 * Add a request method to /devices
   [\#994](https://github.com/matrix-org/matrix-js-sdk/pull/994)

Changes in [2.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.2.0) (2019-07-18)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.2.0-rc.2...v2.2.0)

 * Upgrade lodash dependencies

Changes in [2.2.0-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.2.0-rc.2) (2019-07-12)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.2.0-rc.1...v2.2.0-rc.2)

 * Fix regression from 2.2.0-rc.1 in request to /devices
   [\#995](https://github.com/matrix-org/matrix-js-sdk/pull/995)

Changes in [2.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.2.0-rc.1) (2019-07-12)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.1.1...v2.2.0-rc.1)

 * End the verification timer when verification is done
   [\#993](https://github.com/matrix-org/matrix-js-sdk/pull/993)
 * Stabilize usage of stably stable APIs (in a stable way)
   [\#990](https://github.com/matrix-org/matrix-js-sdk/pull/990)
 * Expose original_event for /relations
   [\#987](https://github.com/matrix-org/matrix-js-sdk/pull/987)
 * Process ephemeral events outside timeline handling
   [\#989](https://github.com/matrix-org/matrix-js-sdk/pull/989)
 * Don't accept any locally known edits earlier than the last known server-side
   aggregated edit
   [\#986](https://github.com/matrix-org/matrix-js-sdk/pull/986)
 * Get edit date transparently from server aggregations or local echo
   [\#984](https://github.com/matrix-org/matrix-js-sdk/pull/984)
 * Add a function to flag keys for backup without scheduling a backup
   [\#982](https://github.com/matrix-org/matrix-js-sdk/pull/982)
 * Block read marker and read receipt from advancing into pending events
   [\#981](https://github.com/matrix-org/matrix-js-sdk/pull/981)
 * Upgrade dependencies
   [\#977](https://github.com/matrix-org/matrix-js-sdk/pull/977)
 * Add default push rule to ignore reactions
   [\#976](https://github.com/matrix-org/matrix-js-sdk/pull/976)
 * Fix exception whilst syncing
   [\#979](https://github.com/matrix-org/matrix-js-sdk/pull/979)
 * Include the error object when raising Session.logged_out
   [\#975](https://github.com/matrix-org/matrix-js-sdk/pull/975)

Changes in [2.1.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.1.1) (2019-07-11)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.1.0...v2.1.1)

 * Process emphemeral events outside timeline handling
   [\#989](https://github.com/matrix-org/matrix-js-sdk/pull/989)

Changes in [2.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.1.0) (2019-07-08)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.1.0-rc.1...v2.1.0)

 * Fix exception whilst syncing
   [\#979](https://github.com/matrix-org/matrix-js-sdk/pull/979)

Changes in [2.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.1.0-rc.1) (2019-07-03)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.0.1...v2.1.0-rc.1)

 * Handle self read receipts for fixing e2e notification counts
   [\#974](https://github.com/matrix-org/matrix-js-sdk/pull/974)
 * Add redacts field to event.toJSON
   [\#973](https://github.com/matrix-org/matrix-js-sdk/pull/973)
 * Handle associated event send failures
   [\#972](https://github.com/matrix-org/matrix-js-sdk/pull/972)
 * Remove irrelevant debug line from timeline handling
   [\#971](https://github.com/matrix-org/matrix-js-sdk/pull/971)
 * Handle relations in encrypted rooms
   [\#969](https://github.com/matrix-org/matrix-js-sdk/pull/969)
 * Relations endpoint support
   [\#967](https://github.com/matrix-org/matrix-js-sdk/pull/967)
 * Disable event encryption for reactions
   [\#968](https://github.com/matrix-org/matrix-js-sdk/pull/968)
 * Change the known safe room version to version 4
   [\#966](https://github.com/matrix-org/matrix-js-sdk/pull/966)
 * Check for lazy-loading support in the spec versions instead
   [\#965](https://github.com/matrix-org/matrix-js-sdk/pull/965)
 * Use camelCase instead of underscore
   [\#963](https://github.com/matrix-org/matrix-js-sdk/pull/963)
 * Time out verification attempts after 10 minutes of inactivity
   [\#961](https://github.com/matrix-org/matrix-js-sdk/pull/961)
 * Don't handle key verification requests which are immediately cancelled
   [\#962](https://github.com/matrix-org/matrix-js-sdk/pull/962)

Changes in [2.0.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.0.1) (2019-06-19)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.0.1-rc.2...v2.0.1)

 No changes since rc.2

Changes in [2.0.1-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.0.1-rc.2) (2019-06-18)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.0.1-rc.1...v2.0.1-rc.2)

 * return 'sending' status for an event that is only locally redacted
   [\#960](https://github.com/matrix-org/matrix-js-sdk/pull/960)
 * Key verification request fixes
   [\#954](https://github.com/matrix-org/matrix-js-sdk/pull/954)
 * Add flag to force saving sync store
   [\#956](https://github.com/matrix-org/matrix-js-sdk/pull/956)
 * Expose the inhibit_login flag to register
   [\#953](https://github.com/matrix-org/matrix-js-sdk/pull/953)
 *  Support redactions and relations of/with unsent events.
   [\#947](https://github.com/matrix-org/matrix-js-sdk/pull/947)

Changes in [2.0.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.0.1-rc.1) (2019-06-12)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v2.0.0...v2.0.1-rc.1)

 * Fix content uploads for modern browsers
   [\#952](https://github.com/matrix-org/matrix-js-sdk/pull/952)
 * Don't overlap auth submissions with polls
   [\#951](https://github.com/matrix-org/matrix-js-sdk/pull/951)
 * Add funding details for GitHub sponsor button
   [\#945](https://github.com/matrix-org/matrix-js-sdk/pull/945)
 * Fix backup sig validation with multiple sigs
   [\#944](https://github.com/matrix-org/matrix-js-sdk/pull/944)
 * Don't send another token request while one's in flight
   [\#943](https://github.com/matrix-org/matrix-js-sdk/pull/943)
 * Don't poll UI auth again until current poll finishes
   [\#942](https://github.com/matrix-org/matrix-js-sdk/pull/942)
 * Provide the discovered URLs when a liveliness error occurs
   [\#938](https://github.com/matrix-org/matrix-js-sdk/pull/938)
 * Encode event IDs when redacting events
   [\#941](https://github.com/matrix-org/matrix-js-sdk/pull/941)
 * add missing logger
   [\#940](https://github.com/matrix-org/matrix-js-sdk/pull/940)
 * verification: don't error if we don't know about some keys
   [\#939](https://github.com/matrix-org/matrix-js-sdk/pull/939)
 * Local echo for redactions
   [\#937](https://github.com/matrix-org/matrix-js-sdk/pull/937)
 * Refresh safe room versions when the server looks more modern than us
   [\#934](https://github.com/matrix-org/matrix-js-sdk/pull/934)
 * Add v4 as a safe room version
   [\#935](https://github.com/matrix-org/matrix-js-sdk/pull/935)
 * Disable guard-for-in rule
   [\#933](https://github.com/matrix-org/matrix-js-sdk/pull/933)
 * Extend loglevel logging for the whole project
   [\#924](https://github.com/matrix-org/matrix-js-sdk/pull/924)
 * fix(login): saves access_token and user_id after login for all login types
   [\#930](https://github.com/matrix-org/matrix-js-sdk/pull/930)
 * Do not try to request thumbnails with non-integer sizes
   [\#929](https://github.com/matrix-org/matrix-js-sdk/pull/929)
 * Revert "Add a bunch of debugging to .well-known IS validation"
   [\#928](https://github.com/matrix-org/matrix-js-sdk/pull/928)
 * Add a bunch of debugging to .well-known IS validation
   [\#927](https://github.com/matrix-org/matrix-js-sdk/pull/927)

Changes in [2.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v2.0.0) (2019-05-31)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.2.0...v2.0.0)

BREAKING CHANGES
----------------

 * This package now publishes in ES6 / ES2015 syntax to NPM
 * Saves access_token and user_id after login for all login types
   [\#932](https://github.com/matrix-org/matrix-js-sdk/pull/932)
 * Fix recovery key encoding for base-x 3.0.5
   [\#931](https://github.com/matrix-org/matrix-js-sdk/pull/931)

Changes in [1.2.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.2.0) (2019-05-29)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.2.0-rc.1...v1.2.0)


Changes in [1.2.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.2.0-rc.1) (2019-05-23)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.1.0...v1.2.0-rc.1)

 * interactive-auth now handles requesting email tokens
   [\#926](https://github.com/matrix-org/matrix-js-sdk/pull/926)
 * allow access to unreplaced message content
   [\#923](https://github.com/matrix-org/matrix-js-sdk/pull/923)
 * Add method to retrieve replacing event
   [\#922](https://github.com/matrix-org/matrix-js-sdk/pull/922)
 * More logging when signature verification fails
   [\#921](https://github.com/matrix-org/matrix-js-sdk/pull/921)
 * Local echo for m.replace relations
   [\#920](https://github.com/matrix-org/matrix-js-sdk/pull/920)
 * Track relations as pending and remove when cancelled
   [\#919](https://github.com/matrix-org/matrix-js-sdk/pull/919)
 * Add stringify helper to summarise events when debugging
   [\#916](https://github.com/matrix-org/matrix-js-sdk/pull/916)
 * Message editing: filter out replacements for senders that are not the
   original sender
   [\#918](https://github.com/matrix-org/matrix-js-sdk/pull/918)
 * Wait until decrypt before aggregating
   [\#917](https://github.com/matrix-org/matrix-js-sdk/pull/917)
 * Message editing: mark original event as replaced instead of replacing the
   event object
   [\#914](https://github.com/matrix-org/matrix-js-sdk/pull/914)
 * Support for replacing message through m.replace relationship.
   [\#913](https://github.com/matrix-org/matrix-js-sdk/pull/913)
 * Use a short timeout for .well-known requests
   [\#912](https://github.com/matrix-org/matrix-js-sdk/pull/912)
 * Redaction and change events for relations
   [\#911](https://github.com/matrix-org/matrix-js-sdk/pull/911)
 * Add basic read path for relations
   [\#910](https://github.com/matrix-org/matrix-js-sdk/pull/910)
 * Add a concept of default push rules, using it for tombstone notifications
   [\#860](https://github.com/matrix-org/matrix-js-sdk/pull/860)
 * yarn upgrade
   [\#907](https://github.com/matrix-org/matrix-js-sdk/pull/907)

Changes in [1.1.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.1.0) (2019-05-07)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.1.0-rc.1...v1.1.0)

 * No Changes since rc.1

Changes in [1.1.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.1.0-rc.1) (2019-04-30)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.4...v1.1.0-rc.1)

 * use the release version of olm 3.1.0
   [\#903](https://github.com/matrix-org/matrix-js-sdk/pull/903)
 * Use new Olm repo link in README
   [\#901](https://github.com/matrix-org/matrix-js-sdk/pull/901)
 * Support being fed a .well-known config object for validation
   [\#897](https://github.com/matrix-org/matrix-js-sdk/pull/897)
 * emit self-membership event at end of handling sync update
   [\#900](https://github.com/matrix-org/matrix-js-sdk/pull/900)
 * Use packages.matrix.org for Olm
   [\#898](https://github.com/matrix-org/matrix-js-sdk/pull/898)
 * Fix tests on develop
   [\#899](https://github.com/matrix-org/matrix-js-sdk/pull/899)
 * Stop syncing when the token is invalid
   [\#895](https://github.com/matrix-org/matrix-js-sdk/pull/895)
 * change event redact,  POST request to PUT request
   [\#887](https://github.com/matrix-org/matrix-js-sdk/pull/887)
 * Expose better autodiscovery error messages
   [\#894](https://github.com/matrix-org/matrix-js-sdk/pull/894)
 * Explicitly guard store usage during sync startup
   [\#892](https://github.com/matrix-org/matrix-js-sdk/pull/892)
 * Flag v3 rooms as safe
   [\#893](https://github.com/matrix-org/matrix-js-sdk/pull/893)
 * Cache failed capabilities lookups for shorter amounts of time
   [\#890](https://github.com/matrix-org/matrix-js-sdk/pull/890)
 * Fix highlight notifications for unencrypted rooms
   [\#891](https://github.com/matrix-org/matrix-js-sdk/pull/891)
 * Document checking crypto state before using `hasUnverifiedDevices`
   [\#889](https://github.com/matrix-org/matrix-js-sdk/pull/889)
 * Add logging to sync startup path
   [\#888](https://github.com/matrix-org/matrix-js-sdk/pull/888)
 * Track e2e highlights better, particularly in 'Mentions Only' rooms
   [\#886](https://github.com/matrix-org/matrix-js-sdk/pull/886)
 * support both the incorrect and correct MAC methods
   [\#882](https://github.com/matrix-org/matrix-js-sdk/pull/882)
 * Refuse to set forwards pagination token on live timeline
   [\#885](https://github.com/matrix-org/matrix-js-sdk/pull/885)
 * Degrade `IndexedDBStore` back to memory only on failure
   [\#884](https://github.com/matrix-org/matrix-js-sdk/pull/884)
 * Refuse to link live timelines into the forwards/backwards position when
   either is invalid
   [\#877](https://github.com/matrix-org/matrix-js-sdk/pull/877)
 * Key backup logging improvements
   [\#883](https://github.com/matrix-org/matrix-js-sdk/pull/883)
 * Don't assume aborts are always from txn.abort()
   [\#880](https://github.com/matrix-org/matrix-js-sdk/pull/880)
 * Add a bunch of logging
   [\#878](https://github.com/matrix-org/matrix-js-sdk/pull/878)
 * Refuse splicing the live timeline into a broken position
   [\#873](https://github.com/matrix-org/matrix-js-sdk/pull/873)
 * Add existence check to local storage based crypto store
   [\#872](https://github.com/matrix-org/matrix-js-sdk/pull/872)

Changes in [1.0.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.4) (2019-04-08)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.3...v1.0.4)

 * Hotfix: more logging and potential fixes for timeline corruption issue, see ticket https://github.com/vector-im/riot-web/issues/8593.

Changes in [1.0.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.3) (2019-04-01)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.3-rc.1...v1.0.3)

 * Add existence check to local storage based crypto store
   [\#874](https://github.com/matrix-org/matrix-js-sdk/pull/874)

Changes in [1.0.3-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.3-rc.1) (2019-03-27)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.2...v1.0.3-rc.1)

 * Add IndexedDB existence checks
   [\#871](https://github.com/matrix-org/matrix-js-sdk/pull/871)
 * Emit sync errors for capturing by clients
   [\#869](https://github.com/matrix-org/matrix-js-sdk/pull/869)
 * Add functions for getting room upgrade history and leaving those rooms
   [\#868](https://github.com/matrix-org/matrix-js-sdk/pull/868)
 * Clarify the meaning of 'real name' for contribution
   [\#867](https://github.com/matrix-org/matrix-js-sdk/pull/867)
 * Remove `sessionStore` to `cryptoStore` migration path
   [\#865](https://github.com/matrix-org/matrix-js-sdk/pull/865)
 * Add debugging for spurious room version warnings
   [\#866](https://github.com/matrix-org/matrix-js-sdk/pull/866)
 * Add investigation notes for browser storage
   [\#864](https://github.com/matrix-org/matrix-js-sdk/pull/864)
 * make sure resolve object is defined before calling it
   [\#862](https://github.com/matrix-org/matrix-js-sdk/pull/862)
 * Rename `MatrixInMemoryStore` to `MemoryStore`
   [\#861](https://github.com/matrix-org/matrix-js-sdk/pull/861)
 * Use Buildkite for CI
   [\#859](https://github.com/matrix-org/matrix-js-sdk/pull/859)
 * only create one session at a time per device
   [\#857](https://github.com/matrix-org/matrix-js-sdk/pull/857)

Changes in [1.0.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.2) (2019-03-18)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.2-rc.1...v1.0.2)

 * No changes since rc.1

Changes in [1.0.2-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.2-rc.1) (2019-03-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.1...v1.0.2-rc.1)

 * Use modern Yarn version on Travis CI
   [\#858](https://github.com/matrix-org/matrix-js-sdk/pull/858)
 * Switch to `yarn` for dependency management
   [\#856](https://github.com/matrix-org/matrix-js-sdk/pull/856)
 * More key request fixes
   [\#855](https://github.com/matrix-org/matrix-js-sdk/pull/855)
 * Calculate encrypted notification counts
   [\#851](https://github.com/matrix-org/matrix-js-sdk/pull/851)
 * Update dependencies
   [\#854](https://github.com/matrix-org/matrix-js-sdk/pull/854)
 * make sure key requests get sent
   [\#850](https://github.com/matrix-org/matrix-js-sdk/pull/850)
 * Use 'ideal' rather than 'exact' for deviceid
   [\#852](https://github.com/matrix-org/matrix-js-sdk/pull/852)
 * handle partially-shared sessions better
   [\#848](https://github.com/matrix-org/matrix-js-sdk/pull/848)

Changes in [1.0.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.1) (2019-03-06)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.1-rc.2...v1.0.1)

 * No changes since rc.2

Changes in [1.0.1-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.1-rc.2) (2019-03-05)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.1-rc.1...v1.0.1-rc.2)

 * dont swallow txn errors in crypto store
   [\#853](https://github.com/matrix-org/matrix-js-sdk/pull/853)
 * Don't swallow txn errors in crypto store
   [\#849](https://github.com/matrix-org/matrix-js-sdk/pull/849)

Changes in [1.0.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.1-rc.1) (2019-02-28)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.0...v1.0.1-rc.1)

 * Fix "e is undefined" masking the original error in MegolmDecryption
   [\#847](https://github.com/matrix-org/matrix-js-sdk/pull/847)

Changes in [1.0.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.0) (2019-02-14)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.0-rc.2...v1.0.0)

 * Try again to commit package-lock.json
   [\#841](https://github.com/matrix-org/matrix-js-sdk/pull/841)

Changes in [1.0.0-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.0-rc.2) (2019-02-14)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v1.0.0-rc.1...v1.0.0-rc.2)

 * Release script: commit package-lock.json
   [\#839](https://github.com/matrix-org/matrix-js-sdk/pull/839)
 * Add method to force re-check of key backup
   [\#840](https://github.com/matrix-org/matrix-js-sdk/pull/840)
 * Fix: dont check for unverified devices in left members
   [\#838](https://github.com/matrix-org/matrix-js-sdk/pull/838)

Changes in [1.0.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.0-rc.1) (2019-02-08)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.3...v1.0.0-rc.1)

 * change hex SAS verification to decimal and emoji
   [\#837](https://github.com/matrix-org/matrix-js-sdk/pull/837)
 * Trust on decrypt
   [\#836](https://github.com/matrix-org/matrix-js-sdk/pull/836)
 * Always track our own devices
   [\#835](https://github.com/matrix-org/matrix-js-sdk/pull/835)
 * Make linting rules more consistent
   [\#834](https://github.com/matrix-org/matrix-js-sdk/pull/834)
 * add method to room to check for unverified devices
   [\#833](https://github.com/matrix-org/matrix-js-sdk/pull/833)
 * Merge redesign into develop
   [\#831](https://github.com/matrix-org/matrix-js-sdk/pull/831)
 * Supporting infrastructure for educated decisions on when to upgrade rooms
   [\#830](https://github.com/matrix-org/matrix-js-sdk/pull/830)
 * Include signature info for unknown devices
   [\#826](https://github.com/matrix-org/matrix-js-sdk/pull/826)
 * Flag v2 rooms as "safe"
   [\#828](https://github.com/matrix-org/matrix-js-sdk/pull/828)
 * Update ESLint
   [\#821](https://github.com/matrix-org/matrix-js-sdk/pull/821)

Changes in [0.14.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.3) (2019-01-22)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.3-rc.1...v0.14.3)

 * No changes since rc.1

Changes in [0.14.3-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.3-rc.1) (2019-01-17)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.2...v0.14.3-rc.1)

 * Merge develop into experimental
   [\#815](https://github.com/matrix-org/matrix-js-sdk/pull/815)
 * Add a getAllEndToEndSessions to crypto store
   [\#812](https://github.com/matrix-org/matrix-js-sdk/pull/812)
 * T3chguy/fix displayname logic
   [\#668](https://github.com/matrix-org/matrix-js-sdk/pull/668)
 * Contributing: Note that rebase lets you mass signoff commits
   [\#814](https://github.com/matrix-org/matrix-js-sdk/pull/814)
 * take into account homoglyphs when calculating similar display names
   [\#672](https://github.com/matrix-org/matrix-js-sdk/pull/672)
 * Emit for key backup failures
   [\#809](https://github.com/matrix-org/matrix-js-sdk/pull/809)
 * emit oldEventId on "updatePendingEvent"
   [\#646](https://github.com/matrix-org/matrix-js-sdk/pull/646)
 * Add getThirdpartyUser to base api
   [\#589](https://github.com/matrix-org/matrix-js-sdk/pull/589)
 * Support custom status messages
   [\#805](https://github.com/matrix-org/matrix-js-sdk/pull/805)
 * Extra checks to avoid release script blowing up mid-process.
   [\#749](https://github.com/matrix-org/matrix-js-sdk/pull/749)
 * Move glob regex utilities out of the pushprocessor and into a more generic
   place
   [\#800](https://github.com/matrix-org/matrix-js-sdk/pull/800)

Changes in [0.14.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.2) (2018-12-10)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.2-rc.1...v0.14.2)

 * No changes since rc.1

Changes in [0.14.2-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.2-rc.1) (2018-12-06)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.1...v0.14.2-rc.1)

 * fix some assertions in e2e backup unit test
   [\#794](https://github.com/matrix-org/matrix-js-sdk/pull/794)
 * Config should be called with auth
   [\#798](https://github.com/matrix-org/matrix-js-sdk/pull/798)
 * Don't re-establish sessions with unknown devices
   [\#792](https://github.com/matrix-org/matrix-js-sdk/pull/792)
 * e2e key backups
   [\#684](https://github.com/matrix-org/matrix-js-sdk/pull/684)
 * WIP: online incremental megolm backups
   [\#595](https://github.com/matrix-org/matrix-js-sdk/pull/595)
 * Support for e2e key backups
   [\#736](https://github.com/matrix-org/matrix-js-sdk/pull/736)
 * Passphrase Support for e2e backups
   [\#786](https://github.com/matrix-org/matrix-js-sdk/pull/786)
 * Add 'getSsoLoginUrl' function
   [\#783](https://github.com/matrix-org/matrix-js-sdk/pull/783)
 * Fix: don't set the room name to null when heroes are missing.
   [\#784](https://github.com/matrix-org/matrix-js-sdk/pull/784)
 * Handle crypto db version upgrades
   [\#785](https://github.com/matrix-org/matrix-js-sdk/pull/785)
 * Restart broken Olm sessions
   [\#780](https://github.com/matrix-org/matrix-js-sdk/pull/780)
 * Use the last olm session that got a message
   [\#776](https://github.com/matrix-org/matrix-js-sdk/pull/776)

Changes in [0.14.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.1) (2018-11-22)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.0...v0.14.1)

 * Warning when crypto DB is too new to use.

Changes in [0.14.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.0) (2018-11-19)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.14.0-rc.1...v0.14.0)

 * No changes since rc.1

Changes in [0.14.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.14.0-rc.1) (2018-11-15)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.13.1...v0.14.0-rc.1)

BREAKING CHANGE
----------------

 * js-sdk now uses Olm 3.0. Apps using Olm must update to 3.0 to
   continue using Olm with the js-sdk. The js-sdk will call Olm's
   init() method when the client is started.

All Changes
-----------

 * Prevent messages from being sent if other messages have failed to send
   [\#781](https://github.com/matrix-org/matrix-js-sdk/pull/781)
 * A unit test for olm
   [\#777](https://github.com/matrix-org/matrix-js-sdk/pull/777)
 * Set access_token and user_id after login in with username and password.
   [\#778](https://github.com/matrix-org/matrix-js-sdk/pull/778)
 * Add function to get currently joined rooms.
   [\#779](https://github.com/matrix-org/matrix-js-sdk/pull/779)
 * Remove the request-only stuff we don't need anymore
   [\#775](https://github.com/matrix-org/matrix-js-sdk/pull/775)
 * Manually construct query strings for browser-request instances
   [\#770](https://github.com/matrix-org/matrix-js-sdk/pull/770)
 * Fix: correctly check for crypto being present
   [\#769](https://github.com/matrix-org/matrix-js-sdk/pull/769)
 * Update babel-eslint to 8.1.1
   [\#768](https://github.com/matrix-org/matrix-js-sdk/pull/768)
 * Support `request` in the browser and support supplying servers to try in
   joinRoom()
   [\#764](https://github.com/matrix-org/matrix-js-sdk/pull/764)
 * loglevel should be a normal dependency
   [\#767](https://github.com/matrix-org/matrix-js-sdk/pull/767)
 * Stop devicelist when client is stopped
   [\#766](https://github.com/matrix-org/matrix-js-sdk/pull/766)
 * Update to WebAssembly-powered Olm
   [\#743](https://github.com/matrix-org/matrix-js-sdk/pull/743)
 * Logging lib. Fixes #332
   [\#763](https://github.com/matrix-org/matrix-js-sdk/pull/763)
 * Use new stop() method on matrix-mock-request
   [\#765](https://github.com/matrix-org/matrix-js-sdk/pull/765)

Changes in [0.13.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.13.1) (2018-11-14)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.13.0...v0.13.1)

 * Add function to get currently joined rooms.
   [\#779](https://github.com/matrix-org/matrix-js-sdk/pull/779)

Changes in [0.13.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.13.0) (2018-11-15)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.12.1...v0.13.0)

BREAKING CHANGE
----------------
 * `MatrixClient::login` now sets client `access_token` and `user_id` following successful login with username and password.

Changes in [0.12.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.12.1) (2018-10-29)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.12.1-rc.1...v0.12.1)

 * No changes since rc.1

Changes in [0.12.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.12.1-rc.1) (2018-10-24)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.12.0...v0.12.1-rc.1)

 * Add repository type to package.json to make it valid
   [\#762](https://github.com/matrix-org/matrix-js-sdk/pull/762)
 * Add getMediaConfig()
   [\#761](https://github.com/matrix-org/matrix-js-sdk/pull/761)
 * add new examples, to be expanded into a post
   [\#739](https://github.com/matrix-org/matrix-js-sdk/pull/739)

Changes in [0.12.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.12.0) (2018-10-16)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.12.0-rc.1...v0.12.0)

 * No changes since rc.1

Changes in [0.12.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.12.0-rc.1) (2018-10-11)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.11.1...v0.12.0-rc.1)

BREAKING CHANGES
----------------
 * If js-sdk finds data in the store that is incompatible with the options currently being used,
   it will emit sync state ERROR with an error of type InvalidStoreError. It will also stop trying
   to sync in this situation: the app must stop the client and then either clear the store or
   change the options (in this case, enable or disable lazy loading of members) and then start
   the client again.

All Changes
-----------

 * never replace /sync'ed memberships with OOB ones
   [\#760](https://github.com/matrix-org/matrix-js-sdk/pull/760)
 * Don't fail to start up if lazy load check fails
   [\#759](https://github.com/matrix-org/matrix-js-sdk/pull/759)
 * Make e2e work on Edge
   [\#754](https://github.com/matrix-org/matrix-js-sdk/pull/754)
 * throw error with same name and message over idb worker boundary
   [\#758](https://github.com/matrix-org/matrix-js-sdk/pull/758)
 * Default to a room version of 1 when there is no room create event
   [\#755](https://github.com/matrix-org/matrix-js-sdk/pull/755)
 * Silence bluebird warnings
   [\#757](https://github.com/matrix-org/matrix-js-sdk/pull/757)
 * allow non-ff merge from release branch into master
   [\#750](https://github.com/matrix-org/matrix-js-sdk/pull/750)
 * Reject with the actual error on indexeddb error
   [\#751](https://github.com/matrix-org/matrix-js-sdk/pull/751)
 * Update mocha to v5
   [\#744](https://github.com/matrix-org/matrix-js-sdk/pull/744)
 * disable lazy loading for guests as they cant create filters
   [\#748](https://github.com/matrix-org/matrix-js-sdk/pull/748)
 * Revert "Add getMediaLimits to client"
   [\#745](https://github.com/matrix-org/matrix-js-sdk/pull/745)

Changes in [0.11.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.11.1) (2018-10-01)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.11.1-rc.1...v0.11.1)

 * No changes since rc.1

Changes in [0.11.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.11.1-rc.1) (2018-09-27)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.11.0...v0.11.1-rc.1)

 * make usage of hub compatible with latest version (2.5)
   [\#747](https://github.com/matrix-org/matrix-js-sdk/pull/747)
 * Detect when lazy loading has been toggled in client.startClient
   [\#746](https://github.com/matrix-org/matrix-js-sdk/pull/746)
 * Add getMediaLimits to client
   [\#644](https://github.com/matrix-org/matrix-js-sdk/pull/644)
 * Split npm start into an init and watch script
   [\#742](https://github.com/matrix-org/matrix-js-sdk/pull/742)
 * Revert "room name should only take canonical alias into account"
   [\#738](https://github.com/matrix-org/matrix-js-sdk/pull/738)
 * fix display name disambiguation with LL
   [\#737](https://github.com/matrix-org/matrix-js-sdk/pull/737)
 * Introduce Room.myMembership event
   [\#735](https://github.com/matrix-org/matrix-js-sdk/pull/735)
 * room name should only take canonical alias into account
   [\#733](https://github.com/matrix-org/matrix-js-sdk/pull/733)
 * state events from context response were not wrapped in a MatrixEvent
   [\#732](https://github.com/matrix-org/matrix-js-sdk/pull/732)
 * Reduce amount of promises created when inserting members
   [\#724](https://github.com/matrix-org/matrix-js-sdk/pull/724)
 * dont wait for LL members to be stored to resolve the members
   [\#726](https://github.com/matrix-org/matrix-js-sdk/pull/726)
 * RoomState.members emitted with wrong argument order for OOB members
   [\#728](https://github.com/matrix-org/matrix-js-sdk/pull/728)

Changes in [0.11.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.11.0) (2018-09-10)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.11.0-rc.1...v0.11.0)

BREAKING CHANGES
----------------
 * v0.11.0-rc.1 introduced some breaking changes - see the respective release notes.

No changes since rc.1

Changes in [0.11.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.11.0-rc.1) (2018-09-07)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.9...v0.11.0-rc.1)

 * Support for lazy loading members. This should improve performance for
   users who joined big rooms a lot. Pass to `lazyLoadMembers = true` option when calling `startClient`.

BREAKING CHANGES
----------------

 * `MatrixClient::startClient` now returns a Promise. No method should be called on the client before that promise resolves. Before this method didn't return anything.
 * A new `CATCHUP` sync state, emitted by `MatrixClient#"sync"` and returned by `MatrixClient::getSyncState()`, when doing initial sync after the `ERROR` state. See `MatrixClient` documentation for details.
 * `RoomState::maySendEvent('m.room.message', userId)` & `RoomState::maySendMessage(userId)` do not check the membership of the user anymore, only the power level. To check if the syncing user is allowed to write in a room, use `Room::maySendMessage()` as `RoomState` is not always aware of the syncing user's membership anymore, in case lazy loading of members is enabled.

All Changes
-----------

 * Only emit CATCHUP if recovering from conn error
   [\#727](https://github.com/matrix-org/matrix-js-sdk/pull/727)
 * Fix docstring for sync data.error
   [\#725](https://github.com/matrix-org/matrix-js-sdk/pull/725)
 * Re-apply "Don't rely on members to query if syncing user can post to room"
   [\#723](https://github.com/matrix-org/matrix-js-sdk/pull/723)
 * Revert "Don't rely on members to query if syncing user can post to room"
   [\#721](https://github.com/matrix-org/matrix-js-sdk/pull/721)
 * Don't rely on members to query if syncing user can post to room
   [\#717](https://github.com/matrix-org/matrix-js-sdk/pull/717)
 * Fixes for room.guessDMUserId
   [\#719](https://github.com/matrix-org/matrix-js-sdk/pull/719)
 * Fix filepanel also filtering main timeline with LL turned on.
   [\#716](https://github.com/matrix-org/matrix-js-sdk/pull/716)
 * Remove lazy loaded members when leaving room
   [\#711](https://github.com/matrix-org/matrix-js-sdk/pull/711)
 * Fix: show spinner again while recovering from connection error
   [\#702](https://github.com/matrix-org/matrix-js-sdk/pull/702)
 * Add method to query LL state in client
   [\#714](https://github.com/matrix-org/matrix-js-sdk/pull/714)
 * Fix: also load invited members when lazy loading members
   [\#707](https://github.com/matrix-org/matrix-js-sdk/pull/707)
 * Pass through function to discard megolm session
   [\#704](https://github.com/matrix-org/matrix-js-sdk/pull/704)

Changes in [0.10.9](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.9) (2018-09-03)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.9-rc.2...v0.10.9)

 * No changes since rc.2

Changes in [0.10.9-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.9-rc.2) (2018-08-31)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.9-rc.1...v0.10.9-rc.2)

 * Fix for "otherMember.getAvatarUrl is not a function"
   [\#708](https://github.com/matrix-org/matrix-js-sdk/pull/708)

Changes in [0.10.9-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.9-rc.1) (2018-08-30)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.8...v0.10.9-rc.1)

 * Fix DM avatar
   [\#706](https://github.com/matrix-org/matrix-js-sdk/pull/706)
 * Lazy loading: avoid loading members at initial sync for e2e rooms
   [\#699](https://github.com/matrix-org/matrix-js-sdk/pull/699)
 * Improve setRoomEncryption guard against multiple m.room.encryption st…
   [\#700](https://github.com/matrix-org/matrix-js-sdk/pull/700)
 * Revert "Lazy loading: don't block on setting up room crypto"
   [\#698](https://github.com/matrix-org/matrix-js-sdk/pull/698)
 * Lazy loading: don't block on setting up room crypto
   [\#696](https://github.com/matrix-org/matrix-js-sdk/pull/696)
 * Add getVisibleRooms()
   [\#695](https://github.com/matrix-org/matrix-js-sdk/pull/695)
 * Add wrapper around getJoinedMemberCount()
   [\#697](https://github.com/matrix-org/matrix-js-sdk/pull/697)
 * Api to fetch events via /room/.../event/..
   [\#694](https://github.com/matrix-org/matrix-js-sdk/pull/694)
 * Support for room upgrades
   [\#693](https://github.com/matrix-org/matrix-js-sdk/pull/693)
 * Lazy loading of room members
   [\#691](https://github.com/matrix-org/matrix-js-sdk/pull/691)

Changes in [0.10.8](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.8) (2018-08-20)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.8-rc.1...v0.10.8)

 * No changes since rc.1

Changes in [0.10.8-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.8-rc.1) (2018-08-16)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.7...v0.10.8-rc.1)

 * Add getVersion to Room
   [\#689](https://github.com/matrix-org/matrix-js-sdk/pull/689)
 * Add getSyncStateData()
   [\#680](https://github.com/matrix-org/matrix-js-sdk/pull/680)
 * Send sync error to listener
   [\#679](https://github.com/matrix-org/matrix-js-sdk/pull/679)
 * make sure room.tags is always a valid object to avoid crashes
   [\#675](https://github.com/matrix-org/matrix-js-sdk/pull/675)
 * Fix infinite spinner upon joining a room
   [\#673](https://github.com/matrix-org/matrix-js-sdk/pull/673)

Changes in [0.10.7](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.7) (2018-07-30)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.7-rc.1...v0.10.7)

 * No changes since rc.1

Changes in [0.10.7-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.7-rc.1) (2018-07-24)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.6...v0.10.7-rc.1)

 * encrypt for invited users if history visibility allows.
   [\#666](https://github.com/matrix-org/matrix-js-sdk/pull/666)

Changes in [0.10.6](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.6) (2018-07-09)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.6-rc.1...v0.10.6)

 * No changes since rc.1

Changes in [0.10.6-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.6-rc.1) (2018-07-06)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.5...v0.10.6-rc.1)

 * Expose event decryption error via Event.decrypted event
   [\#665](https://github.com/matrix-org/matrix-js-sdk/pull/665)
 * Add decryption error codes to base.DecryptionError
   [\#663](https://github.com/matrix-org/matrix-js-sdk/pull/663)

Changes in [0.10.5](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.5) (2018-06-29)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.5-rc.1...v0.10.5)

 * No changes since rc.1

Changes in [0.10.5-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.5-rc.1) (2018-06-21)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.4...v0.10.5-rc.1)

 * fix auth header and filename=undefined
   [\#659](https://github.com/matrix-org/matrix-js-sdk/pull/659)
 * allow setting the output device for webrtc calls
   [\#650](https://github.com/matrix-org/matrix-js-sdk/pull/650)
 * arguments true and false are actually invalid
   [\#596](https://github.com/matrix-org/matrix-js-sdk/pull/596)
 * fix typo where `headers` was not being used and thus sent wrong content-type
   [\#643](https://github.com/matrix-org/matrix-js-sdk/pull/643)
 * fix some documentation typos
   [\#642](https://github.com/matrix-org/matrix-js-sdk/pull/642)

Changes in [0.10.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.4) (2018-06-12)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.4-rc.1...v0.10.4)

 * No changes since rc.1

Changes in [0.10.4-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.4-rc.1) (2018-06-06)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.3...v0.10.4-rc.1)

 * check whether notif level is undefined, because `0` is falsey
   [\#651](https://github.com/matrix-org/matrix-js-sdk/pull/651)

Changes in [0.10.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.3) (2018-05-25)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.3-rc.1...v0.10.3)

 * No changes since v0.10.3-rc.1

Changes in [0.10.3-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.3-rc.1) (2018-05-24)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.2...v0.10.3-rc.1)

BREAKING CHANGE
---------------

The deprecated 'callback' parameter has been removed from MatrixBaseApis.deactivateAccount

 * Add `erase` option to deactivateAccount
   [\#649](https://github.com/matrix-org/matrix-js-sdk/pull/649)
 * Emit Session.no_consent when M_CONSENT_NOT_GIVEN received
   [\#647](https://github.com/matrix-org/matrix-js-sdk/pull/647)

Changes in [0.10.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.2) (2018-04-30)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.2-rc.1...v0.10.2)

 * No changes from rc.1

Changes in [0.10.2-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.2-rc.1) (2018-04-25)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.1...v0.10.2-rc.1)

 * Ignore inserts of dup inbound group sessions, pt 2
   [\#641](https://github.com/matrix-org/matrix-js-sdk/pull/641)
 * Ignore inserts of duplicate inbound group sessions
   [\#639](https://github.com/matrix-org/matrix-js-sdk/pull/639)
 * Log IDB errors
   [\#638](https://github.com/matrix-org/matrix-js-sdk/pull/638)
 * Remove not very useful but veryv spammy log line
   [\#632](https://github.com/matrix-org/matrix-js-sdk/pull/632)
 * Switch event type to m.sticker.
   [\#628](https://github.com/matrix-org/matrix-js-sdk/pull/628)

Changes in [0.10.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.1) (2018-04-12)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.0...v0.10.1)

 * Log IDB errors
   [\#638](https://github.com/matrix-org/matrix-js-sdk/pull/638)
 * Ignore inserts of duplicate inbound group sessions
   [\#639](https://github.com/matrix-org/matrix-js-sdk/pull/639)
 * Ignore inserts of dup inbound group sessions, pt 2
   [\#641](https://github.com/matrix-org/matrix-js-sdk/pull/641)

Changes in [0.10.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.0) (2018-04-11)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.0-rc.2...v0.10.0)

 * No changes

Changes in [0.10.0-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.0-rc.2) (2018-04-09)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.10.0-rc.1...v0.10.0-rc.2)

 * Add wrapper for group join API
 * Add wrapped API to set group join\_policy

Changes in [0.10.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.10.0-rc.1) (2018-03-19)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.9.2...v0.10.0-rc.1)

 * Fix duplicated state events in timeline from peek
   [\#630](https://github.com/matrix-org/matrix-js-sdk/pull/630)
 * Create indexeddb worker when starting the store
   [\#627](https://github.com/matrix-org/matrix-js-sdk/pull/627)
 * Fix indexeddb logging
   [\#626](https://github.com/matrix-org/matrix-js-sdk/pull/626)
 * Don't do /keys/changes on incremental sync
   [\#625](https://github.com/matrix-org/matrix-js-sdk/pull/625)
 * Don't mark devicelist dirty unnecessarily
   [\#623](https://github.com/matrix-org/matrix-js-sdk/pull/623)
 * Cache the joined member count for a room state
   [\#619](https://github.com/matrix-org/matrix-js-sdk/pull/619)
 * Fix JS doc
   [\#618](https://github.com/matrix-org/matrix-js-sdk/pull/618)
 * Precompute push actions for state events
   [\#617](https://github.com/matrix-org/matrix-js-sdk/pull/617)
 * Fix bug where global "Never send to unverified..." is ignored
   [\#616](https://github.com/matrix-org/matrix-js-sdk/pull/616)
 * Intern legacy top-level 'membership' field
   [\#615](https://github.com/matrix-org/matrix-js-sdk/pull/615)
 * Don't synthesize RR for m.room.redaction as causes the RR to go missing.
   [\#598](https://github.com/matrix-org/matrix-js-sdk/pull/598)
 * Make Events create Dates on demand
   [\#613](https://github.com/matrix-org/matrix-js-sdk/pull/613)
 * Stop cloning events when adding to state
   [\#612](https://github.com/matrix-org/matrix-js-sdk/pull/612)
 * De-dup code: use the initialiseState function
   [\#611](https://github.com/matrix-org/matrix-js-sdk/pull/611)
 * Create sentinel members on-demand
   [\#610](https://github.com/matrix-org/matrix-js-sdk/pull/610)
 * Some more doc on how sentinels work
   [\#609](https://github.com/matrix-org/matrix-js-sdk/pull/609)
 * Migrate room encryption store to crypto store
   [\#597](https://github.com/matrix-org/matrix-js-sdk/pull/597)
 * add parameter to getIdentityServerUrl to strip the protocol for invites
   [\#600](https://github.com/matrix-org/matrix-js-sdk/pull/600)
 * Move Device Tracking Data to Crypto Store
   [\#594](https://github.com/matrix-org/matrix-js-sdk/pull/594)
 * Optimise pushprocessor
   [\#591](https://github.com/matrix-org/matrix-js-sdk/pull/591)
 * Set event error before emitting
   [\#592](https://github.com/matrix-org/matrix-js-sdk/pull/592)
 * Add event type for stickers [WIP]
   [\#590](https://github.com/matrix-org/matrix-js-sdk/pull/590)
 * Migrate inbound sessions to cryptostore
   [\#587](https://github.com/matrix-org/matrix-js-sdk/pull/587)
 * Disambiguate names if they contain an mxid
   [\#588](https://github.com/matrix-org/matrix-js-sdk/pull/588)
 * Check for sessions in indexeddb before migrating
   [\#585](https://github.com/matrix-org/matrix-js-sdk/pull/585)
 * Emit an event for crypto store migration
   [\#586](https://github.com/matrix-org/matrix-js-sdk/pull/586)
 * Supporting fixes For making UnknownDeviceDialog not pop up automatically
   [\#575](https://github.com/matrix-org/matrix-js-sdk/pull/575)
 * Move sessions to the crypto store
   [\#584](https://github.com/matrix-org/matrix-js-sdk/pull/584)
 * Change crypto store transaction API
   [\#582](https://github.com/matrix-org/matrix-js-sdk/pull/582)
 * Add some missed copyright notices
   [\#581](https://github.com/matrix-org/matrix-js-sdk/pull/581)
 * Move Olm account to IndexedDB
   [\#579](https://github.com/matrix-org/matrix-js-sdk/pull/579)
 * Fix logging of DecryptionErrors to be more useful
   [\#580](https://github.com/matrix-org/matrix-js-sdk/pull/580)
 * [BREAKING] Change the behaviour of the unverfied devices blacklist flag
   [\#568](https://github.com/matrix-org/matrix-js-sdk/pull/568)
 * Support set_presence=offline for syncing
   [\#557](https://github.com/matrix-org/matrix-js-sdk/pull/557)
 * Consider cases where the sender may not redact their own event
   [\#556](https://github.com/matrix-org/matrix-js-sdk/pull/556)

Changes in [0.9.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.9.2) (2017-12-04)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.9.1...v0.9.2)


Changes in [0.9.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.9.1) (2017-11-17)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.9.0...v0.9.1)

 * Fix the force TURN option
   [\#577](https://github.com/matrix-org/matrix-js-sdk/pull/577)

Changes in [0.9.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.9.0) (2017-11-15)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.9.0-rc.1...v0.9.0)


Changes in [0.9.0-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.9.0-rc.1) (2017-11-10)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.5...v0.9.0-rc.1)

 * Modify addRoomToGroup to allow setting isPublic, create alias
   updateGroupRoomAssociation
   [\#567](https://github.com/matrix-org/matrix-js-sdk/pull/567)
 * Expose more functionality of pushprocessor
   [\#565](https://github.com/matrix-org/matrix-js-sdk/pull/565)
 * Function for working out notif trigger permission
   [\#566](https://github.com/matrix-org/matrix-js-sdk/pull/566)
 * keep track of event ID and timestamp of decrypted messages
   [\#555](https://github.com/matrix-org/matrix-js-sdk/pull/555)
 * Fix notifEvent computation
   [\#564](https://github.com/matrix-org/matrix-js-sdk/pull/564)
 * Fix power level of sentinel members
   [\#563](https://github.com/matrix-org/matrix-js-sdk/pull/563)
 * don't try to decrypt a redacted message (fixes vector-im/riot-web#3744)
   [\#554](https://github.com/matrix-org/matrix-js-sdk/pull/554)
 * Support room notifs
   [\#562](https://github.com/matrix-org/matrix-js-sdk/pull/562)
 * Fix the glob-to-regex code
   [\#558](https://github.com/matrix-org/matrix-js-sdk/pull/558)

Changes in [0.8.5](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.5) (2017-10-16)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.5-rc.1...v0.8.5)

 * Make unknown pushrule conditions not match
   [\#559](https://github.com/matrix-org/matrix-js-sdk/pull/559)

Changes in [0.8.5-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.5-rc.1) (2017-10-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.4...v0.8.5-rc.1)

 * Implement wrapper API for removing a room from a group
   [\#553](https://github.com/matrix-org/matrix-js-sdk/pull/553)
 * Fix typo which resulted in stuck key download requests
   [\#552](https://github.com/matrix-org/matrix-js-sdk/pull/552)
 * Store group when it's created
   [\#549](https://github.com/matrix-org/matrix-js-sdk/pull/549)
 * Luke/groups remove rooms users from summary
   [\#548](https://github.com/matrix-org/matrix-js-sdk/pull/548)
 * Clean on prepublish
   [\#546](https://github.com/matrix-org/matrix-js-sdk/pull/546)
 * Implement wrapper APIs for adding rooms to group summary
   [\#545](https://github.com/matrix-org/matrix-js-sdk/pull/545)

Changes in [0.8.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.4) (2017-09-21)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.3...v0.8.4)

 * Fix build issue

Changes in [0.8.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.3) (2017-09-20)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.3-rc.1...v0.8.3)

 * No changes

Changes in [0.8.3-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.3-rc.1) (2017-09-19)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.2...v0.8.3-rc.1)

 * consume trailing slash when creating Matrix Client in HS and IS urls
   [\#526](https://github.com/matrix-org/matrix-js-sdk/pull/526)
 * Add ignore users API
   [\#539](https://github.com/matrix-org/matrix-js-sdk/pull/539)
 * Upgrade to jsdoc 3.5.5
   [\#540](https://github.com/matrix-org/matrix-js-sdk/pull/540)
 * Make re-emitting events much more memory efficient
   [\#538](https://github.com/matrix-org/matrix-js-sdk/pull/538)
 * Only re-emit events from Event objects if needed
   [\#536](https://github.com/matrix-org/matrix-js-sdk/pull/536)
 * Handle 'left' users in the deviceList mananagement
   [\#535](https://github.com/matrix-org/matrix-js-sdk/pull/535)
 * Factor out devicelist integration tests to a separate file
   [\#534](https://github.com/matrix-org/matrix-js-sdk/pull/534)
 * Refactor sync._sync as an async function
   [\#533](https://github.com/matrix-org/matrix-js-sdk/pull/533)
 * Add es6 to eslint environments
   [\#532](https://github.com/matrix-org/matrix-js-sdk/pull/532)

Changes in [0.8.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.2) (2017-08-24)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.1...v0.8.2)

 * Handle m.call.* events which are decrypted asynchronously
   [\#530](https://github.com/matrix-org/matrix-js-sdk/pull/530)
 * Re-emit events from, er, Event objects
   [\#529](https://github.com/matrix-org/matrix-js-sdk/pull/529)

Changes in [0.8.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.1) (2017-08-23)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.1-rc.1...v0.8.1)

 * [No changes]

Changes in [0.8.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.1-rc.1) (2017-08-22)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.8.0...v0.8.1-rc.1)

 * Fix error handling in interactive-auth
   [\#527](https://github.com/matrix-org/matrix-js-sdk/pull/527)
 * Make lots of OlmDevice asynchronous
   [\#524](https://github.com/matrix-org/matrix-js-sdk/pull/524)
 * Make crypto.decryptMessage return decryption results
   [\#523](https://github.com/matrix-org/matrix-js-sdk/pull/523)

Changes in [0.8.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.8.0) (2017-08-15)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.13...v0.8.0)

BREAKING CHANGE
---------------

In order to support a move to a more scalable storage backend, we need to make
a number of the APIs related end-to-end encryption asynchronous.

This release of the JS-SDK includes the following changes which will affect
applications which support end-to-end encryption:

1. `MatrixClient` now provides a new (asynchronous) method,
   `initCrypto`. Applications which support end-to-end encryption must call
   this method (and wait for it to complete) before calling `startClient`, to
   give the crypto layer a chance to initialise.

2. The following APIs have been changed to return promises:

   * `MatrixClient.getStoredDevicesForUser`
   * `MatrixClient.getStoredDevice`
   * `MatrixClient.setDeviceVerified`
   * `MatrixClient.setDeviceBlocked`
   * `MatrixClient.setDeviceKnown`
   * `MatrixClient.getEventSenderDeviceInfo`
   * `MatrixClient.isEventSenderVerified`
   * `MatrixClient.importRoomKeys`

   Applications using the results of any of the above methods will need to be
   updated to wait for the result of the promise.


3. `MatrixClient.listDeviceKeys` has been removed altogether. It's been
   deprecated for some time. Applications using it should instead be changed to
   use `MatrixClient.getStoredDevices`, which is similar but returns its results
   in a slightly different format.


 * Make bits of `olmlib` asynchronous
   [\#521](https://github.com/matrix-org/matrix-js-sdk/pull/521)
 * Make some of DeviceList asynchronous
   [\#520](https://github.com/matrix-org/matrix-js-sdk/pull/520)
 * Make methods in crypto/algorithms async
   [\#519](https://github.com/matrix-org/matrix-js-sdk/pull/519)
 * Avoid sending unencrypted messages in e2e room
   [\#518](https://github.com/matrix-org/matrix-js-sdk/pull/518)
 * Make tests wait for syncs to happen
   [\#517](https://github.com/matrix-org/matrix-js-sdk/pull/517)
 * Make a load of methods in the 'Crypto' module asynchronous
   [\#510](https://github.com/matrix-org/matrix-js-sdk/pull/510)
 * Set `rawDisplayName` to `userId` if membership has `displayname=null`
   [\#515](https://github.com/matrix-org/matrix-js-sdk/pull/515)
 * Refactor handling of crypto events for async
   [\#508](https://github.com/matrix-org/matrix-js-sdk/pull/508)
 * Let event decryption be asynchronous
   [\#509](https://github.com/matrix-org/matrix-js-sdk/pull/509)
 * Transform `async` functions to bluebird promises
   [\#511](https://github.com/matrix-org/matrix-js-sdk/pull/511)
 * Add more group APIs
   [\#512](https://github.com/matrix-org/matrix-js-sdk/pull/512)
 * Retrying test: wait for localEchoUpdated event
   [\#507](https://github.com/matrix-org/matrix-js-sdk/pull/507)
 * Fix member events breaking on timeline reset, 2
   [\#504](https://github.com/matrix-org/matrix-js-sdk/pull/504)
 * Make bits of the js-sdk api asynchronous
   [\#503](https://github.com/matrix-org/matrix-js-sdk/pull/503)
 * Yet more js-sdk test deflakification
   [\#499](https://github.com/matrix-org/matrix-js-sdk/pull/499)
 * Fix racy 'matrixclient retrying' test
   [\#497](https://github.com/matrix-org/matrix-js-sdk/pull/497)
 * Fix spamming of key-share-requests
   [\#495](https://github.com/matrix-org/matrix-js-sdk/pull/495)
 * Add progress handler to `uploadContent`
   [\#500](https://github.com/matrix-org/matrix-js-sdk/pull/500)
 * Switch matrix-js-sdk to bluebird
   [\#490](https://github.com/matrix-org/matrix-js-sdk/pull/490)
 * Fix some more flakey tests
   [\#492](https://github.com/matrix-org/matrix-js-sdk/pull/492)
 * make the npm test script windows-friendly
   [\#489](https://github.com/matrix-org/matrix-js-sdk/pull/489)
 * Fix a bunch of races in the tests
   [\#488](https://github.com/matrix-org/matrix-js-sdk/pull/488)
 * Fix early return in MatrixClient.setGuestAccess
   [\#487](https://github.com/matrix-org/matrix-js-sdk/pull/487)
 * Remove testUtils.failTest
   [\#486](https://github.com/matrix-org/matrix-js-sdk/pull/486)
 * Add test:watch script
   [\#485](https://github.com/matrix-org/matrix-js-sdk/pull/485)
 * Make it possible to use async/await
   [\#484](https://github.com/matrix-org/matrix-js-sdk/pull/484)
 * Remove m.new_device support
   [\#483](https://github.com/matrix-org/matrix-js-sdk/pull/483)
 * Use access-token in header
   [\#478](https://github.com/matrix-org/matrix-js-sdk/pull/478)
 * Sanity-check response from /thirdparty/protocols
   [\#482](https://github.com/matrix-org/matrix-js-sdk/pull/482)
 * Avoid parsing plain-text errors as JSON
   [\#479](https://github.com/matrix-org/matrix-js-sdk/pull/479)
 * Use external mock-request
   [\#481](https://github.com/matrix-org/matrix-js-sdk/pull/481)
 * Fix some races in the tests
   [\#480](https://github.com/matrix-org/matrix-js-sdk/pull/480)
 * Fall back to MemoryCryptoStore if indexeddb fails
   [\#475](https://github.com/matrix-org/matrix-js-sdk/pull/475)
 * Fix load failure in firefox when indexedDB is disabled
   [\#474](https://github.com/matrix-org/matrix-js-sdk/pull/474)
 * Fix a race in a test
   [\#471](https://github.com/matrix-org/matrix-js-sdk/pull/471)
 * Avoid throwing an unhandled error when the indexeddb is deleted
   [\#470](https://github.com/matrix-org/matrix-js-sdk/pull/470)
 * fix jsdoc
   [\#469](https://github.com/matrix-org/matrix-js-sdk/pull/469)
 * Handle m.forwarded_room_key events
   [\#468](https://github.com/matrix-org/matrix-js-sdk/pull/468)
 * Improve error reporting from indexeddbstore.clearDatabase
   [\#466](https://github.com/matrix-org/matrix-js-sdk/pull/466)
 * Implement sharing of megolm keys
   [\#454](https://github.com/matrix-org/matrix-js-sdk/pull/454)
 * Process received room key requests
   [\#449](https://github.com/matrix-org/matrix-js-sdk/pull/449)
 * Send m.room_key_request events when we fail to decrypt an event
   [\#448](https://github.com/matrix-org/matrix-js-sdk/pull/448)

Changes in [0.7.13](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.13) (2017-06-22)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.12...v0.7.13)

 * Fix failure on Tor browser
   [\#473](https://github.com/matrix-org/matrix-js-sdk/pull/473)
 * Fix issues with firefox private browsing
   [\#472](https://github.com/matrix-org/matrix-js-sdk/pull/472)

Changes in [0.7.12](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.12) (2017-06-19)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.12-rc.1...v0.7.12)

 * No changes


Changes in [0.7.12-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.12-rc.1) (2017-06-15)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.11...v0.7.12-rc.1)

 * allow setting iceTransportPolicy to relay through forceTURN option
   [\#462](https://github.com/matrix-org/matrix-js-sdk/pull/462)

Changes in [0.7.11](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.11) (2017-06-12)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.11-rc.1...v0.7.11)

 * Add a bunch of logging around sending messages
   [\#460](https://github.com/matrix-org/matrix-js-sdk/pull/460)

Changes in [0.7.11-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.11-rc.1) (2017-06-09)
============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.10...v0.7.11-rc.1)

 * Make TimelineWindow.load resolve quicker if we have the events
   [\#458](https://github.com/matrix-org/matrix-js-sdk/pull/458)
 * Stop peeking when a matrix client is stopped
   [\#451](https://github.com/matrix-org/matrix-js-sdk/pull/451)
 * Update README: Clarify how to install libolm
   [\#450](https://github.com/matrix-org/matrix-js-sdk/pull/450)

Changes in [0.7.10](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.10) (2017-06-02)
==================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.9...v0.7.10)

 * BREAKING CHANGE: The SDK no longer ``require``s ``olm`` - instead it expects
   libolm to be provided as an ``Olm`` global. This will only affect
   applications which use end-to-end encryption. See the
   [README](README.md#end-to-end-encryption-support) for details.

 * indexeddb-crypto-store: fix db deletion
   [\#447](https://github.com/matrix-org/matrix-js-sdk/pull/447)
 * Load Olm from the global rather than requiring it.
   [\#446](https://github.com/matrix-org/matrix-js-sdk/pull/446)

Changes in [0.7.9](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.9) (2017-06-01)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.8...v0.7.9)

 * Initial framework for indexeddb-backed crypto store
   [\#445](https://github.com/matrix-org/matrix-js-sdk/pull/445)
 * Factor out reEmit to a common module
   [\#444](https://github.com/matrix-org/matrix-js-sdk/pull/444)
 * crypto/algorithms/base.js: Convert to es6
   [\#443](https://github.com/matrix-org/matrix-js-sdk/pull/443)
 * maySendRedactionForEvent for userId
   [\#435](https://github.com/matrix-org/matrix-js-sdk/pull/435)
 * MatrixClient: add getUserId()
   [\#441](https://github.com/matrix-org/matrix-js-sdk/pull/441)
 * Run jsdoc on a custom babeling of the source
   [\#442](https://github.com/matrix-org/matrix-js-sdk/pull/442)
 * Add in a public api getStoredDevice allowing clients to get a specific
   device
   [\#439](https://github.com/matrix-org/matrix-js-sdk/pull/439)

Changes in [0.7.8](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.8) (2017-05-22)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.8-rc.1...v0.7.8)

 * No changes


Changes in [0.7.8-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.8-rc.1) (2017-05-19)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.7...v0.7.8-rc.1)

 * Attempt to rework the release-tarball-signing stuff
   [\#438](https://github.com/matrix-org/matrix-js-sdk/pull/438)
 * ability to specify webrtc audio/video inputs for the lib to request
   [\#427](https://github.com/matrix-org/matrix-js-sdk/pull/427)
 * make screen sharing call FF friendly :D
   [\#434](https://github.com/matrix-org/matrix-js-sdk/pull/434)
 * Fix race in device list updates
   [\#431](https://github.com/matrix-org/matrix-js-sdk/pull/431)
 * WebRTC: Support recvonly for video for those without a webcam
   [\#424](https://github.com/matrix-org/matrix-js-sdk/pull/424)
 * Update istanbul to remove minimatch DoS Warning
   [\#422](https://github.com/matrix-org/matrix-js-sdk/pull/422)
 * webrtc/call: Make it much less likely that callIds collide locally
   [\#423](https://github.com/matrix-org/matrix-js-sdk/pull/423)
 * Automatically complete dummy auth
   [\#420](https://github.com/matrix-org/matrix-js-sdk/pull/420)
 * Don't leave the gh-pages branch checked out
   [\#418](https://github.com/matrix-org/matrix-js-sdk/pull/418)

Changes in [0.7.7](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.7) (2017-04-25)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.7-rc.1...v0.7.7)

 * No changes


Changes in [0.7.7-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.7-rc.1) (2017-04-21)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.6...v0.7.7-rc.1)

 * Automatically complete dummy auth
   [\#420](https://github.com/matrix-org/matrix-js-sdk/pull/420)


Changes in [0.7.6](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.6) (2017-04-12)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.6-rc.2...v0.7.6)

 * No changes

Changes in [0.7.6-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.6-rc.2) (2017-04-10)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.6-rc.1...v0.7.6-rc.2)

 * Add feature detection for webworkers
   [\#416](https://github.com/matrix-org/matrix-js-sdk/pull/416)
 * Fix release script
   [\#415](https://github.com/matrix-org/matrix-js-sdk/pull/415)

Changes in [0.7.6-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.6-rc.1) (2017-04-07)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.5...v0.7.6-rc.1)

 * Make indexeddb save after the first sync
   [\#414](https://github.com/matrix-org/matrix-js-sdk/pull/414)
 * Make indexeddb startup faster
   [\#413](https://github.com/matrix-org/matrix-js-sdk/pull/413)
 * Add ability to do indexeddb sync work in webworker
   [\#412](https://github.com/matrix-org/matrix-js-sdk/pull/412)
 * Move more functionality to the indexeddb backend
   [\#409](https://github.com/matrix-org/matrix-js-sdk/pull/409)
 * Indicate syncState ERROR after many failed /syncs
   [\#410](https://github.com/matrix-org/matrix-js-sdk/pull/410)
 * Further reorganising of indexeddb sync code
   [\#407](https://github.com/matrix-org/matrix-js-sdk/pull/407)
 * Change interface of IndexedDBStore: hide internals
   [\#406](https://github.com/matrix-org/matrix-js-sdk/pull/406)
 * Don't be SYNCING until updating from the server
   [\#405](https://github.com/matrix-org/matrix-js-sdk/pull/405)
 * Don't log the entire /sync response
   [\#403](https://github.com/matrix-org/matrix-js-sdk/pull/403)
 * webrtc/call: Assign MediaStream to video element srcObject
   [\#402](https://github.com/matrix-org/matrix-js-sdk/pull/402)
 * Fix undefined reference in http-api
   [\#400](https://github.com/matrix-org/matrix-js-sdk/pull/400)
 * Add copyright header to event-timeline.js
   [\#382](https://github.com/matrix-org/matrix-js-sdk/pull/382)
 * client: fix docs for user-scoped account_data events
   [\#397](https://github.com/matrix-org/matrix-js-sdk/pull/397)
 * Add a CONTRIBUTING for js-sdk
   [\#399](https://github.com/matrix-org/matrix-js-sdk/pull/399)
 * Fix leaking room state objects on limited sync responses
   [\#395](https://github.com/matrix-org/matrix-js-sdk/pull/395)
 * Extend 'ignoreFailure' to be 'background'
   [\#396](https://github.com/matrix-org/matrix-js-sdk/pull/396)
 * Add x_show_msisdn parameter to register calls
   [\#388](https://github.com/matrix-org/matrix-js-sdk/pull/388)
 * Update event redaction to keep sender and origin_server_ts
   [\#394](https://github.com/matrix-org/matrix-js-sdk/pull/394)
 * Handle 'limited' timeline responses in the SyncAccumulator
   [\#393](https://github.com/matrix-org/matrix-js-sdk/pull/393)
 * Give a better error message if the HS doesn't support msisdn registeration
   [\#391](https://github.com/matrix-org/matrix-js-sdk/pull/391)
 * Add getEmailSid
   [\#383](https://github.com/matrix-org/matrix-js-sdk/pull/383)
 * Add m.login.email.identity support to UI auth
   [\#380](https://github.com/matrix-org/matrix-js-sdk/pull/380)
 * src/client.js: Fix incorrect roomId reference in VoIP glare code
   [\#381](https://github.com/matrix-org/matrix-js-sdk/pull/381)
 * add .editorconfig
   [\#379](https://github.com/matrix-org/matrix-js-sdk/pull/379)
 * Store account data in the same way as room data
   [\#377](https://github.com/matrix-org/matrix-js-sdk/pull/377)
 * Upload one-time keys on /sync rather than a timer
   [\#376](https://github.com/matrix-org/matrix-js-sdk/pull/376)
 * Increase the WRITE_DELAY on database syncing
   [\#374](https://github.com/matrix-org/matrix-js-sdk/pull/374)
 * Make deleteAllData() return a Promise
   [\#373](https://github.com/matrix-org/matrix-js-sdk/pull/373)
 * Don't include banned users in the room name
   [\#372](https://github.com/matrix-org/matrix-js-sdk/pull/372)
 * Support IndexedDB as a backing store
   [\#363](https://github.com/matrix-org/matrix-js-sdk/pull/363)
 * Poll /sync with a short timeout while catching up
   [\#370](https://github.com/matrix-org/matrix-js-sdk/pull/370)
 * Make test coverage work again
   [\#368](https://github.com/matrix-org/matrix-js-sdk/pull/368)
 * Add docs to event
   [\#367](https://github.com/matrix-org/matrix-js-sdk/pull/367)
 * Keep the device-sync token more up-to-date
   [\#366](https://github.com/matrix-org/matrix-js-sdk/pull/366)
 * Fix race conditions in device list download
   [\#365](https://github.com/matrix-org/matrix-js-sdk/pull/365)
 * Fix the unban method
   [\#364](https://github.com/matrix-org/matrix-js-sdk/pull/364)
 * Spread out device verification work
   [\#362](https://github.com/matrix-org/matrix-js-sdk/pull/362)
 * Clean up/improve e2e logging
   [\#361](https://github.com/matrix-org/matrix-js-sdk/pull/361)
 * Fix decryption of events whose key arrives later
   [\#360](https://github.com/matrix-org/matrix-js-sdk/pull/360)
 * Invalidate device lists when encryption is enabled in a room
   [\#359](https://github.com/matrix-org/matrix-js-sdk/pull/359)
 * Switch from jasmine to mocha + expect + lolex
   [\#358](https://github.com/matrix-org/matrix-js-sdk/pull/358)
 * Install source-map-support in each test
   [\#356](https://github.com/matrix-org/matrix-js-sdk/pull/356)
 * searchMessageText: avoid setting keys=undefined
   [\#357](https://github.com/matrix-org/matrix-js-sdk/pull/357)
 * realtime-callbacks: pass `global` as `this`
   [\#355](https://github.com/matrix-org/matrix-js-sdk/pull/355)
 * Make the tests work without olm
   [\#354](https://github.com/matrix-org/matrix-js-sdk/pull/354)
 * Tests: Factor out TestClient and use it in crypto tests
   [\#353](https://github.com/matrix-org/matrix-js-sdk/pull/353)
 * Fix some lint
   [\#352](https://github.com/matrix-org/matrix-js-sdk/pull/352)
 * Make a sig for source tarballs when releasing
   [\#351](https://github.com/matrix-org/matrix-js-sdk/pull/351)
 * When doing a pre-release, don't bother merging to master and develop.
   [\#350](https://github.com/matrix-org/matrix-js-sdk/pull/350)

Changes in [0.7.5](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.5) (2017-02-04)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.5-rc.3...v0.7.5)

No changes from 0.7.5-rc.3

Changes in [0.7.5-rc.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.5-rc.3) (2017-02-03)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.5-rc.2...v0.7.5-rc.3)

 * Include DeviceInfo in deviceVerificationChanged events
   [a3cc8eb](https://github.com/matrix-org/matrix-js-sdk/commit/a3cc8eb1f6d165576a342596f638316721cb26b6)
 * Fix device list update
   [5fd7410](https://github.com/matrix-org/matrix-js-sdk/commit/5fd74109ffc56b73deb40c2604d84c38b8032c40)


Changes in [0.7.5-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.5-rc.2) (2017-02-03)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.5-rc.1...v0.7.5-rc.2)

 * Use the device change notifications interface
   [\#348](https://github.com/matrix-org/matrix-js-sdk/pull/348)
 * Rewrite the device key query logic
   [\#347](https://github.com/matrix-org/matrix-js-sdk/pull/347)

Changes in [0.7.5-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.5-rc.1) (2017-02-03)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.4...v0.7.5-rc.1)

 * Support for blacklisting unverified devices, both per-room and globally
   [\#336](https://github.com/matrix-org/matrix-js-sdk/pull/336)
 * track errors when events can't be sent
   [\#349](https://github.com/matrix-org/matrix-js-sdk/pull/349)
 * Factor out device list management
   [\#346](https://github.com/matrix-org/matrix-js-sdk/pull/346)
 * Support for warning users when unknown devices show up
   [\#335](https://github.com/matrix-org/matrix-js-sdk/pull/335)
 * Enable sourcemaps in browserified distro
   [\#345](https://github.com/matrix-org/matrix-js-sdk/pull/345)
 * Record all e2e room settings in localstorage
   [\#344](https://github.com/matrix-org/matrix-js-sdk/pull/344)
 * Make Olm work with browserified js-sdk
   [\#340](https://github.com/matrix-org/matrix-js-sdk/pull/340)
 * Make browserify a dev dependency
   [\#339](https://github.com/matrix-org/matrix-js-sdk/pull/339)
 * Allow single line brace-style
   [\#338](https://github.com/matrix-org/matrix-js-sdk/pull/338)
 * Turn on comma-dangle for function calls
   [\#333](https://github.com/matrix-org/matrix-js-sdk/pull/333)
 * Add prefer-const
   [\#331](https://github.com/matrix-org/matrix-js-sdk/pull/331)
 * Support for importing and exporting megolm sessions
   [\#326](https://github.com/matrix-org/matrix-js-sdk/pull/326)
 * Fix linting on all tests
   [\#329](https://github.com/matrix-org/matrix-js-sdk/pull/329)
 * Fix ESLint warnings and errors
   [\#325](https://github.com/matrix-org/matrix-js-sdk/pull/325)
 * BREAKING CHANGE: Remove WebStorageStore
   [\#324](https://github.com/matrix-org/matrix-js-sdk/pull/324)

Changes in [0.7.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.4) (2017-01-16)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.4-rc.1...v0.7.4)

 * Fix non-conference calling

Changes in [0.7.4-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.4-rc.1) (2017-01-13)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.3...v0.7.4-rc.1)

 * Remove babel-polyfill
   [\#321](https://github.com/matrix-org/matrix-js-sdk/pull/321)
 * Update build process for ES6
   [\#320](https://github.com/matrix-org/matrix-js-sdk/pull/320)
 * 'babel' is not a babel package anymore
   [\#319](https://github.com/matrix-org/matrix-js-sdk/pull/319)
 * Add Babel for ES6 support
   [\#318](https://github.com/matrix-org/matrix-js-sdk/pull/318)
 * Move screen sharing check/error
   [\#317](https://github.com/matrix-org/matrix-js-sdk/pull/317)
 * release.sh: Bail early if there are uncommitted changes
   [\#316](https://github.com/matrix-org/matrix-js-sdk/pull/316)

Changes in [0.7.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.3) (2017-01-04)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.2...v0.7.3)

 * User presence list feature
   [\#310](https://github.com/matrix-org/matrix-js-sdk/pull/310)
 * Allow clients the ability to set a default local timeout
   [\#313](https://github.com/matrix-org/matrix-js-sdk/pull/313)
 * Add API to delete threepid
   [\#312](https://github.com/matrix-org/matrix-js-sdk/pull/312)

Changes in [0.7.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.2) (2016-12-15)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.1...v0.7.2)

 * Bump to Olm 2.0
   [\#309](https://github.com/matrix-org/matrix-js-sdk/pull/309)
 * Sanity check payload length before encrypting
   [\#307](https://github.com/matrix-org/matrix-js-sdk/pull/307)
 * Remove dead _sendPingToDevice function
   [\#308](https://github.com/matrix-org/matrix-js-sdk/pull/308)
 * Add setRoomDirectoryVisibilityAppService
   [\#306](https://github.com/matrix-org/matrix-js-sdk/pull/306)
 * Update release script to do signed releases
   [\#305](https://github.com/matrix-org/matrix-js-sdk/pull/305)
 * e2e: Wait for pending device lists
   [\#304](https://github.com/matrix-org/matrix-js-sdk/pull/304)
 * Start a new megolm session when devices are blacklisted
   [\#303](https://github.com/matrix-org/matrix-js-sdk/pull/303)
 * E2E: Download our own devicelist on startup
   [\#302](https://github.com/matrix-org/matrix-js-sdk/pull/302)

Changes in [0.7.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.1) (2016-12-09)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.1-rc.1...v0.7.1)

No changes


Changes in [0.7.1-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.1-rc.1) (2016-12-05)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.7.0...v0.7.1-rc.1)

 * Avoid NPE when no sessionStore is given
   [\#300](https://github.com/matrix-org/matrix-js-sdk/pull/300)
 * Improve decryption error messages
   [\#299](https://github.com/matrix-org/matrix-js-sdk/pull/299)
 * Revert "Use native Array.isArray when available."
   [\#283](https://github.com/matrix-org/matrix-js-sdk/pull/283)
 * Use native Array.isArray when available.
   [\#282](https://github.com/matrix-org/matrix-js-sdk/pull/282)

Changes in [0.7.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.7.0) (2016-11-18)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.4...v0.7.0)

 * Avoid a packetstorm of device queries on startup
   [\#297](https://github.com/matrix-org/matrix-js-sdk/pull/297)
 * E2E: Check devices to share keys with on each send
   [\#295](https://github.com/matrix-org/matrix-js-sdk/pull/295)
 * Apply unknown-keyshare mitigations
   [\#296](https://github.com/matrix-org/matrix-js-sdk/pull/296)
 * distinguish unknown users from deviceless users
   [\#294](https://github.com/matrix-org/matrix-js-sdk/pull/294)
 * Allow starting client with initialSyncLimit = 0
   [\#293](https://github.com/matrix-org/matrix-js-sdk/pull/293)
 * Make timeline-window _unpaginate public and rename to unpaginate
   [\#289](https://github.com/matrix-org/matrix-js-sdk/pull/289)
 * Send a STOPPED sync updated after call to stopClient
   [\#286](https://github.com/matrix-org/matrix-js-sdk/pull/286)
 * Fix bug in verifying megolm event senders
   [\#292](https://github.com/matrix-org/matrix-js-sdk/pull/292)
 * Handle decryption of events after they arrive
   [\#288](https://github.com/matrix-org/matrix-js-sdk/pull/288)
 * Fix examples.
   [\#287](https://github.com/matrix-org/matrix-js-sdk/pull/287)
 * Add a travis.yml
   [\#278](https://github.com/matrix-org/matrix-js-sdk/pull/278)
 * Encrypt all events, including 'm.call.*'
   [\#277](https://github.com/matrix-org/matrix-js-sdk/pull/277)
 * Ignore reshares of known megolm sessions
   [\#276](https://github.com/matrix-org/matrix-js-sdk/pull/276)
 * Log to the console on unknown session
   [\#274](https://github.com/matrix-org/matrix-js-sdk/pull/274)
 * Make it easier for SDK users to wrap prevailing the 'request' function
   [\#273](https://github.com/matrix-org/matrix-js-sdk/pull/273)

Changes in [0.6.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.4) (2016-11-04)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.4-rc.2...v0.6.4)

 * Change release script to pass version by environment variable


Changes in [0.6.4-rc.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.4-rc.2) (2016-11-02)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.4-rc.1...v0.6.4-rc.2)

 * Add getRoomTags method to client
   [\#236](https://github.com/matrix-org/matrix-js-sdk/pull/236)

Changes in [0.6.4-rc.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.4-rc.1) (2016-11-02)
==========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.3...v0.6.4-rc.1)

Breaking Changes
----------------
 * Bundled version of the JS SDK are no longer versioned along with
   source files in the dist/ directory. As of this release, they
   will be included in the release tarball, but not the source
   repository.

Other Changes
-------------
 * More fixes to the release script
   [\#272](https://github.com/matrix-org/matrix-js-sdk/pull/272)
 * Update the release process to use github releases
   [\#271](https://github.com/matrix-org/matrix-js-sdk/pull/271)
 * Don't package the world when we release
   [\#270](https://github.com/matrix-org/matrix-js-sdk/pull/270)
 * Add ability to set a filter prior to the first /sync
   [\#269](https://github.com/matrix-org/matrix-js-sdk/pull/269)
 * Sign one-time keys, and verify their signatures
   [\#243](https://github.com/matrix-org/matrix-js-sdk/pull/243)
 * Check for duplicate message indexes for group messages
   [\#241](https://github.com/matrix-org/matrix-js-sdk/pull/241)
 * Rotate megolm sessions
   [\#240](https://github.com/matrix-org/matrix-js-sdk/pull/240)
 * Check recipient and sender in Olm messages
   [\#239](https://github.com/matrix-org/matrix-js-sdk/pull/239)
 * Consistency checks for E2E device downloads
   [\#237](https://github.com/matrix-org/matrix-js-sdk/pull/237)
 * Support User-Interactive auth for delete device
   [\#235](https://github.com/matrix-org/matrix-js-sdk/pull/235)
 * Utility to help with interactive auth
   [\#234](https://github.com/matrix-org/matrix-js-sdk/pull/234)
 * Fix sync breaking when an invalid filterId is in localStorage
   [\#228](https://github.com/matrix-org/matrix-js-sdk/pull/228)

Changes in [0.6.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.3) (2016-10-12)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.2...v0.6.3)

Breaking Changes
----------------
 * Add a 'RECONNECTING' state to the sync states. This is an additional state
   between 'SYNCING' and 'ERROR', so most clients should not notice.

Other Changes
----------------
 * Fix params getting replaced on register calls
   [\#233](https://github.com/matrix-org/matrix-js-sdk/pull/233)
 * Fix potential 30s delay on reconnect
   [\#232](https://github.com/matrix-org/matrix-js-sdk/pull/232)
 * uploadContent: Attempt some consistency between browser and node
   [\#230](https://github.com/matrix-org/matrix-js-sdk/pull/230)
 * Fix error handling on uploadContent
   [\#229](https://github.com/matrix-org/matrix-js-sdk/pull/229)
 * Fix uploadContent for node.js
   [\#226](https://github.com/matrix-org/matrix-js-sdk/pull/226)
 * Don't emit ERROR until a keepalive poke fails
   [\#223](https://github.com/matrix-org/matrix-js-sdk/pull/223)
 * Function to get the fallback url for interactive auth
   [\#224](https://github.com/matrix-org/matrix-js-sdk/pull/224)
 * Revert "Handle the first /sync failure differently."
   [\#222](https://github.com/matrix-org/matrix-js-sdk/pull/222)

Changes in [0.6.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.2) (2016-10-05)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.1...v0.6.2)

 * Check dependencies aren't on develop in release.sh
   [\#221](https://github.com/matrix-org/matrix-js-sdk/pull/221)
 * Fix checkTurnServers leak on logout
   [\#220](https://github.com/matrix-org/matrix-js-sdk/pull/220)
 * Fix leak of file upload objects
   [\#219](https://github.com/matrix-org/matrix-js-sdk/pull/219)
 * crypto: remove duplicate code
   [\#218](https://github.com/matrix-org/matrix-js-sdk/pull/218)
 * Add API for 3rd party location lookup
   [\#217](https://github.com/matrix-org/matrix-js-sdk/pull/217)
 * Handle the first /sync failure differently.
   [\#216](https://github.com/matrix-org/matrix-js-sdk/pull/216)

Changes in [0.6.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.1) (2016-09-21)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.6.0...v0.6.1)

 * Fix the ed25519 key checking
   [\#215](https://github.com/matrix-org/matrix-js-sdk/pull/215)
 * Add MatrixClient.getEventSenderDeviceInfo()
   [\#214](https://github.com/matrix-org/matrix-js-sdk/pull/214)

Changes in [0.6.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.6.0) (2016-09-21)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.6...v0.6.0)

 * Pull user device list on join
   [\#212](https://github.com/matrix-org/matrix-js-sdk/pull/212)
 * Fix sending of oh_hais on bad sessions
   [\#213](https://github.com/matrix-org/matrix-js-sdk/pull/213)
 * Support /publicRooms pagination
   [\#211](https://github.com/matrix-org/matrix-js-sdk/pull/211)
 * Update the olm library version to 1.3.0
   [\#205](https://github.com/matrix-org/matrix-js-sdk/pull/205)
 * Comment what the logic in uploadKeys does
   [\#209](https://github.com/matrix-org/matrix-js-sdk/pull/209)
 * Include keysProved and keysClaimed in the local echo for events we send.
   [\#210](https://github.com/matrix-org/matrix-js-sdk/pull/210)
 * Check if we need to upload new one-time keys every 10 minutes
   [\#208](https://github.com/matrix-org/matrix-js-sdk/pull/208)
 * Reset oneTimeKey to null on each loop iteration.
   [\#207](https://github.com/matrix-org/matrix-js-sdk/pull/207)
 * Add getKeysProved and getKeysClaimed methods to MatrixEvent.
   [\#206](https://github.com/matrix-org/matrix-js-sdk/pull/206)
 * Send a 'm.new_device' when we get a message for an unknown group session
   [\#204](https://github.com/matrix-org/matrix-js-sdk/pull/204)
 * Introduce EventTimelineSet, filtered timelines and global notif timeline.
   [\#196](https://github.com/matrix-org/matrix-js-sdk/pull/196)
 * Wrap the crypto event handlers in try/catch blocks
   [\#203](https://github.com/matrix-org/matrix-js-sdk/pull/203)
 * Show warnings on to-device decryption fail
   [\#202](https://github.com/matrix-org/matrix-js-sdk/pull/202)
 * s/Displayname/DisplayName/
   [\#201](https://github.com/matrix-org/matrix-js-sdk/pull/201)
 * OH HAI
   [\#200](https://github.com/matrix-org/matrix-js-sdk/pull/200)
 * Share the current ratchet with new members
   [\#199](https://github.com/matrix-org/matrix-js-sdk/pull/199)
 * Move crypto bits into a subdirectory
   [\#198](https://github.com/matrix-org/matrix-js-sdk/pull/198)
 * Refactor event handling in Crypto
   [\#197](https://github.com/matrix-org/matrix-js-sdk/pull/197)
 * Don't create Olm sessions proactively
   [\#195](https://github.com/matrix-org/matrix-js-sdk/pull/195)
 * Use to-device events for key sharing
   [\#194](https://github.com/matrix-org/matrix-js-sdk/pull/194)
 * README: callbacks deprecated
   [\#193](https://github.com/matrix-org/matrix-js-sdk/pull/193)
 * Fix sender verification for megolm messages
   [\#192](https://github.com/matrix-org/matrix-js-sdk/pull/192)
 * Use `ciphertext` instead of `body` in megolm events
   [\#191](https://github.com/matrix-org/matrix-js-sdk/pull/191)
 * Add debug methods to get the state of OlmSessions
   [\#189](https://github.com/matrix-org/matrix-js-sdk/pull/189)
 * MatrixClient.getStoredDevicesForUser
   [\#190](https://github.com/matrix-org/matrix-js-sdk/pull/190)
 * Olm-related cleanups
   [\#188](https://github.com/matrix-org/matrix-js-sdk/pull/188)
 * Update to fixed olmlib
   [\#187](https://github.com/matrix-org/matrix-js-sdk/pull/187)
 * always play audio out of the remoteAudioElement if it exists.
   [\#186](https://github.com/matrix-org/matrix-js-sdk/pull/186)
 * Fix exceptions where HTMLMediaElement loads and plays race
   [\#185](https://github.com/matrix-org/matrix-js-sdk/pull/185)
 * Reset megolm session when people join/leave the room
   [\#183](https://github.com/matrix-org/matrix-js-sdk/pull/183)
 * Fix exceptions when dealing with redactions
   [\#184](https://github.com/matrix-org/matrix-js-sdk/pull/184)

Changes in [0.5.6](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.6) (2016-08-28)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.5...v0.5.6)

 * Put all of the megolm keys in one room message
   [\#182](https://github.com/matrix-org/matrix-js-sdk/pull/182)
 * Reinstate device blocking for simple Olm
   [\#181](https://github.com/matrix-org/matrix-js-sdk/pull/181)
 * support for unpacking megolm keys
   [\#180](https://github.com/matrix-org/matrix-js-sdk/pull/180)
 * Send out megolm keys when we start a megolm session
   [\#179](https://github.com/matrix-org/matrix-js-sdk/pull/179)
 * Change the result structure for ensureOlmSessionsForUsers
   [\#178](https://github.com/matrix-org/matrix-js-sdk/pull/178)
 * Factor out a function for doing olm encryption
   [\#177](https://github.com/matrix-org/matrix-js-sdk/pull/177)
 * Move DeviceInfo and DeviceVerification to separate module
   [\#175](https://github.com/matrix-org/matrix-js-sdk/pull/175)
 * Make encryption asynchronous
   [\#176](https://github.com/matrix-org/matrix-js-sdk/pull/176)
 * Added ability to set and get status_msg for presence.
   [\#167](https://github.com/matrix-org/matrix-js-sdk/pull/167)
 * Megolm: don't dereference nullable object
   [\#174](https://github.com/matrix-org/matrix-js-sdk/pull/174)
 * Implement megolm encryption/decryption
   [\#173](https://github.com/matrix-org/matrix-js-sdk/pull/173)
 * Update our push rules when they come down stream
   [\#170](https://github.com/matrix-org/matrix-js-sdk/pull/170)
 * Factor Olm encryption/decryption out to new classes
   [\#172](https://github.com/matrix-org/matrix-js-sdk/pull/172)
 * Make DeviceInfo more useful, and refactor crypto methods to use it
   [\#171](https://github.com/matrix-org/matrix-js-sdk/pull/171)
 * Move login and register methods into base-apis
   [\#169](https://github.com/matrix-org/matrix-js-sdk/pull/169)
 * Remove defaultDeviceDisplayName from MatrixClient options
   [\#168](https://github.com/matrix-org/matrix-js-sdk/pull/168)

Changes in [0.5.5](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.5) (2016-08-11)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.4...v0.5.5)

 * Add room.getAliases() and room.getCanonicalAlias
 * Add API calls `/register/email/requestToken`, `/account/password/email/requestToken` and `/account/3pid/email/requestToken`
 * Add `User.currentlyActive` and `User.lastPresenceTs` events for changes in fields on the User object
 * Add `logout` and `deactivateAccount`

 * Make sure we actually stop the sync loop on logout
   [\#166](https://github.com/matrix-org/matrix-js-sdk/pull/166)
 * Zero is a valid power level
   [\#164](https://github.com/matrix-org/matrix-js-sdk/pull/164)
 * Verify e2e keys on download
   [\#163](https://github.com/matrix-org/matrix-js-sdk/pull/163)
 * Factor crypto stuff out of MatrixClient
   [\#162](https://github.com/matrix-org/matrix-js-sdk/pull/162)
 * Refactor device key upload
   [\#161](https://github.com/matrix-org/matrix-js-sdk/pull/161)
 * Wrappers for devices API
   [\#158](https://github.com/matrix-org/matrix-js-sdk/pull/158)
 * Add deactivate account function
   [\#160](https://github.com/matrix-org/matrix-js-sdk/pull/160)
 * client.listDeviceKeys: Expose device display name
   [\#159](https://github.com/matrix-org/matrix-js-sdk/pull/159)
 * Add `logout`
   [\#157](https://github.com/matrix-org/matrix-js-sdk/pull/157)
 * Fix email registration
   [\#156](https://github.com/matrix-org/matrix-js-sdk/pull/156)
 * Factor out MatrixClient methods to MatrixBaseApis
   [\#155](https://github.com/matrix-org/matrix-js-sdk/pull/155)
 * Fix some broken tests
   [\#154](https://github.com/matrix-org/matrix-js-sdk/pull/154)
 * make jenkins fail the build if the tests fail
   [\#153](https://github.com/matrix-org/matrix-js-sdk/pull/153)
 * deviceId-related fixes
   [\#152](https://github.com/matrix-org/matrix-js-sdk/pull/152)
 * /login, /register: Add device_id and initial_device_display_name
   [\#151](https://github.com/matrix-org/matrix-js-sdk/pull/151)
 * Support global account_data
   [\#150](https://github.com/matrix-org/matrix-js-sdk/pull/150)
 * Add more events to User
   [\#149](https://github.com/matrix-org/matrix-js-sdk/pull/149)
 * Add API calls for other requestToken endpoints
   [\#148](https://github.com/matrix-org/matrix-js-sdk/pull/148)
 * Add register-specific request token endpoint
   [\#147](https://github.com/matrix-org/matrix-js-sdk/pull/147)
 * Set a valid SPDX license identifier in package.json
   [\#139](https://github.com/matrix-org/matrix-js-sdk/pull/139)
 * Configure encryption on m.room.encryption events
   [\#145](https://github.com/matrix-org/matrix-js-sdk/pull/145)
 * Implement device blocking
   [\#146](https://github.com/matrix-org/matrix-js-sdk/pull/146)
 * Clearer doc for setRoomDirectoryVisibility
   [\#144](https://github.com/matrix-org/matrix-js-sdk/pull/144)
 * crypto: use memberlist to derive recipient list
   [\#143](https://github.com/matrix-org/matrix-js-sdk/pull/143)
 * Support for marking devices as unverified
   [\#142](https://github.com/matrix-org/matrix-js-sdk/pull/142)
 * Add Olm as an optionalDependency
   [\#141](https://github.com/matrix-org/matrix-js-sdk/pull/141)
 * Add room.getAliases() and room.getCanonicalAlias()
   [\#140](https://github.com/matrix-org/matrix-js-sdk/pull/140)
 * Change how MatrixEvent manages encrypted events
   [\#138](https://github.com/matrix-org/matrix-js-sdk/pull/138)
 * Catch exceptions when encrypting events
   [\#137](https://github.com/matrix-org/matrix-js-sdk/pull/137)
 * Support for marking devices as verified
   [\#136](https://github.com/matrix-org/matrix-js-sdk/pull/136)
 * Various matrix-client refactorings and fixes
   [\#134](https://github.com/matrix-org/matrix-js-sdk/pull/134)

Changes in [0.5.4](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.4) (2016-06-02)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.3...v0.5.4)

 * Correct fix for https://github.com/vector-im/vector-web/issues/1039
 * Make release.sh work on OSX


Changes in [0.5.3](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.3) (2016-06-02)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.2...v0.5.3)

 * Add support for the openid interface
   [\#133](https://github.com/matrix-org/matrix-js-sdk/pull/133)
 * Bugfix for HTTP upload content when running on node
   [\#129](https://github.com/matrix-org/matrix-js-sdk/pull/129)
 * Ignore missing profile (displayname and avatar_url) fields on
   presence events, rather than overwriting existing valid profile
   data from membership events or elsewhere.
   Fixes https://github.com/vector-im/vector-web/issues/1039

Changes in [0.5.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.2) (2016-04-19)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.1...v0.5.2)

 * Track the absolute time that presence events are received, so that the
   relative lastActiveAgo value is meaningful.
   [\#128](https://github.com/matrix-org/matrix-js-sdk/pull/128)
 * Refactor the addition of events to rooms
   [\#127](https://github.com/matrix-org/matrix-js-sdk/pull/127)
 * Clean up test shutdown
   [\#126](https://github.com/matrix-org/matrix-js-sdk/pull/126)
 * Add methods to get (and set) pushers
   [\#125](https://github.com/matrix-org/matrix-js-sdk/pull/125)
 * URL previewing support
   [\#122](https://github.com/matrix-org/matrix-js-sdk/pull/122)
 * Avoid paginating forever in private rooms
   [\#124](https://github.com/matrix-org/matrix-js-sdk/pull/124)
 * Fix a bug where we recreated sync filters
   [\#123](https://github.com/matrix-org/matrix-js-sdk/pull/123)
 * Implement HTTP timeouts in realtime
   [\#121](https://github.com/matrix-org/matrix-js-sdk/pull/121)

Changes in [0.5.1](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.1) (2016-03-30)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.5.0...v0.5.1)

 * Only count joined members for the member count in notifications.
   [\#119](https://github.com/matrix-org/matrix-js-sdk/pull/119)
 * Add maySendEvent to match maySendStateEvent
   [\#118](https://github.com/matrix-org/matrix-js-sdk/pull/118)

Changes in [0.5.0](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.5.0) (2016-03-22)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.4.2...v0.5.0)

**BREAKING CHANGES**:
 * `opts.pendingEventOrdering`==`end` is no longer supported in the arguments to
   `MatrixClient.startClient()`. Instead we provide a `detached` option, which
   puts pending events into a completely separate list in the Room, accessible
   via `Room.getPendingEvents()`.
   [\#111](https://github.com/matrix-org/matrix-js-sdk/pull/111)

Other improvements:
 * Log the stack when we get a sync error
   [\#109](https://github.com/matrix-org/matrix-js-sdk/pull/109)
 * Refactor transmitted-messages code
   [\#110](https://github.com/matrix-org/matrix-js-sdk/pull/110)
 * Add a method to the js sdk to look up 3pids on the ID server.
   [\#113](https://github.com/matrix-org/matrix-js-sdk/pull/113)
 * Support for cancelling pending events
   [\#112](https://github.com/matrix-org/matrix-js-sdk/pull/112)
 * API to stop peeking
   [\#114](https://github.com/matrix-org/matrix-js-sdk/pull/114)
 * update store user metadata based on membership events rather than presence
   [\#116](https://github.com/matrix-org/matrix-js-sdk/pull/116)
 * Include a counter in generated transaction IDs
   [\#115](https://github.com/matrix-org/matrix-js-sdk/pull/115)
 * get/setRoomVisibility API
   [\#117](https://github.com/matrix-org/matrix-js-sdk/pull/117)

Changes in [0.4.2](https://github.com/matrix-org/matrix-js-sdk/releases/tag/v0.4.2) (2016-03-17)
================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-js-sdk/compare/v0.4.1...v0.4.2)

 * Try again if a pagination request gives us no new messages
   [\#98](https://github.com/matrix-org/matrix-js-sdk/pull/98)
 * Add a delay before we start polling the connectivity check endpoint
   [\#99](https://github.com/matrix-org/matrix-js-sdk/pull/99)
 * Clean up a codepath that was only used for crypto messages
   [\#101](https://github.com/matrix-org/matrix-js-sdk/pull/101)
 * Add maySendStateEvent method, ported from react-sdk (but fixed).
   [\#94](https://github.com/matrix-org/matrix-js-sdk/pull/94)
 * Add Session.logged_out event
   [\#100](https://github.com/matrix-org/matrix-js-sdk/pull/100)
 * make presence work when peeking.
   [\#103](https://github.com/matrix-org/matrix-js-sdk/pull/103)
 * Add RoomState.mayClientSendStateEvent()
   [\#104](https://github.com/matrix-org/matrix-js-sdk/pull/104)
 * Fix displaynames for member join events
   [\#108](https://github.com/matrix-org/matrix-js-sdk/pull/108)

Changes in 0.4.1
================

Improvements:
 * Check that `/sync` filters are correct before reusing them, and recreate
   them if not (https://github.com/matrix-org/matrix-js-sdk/pull/85).
 * Fire a `Room.timelineReset` event when a room's timeline is reset by a gappy
   `/sync` (https://github.com/matrix-org/matrix-js-sdk/pull/87,
   https://github.com/matrix-org/matrix-js-sdk/pull/93).
 * Make `TimelineWindow.load()` faster in the simple case of loading the live
   timeline (https://github.com/matrix-org/matrix-js-sdk/pull/88).
 * Update room-name calculation code to use the name of the sender of the
   invite when invited to a room
   (https://github.com/matrix-org/matrix-js-sdk/pull/89).
 * Don't reset the timeline when we join a room after peeking into it
   (https://github.com/matrix-org/matrix-js-sdk/pull/91).
 * Fire `Room.localEchoUpdated` events as local echoes progress through their
   transmission process (https://github.com/matrix-org/matrix-js-sdk/pull/95,
   https://github.com/matrix-org/matrix-js-sdk/pull/97).
 * Avoid getting stuck in a pagination loop when the server sends us only
   messages we've already seen
   (https://github.com/matrix-org/matrix-js-sdk/pull/96).

New methods:
 * Add `MatrixClient.setPushRuleActions` to set the actions for a push
   notification rule (https://github.com/matrix-org/matrix-js-sdk/pull/90)
 * Add `RoomState.maySendStateEvent` which determines if a given user has
   permission to send a state event
   (https://github.com/matrix-org/matrix-js-sdk/pull/94)

Changes in 0.4.0
================

**BREAKING CHANGES**:
 * `RoomMember.getAvatarUrl()` and `MatrixClient.mxcUrlToHttp()` now return the
    empty string when given anything other than an mxc:// URL. This ensures that
    clients never inadvertantly reference content directly, leaking information
    to third party servers. The `allowDirectLinks` option is provided if the client
    wants to allow such links.
 * Add a 'bindEmail' option to register()

Improvements:
 * Support third party invites
 * More appropriate naming for third party invite rooms
 * Poll the 'versions' endpoint to re-establish connectivity
 * Catch exceptions when syncing
 * Room tag support
 * Generate implicit read receipts
 * Support CAS login
 * Guest access support
 * Never return non-mxc URLs by default
 * Ability to cancel file uploads
 * Use the Matrix C/S API v2 with r0 prefix
 * Account data support
 * Support non-contiguous event timelines
 * Support new unread counts
 * Local echo for read-receipts


New methods:
 * Add method to fetch URLs not on the home or identity server
 * Method to get the last receipt for a user
 * Method to get all known users
 * Method to delete an alias


Changes in 0.3.0
================

 * `MatrixClient.getAvatarUrlForMember` has been removed and replaced with
   `RoomMember.getAvatarUrl`. Arguments remain the same except the homeserver
   URL must now be supplied from `MatrixClient.getHomeserverUrl()`.

   ```javascript
   // before
   var url = client.getAvatarUrlForMember(member, width, height, resize, allowDefault)
   // after
   var url = member.getAvatarUrl(client.getHomeserverUrl(), width, height, resize, allowDefault)
   ```
 * `MatrixClient.getAvatarUrlForRoom` has been removed and replaced with
   `Room.getAvatarUrl`. Arguments remain the same except the homeserver
   URL must now be supplied from `MatrixClient.getHomeserverUrl()`.

   ```javascript
   // before
   var url = client.getAvatarUrlForRoom(room, width, height, resize, allowDefault)
   // after
   var url = room.getAvatarUrl(client.getHomeserverUrl(), width, height, resize, allowDefault)
   ```

 * `s/Room.getMembersWithMemership/Room.getMembersWithMem`b`ership/g`

New methods:
 * Added support for sending receipts via
   `MatrixClient.sendReceipt(event, receiptType, callback)` and
   `MatrixClient.sendReadReceipt(event, callback)`.
 * Added support for receiving receipts via
   `Room.getReceiptsForEvent(event)` and `Room.getUsersReadUpTo(event)`. Receipts
   can be directly added to a `Room` using `Room.addReceipt(event)` though the
   `MatrixClient` does this for you.
 * Added support for muting local video and audio via the new methods
   `MatrixCall.setMicrophoneMuted()`, `MatrixCall.isMicrophoneMuted(muted)`,
   `MatrixCall.isLocalVideoMuted()` and `Matrix.setLocalVideoMuted(muted)`.
 * Added **experimental** support for screen-sharing in Chrome via
   `MatrixCall.placeScreenSharingCall(remoteVideoElement, localVideoElement)`.
 * Added ability to perform server-side searches using
   `MatrixClient.searchMessageText(opts)` and `MatrixClient.search(opts)`.

Improvements:
 * Improve the performance of initial sync processing from `O(n^2)` to `O(n)`.
 * `Room.name` will now take into account `m.room.canonical_alias` events.
 * `MatrixClient.startClient` now takes an Object `opts` rather than a Number in
   a backwards-compatible way. This `opts` allows syncing configuration options
   to be specified including `includeArchivedRooms` and `resolveInvitesToProfiles`.
 * `Room` objects which represent room invitations will now have state populated
   from `invite_room_state` if it is included in the `m.room.member` event.
 * `Room.getAvatarUrl` will now take into account `m.room.avatar` events.

Changes in 0.2.2
================

Bug fixes:
 * Null pointer fixes for VoIP calling and push notification processing.
 * Set the `Content-Type` to `application/octet-stream` in the event that the
   file object has no `type`.

New methods:
 * Added `MatrixClient.getCasServer()` which calls through to the HTTP endpoint
   `/login/cas`.
 * Added `MatrixClient.loginWithCas(ticket, service)` which logs in with the
   type `m.login.cas`.
 * Added `MatrixClient.getHomeserverUrl()` which returns the URL passed in the
   constructor.
 * Added `MatrixClient.getIdentityServerUrl()` which returns the URL passed in
   the constructor.
 * Added `getLastModifiedTime()` to `RoomMember`, `RoomState` and `User` objects.
   This makes it easier to see if the object in question has changed, which can
   be used to improve performance by only rendering when these objects change.

Changes in 0.2.1
================

**BREAKING CHANGES**
 * `MatrixClient.joinRoom` has changed from `(roomIdOrAlias, callback)` to
   `(roomIdOrAlias, opts, callback)`.

Bug fixes:
 * The `Content-Type` of file uploads is now explicitly set, without relying
   on the browser to do it for us.

Improvements:
 * The `MatrixScheduler.RETRY_BACKOFF_RATELIMIT` function will not retry when
   the response is a 400,401,403.
 * The text returned from a room invite now includes who the invite was from.
 * There is now a try/catch block around the `request` function which will
   reject/errback appropriately if an exception is thrown synchronously in it.

New methods:
 * `MatrixClient.createAlias(alias, roomId)`
 * `MatrixClient.getRoomIdForAlias(alias)`
 * `MatrixClient.sendNotice(roomId, body, txnId, callback)`
 * `MatrixClient.sendHtmlNotice(roomId, body, htmlBody, callback)`

Modified methods:
 * `MatrixClient.joinRoom(roomIdOrAlias, opts)` where `opts` can include a
   `syncRoom: true|false` flag to control whether a room initial sync is
   performed after joining the room.
 * `MatrixClient.getAvatarUrlForMember` has a new last arg `allowDefault` which
   returns the default identicon URL if `true`.
 * `MatrixClient.getAvatarUrlForRoom` has a new last arg `allowDefault` which
   is passed through to the default identicon generation for
   `getAvatarUrlForMember`.


Changes in 0.2.0
================

**BREAKING CHANGES**:
 * `MatrixClient.setPowerLevel` now expects a `MatrixEvent` and not an `Object`
   for the `event` parameter.

New features:
 * Added `EventStatus.QUEUED` which is set on an event when it is waiting to be
   sent by the scheduler and there are other events in front.
 * Added support for processing push rules on an event. This can be obtained by
   calling `MatrixClient.getPushActionsForEvent(event)`.
 * Added WebRTC support. Outbound calls can be made via
   `call = global.createNewMatrixCall(MatrixClient, roomId)` followed by
   `call.placeVoiceCall()` or `call.placeVideoCall(remoteEle, localEle)`.
   Inbound calls will be received via the event `"Call.incoming"` which provides
   a call object which can be followed with `call.answer()` or `call.hangup()`.
 * Added the ability to upload files to the media repository.
 * Added the ability to change the client's password.
 * Added the ability to register with an email via an identity server.
 * Handle presence events by updating the associated `User` object.
 * Handle redaction events.
 * Added infrastructure for supporting End-to-End encryption. E2E is *NOT*
   available in this version.

New methods:
 * `MatrixClient.getUser(userId)`
 * `MatrixClient.getPushActionsForEvent(event)`
 * `MatrixClient.setPassword(auth, newPassword)`
 * `MatrixClient.loginWithSAML2(relayState, callback)`
 * `MatrixClient.getAvatarUrlForMember(member, w, h, method)`
 * `MatrixClient.mxcUrlToHttp(url, w, h, method)`
 * `MatrixClient.getAvatarUrlForRoom(room, w, h, method)`
 * `MatrixClient.uploadContent(file, callback)`
 * `Room.getMembersWithMembership(membership)`
 * `MatrixScheduler.getQueueForEvent(event)`
 * `MatrixScheduler.removeEventFromQueue(event)`
 * `$DATA_STORE.setSyncToken(token)`
 * `$DATA_STORE.getSyncToken()`

Crypto infrastructure (crypto is *NOT* available in this version):
 * `global.CRYPTO_ENABLED`
 * `MatrixClient.isCryptoEnabled()`
 * `MatrixClient.uploadKeys(maxKeys)`
 * `MatrixClient.downloadKeys(userIds, forceDownload)`
 * `MatrixClient.listDeviceKeys(userId)`
 * `MatrixClient.setRoomEncryption(roomId, config)`
 * `MatrixClient.isRoomEncrypted(roomId)`

New classes:
 * `MatrixCall`
 * `WebStorageStore` - *WIP; unstable*
 * `WebStorageSessionStore` - *WIP; unstable*

Bug fixes:
 * Member name bugfix: Fixed an issue which prevented `RoomMember.name` being
   disambiguated if there was exactly 1 other person with the same display name.
 * Member name bugfix: Disambiguate both clashing display names with user IDs in
   the event of a clash.
 * Room state bugfix: Fixed a bug which incorrectly overwrote power levels
   locally for a room.
 * Room name bugfix: Ignore users who have left the room when determining a room
   name.
 * Events bugfix: Fixed a bug which prevented the `sender` and `target`
   properties from being set.

Changes in 0.1.1
================

**BREAKING CHANGES**:
 * `Room.calculateRoomName` is now private. Use `Room.recalculate` instead, and
   access the calculated name via `Room.name`.
 * `new MatrixClient(...)` no longer creates a `MatrixInMemoryStore` if
   `opts.store` is not specified. Instead, the `createClient` global function
   creates it and passes it to the constructor. This change will not affect
   users who have always used `createClient` to create a `MatrixClient`.
 * `"Room"` events will now be emitted when the Room has *finished* being
   populated with state rather than at the moment of creation. This will fire
   when the SDK encounters a room it doesn't know about (just arrived from the
   event stream; e.g. a room invite) and will also fire after syncing room
   state (e.g. after calling joinRoom).
 * `MatrixClient.joinRoom` now returns a `Room` object when resolved, not an
   object with a `room_id` property.
 * `MatrixClient.scrollback` now expects a `Room` arg instead of a `room_id`
   and `from` token. Construct a `new Room(roomId)` if you want to continue
   using this directly, then set the pagination token using
   `room.oldState.paginationToken = from`. It now resolves to a `Room` object
   instead of the raw HTTP response.

New properties:
 * `User.events`
 * `RoomMember.events`

New methods:
 * `Room.hasMembershipState(userId, membership)`
 * `MatrixClient.resendEvent(event, room)`

New features:
 * Local echo. When you send an event using the SDK it will immediately be
   added to `Room.timeline` with the `event.status` of `EventStatus.SENDING`.
   When the event is finally sent, this status will be removed.
 * Not sent status. When an event fails to send using the SDK, it will have the
   `event.status` of `EventStatus.NOT_SENT`.
 * Retries. If events fail to send, they will be automatically retried.
 * Manual resending. Events which failed to send can be passed to
   `MatrixClient.resendEvent(event, room)` to resend them.
 * Queueing. Messages sent in quick succession will be queued to preserve the
   order in which they were submitted.
 * Room state is automatcally synchronised when joining a room (including if
   another device joins a room).
 * Scrollback. You can request earlier events in a room using
   `MatrixClient.scrollback(room, limit, callback)`.

Bug fixes:
 * Fixed a bug which prevented the event stream from polling. Some devices will
   black hole requests when they hibernate, meaning that the callbacks will
   never fire. We now maintain a local timer to forcibly restart the request.
