Changes in [1.11.69](https://github.com/element-hq/element-web/releases/tag/v1.11.69) (2024-06-18)
==================================================================================================
## ✨ Features

* Change avatar setting component to use a menu ([#12585](https://github.com/matrix-org/matrix-react-sdk/pull/12585)). Contributed by @dbkr.
* New user profile UI in User Settings ([#12548](https://github.com/matrix-org/matrix-react-sdk/pull/12548)). Contributed by @dbkr.
* MSC4108 support OIDC QR code login ([#12370](https://github.com/matrix-org/matrix-react-sdk/pull/12370)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Fix image upload preview size ([#12612](https://github.com/matrix-org/matrix-react-sdk/pull/12612)). Contributed by @RiotRobot.
* Fix screen sharing in recent Chrome (https://github.com/matrix-org/matrix-js-sdk/pull/4243).
* Fix roving tab index crash `compareDocumentPosition` ([#12594](https://github.com/matrix-org/matrix-react-sdk/pull/12594)). Contributed by @t3chguy.
* Keep dialog glass border on narrow screens ([#12591](https://github.com/matrix-org/matrix-react-sdk/pull/12591)). Contributed by @dbkr.
* Add missing a11y label to dismiss onboarding button in room list ([#12587](https://github.com/matrix-org/matrix-react-sdk/pull/12587)). Contributed by @t3chguy.
* Add hover / active state on avatar setting upload button ([#12590](https://github.com/matrix-org/matrix-react-sdk/pull/12590)). Contributed by @dbkr.
* Fix EditInPlace button styles ([#12589](https://github.com/matrix-org/matrix-react-sdk/pull/12589)). Contributed by @dbkr.
* Fix incorrect assumptions about required fields in /search response ([#12575](https://github.com/matrix-org/matrix-react-sdk/pull/12575)). Contributed by @t3chguy.
* Fix display of no avatar in avatar setting controls ([#12558](https://github.com/matrix-org/matrix-react-sdk/pull/12558)). Contributed by @dbkr.
* Element-R: pass pickleKey in as raw key for indexeddb encryption ([#12543](https://github.com/matrix-org/matrix-react-sdk/pull/12543)). Contributed by @richvdh.



Changes in [1.11.68](https://github.com/element-hq/element-web/releases/tag/v1.11.68) (2024-06-04)
==================================================================================================
## ✨ Features

* Tooltip: Improve accessibility for  context menus ([#12462](https://github.com/matrix-org/matrix-react-sdk/pull/12462)). Contributed by @florianduros.
* Tooltip: Improve accessibility of space panel ([#12525](https://github.com/matrix-org/matrix-react-sdk/pull/12525)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Close the release announcement when a dialog is opened ([#12559](https://github.com/matrix-org/matrix-react-sdk/pull/12559)). Contributed by @florianduros.
* Tooltip: close field tooltip when ESC is pressed ([#12553](https://github.com/matrix-org/matrix-react-sdk/pull/12553)). Contributed by @florianduros.
* Fix tabbedview breakpoint width ([#12556](https://github.com/matrix-org/matrix-react-sdk/pull/12556)). Contributed by @dbkr.
* Fix E2E icon display in room header ([#12545](https://github.com/matrix-org/matrix-react-sdk/pull/12545)). Contributed by @florianduros.
* Tooltip: Improve placement for space settings ([#12541](https://github.com/matrix-org/matrix-react-sdk/pull/12541)). Contributed by @florianduros.
* Fix deformed avatar in a call in a narrow timeline ([#12538](https://github.com/matrix-org/matrix-react-sdk/pull/12538)). Contributed by @florianduros.
* Shown own sent state indicator even when showReadReceipts is disabled ([#12540](https://github.com/matrix-org/matrix-react-sdk/pull/12540)). Contributed by @t3chguy.
* Ensure we do not fire the verification mismatch modal multiple times ([#12526](https://github.com/matrix-org/matrix-react-sdk/pull/12526)). Contributed by @t3chguy.
* Fix avatar in chat export ([#12537](https://github.com/matrix-org/matrix-react-sdk/pull/12537)). Contributed by @florianduros.
* Use `*` for italics as it doesn't break when used mid-word ([#12523](https://github.com/matrix-org/matrix-react-sdk/pull/12523)). Contributed by @t3chguy.


Changes in [1.11.67](https://github.com/element-hq/element-web/releases/tag/v1.11.67) (2024-05-22)
==================================================================================================
## ✨ Features

* Tooltip: Improve the accessibility of the composer and the rich text editor ([#12459](https://github.com/matrix-org/matrix-react-sdk/pull/12459)). Contributed by @florianduros.
* Allow explicit configuration of OIDC dynamic registration metadata ([#12514](https://github.com/matrix-org/matrix-react-sdk/pull/12514)). Contributed by @t3chguy.
* Tooltip: improve accessibility for messages ([#12487](https://github.com/matrix-org/matrix-react-sdk/pull/12487)). Contributed by @florianduros.
* Collapse UserSettings tabs to just icons on narrow screens ([#12505](https://github.com/matrix-org/matrix-react-sdk/pull/12505)). Contributed by @dbkr.
* Add room topic to right panel room info ([#12503](https://github.com/matrix-org/matrix-react-sdk/pull/12503)). Contributed by @t3chguy.
* OIDC: pass `id_token` via `id_token_hint` on Manage Account interaction ([#12499](https://github.com/matrix-org/matrix-react-sdk/pull/12499)). Contributed by @t3chguy.
* Tooltip: improve accessibility in room ([#12493](https://github.com/matrix-org/matrix-react-sdk/pull/12493)). Contributed by @florianduros.
* Tooltip: improve accessibility for call and voice messages ([#12489](https://github.com/matrix-org/matrix-react-sdk/pull/12489)). Contributed by @florianduros.
* Move the active tab in user settings to the dialog title ([#12481](https://github.com/matrix-org/matrix-react-sdk/pull/12481)). Contributed by @dbkr.
* Tooltip: improve accessibility of spaces ([#12497](https://github.com/matrix-org/matrix-react-sdk/pull/12497)). Contributed by @florianduros.
* Tooltip: improve accessibility of the right panel ([#12490](https://github.com/matrix-org/matrix-react-sdk/pull/12490)). Contributed by @florianduros.
* MSC3575 (Sliding Sync) add well-known proxy support ([#12307](https://github.com/matrix-org/matrix-react-sdk/pull/12307)). Contributed by @EdGeraghty.

## 🐛 Bug Fixes

* Reuse single PlaybackWorker between Playback instances ([#12520](https://github.com/matrix-org/matrix-react-sdk/pull/12520)). Contributed by @t3chguy.
* Fix well-known lookup for sliding sync labs check ([#12519](https://github.com/matrix-org/matrix-react-sdk/pull/12519)). Contributed by @t3chguy.
* Fix `element-desktop-ssoid being` included in OIDC Authorization call ([#12495](https://github.com/matrix-org/matrix-react-sdk/pull/12495)). Contributed by @t3chguy.
* Fix beta notifications reconciliation for intentional mentions push rules ([#12510](https://github.com/matrix-org/matrix-react-sdk/pull/12510)). Contributed by @t3chguy.
* fix avatar stretched on 1:1 call ([#12494](https://github.com/matrix-org/matrix-react-sdk/pull/12494)). Contributed by @I-lander.
* Check native sliding sync support against an unstable feature flag ([#12498](https://github.com/matrix-org/matrix-react-sdk/pull/12498)). Contributed by @turt2live.
* Use OPTIONS for sliding sync detection poke ([#12492](https://github.com/matrix-org/matrix-react-sdk/pull/12492)). Contributed by @turt2live.
* TAC: hide tooltip when the release announcement is displayed ([#12472](https://github.com/matrix-org/matrix-react-sdk/pull/12472)). Contributed by @florianduros.



Changes in [1.11.66](https://github.com/element-hq/element-web/releases/tag/v1.11.66) (2024-05-07)
==================================================================================================
## ✨ Features

* Use a different error message for UTDs when you weren't in the room. ([#12453](https://github.com/matrix-org/matrix-react-sdk/pull/12453)). Contributed by @uhoreg.
* Take the Threads Activity Centre out of labs ([#12439](https://github.com/matrix-org/matrix-react-sdk/pull/12439)). Contributed by @dbkr.
* Expected UTDs: use a different message for UTDs sent before login ([#12391](https://github.com/matrix-org/matrix-react-sdk/pull/12391)). Contributed by @richvdh.
* Add `Tooltip` to `AccessibleButton` ([#12443](https://github.com/matrix-org/matrix-react-sdk/pull/12443)). Contributed by @florianduros.
* Add analytics to activity toggles ([#12418](https://github.com/matrix-org/matrix-react-sdk/pull/12418)). Contributed by @dbkr.
* Decrypt events in reverse order without copying the array ([#12445](https://github.com/matrix-org/matrix-react-sdk/pull/12445)). Contributed by @Johennes.
* Use new compound tooltip ([#12416](https://github.com/matrix-org/matrix-react-sdk/pull/12416)). Contributed by @florianduros.
* Expected UTDs: report a different Posthog code ([#12389](https://github.com/matrix-org/matrix-react-sdk/pull/12389)). Contributed by @richvdh.

## 🐛 Bug Fixes

* TAC: Fix accessibility issue when the Release announcement is displayed ([#12484](https://github.com/matrix-org/matrix-react-sdk/pull/12484)). Contributed by @RiotRobot.
* TAC: Close Release Announcement when TAC button is clicked ([#12485](https://github.com/matrix-org/matrix-react-sdk/pull/12485)). Contributed by @florianduros.
* MenuItem: fix caption usage ([#12455](https://github.com/matrix-org/matrix-react-sdk/pull/12455)). Contributed by @florianduros.
* Show the local echo in previews ([#12451](https://github.com/matrix-org/matrix-react-sdk/pull/12451)). Contributed by @langleyd.
* Fixed the drag and drop of X #27186 ([#12450](https://github.com/matrix-org/matrix-react-sdk/pull/12450)). Contributed by @asimdelvi.
* Move the TAC to above the button ([#12438](https://github.com/matrix-org/matrix-react-sdk/pull/12438)). Contributed by @dbkr.
* Use the same logic in previews as the timeline to hide events that should be hidden ([#12434](https://github.com/matrix-org/matrix-react-sdk/pull/12434)). Contributed by @langleyd.
* Fix selector so maths support doesn't mangle divs ([#12433](https://github.com/matrix-org/matrix-react-sdk/pull/12433)). Contributed by @uhoreg.



Changes in [1.11.65](https://github.com/element-hq/element-web/releases/tag/v1.11.65) (2024-04-23)
==================================================================================================
## ✨ Features

* Make empty state copy for TAC depend on the value of the setting ([#12419](https://github.com/matrix-org/matrix-react-sdk/pull/12419)). Contributed by @dbkr.
* Linkify User Interactive Authentication errors ([#12271](https://github.com/matrix-org/matrix-react-sdk/pull/12271)). Contributed by @t3chguy.
* Add support for device dehydration v2 ([#12316](https://github.com/matrix-org/matrix-react-sdk/pull/12316)). Contributed by @uhoreg.
* Replace `SecurityCustomisations` with `CryptoSetupExtension` ([#12342](https://github.com/matrix-org/matrix-react-sdk/pull/12342)). Contributed by @thoraj.
* Add activity toggle for TAC ([#12413](https://github.com/matrix-org/matrix-react-sdk/pull/12413)). Contributed by @dbkr.
* Humanize spell check language labels ([#12409](https://github.com/matrix-org/matrix-react-sdk/pull/12409)). Contributed by @t3chguy.
* Call Guest Access, give user the option to change the acces level so they can generate a call link. ([#12401](https://github.com/matrix-org/matrix-react-sdk/pull/12401)). Contributed by @toger5.
* TAC: Release Announcement ([#12380](https://github.com/matrix-org/matrix-react-sdk/pull/12380)). Contributed by @florianduros.
* Show the call and share button if the user can create a guest link. ([#12385](https://github.com/matrix-org/matrix-react-sdk/pull/12385)). Contributed by @toger5.
* Add analytics for mark all threads unread ([#12384](https://github.com/matrix-org/matrix-react-sdk/pull/12384)). Contributed by @dbkr.
* Add `EventType.RoomEncryption` to the auto approve capabilities of Element Call widgets ([#12386](https://github.com/matrix-org/matrix-react-sdk/pull/12386)). Contributed by @toger5.

## 🐛 Bug Fixes

* Fix link modal not shown after access upgrade ([#12411](https://github.com/matrix-org/matrix-react-sdk/pull/12411)). Contributed by @toger5.
* Fix thread navigation in timeline ([#12412](https://github.com/matrix-org/matrix-react-sdk/pull/12412)). Contributed by @florianduros.
* Fix inability to join a `knock` room via space hierarchy view ([#12404](https://github.com/matrix-org/matrix-react-sdk/pull/12404)). Contributed by @t3chguy.
* Focus the thread panel when clicking on an item in the TAC ([#12410](https://github.com/matrix-org/matrix-react-sdk/pull/12410)). Contributed by @dbkr.
* Fix space hierarchy tile busy state being stuck after join error ([#12405](https://github.com/matrix-org/matrix-react-sdk/pull/12405)). Contributed by @t3chguy.
* Fix room topic in-app links not being handled correctly on topic dialog ([#12406](https://github.com/matrix-org/matrix-react-sdk/pull/12406)). Contributed by @t3chguy.



Changes in [1.11.64](https://github.com/element-hq/element-web/releases/tag/v1.11.64) (2024-04-09)
==================================================================================================
## ✨ Features

* Mark all threads as read button ([#12378](https://github.com/matrix-org/matrix-react-sdk/pull/12378)). Contributed by @dbkr.
* Video call meta space ([#12297](https://github.com/matrix-org/matrix-react-sdk/pull/12297)). Contributed by @toger5.
* Add leave room warning for last admin ([#9452](https://github.com/matrix-org/matrix-react-sdk/pull/9452)). Contributed by @Arnei.
* Iterate styles around Link new device via QR ([#12356](https://github.com/matrix-org/matrix-react-sdk/pull/12356)). Contributed by @t3chguy.
* Improve code-splitting of highlight.js and maplibre-gs libs ([#12349](https://github.com/matrix-org/matrix-react-sdk/pull/12349)). Contributed by @t3chguy.
* Use data-mx-color for rainbows ([#12325](https://github.com/matrix-org/matrix-react-sdk/pull/12325)). Contributed by @tulir.

## 🐛 Bug Fixes

* Fix external guest access url for unencrypted rooms ([#12345](https://github.com/matrix-org/matrix-react-sdk/pull/12345)). Contributed by @toger5.
* Fix video rooms not showing share link button ([#12374](https://github.com/matrix-org/matrix-react-sdk/pull/12374)). Contributed by @toger5.
* Fix space topic jumping on hover/focus ([#12377](https://github.com/matrix-org/matrix-react-sdk/pull/12377)). Contributed by @t3chguy.
* Allow popping out a Jitsi widget to respect Desktop `web_base_url` config ([#12376](https://github.com/matrix-org/matrix-react-sdk/pull/12376)). Contributed by @t3chguy.
* Remove the Lazy Loading `InvalidStoreError` Dialogs ([#12358](https://github.com/matrix-org/matrix-react-sdk/pull/12358)). Contributed by @langleyd.
* Improve readability of badges and pills ([#12360](https://github.com/matrix-org/matrix-react-sdk/pull/12360)). Contributed by @robintown.



Changes in [1.11.63](https://github.com/element-hq/element-web/releases/tag/v1.11.63) (2024-03-28)
==================================================================================================
This is a hotfix release to fix a couple of issues: one where the client would sometimes call the client/server API to set a push rule in a loop, and one where authentication was not sent for widgets when it should have been.

## 🐛 Bug Fixes

* Revert "Make EC widget theme reactive - Update widget url when the theme changes" ([#12383](https://github.com/matrix-org/matrix-react-sdk/pull/12383)) in order to fix widgets that require authentication.
* Update to hotfixed js-sdk to fix an issue where Element could try to set a push rule in a loop.



Changes in [1.11.62](https://github.com/element-hq/element-web/releases/tag/v1.11.62) (2024-03-26)
==================================================================================================
## ✨ Features

* Change user permission by using a new apply button ([#12346](https://github.com/matrix-org/matrix-react-sdk/pull/12346)). Contributed by @florianduros.
* Mark as Unread ([#12254](https://github.com/matrix-org/matrix-react-sdk/pull/12254)). Contributed by @dbkr.
* Refine the colors of some more components ([#12343](https://github.com/matrix-org/matrix-react-sdk/pull/12343)). Contributed by @robintown.
* TAC: Order rooms by most recent after notification level ([#12329](https://github.com/matrix-org/matrix-react-sdk/pull/12329)). Contributed by @florianduros.
* Make EC widget theme reactive - Update widget url when the theme changes ([#12295](https://github.com/matrix-org/matrix-react-sdk/pull/12295)). Contributed by @toger5.
* Refine styles of menus, toasts, popovers, and modals ([#12332](https://github.com/matrix-org/matrix-react-sdk/pull/12332)). Contributed by @robintown.
* Element Call: fix widget shown while its still loading (`waitForIframeLoad=false`) ([#12292](https://github.com/matrix-org/matrix-react-sdk/pull/12292)). Contributed by @toger5.
* Improve Forward Dialog a11y by switching to roving tab index interactions ([#12306](https://github.com/matrix-org/matrix-react-sdk/pull/12306)). Contributed by @t3chguy.
* Call guest access link creation to join calls as a non registered user via the EC SPA ([#12259](https://github.com/matrix-org/matrix-react-sdk/pull/12259)). Contributed by @toger5.
* Use `strong` element to semantically denote visually emphasised content ([#12320](https://github.com/matrix-org/matrix-react-sdk/pull/12320)). Contributed by @t3chguy.
* Handle up/down arrow keys as well as left/right for horizontal toolbars for improved a11y ([#12305](https://github.com/matrix-org/matrix-react-sdk/pull/12305)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* [Backport staging] Remove the glass border from modal spinners ([#12369](https://github.com/matrix-org/matrix-react-sdk/pull/12369)). Contributed by @RiotRobot.
* Fix incorrect check for private read receipt support ([#12348](https://github.com/matrix-org/matrix-react-sdk/pull/12348)). Contributed by @tulir.
* TAC: Fix hover state when expanded ([#12337](https://github.com/matrix-org/matrix-react-sdk/pull/12337)). Contributed by @florianduros.
* Fix the image view ([#12341](https://github.com/matrix-org/matrix-react-sdk/pull/12341)). Contributed by @robintown.
* Use correct push rule to evaluate room-wide mentions ([#12318](https://github.com/matrix-org/matrix-react-sdk/pull/12318)). Contributed by @t3chguy.
* Reset power selector on API failure to prevent state mismatch ([#12319](https://github.com/matrix-org/matrix-react-sdk/pull/12319)). Contributed by @t3chguy.
* Fix spotlight opening in TAC ([#12315](https://github.com/matrix-org/matrix-react-sdk/pull/12315)). Contributed by @florianduros.



Changes in [1.11.61](https://github.com/element-hq/element-web/releases/tag/v1.11.61) (2024-03-14)
==================================================================================================
* No changes

## 🐛 Bug Fixes

* Update `@vector-im/compound-design-tokens` in package.json ([#12340](https://github.com/matrix-org/matrix-react-sdk/pull/12340)).



Changes in [1.11.60](https://github.com/element-hq/element-web/releases/tag/v1.11.60) (2024-03-12)
==================================================================================================
## ✨ Features

* Refine styles of controls to match Compound ([#12299](https://github.com/matrix-org/matrix-react-sdk/pull/12299)). Contributed by @robintown.
* Hide the archived section ([#12286](https://github.com/matrix-org/matrix-react-sdk/pull/12286)). Contributed by @dbkr.
* Add theme data to EC widget Url ([#12279](https://github.com/matrix-org/matrix-react-sdk/pull/12279)). Contributed by @toger5.
* Update MSC2965 OIDC Discovery implementation ([#12245](https://github.com/matrix-org/matrix-react-sdk/pull/12245)). Contributed by @t3chguy.
* Use green dot for activity notification in `LegacyRoomHeader` ([#12270](https://github.com/matrix-org/matrix-react-sdk/pull/12270)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Fix requests for senders to submit auto-rageshakes ([#12304](https://github.com/matrix-org/matrix-react-sdk/pull/12304)). Contributed by @richvdh.
* fix automatic DM avatar with functional members ([#12157](https://github.com/matrix-org/matrix-react-sdk/pull/12157)). Contributed by @HarHarLinks.
* Feeds event with relation to unknown to the widget ([#12283](https://github.com/matrix-org/matrix-react-sdk/pull/12283)). Contributed by @maheichyk.
* Fix TAC opening with keyboard ([#12285](https://github.com/matrix-org/matrix-react-sdk/pull/12285)). Contributed by @florianduros.
* Allow screenshot update docker to run multiple test files ([#12291](https://github.com/matrix-org/matrix-react-sdk/pull/12291)). Contributed by @dbkr.
* Fix alignment of user menu avatar ([#12289](https://github.com/matrix-org/matrix-react-sdk/pull/12289)). Contributed by @dbkr.
* Fix buttons of widget in a room ([#12288](https://github.com/matrix-org/matrix-react-sdk/pull/12288)). Contributed by @florianduros.
* ModuleAPI: `overwrite_login` action was not stopping the existing client resulting in the action failing with rust-sdk ([#12272](https://github.com/matrix-org/matrix-react-sdk/pull/12272)). Contributed by @BillCarsonFr.



Changes in [1.11.59](https://github.com/element-hq/element-web/releases/tag/v1.11.59) (2024-02-27)
==================================================================================================
## 🦖 Deprecations

* Enable custom themes to theme Compound ([#12240](https://github.com/matrix-org/matrix-react-sdk/pull/12240)). Contributed by @robintown.
* Remove welcome bot `welcome_user_id` support ([#12153](https://github.com/matrix-org/matrix-react-sdk/pull/12153)). Contributed by @t3chguy.

## ✨ Features

* Ignore activity in TAC ([#12269](https://github.com/matrix-org/matrix-react-sdk/pull/12269)). Contributed by @florianduros.
* Use browser's font size instead of hardcoded `16px` as root font size ([#12246](https://github.com/matrix-org/matrix-react-sdk/pull/12246)). Contributed by @florianduros.
* Revert "Use Compound primary colors for most actions" ([#12264](https://github.com/matrix-org/matrix-react-sdk/pull/12264)). Contributed by @florianduros.
* Revert "Refine menu, toast, and popover colors" ([#12263](https://github.com/matrix-org/matrix-react-sdk/pull/12263)). Contributed by @florianduros.
* Fix Native OIDC for Element Desktop ([#12253](https://github.com/matrix-org/matrix-react-sdk/pull/12253)). Contributed by @t3chguy.
* Improve client metadata used for OIDC dynamic registration ([#12257](https://github.com/matrix-org/matrix-react-sdk/pull/12257)). Contributed by @t3chguy.
* Refine menu, toast, and popover colors ([#12247](https://github.com/matrix-org/matrix-react-sdk/pull/12247)). Contributed by @robintown.
* Call the AsJson forms of import and exportRoomKeys ([#12233](https://github.com/matrix-org/matrix-react-sdk/pull/12233)). Contributed by @andybalaam.
* Use Compound primary colors for most actions ([#12241](https://github.com/matrix-org/matrix-react-sdk/pull/12241)). Contributed by @robintown.
* Enable redirected media by default ([#12142](https://github.com/matrix-org/matrix-react-sdk/pull/12142)). Contributed by @turt2live.
* Reduce TAC width by `16px` ([#12239](https://github.com/matrix-org/matrix-react-sdk/pull/12239)). Contributed by @florianduros.
* Pop out of Threads Activity Centre ([#12136](https://github.com/matrix-org/matrix-react-sdk/pull/12136)). Contributed by @florianduros.
* Use new semantic tokens for username colors ([#12209](https://github.com/matrix-org/matrix-react-sdk/pull/12209)). Contributed by @robintown.

## 🐛 Bug Fixes

* [Backport staging] Fix spurious session corruption error ([#12287](https://github.com/matrix-org/matrix-react-sdk/pull/12287)). Contributed by @RiotRobot.
* Fix the space panel getting bigger when gaining a scroll bar ([#12267](https://github.com/matrix-org/matrix-react-sdk/pull/12267)). Contributed by @dbkr.
* Fix gradients spacings on the space panel ([#12262](https://github.com/matrix-org/matrix-react-sdk/pull/12262)). Contributed by @dbkr.
* Remove hardcoded `Element` in tac labs description ([#12266](https://github.com/matrix-org/matrix-react-sdk/pull/12266)). Contributed by @florianduros.
* Fix branding in "migrating crypto" message ([#12265](https://github.com/matrix-org/matrix-react-sdk/pull/12265)). Contributed by @richvdh.
* Use h1 as first heading in dialogs ([#12250](https://github.com/matrix-org/matrix-react-sdk/pull/12250)). Contributed by @dbkr.
* Fix forced lowercase username in login/registration flows ([#9329](https://github.com/matrix-org/matrix-react-sdk/pull/9329)). Contributed by @vrifox.
* Update the TAC indicator on event decryption ([#12243](https://github.com/matrix-org/matrix-react-sdk/pull/12243)). Contributed by @dbkr.
* Fix OIDC delegated auth account url check ([#12242](https://github.com/matrix-org/matrix-react-sdk/pull/12242)). Contributed by @t3chguy.
* New Header edgecase fixes: Close lobby button not shown, disable join button in various places, more... ([#12235](https://github.com/matrix-org/matrix-react-sdk/pull/12235)). Contributed by @toger5.
* Fix TAC button alignment when expanded ([#12238](https://github.com/matrix-org/matrix-react-sdk/pull/12238)). Contributed by @florianduros.
* Fix tooltip behaviour in TAC ([#12236](https://github.com/matrix-org/matrix-react-sdk/pull/12236)). Contributed by @florianduros.



Changes in [1.11.58](https://github.com/element-hq/element-web/releases/tag/v1.11.58) (2024-02-13)
==================================================================================================
## ✨ Features

 * 🦀  🔒 **The flag to enable the Rust crypto implementation is now set to `true` by default. This means that without any additional configuration every new login will use the new cryptography implementation.**
* Add Element call related functionality to new room header ([#12091](https://github.com/matrix-org/matrix-react-sdk/pull/12091)). Contributed by @toger5.
* Add labs flag for Threads Activity Centre ([#12137](https://github.com/matrix-org/matrix-react-sdk/pull/12137)). Contributed by @florianduros.
* Refactor element call lobby + skip lobby ([#12057](https://github.com/matrix-org/matrix-react-sdk/pull/12057)). Contributed by @toger5.
* Hide the "Message" button in the sidebar if the CreateRooms components should not be shown ([#9271](https://github.com/matrix-org/matrix-react-sdk/pull/9271)). Contributed by @dhenneke.
* Add notification dots to thread summary icons ([#12146](https://github.com/matrix-org/matrix-react-sdk/pull/12146)). Contributed by @dbkr.

## 🐛 Bug Fixes

* [Backport staging] Fix the StorageManger detecting a false positive consistency check when manually migrating to rust from labs ([#12230](https://github.com/matrix-org/matrix-react-sdk/pull/12230)). Contributed by @RiotRobot.
* Fix logout can take ages ([#12191](https://github.com/matrix-org/matrix-react-sdk/pull/12191)). Contributed by @BillCarsonFr.
* Fix `Mark all as read` in settings ([#12205](https://github.com/matrix-org/matrix-react-sdk/pull/12205)). Contributed by @florianduros.
* Fix default thread notification of the new RoomHeader ([#12194](https://github.com/matrix-org/matrix-react-sdk/pull/12194)). Contributed by @florianduros.
* Fix display of room notification debug info ([#12183](https://github.com/matrix-org/matrix-react-sdk/pull/12183)). Contributed by @dbkr.



Changes in [1.11.57](https://github.com/element-hq/element-web/releases/tag/v1.11.57) (2024-01-31)
==================================================================================================
## 🦖 Deprecations

* Deprecate welcome bot `welcome_user_id` support ([#26885](https://github.com/element-hq/element-web/pull/26885)). Contributed by @t3chguy.

## ✨ Features

* Expose apps/widgets ([#12071](https://github.com/matrix-org/matrix-react-sdk/pull/12071)). Contributed by @charlynguyen.
* Enable the rust-crypto labs button ([#12114](https://github.com/matrix-org/matrix-react-sdk/pull/12114)). Contributed by @richvdh.
* Show a progress bar while migrating from legacy crypto ([#12104](https://github.com/matrix-org/matrix-react-sdk/pull/12104)). Contributed by @richvdh.
* Update Twemoji to Jdecked v15.0.3 ([#12147](https://github.com/matrix-org/matrix-react-sdk/pull/12147)). Contributed by @t3chguy.
* Change Quick Settings icon ([#12141](https://github.com/matrix-org/matrix-react-sdk/pull/12141)). Contributed by @florianduros.
* Use Compound tooltips more widely ([#12128](https://github.com/matrix-org/matrix-react-sdk/pull/12128)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Fix OIDC bugs due to amnesiac stores forgetting OIDC issuer \& other data ([#12166](https://github.com/matrix-org/matrix-react-sdk/pull/12166)). Contributed by @t3chguy.
* Fix account management link for delegated auth OIDC setups ([#12144](https://github.com/matrix-org/matrix-react-sdk/pull/12144)). Contributed by @t3chguy.
* Fix Safari IME support ([#11016](https://github.com/matrix-org/matrix-react-sdk/pull/11016)). Contributed by @SuperKenVery.
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12127](https://github.com/matrix-org/matrix-react-sdk/pull/12127)).
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12126](https://github.com/matrix-org/matrix-react-sdk/pull/12126)). Contributed by @t3chguy.
* Fix 1F97A and 1F979 in Twemoji COLR font ([#12177](https://github.com/matrix-org/matrix-react-sdk/pull/12177)).
## ✨ Features

* Expose apps/widgets ([#12071](https://github.com/matrix-org/matrix-react-sdk/pull/12071)). Contributed by @charlynguyen.
* Enable the rust-crypto labs button ([#12114](https://github.com/matrix-org/matrix-react-sdk/pull/12114)). Contributed by @richvdh.
* Show a progress bar while migrating from legacy crypto ([#12104](https://github.com/matrix-org/matrix-react-sdk/pull/12104)). Contributed by @richvdh.
* Update Twemoji to Jdecked v15.0.3 ([#12147](https://github.com/matrix-org/matrix-react-sdk/pull/12147)). Contributed by @t3chguy.
* Change Quick Settings icon ([#12141](https://github.com/matrix-org/matrix-react-sdk/pull/12141)). Contributed by @florianduros.
* Use Compound tooltips more widely ([#12128](https://github.com/matrix-org/matrix-react-sdk/pull/12128)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Fix OIDC bugs due to amnesiac stores forgetting OIDC issuer \& other data ([#12166](https://github.com/matrix-org/matrix-react-sdk/pull/12166)). Contributed by @t3chguy.
* Fix account management link for delegated auth OIDC setups ([#12144](https://github.com/matrix-org/matrix-react-sdk/pull/12144)). Contributed by @t3chguy.
* Fix Safari IME support ([#11016](https://github.com/matrix-org/matrix-react-sdk/pull/11016)). Contributed by @SuperKenVery.
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12127](https://github.com/matrix-org/matrix-react-sdk/pull/12127)).
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12126](https://github.com/matrix-org/matrix-react-sdk/pull/12126)). Contributed by @t3chguy.
* Fix 1F97A and 1F979 in Twemoji COLR font ([#12177](https://github.com/matrix-org/matrix-react-sdk/pull/12177)).
## ✨ Features

* Use jitsi-lobby in video channel (video rooms) ([#26879](https://github.com/element-hq/element-web/pull/26879)). Contributed by @toger5.



Changes in [1.11.55](https://github.com/element-hq/element-web/releases/tag/v1.11.55) (2024-01-19)
==================================================================================================


## ✨ Features

* Broaden support for matrix spec versions ([#12159](https://github.com/matrix-org/matrix-react-sdk/pull/12159)). Contributed by @RiotRobot.

## 🐛 Bug Fixes

* Fixed shield alignment on message Input ([#12155](https://github.com/matrix-org/matrix-react-sdk/pull/12155)). Contributed by @RiotRobot.


Changes in [1.11.54](https://github.com/element-hq/element-web/releases/tag/v1.11.54) (2024-01-16)
==================================================================================================
## 🐛 Bug Fixes

* Fix CSS stacking context order determinism ([#26840](https://github.com/element-hq/element-web/pull/26840)). Contributed by @t3chguy.

## ✨ Features

* Accessibility improvements around aria-labels and tooltips ([#12062](https://github.com/matrix-org/matrix-react-sdk/pull/12062)). Contributed by @t3chguy.
* Add RoomKnocksBar to RoomHeader ([#12077](https://github.com/matrix-org/matrix-react-sdk/pull/12077)). Contributed by @charlynguyen.
* Adjust tooltip side for DecoratedRoomAvatar to not obscure room name ([#12079](https://github.com/matrix-org/matrix-react-sdk/pull/12079)). Contributed by @t3chguy.
* Iterate landmarks around the app in order to improve a11y ([#12064](https://github.com/matrix-org/matrix-react-sdk/pull/12064)). Contributed by @t3chguy.
* Update element call embedding UI ([#12056](https://github.com/matrix-org/matrix-react-sdk/pull/12056)). Contributed by @toger5.
* Use Compound tooltips instead of homegrown in TextWithTooltip \& InfoTooltip ([#12052](https://github.com/matrix-org/matrix-react-sdk/pull/12052)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Fix regression around CSS stacking contexts and PIP widgets ([#12094](https://github.com/matrix-org/matrix-react-sdk/pull/12094)). Contributed by @t3chguy.
* Fix Identity Server terms accepting not working as expected ([#12109](https://github.com/matrix-org/matrix-react-sdk/pull/12109)). Contributed by @t3chguy.
* fix: microphone and camera dropdown doesn't work In legacy call ([#12105](https://github.com/matrix-org/matrix-react-sdk/pull/12105)). Contributed by @muratersin.
* Revert "Set up key backup using non-deprecated APIs (#12005)" ([#12102](https://github.com/matrix-org/matrix-react-sdk/pull/12102)). Contributed by @BillCarsonFr.
* Fix regression around read receipt animation from refs changes ([#12100](https://github.com/matrix-org/matrix-react-sdk/pull/12100)). Contributed by @t3chguy.
* Added meaning full error message based on platform ([#12074](https://github.com/matrix-org/matrix-react-sdk/pull/12074)). Contributed by @Pankaj-SinghR.
* Fix editing event from search room view ([#11992](https://github.com/matrix-org/matrix-react-sdk/pull/11992)). Contributed by @t3chguy.
* Fix timeline position when moving to a room and coming back ([#12055](https://github.com/matrix-org/matrix-react-sdk/pull/12055)). Contributed by @florianduros.
* Fix threaded reply playwright tests ([#12070](https://github.com/matrix-org/matrix-react-sdk/pull/12070)). Contributed by @dbkr.
* Element-R: fix repeated requests to enter 4S key during cross-signing reset ([#12059](https://github.com/matrix-org/matrix-react-sdk/pull/12059)). Contributed by @richvdh.
* Fix position of thumbnail in room timeline ([#12016](https://github.com/matrix-org/matrix-react-sdk/pull/12016)). Contributed by @anoopw3bdev.


Changes in [1.11.53](https://github.com/element-hq/element-web/releases/tag/v1.11.53) (2024-01-04)
==================================================================================================

## 🐛 Bug Fixes

* Fix a fresh login creating a new key backup ([#12106](https://github.com/matrix-org/matrix-react-sdk/pull/12106)).

**Changelogs for older versions can be found [here](docs/changelogs).**
