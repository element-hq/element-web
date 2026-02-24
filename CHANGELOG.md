Changes in [1.12.11](https://github.com/element-hq/element-desktop/releases/tag/v1.12.11) (2026-02-24)
======================================================================================================
## 🦖 Deprecations

* Remove UIFeature.BulkUnverifiedSessionsReminder setting ([#31943](https://github.com/element-hq/element-web/pull/31943)). Contributed by @andybalaam.
* Remove unused function to auto-rageshake when key backup is not set up ([#31942](https://github.com/element-hq/element-web/pull/31942)). Contributed by @andybalaam.

## ✨ Features

* Room list: update the visuals in order to have better contrast ([#32421](https://github.com/element-hq/element-web/pull/32421)). Contributed by @florianduros.
*  Set history visibility to "invited" for DMs and new non-public rooms when creating a room ([#31974](https://github.com/element-hq/element-web/pull/31974)). Contributed by @langleyd.
* Remove server acl status/summaries from timeline  ([#32461](https://github.com/element-hq/element-web/pull/32461)). Contributed by @langleyd.
* Update `globalBlacklistUnverifiedDevices` on setting change ([#31983](https://github.com/element-hq/element-web/pull/31983)). Contributed by @kaylendog.
* Add badge for history visibiltity to room info panel ([#31927](https://github.com/element-hq/element-web/pull/31927)). Contributed by @richvdh.

## 🐛 Bug Fixes

* Revert exit logic PRs ([#2847](https://github.com/element-hq/element-desktop/pull/2847)). Contributed by @MidhunSureshR.
* Fix issues with quit logic ([#2840](https://github.com/element-hq/element-desktop/pull/2840)). Contributed by @MidhunSureshR.
* Default useOnlyCurrentProfiles to true ([#32524](https://github.com/element-hq/element-web/pull/32524)). Contributed by @dbkr.
* Keep custom theme active after reload ([#32506](https://github.com/element-hq/element-web/pull/32506)). Contributed by @florianduros.
* Update font format from 'ttf' to 'truetype' ([#32493](https://github.com/element-hq/element-web/pull/32493)). Contributed by @all-yall.
* Fix videos on Firefox ([#32497](https://github.com/element-hq/element-web/pull/32497)). Contributed by @p1gp1g.
* Use a dedicated FAQ/help entry for key storage. ([#32480](https://github.com/element-hq/element-web/pull/32480)). Contributed by @mxandreas.
* Avoid showing two chat timelines side by side after a call ([#32484](https://github.com/element-hq/element-web/pull/32484)). Contributed by @robintown.
* Update screenshot for reactive display name disambiguation ([#32431](https://github.com/element-hq/element-web/pull/32431)). Contributed by @aditya-cherukuru.
* Fix Status Bar being unreadable when the user overrides the default OS light/dark theme. ([#32442](https://github.com/element-hq/element-web/pull/32442)). Contributed by @Half-Shot.
* fix: Remove state\_key: null from Seshat search results ([#31524](https://github.com/element-hq/element-web/pull/31524)). Contributed by @shinaoka.
* Fix user pill deserialisation ([#31947](https://github.com/element-hq/element-web/pull/31947)). Contributed by @t3chguy.



Changes in [1.12.10](https://github.com/element-hq/element-desktop/releases/tag/v1.12.10) (2026-02-10)
======================================================================================================
## ✨ Features

* Generate badge icon for macOS DMG ([#2809](https://github.com/element-hq/element-desktop/pull/2809)). Contributed by @t3chguy.
* Support additional\_creators in /upgraderoom (MSC4289) ([#31934](https://github.com/element-hq/element-web/pull/31934)). Contributed by @andybalaam.
* Update room header icon for world\_readable rooms ([#31915](https://github.com/element-hq/element-web/pull/31915)). Contributed by @richvdh.
* Show an icon in the room header for shared history ([#31879](https://github.com/element-hq/element-web/pull/31879)). Contributed by @richvdh.
* Remove "history may be shared" banner. ([#31881](https://github.com/element-hq/element-web/pull/31881)). Contributed by @kaylendog.
* Allow dismissing 'Key storage out of sync' temporarily ([#31455](https://github.com/element-hq/element-web/pull/31455)). Contributed by @andybalaam.
* Add `resolutions` entry for `matrix-widget-api` to package.json ([#31851](https://github.com/element-hq/element-web/pull/31851)). Contributed by @toger5.
* Improve visibility under contrast control mode ([#31847](https://github.com/element-hq/element-web/pull/31847)). Contributed by @t3chguy.
* Unread Sorting - Add option for sorting in `OptionsMenuView` ([#31754](https://github.com/element-hq/element-web/pull/31754)). Contributed by @MidhunSureshR.
* Unread sorting - Implement sorter and use it in the room list store ([#31723](https://github.com/element-hq/element-web/pull/31723)). Contributed by @MidhunSureshR.
* Allow Element Call widgets to receive sticky events ([#31843](https://github.com/element-hq/element-web/pull/31843)). Contributed by @robintown.
* Improve icon rendering accessibility ([#31791](https://github.com/element-hq/element-web/pull/31791)). Contributed by @t3chguy.
* Add message preview toggle to room list header option ([#31821](https://github.com/element-hq/element-web/pull/31821)). Contributed by @florianduros.

## 🐛 Bug Fixes

* [Backport staging] Fix room list not being cleared ([#32438](https://github.com/element-hq/element-web/pull/32438)). Contributed by @RiotRobot.
* Fix failure to update room info panel on joinrule change ([#31938](https://github.com/element-hq/element-web/pull/31938)). Contributed by @richvdh.
* Throttle space notification state calculation ([#31922](https://github.com/element-hq/element-web/pull/31922)). Contributed by @dbkr.
* Fix emoji verification responsive layout ([#31899](https://github.com/element-hq/element-web/pull/31899)). Contributed by @t3chguy.
* Add patch for linkify to fix doctype handling ([#31900](https://github.com/element-hq/element-web/pull/31900)). Contributed by @dbkr.
* Fix rooms with no messages appearing at the top of the room list ([#31798](https://github.com/element-hq/element-web/pull/31798)). Contributed by @MidhunSureshR.
* Fix room list menu flashes when menu is closed ([#31868](https://github.com/element-hq/element-web/pull/31868)). Contributed by @florianduros.
* Message preview toggle is inverted in room list header ([#31865](https://github.com/element-hq/element-web/pull/31865)). Contributed by @florianduros.
* Fix duplicate toasts appearing for the same call if two events appear. ([#31693](https://github.com/element-hq/element-web/pull/31693)). Contributed by @Half-Shot.
* Fix ability to send rageshake during session restore failure ([#31848](https://github.com/element-hq/element-web/pull/31848)). Contributed by @t3chguy.
* Fix mis-alignment of `Threads` right panel title ([#31849](https://github.com/element-hq/element-web/pull/31849)). Contributed by @t3chguy.
* Unset buttons does not include color inherit ([#31801](https://github.com/element-hq/element-web/pull/31801)). Contributed by @Philldomd.



Changes in [1.12.9](https://github.com/element-hq/element-desktop/releases/tag/v1.12.9) (2026-01-27)
====================================================================================================
## ✨ Features

* Update macOS icon to use Icon Composer format ([#2791](https://github.com/element-hq/element-desktop/pull/2791)). Contributed by @t3chguy.
* Update macOS icon ([#2787](https://github.com/element-hq/element-desktop/pull/2787)). Contributed by @t3chguy.
* Update app icons ([#2778](https://github.com/element-hq/element-desktop/pull/2778)). Contributed by @t3chguy.
* Allow local log downloads when a rageshake URL is not configured. ([#31716](https://github.com/element-hq/element-web/pull/31716)). Contributed by @Half-Shot.
* Improve icon rendering accessibility ([#31776](https://github.com/element-hq/element-web/pull/31776)). Contributed by @t3chguy.
* Show "Bob shared this message" on messages shared via MSC4268 ([#31684](https://github.com/element-hq/element-web/pull/31684)). Contributed by @richvdh.
* Update the way we render icons for accessibility ([#31731](https://github.com/element-hq/element-web/pull/31731)). Contributed by @t3chguy.
* Switch from css masks to rendering svg ([#31681](https://github.com/element-hq/element-web/pull/31681)). Contributed by @t3chguy.
* Support for stable MSC4191 account management action parameter ([#31701](https://github.com/element-hq/element-web/pull/31701)). Contributed by @hughns.
* Support for stable m.oauth UIA stage from MSC4312 ([#31704](https://github.com/element-hq/element-web/pull/31704)). Contributed by @hughns.
* Switch to Compound icons to replace old icons ([#31667](https://github.com/element-hq/element-web/pull/31667)). Contributed by @t3chguy.
* Switch from svg masks to svg rendering in more places ([#31652](https://github.com/element-hq/element-web/pull/31652)). Contributed by @t3chguy.
* Switch from svg masks to svg rendering in more places ([#31650](https://github.com/element-hq/element-web/pull/31650)). Contributed by @t3chguy.
* Update notification icons using Compound icons ([#31671](https://github.com/element-hq/element-web/pull/31671)). Contributed by @t3chguy.
* Memoise ListView context  ([#31668](https://github.com/element-hq/element-web/pull/31668)). Contributed by @t3chguy.
* Switch emoji picker to use emoji for header icons ([#31645](https://github.com/element-hq/element-web/pull/31645)). Contributed by @t3chguy.
* Replace icons with Compound alternatives ([#31642](https://github.com/element-hq/element-web/pull/31642)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Update macOS icon to use Icon Composer format ([#2791](https://github.com/element-hq/element-desktop/pull/2791)). Contributed by @t3chguy.
* Fix not starting on linux when user is not in /etc/passwd ([#2783](https://github.com/element-hq/element-desktop/pull/2783)). Contributed by @nim65s.
* Fix avatar decorations in thread activity centre not being atop avatar ([#31789](https://github.com/element-hq/element-web/pull/31789)). Contributed by @t3chguy.
* Fix room settings roles tab getting confused if power level change fails ([#31768](https://github.com/element-hq/element-web/pull/31768)). Contributed by @t3chguy.
* Custom themes now import highlights in css ([#31758](https://github.com/element-hq/element-web/pull/31758)). Contributed by @Philldomd.
* Use correct translation for url preview settings ([#31740](https://github.com/element-hq/element-web/pull/31740)). Contributed by @florianduros.
* Fix error shown if accepting a 3pid invite ([#31735](https://github.com/element-hq/element-web/pull/31735)). Contributed by @dbkr.
* Ensure correct focus configuration for Element Call before allowing users to call. ([#31490](https://github.com/element-hq/element-web/pull/31490)). Contributed by @Half-Shot.
* Fix emoji font in emoji picker header buttons ([#31679](https://github.com/element-hq/element-web/pull/31679)). Contributed by @t3chguy.
* fix flaky test by waiting for chat panel before counting messages ([#31633](https://github.com/element-hq/element-web/pull/31633)). Contributed by @BillCarsonFr.



Changes in [1.12.8](https://github.com/element-hq/element-desktop/releases/tag/v1.12.8) (2026-01-13)
====================================================================================================
## 🦖 Deprecations

* Remove `element_call.participant_limit` config and associated code. ([#31638](https://github.com/element-hq/element-web/pull/31638)). Contributed by @Half-Shot.

## ✨ Features

* Switch to rendering svg icons rather than masking them ([#31557](https://github.com/element-hq/element-web/pull/31557)). Contributed by @t3chguy.
* Update history visibility UX ([#31635](https://github.com/element-hq/element-web/pull/31635)). Contributed by @langleyd.
* Show correct call icon for joining a call. ([#31489](https://github.com/element-hq/element-web/pull/31489)). Contributed by @Half-Shot.
* Update StopGapWidgetDriver to support sticky events ([#31205](https://github.com/element-hq/element-web/pull/31205)). Contributed by @Half-Shot.
* Remove release announcements for new sounds \& room list ([#31544](https://github.com/element-hq/element-web/pull/31544)). Contributed by @t3chguy.
* Add button to restore from backup into /devtools ([#31581](https://github.com/element-hq/element-web/pull/31581)). Contributed by @mxandreas.
* Switch to non-solid compound icons for room settings \& composer ([#31561](https://github.com/element-hq/element-web/pull/31561)). Contributed by @t3chguy.
* Support encrypted state events MSC4362 ([#31513](https://github.com/element-hq/element-web/pull/31513)). Contributed by @andybalaam.
* Update prop type \& documentation for HistoryVisibleBanner and VM. ([#31545](https://github.com/element-hq/element-web/pull/31545)). Contributed by @kaylendog.
* Switch to Compound icons in more places ([#31560](https://github.com/element-hq/element-web/pull/31560)). Contributed by @t3chguy.
* Switch to rendering svg icons rather than masking them ([#31550](https://github.com/element-hq/element-web/pull/31550)). Contributed by @t3chguy.
* Make AccessibleButton contrast control compatible ([#31308](https://github.com/element-hq/element-web/pull/31308)). Contributed by @t3chguy.
* Switch to compound-design-tokens for platform icons ([#31543](https://github.com/element-hq/element-web/pull/31543)). Contributed by @t3chguy.
* Switch to rendering svg icons rather than masking them ([#31531](https://github.com/element-hq/element-web/pull/31531)). Contributed by @t3chguy.
* Switch to rendering svg icons rather than css masking ([#31517](https://github.com/element-hq/element-web/pull/31517)). Contributed by @t3chguy.
* Auto approve matrix rtc member event (`m.rtc.member`) (sticky events) ([#31452](https://github.com/element-hq/element-web/pull/31452)). Contributed by @toger5.
* Size Autocomplete relative to the RoomView height rather than the viewport height ([#31425](https://github.com/element-hq/element-web/pull/31425)). Contributed by @langleyd.
* Implement UI for history visibility acknowledgement. ([#31156](https://github.com/element-hq/element-web/pull/31156)). Contributed by @kaylendog.
* Export disposing hook from package ([#31498](https://github.com/element-hq/element-web/pull/31498)). Contributed by @MidhunSureshR.
* Change `header-panel-bg-hover` to use `var(--cpd-color-bg-action-secondary-hovered)` for better custom theming ([#31457](https://github.com/element-hq/element-web/pull/31457)). Contributed by @th0mcat.
* Improve icon rendering in iconized context menu ([#31458](https://github.com/element-hq/element-web/pull/31458)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Fix `Ctrl+Q` not closing the app ([#2749](https://github.com/element-hq/element-desktop/pull/2749)). Contributed by @MidhunSureshR.
* [Backport staging] Fix space settings visibility tab crashing ([#31705](https://github.com/element-hq/element-web/pull/31705)). Contributed by @RiotRobot.
* Fix expand/collapse reply preview not showing in some cases ([#31639](https://github.com/element-hq/element-web/pull/31639)). Contributed by @t3chguy.
* Fix bundled font or custom font not applied after theme switch ([#31591](https://github.com/element-hq/element-web/pull/31591)). Contributed by @florianduros.
* Add ol override CSS for markdown-body ([#31618](https://github.com/element-hq/element-web/pull/31618)). Contributed by @niamu.
* Fix reaction left margin in timeline card ([#31625](https://github.com/element-hq/element-web/pull/31625)). Contributed by @t3chguy.
* Open right panel timeline when jumping to event with maximised widget ([#31626](https://github.com/element-hq/element-web/pull/31626)). Contributed by @t3chguy.
* Fix Compound Link elements not having an underline. ([#31583](https://github.com/element-hq/element-web/pull/31583)). Contributed by @Half-Shot.
* Recalculate mentions metadata of forwarded messages based on message body ([#31193](https://github.com/element-hq/element-web/pull/31193)). Contributed by @twassman.
* Fix Room Preview Card Layout ([#31611](https://github.com/element-hq/element-web/pull/31611)). Contributed by @germain-gg.
* Fix: WidgetMessaging not properly closed causing side effects and bugs ([#31598](https://github.com/element-hq/element-web/pull/31598)). Contributed by @BillCarsonFr.
* Handle cross-signing keys missing locally and/or from secret storage ([#31367](https://github.com/element-hq/element-web/pull/31367)). Contributed by @uhoreg.
* fix: Allow wrapping in `Banner` component. ([#31532](https://github.com/element-hq/element-web/pull/31532)). Contributed by @kaylendog.
* Update algorithm for history visible banner. ([#31577](https://github.com/element-hq/element-web/pull/31577)). Contributed by @kaylendog.
* Fix styling issue when using EW modules ([#31533](https://github.com/element-hq/element-web/pull/31533)). Contributed by @florianduros.
* Prevent history visible banner from displaying in threads. ([#31535](https://github.com/element-hq/element-web/pull/31535)). Contributed by @kaylendog.
* Make the feedback icon be the right color in dark theme ([#31527](https://github.com/element-hq/element-web/pull/31527)). Contributed by @robintown.



Changes in [1.12.7](https://github.com/element-hq/element-desktop/releases/tag/v1.12.7) (2025-12-16)
====================================================================================================
## ✨ Features

* Replace legacy icons with compound ([#31424](https://github.com/element-hq/element-web/pull/31424)). Contributed by @t3chguy.
* Update polls UX to match EX Mobile and improve accessibility ([#31245](https://github.com/element-hq/element-web/pull/31245)). Contributed by @langleyd.
* Add option to enable read receipt and marker when user interact with UI ([#31353](https://github.com/element-hq/element-web/pull/31353)). Contributed by @florianduros.
* Introduce a hook to auto dispose view models ([#31178](https://github.com/element-hq/element-web/pull/31178)). Contributed by @MidhunSureshR.
* Update settings toggles to use consistent design across app. ([#30169](https://github.com/element-hq/element-web/pull/30169)). Contributed by @Half-Shot.
* Add ability to the room view to hide widgets ([#31400](https://github.com/element-hq/element-web/pull/31400)). Contributed by @langleyd.
* call: Pass the echo cancellation and noise suppression settings to EC ([#31317](https://github.com/element-hq/element-web/pull/31317)). Contributed by @BillCarsonFr.
* Tweak rendering of icons for a11y ([#31358](https://github.com/element-hq/element-web/pull/31358)). Contributed by @t3chguy.
* Implement new `renderNotificationDecoration` from module API  ([#31389](https://github.com/element-hq/element-web/pull/31389)). Contributed by @MidhunSureshR.
* Replace more icons with compound ([#31381](https://github.com/element-hq/element-web/pull/31381)). Contributed by @t3chguy.
* Replace more icons with compound ([#31378](https://github.com/element-hq/element-web/pull/31378)). Contributed by @t3chguy.
* `<Banner/>`: Hide `Dismiss` button if `onClose` handler is not provided. ([#31362](https://github.com/element-hq/element-web/pull/31362)). Contributed by @kaylendog.
* Replace batch of legacy icons with compound design tokens ([#31360](https://github.com/element-hq/element-web/pull/31360)). Contributed by @t3chguy.
* MSC4380: Invite blocking ([#31268](https://github.com/element-hq/element-web/pull/31268)). Contributed by @richvdh.
* Tweak rendering of icons for accessibility ([#31346](https://github.com/element-hq/element-web/pull/31346)). Contributed by @t3chguy.
* Implement a shared `Banner` component. ([#31266](https://github.com/element-hq/element-web/pull/31266)). Contributed by @kaylendog.
* Allow the Login screen to use the dark theme ([#31293](https://github.com/element-hq/element-web/pull/31293)). Contributed by @richvdh.

## 🐛 Bug Fixes

* [Backport staging] Amend e2e normal icon from lock-solid to info ([#31559](https://github.com/element-hq/element-web/pull/31559)). Contributed by @t3chguy.
* [Backport staging] Fix CSS specificity causing icon issues in e2e verification ([#31548](https://github.com/element-hq/element-web/pull/31548)). Contributed by @RiotRobot.
* [Backport staging] Fix e2e icons in CompleteSecurity \& SetupEncryptionBody ([#31522](https://github.com/element-hq/element-web/pull/31522)). Contributed by @RiotRobot.
* [Backport staging] Remove an extra paragraph in advanced room settings ([#31511](https://github.com/element-hq/element-web/pull/31511)). Contributed by @RiotRobot.
* [Backport staging] Don't show the key storage out of sync toast when backup disabled ([#31507](https://github.com/element-hq/element-web/pull/31507)). Contributed by @RiotRobot.
* Fix composer button visibility in contrast colour mode ([#31255](https://github.com/element-hq/element-web/pull/31255)). Contributed by @t3chguy.
* Ensure correct room version is used and permissions are appropriately sert when creating rooms ([#31464](https://github.com/element-hq/element-web/pull/31464)). Contributed by @Half-Shot.
* Fix e2e icon rendering ([#31454](https://github.com/element-hq/element-web/pull/31454)). Contributed by @t3chguy.
* EventIndexer: ensure we add initial checkpoints when the db is first opened ([#31448](https://github.com/element-hq/element-web/pull/31448)). Contributed by @richvdh.
* Fix `/join <alias>` command failing due to race condition ([#31433](https://github.com/element-hq/element-web/pull/31433)). Contributed by @MidhunSureshR.
* MessageEventIndexDialog: distinguish indexed rooms ([#31436](https://github.com/element-hq/element-web/pull/31436)). Contributed by @richvdh.
* Move `EditInPlace` out of `Form` (Fixes: reloading EW on EC url update) ([#31434](https://github.com/element-hq/element-web/pull/31434)). Contributed by @toger5.
* Fixes issue where cursor would jump to the beginning of the input field after converting Japanese text and pressing Tab ([#31432](https://github.com/element-hq/element-web/pull/31432)). Contributed by @shinaoka.
* Fix widgets getting stuck in loading states ([#31314](https://github.com/element-hq/element-web/pull/31314)). Contributed by @robintown.
* Room list: fix room options remaining on room item after mouse leaving ([#31414](https://github.com/element-hq/element-web/pull/31414)). Contributed by @florianduros.
* Make `RoomList.showMessagePreview` configurable by `config.json` ([#31419](https://github.com/element-hq/element-web/pull/31419)). Contributed by @florianduros.
* Fix bug which caused app not to load correctly when `force_verification` is enabled ([#31265](https://github.com/element-hq/element-web/pull/31265)). Contributed by @richvdh.
* Room list: display the menu option on the room list item when clicked/opened ([#31380](https://github.com/element-hq/element-web/pull/31380)). Contributed by @florianduros.
* Fix handling of SVGs ([#31359](https://github.com/element-hq/element-web/pull/31359)). Contributed by @t3chguy.
* Fix word wrapping in expanded left panel buttons ([#31377](https://github.com/element-hq/element-web/pull/31377)). Contributed by @t3chguy.
* Fix aspect ratio on error view background ([#31361](https://github.com/element-hq/element-web/pull/31361)). Contributed by @t3chguy.
* Fix failure to request persistent storage perms ([#31299](https://github.com/element-hq/element-web/pull/31299)). Contributed by @richvdh.
* Fix calls sometimes not knowing that they're presented ([#31313](https://github.com/element-hq/element-web/pull/31313)). Contributed by @robintown.



Changes in [1.12.6](https://github.com/element-hq/element-desktop/releases/tag/v1.12.6) (2025-12-03)
====================================================================================================
This release fixes a bug where 1:1 calling was incorrectly not available if no Element Call focus was set.

## 🐛 Bug Fixes

* Add option to pick call options for voice calls. ([#31413](https://github.com/element-hq/element-web/pull/31413)).



Changes in [1.12.5](https://github.com/element-hq/element-desktop/releases/tag/v1.12.5) (2025-12-02)
====================================================================================================
## ✨ Features

* Update Emojibase to v17 ([#31307](https://github.com/element-hq/element-web/pull/31307)). Contributed by @t3chguy.
* Adds tooltip for compose menu ([#31122](https://github.com/element-hq/element-web/pull/31122)). Contributed by @byteplow.
* Add option to hide pinned message banner in room view ([#31296](https://github.com/element-hq/element-web/pull/31296)). Contributed by @florianduros.
* update twemoji to not monochromise emoji with BLACK in their name ([#31281](https://github.com/element-hq/element-web/pull/31281)). Contributed by @ara4n.
* upgrade to twemoji 17.0.2 and fix #14695 ([#31267](https://github.com/element-hq/element-web/pull/31267)). Contributed by @ara4n.
* Add options to hide right panel in room view ([#31252](https://github.com/element-hq/element-web/pull/31252)). Contributed by @florianduros.
* Delayed event management: split endpoints, no auth  ([#31183](https://github.com/element-hq/element-web/pull/31183)). Contributed by @AndrewFerr.
* Support using Element Call for voice calls in DMs ([#30817](https://github.com/element-hq/element-web/pull/30817)). Contributed by @Half-Shot.
* Improve screen reader accessibility of auth pages ([#31236](https://github.com/element-hq/element-web/pull/31236)). Contributed by @t3chguy.
* Add posthog tracking for key backup toasts ([#31195](https://github.com/element-hq/element-web/pull/31195)). Contributed by @Half-Shot.

## 🐛 Bug Fixes

* Return to using Fira Code as the default monospace font ([#31302](https://github.com/element-hq/element-web/pull/31302)). Contributed by @ara4n.
* Fix case of home screen being displayed erroneously  ([#31301](https://github.com/element-hq/element-web/pull/31301)). Contributed by @langleyd.
* Fix message edition and reply when multiple rooms at displayed the same moment ([#31280](https://github.com/element-hq/element-web/pull/31280)). Contributed by @florianduros.
* Key storage out of sync: reset key backup when needed ([#31279](https://github.com/element-hq/element-web/pull/31279)). Contributed by @uhoreg.
* Fix invalid events crashing entire room rather than just their tile ([#31256](https://github.com/element-hq/element-web/pull/31256)). Contributed by @t3chguy.
* Fix expand button of space panel getting cut off at the edges ([#31259](https://github.com/element-hq/element-web/pull/31259)). Contributed by @MidhunSureshR.
* Fix pill buttons in dialogs ([#31246](https://github.com/element-hq/element-web/pull/31246)). Contributed by @dbkr.
* Fix blank sections at the top and bottom of the member list when scrolling ([#31198](https://github.com/element-hq/element-web/pull/31198)). Contributed by @langleyd.
* Fix emoji category selection with keyboard ([#31162](https://github.com/element-hq/element-web/pull/31162)). Contributed by @langleyd.



Changes in [1.12.4](https://github.com/element-hq/element-desktop/releases/tag/v1.12.4) (2025-11-18)
====================================================================================================
## ✨ Features

* Update nightly and release builds to use the dedicated subdomain for 'bug\_report\_endpoint\_url' ([#2677](https://github.com/element-hq/element-desktop/pull/2677)). Contributed by @benbz.
* Apply aria-hidden to emoji in SAS verification ([#31204](https://github.com/element-hq/element-web/pull/31204)). Contributed by @t3chguy.
* Add options to hide header and composer of room view for the module api ([#31095](https://github.com/element-hq/element-web/pull/31095)). Contributed by @florianduros.
* Experimental Module API Additions ([#30863](https://github.com/element-hq/element-web/pull/30863)). Contributed by @dbkr.
* Change polls to use fieldset/legend markup ([#31160](https://github.com/element-hq/element-web/pull/31160)). Contributed by @langleyd.
* Use compound Button styles for Jitsi button ([#31159](https://github.com/element-hq/element-web/pull/31159)). Contributed by @Half-Shot.
* Add FocusLock to emoji picker ([#31146](https://github.com/element-hq/element-web/pull/31146)). Contributed by @langleyd.
* Move room name, avatar, and topic to IOpts. ([#30981](https://github.com/element-hq/element-web/pull/30981)). Contributed by @kaylendog.
* Add a devtool for looking at users and their devices ([#30983](https://github.com/element-hq/element-web/pull/30983)). Contributed by @uhoreg.

## 🐛 Bug Fixes

* Fix room list handling of membership changes ([#31197](https://github.com/element-hq/element-web/pull/31197)). Contributed by @t3chguy.
* Fix room list unable to be resized when displayed after a module ([#31186](https://github.com/element-hq/element-web/pull/31186)). Contributed by @florianduros.
* Inhibit keyboard highlights in dialogs when effector is not in focus ([#31181](https://github.com/element-hq/element-web/pull/31181)). Contributed by @t3chguy.
* Strip mentions from forwarded messages ([#30884](https://github.com/element-hq/element-web/pull/30884)). Contributed by @twassman.
* Don't allow pin or edit of messages with a send status ([#31158](https://github.com/element-hq/element-web/pull/31158)). Contributed by @langleyd.
* Hide room header buttons if the room hasn't been created yet. ([#31092](https://github.com/element-hq/element-web/pull/31092)). Contributed by @Half-Shot.
* Fix screen readers not indicating the emoji picker search field is focused. ([#31128](https://github.com/element-hq/element-web/pull/31128)). Contributed by @langleyd.
* Fix emoji picker highlight missing when not active element ([#31148](https://github.com/element-hq/element-web/pull/31148)). Contributed by @t3chguy.
* Add relevant aria attribute for selected emoji in the emoji picker ([#31125](https://github.com/element-hq/element-web/pull/31125)). Contributed by @t3chguy.
* Fix tooltips within context menu portals being unreliable ([#31129](https://github.com/element-hq/element-web/pull/31129)). Contributed by @t3chguy.
* Avoid excessive re-render of room list and member list ([#31131](https://github.com/element-hq/element-web/pull/31131)). Contributed by @florianduros.
* Make emoji picker height responsive. ([#31130](https://github.com/element-hq/element-web/pull/31130)). Contributed by @langleyd.
* Emoji Picker: Focused emoji does not move with the arrow keys ([#30893](https://github.com/element-hq/element-web/pull/30893)). Contributed by @langleyd.
* Fix audio player seek bar position  ([#31127](https://github.com/element-hq/element-web/pull/31127)). Contributed by @florianduros.
* Add aria label to emoji picker search ([#31126](https://github.com/element-hq/element-web/pull/31126)). Contributed by @langleyd.



Changes in [1.12.3](https://github.com/element-hq/element-desktop/releases/tag/v1.12.3) (2025-11-04)
====================================================================================================
## 🦖 Deprecations

* Remove allowVoipWithNoMedia feature flag ([#31087](https://github.com/element-hq/element-web/pull/31087)). Contributed by @Half-Shot.

## ✨ Features

* Change module API to be an instance getter ([#31025](https://github.com/element-hq/element-web/pull/31025)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Wait for Electron to be ready before we fire syntax error dialog ([#2659](https://github.com/element-hq/element-desktop/pull/2659)). Contributed by @t3chguy.
* Show hover elements when keyboard focus is within an event tile ([#31078](https://github.com/element-hq/element-web/pull/31078)). Contributed by @t3chguy.
* Ensure toolbar navigation pattern works in MessageActionBar ([#31080](https://github.com/element-hq/element-web/pull/31080)). Contributed by @t3chguy.
* Ensure sent markers are hidden when showing thread summary. ([#31076](https://github.com/element-hq/element-web/pull/31076)). Contributed by @Half-Shot.
* Fix translation in dev mode ([#31045](https://github.com/element-hq/element-web/pull/31045)). Contributed by @florianduros.
* Fix sort order in space hierarchy ([#30975](https://github.com/element-hq/element-web/pull/30975)). Contributed by @t3chguy.
* New Room list: don't display message preview of thread ([#31043](https://github.com/element-hq/element-web/pull/31043)). Contributed by @florianduros.
* Revert "A11y: move focus to right panel when opened" ([#30999](https://github.com/element-hq/element-web/pull/30999)). Contributed by @florianduros.
* Fix highlights in messages (or search results) breaking links ([#30264](https://github.com/element-hq/element-web/pull/30264)). Contributed by @bojidar-bg.
* Add prepare script ([#31030](https://github.com/element-hq/element-web/pull/31030)). Contributed by @dbkr.
* Fix html exports by adding SDKContext ([#30987](https://github.com/element-hq/element-web/pull/30987)). Contributed by @t3chguy.



Changes in [1.12.2](https://github.com/element-hq/element-desktop/releases/tag/v1.12.2) (2025-10-21)
====================================================================================================
## ✨ Features

* Allow Desktop app to be auto-started minimised or focused ([#2622](https://github.com/element-hq/element-desktop/pull/2622)). Contributed by @t3chguy.
* Room List: Extend the viewport to avoid so many black spots when scrolling the room list ([#30867](https://github.com/element-hq/element-web/pull/30867)). Contributed by @langleyd.
* Hide calling buttons in room header before a room is created ([#30816](https://github.com/element-hq/element-web/pull/30816)). Contributed by @Half-Shot.
* Improve invite dialog ui - Part 2 ([#30836](https://github.com/element-hq/element-web/pull/30836)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Fix hardlinks appearing in and breaking deb packages ([#2609](https://github.com/element-hq/element-desktop/pull/2609)). Contributed by @t3chguy.
* Fix platform settings race condition and make auto-launch tri-state ([#30977](https://github.com/element-hq/element-web/pull/30977)). Contributed by @t3chguy.
* Fix: member count in header and member list ([#30982](https://github.com/element-hq/element-web/pull/30982)). Contributed by @florianduros.
* Fix duration of voice message in timeline ([#30973](https://github.com/element-hq/element-web/pull/30973)). Contributed by @florianduros.
* Fix voice notes rendering at 00:00 when playback had not begun. ([#30961](https://github.com/element-hq/element-web/pull/30961)). Contributed by @Half-Shot.
* Improve handling of animated images, add support for AVIF animations ([#30932](https://github.com/element-hq/element-web/pull/30932)). Contributed by @t3chguy.
* Update key storage toggle when key storage status changes ([#30934](https://github.com/element-hq/element-web/pull/30934)). Contributed by @uhoreg.
* Fix jitsi widget popout ([#30908](https://github.com/element-hq/element-web/pull/30908)). Contributed by @dbkr.
* Improve keyboard navigation on invite dialog ([#30930](https://github.com/element-hq/element-web/pull/30930)). Contributed by @florianduros.
* Prefer UIA flows with supported UIA stages ([#30926](https://github.com/element-hq/element-web/pull/30926)). Contributed by @richvdh.
* Enhance accessibility of dropdown ([#30928](https://github.com/element-hq/element-web/pull/30928)). Contributed by @florianduros.
* Improve accessibility of the `\<AvatarSetting> component ([#30907](https://github.com/element-hq/element-web/pull/30907)). Contributed by @MidhunSureshR.



Changes in [1.12.1](https://github.com/element-hq/element-desktop/releases/tag/v1.12.1) (2025-10-07)
====================================================================================================
## ✨ Features

* New Room List: Change the order of filters to match those on mobile ([#30905](https://github.com/element-hq/element-web/pull/30905)). Contributed by @langleyd.
* New Room List: Don't clear filters on space change ([#30903](https://github.com/element-hq/element-web/pull/30903)). Contributed by @langleyd.
* Add release announcement for the sounds ([#30900](https://github.com/element-hq/element-web/pull/30900)). Contributed by @langleyd.
* Rich Text Editor: Add emoji suggestion support ([#30873](https://github.com/element-hq/element-web/pull/30873)). Contributed by @langleyd.
* feat: Disable session lock when running in element-desktop ([#30643](https://github.com/element-hq/element-web/pull/30643)). Contributed by @kaylendog.
* Improve invite dialog ui - Part 1 ([#30764](https://github.com/element-hq/element-web/pull/30764)). Contributed by @florianduros.
* Update Message Sound for Element ([#30804](https://github.com/element-hq/element-web/pull/30804)). Contributed by @beatdemon.
* Add new and improved ringtone ([#30761](https://github.com/element-hq/element-web/pull/30761)). Contributed by @Half-Shot.
* Disable RTE formatting buttons when the content contains a slash command ([#30802](https://github.com/element-hq/element-web/pull/30802)). Contributed by @langleyd.

## 🐛 Bug Fixes

* New Room List: Improve robustness of keyboard navigation ([#30888](https://github.com/element-hq/element-web/pull/30888)). Contributed by @langleyd.
* Fix a11y issue on list in invite dialog ([#30878](https://github.com/element-hq/element-web/pull/30878)). Contributed by @florianduros.
* Switch Export and Import Icons to match intuition ([#30805](https://github.com/element-hq/element-web/pull/30805)). Contributed by @micartey.
* Hide breadcrumb option when new room list is enabled ([#30869](https://github.com/element-hq/element-web/pull/30869)). Contributed by @florianduros.
* Avoid creating multiple call objects for the same widget ([#30839](https://github.com/element-hq/element-web/pull/30839)). Contributed by @robintown.
* Add a test for #29882, which is fixed by matrix-org/matrix-js-sdk#5016 ([#30835](https://github.com/element-hq/element-web/pull/30835)). Contributed by @andybalaam.
* fix: use `help_encryption_url` of config instead of hardcoded `https://element.io/help#encryption5` ([#30746](https://github.com/element-hq/element-web/pull/30746)). Contributed by @florianduros.
* Fix html export when feature\_jump\_to\_date is enabled ([#30828](https://github.com/element-hq/element-web/pull/30828)). Contributed by @langleyd.
* Fix #30439: "Forgot recovery key" should go to "reset" ([#30771](https://github.com/element-hq/element-web/pull/30771)). Contributed by @andybalaam.



Changes in [1.12.0](https://github.com/element-hq/element-desktop/releases/tag/v1.12.0) (2025-09-23)
====================================================================================================
## 🦖 Deprecations

* Remove remaining support for outdated .well-known settings ([#30702](https://github.com/element-hq/element-web/pull/30702)). Contributed by @richvdh.

## ✨ Features

* Automatically select first source for desktop capture under Wayland ([#2526](https://github.com/element-hq/element-desktop/pull/2526)). Contributed by @byquanton.
* Add decline button to call notification toast (use new notification event) ([#30729](https://github.com/element-hq/element-web/pull/30729)). Contributed by @toger5.
* Use the new room list by default ([#30640](https://github.com/element-hq/element-web/pull/30640)). Contributed by @langleyd.
* "Verify this device" redesign ([#30596](https://github.com/element-hq/element-web/pull/30596)). Contributed by @uhoreg.
* Set Element Call "intents" when starting and answering DM calls. ([#30730](https://github.com/element-hq/element-web/pull/30730)). Contributed by @Half-Shot.
* Add axe compliance for new room list ([#30700](https://github.com/element-hq/element-web/pull/30700)). Contributed by @langleyd.
* Stop ringing and remove toast if another device answers a RTC call. ([#30728](https://github.com/element-hq/element-web/pull/30728)). Contributed by @Half-Shot.
* Automatically adjust history visibility when making a room private ([#30713](https://github.com/element-hq/element-web/pull/30713)). Contributed by @Half-Shot.
* Release announcement for new room list ([#30675](https://github.com/element-hq/element-web/pull/30675)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Update Electron to v38.1.0 to fix Kernel crash on multi-GPU systems ([#2544](https://github.com/element-hq/element-desktop/pull/2544)). Contributed by @Arcitec.
* Fix Confirm your identity buttons being unclickable ([#2554](https://github.com/element-hq/element-desktop/pull/2554)). Contributed by @dbkr.
* Ensure dropdown is not a drag element on macOS ([#2540](https://github.com/element-hq/element-desktop/pull/2540)). Contributed by @t3chguy.
* [Backport staging] Room list: make the filter resize correctly ([#30795](https://github.com/element-hq/element-web/pull/30795)). Contributed by @RiotRobot.
* [Backport staging] Avoid flicker of the room list filter on resize ([#30794](https://github.com/element-hq/element-web/pull/30794)). Contributed by @RiotRobot.
* Don't show release announcements while toasts are displayed ([#30770](https://github.com/element-hq/element-web/pull/30770)). Contributed by @dbkr.
* Fix enabling key backup not working if there is an untrusted key backup ([#30707](https://github.com/element-hq/element-web/pull/30707)). Contributed by @Half-Shot.
* Force `preload` to be false when setting an intent on an Element Call. ([#30759](https://github.com/element-hq/element-web/pull/30759)). Contributed by @Half-Shot.
* Fix handling of 413 server response when uploading media ([#30737](https://github.com/element-hq/element-web/pull/30737)). Contributed by @hughns.
* Make landmark navigation work with new room list ([#30747](https://github.com/element-hq/element-web/pull/30747)). Contributed by @dbkr.
* Prevent voice message from displaying spurious errors ([#30736](https://github.com/element-hq/element-web/pull/30736)). Contributed by @florianduros.
* Align default avatar and fix colors in composer pills ([#30739](https://github.com/element-hq/element-web/pull/30739)). Contributed by @florianduros.
* Use configured URL for link to desktop app in message search settings ([#30742](https://github.com/element-hq/element-web/pull/30742)). Contributed by @t3chguy.
* Fix history visibility when creating space rooms ([#30745](https://github.com/element-hq/element-web/pull/30745)). Contributed by @dbkr.
* Check HTML-encoded quotes when handling translations for embedded pages (such as welcome.html) ([#30743](https://github.com/element-hq/element-web/pull/30743)). Contributed by @Half-Shot.
* Fix local room encryption status always not enabled ([#30461](https://github.com/element-hq/element-web/pull/30461)). Contributed by @BillCarsonFr.
* fix: make url in topic in room intro clickable ([#30686](https://github.com/element-hq/element-web/pull/30686)). Contributed by @florianduros.
* Block change recovery key button while a change is ongoing. ([#30664](https://github.com/element-hq/element-web/pull/30664)). Contributed by @Half-Shot.
* Hide advanced settings during room creation when `UIFeature.advancedSettings=false` ([#30684](https://github.com/element-hq/element-web/pull/30684)). Contributed by @florianduros.
* A11y: improve accessibility of pinned messages ([#30558](https://github.com/element-hq/element-web/pull/30558)). Contributed by @florianduros.



Changes in [1.11.112](https://github.com/element-hq/element-desktop/releases/tag/v1.11.112) (2025-09-16)
========================================================================================================
Fix [CVE-2025-59161](https://www.cve.org/CVERecord?id=CVE-2025-59161) / [GHSA-m6c8-98f4-75rr](https://github.com/element-hq/element-web/security/advisories/GHSA-m6c8-98f4-75rr)

## This is the last release compatible with macOS Big Sur. It will not update further. Big Sur is End of Life for almost 2 years and the next version of Electron crashes upon startup on Big Sur.

## ✨ Features

* [Backport staging] Handle unsupported macOS versions better ([#2555](https://github.com/element-hq/element-desktop/pull/2555)). Contributed by @RiotRobot.



Changes in [1.11.111](https://github.com/element-hq/element-desktop/releases/tag/v1.11.111) (2025-09-10)
========================================================================================================
## ✨ Features

* Do not hide media from your own user by default ([#29797](https://github.com/element-hq/element-web/pull/29797)). Contributed by @Half-Shot.
* Remember whether sidebar is shown for calls when switching rooms ([#30262](https://github.com/element-hq/element-web/pull/30262)). Contributed by @bojidar-bg.
* Open the proper integration settings on integrations disabled error ([#30538](https://github.com/element-hq/element-web/pull/30538)). Contributed by @Half-Shot.
* Show a "progress" dialog while invites are being sent ([#30561](https://github.com/element-hq/element-web/pull/30561)). Contributed by @richvdh.
* Move the room list to the new ListView(backed by react-virtuoso)  ([#30515](https://github.com/element-hq/element-web/pull/30515)). Contributed by @langleyd.

## 🐛 Bug Fixes

* [Backport staging] Ensure container starts if it is mounted with an empty /modules directory. ([#30705](https://github.com/element-hq/element-web/pull/30705)). Contributed by @RiotRobot.
* Fix room joining over federation not specifying vias or using aliases ([#30641](https://github.com/element-hq/element-web/pull/30641)). Contributed by @t3chguy.
* Fix stable-suffixed MSC4133 support ([#30649](https://github.com/element-hq/element-web/pull/30649)). Contributed by @dbkr.
* Fix i18n of message when a setting is disabled ([#30646](https://github.com/element-hq/element-web/pull/30646)). Contributed by @dbkr.
* ListView should not handle the arrow keys if there is a modifier applied ([#30633](https://github.com/element-hq/element-web/pull/30633)). Contributed by @langleyd.
* Make BaseDialog's div keyboard focusable and fix test. ([#30631](https://github.com/element-hq/element-web/pull/30631)). Contributed by @langleyd.
* Fix: Allow triple-click text selection to flow around pills ([#30349](https://github.com/element-hq/element-web/pull/30349)). Contributed by @AlirezaMrtz.
* Watch for a 'join' action to know when the call is connected ([#29492](https://github.com/element-hq/element-web/pull/29492)). Contributed by @robintown.
* Fix: add missing tooltip and aria-label to lock icon next to composer ([#30623](https://github.com/element-hq/element-web/pull/30623)). Contributed by @florianduros.
* Don't render context menu when scrolling ([#30613](https://github.com/element-hq/element-web/pull/30613)). Contributed by @langleyd.



Changes in [1.11.110](https://github.com/element-hq/element-desktop/releases/tag/v1.11.110) (2025-08-27)
========================================================================================================
## ✨ Features

* Hide recovery key when re-entering it while creating or changing it ([#30499](https://github.com/element-hq/element-web/pull/30499)). Contributed by @andybalaam.
* Add `?no_universal_links=true` to OIDC url so EX doesn't try to handle it ([#29439](https://github.com/element-hq/element-web/pull/29439)). Contributed by @t3chguy.
* Show a blue lock for unencrypted rooms and hide the grey shield for encrypted rooms ([#30440](https://github.com/element-hq/element-web/pull/30440)). Contributed by @langleyd.
* Add support for Module API 1.4 ([#30185](https://github.com/element-hq/element-web/pull/30185)). Contributed by @t3chguy.
* MVVM - Introduce some helpers for snapshot management ([#30398](https://github.com/element-hq/element-web/pull/30398)). Contributed by @MidhunSureshR.

## 🐛 Bug Fixes

* A11y: move focus to right panel when opened ([#30553](https://github.com/element-hq/element-web/pull/30553)). Contributed by @florianduros.
* Fix e2e warning icon should be white ([#30539](https://github.com/element-hq/element-web/pull/30539)). Contributed by @florianduros.
* Remove NoOneHere disabled reason. ([#30524](https://github.com/element-hq/element-web/pull/30524)). Contributed by @toger5.
* Fix downloading files with authenticated media API ([#30520](https://github.com/element-hq/element-web/pull/30520)). Contributed by @t3chguy.
* Fix call permissions check confusion around element call ([#30521](https://github.com/element-hq/element-web/pull/30521)). Contributed by @t3chguy.
* Fix line wrap around emoji verification ([#30523](https://github.com/element-hq/element-web/pull/30523)). Contributed by @t3chguy.
* Don't highlight redacted events ([#30519](https://github.com/element-hq/element-web/pull/30519)). Contributed by @t3chguy.
* Fix matrix.to links not being handled in the app ([#30522](https://github.com/element-hq/element-web/pull/30522)). Contributed by @t3chguy.
* Fix issue of new room list taking up the full width ([#30459](https://github.com/element-hq/element-web/pull/30459)). Contributed by @langleyd.
* Fix widget persistence in React development mode ([#30509](https://github.com/element-hq/element-web/pull/30509)). Contributed by @robintown.
* Fix widget initialization in React development mode ([#30463](https://github.com/element-hq/element-web/pull/30463)). Contributed by @robintown.



Changes in [1.11.109](https://github.com/element-hq/element-desktop/releases/tag/v1.11.109) (2025-08-11)
========================================================================================================
This release supports the upcoming v12 ("hydra") Matrix room version and is necessary to view and participate in these rooms.

## ✨ Features

* [Backport staging] Allow /upgraderoom command without developer mode enabled ([#30529](https://github.com/element-hq/element-web/pull/30529)). Contributed by @RiotRobot.
* [Backport staging] Support for creator/owner power level ([#30526](https://github.com/element-hq/element-web/pull/30526)). Contributed by @RiotRobot.
* New room list: change icon and label of menu item for to start a DM ([#30470](https://github.com/element-hq/element-web/pull/30470)). Contributed by @florianduros.
* Implement the member list with virtuoso ([#29869](https://github.com/element-hq/element-web/pull/29869)). Contributed by @langleyd.
* Add labs option for history sharing on invite ([#30313](https://github.com/element-hq/element-web/pull/30313)). Contributed by @richvdh.
* Bump wysiwyg to 2.39.0 adding support for pasting rich text content in the Rich Text Edtior ([#30421](https://github.com/element-hq/element-web/pull/30421)). Contributed by @langleyd.
* Support `EventShieldReason.MISMATCHED_SENDER` ([#30403](https://github.com/element-hq/element-web/pull/30403)). Contributed by @richvdh.
* Change unencrypted and public pills to blue ([#30399](https://github.com/element-hq/element-web/pull/30399)). Contributed by @florianduros.
* Change color of public room icon ([#30390](https://github.com/element-hq/element-web/pull/30390)). Contributed by @florianduros.
* Script for updating storybook screenshots ([#30340](https://github.com/element-hq/element-web/pull/30340)). Contributed by @dbkr.
* Add toggle to hide empty state in devtools ([#30352](https://github.com/element-hq/element-web/pull/30352)). Contributed by @toger5.

## 🐛 Bug Fixes

* [Backport staging] Use userId to filter users in non-federated rooms when showing the InviteDialog ([#30537](https://github.com/element-hq/element-web/pull/30537)). Contributed by @RiotRobot.
* [Backport staging] Catch error when encountering invalid m.room.pinned\_events event ([#30536](https://github.com/element-hq/element-web/pull/30536)). Contributed by @RiotRobot.
* Update for compatibility with v12 rooms ([#30452](https://github.com/element-hq/element-web/pull/30452)). Contributed by @dbkr.
* New room list: fix tooltip on presence ([#30474](https://github.com/element-hq/element-web/pull/30474)). Contributed by @florianduros.
* New room list: add tooltip for presence and room status ([#30472](https://github.com/element-hq/element-web/pull/30472)). Contributed by @florianduros.
* Fix: Clicking on an item in the member list causes it to scroll to the top rather than show the profile view ([#30455](https://github.com/element-hq/element-web/pull/30455)). Contributed by @langleyd.
* Put the 'decrypting' tooltip back ([#30446](https://github.com/element-hq/element-web/pull/30446)). Contributed by @dbkr.
* Use server name explicitly for via. ([#30362](https://github.com/element-hq/element-web/pull/30362)). Contributed by @Half-Shot.
* fix: replace hardcoded string in poll history dialog ([#30402](https://github.com/element-hq/element-web/pull/30402)). Contributed by @florianduros.
* fix: replace hardcoded string on qr code back button ([#30401](https://github.com/element-hq/element-web/pull/30401)). Contributed by @florianduros.
* Fix color of icon button with outline ([#30361](https://github.com/element-hq/element-web/pull/30361)). Contributed by @florianduros.



Changes in [1.11.108](https://github.com/element-hq/element-desktop/releases/tag/v1.11.108) (2025-07-30)
========================================================================================================
## 🐛 Bug Fixes

* [Backport staging] Fix downloaded attachments not being decrypted ([#30434](https://github.com/element-hq/element-web/pull/30434)). Contributed by @RiotRobot.



Changes in [1.11.107](https://github.com/element-hq/element-desktop/releases/tag/v1.11.107) (2025-07-29)
========================================================================================================
## ✨ Features

* Add support for overlaying notification badges on the Windows Taskbar icon. ([#2443](https://github.com/element-hq/element-desktop/pull/2443)). Contributed by @Half-Shot.
* Reduce macos titlebar height with the new room list and expand the existing border ([#2446](https://github.com/element-hq/element-desktop/pull/2446)). Contributed by @florianduros.
* Message preview should show tooltip with the full message on hover ([#30265](https://github.com/element-hq/element-web/pull/30265)). Contributed by @MidhunSureshR.
* Support rendering notification badges on platforms that do their own icon overlays ([#30315](https://github.com/element-hq/element-web/pull/30315)). Contributed by @Half-Shot.
* Add SubscriptionViewModel base class ([#30297](https://github.com/element-hq/element-web/pull/30297)). Contributed by @dbkr.
* Enhancement: Save image on CTRL+S ([#30330](https://github.com/element-hq/element-web/pull/30330)). Contributed by @ioalexander.
* Add quote functionality to MessageContextMenu (#29893) ([#30323](https://github.com/element-hq/element-web/pull/30323)). Contributed by @AlirezaMrtz.
* Initial structure for shared component views ([#30216](https://github.com/element-hq/element-web/pull/30216)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Reduce macos titlebar height with the new room list and expand the existing border ([#2446](https://github.com/element-hq/element-desktop/pull/2446)). Contributed by @florianduros.
* [Backport staging] Fix e2e shield being invisible in white mode for encrypted room ([#30411](https://github.com/element-hq/element-web/pull/30411)). Contributed by @RiotRobot.
* Force ED titlebar color for new room list ([#30332](https://github.com/element-hq/element-web/pull/30332)). Contributed by @florianduros.
* Add a background color to left panel for macos titlebar in element desktop ([#30328](https://github.com/element-hq/element-web/pull/30328)). Contributed by @florianduros.
* Fix: Prevent page refresh on Enter key in right panel member search ([#30312](https://github.com/element-hq/element-web/pull/30312)). Contributed by @AlirezaMrtz.



Changes in [1.11.106](https://github.com/element-hq/element-desktop/releases/tag/v1.11.106) (2025-07-15)
========================================================================================================
## ✨ Features

* [Backport staging] Fix e2e icon colour ([#30304](https://github.com/element-hq/element-web/pull/30304)). Contributed by @RiotRobot.
* Add support for module message hint `allowDownloadingMedia` ([#30252](https://github.com/element-hq/element-web/pull/30252)). Contributed by @Half-Shot.
* Update the mobile\_guide page to the new design and link out to Element X by default. ([#30172](https://github.com/element-hq/element-web/pull/30172)). Contributed by @pixlwave.
* Filter settings exported when rageshaking ([#30236](https://github.com/element-hq/element-web/pull/30236)). Contributed by @Half-Shot.
* Allow Element Call to learn the room name ([#30213](https://github.com/element-hq/element-web/pull/30213)). Contributed by @robintown.

## 🐛 Bug Fixes

* [Backport staging] Fix missing image download button ([#30322](https://github.com/element-hq/element-web/pull/30322)). Contributed by @RiotRobot.
* Fix transparent verification checkmark in dark mode ([#30235](https://github.com/element-hq/element-web/pull/30235)). Contributed by @Banbuii.
* Fix logic in DeviceListener ([#30230](https://github.com/element-hq/element-web/pull/30230)). Contributed by @uhoreg.
* Disable file drag-and-drop if insufficient permissions ([#30186](https://github.com/element-hq/element-web/pull/30186)). Contributed by @t3chguy.



Changes in [1.11.105](https://github.com/element-hq/element-desktop/releases/tag/v1.11.105) (2025-07-01)
========================================================================================================
## ✨ Features

* Add support for migrating to kwallet6 ([#2390](https://github.com/element-hq/element-desktop/pull/2390)). Contributed by @t3chguy.
* New room list: add context menu to room list item ([#29952](https://github.com/element-hq/element-web/pull/29952)). Contributed by @florianduros.
* Support for custom message components via Module API ([#30074](https://github.com/element-hq/element-web/pull/30074)). Contributed by @Half-Shot.
* Prompt users to set up recovery ([#30075](https://github.com/element-hq/element-web/pull/30075)). Contributed by @uhoreg.
* Update `IconButton` colors ([#30124](https://github.com/element-hq/element-web/pull/30124)). Contributed by @florianduros.
* New room list: filter list can be collapsed  ([#29992](https://github.com/element-hq/element-web/pull/29992)). Contributed by @florianduros.
* Show `EmptyRoomListView` when low priority filter matches zero rooms ([#30122](https://github.com/element-hq/element-web/pull/30122)). Contributed by @MidhunSureshR.

## 🐛 Bug Fixes

* Fix element-desktop-ssoid profile deeplinking for OIDC ([#2396](https://github.com/element-hq/element-desktop/pull/2396)). Contributed by @t3chguy.
* Add support for migrating to kwallet6 ([#2390](https://github.com/element-hq/element-desktop/pull/2390)). Contributed by @t3chguy.
* Fix untranslatable string "People" in notifications beta ([#30165](https://github.com/element-hq/element-web/pull/30165)). Contributed by @t3chguy.
* Force verification even after logging in via delegate ([#30141](https://github.com/element-hq/element-web/pull/30141)). Contributed by @andybalaam.
* Hide add integrations button based on UIComponent.AddIntegrations ([#30140](https://github.com/element-hq/element-web/pull/30140)). Contributed by @t3chguy.
* Use nav for new room list and label sections ([#30134](https://github.com/element-hq/element-web/pull/30134)). Contributed by @dbkr.
* Spacestore should emit event after rebuilding home space ([#30132](https://github.com/element-hq/element-web/pull/30132)). Contributed by @MidhunSureshR.
* Handle m.room.pinned\_events being invalid ([#30129](https://github.com/element-hq/element-web/pull/30129)). Contributed by @t3chguy.



Changes in [1.11.104](https://github.com/element-hq/element-desktop/releases/tag/v1.11.104) (2025-06-17)
========================================================================================================
## ✨ Features

* Update the mobile\_guide page to the new design. ([#30006](https://github.com/element-hq/element-web/pull/30006)). Contributed by @pixlwave.
* Provide a devtool for manually verifying other devices ([#30094](https://github.com/element-hq/element-web/pull/30094)). Contributed by @andybalaam.
* Implement MSC4155: Invite filtering ([#29603](https://github.com/element-hq/element-web/pull/29603)). Contributed by @Half-Shot.
* Add low priority avatar decoration to room tile ([#30065](https://github.com/element-hq/element-web/pull/30065)). Contributed by @MidhunSureshR.
* Add ability to prevent window content being captured by other apps (Desktop) ([#30098](https://github.com/element-hq/element-web/pull/30098)). Contributed by @t3chguy.
* New room list: move message preview in user settings ([#30023](https://github.com/element-hq/element-web/pull/30023)). Contributed by @florianduros.
* New room list: change room options icon ([#30029](https://github.com/element-hq/element-web/pull/30029)). Contributed by @florianduros.
* RoomListStore: Sort low priority rooms to the bottom of the list ([#30070](https://github.com/element-hq/element-web/pull/30070)). Contributed by @MidhunSureshR.
* Add low priority filter pill to the room list UI ([#30060](https://github.com/element-hq/element-web/pull/30060)). Contributed by @MidhunSureshR.
* New room list: remove color gradient in space panel ([#29721](https://github.com/element-hq/element-web/pull/29721)). Contributed by @florianduros.
* /share?msg=foo endpoint using forward message dialog ([#29874](https://github.com/element-hq/element-web/pull/29874)). Contributed by @ara4n.

## 🐛 Bug Fixes

* Fix restart loop in safeStorage ([#2373](https://github.com/element-hq/element-desktop/pull/2373)). Contributed by @dbkr.
* Do not send empty auth when setting up cross-signing keys ([#29914](https://github.com/element-hq/element-web/pull/29914)). Contributed by @gnieto.
* Settings: flip local video feed by default ([#29501](https://github.com/element-hq/element-web/pull/29501)). Contributed by @jbtrystram.
* AccessSecretStorageDialog: various fixes ([#30093](https://github.com/element-hq/element-web/pull/30093)). Contributed by @richvdh.
* AccessSecretStorageDialog: fix inability to enter recovery key ([#30090](https://github.com/element-hq/element-web/pull/30090)). Contributed by @richvdh.
* Fix failure to upload thumbnail causing image to send as file ([#30086](https://github.com/element-hq/element-web/pull/30086)). Contributed by @t3chguy.
* Low priority menu item should be a toggle ([#30071](https://github.com/element-hq/element-web/pull/30071)). Contributed by @MidhunSureshR.
* Add sanity checks to prevent users from ignoring themselves ([#30079](https://github.com/element-hq/element-web/pull/30079)). Contributed by @MidhunSureshR.
* Fix issue with duplicate images ([#30073](https://github.com/element-hq/element-web/pull/30073)). Contributed by @fatlewis.
* Handle errors returned from Seshat ([#30083](https://github.com/element-hq/element-web/pull/30083)). Contributed by @richvdh.



Changes in [1.11.103](https://github.com/element-hq/element-desktop/releases/tag/v1.11.103) (2025-06-10)
========================================================================================================
## 🐛 Bug Fixes

+ Check the sender of an event matches owner of session, preventing sender spoofing by homeserver owners.
[13c1d20](https://github.com/matrix-org/matrix-rust-sdk/commit/13c1d2048286bbabf5e7bc6b015aafee98f04d55) (High, [GHSA-x958-rvg6-956w](https://github.com/matrix-org/matrix-rust-sdk/security/advisories/GHSA-x958-rvg6-956w)).



Changes in [1.11.102](https://github.com/element-hq/element-desktop/releases/tag/v1.11.102) (2025-06-03)
========================================================================================================
## ✨ Features

* Support build-time specified protocol scheme for oidc callback ([#2285](https://github.com/element-hq/element-desktop/pull/2285)). Contributed by @t3chguy.
* EW: Modernize the recovery key input modal ([#29819](https://github.com/element-hq/element-web/pull/29819)). Contributed by @uhoreg.
* New room list: move secondary filters into primary filters ([#29972](https://github.com/element-hq/element-web/pull/29972)). Contributed by @florianduros.
* Prompt the user when key storage is unexpectedly off ([#29912](https://github.com/element-hq/element-web/pull/29912)). Contributed by @andybalaam.
* New room list: move sort menu in room list header ([#29983](https://github.com/element-hq/element-web/pull/29983)). Contributed by @florianduros.
* New room list: rework spacing of room list item ([#29965](https://github.com/element-hq/element-web/pull/29965)). Contributed by @florianduros.
* RLS: Remove forgotten room from skiplist ([#29933](https://github.com/element-hq/element-web/pull/29933)). Contributed by @MidhunSureshR.
* Add room list sorting ([#29951](https://github.com/element-hq/element-web/pull/29951)). Contributed by @dbkr.
* Don't use the minimised width(68px) on the new room list ([#29778](https://github.com/element-hq/element-web/pull/29778)). Contributed by @langleyd.

## 🐛 Bug Fixes

* Enable plain text encryption before checking if encryption is available ([#2343](https://github.com/element-hq/element-desktop/pull/2343)). Contributed by @MidhunSureshR.
* Enable plain text encryption early if we actually mean to use `basic_text` as backend ([#2341](https://github.com/element-hq/element-desktop/pull/2341)). Contributed by @MidhunSureshR.
* [Backport staging] Close call options popup menu when option has been selected ([#30054](https://github.com/element-hq/element-web/pull/30054)). Contributed by @RiotRobot.
* RoomListStoreV3: Only add new rooms that pass `VisibilityProvider` check ([#29974](https://github.com/element-hq/element-web/pull/29974)). Contributed by @MidhunSureshR.
* Re-order primary filters ([#29957](https://github.com/element-hq/element-web/pull/29957)). Contributed by @dbkr.
* Fix leaky CSS adding `!` to all H1 elements ([#29964](https://github.com/element-hq/element-web/pull/29964)). Contributed by @t3chguy.
* Fix extensions panel style ([#29273](https://github.com/element-hq/element-web/pull/29273)). Contributed by @langleyd.
* Fix state events being hidden from widgets in read\_events actions ([#29954](https://github.com/element-hq/element-web/pull/29954)). Contributed by @robintown.
* Remove old filter test ([#29963](https://github.com/element-hq/element-web/pull/29963)). Contributed by @dbkr.



Changes in [1.11.101](https://github.com/element-hq/element-desktop/releases/tag/v1.11.101) (2025-05-20)
========================================================================================================
## ✨ Features

* Migrate from keytar to safeStorage ([#2227](https://github.com/element-hq/element-desktop/pull/2227)). Contributed by @t3chguy.
* New room list: add keyboard navigation support ([#29805](https://github.com/element-hq/element-web/pull/29805)). Contributed by @florianduros.
* Use the JoinRuleSettings component for the guest link access prompt. ([#28614](https://github.com/element-hq/element-web/pull/28614)). Contributed by @toger5.
* Add loading state to the new room list view ([#29725](https://github.com/element-hq/element-web/pull/29725)). Contributed by @langleyd.
* Make OIDC identity reset consistent with EX ([#29854](https://github.com/element-hq/element-web/pull/29854)). Contributed by @andybalaam.
* Support error code for email / phone adding unsupported (MSC4178) ([#29855](https://github.com/element-hq/element-web/pull/29855)). Contributed by @dbkr.
* Update identity reset UI (Make consistent with EX) ([#29701](https://github.com/element-hq/element-web/pull/29701)). Contributed by @andybalaam.
* Add secondary filters to the new room list ([#29818](https://github.com/element-hq/element-web/pull/29818)). Contributed by @dbkr.
* Fix battery drain from Web Audio ([#29203](https://github.com/element-hq/element-web/pull/29203)). Contributed by @mbachry.

## 🐛 Bug Fixes

* Fix go home shortcut on macos and change toggle action events shortcut ([#29929](https://github.com/element-hq/element-web/pull/29929)). Contributed by @florianduros.
* New room list: fix outdated message preview when space or filter change ([#29925](https://github.com/element-hq/element-web/pull/29925)). Contributed by @florianduros.
* Stop migrating to MSC4278 if the config exists. ([#29924](https://github.com/element-hq/element-web/pull/29924)). Contributed by @Half-Shot.
* Ensure consistent download file name on download from ImageView ([#29913](https://github.com/element-hq/element-web/pull/29913)). Contributed by @t3chguy.
* Add error toast when service worker registration fails ([#29895](https://github.com/element-hq/element-web/pull/29895)). Contributed by @t3chguy.
* New Room List: Prevent old tombstoned rooms from appearing in the list ([#29881](https://github.com/element-hq/element-web/pull/29881)). Contributed by @MidhunSureshR.
* Remove lag in search field ([#29885](https://github.com/element-hq/element-web/pull/29885)). Contributed by @florianduros.
* Respect UIFeature.Voip ([#29873](https://github.com/element-hq/element-web/pull/29873)). Contributed by @langleyd.
* Allow jumping to message search from spotlight ([#29850](https://github.com/element-hq/element-web/pull/29850)). Contributed by @t3chguy.



Changes in [1.11.100](https://github.com/element-hq/element-desktop/releases/tag/v1.11.100) (2025-05-06)
========================================================================================================
## ✨ Features

* Move rich topics out of labs / stabilise MSC3765 ([#29817](https://github.com/element-hq/element-web/pull/29817)). Contributed by @Johennes.
* Spell out that Element Web does \*not\* work on mobile. ([#29211](https://github.com/element-hq/element-web/pull/29211)). Contributed by @ara4n.
* Add message preview support to the new room list ([#29784](https://github.com/element-hq/element-web/pull/29784)). Contributed by @dbkr.
* Global configuration flag for media previews ([#29582](https://github.com/element-hq/element-web/pull/29582)). Contributed by @Half-Shot.
* New room list: add partial keyboard shortcuts support ([#29783](https://github.com/element-hq/element-web/pull/29783)). Contributed by @florianduros.
* MVVM RoomSummaryCard Topic ([#29710](https://github.com/element-hq/element-web/pull/29710)). Contributed by @MarcWadai.
* Warn on self change from settings > roles ([#28926](https://github.com/element-hq/element-web/pull/28926)). Contributed by @MarcWadai.
* New room list: new visual for invitation ([#29773](https://github.com/element-hq/element-web/pull/29773)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Apply workaround to fix app launching on Linux ([#2308](https://github.com/element-hq/element-desktop/pull/2308)). Contributed by @dbkr.
* Notification fixes for Windows - AppID name was messing up handler ([#2275](https://github.com/element-hq/element-desktop/pull/2275)). Contributed by @Fusseldieb.
* Fix incorrect display of the user info display name ([#29826](https://github.com/element-hq/element-web/pull/29826)). Contributed by @langleyd.
* RoomListStore: Remove invite rooms on decline ([#29804](https://github.com/element-hq/element-web/pull/29804)). Contributed by @MidhunSureshR.
* Fix the buttons not being displayed with long preview text ([#29811](https://github.com/element-hq/element-web/pull/29811)). Contributed by @dbkr.
* New room list: fix missing/incorrect notification decoration  ([#29796](https://github.com/element-hq/element-web/pull/29796)). Contributed by @florianduros.
* New Room List: Prevent potential scroll jump/flicker when switching spaces ([#29781](https://github.com/element-hq/element-web/pull/29781)). Contributed by @MidhunSureshR.
* New room list: fix incorrect decoration ([#29770](https://github.com/element-hq/element-web/pull/29770)). Contributed by @florianduros.



Changes in [1.11.99](https://github.com/element-hq/element-desktop/releases/tag/v1.11.99) (2025-04-23)
======================================================================================================
## 🐛 Bug Fixes

* [Backport staging] Fix `io.element.desktop` protocol handler ([#2281](https://github.com/element-hq/element-desktop/pull/2281)). Contributed by @RiotRobot.



Changes in [1.11.98](https://github.com/element-hq/element-desktop/releases/tag/v1.11.98) (2025-04-22)
======================================================================================================
## 🦖 Deprecations

* Remove support for 32 bit / ia32 Windows. ([#2225](https://github.com/element-hq/element-desktop/pull/2225)). Contributed by @Half-Shot.

## ✨ Features

* Update config logging to specify config file path ([#2231](https://github.com/element-hq/element-desktop/pull/2231)). Contributed by @nbolton.
* Support specifying the profile dir path via env var (#2226) ([#2246](https://github.com/element-hq/element-desktop/pull/2246)). Contributed by @schuhj.
* print better errors in the search view instead of a blocking modal ([#29724](https://github.com/element-hq/element-web/pull/29724)). Contributed by @Jujure.
* New room list: video room and video call decoration  ([#29693](https://github.com/element-hq/element-web/pull/29693)). Contributed by @florianduros.
* Remove Secure Backup, Cross-signing and Cryptography sections in `Security & Privacy` user settings ([#29088](https://github.com/element-hq/element-web/pull/29088)). Contributed by @florianduros.
* Allow reporting a room when rejecting an invite. ([#29570](https://github.com/element-hq/element-web/pull/29570)). Contributed by @Half-Shot.
* RoomListViewModel: Reset primary and secondary filters on space change ([#29672](https://github.com/element-hq/element-web/pull/29672)). Contributed by @MidhunSureshR.
* RoomListStore: Support specific sorting requirements for muted rooms ([#29665](https://github.com/element-hq/element-web/pull/29665)). Contributed by @MidhunSureshR.
* New room list: add notification options menu ([#29639](https://github.com/element-hq/element-web/pull/29639)). Contributed by @florianduros.
* Room List: Scroll to top of the list when active room is not in the list ([#29650](https://github.com/element-hq/element-web/pull/29650)). Contributed by @MidhunSureshR.

## 🐛 Bug Fixes

* Fix unwanted form submit behaviour in memberlist ([#29747](https://github.com/element-hq/element-web/pull/29747)). Contributed by @MidhunSureshR.
* New room list: fix public room icon visibility when filter change ([#29737](https://github.com/element-hq/element-web/pull/29737)). Contributed by @florianduros.
* Fix custom theme support for short hex \& rgba hex strings ([#29726](https://github.com/element-hq/element-web/pull/29726)). Contributed by @t3chguy.
* New room list: minor visual fixes ([#29723](https://github.com/element-hq/element-web/pull/29723)). Contributed by @florianduros.
* Fix getOidcCallbackUrl for Element Desktop ([#29711](https://github.com/element-hq/element-web/pull/29711)). Contributed by @t3chguy.
* Fix some webp images improperly marked as animated ([#29713](https://github.com/element-hq/element-web/pull/29713)). Contributed by @Petersmit27.
* Revert deletion of hydrateSession ([#29703](https://github.com/element-hq/element-web/pull/29703)). Contributed by @Jujure.
* Fix converttoroom \& converttodm not working ([#29705](https://github.com/element-hq/element-web/pull/29705)). Contributed by @t3chguy.
* Ensure forceCloseAllModals also closes priority/static modals ([#29706](https://github.com/element-hq/element-web/pull/29706)). Contributed by @t3chguy.
* Continue button is disabled when uploading a recovery key file ([#29695](https://github.com/element-hq/element-web/pull/29695)). Contributed by @Giwayume.
* Catch errors after syncing recovery ([#29691](https://github.com/element-hq/element-web/pull/29691)). Contributed by @andybalaam.
* New room list: fix multiple visual issues ([#29673](https://github.com/element-hq/element-web/pull/29673)). Contributed by @florianduros.
* New Room List: Fix mentions filter matching rooms with any highlight ([#29668](https://github.com/element-hq/element-web/pull/29668)). Contributed by @MidhunSureshR.
*  Fix truncated emoji label during emoji SAS ([#29643](https://github.com/element-hq/element-web/pull/29643)). Contributed by @florianduros.
* Remove duplicate jitsi link ([#29642](https://github.com/element-hq/element-web/pull/29642)). Contributed by @dbkr.



Changes in [1.11.97](https://github.com/element-hq/element-desktop/releases/tag/v1.11.97) (2025-04-08)
======================================================================================================
## ✨ Features

* New room list: reduce padding between avatar and room list border ([#29634](https://github.com/element-hq/element-web/pull/29634)). Contributed by @florianduros.
* Bundle Element Call with Element Web packages ([#29309](https://github.com/element-hq/element-web/pull/29309)). Contributed by @t3chguy.
* Hide an event notification if it is redacted ([#29605](https://github.com/element-hq/element-web/pull/29605)). Contributed by @Half-Shot.
* Docker: Use nginx-unprivileged as base image ([#29353](https://github.com/element-hq/element-web/pull/29353)). Contributed by @AndrewFerr.
* Switch away from nesting React trees and mangling the DOM ([#29586](https://github.com/element-hq/element-web/pull/29586)). Contributed by @t3chguy.
* New room list: add notification decoration ([#29552](https://github.com/element-hq/element-web/pull/29552)). Contributed by @florianduros.
* RoomListStore: Unread filter should match rooms that were marked as unread ([#29580](https://github.com/element-hq/element-web/pull/29580)). Contributed by @MidhunSureshR.
* Add support for hiding videos ([#29496](https://github.com/element-hq/element-web/pull/29496)). Contributed by @Half-Shot.
* Use an outline icon for the report room button ([#29573](https://github.com/element-hq/element-web/pull/29573)). Contributed by @robintown.
* Generate/load pickle key on SSO ([#29568](https://github.com/element-hq/element-web/pull/29568)). Contributed by @Jujure.
* Add report room dialog button/dialog. ([#29513](https://github.com/element-hq/element-web/pull/29513)). Contributed by @Half-Shot.
* RoomListViewModel: Make the active room sticky in the list ([#29551](https://github.com/element-hq/element-web/pull/29551)). Contributed by @MidhunSureshR.
* Replace checkboxes with Compound checkboxes, and appropriately label each checkbox. ([#29363](https://github.com/element-hq/element-web/pull/29363)). Contributed by @Half-Shot.
* New room list: add selection decoration ([#29531](https://github.com/element-hq/element-web/pull/29531)). Contributed by @florianduros.
* Simplified Sliding Sync ([#28515](https://github.com/element-hq/element-web/pull/28515)). Contributed by @dbkr.
* Add ability to hide images after clicking "show image" ([#29467](https://github.com/element-hq/element-web/pull/29467)). Contributed by @Half-Shot.

## 🐛 Bug Fixes

* Fix scroll issues in memberlist ([#29392](https://github.com/element-hq/element-web/pull/29392)). Contributed by @MidhunSureshR.
* Ensure clicks on spoilers do not get handled by the hidden content ([#29618](https://github.com/element-hq/element-web/pull/29618)). Contributed by @t3chguy.
* New room list: add cursor pointer on room list item ([#29627](https://github.com/element-hq/element-web/pull/29627)). Contributed by @florianduros.
* Fix missing ambiguous url tooltips on Element Desktop ([#29619](https://github.com/element-hq/element-web/pull/29619)). Contributed by @t3chguy.
* New room list: fix spacing and padding ([#29607](https://github.com/element-hq/element-web/pull/29607)). Contributed by @florianduros.
* Make fetchdep check out matching branch name ([#29601](https://github.com/element-hq/element-web/pull/29601)). Contributed by @dbkr.
* Fix MFileBody fileName not considering `filename` ([#29589](https://github.com/element-hq/element-web/pull/29589)). Contributed by @t3chguy.
* Fix token expiry racing with login causing wrong error to be shown ([#29566](https://github.com/element-hq/element-web/pull/29566)). Contributed by @t3chguy.
* Fix bug which caused startup to hang if the clock was wound back since a previous session ([#29558](https://github.com/element-hq/element-web/pull/29558)). Contributed by @richvdh.
* RoomListViewModel: Reset any primary filter on secondary filter change ([#29562](https://github.com/element-hq/element-web/pull/29562)). Contributed by @MidhunSureshR.
* RoomListStore: Unread filter should only filter rooms having unread counts ([#29555](https://github.com/element-hq/element-web/pull/29555)). Contributed by @MidhunSureshR.
* In force-verify mode, prevent bypassing by cancelling device verification ([#29487](https://github.com/element-hq/element-web/pull/29487)). Contributed by @andybalaam.
* Add title attribute to user identifier ([#29547](https://github.com/element-hq/element-web/pull/29547)). Contributed by @arpitbatra123.



Changes in [1.11.96](https://github.com/element-hq/element-desktop/releases/tag/v1.11.96) (2025-03-25)
======================================================================================================
## ✨ Features

* RoomListViewModel: Track the index of the active room in the list ([#29519](https://github.com/element-hq/element-web/pull/29519)). Contributed by @MidhunSureshR.
* New room list: add empty state ([#29512](https://github.com/element-hq/element-web/pull/29512)). Contributed by @florianduros.
* Implement `MessagePreviewViewModel` ([#29514](https://github.com/element-hq/element-web/pull/29514)). Contributed by @MidhunSureshR.
* RoomListViewModel: Add functionality to toggle message preview setting ([#29511](https://github.com/element-hq/element-web/pull/29511)). Contributed by @MidhunSureshR.
* New room list: add more options menu on room list item ([#29445](https://github.com/element-hq/element-web/pull/29445)). Contributed by @florianduros.
* RoomListViewModel: Provide a way to resort the room list and track the active sort method ([#29499](https://github.com/element-hq/element-web/pull/29499)). Contributed by @MidhunSureshR.
* Change \*All rooms\* meta space name to \*All Chats\* ([#29498](https://github.com/element-hq/element-web/pull/29498)). Contributed by @florianduros.
* Add setting to hide avatars of rooms you have been invited to. ([#29497](https://github.com/element-hq/element-web/pull/29497)). Contributed by @Half-Shot.
* Room List Store: Save preferred sorting algorithm and use that on app launch ([#29493](https://github.com/element-hq/element-web/pull/29493)). Contributed by @MidhunSureshR.
* Add key storage toggle to Encryption settings ([#29310](https://github.com/element-hq/element-web/pull/29310)). Contributed by @dbkr.
* New room list: add primary filters ([#29481](https://github.com/element-hq/element-web/pull/29481)). Contributed by @florianduros.
* Implement MSC4142: Remove unintentional intentional mentions in replies ([#28209](https://github.com/element-hq/element-web/pull/28209)). Contributed by @tulir.
* White background for 'They do not match' button ([#29470](https://github.com/element-hq/element-web/pull/29470)). Contributed by @andybalaam.
* RoomListViewModel: Support secondary filters in the view model ([#29465](https://github.com/element-hq/element-web/pull/29465)). Contributed by @MidhunSureshR.
* RoomListViewModel: Support primary filters in the view model ([#29454](https://github.com/element-hq/element-web/pull/29454)). Contributed by @MidhunSureshR.
* Room List Store: Implement secondary filters ([#29458](https://github.com/element-hq/element-web/pull/29458)). Contributed by @MidhunSureshR.
* Room List Store: Implement rest of the primary filters ([#29444](https://github.com/element-hq/element-web/pull/29444)). Contributed by @MidhunSureshR.
* Room List Store: Support filters by implementing just the favourite filter ([#29433](https://github.com/element-hq/element-web/pull/29433)). Contributed by @MidhunSureshR.
* Move toggle switch for integration manager for a11y ([#29436](https://github.com/element-hq/element-web/pull/29436)). Contributed by @Half-Shot.
* New room list: basic flat list ([#29368](https://github.com/element-hq/element-web/pull/29368)). Contributed by @florianduros.
* Improve rageshake upload experience by providing useful error information ([#29378](https://github.com/element-hq/element-web/pull/29378)). Contributed by @Half-Shot.
* Add more functionality to the room list vm ([#29402](https://github.com/element-hq/element-web/pull/29402)). Contributed by @MidhunSureshR.

## 🐛 Bug Fixes

* Fix `--no-update` command line flag ([#2210](https://github.com/element-hq/element-desktop/pull/2210)). Contributed by @t3chguy.
* New room list: fix compose menu action in space  ([#29500](https://github.com/element-hq/element-web/pull/29500)). Contributed by @florianduros.
* Change ToggleHiddenEventVisibility \& GoToHome KeyBindingActions ([#29374](https://github.com/element-hq/element-web/pull/29374)). Contributed by @gy-mate.
* Fix Docker Healthcheck ([#29471](https://github.com/element-hq/element-web/pull/29471)). Contributed by @benbz.
* Room List Store: Fetch rooms after space store is ready + attach store to window ([#29453](https://github.com/element-hq/element-web/pull/29453)). Contributed by @MidhunSureshR.
* Room List Store: Fix bug where left rooms appear in room list ([#29452](https://github.com/element-hq/element-web/pull/29452)). Contributed by @MidhunSureshR.
* Add space to the bottom of the room summary actions below leave room ([#29270](https://github.com/element-hq/element-web/pull/29270)). Contributed by @langleyd.
* Show error screens in group calls ([#29254](https://github.com/element-hq/element-web/pull/29254)). Contributed by @robintown.
* Prevent user from accidentally triggering multiple identity resets ([#29388](https://github.com/element-hq/element-web/pull/29388)). Contributed by @uhoreg.
* Remove buggy tooltip on room intro \& homepage ([#29406](https://github.com/element-hq/element-web/pull/29406)). Contributed by @t3chguy.



Changes in [1.11.95](https://github.com/element-hq/element-desktop/releases/tag/v1.11.95) (2025-03-11)
======================================================================================================
## ✨ Features

* Switch to shiftkey/node-keytar as it has NAPI 10 updates ([#2172](https://github.com/element-hq/element-desktop/pull/2172)). Contributed by @t3chguy.
* Add support for Windows arm64 ([#624](https://github.com/element-hq/element-desktop/pull/624)). Contributed by @t3chguy.
* Room List Store: Filter rooms by active space ([#29399](https://github.com/element-hq/element-web/pull/29399)). Contributed by @MidhunSureshR.
* Room List - Update the room list store on actions from the dispatcher ([#29397](https://github.com/element-hq/element-web/pull/29397)). Contributed by @MidhunSureshR.
* Room List  - Implement a minimal view model ([#29357](https://github.com/element-hq/element-web/pull/29357)). Contributed by @MidhunSureshR.
* New room list: add space menu in room header ([#29352](https://github.com/element-hq/element-web/pull/29352)). Contributed by @florianduros.
* Room List - Store sorted rooms in skip list ([#29345](https://github.com/element-hq/element-web/pull/29345)). Contributed by @MidhunSureshR.
* New room list: add dial to search section ([#29359](https://github.com/element-hq/element-web/pull/29359)). Contributed by @florianduros.
* New room list: add compose menu for spaces in header ([#29347](https://github.com/element-hq/element-web/pull/29347)). Contributed by @florianduros.
* Use EditInPlace control for Identity Server picker to improve a11y ([#29280](https://github.com/element-hq/element-web/pull/29280)). Contributed by @Half-Shot.
* First step to add header to new room list ([#29320](https://github.com/element-hq/element-web/pull/29320)). Contributed by @florianduros.
* Add Windows 64-bit arm link and remove 32-bit link on compatibility page ([#29312](https://github.com/element-hq/element-web/pull/29312)). Contributed by @t3chguy.
* Honour the backup disable flag from Element X ([#29290](https://github.com/element-hq/element-web/pull/29290)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Fix edited code block width ([#29394](https://github.com/element-hq/element-web/pull/29394)). Contributed by @florianduros.
* new room list: keep space name in one line in header ([#29369](https://github.com/element-hq/element-web/pull/29369)). Contributed by @florianduros.
* Dismiss "Key storage out of sync" toast when secrets received ([#29348](https://github.com/element-hq/element-web/pull/29348)). Contributed by @richvdh.
* Minor CSS fixes for the new room list ([#29334](https://github.com/element-hq/element-web/pull/29334)). Contributed by @florianduros.
* Add padding to room header icon ([#29271](https://github.com/element-hq/element-web/pull/29271)). Contributed by @langleyd.



Changes in [1.11.94](https://github.com/element-hq/element-desktop/releases/tag/v1.11.94) (2025-02-27)
======================================================================================================
* No changes

## 🐛 Bug Fixes

* [Backport staging] fix: /tmp/element-web-config may already exist preventing the container from booting up ([#29377](https://github.com/element-hq/element-web/pull/29377)). Contributed by @RiotRobot.



Changes in [1.11.93](https://github.com/element-hq/element-desktop/releases/tag/v1.11.93) (2025-02-25)
======================================================================================================
## ✨ Features

* [backport] Dynamically load Element Web modules in Docker entrypoint ([#29358](https://github.com/element-hq/element-web/pull/29358)). Contributed by @t3chguy.
* ChangeRecoveryKey: error handling ([#29262](https://github.com/element-hq/element-web/pull/29262)). Contributed by @richvdh.
* Dehydration: enable dehydrated device on "Set up recovery" ([#29265](https://github.com/element-hq/element-web/pull/29265)). Contributed by @richvdh.
* Render reason for invite rejection. ([#29257](https://github.com/element-hq/element-web/pull/29257)). Contributed by @Half-Shot.
* New room list: add search section ([#29251](https://github.com/element-hq/element-web/pull/29251)). Contributed by @florianduros.
* New room list: hide favourites and people meta spaces ([#29241](https://github.com/element-hq/element-web/pull/29241)). Contributed by @florianduros.
* New Room List: Create new labs flag ([#29239](https://github.com/element-hq/element-web/pull/29239)). Contributed by @MidhunSureshR.
* Stop URl preview from covering message box ([#29215](https://github.com/element-hq/element-web/pull/29215)). Contributed by @edent.
* Rename "security key" into "recovery key" ([#29217](https://github.com/element-hq/element-web/pull/29217)). Contributed by @florianduros.
* Add new verification section to user profile ([#29200](https://github.com/element-hq/element-web/pull/29200)). Contributed by @MidhunSureshR.
* Initial support for runtime modules ([#29104](https://github.com/element-hq/element-web/pull/29104)). Contributed by @t3chguy.
* Add `Forgot recovery key?` button to encryption tab ([#29202](https://github.com/element-hq/element-web/pull/29202)). Contributed by @florianduros.
* Add KeyIcon to key storage out of sync toast ([#29201](https://github.com/element-hq/element-web/pull/29201)). Contributed by @florianduros.
* Improve rendering of empty topics in the timeline  ([#29152](https://github.com/element-hq/element-web/pull/29152)). Contributed by @Half-Shot.

## 🐛 Bug Fixes

* Fix font scaling in member list ([#29285](https://github.com/element-hq/element-web/pull/29285)). Contributed by @florianduros.
* Grow member list search field when resizing the right panel ([#29267](https://github.com/element-hq/element-web/pull/29267)). Contributed by @langleyd.
* Don't reload roomview on offline connectivity check ([#29243](https://github.com/element-hq/element-web/pull/29243)). Contributed by @dbkr.
* Respect user's 12/24 hour preference consistently ([#29237](https://github.com/element-hq/element-web/pull/29237)). Contributed by @t3chguy.
* Restore the accessibility role on call views ([#29225](https://github.com/element-hq/element-web/pull/29225)). Contributed by @robintown.
* Revert `GoToHome` keyboard shortcut to `Ctrl`–`Shift`–`H` on macOS ([#28577](https://github.com/element-hq/element-web/pull/28577)). Contributed by @gy-mate.
* Encryption tab: display correct encryption panel when user cancels the reset identity flow ([#29216](https://github.com/element-hq/element-web/pull/29216)). Contributed by @florianduros.



Changes in [1.11.92](https://github.com/element-hq/element-desktop/releases/tag/v1.11.92) (2025-02-11)
======================================================================================================
## ✨ Features

* Enable fuse EnableEmbeddedAsarIntegrityValidation ([#1979](https://github.com/element-hq/element-desktop/pull/1979)). Contributed by @t3chguy.
* Update electron-builder and harden fuse configuration ([#2106](https://github.com/element-hq/element-desktop/pull/2106)). Contributed by @t3chguy.
* [Backport staging] Log when we show, and hide, encryption setup toasts ([#29238](https://github.com/element-hq/element-web/pull/29238)). Contributed by @richvdh.
* Make profile header section match the designs ([#29163](https://github.com/element-hq/element-web/pull/29163)). Contributed by @MidhunSureshR.
* Always show back button in the right panel ([#29128](https://github.com/element-hq/element-web/pull/29128)). Contributed by @MidhunSureshR.
* Schedule dehydration on reload if the dehydration key is already cached locally ([#29021](https://github.com/element-hq/element-web/pull/29021)). Contributed by @uhoreg.
* update to twemoji 15.1.0 ([#29115](https://github.com/element-hq/element-web/pull/29115)). Contributed by @ara4n.
* Update matrix-widget-api ([#29112](https://github.com/element-hq/element-web/pull/29112)). Contributed by @toger5.
* Allow navigating through the memberlist using up/down keys ([#28949](https://github.com/element-hq/element-web/pull/28949)). Contributed by @MidhunSureshR.
* Style room header icons and facepile for toggled state ([#28968](https://github.com/element-hq/element-web/pull/28968)). Contributed by @MidhunSureshR.
* Move threads header below base card header ([#28969](https://github.com/element-hq/element-web/pull/28969)). Contributed by @MidhunSureshR.
* Add `Advanced` section to the user settings encryption tab ([#28804](https://github.com/element-hq/element-web/pull/28804)). Contributed by @florianduros.
* Fix outstanding UX issues with replies/mentions/keyword notifs ([#28270](https://github.com/element-hq/element-web/pull/28270)). Contributed by @taffyko.
* Distinguish room state and timeline events when dealing with widgets ([#28681](https://github.com/element-hq/element-web/pull/28681)). Contributed by @robintown.
* Switch OIDC primarily to new `/auth_metadata` API ([#29019](https://github.com/element-hq/element-web/pull/29019)). Contributed by @t3chguy.
* More memberlist changes ([#29069](https://github.com/element-hq/element-web/pull/29069)). Contributed by @MidhunSureshR.

## 🐛 Bug Fixes

* [Backport staging] Wire up the "Forgot recovery key" button for the "Key storage out of sync" toast ([#29190](https://github.com/element-hq/element-web/pull/29190)). Contributed by @RiotRobot.
* Encryption tab: hide `Advanced` section when the key storage is out of sync ([#29129](https://github.com/element-hq/element-web/pull/29129)). Contributed by @florianduros.
* Fix share button in discovery settings being disabled incorrectly ([#29151](https://github.com/element-hq/element-web/pull/29151)). Contributed by @t3chguy.
* Ensure switching rooms does not wrongly focus timeline search ([#29153](https://github.com/element-hq/element-web/pull/29153)). Contributed by @t3chguy.
* Stop showing a dialog prompting the user to enter an old recovery key ([#29143](https://github.com/element-hq/element-web/pull/29143)). Contributed by @richvdh.
* Make themed widgets reflect the effective theme ([#28342](https://github.com/element-hq/element-web/pull/28342)). Contributed by @robintown.
* support non-VS16 emoji ligatures in TwemojiMozilla ([#29100](https://github.com/element-hq/element-web/pull/29100)). Contributed by @ara4n.
* e2e test: Verify session with the encryption tab instead of the security \& privacy tab ([#29090](https://github.com/element-hq/element-web/pull/29090)). Contributed by @florianduros.
* Work around cloudflare R2 / aws client incompatability ([#29086](https://github.com/element-hq/element-web/pull/29086)). Contributed by @dbkr.
* Fix identity server settings visibility ([#29083](https://github.com/element-hq/element-web/pull/29083)). Contributed by @dbkr.



Changes in [1.11.91](https://github.com/element-hq/element-desktop/releases/tag/v1.11.91) (2025-01-28)
======================================================================================================
## ✨ Features

* Implement changes to memberlist from feedback ([#29029](https://github.com/element-hq/element-web/pull/29029)). Contributed by @MidhunSureshR.
* Add toast for recovery keys being out of sync ([#28946](https://github.com/element-hq/element-web/pull/28946)). Contributed by @dbkr.
* Refactor LegacyCallHandler event emitter to use TypedEventEmitter ([#29008](https://github.com/element-hq/element-web/pull/29008)). Contributed by @t3chguy.
* Add `Recovery` section in the new user settings `Encryption` tab ([#28673](https://github.com/element-hq/element-web/pull/28673)). Contributed by @florianduros.
* Retry loading chunks to make the app more resilient ([#29001](https://github.com/element-hq/element-web/pull/29001)). Contributed by @t3chguy.
* Clear account idb table on logout ([#28996](https://github.com/element-hq/element-web/pull/28996)). Contributed by @t3chguy.
* Implement new memberlist design with MVVM architecture  ([#28874](https://github.com/element-hq/element-web/pull/28874)). Contributed by @MidhunSureshR.

## 🐛 Bug Fixes

* [Backport staging] Switch to secure random strings ([#29035](https://github.com/element-hq/element-web/pull/29035)). Contributed by @RiotRobot.
* React to MatrixEvent sender/target being updated for rendering state events ([#28947](https://github.com/element-hq/element-web/pull/28947)). Contributed by @t3chguy.



Changes in [1.11.90](https://github.com/element-hq/element-desktop/releases/tag/v1.11.90) (2025-01-14)
======================================================================================================
## ✨ Features

* Docker: run as non-root ([#28849](https://github.com/element-hq/element-web/pull/28849)). Contributed by @richvdh.
* Docker: allow configuration of HTTP listen port via env var ([#28840](https://github.com/element-hq/element-web/pull/28840)). Contributed by @richvdh.
* Update matrix-wysiwyg to consume WASM asset ([#28838](https://github.com/element-hq/element-web/pull/28838)). Contributed by @t3chguy.
* OIDC settings tweaks ([#28787](https://github.com/element-hq/element-web/pull/28787)). Contributed by @t3chguy.
* Delabs native OIDC support ([#28615](https://github.com/element-hq/element-web/pull/28615)). Contributed by @t3chguy.
* Move room header info button to right-most position ([#28754](https://github.com/element-hq/element-web/pull/28754)). Contributed by @t3chguy.
* Enable key backup by default ([#28691](https://github.com/element-hq/element-web/pull/28691)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Fix building the automations mermaid diagram ([#28881](https://github.com/element-hq/element-web/pull/28881)). Contributed by @dbkr.
* Playwright: wait for the network listener on the postgres db ([#28808](https://github.com/element-hq/element-web/pull/28808)). Contributed by @dbkr.



Changes in [1.11.89](https://github.com/element-hq/element-desktop/releases/tag/v1.11.89) (2024-12-18)
======================================================================================================
* No changes

## 🐛 Bug Fixes

* Upgrade matrix-sdk-crypto-wasm to 1.11.0 (https://github.com/matrix-org/matrix-js-sdk/pull/4593)
* Fix url preview display ([#28766](https://github.com/element-hq/element-web/pull/28766)).



Changes in [1.11.88](https://github.com/element-hq/element-desktop/releases/tag/v1.11.88) (2024-12-17)
======================================================================================================
## ✨ Features

* Allow trusted Element Call widget to send and receive media encryption key to-device messages ([#28316](https://github.com/element-hq/element-web/pull/28316)). Contributed by @hughns.
* increase ringing timeout from 10 seconds to 90 seconds ([#28630](https://github.com/element-hq/element-web/pull/28630)). Contributed by @fkwp.
* Add `Close` tooltip to dialog ([#28617](https://github.com/element-hq/element-web/pull/28617)). Contributed by @florianduros.
* New UX for Share dialog ([#28598](https://github.com/element-hq/element-web/pull/28598)). Contributed by @florianduros.
* Improve performance of RoomContext in RoomHeader ([#28574](https://github.com/element-hq/element-web/pull/28574)). Contributed by @t3chguy.
* Remove `Features.RustCrypto` flag ([#28582](https://github.com/element-hq/element-web/pull/28582)). Contributed by @florianduros.
* Add Modernizr warning when running in non-secure context ([#28581](https://github.com/element-hq/element-web/pull/28581)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Fix secret storage not being used due to bad import ([#2029](https://github.com/element-hq/element-desktop/pull/2029)). Contributed by @t3chguy.
* Fix inability to click on non-logged-in modals on macOS ([#2025](https://github.com/element-hq/element-desktop/pull/2025)). Contributed by @t3chguy.
* Fix jumpy timeline when the pinned message banner is displayed ([#28654](https://github.com/element-hq/element-web/pull/28654)). Contributed by @florianduros.
* Fix font \& spaces in settings subsection ([#28631](https://github.com/element-hq/element-web/pull/28631)). Contributed by @florianduros.
* Remove manual device verification which is not supported by the new cryptography stack ([#28588](https://github.com/element-hq/element-web/pull/28588)). Contributed by @florianduros.
* Fix code block highlighting not working reliably with many code blocks ([#28613](https://github.com/element-hq/element-web/pull/28613)). Contributed by @t3chguy.
* Remove remaining reply fallbacks code ([#28610](https://github.com/element-hq/element-web/pull/28610)). Contributed by @t3chguy.
* Provide a way to activate GIFs via the keyboard for a11y ([#28611](https://github.com/element-hq/element-web/pull/28611)). Contributed by @t3chguy.
* Fix format bar position ([#28591](https://github.com/element-hq/element-web/pull/28591)). Contributed by @florianduros.
* Fix room taking long time to load ([#28579](https://github.com/element-hq/element-web/pull/28579)). Contributed by @florianduros.
* Show the correct shield status in tooltip for more conditions ([#28476](https://github.com/element-hq/element-web/pull/28476)). Contributed by @uhoreg.



Changes in [1.11.87](https://github.com/element-hq/element-desktop/releases/tag/v1.11.87) (2024-12-03)
======================================================================================================
## ✨ Features

* Send and respect MSC4230 is\_animated flag ([#28513](https://github.com/element-hq/element-web/pull/28513)). Contributed by @t3chguy.
* Display a warning when an unverified user's identity changes ([#28211](https://github.com/element-hq/element-web/pull/28211)). Contributed by @uhoreg.
* Swap out Twitter link for Mastodon on auth footer ([#28508](https://github.com/element-hq/element-web/pull/28508)). Contributed by @t3chguy.
* Consider `org.matrix.msc3417.call` as video room in create room dialog ([#28497](https://github.com/element-hq/element-web/pull/28497)). Contributed by @t3chguy.
* Standardise icons using Compound Design Tokens ([#28217](https://github.com/element-hq/element-web/pull/28217)). Contributed by @t3chguy.
* Start sending stable `m.marked_unread` events ([#28478](https://github.com/element-hq/element-web/pull/28478)). Contributed by @tulir.
* Upgrade to compound-design-tokens v2 ([#28471](https://github.com/element-hq/element-web/pull/28471)). Contributed by @t3chguy.
* Standardise icons using Compound Design Tokens ([#28286](https://github.com/element-hq/element-web/pull/28286)). Contributed by @t3chguy.
* Remove reply fallbacks as per merged MSC2781 ([#28406](https://github.com/element-hq/element-web/pull/28406)). Contributed by @t3chguy.
* Use React Suspense when rendering async modals ([#28386](https://github.com/element-hq/element-web/pull/28386)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Add spinner when room encryption is loading in room settings ([#28535](https://github.com/element-hq/element-web/pull/28535)). Contributed by @florianduros.
* Fix getOidcCallbackUrl for Element Desktop ([#28521](https://github.com/element-hq/element-web/pull/28521)). Contributed by @t3chguy.
* Filter out redacted poll votes to avoid crashing the Poll widget ([#28498](https://github.com/element-hq/element-web/pull/28498)). Contributed by @t3chguy.
* Fix force tab complete not working since switching to React 18 createRoot API ([#28505](https://github.com/element-hq/element-web/pull/28505)). Contributed by @t3chguy.
* Fix media captions in bubble layout ([#28480](https://github.com/element-hq/element-web/pull/28480)). Contributed by @tulir.
* Reset cross-signing before backup when resetting both ([#28402](https://github.com/element-hq/element-web/pull/28402)). Contributed by @uhoreg.
* Listen to events so that encryption icon updates when status changes ([#28407](https://github.com/element-hq/element-web/pull/28407)). Contributed by @uhoreg.
* Check that the file the user chose has a MIME type of `image/*` ([#28467](https://github.com/element-hq/element-web/pull/28467)). Contributed by @t3chguy.
* Fix download button size in message action bar ([#28472](https://github.com/element-hq/element-web/pull/28472)). Contributed by @t3chguy.
* Allow tab completing users in brackets ([#28460](https://github.com/element-hq/element-web/pull/28460)). Contributed by @t3chguy.
* Fix React 18 strict mode breaking spotlight dialog ([#28452](https://github.com/element-hq/element-web/pull/28452)). Contributed by @MidhunSureshR.



Changes in [1.11.86](https://github.com/element-hq/element-desktop/releases/tag/v1.11.86) (2024-11-19)
======================================================================================================
## ✨ Features

* Deduplicate icons using Compound Design Tokens ([#28419](https://github.com/element-hq/element-web/pull/28419)). Contributed by @t3chguy.
* Let widget driver send error details ([#28357](https://github.com/element-hq/element-web/pull/28357)). Contributed by @AndrewFerr.
* Deduplicate icons using Compound Design Tokens ([#28381](https://github.com/element-hq/element-web/pull/28381)). Contributed by @t3chguy.
* Auto approvoce `io.element.call.reaction` capability for element call widgets ([#28401](https://github.com/element-hq/element-web/pull/28401)). Contributed by @toger5.
* Show message type prefix in thread root \& reply previews ([#28361](https://github.com/element-hq/element-web/pull/28361)). Contributed by @t3chguy.
* Support sending encrypted to device messages from widgets ([#28315](https://github.com/element-hq/element-web/pull/28315)). Contributed by @hughns.

## 🐛 Bug Fixes

* Feed events to widgets as they are decrypted (even if out of order) ([#28376](https://github.com/element-hq/element-web/pull/28376)). Contributed by @robintown.
* Handle authenticated media when downloading from ImageView ([#28379](https://github.com/element-hq/element-web/pull/28379)). Contributed by @t3chguy.
* Ignore `m.3pid_changes` for Identity service 3PID changes ([#28375](https://github.com/element-hq/element-web/pull/28375)). Contributed by @t3chguy.
* Fix markdown escaping wrongly passing html through ([#28363](https://github.com/element-hq/element-web/pull/28363)). Contributed by @t3chguy.
* Remove "Upgrade your encryption" flow in `CreateSecretStorageDialog` ([#28290](https://github.com/element-hq/element-web/pull/28290)). Contributed by @florianduros.



Changes in [1.11.85](https://github.com/element-hq/element-desktop/releases/tag/v1.11.85) (2024-11-12)
======================================================================================================
# Security
- Fixes for [CVE-2024-51750](https://www.cve.org/CVERecord?id=CVE-2024-51750) / [GHSA-w36j-v56h-q9pc](https://github.com/element-hq/element-web/security/advisories/GHSA-w36j-v56h-q9pc)
- Fixes for [CVE-2024-51749](https://www.cve.org/CVERecord?id=CVE-2024-51749) / [GHSA-5486-384g-mcx2](https://github.com/element-hq/element-web/security/advisories/GHSA-5486-384g-mcx2)
- Update JS SDK with the fixes for [CVE-2024-50336](https://www.cve.org/CVERecord?id=CVE-2024-50336) / [GHSA-xvg8-m4x3-w6xr](https://github.com/matrix-org/matrix-js-sdk/security/advisories/GHSA-xvg8-m4x3-w6xr)


Changes in [1.11.84](https://github.com/element-hq/element-desktop/releases/tag/v1.11.84) (2024-11-05)
======================================================================================================
## ✨ Features

* Support specifying the config location manually (outside of the user's profile) ([#1921](https://github.com/element-hq/element-desktop/pull/1921)). Contributed by @Half-Shot.
* Remove abandoned MSC3886, MSC3903, MSC3906 implementations ([#28274](https://github.com/element-hq/element-web/pull/28274)). Contributed by @t3chguy.
* Update to React 18 ([#24763](https://github.com/element-hq/element-web/pull/24763)). Contributed by @t3chguy.
* Deduplicate icons using Compound ([#28239](https://github.com/element-hq/element-web/pull/28239)). Contributed by @t3chguy.
* Replace legacy Tooltips with Compound tooltips ([#28231](https://github.com/element-hq/element-web/pull/28231)). Contributed by @t3chguy.
* Deduplicate icons using Compound Design Tokens ([#28219](https://github.com/element-hq/element-web/pull/28219)). Contributed by @t3chguy.
* Add reactions to html export ([#28210](https://github.com/element-hq/element-web/pull/28210)). Contributed by @langleyd.
* Remove feature\_dehydration ([#28173](https://github.com/element-hq/element-web/pull/28173)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Improve seshat deleteContents ([#1916](https://github.com/element-hq/element-desktop/pull/1916)). Contributed by @langleyd.
* Remove upgrade encryption in `DeviceListener` and `SetupEncryptionToast` ([#28299](https://github.com/element-hq/element-web/pull/28299)). Contributed by @florianduros.
* Fix 'remove alias' button in room settings ([#28269](https://github.com/element-hq/element-web/pull/28269)). Contributed by @Dev-Gurjar.
* Add back unencrypted path in `StopGapWidgetDriver.sendToDevice` ([#28295](https://github.com/element-hq/element-web/pull/28295)). Contributed by @florianduros.
* Fix other devices not being decorated as such ([#28279](https://github.com/element-hq/element-web/pull/28279)). Contributed by @t3chguy.
* Fix pill contrast in invitation dialog ([#28250](https://github.com/element-hq/element-web/pull/28250)). Contributed by @florianduros.
* Close right panel chat when minimising maximised voip widget ([#28241](https://github.com/element-hq/element-web/pull/28241)). Contributed by @t3chguy.
* Fix develop changelog parsing ([#28232](https://github.com/element-hq/element-web/pull/28232)). Contributed by @t3chguy.
* Fix Ctrl+F shortcut not working with minimised room summary card ([#28223](https://github.com/element-hq/element-web/pull/28223)). Contributed by @t3chguy.
* Fix network dropdown missing checkbox \& aria-checked ([#28220](https://github.com/element-hq/element-web/pull/28220)). Contributed by @t3chguy.



Changes in [1.11.83](https://github.com/element-hq/element-desktop/releases/tag/v1.11.83) (2024-10-29)
======================================================================================================
## ✨ Features

* [Backport staging] Enable Element Call by default on release instances ([#1954](https://github.com/element-hq/element-desktop/pull/1954)). Contributed by @RiotRobot.
* Enable Element Call by default on release instances ([#28314](https://github.com/element-hq/element-web/pull/28314)). Contributed by @t3chguy.



Changes in [1.11.82](https://github.com/element-hq/element-desktop/releases/tag/v1.11.82) (2024-10-22)
======================================================================================================
## ✨ Features

* Add monochrome tray icon ([#1804](https://github.com/element-hq/element-desktop/pull/1804)). Contributed by @SakiiCode.
* Deduplicate more icons using Compound Design Tokens ([#132](https://github.com/element-hq/matrix-react-sdk/pull/132)). Contributed by @t3chguy.
* Always show link new device flow even if unsupported ([#147](https://github.com/element-hq/matrix-react-sdk/pull/147)). Contributed by @t3chguy.
* Update design of files list in right panel ([#144](https://github.com/element-hq/matrix-react-sdk/pull/144)). Contributed by @t3chguy.
* Remove feature\_dehydration ([#138](https://github.com/element-hq/matrix-react-sdk/pull/138)). Contributed by @florianduros.
* Upgrade emojibase-bindings and remove local handling of emoticon variations ([#127](https://github.com/element-hq/matrix-react-sdk/pull/127)). Contributed by @langleyd.
* Add support for rendering media captions ([#43](https://github.com/element-hq/matrix-react-sdk/pull/43)). Contributed by @tulir.
* Replace composer icons with Compound variants ([#123](https://github.com/element-hq/matrix-react-sdk/pull/123)). Contributed by @t3chguy.
* Tweak default right panel size to be 320px except for maximised widgets at 420px ([#110](https://github.com/element-hq/matrix-react-sdk/pull/110)). Contributed by @t3chguy.
* Add a pinned message badge under a pinned message ([#118](https://github.com/element-hq/matrix-react-sdk/pull/118)). Contributed by @florianduros.
* Ditch right panel tabs and re-add close button ([#99](https://github.com/element-hq/matrix-react-sdk/pull/99)). Contributed by @t3chguy.
* Force verification even for refreshed clients ([#44](https://github.com/element-hq/matrix-react-sdk/pull/44)). Contributed by @dbkr.
* Update emoji text, border and background colour in timeline ([#119](https://github.com/element-hq/matrix-react-sdk/pull/119)). Contributed by @florianduros.
* Disable ICE fallback based on well-known configuration ([#111](https://github.com/element-hq/matrix-react-sdk/pull/111)). Contributed by @t3chguy.
* Remove legacy room header and promote beta room header ([#105](https://github.com/element-hq/matrix-react-sdk/pull/105)). Contributed by @t3chguy.
* Respect `io.element.jitsi` `useFor1To1Calls` in well-known ([#112](https://github.com/element-hq/matrix-react-sdk/pull/112)). Contributed by @t3chguy.
* Use Compound close icon in favour of mishmash of x/close icons ([#108](https://github.com/element-hq/matrix-react-sdk/pull/108)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Correct typo in option documentation ([#28148](https://github.com/element-hq/element-web/pull/28148)). Contributed by @AndrewKvalheim.
* Revert #124 and #135 ([#139](https://github.com/element-hq/matrix-react-sdk/pull/139)). Contributed by @dbkr.
* Add aria-label to e2e icon ([#136](https://github.com/element-hq/matrix-react-sdk/pull/136)). Contributed by @florianduros.
* Fix bell icons on room list hover being black squares ([#135](https://github.com/element-hq/matrix-react-sdk/pull/135)). Contributed by @dbkr.
* Fix vertical overflow on the mobile register screen ([#137](https://github.com/element-hq/matrix-react-sdk/pull/137)). Contributed by @langleyd.
* Allow to unpin redacted event ([#98](https://github.com/element-hq/matrix-react-sdk/pull/98)). Contributed by @florianduros.



Changes in [1.11.81](https://github.com/element-hq/element-desktop/releases/tag/v1.11.81) (2024-10-15)
======================================================================================================
This release fixes High severity vulnerability CVE-2024-47771 / GHSA-963w-49j9-gxj6.

Changes in [1.11.80](https://github.com/element-hq/element-desktop/releases/tag/v1.11.80) (2024-10-08)
======================================================================================================
## ✨ Features

* enable Element Call on desktop nightly ([#1873](https://github.com/element-hq/element-desktop/pull/1873)). Contributed by @fkwp.
* Add doc for 'force\_verification config option ([#28035](https://github.com/element-hq/element-web/pull/28035)). Contributed by @dbkr.
* Roll back change to device isolation mode ([#104](https://github.com/element-hq/matrix-react-sdk/pull/104)). Contributed by @richvdh.
* Remove right panel toggling behaviour on room header buttons ([#100](https://github.com/element-hq/matrix-react-sdk/pull/100)). Contributed by @t3chguy.
* Improve error display for messages sent from insecure devices ([#93](https://github.com/element-hq/matrix-react-sdk/pull/93)). Contributed by @richvdh.
* Add labs option to exclude unverified devices ([#92](https://github.com/element-hq/matrix-react-sdk/pull/92)). Contributed by @richvdh.
* Improve contrast for timestamps, date separators \& spotlight trigger ([#91](https://github.com/element-hq/matrix-react-sdk/pull/91)). Contributed by @t3chguy.
* Open room settings on room header avatar click ([#88](https://github.com/element-hq/matrix-react-sdk/pull/88)). Contributed by @t3chguy.
* Use `strong` over `b` for improved a11y semantics ([#41](https://github.com/element-hq/matrix-react-sdk/pull/41)). Contributed by @t3chguy.
* Grant Element Call widget capabilities for "raise hand" feature ([#82](https://github.com/element-hq/matrix-react-sdk/pull/82)). Contributed by @AndrewFerr.
* Mobile registration optimizations and tests ([#62](https://github.com/element-hq/matrix-react-sdk/pull/62)). Contributed by @langleyd.
* Ignore chat effect when older than 48h ([#48](https://github.com/element-hq/matrix-react-sdk/pull/48)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Update native OIDC callback url to be RFC8252 compliant ([#28096](https://github.com/element-hq/element-web/pull/28096)). Contributed by @t3chguy.
* Update icons to include transparency ([#28040](https://github.com/element-hq/element-web/pull/28040)). Contributed by @t3chguy.
* Fix default\_widget\_container\_height in sample config ([#28034](https://github.com/element-hq/element-web/pull/28034)). Contributed by @dbkr.
* Fix untranslated keys being rendered in `/help` dialog ([#90](https://github.com/element-hq/matrix-react-sdk/pull/90)). Contributed by @t3chguy.
* Ensure timeline search results are visible even in video rooms ([#96](https://github.com/element-hq/matrix-react-sdk/pull/96)). Contributed by @t3chguy.
* Pop right panel timeline when unmaximising widget to avoid double timeline ([#94](https://github.com/element-hq/matrix-react-sdk/pull/94)). Contributed by @t3chguy.
* Fix accessible label on left panel spotlight trigger ([#87](https://github.com/element-hq/matrix-react-sdk/pull/87)). Contributed by @t3chguy.
* Crypto: fix display of device key ([#86](https://github.com/element-hq/matrix-react-sdk/pull/86)). Contributed by @richvdh.



Changes in [1.11.79](https://github.com/element-hq/element-desktop/releases/tag/v1.11.79) (2024-10-01)
======================================================================================================
* No changes

## ✨ Features

* [Backport staging] Allow joining calls and video rooms without enabling the labs flags ([#106](https://github.com/element-hq/matrix-react-sdk/pull/106)). Contributed by @RiotRobot.



Changes in [1.11.78](https://github.com/element-hq/element-desktop/releases/tag/v1.11.78) (2024-09-24)
======================================================================================================
* No changes

## ✨ Features

* Add Release announcement for the pinning message list ([#46](https://github.com/element-hq/matrix-react-sdk/pull/46)). Contributed by @florianduros.
* Unlabs feature pinning ([#22](https://github.com/element-hq/matrix-react-sdk/pull/22)). Contributed by @florianduros.
* Add mobile registration ([#42](https://github.com/element-hq/matrix-react-sdk/pull/42)). Contributed by @langleyd.
* Add support for `org.matrix.cross_signing_reset` UIA stage flow ([#34](https://github.com/element-hq/matrix-react-sdk/pull/34)). Contributed by @t3chguy.
* Add timezone to user profile ([#20](https://github.com/element-hq/matrix-react-sdk/pull/20)). Contributed by @Half-Shot.
* Add config option to force verification ([#29](https://github.com/element-hq/matrix-react-sdk/pull/29)). Contributed by @dbkr.
* Reduce pinned message banner size ([#28](https://github.com/element-hq/matrix-react-sdk/pull/28)). Contributed by @florianduros.
* Enable message pinning labs by default ([#25](https://github.com/element-hq/matrix-react-sdk/pull/25)). Contributed by @florianduros.
* Remove release announcement of the new header ([#23](https://github.com/element-hq/matrix-react-sdk/pull/23)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Fix timeout type ([#40](https://github.com/element-hq/matrix-react-sdk/pull/40)). Contributed by @dbkr.
* Fix huge usage bandwidth and performance issue of pinned message banner. ([#37](https://github.com/element-hq/matrix-react-sdk/pull/37)). Contributed by @florianduros.
* Reverse order of pinned message list ([#19](https://github.com/element-hq/matrix-react-sdk/pull/19)). Contributed by @florianduros.



Changes in [1.11.77](https://github.com/element-hq/element-desktop/releases/tag/v1.11.77) (2024-09-10)
======================================================================================================
## Licensing

matrix-react-sdk is being forked by Element at https://github.com/element-hq/matrix-react-sdk. Contributions are licensed to Element under a CLA and made available under an AGPLv3.0 or GPLv3.0 license at your choice.

You can read more about this here:
https://matrix.org/blog/2024/08/heart-of-matrix/
https://element.io/blog/sustainable-licensing-at-element-with-agpl/ 

The Matrix.org Foundation copy of the project will be archived. We don't expect any changes are needed by system administrators. Any updates will be communicated via our usual announcements channels and we are striving to make this as seamless as possible.

## ✨ Features

* Add docs for widget container height option ([#27922](https://github.com/element-hq/element-web/pull/27922)). Contributed by @dbkr.
* Allow user to set timezone ([#12775](https://github.com/matrix-org/matrix-react-sdk/pull/12775)). Contributed by @Timshel.
* Implement download\_file in widget driver ([#12931](https://github.com/matrix-org/matrix-react-sdk/pull/12931)). Contributed by @weeman1337.
* Sort the pinning message list in the same order than the banner. By timeline order. ([#12937](https://github.com/matrix-org/matrix-react-sdk/pull/12937)). Contributed by @florianduros.
* Display pinned messages on a banner at the top of a room ([#12917](https://github.com/matrix-org/matrix-react-sdk/pull/12917)). Contributed by @florianduros.
* Add a config option to control the default widget container height ([#12893](https://github.com/matrix-org/matrix-react-sdk/pull/12893)). Contributed by @dbkr.
* RTE drafts ([#12674](https://github.com/matrix-org/matrix-react-sdk/pull/12674)). Contributed by @langleyd.
* Add thread information in pinned message list ([#12902](https://github.com/matrix-org/matrix-react-sdk/pull/12902)). Contributed by @florianduros.
* Add Pin/Unpin action in quick access of the message action bar ([#12897](https://github.com/matrix-org/matrix-react-sdk/pull/12897)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Fix read receipt animation ([#12923](https://github.com/matrix-org/matrix-react-sdk/pull/12923)). Contributed by @dbkr.
* Display the indicator even with one message in pinned message banner ([#12946](https://github.com/matrix-org/matrix-react-sdk/pull/12946)). Contributed by @florianduros.
* Always display last pinned message on the banner ([#12945](https://github.com/matrix-org/matrix-react-sdk/pull/12945)). Contributed by @florianduros.
* The pinned message banner or list are triggering  🎉 effect. ([#12944](https://github.com/matrix-org/matrix-react-sdk/pull/12944)). Contributed by @florianduros.
* Fix reply message truncation on 2 lines ([#12929](https://github.com/matrix-org/matrix-react-sdk/pull/12929)). Contributed by @florianduros.
* Fix pin/unpin slowness and non refresh from the message action bar ([#12934](https://github.com/matrix-org/matrix-react-sdk/pull/12934)). Contributed by @florianduros.
* Ignore desktop for minimum browser support. ([#12928](https://github.com/matrix-org/matrix-react-sdk/pull/12928)). Contributed by @florianduros.



Changes in [1.11.76](https://github.com/element-hq/element-desktop/releases/tag/v1.11.76) (2024-08-27)
======================================================================================================
## ✨ Features

* Message Pinning: rework the message pinning list in the right panel ([#12825](https://github.com/matrix-org/matrix-react-sdk/pull/12825)). Contributed by @florianduros.
* Tweak UIA postMessage check to work cross-origin ([#12878](https://github.com/matrix-org/matrix-react-sdk/pull/12878)). Contributed by @t3chguy.
* Delayed events (Futures) / MSC4140 for call widget ([#12714](https://github.com/matrix-org/matrix-react-sdk/pull/12714)). Contributed by @AndrewFerr.
* Stop the ongoing ring if another device joins the call session. ([#12866](https://github.com/matrix-org/matrix-react-sdk/pull/12866)). Contributed by @toger5.
* Rich text Editor: Auto-replace plain text emoticons with emoji ([#12828](https://github.com/matrix-org/matrix-react-sdk/pull/12828)). Contributed by @langleyd.
* Clean up editor drafts for unknown rooms  ([#12850](https://github.com/matrix-org/matrix-react-sdk/pull/12850)). Contributed by @langleyd.
* Rename general user settings to account ([#12841](https://github.com/matrix-org/matrix-react-sdk/pull/12841)). Contributed by @dbkr.
* Update settings tab icons ([#12867](https://github.com/matrix-org/matrix-react-sdk/pull/12867)). Contributed by @dbkr.
* Disable jump to read receipt button instead of hiding when nothing to jump to ([#12863](https://github.com/matrix-org/matrix-react-sdk/pull/12863)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Ensure elements on Login page are disabled when in-flight ([#12895](https://github.com/matrix-org/matrix-react-sdk/pull/12895)). Contributed by @t3chguy.
* Hide pinned messages when grouped in timeline when feature pinning is disabled ([#12888](https://github.com/matrix-org/matrix-react-sdk/pull/12888)). Contributed by @florianduros.
* Add chat button on new room header for maximised widgets ([#12882](https://github.com/matrix-org/matrix-react-sdk/pull/12882)). Contributed by @t3chguy.
* Show spinner whilst initial search request is in progress ([#12883](https://github.com/matrix-org/matrix-react-sdk/pull/12883)). Contributed by @t3chguy.
* Fix user menu font ([#12879](https://github.com/matrix-org/matrix-react-sdk/pull/12879)). Contributed by @florianduros.
* Allow selecting text in the right panel topic ([#12870](https://github.com/matrix-org/matrix-react-sdk/pull/12870)). Contributed by @t3chguy.
* Add missing presence indicator to new room header ([#12865](https://github.com/matrix-org/matrix-react-sdk/pull/12865)). Contributed by @t3chguy.
* Fix permissions in release tarballs ([#27904](https://github.com/element-hq/element-web/pull/27904)). Contributed by @t3chguy.

## 🧰 Maintenance

* Update dependencies for MSC4157 ([#27906](https://github.com/element-hq/element-web/pull/27906)). Contributed by @AndrewFerr.


Changes in [1.11.75](https://github.com/element-hq/element-desktop/releases/tag/v1.11.75) (2024-08-20)
======================================================================================================
# Security
- Fixes for [CVE-2024-42369](https://nvd.nist.gov/vuln/detail/CVE-2024-42369) / [GHSA-vhr5-g3pm-49fm](https://github.com/matrix-org/matrix-js-sdk/security/advisories/GHSA-vhr5-g3pm-49fm).

Changes in [1.11.74](https://github.com/element-hq/element-desktop/releases/tag/v1.11.74) (2024-08-13)
======================================================================================================
## ✨ Features

* Update unsupported browser react component to new designs ([#27857](https://github.com/element-hq/element-web/pull/27857)). Contributed by @t3chguy.
* Invite dialog: display MXID on its own line ([#11756](https://github.com/matrix-org/matrix-react-sdk/pull/11756)). Contributed by @AndrewFerr.
* Align RoomSummaryCard styles with Figma ([#12793](https://github.com/matrix-org/matrix-react-sdk/pull/12793)). Contributed by @t3chguy.
* Extract Extensions into their own right panel tab ([#12844](https://github.com/matrix-org/matrix-react-sdk/pull/12844)). Contributed by @t3chguy.
* Remove topic from new room header and expand right panel topic ([#12842](https://github.com/matrix-org/matrix-react-sdk/pull/12842)). Contributed by @t3chguy.
* Rework how the onboarding notifications task works ([#12839](https://github.com/matrix-org/matrix-react-sdk/pull/12839)). Contributed by @t3chguy.
* Update toast styles to match Figma ([#12833](https://github.com/matrix-org/matrix-react-sdk/pull/12833)). Contributed by @t3chguy.
* Warn users on unsupported browsers before they lack features ([#12830](https://github.com/matrix-org/matrix-react-sdk/pull/12830)). Contributed by @t3chguy.
* Add sign out button to settings profile section ([#12666](https://github.com/matrix-org/matrix-react-sdk/pull/12666)). Contributed by @dbkr.
* Remove MatrixRTC realted import ES lint exceptions using a index.ts for matrixrtc ([#12780](https://github.com/matrix-org/matrix-react-sdk/pull/12780)). Contributed by @toger5.
* Fix unwanted ringing of other devices even though the user is already connected to the call. ([#12742](https://github.com/matrix-org/matrix-react-sdk/pull/12742)). Contributed by @toger5.
* Acknowledge `DeviceMute` widget actions ([#12790](https://github.com/matrix-org/matrix-react-sdk/pull/12790)). Contributed by @toger5.

## 🐛 Bug Fixes

* Update Element icons ([#27900](https://github.com/element-hq/element-web/pull/27900)). Contributed by @t3chguy.
* Fix Jitsi by updating device mute updates over postMessage API ([#27858](https://github.com/element-hq/element-web/pull/27858)). Contributed by @t3chguy.
* Fix formatting of rich text emotes ([#12862](https://github.com/matrix-org/matrix-react-sdk/pull/12862)). Contributed by @dbkr.
* Fixed custom emotes background color #27745 ([#12798](https://github.com/matrix-org/matrix-react-sdk/pull/12798)). Contributed by @asimdelvi.
* Ignore permalink\_prefix when serializing pills ([#11726](https://github.com/matrix-org/matrix-react-sdk/pull/11726)). Contributed by @herkulessi.
* Deflake the chat export test ([#12854](https://github.com/matrix-org/matrix-react-sdk/pull/12854)). Contributed by @dbkr.
* Fix alignment of RTL messages ([#12837](https://github.com/matrix-org/matrix-react-sdk/pull/12837)). Contributed by @dbkr.
* Handle media download errors better ([#12848](https://github.com/matrix-org/matrix-react-sdk/pull/12848)). Contributed by @t3chguy.
* Make micIcon display on primary ([#11908](https://github.com/matrix-org/matrix-react-sdk/pull/11908)). Contributed by @kdanielm.
* Fix compound typography font component issues ([#12826](https://github.com/matrix-org/matrix-react-sdk/pull/12826)). Contributed by @t3chguy.
* Allow Chrome page translator to translate messages in rooms ([#11113](https://github.com/matrix-org/matrix-react-sdk/pull/11113)). Contributed by @lukaszpolowczyk.



Changes in [1.11.73](https://github.com/element-hq/element-desktop/releases/tag/v1.11.73) (2024-08-06)
======================================================================================================
Fixes for CVE-2024-42347 / GHSA-f83w-wqhc-cfp4



Changes in [1.11.72](https://github.com/element-hq/element-desktop/releases/tag/v1.11.72) (2024-07-30)
======================================================================================================
## ✨ Features

* Support authenticated media downloads in Desktop too ([#1757](https://github.com/element-hq/element-desktop/pull/1757)). Contributed by @turt2live.
* Polyfill Intl.Segmenter for wider web browser compatibility ([#27803](https://github.com/element-hq/element-web/pull/27803)). Contributed by @dbkr.
* Enable audio/webaudio Modernizr rule ([#27772](https://github.com/element-hq/element-web/pull/27772)). Contributed by @t3chguy.
* Add release announcement for the new room header ([#12802](https://github.com/matrix-org/matrix-react-sdk/pull/12802)). Contributed by @MidhunSureshR.
* Default the room header to on ([#12803](https://github.com/matrix-org/matrix-react-sdk/pull/12803)). Contributed by @MidhunSureshR.
* Update Thread Panel to match latest designs ([#12797](https://github.com/matrix-org/matrix-react-sdk/pull/12797)). Contributed by @t3chguy.
* Close any open modals on logout ([#12777](https://github.com/matrix-org/matrix-react-sdk/pull/12777)). Contributed by @dbkr.
* Iterate design of right panel empty state ([#12796](https://github.com/matrix-org/matrix-react-sdk/pull/12796)). Contributed by @t3chguy.
* Update styling of UserInfo right panel card ([#12788](https://github.com/matrix-org/matrix-react-sdk/pull/12788)). Contributed by @t3chguy.
* Accessibility: Add Landmark navigation ([#12190](https://github.com/matrix-org/matrix-react-sdk/pull/12190)). Contributed by @akirk.
* Let Element Call widget receive m.room.create ([#12710](https://github.com/matrix-org/matrix-react-sdk/pull/12710)). Contributed by @AndrewFerr.
* Let Element Call widget set session memberships ([#12713](https://github.com/matrix-org/matrix-react-sdk/pull/12713)). Contributed by @AndrewFerr.
* Update right panel base card styling to match Compound ([#12768](https://github.com/matrix-org/matrix-react-sdk/pull/12768)). Contributed by @t3chguy.
* Align `widget_build_url_ignore_dm` with call behaviour switch between 1:1 and Widget ([#12760](https://github.com/matrix-org/matrix-react-sdk/pull/12760)). Contributed by @t3chguy.
* Move integrations switch ([#12733](https://github.com/matrix-org/matrix-react-sdk/pull/12733)). Contributed by @dbkr.
* Element-R: Report events with withheld keys separately to Posthog. ([#12755](https://github.com/matrix-org/matrix-react-sdk/pull/12755)). Contributed by @richvdh.

## 🐛 Bug Fixes

* Fix Docker tooling for building native components ([#1779](https://github.com/element-hq/element-desktop/pull/1779)). Contributed by @t3chguy.
* Add a modernizr check for WebAssembly support ([#27776](https://github.com/element-hq/element-web/pull/27776)). Contributed by @dbkr.
* Test for lack of WebAssembly support ([#12792](https://github.com/matrix-org/matrix-react-sdk/pull/12792)). Contributed by @dbkr.
* Fix stray 'account' heading ([#12791](https://github.com/matrix-org/matrix-react-sdk/pull/12791)). Contributed by @dbkr.
* Add test for the unsupported browser screen ([#12787](https://github.com/matrix-org/matrix-react-sdk/pull/12787)). Contributed by @dbkr.
* Fix HTML export test ([#12778](https://github.com/matrix-org/matrix-react-sdk/pull/12778)). Contributed by @dbkr.
* Fix HTML export missing a bunch of Compound variables ([#12774](https://github.com/matrix-org/matrix-react-sdk/pull/12774)). Contributed by @t3chguy.
* Fix inability to change accent colour consistently in custom theming ([#12772](https://github.com/matrix-org/matrix-react-sdk/pull/12772)). Contributed by @t3chguy.
* Fix edge case of landing on 3pid email link with registration disabled ([#12771](https://github.com/matrix-org/matrix-react-sdk/pull/12771)). Contributed by @t3chguy.



Changes in [1.11.71](https://github.com/element-hq/element-desktop/releases/tag/v1.11.71) (2024-07-16)
======================================================================================================
## ✨ Features

* Add Modernizr rule for Intl.Segmenter ([#27677](https://github.com/element-hq/element-web/pull/27677)). Contributed by @t3chguy.
* Add tabs to the right panel ([#12672](https://github.com/matrix-org/matrix-react-sdk/pull/12672)). Contributed by @MidhunSureshR.
* Promote new room header from labs to Beta ([#12739](https://github.com/matrix-org/matrix-react-sdk/pull/12739)). Contributed by @t3chguy.
* Redesign room search interface ([#12677](https://github.com/matrix-org/matrix-react-sdk/pull/12677)). Contributed by @t3chguy.
* Move language settings to 'preferences' ([#12723](https://github.com/matrix-org/matrix-react-sdk/pull/12723)). Contributed by @dbkr.
* New layout selector ui in user settings ([#12676](https://github.com/matrix-org/matrix-react-sdk/pull/12676)). Contributed by @florianduros.
* Prevent Element appearing in system media controls  ([#10995](https://github.com/matrix-org/matrix-react-sdk/pull/10995)). Contributed by @SuperKenVery.
* Move the account management button ([#12663](https://github.com/matrix-org/matrix-react-sdk/pull/12663)). Contributed by @dbkr.
* Disable profile controls if the HS doesn't allow them to be set ([#12652](https://github.com/matrix-org/matrix-react-sdk/pull/12652)). Contributed by @dbkr.
* New theme ui in user settings ([#12576](https://github.com/matrix-org/matrix-react-sdk/pull/12576)). Contributed by @florianduros.
* Adjust room header hover transition from 300ms to 200ms ([#12703](https://github.com/matrix-org/matrix-react-sdk/pull/12703)). Contributed by @t3chguy.
* Split out email \& phone number settings to separate components \& move discovery to privacy tab ([#12670](https://github.com/matrix-org/matrix-react-sdk/pull/12670)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Ensure we do not load matrix-react-sdk is a manner which can white-screen ([#27685](https://github.com/element-hq/element-web/pull/27685)). Contributed by @t3chguy.
* Fix incoming call toast crash due to audio refactor ([#12737](https://github.com/matrix-org/matrix-react-sdk/pull/12737)). Contributed by @t3chguy.
* Improve new room header accessibility ([#12725](https://github.com/matrix-org/matrix-react-sdk/pull/12725)). Contributed by @t3chguy.
* Fix closing all modals ([#12728](https://github.com/matrix-org/matrix-react-sdk/pull/12728)). Contributed by @dbkr.
* Fix close button on forgot password flow ([#12732](https://github.com/matrix-org/matrix-react-sdk/pull/12732)). Contributed by @dbkr.
* Don't consider textual characters to be emoji ([#12582](https://github.com/matrix-org/matrix-react-sdk/pull/12582)). Contributed by @robintown.
* Clear autocomplete input on selection accept ([#12709](https://github.com/matrix-org/matrix-react-sdk/pull/12709)). Contributed by @dbkr.
* Fix `Match system theme` toggle ([#12719](https://github.com/matrix-org/matrix-react-sdk/pull/12719)). Contributed by @florianduros.



Changes in [1.11.70](https://github.com/element-hq/element-desktop/releases/tag/v1.11.70) (2024-07-08)
======================================================================================================
## ✨ Features

* Tighten macOS entitlements ([#1731](https://github.com/element-hq/element-desktop/pull/1731)). Contributed by @t3chguy.
* Add SSO redirect option for login page ([#27576](https://github.com/element-hq/element-web/pull/27576)). Contributed by @bartvdbraak.
* Use stable endpoints for MSC3916 ([#27558](https://github.com/element-hq/element-web/pull/27558)). Contributed by @turt2live.
* Switch to Rust crypto stack for all logins ([#12630](https://github.com/matrix-org/matrix-react-sdk/pull/12630)). Contributed by @richvdh.
* Hide voip buttons in group rooms in environments with widgets disabled ([#12664](https://github.com/matrix-org/matrix-react-sdk/pull/12664)). Contributed by @t3chguy.
* Minor tweaks to UserSettings dialog ([#12651](https://github.com/matrix-org/matrix-react-sdk/pull/12651)). Contributed by @florianduros.
* Hide voice call button when redundant ([#12639](https://github.com/matrix-org/matrix-react-sdk/pull/12639)). Contributed by @t3chguy.
* Improve accessibility of the room summary card ([#12586](https://github.com/matrix-org/matrix-react-sdk/pull/12586)). Contributed by @t3chguy.
* Show tooltips on narrow tabbed views ([#12624](https://github.com/matrix-org/matrix-react-sdk/pull/12624)). Contributed by @dbkr.
* Update gfm.css to github-markdown-css ([#12613](https://github.com/matrix-org/matrix-react-sdk/pull/12613)). Contributed by @t3chguy.
* Cache e2eStatus to avoid concerning unencrypted flicker when changing rooms ([#12606](https://github.com/matrix-org/matrix-react-sdk/pull/12606)). Contributed by @t3chguy.
* Tweak copy for user verification toast ([#12605](https://github.com/matrix-org/matrix-react-sdk/pull/12605)). Contributed by @t3chguy.
* Support s tags for strikethrough for Matrix v1.10 ([#12604](https://github.com/matrix-org/matrix-react-sdk/pull/12604)). Contributed by @t3chguy.

## 🐛 Bug Fixes

* Switch debs to use the SQLCipher static version ([#1001](https://github.com/element-hq/element-desktop/pull/1001)). Contributed by @MatMaul.
* Fix "Unable to restore session" error ([#4299](https://github.com/matrix-org/matrix-js-sdk/pull/4299)).
* Fix error when sending encrypted messages in large rooms ([#4297](https://github.com/matrix-org/matrix-js-sdk/pull/4297)).
* Remove redundant copy in deactive uia modal ([#12668](https://github.com/matrix-org/matrix-react-sdk/pull/12668)). Contributed by @t3chguy.
* Fix high contrast theme in settings ([#12649](https://github.com/matrix-org/matrix-react-sdk/pull/12649)). Contributed by @florianduros.
* Fix background on live location sharing footer ([#12629](https://github.com/matrix-org/matrix-react-sdk/pull/12629)). Contributed by @t3chguy.
* Remove outdated iframe sandbox attribute ([#12633](https://github.com/matrix-org/matrix-react-sdk/pull/12633)). Contributed by @t3chguy.
* Remove stray setState which caused encryption state shields to flicker ([#12632](https://github.com/matrix-org/matrix-react-sdk/pull/12632)). Contributed by @t3chguy.
* Fix stray background colour on markdown body ([#12628](https://github.com/matrix-org/matrix-react-sdk/pull/12628)). Contributed by @t3chguy.
* Fix widgets not being cleaned up correctly. ([#12616](https://github.com/matrix-org/matrix-react-sdk/pull/12616)). Contributed by @toger5.
* Add in-progress view to display name EditInPlace ([#12609](https://github.com/matrix-org/matrix-react-sdk/pull/12609)). Contributed by @dbkr.
* Fix config override of other settings levels ([#12593](https://github.com/matrix-org/matrix-react-sdk/pull/12593)). Contributed by @langleyd.
* Don't show 'saved' on display name save error ([#12600](https://github.com/matrix-org/matrix-react-sdk/pull/12600)). Contributed by @dbkr.



Changes in [1.11.69](https://github.com/element-hq/element-desktop/releases/tag/v1.11.69) (2024-06-18)
======================================================================================================
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



Changes in [1.11.68](https://github.com/element-hq/element-desktop/releases/tag/v1.11.68) (2024-06-04)
======================================================================================================
Updates to Electron 30

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



Changes in [1.11.67](https://github.com/element-hq/element-desktop/releases/tag/v1.11.67) (2024-05-22)
======================================================================================================
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



Changes in [1.11.66](https://github.com/element-hq/element-desktop/releases/tag/v1.11.66) (2024-05-07)
======================================================================================================
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



Changes in [1.11.65](https://github.com/element-hq/element-desktop/releases/tag/v1.11.65) (2024-04-23)
======================================================================================================
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



Changes in [1.11.64](https://github.com/element-hq/element-desktop/releases/tag/v1.11.64) (2024-04-09)
======================================================================================================
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



Changes in [1.11.63](https://github.com/element-hq/element-desktop/releases/tag/v1.11.63) (2024-03-28)
======================================================================================================
This is a hotfix release to fix a couple of issues: one where the client would sometimes call the client/server API to set a push rule in a loop, and one where authentication was not sent for widgets when it should have been.

## 🐛 Bug Fixes

* Revert "Make EC widget theme reactive - Update widget url when the theme changes" ([#12383](https://github.com/matrix-org/matrix-react-sdk/pull/12383)) in order to fix widgets that require authentication.
* Update to hotfixed js-sdk to fix an issue where Element could try to set a push rule in a loop.

Changes in [1.11.62](https://github.com/element-hq/element-desktop/releases/tag/v1.11.62) (2024-03-26)
======================================================================================================
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



Changes in [1.11.61](https://github.com/element-hq/element-desktop/releases/tag/v1.11.61) (2024-03-14)
======================================================================================================
* No changes

## 🐛 Bug Fixes

* Update `@vector-im/compound-design-tokens` in package.json ([#12340](https://github.com/matrix-org/matrix-react-sdk/pull/12340)).



Changes in [1.11.60](https://github.com/element-hq/element-desktop/releases/tag/v1.11.60) (2024-03-12)
======================================================================================================
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



Changes in [1.11.59](https://github.com/element-hq/element-desktop/releases/tag/v1.11.59) (2024-02-27)
======================================================================================================
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



Changes in [1.11.58](https://github.com/element-hq/element-desktop/releases/tag/v1.11.58) (2024-02-13)
======================================================================================================
* 🦀  🔒 **The flag to enable the Rust crypto implementation is now set to `true` by default. This means that without any additional configuration every new login will use the new cryptography implementation.**
* Add Element call related functionality to new room header ([#12091](https://github.com/matrix-org/matrix-react-sdk/pull/12091)). Contributed by @toger5.
* Add labs flag for Threads Activity Centre ([#12137](https://github.com/matrix-org/matrix-react-sdk/pull/12137)). Contributed by @florianduros.
* Refactor element call lobby + skip lobby ([#12057](https://github.com/matrix-org/matrix-react-sdk/pull/12057)). Contributed by @toger5.
* Hide the "Message" button in the sidebar if the CreateRooms components should not be shown ([#9271](https://github.com/matrix-org/matrix-react-sdk/pull/9271)). Contributed by @dhenneke.
* Add notification dots to thread summary icons ([#12146](https://github.com/matrix-org/matrix-react-sdk/pull/12146)). Contributed by @dbkr.

## 🐛 Bug Fixes

* Fix logout can take ages ([#12191](https://github.com/matrix-org/matrix-react-sdk/pull/12191)). Contributed by @BillCarsonFr.
* Fix `Mark all as read` in settings ([#12205](https://github.com/matrix-org/matrix-react-sdk/pull/12205)). Contributed by @florianduros.
* Fix default thread notification of the new RoomHeader ([#12194](https://github.com/matrix-org/matrix-react-sdk/pull/12194)). Contributed by @florianduros.
* Fix display of room notification debug info ([#12183](https://github.com/matrix-org/matrix-react-sdk/pull/12183)). Contributed by @dbkr.

Changes in [1.11.57](https://github.com/element-hq/element-desktop/releases/tag/v1.11.57) (2024-01-31)
======================================================================================================
## 🦖 Deprecations

* Deprecate welcome bot `welcome_user_id` support ([#26885](https://github.com/element-hq/element-web/pull/26885)). Contributed by @t3chguy.

## 🦖 Deprecations

* Deprecate welcome bot `welcome_user_id` support ([#26885](https://github.com/element-hq/element-web/pull/26885)). Contributed by @t3chguy.

## ✨ Features

* Use jitsi-lobby in video channel (video rooms) ([#26879](https://github.com/element-hq/element-web/pull/26879)). Contributed by @toger5.
## 🐛 Bug Fixes

* Fix OIDC bugs due to amnesiac stores forgetting OIDC issuer \& other data ([#12166](https://github.com/matrix-org/matrix-react-sdk/pull/12166)). Contributed by @t3chguy.
* Fix account management link for delegated auth OIDC setups ([#12144](https://github.com/matrix-org/matrix-react-sdk/pull/12144)). Contributed by @t3chguy.
* Fix Safari IME support ([#11016](https://github.com/matrix-org/matrix-react-sdk/pull/11016)). Contributed by @SuperKenVery.
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12127](https://github.com/matrix-org/matrix-react-sdk/pull/12127)).
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12126](https://github.com/matrix-org/matrix-react-sdk/pull/12126)). Contributed by @t3chguy.
* Fix 1F97A and 1F979 in Twemoji COLR font ([#12177](https://github.com/matrix-org/matrix-react-sdk/pull/12177)).
## ✨ Features

* Use jitsi-lobby in video channel (video rooms) ([#26879](https://github.com/element-hq/element-web/pull/26879)). Contributed by @toger5.
## 🐛 Bug Fixes
* Fix OIDC bugs due to amnesiac stores forgetting OIDC issuer \& other data ([#12166](https://github.com/matrix-org/matrix-react-sdk/pull/12166)). Contributed by @t3chguy.
* Fix account management link for delegated auth OIDC setups ([#12144](https://github.com/matrix-org/matrix-react-sdk/pull/12144)). Contributed by @t3chguy.
* Fix Safari IME support ([#11016](https://github.com/matrix-org/matrix-react-sdk/pull/11016)). Contributed by @SuperKenVery.
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12127](https://github.com/matrix-org/matrix-react-sdk/pull/12127)).
* Fix Stickerpicker layout crossing multiple CSS stacking contexts ([#12126](https://github.com/matrix-org/matrix-react-sdk/pull/12126)). Contributed by @t3chguy.
* Fix 1F97A and 1F979 in Twemoji COLR font ([#12177](https://github.com/matrix-org/matrix-react-sdk/pull/12177)).



Changes in [1.11.54](https://github.com/element-hq/element-desktop/releases/tag/v1.11.54) (2024-01-16)
======================================================================================================
## 🔧 Security

* Burn Node-related Electron fuses as a proactive hardening measure ([#1412](https://github.com/element-hq/element-desktop/pull/1412)). Contributed by @t3chguy.


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


Changes in [1.11.53](https://github.com/element-hq/element-desktop/releases/tag/v1.11.53) (2024-01-04)
======================================================================================================

## 🐛 Bug Fixes
* Fix a fresh login creating a new key backup ([#12106](https://github.com/matrix-org/matrix-react-sdk/pull/12106)).


Changes in [1.11.52](https://github.com/element-hq/element-desktop/releases/tag/v1.11.52) (2023-12-19)
======================================================================================================


## ✨ Features
* Keep more recent rageshake logs ([#12003](https://github.com/matrix-org/matrix-react-sdk/pull/12003)). Contributed by @richvdh.
## 🐛 Bug Fixes
* Fix bug which prevented correct clean up of rageshake store ([#12002](https://github.com/matrix-org/matrix-react-sdk/pull/12002)). Contributed by @richvdh.
* Set up key backup using non-deprecated APIs ([#12005](https://github.com/matrix-org/matrix-react-sdk/pull/12005)). Contributed by @andybalaam.
* Fix notifications appearing for old events ([#3946](https://github.com/matrix-org/matrix-js-sdk/pull/3946)). Contributed by @dbkr.
* Prevent phantom notifications from events not in a room's timeline ([#3942](https://github.com/matrix-org/matrix-js-sdk/pull/3942)). Contributed by @dbkr.


Changes in [1.11.51](https://github.com/vector-im/element-desktop/releases/tag/v1.11.51) (2023-12-05)
=====================================================================================================


## 🦖 Deprecations
* Remove Quote from MessageContextMenu as it is unsupported by WYSIWYG ([#11914](https://github.com/matrix-org/matrix-react-sdk/pull/11914)). Contributed by @t3chguy.
## ✨ Features
* Always allow call.member events on new rooms ([#11948](https://github.com/matrix-org/matrix-react-sdk/pull/11948)). Contributed by @toger5.
* Right panel: view third party invite info without clearing history ([#11934](https://github.com/matrix-org/matrix-react-sdk/pull/11934)). Contributed by @kerryarchibald.
* Allow switching to system emoji font ([#11925](https://github.com/matrix-org/matrix-react-sdk/pull/11925)). Contributed by @t3chguy.
* Update open in other tab message ([#11916](https://github.com/matrix-org/matrix-react-sdk/pull/11916)). Contributed by @weeman1337.
* Add menu for legacy and element call in 1:1 rooms ([#11910](https://github.com/matrix-org/matrix-react-sdk/pull/11910)). Contributed by @toger5.
* Add ringing for matrixRTC ([#11870](https://github.com/matrix-org/matrix-react-sdk/pull/11870)). Contributed by @toger5.
## 🐛 Bug Fixes
* Keep device language when it has been previosuly set, after a successful delegated authentication flow that clears localStorage ([#11902](https://github.com/matrix-org/matrix-react-sdk/pull/11902)). Contributed by @mgcm.
* Fix misunderstanding of functional members ([#11918](https://github.com/matrix-org/matrix-react-sdk/pull/11918)). Contributed by @toger5.
* Fix: Video Room Chat Header Button Removed ([#11911](https://github.com/matrix-org/matrix-react-sdk/pull/11911)). Contributed by @kerryarchibald.
* Fix "not attempting encryption" warning ([#11899](https://github.com/matrix-org/matrix-react-sdk/pull/11899)). Contributed by @richvdh.


Changes in [1.11.50](https://github.com/vector-im/element-desktop/releases/tag/v1.11.50) (2023-11-21)
=====================================================================================================

## ✨ Features

* Ship element-web as a debian package ([#26533](https://github.com/vector-im/element-web/pull/26533)). Contributed by @t3chguy.
* Update room summary card header ([#11823](https://github.com/matrix-org/matrix-react-sdk/pull/11823)). Contributed by @germain-gg.
* Add feature flag for disabling encryption in Element Call ([#11837](https://github.com/matrix-org/matrix-react-sdk/pull/11837)). Contributed by @toger5.
* Adapt the rendering of extra icons in the room header ([#11835](https://github.com/matrix-org/matrix-react-sdk/pull/11835)). Contributed by @charlynguyen.
* Implement new unreachable state and fix broken string ref  ([#11748](https://github.com/matrix-org/matrix-react-sdk/pull/11748)). Contributed by @MidhunSureshR.
* Allow adding extra icons to the room header ([#11799](https://github.com/matrix-org/matrix-react-sdk/pull/11799)). Contributed by @charlynguyen.

## 🐛 Bug Fixes

* Room header: do not collapse avatar or facepile ([#11866](https://github.com/matrix-org/matrix-react-sdk/pull/11866)). Contributed by @kerryarchibald.
* New right panel: fix button alignment in memberlist ([#11861](https://github.com/matrix-org/matrix-react-sdk/pull/11861)). Contributed by @kerryarchibald.
* Use the correct video call icon variant ([#11859](https://github.com/matrix-org/matrix-react-sdk/pull/11859)). Contributed by @robintown.
* fix broken warning icon ([#11862](https://github.com/matrix-org/matrix-react-sdk/pull/11862)). Contributed by @ara4n.
* Fix rightpanel hiding scrollbar ([#11831](https://github.com/matrix-org/matrix-react-sdk/pull/11831)). Contributed by @kerryarchibald.
* Switch to updating presence via /sync calls instead of PUT /presence ([#11824](https://github.com/matrix-org/matrix-react-sdk/pull/11824)). Contributed by @t3chguy.

Changes in [1.11.49](https://github.com/vector-im/element-desktop/releases/tag/v1.11.49) (2023-11-13)
=====================================================================================================

## 🐛 Bug Fixes
 * Ensure `setUserCreator` is called when a store is assigned ([\#3867](https://github.com/matrix-org/matrix-js-sdk/pull/3867)). Fixes vector-im/element-web#26520. Contributed by @MidhunSureshR.

Changes in [1.11.48](https://github.com/vector-im/element-desktop/releases/tag/v1.11.48) (2023-11-07)
=====================================================================================================

## ✨ Features
 * Correctly fill window.matrixChat even when a Wrapper module is active ([\#26395](https://github.com/vector-im/element-web/pull/26395)). Contributed by @dhenneke.
 * Knock on a ask-to-join room if a module wants to join the room when navigating to a room ([\#11787](https://github.com/matrix-org/matrix-react-sdk/pull/11787)). Contributed by @dhenneke.
 * Element-R:  Include crypto info in sentry ([\#11798](https://github.com/matrix-org/matrix-react-sdk/pull/11798)). Contributed by @florianduros.
 * Element-R:  Include crypto info in rageshake ([\#11797](https://github.com/matrix-org/matrix-react-sdk/pull/11797)). Contributed by @florianduros.
 * Element-R: Add current version of the rust-sdk and vodozemac ([\#11785](https://github.com/matrix-org/matrix-react-sdk/pull/11785)). Contributed by @florianduros.
 * Fix unfederated invite dialog ([\#9618](https://github.com/matrix-org/matrix-react-sdk/pull/9618)). Fixes vector-im/element-meta#1466 and vector-im/element-web#22102. Contributed by @owi92.
 * New right panel visual language ([\#11664](https://github.com/matrix-org/matrix-react-sdk/pull/11664)).
 * OIDC: add friendly errors ([\#11184](https://github.com/matrix-org/matrix-react-sdk/pull/11184)). Fixes vector-im/element-web#25665. Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Fix rightpanel hiding scrollbar ([\#11831](https://github.com/matrix-org/matrix-react-sdk/pull/11831)). Contributed by @kerryarchibald.
 * Fix edge cases around macos draggability ([\#1291](https://github.com/vector-im/element-desktop/pull/1291)). Fixes #1290.
 * Fix multi-tab session lock on Firefox not being cleared ([\#11800](https://github.com/matrix-org/matrix-react-sdk/pull/11800)). Fixes vector-im/element-web#26165. Contributed by @ManuelHu.
 * Deserialise spoilers back into slash command form ([\#11805](https://github.com/matrix-org/matrix-react-sdk/pull/11805)). Fixes vector-im/element-web#26344.
 * Fix Incorrect message scaling for verification request ([\#11793](https://github.com/matrix-org/matrix-react-sdk/pull/11793)). Fixes vector-im/element-web#24304. Contributed by @capGoblin.
 * Fix: Unable to restore a soft-logged-out session established via SSO ([\#11794](https://github.com/matrix-org/matrix-react-sdk/pull/11794)). Fixes vector-im/element-web#25957. Contributed by @kerryarchibald.
 * Use configurable github issue links more consistently ([\#11796](https://github.com/matrix-org/matrix-react-sdk/pull/11796)).
 * Fix io.element.late_event received_ts vs received_at ([\#11789](https://github.com/matrix-org/matrix-react-sdk/pull/11789)).
 * Make invitation dialog scrollable when infos are too long ([\#11753](https://github.com/matrix-org/matrix-react-sdk/pull/11753)). Contributed by @nurjinjafar.
 * Fix spoiler text-align ([\#11790](https://github.com/matrix-org/matrix-react-sdk/pull/11790)). Contributed by @ajbura.
 * Fix: Right panel keeps showing chat when unmaximizing widget.  ([\#11697](https://github.com/matrix-org/matrix-react-sdk/pull/11697)). Fixes vector-im/element-web#26265. Contributed by @manancodes.
 * Fix margin of invite to room button ([\#11780](https://github.com/matrix-org/matrix-react-sdk/pull/11780)). Fixes vector-im/element-web#26410.
 * Update base64 import ([\#11784](https://github.com/matrix-org/matrix-react-sdk/pull/11784)).
 * Set max size for Element logo in search warning ([\#11779](https://github.com/matrix-org/matrix-react-sdk/pull/11779)). Fixes vector-im/element-web#26408.
 * Fix: emoji size in room header topic, remove obsolete emoji style ([\#11757](https://github.com/matrix-org/matrix-react-sdk/pull/11757)). Fixes vector-im/element-web#26326. Contributed by @kerryarchibald.
 * Fix: Bubble layout design is broken ([\#11763](https://github.com/matrix-org/matrix-react-sdk/pull/11763)). Fixes vector-im/element-web#25818. Contributed by @manancodes.

Changes in [1.11.47](https://github.com/vector-im/element-desktop/releases/tag/v1.11.47) (2023-10-24)
=====================================================================================================

## ✨ Features
 * Allow overwriting app.element.io when popping out widgets ([\#1277](https://github.com/vector-im/element-desktop/pull/1277)). Fixes #1187.
 * Implement macos title bar negative space ([\#1272](https://github.com/vector-im/element-desktop/pull/1272)). Fixes #1245.
 * vector-im/element-x-ios/issues/1824 - Convert the apple-app-site-association file to a newer format… ([\#26307](https://github.com/vector-im/element-web/pull/26307)). Contributed by @stefanceriu.
 * Iterate `io.element.late_event` decoration ([\#11760](https://github.com/matrix-org/matrix-react-sdk/pull/11760)). Fixes vector-im/element-web#26384.
 * Render timeline separator for late event groups ([\#11739](https://github.com/matrix-org/matrix-react-sdk/pull/11739)).
 * OIDC: revoke tokens on logout ([\#11718](https://github.com/matrix-org/matrix-react-sdk/pull/11718)). Fixes vector-im/element-web#25394. Contributed by @kerryarchibald.
 * Show `io.element.late_event` in MessageTimestamp when known ([\#11733](https://github.com/matrix-org/matrix-react-sdk/pull/11733)).
 * Show all labs flags if developerMode enabled ([\#11746](https://github.com/matrix-org/matrix-react-sdk/pull/11746)). Fixes vector-im/element-web#24571 and vector-im/element-web#8498.
 * Use Compound tooltips on MessageTimestamp to improve UX of date time discovery ([\#11732](https://github.com/matrix-org/matrix-react-sdk/pull/11732)). Fixes vector-im/element-web#25913.
 * Consolidate 4s passphrase input fields and use stable IDs ([\#11743](https://github.com/matrix-org/matrix-react-sdk/pull/11743)). Fixes vector-im/element-web#26228.
 * Disable upgraderoom command without developer mode enabled ([\#11744](https://github.com/matrix-org/matrix-react-sdk/pull/11744)). Fixes vector-im/element-web#17620.
 * Avoid rendering app download buttons if disabled in config ([\#11741](https://github.com/matrix-org/matrix-react-sdk/pull/11741)). Fixes vector-im/element-web#26309.
 * OIDC: refresh tokens ([\#11699](https://github.com/matrix-org/matrix-react-sdk/pull/11699)). Fixes vector-im/element-web#25839. Contributed by @kerryarchibald.
 * OIDC: register ([\#11727](https://github.com/matrix-org/matrix-react-sdk/pull/11727)). Fixes vector-im/element-web#25393. Contributed by @kerryarchibald.
 * Use stable get_login_token and remove unstable MSC3882 support ([\#11001](https://github.com/matrix-org/matrix-react-sdk/pull/11001)). Contributed by @hughns.

## 🐛 Bug Fixes
 * Set max size for Element logo in search warning ([\#11779](https://github.com/matrix-org/matrix-react-sdk/pull/11779)). Fixes vector-im/element-web#26408.
 * Avoid error when DMing oneself ([\#11754](https://github.com/matrix-org/matrix-react-sdk/pull/11754)). Fixes vector-im/element-web#7242.
 * Fix: Message shield alignment is not right. ([\#11703](https://github.com/matrix-org/matrix-react-sdk/pull/11703)). Fixes vector-im/element-web#26142. Contributed by @manancodes.
 * fix logging full event ([\#11755](https://github.com/matrix-org/matrix-react-sdk/pull/11755)). Fixes vector-im/element-web#26376.
 * OIDC: use delegated auth account URL from `OidcClientStore` ([\#11723](https://github.com/matrix-org/matrix-react-sdk/pull/11723)). Fixes vector-im/element-web#26305. Contributed by @kerryarchibald.
 * Fix: Members list shield alignment is not right. ([\#11700](https://github.com/matrix-org/matrix-react-sdk/pull/11700)). Fixes vector-im/element-web#26261. Contributed by @manancodes.
 * Fix: <detail> HTML elements clickable area too wide. ([\#11666](https://github.com/matrix-org/matrix-react-sdk/pull/11666)). Fixes vector-im/element-web#25454. Contributed by @manancodes.
 * Fix untranslated headings in the devtools dialog ([\#11734](https://github.com/matrix-org/matrix-react-sdk/pull/11734)).
 * Fixes invite dialog alignment and pill color contrast ([\#11722](https://github.com/matrix-org/matrix-react-sdk/pull/11722)). Contributed by @gabrc52.
 * Prevent select element in General settings overflowing in a room with very long room-id ([\#11597](https://github.com/matrix-org/matrix-react-sdk/pull/11597)). Contributed by @ABHIXIT2.
 * Fix: Clicking on members pile does nothing. ([\#11657](https://github.com/matrix-org/matrix-react-sdk/pull/11657)). Fixes vector-im/element-web#26164. Contributed by @manancodes.
 * Fix: Wierd shadow below room avatar in dark mode. ([\#11678](https://github.com/matrix-org/matrix-react-sdk/pull/11678)). Fixes vector-im/element-web#26153. Contributed by @manancodes.
 * Fix start_sso / start_cas URLs failing to redirect to a authentication prompt ([\#11681](https://github.com/matrix-org/matrix-react-sdk/pull/11681)). Contributed by @Half-Shot.

Changes in [1.11.46](https://github.com/vector-im/element-desktop/releases/tag/v1.11.46) (2023-10-10)
=====================================================================================================

## ✨ Features
 * Use .well-known to discover a default rendezvous server for use with Sign in with QR ([\#11655](https://github.com/matrix-org/matrix-react-sdk/pull/11655)). Contributed by @hughns.
 * Message layout will update according to the selected style  ([\#10170](https://github.com/matrix-org/matrix-react-sdk/pull/10170)). Fixes vector-im/element-web#21782. Contributed by @manancodes.
 * Implement MSC4039: Add an MSC for a new Widget API action to upload files into the media repository ([\#11311](https://github.com/matrix-org/matrix-react-sdk/pull/11311)). Contributed by @dhenneke.
 * Render space pills with square corners to match new avatar ([\#11632](https://github.com/matrix-org/matrix-react-sdk/pull/11632)). Fixes vector-im/element-web#26056.
 * Linkify room topic ([\#11631](https://github.com/matrix-org/matrix-react-sdk/pull/11631)). Fixes vector-im/element-web#26185.
 * Show knock rooms in the list ([\#11573](https://github.com/matrix-org/matrix-react-sdk/pull/11573)). Contributed by @maheichyk.

## 🐛 Bug Fixes
 * Bump matrix-web-i18n dependency to 3.1.3 ([\#1259](https://github.com/vector-im/element-desktop/pull/1259) and [\#26287](https://github.com/vector-im/element-web/pull/26287))
 * Fix: Avatar shrinks with long names ([\#11698](https://github.com/matrix-org/matrix-react-sdk/pull/11698)). Fixes vector-im/element-web#26252. Contributed by @manancodes.
 * Update custom translations to support nested fields in structured JSON ([\#11685](https://github.com/matrix-org/matrix-react-sdk/pull/11685)).
 * Fix: Edited message remove button is hard to reach. ([\#11674](https://github.com/matrix-org/matrix-react-sdk/pull/11674)). Fixes vector-im/element-web#24917. Contributed by @manancodes.
 * Fix: Theme selector radio button not aligned in center with the text ([\#11676](https://github.com/matrix-org/matrix-react-sdk/pull/11676)). Fixes vector-im/element-web#25460. Contributed by @manancodes.
 * Fix: Unread notification dot aligned ([\#11658](https://github.com/matrix-org/matrix-react-sdk/pull/11658)). Fixes vector-im/element-web#25285. Contributed by @manancodes.
 * Fix: sync intentional mentions push rules with legacy rules ([\#11667](https://github.com/matrix-org/matrix-react-sdk/pull/11667)). Fixes vector-im/element-web#26227. Contributed by @kerryarchibald.
 * Revert "Fix regression around FacePile with overflow (#11527)" ([\#11634](https://github.com/matrix-org/matrix-react-sdk/pull/11634)). Fixes vector-im/element-web#26209.
 * Fix: Alignment Fixed ([\#11648](https://github.com/matrix-org/matrix-react-sdk/pull/11648)). Fixes vector-im/element-web#26169. Contributed by @manancodes.
 * Fix: onFinished added which closes the menu ([\#11647](https://github.com/matrix-org/matrix-react-sdk/pull/11647)). Fixes vector-im/element-web#25556. Contributed by @manancodes.
 * Don't start key backups when opening settings ([\#11640](https://github.com/matrix-org/matrix-react-sdk/pull/11640)).
 * Fix add to space avatar text centering ([\#11643](https://github.com/matrix-org/matrix-react-sdk/pull/11643)). Fixes vector-im/element-web#26154.
 * fix avatar styling in lightbox ([\#11641](https://github.com/matrix-org/matrix-react-sdk/pull/11641)). Fixes vector-im/element-web#26196.

Changes in [1.11.45](https://github.com/vector-im/element-desktop/releases/tag/v1.11.45) (2023-09-29)
=====================================================================================================

## 🔒 Security
 * Upgrade electron to 26.2.4 to fix CVE-2023-5217 ([\#1254](https://github.com/vector-im/element-desktop/pull/1254)). Contributed by @andybalaam.

## 🐛 Bug Fixes
 * Fix Emoji font on Safari 17 ([\#11673](https://github.com/matrix-org/matrix-react-sdk/pull/11673)).

Changes in [1.11.44](https://github.com/vector-im/element-desktop/releases/tag/v1.11.44) (2023-09-26)
=====================================================================================================

## ✨ Features
 * Make video & voice call buttons pin conference widget if unpinned ([\#11576](https://github.com/matrix-org/matrix-react-sdk/pull/11576)). Fixes vector-im/customer-retainer#72.
 * OIDC: persist refresh token ([\#11249](https://github.com/matrix-org/matrix-react-sdk/pull/11249)). Contributed by @kerryarchibald.
 * ElementR: Cross user verification ([\#11364](https://github.com/matrix-org/matrix-react-sdk/pull/11364)). Fixes vector-im/element-web#25752. Contributed by @florianduros.
 * Default intentional mentions ([\#11602](https://github.com/matrix-org/matrix-react-sdk/pull/11602)).
 * Notify users about denied access on ask-to-join  rooms ([\#11480](https://github.com/matrix-org/matrix-react-sdk/pull/11480)). Contributed by @nurjinjafar.
 * Allow setting knock room directory visibility ([\#11529](https://github.com/matrix-org/matrix-react-sdk/pull/11529)). Contributed by @charlynguyen.

## 🐛 Bug Fixes
 * Revert "Fix regression around FacePile with overflow (#11527)" ([\#11634](https://github.com/matrix-org/matrix-react-sdk/pull/11634)). Fixes vector-im/element-web#26209.
 * upgrade electron to 26.2.1 to fix CVE-2023-4863 ([\#1226](https://github.com/vector-im/element-desktop/pull/1226)). Contributed by @selfisekai.
 * Improve edge cases around macOS drag handles ([\#1219](https://github.com/vector-im/element-desktop/pull/1219)). Fixes #1199 and #1188.
 * Escape placeholder before injecting it into the style ([\#11607](https://github.com/matrix-org/matrix-react-sdk/pull/11607)).
 * Move ViewUser action callback to RoomView ([\#11495](https://github.com/matrix-org/matrix-react-sdk/pull/11495)). Fixes vector-im/element-web#26040.
 * Fix room timeline search toggling behaviour edge case ([\#11605](https://github.com/matrix-org/matrix-react-sdk/pull/11605)). Fixes vector-im/element-web#26105.
 * Avoid rendering view-message link in RoomKnocksBar unnecessarily ([\#11598](https://github.com/matrix-org/matrix-react-sdk/pull/11598)). Contributed by @charlynguyen.
 * Use knock rooms sync to reflect the knock state ([\#11596](https://github.com/matrix-org/matrix-react-sdk/pull/11596)). Fixes vector-im/element-web#26043 and vector-im/element-web#26044. Contributed by @charlynguyen.
 * Fix avatar in right panel not using the correct font ([\#11593](https://github.com/matrix-org/matrix-react-sdk/pull/11593)). Fixes vector-im/element-web#26061. Contributed by @MidhunSureshR.
 * Add waits in Spotlight Cypress tests, hoping this unflakes them ([\#11590](https://github.com/matrix-org/matrix-react-sdk/pull/11590)). Fixes vector-im/element-web#26053, vector-im/element-web#26140 vector-im/element-web#26139 and vector-im/element-web#26138. Contributed by @andybalaam.
 * Fix vertical alignment of default avatar font ([\#11582](https://github.com/matrix-org/matrix-react-sdk/pull/11582)). Fixes vector-im/element-web#26081.
 * Fix avatars in public room & space search being flex shrunk ([\#11580](https://github.com/matrix-org/matrix-react-sdk/pull/11580)). Fixes vector-im/element-web#26133.
 * Fix EventTile avatars being rendered with a size of 0 instead of hidden ([\#11558](https://github.com/matrix-org/matrix-react-sdk/pull/11558)). Fixes vector-im/element-web#26075.

Changes in [1.11.43](https://github.com/vector-im/element-desktop/releases/tag/v1.11.43) (2023-09-15)
=====================================================================================================

## 🔒 Security
 * upgrade electron to 26.2.1 to fix CVE-2023-4863 ([\#1226](https://github.com/vector-im/element-desktop/pull/1226)). Contributed by @selfisekai.

Changes in [1.11.42](https://github.com/vector-im/element-desktop/releases/tag/v1.11.42) (2023-09-13)
=====================================================================================================

## 🐛 Bug Fixes
 * Update Compound to fix Firefox-specific avatar regression ([\#11604](https://github.com/matrix-org/matrix-react-sdk/pull/11604)). Fixes vector-im/element-web#26155.

Changes in [1.11.41](https://github.com/vector-im/element-desktop/releases/tag/v1.11.41) (2023-09-12)
=====================================================================================================

## ✨ Features
 * Make SVGR icons use forward ref ([\#26082](https://github.com/vector-im/element-web/pull/26082)).
 * Add support for rendering a custom wrapper around Element ([\#25537](https://github.com/vector-im/element-web/pull/25537)). Contributed by @maheichyk.
 * Allow creating public knock rooms ([\#11481](https://github.com/matrix-org/matrix-react-sdk/pull/11481)). Contributed by @charlynguyen.
 * Render custom images in reactions according to MSC4027 ([\#11087](https://github.com/matrix-org/matrix-react-sdk/pull/11087)). Contributed by @sumnerevans.
 * Introduce room knocks bar ([\#11475](https://github.com/matrix-org/matrix-react-sdk/pull/11475)). Contributed by @charlynguyen.
 * Room header UI updates ([\#11507](https://github.com/matrix-org/matrix-react-sdk/pull/11507)). Fixes vector-im/element-web#25892.
 * Remove green "verified" bar for encrypted events ([\#11496](https://github.com/matrix-org/matrix-react-sdk/pull/11496)).
 * Update member count on room summary update ([\#11488](https://github.com/matrix-org/matrix-react-sdk/pull/11488)).
 * Support for E2EE in Element Call  ([\#11492](https://github.com/matrix-org/matrix-react-sdk/pull/11492)).
 * Allow requesting to join knock rooms via spotlight ([\#11482](https://github.com/matrix-org/matrix-react-sdk/pull/11482)). Contributed by @charlynguyen.
 * Lock out the first tab if Element is opened in a second tab. ([\#11425](https://github.com/matrix-org/matrix-react-sdk/pull/11425)). Fixes vector-im/element-web#25157.
 * Change avatar to use Compound implementation ([\#11448](https://github.com/matrix-org/matrix-react-sdk/pull/11448)).

## 🐛 Bug Fixes
 * Fix vertical alignment of default avatar font ([\#11582](https://github.com/matrix-org/matrix-react-sdk/pull/11582)). Fixes vector-im/element-web#26081.
 * Fix avatars in public room & space search being flex shrunk ([\#11580](https://github.com/matrix-org/matrix-react-sdk/pull/11580)). Fixes vector-im/element-web#26133.
 * Fix EventTile avatars being rendered with a size of 0 instead of hidden ([\#11558](https://github.com/matrix-org/matrix-react-sdk/pull/11558)). Fixes vector-im/element-web#26075.
 * Updated no drag zones ([\#1193](https://github.com/vector-im/element-desktop/pull/1193)).
 * Fix compound external assets path in bundle ([\#26069](https://github.com/vector-im/element-web/pull/26069)).
 * Use RoomStateEvent.Update for knocks ([\#11516](https://github.com/matrix-org/matrix-react-sdk/pull/11516)). Contributed by @charlynguyen.
 * Prevent event propagation when clicking icon buttons ([\#11515](https://github.com/matrix-org/matrix-react-sdk/pull/11515)).
 * Only display RoomKnocksBar when feature flag is enabled ([\#11513](https://github.com/matrix-org/matrix-react-sdk/pull/11513)). Contributed by @andybalaam.
 * Fix avatars of knock members for people tab of room settings ([\#11506](https://github.com/matrix-org/matrix-react-sdk/pull/11506)). Fixes vector-im/element-web#26083. Contributed by @charlynguyen.
 * Fixes read receipt avatar offset ([\#11483](https://github.com/matrix-org/matrix-react-sdk/pull/11483)). Fixes vector-im/element-web#26067, vector-im/element-web#26064 vector-im/element-web#26059 and vector-im/element-web#26061.
 * Fix avatar defects ([\#11473](https://github.com/matrix-org/matrix-react-sdk/pull/11473)). Fixes vector-im/element-web#26051 and vector-im/element-web#26046.
 * Fix consistent avatar output for Percy ([\#11472](https://github.com/matrix-org/matrix-react-sdk/pull/11472)). Fixes vector-im/element-web#26049 and vector-im/element-web#26052.
 * Fix colour of avatar and colour matching with username ([\#11470](https://github.com/matrix-org/matrix-react-sdk/pull/11470)). Fixes vector-im/element-web#26042.
 * Fix incompatibility of Soft Logout with Element-R ([\#11468](https://github.com/matrix-org/matrix-react-sdk/pull/11468)).
 * Fix instances of double translation and guard translation calls using typescript ([\#11443](https://github.com/matrix-org/matrix-react-sdk/pull/11443)).

Changes in [1.11.40](https://github.com/vector-im/element-desktop/releases/tag/v1.11.40) (2023-08-29)
=====================================================================================================

## ✨ Features
 * Add FreeBSD support ([\#1163](https://github.com/vector-im/element-desktop/pull/1163)). Contributed by @lwhsu.
 * Hide account deactivation for externally managed accounts ([\#11445](https://github.com/matrix-org/matrix-react-sdk/pull/11445)). Fixes vector-im/element-web#26022. Contributed by @kerryarchibald.
 * OIDC: Redirect to delegated auth provider when signing out ([\#11432](https://github.com/matrix-org/matrix-react-sdk/pull/11432)). Fixes vector-im/element-web#26000. Contributed by @kerryarchibald.
 * Disable 3pid fields in settings when `m.3pid_changes` capability is disabled ([\#11430](https://github.com/matrix-org/matrix-react-sdk/pull/11430)). Fixes vector-im/element-web#25995. Contributed by @kerryarchibald.
 * OIDC: disable multi session signout for OIDC-aware servers in session manager ([\#11431](https://github.com/matrix-org/matrix-react-sdk/pull/11431)). Contributed by @kerryarchibald.
 * Implement updated open dialog method of the Module API ([\#11395](https://github.com/matrix-org/matrix-react-sdk/pull/11395)). Contributed by @dhenneke.
 * Polish & delabs `Exploring public spaces` feature ([\#11423](https://github.com/matrix-org/matrix-react-sdk/pull/11423)).
 * Treat lists with a single empty item as plain text, not Markdown. ([\#6833](https://github.com/matrix-org/matrix-react-sdk/pull/6833)). Fixes vector-im/element-meta#1265.
 * Allow managing room knocks ([\#11404](https://github.com/matrix-org/matrix-react-sdk/pull/11404)). Contributed by @charlynguyen.
 * Pin the action buttons to the bottom of the scrollable dialogs ([\#11407](https://github.com/matrix-org/matrix-react-sdk/pull/11407)). Contributed by @dhenneke.
 * Support Matrix 1.1 (drop legacy r0 versions) ([\#9819](https://github.com/matrix-org/matrix-react-sdk/pull/9819)).

## 🐛 Bug Fixes
 * Don't intercept Ctrl + Cmd + Q on macOS ([\#1174](https://github.com/vector-im/element-desktop/pull/1174)). Contributed by @zhaofengli.
 * Improve selectors for macos app draggable regions ([\#1170](https://github.com/vector-im/element-desktop/pull/1170)). Fixes #1169.
 * Fix path separator for Windows based systems ([\#25997](https://github.com/vector-im/element-web/pull/25997)).
 * Fix instances of double translation and guard translation calls using typescript ([\#11443](https://github.com/matrix-org/matrix-react-sdk/pull/11443)).
 * Fix export type "Current timeline" to match its behaviour to its name ([\#11426](https://github.com/matrix-org/matrix-react-sdk/pull/11426)). Fixes vector-im/element-web#25988.
 * Fix Room Settings > Notifications file upload input being shown superfluously ([\#11415](https://github.com/matrix-org/matrix-react-sdk/pull/11415)). Fixes vector-im/element-web#18392.
 * Simplify registration with email validation ([\#11398](https://github.com/matrix-org/matrix-react-sdk/pull/11398)). Fixes vector-im/element-web#25832 vector-im/element-web#23601 and vector-im/element-web#22297.
 * correct home server URL ([\#11391](https://github.com/matrix-org/matrix-react-sdk/pull/11391)). Fixes vector-im/element-web#25931. Contributed by @NSV1991.
 * Include non-matching DMs in Spotlight recent conversations when the DM's userId is part of the search API results ([\#11374](https://github.com/matrix-org/matrix-react-sdk/pull/11374)). Contributed by @mgcm.
 * Fix useRoomMembers missing updates causing incorrect membership counts ([\#11392](https://github.com/matrix-org/matrix-react-sdk/pull/11392)). Fixes vector-im/element-web#17096.
 * Show error when searching public rooms fails ([\#11378](https://github.com/matrix-org/matrix-react-sdk/pull/11378)).

Changes in [1.11.39](https://github.com/vector-im/element-desktop/releases/tag/v1.11.39) (2023-08-15)
=====================================================================================================

## 🦖 Deprecations
 * Deprecate camelCase config options ([\#25800](https://github.com/vector-im/element-web/pull/25800)).
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes vector-im/element-web#25733.

## ✨ Features
 * Switch to hidden titleBar on macOS to integrate the app better ([\#1101](https://github.com/vector-im/element-desktop/pull/1101)).
 * Update labs.md for knock rooms ([\#25923](https://github.com/vector-im/element-web/pull/25923)). Contributed by @charlynguyen.
 * Package release builds of element-web in package.element.io debs ([\#25198](https://github.com/vector-im/element-web/pull/25198)).
 * Allow knocking rooms ([\#11353](https://github.com/matrix-org/matrix-react-sdk/pull/11353)). Contributed by @charlynguyen.
 * Support adding space-restricted joins on rooms not members of those spaces ([\#9017](https://github.com/matrix-org/matrix-react-sdk/pull/9017)). Fixes vector-im/element-web#19213.
 * Clear requiresClient and show pop-out if widget-api fails to ready ([\#11321](https://github.com/matrix-org/matrix-react-sdk/pull/11321)). Fixes vector-im/customer-retainer#73.
 * Bump pagination sizes due to hidden events ([\#11342](https://github.com/matrix-org/matrix-react-sdk/pull/11342)).
 * Remove display of key backup signatures from backup settings ([\#11333](https://github.com/matrix-org/matrix-react-sdk/pull/11333)).
 * Use PassphraseFields in ExportE2eKeysDialog to enforce minimum passphrase complexity ([\#11222](https://github.com/matrix-org/matrix-react-sdk/pull/11222)). Fixes vector-im/element-web#9478.

## 🐛 Bug Fixes
 * Prevent the media lightbox sender info clipping with traffic light on macos ([\#1141](https://github.com/vector-im/element-desktop/pull/1141)). Fixes #1140.
 * Restore macOs room header dragability ([\#1136](https://github.com/vector-im/element-desktop/pull/1136)). Fixes #1135.
 * Fix ability to interact with room topic in header ([\#1126](https://github.com/vector-im/element-desktop/pull/1126)). Fixes undefined/element-desktop#1125.
 * Fix "Export chat" not respecting configured time format in plain text mode ([\#10696](https://github.com/matrix-org/matrix-react-sdk/pull/10696)). Fixes vector-im/element-web#23838. Contributed by @rashmitpankhania.
 * Fix some missing 1-count pluralisations around event list summaries ([\#11371](https://github.com/matrix-org/matrix-react-sdk/pull/11371)). Fixes vector-im/element-web#25925.
 * Fix create subspace dialog not working for public space creation ([\#11367](https://github.com/matrix-org/matrix-react-sdk/pull/11367)). Fixes vector-im/element-web#25916.
 * Search for users on paste ([\#11304](https://github.com/matrix-org/matrix-react-sdk/pull/11304)). Fixes vector-im/element-web#17523. Contributed by @peterscheu-aceart.
 * Fix AppTile context menu not always showing up when it has options ([\#11358](https://github.com/matrix-org/matrix-react-sdk/pull/11358)). Fixes vector-im/element-web#25914.
 * Fix clicking on home all rooms space notification not working ([\#11337](https://github.com/matrix-org/matrix-react-sdk/pull/11337)). Fixes vector-im/element-web#22844.
 * Fix joining a suggested room switching space away ([\#11347](https://github.com/matrix-org/matrix-react-sdk/pull/11347)). Fixes vector-im/element-web#25838.
 * Fix home/all rooms context menu in space panel ([\#11350](https://github.com/matrix-org/matrix-react-sdk/pull/11350)). Fixes vector-im/element-web#25896.
 * Make keyboard handling in and out of autocomplete completions consistent ([\#11344](https://github.com/matrix-org/matrix-react-sdk/pull/11344)). Fixes vector-im/element-web#25878.
 * De-duplicate reactions by sender to account for faulty/malicious servers ([\#11340](https://github.com/matrix-org/matrix-react-sdk/pull/11340)). Fixes vector-im/element-web#25872.
 * Fix disable_3pid_login being ignored for the email field ([\#11335](https://github.com/matrix-org/matrix-react-sdk/pull/11335)). Fixes vector-im/element-web#25863.
 * Upgrade wysiwyg editor for ctrl+backspace windows fix ([\#11324](https://github.com/matrix-org/matrix-react-sdk/pull/11324)). Fixes vector-im/verticals-internal#102.
 * Unhide the view source event toggle - it works well enough ([\#11336](https://github.com/matrix-org/matrix-react-sdk/pull/11336)). Fixes vector-im/element-web#25861.

Changes in [1.11.38](https://github.com/vector-im/element-desktop/releases/tag/v1.11.38) (2023-08-04)
=====================================================================================================

## ✨ Features
 * Package release builds of element-web in package.element.io debs ([\#25921](https://github.com/vector-im/element-web/pull/25921)). Contributed by @RiotRobot.

## 🐛 Bug Fixes
 * Revert to using the /presence API for presence ([\#11366](https://github.com/matrix-org/matrix-react-sdk/pull/11366))

Changes in [1.11.37](https://github.com/vector-im/element-desktop/releases/tag/v1.11.37) (2023-08-01)
=====================================================================================================

## 🦖 Deprecations
 * Deprecate camelCase config options ([\#25800](https://github.com/vector-im/element-web/pull/25800)).
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes vector-im/element-web#25733.

## ✨ Features
 * Fix Tray icon in Windows forgetting your settings ([\#1059](https://github.com/vector-im/element-desktop/pull/1059)). Fixes #786.
 * Do not show "Forget room" button in Room View header for guest users ([\#10898](https://github.com/matrix-org/matrix-react-sdk/pull/10898)). Contributed by @spantaleev.
 * Switch to updating presence via /sync calls instead of PUT /presence ([\#11223](https://github.com/matrix-org/matrix-react-sdk/pull/11223)). Fixes vector-im/element-web#20809 vector-im/element-web#13877 and vector-im/element-web#4813.
 * Fix blockquote colour contrast ([\#11299](https://github.com/matrix-org/matrix-react-sdk/pull/11299)). Fixes matrix-org/element-web-rageshakes#21800.
 * Don't hide room header buttons in video rooms and rooms with a call ([\#9712](https://github.com/matrix-org/matrix-react-sdk/pull/9712)). Fixes vector-im/element-web#23900.
 * OIDC: Persist details in session storage, create store ([\#11302](https://github.com/matrix-org/matrix-react-sdk/pull/11302)). Fixes vector-im/element-web#25710. Contributed by @kerryarchibald.
 * Allow setting room join rule to knock ([\#11248](https://github.com/matrix-org/matrix-react-sdk/pull/11248)). Contributed by @charlynguyen.
 * Retry joins on 524 (Cloudflare timeout) also ([\#11296](https://github.com/matrix-org/matrix-react-sdk/pull/11296)). Fixes vector-im/element-web#8776.
 * Make sure users returned by the homeserver search API are displayed. Don't silently drop any. ([\#9556](https://github.com/matrix-org/matrix-react-sdk/pull/9556)). Fixes vector-im/element-web#24422. Contributed by @maxmalek.
 * Offer to unban user during invite if inviter has sufficient permissions ([\#11256](https://github.com/matrix-org/matrix-react-sdk/pull/11256)). Fixes vector-im/element-web#3222.
 * Split join and goto slash commands, the latter shouldn't auto_join ([\#11259](https://github.com/matrix-org/matrix-react-sdk/pull/11259)). Fixes vector-im/element-web#10128.
 * Integration work for rich text editor 2.3.1 ([\#11172](https://github.com/matrix-org/matrix-react-sdk/pull/11172)). Contributed by @alunturner.
 * Compound color pass ([\#11079](https://github.com/matrix-org/matrix-react-sdk/pull/11079)). Fixes vector-im/internal-planning#450 and vector-im/element-web#25547.
 * Warn when demoting self via /op and /deop slash commands ([\#11214](https://github.com/matrix-org/matrix-react-sdk/pull/11214)). Fixes vector-im/element-web#13726.

## 🐛 Bug Fixes
 * Correct Jitsi preferred_domain property ([\#25813](https://github.com/vector-im/element-web/pull/25813)). Contributed by @benbz.
 * Fix edge case with sent indicator being drawn when it shouldn't be ([\#11320](https://github.com/matrix-org/matrix-react-sdk/pull/11320)).
 * Use correct translation function for WYSIWYG buttons ([\#11315](https://github.com/matrix-org/matrix-react-sdk/pull/11315)). Fixes vector-im/verticals-internal#109.
 * Handle empty own profile ([\#11319](https://github.com/matrix-org/matrix-react-sdk/pull/11319)). Fixes vector-im/element-web#25510.
 * Fix peeked rooms showing up in historical ([\#11316](https://github.com/matrix-org/matrix-react-sdk/pull/11316)). Fixes vector-im/element-web#22473.
 * Ensure consistency when rendering the sent event indicator ([\#11314](https://github.com/matrix-org/matrix-react-sdk/pull/11314)). Fixes vector-im/element-web#17937.
 * Prevent re-filtering user directory results in spotlight ([\#11290](https://github.com/matrix-org/matrix-react-sdk/pull/11290)). Fixes vector-im/element-web#24422.
 * Fix GIF label on dark theme ([\#11312](https://github.com/matrix-org/matrix-react-sdk/pull/11312)). Fixes vector-im/element-web#25836.
 * Fix issues around room notification settings flaking out ([\#11306](https://github.com/matrix-org/matrix-react-sdk/pull/11306)). Fixes vector-im/element-web#16472 vector-im/element-web#21309 and vector-im/element-web#6828.
 * Fix invite dialog showing the same user multiple times ([\#11308](https://github.com/matrix-org/matrix-react-sdk/pull/11308)). Fixes vector-im/element-web#25578.
 * Don't show composer send button if user cannot send ([\#11298](https://github.com/matrix-org/matrix-react-sdk/pull/11298)). Fixes vector-im/element-web#25825.
 * Restore color for sender in imageview ([\#11289](https://github.com/matrix-org/matrix-react-sdk/pull/11289)). Fixes vector-im/element-web#25822.
 * Fix changelog dialog heading size ([\#11286](https://github.com/matrix-org/matrix-react-sdk/pull/11286)). Fixes vector-im/element-web#25789.
 * Restore offline presence badge color ([\#11287](https://github.com/matrix-org/matrix-react-sdk/pull/11287)). Fixes vector-im/element-web#25792.
 * Fix bubble message layout avatar overlap ([\#11284](https://github.com/matrix-org/matrix-react-sdk/pull/11284)). Fixes vector-im/element-web#25818.
 * Fix voice call tile size ([\#11285](https://github.com/matrix-org/matrix-react-sdk/pull/11285)). Fixes vector-im/element-web#25684.
 * Fix layout of sessions tab buttons ([\#11279](https://github.com/matrix-org/matrix-react-sdk/pull/11279)). Fixes vector-im/element-web#25545.
 * Don't bother showing redundant tooltip on space menu ([\#11276](https://github.com/matrix-org/matrix-react-sdk/pull/11276)). Fixes vector-im/element-web#20380.
 * Remove reply fallback from notifications ([\#11278](https://github.com/matrix-org/matrix-react-sdk/pull/11278)). Fixes vector-im/element-web#17859.
 * Populate info.duration for audio & video file uploads ([\#11225](https://github.com/matrix-org/matrix-react-sdk/pull/11225)). Fixes vector-im/element-web#17720.
 * Hide widget menu button if it there are no options available ([\#11257](https://github.com/matrix-org/matrix-react-sdk/pull/11257)). Fixes vector-im/element-web#24826.
 * Fix colour regressions ([\#11273](https://github.com/matrix-org/matrix-react-sdk/pull/11273)). Fixes vector-im/element-web#25788, vector-im/element-web#25808 vector-im/element-web#25811 and vector-im/element-web#25812.
 * Fix room view not properly maintaining scroll position ([\#11274](https://github.com/matrix-org/matrix-react-sdk/pull/11274)). Fixes vector-im/element-web#25810.
 * Prevent user from accidentally double clicking user info admin actions ([\#11254](https://github.com/matrix-org/matrix-react-sdk/pull/11254)). Fixes vector-im/element-web#10944.
 * Fix missing metaspace notification badges ([\#11269](https://github.com/matrix-org/matrix-react-sdk/pull/11269)). Fixes vector-im/element-web#25679.
 * Fix clicking MXID in timeline going to matrix.to ([\#11263](https://github.com/matrix-org/matrix-react-sdk/pull/11263)). Fixes vector-im/element-web#23342.
 * Restoring optional ligatures by resetting letter-spacing ([\#11202](https://github.com/matrix-org/matrix-react-sdk/pull/11202)). Fixes vector-im/element-web#25727.
 * Allow emoji presentation selector to not break BigEmoji styling ([\#11253](https://github.com/matrix-org/matrix-react-sdk/pull/11253)). Fixes vector-im/element-web#17848.
 * Make event highliht use primary content token ([\#11255](https://github.com/matrix-org/matrix-react-sdk/pull/11255)).
 * Fix event info events size and color ([\#11252](https://github.com/matrix-org/matrix-react-sdk/pull/11252)). Fixes vector-im/element-web#25778.
 * Fix color mapping for blockquote border ([\#11251](https://github.com/matrix-org/matrix-react-sdk/pull/11251)). Fixes vector-im/element-web#25782.
 * Strip emoji variation when searching emoji by emoji ([\#11221](https://github.com/matrix-org/matrix-react-sdk/pull/11221)). Fixes vector-im/element-web#18703.

Changes in [1.11.36](https://github.com/vector-im/element-desktop/releases/tag/v1.11.36) (2023-07-18)
=====================================================================================================

## 🔒 Security
 * Fixes for [CVE-2023-37259](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-37259) / [GHSA-c9vx-2g7w-rp65](https://github.com/matrix-org/matrix-react-sdk/security/advisories/GHSA-c9vx-2g7w-rp65)

## 🦖 Deprecations
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes vector-im/element-web#25733.

## ✨ Features
 * OIDC: store initial screen in session storage  ([\#25688](https://github.com/vector-im/element-web/pull/25688)). Fixes vector-im/element-web#25656. Contributed by @kerryarchibald.
 * Allow default_server_config as a fallback config ([\#25682](https://github.com/vector-im/element-web/pull/25682)). Contributed by @ShadowRZ.
 * OIDC: remove auth params from url after login attempt ([\#25664](https://github.com/vector-im/element-web/pull/25664)). Contributed by @kerryarchibald.
 * feat(faq): remove keyboard shortcuts button ([\#9342](https://github.com/matrix-org/matrix-react-sdk/pull/9342)). Fixes vector-im/element-web#22625. Contributed by @gefgu.
 * GYU: Update banner ([\#11211](https://github.com/matrix-org/matrix-react-sdk/pull/11211)). Fixes vector-im/element-web#25530. Contributed by @justjanne.
 * Linkify mxc:// URLs as links to your media repo ([\#11213](https://github.com/matrix-org/matrix-react-sdk/pull/11213)). Fixes vector-im/element-web#6942.
 * OIDC: Log in ([\#11199](https://github.com/matrix-org/matrix-react-sdk/pull/11199)). Fixes vector-im/element-web#25657. Contributed by @kerryarchibald.
 * Handle all permitted url schemes in linkify ([\#11215](https://github.com/matrix-org/matrix-react-sdk/pull/11215)). Fixes vector-im/element-web#4457 and vector-im/element-web#8720.
 * Autoapprove Element Call oidc requests ([\#11209](https://github.com/matrix-org/matrix-react-sdk/pull/11209)). Contributed by @toger5.
 * Allow creating knock rooms ([\#11182](https://github.com/matrix-org/matrix-react-sdk/pull/11182)). Contributed by @charlynguyen.
 * Expose and pre-populate thread ID in devtools dialog ([\#10953](https://github.com/matrix-org/matrix-react-sdk/pull/10953)).
 * Hide URL preview if it will be empty ([\#9029](https://github.com/matrix-org/matrix-react-sdk/pull/9029)).
 * Change wording from avatar to profile picture ([\#7015](https://github.com/matrix-org/matrix-react-sdk/pull/7015)). Fixes vector-im/element-meta#1331. Contributed by @aaronraimist.
 * Quick and dirty devtool to explore state history ([\#11197](https://github.com/matrix-org/matrix-react-sdk/pull/11197)).
 * Consider more user inputs when calculating zxcvbn score ([\#11180](https://github.com/matrix-org/matrix-react-sdk/pull/11180)).
 * GYU: Account Notification Settings ([\#11008](https://github.com/matrix-org/matrix-react-sdk/pull/11008)). Fixes vector-im/element-web#24567. Contributed by @justjanne.
 * Compound Typography pass ([\#11103](https://github.com/matrix-org/matrix-react-sdk/pull/11103)). Fixes vector-im/element-web#25548.
 * OIDC: navigate to authorization endpoint ([\#11096](https://github.com/matrix-org/matrix-react-sdk/pull/11096)). Fixes vector-im/element-web#25574. Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Fix read receipt sending behaviour around thread roots ([\#3600](https://github.com/matrix-org/matrix-js-sdk/pull/3600)).
 * Fix missing metaspace notification badges ([\#11269](https://github.com/matrix-org/matrix-react-sdk/pull/11269)). Fixes vector-im/element-web#25679.
 * Make checkboxes less rounded ([\#11224](https://github.com/matrix-org/matrix-react-sdk/pull/11224)). Contributed by @andybalaam.
 * GYU: Fix issues with audible keywords without activated mentions ([\#11218](https://github.com/matrix-org/matrix-react-sdk/pull/11218)). Contributed by @justjanne.
 * PosthogAnalytics unwatch settings on logout ([\#11207](https://github.com/matrix-org/matrix-react-sdk/pull/11207)). Fixes vector-im/element-web#25703.
 * Avoid trying to set room account data for pinned events as guest ([\#11216](https://github.com/matrix-org/matrix-react-sdk/pull/11216)). Fixes vector-im/element-web#6300.
 * GYU: Disable sound for DMs checkbox when DM notifications are disabled ([\#11210](https://github.com/matrix-org/matrix-react-sdk/pull/11210)). Contributed by @justjanne.
 * force to allow calls without video and audio in embedded mode ([\#11131](https://github.com/matrix-org/matrix-react-sdk/pull/11131)). Contributed by @EnricoSchw.
 * Fix room tile text clipping ([\#11196](https://github.com/matrix-org/matrix-react-sdk/pull/11196)). Fixes vector-im/element-web#25718.
 * Handle newlines in user pills ([\#11166](https://github.com/matrix-org/matrix-react-sdk/pull/11166)). Fixes vector-im/element-web#10994.
 * Limit width of user menu in space panel ([\#11192](https://github.com/matrix-org/matrix-react-sdk/pull/11192)). Fixes vector-im/element-web#22627.
 * Add isLocation to ComposerEvent analytics events ([\#11187](https://github.com/matrix-org/matrix-react-sdk/pull/11187)). Contributed by @andybalaam.
 * Fix: hide unsupported login elements ([\#11185](https://github.com/matrix-org/matrix-react-sdk/pull/11185)). Fixes vector-im/element-web#25711. Contributed by @kerryarchibald.
 * Scope smaller font size to user info panel ([\#11178](https://github.com/matrix-org/matrix-react-sdk/pull/11178)). Fixes vector-im/element-web#25683.
 * Apply i18n to strings in the html export ([\#11176](https://github.com/matrix-org/matrix-react-sdk/pull/11176)).
 * Inhibit url previews on MXIDs containing slashes same as those without ([\#11160](https://github.com/matrix-org/matrix-react-sdk/pull/11160)).
 * Make event info size consistent with state events ([\#11181](https://github.com/matrix-org/matrix-react-sdk/pull/11181)).
 * Fix markdown content spacing ([\#11177](https://github.com/matrix-org/matrix-react-sdk/pull/11177)). Fixes vector-im/element-web#25685.
 * Fix font-family definition for emojis ([\#11170](https://github.com/matrix-org/matrix-react-sdk/pull/11170)). Fixes vector-im/element-web#25686.
 * Fix spurious error sending receipt in thread errors ([\#11157](https://github.com/matrix-org/matrix-react-sdk/pull/11157)).
 * Consider the empty push rule actions array equiv to deprecated dont_notify ([\#11155](https://github.com/matrix-org/matrix-react-sdk/pull/11155)). Fixes vector-im/element-web#25674.
 * Only trap escape key for cancel reply if there is a reply ([\#11140](https://github.com/matrix-org/matrix-react-sdk/pull/11140)). Fixes vector-im/element-web#25640.
 * Update linkify to 4.1.1 ([\#11132](https://github.com/matrix-org/matrix-react-sdk/pull/11132)). Fixes vector-im/element-web#23806.

Changes in [1.11.35](https://github.com/vector-im/element-desktop/releases/tag/v1.11.35) (2023-07-04)
=====================================================================================================

## 🦖 Deprecations
 * Remove `feature_favourite_messages` as it is has been abandoned for now ([\#11097](https://github.com/matrix-org/matrix-react-sdk/pull/11097)). Fixes vector-im/element-web#25555.

## ✨ Features
 * Use brand and help url from config ([\#1008](https://github.com/vector-im/element-desktop/pull/1008)).
 * Don't setup keys on login when encryption is force disabled ([\#11125](https://github.com/matrix-org/matrix-react-sdk/pull/11125)). Contributed by @kerryarchibald.
 * OIDC: attempt dynamic client registration ([\#11074](https://github.com/matrix-org/matrix-react-sdk/pull/11074)). Fixes vector-im/element-web#25468 and vector-im/element-web#25467. Contributed by @kerryarchibald.
 * OIDC: Check static client registration and add login flow ([\#11088](https://github.com/matrix-org/matrix-react-sdk/pull/11088)). Fixes vector-im/element-web#25467. Contributed by @kerryarchibald.
 * Improve message body output from plain text editor ([\#11124](https://github.com/matrix-org/matrix-react-sdk/pull/11124)). Contributed by @alunturner.
 * Disable encryption toggle in room settings when force disabled ([\#11122](https://github.com/matrix-org/matrix-react-sdk/pull/11122)). Contributed by @kerryarchibald.
 * Add .well-known config option to force disable encryption on room creation ([\#11120](https://github.com/matrix-org/matrix-react-sdk/pull/11120)). Contributed by @kerryarchibald.
 * Handle permalinks in room topic ([\#11115](https://github.com/matrix-org/matrix-react-sdk/pull/11115)). Fixes vector-im/element-web#23395.
 * Add at room avatar for RTE ([\#11106](https://github.com/matrix-org/matrix-react-sdk/pull/11106)). Contributed by @alunturner.
 * Remove new room breadcrumbs ([\#11104](https://github.com/matrix-org/matrix-react-sdk/pull/11104)).
 * Update rich text editor dependency and associated changes ([\#11098](https://github.com/matrix-org/matrix-react-sdk/pull/11098)). Contributed by @alunturner.
 * Implement new model, hooks and reconcilation code for new GYU notification settings ([\#11089](https://github.com/matrix-org/matrix-react-sdk/pull/11089)). Contributed by @justjanne.
 * Allow maintaining a different right panel width for thread panels ([\#11064](https://github.com/matrix-org/matrix-react-sdk/pull/11064)). Fixes vector-im/element-web#25487.
 * Make AppPermission pane scrollable ([\#10954](https://github.com/matrix-org/matrix-react-sdk/pull/10954)). Fixes vector-im/element-web#25438 and vector-im/element-web#25511. Contributed by @luixxiul.
 * Integrate compound design tokens ([\#11091](https://github.com/matrix-org/matrix-react-sdk/pull/11091)). Fixes vector-im/internal-planning#450.
 * Don't warn about the effects of redacting state events when redacting non-state-events ([\#11071](https://github.com/matrix-org/matrix-react-sdk/pull/11071)). Fixes vector-im/element-web#8478.
 * Allow specifying help URLs in config.json ([\#11070](https://github.com/matrix-org/matrix-react-sdk/pull/11070)). Fixes vector-im/element-web#15268.

## 🐛 Bug Fixes
 * Fix error when generating error for polling for updates ([\#25609](https://github.com/vector-im/element-web/pull/25609)).
 * Fix spurious notifications on non-live events ([\#11133](https://github.com/matrix-org/matrix-react-sdk/pull/11133)). Fixes vector-im/element-web#24336.
 * Prevent auto-translation within composer ([\#11114](https://github.com/matrix-org/matrix-react-sdk/pull/11114)). Fixes vector-im/element-web#25624.
 * Fix caret jump when backspacing into empty line at beginning of editor ([\#11128](https://github.com/matrix-org/matrix-react-sdk/pull/11128)). Fixes vector-im/element-web#22335.
 * Fix server picker not allowing you to switch from custom to default ([\#11127](https://github.com/matrix-org/matrix-react-sdk/pull/11127)). Fixes vector-im/element-web#25650.
 * Consider the unthreaded read receipt for Unread dot state ([\#11117](https://github.com/matrix-org/matrix-react-sdk/pull/11117)). Fixes vector-im/element-web#24229.
 * Increase RTE resilience ([\#11111](https://github.com/matrix-org/matrix-react-sdk/pull/11111)). Fixes vector-im/element-web#25277. Contributed by @alunturner.
 * Fix RoomView ignoring alias lookup errors due to them not knowing the roomId ([\#11099](https://github.com/matrix-org/matrix-react-sdk/pull/11099)). Fixes vector-im/element-web#24783 and vector-im/element-web#25562.
 * Fix style inconsistencies on SecureBackupPanel ([\#11102](https://github.com/matrix-org/matrix-react-sdk/pull/11102)). Fixes vector-im/element-web#25615. Contributed by @luixxiul.
 * Remove unknown MXIDs from invite suggestions ([\#11055](https://github.com/matrix-org/matrix-react-sdk/pull/11055)). Fixes vector-im/element-web#25446.
 * Reduce volume of ring sounds to normalised levels ([\#9143](https://github.com/matrix-org/matrix-react-sdk/pull/9143)). Contributed by @JMoVS.
 * Fix slash commands not being enabled in certain cases ([\#11090](https://github.com/matrix-org/matrix-react-sdk/pull/11090)). Fixes vector-im/element-web#25572.
 * Prevent escape in threads from sending focus to main timeline composer ([\#11061](https://github.com/matrix-org/matrix-react-sdk/pull/11061)). Fixes vector-im/element-web#23397.

Changes in [1.11.34](https://github.com/vector-im/element-desktop/releases/tag/v1.11.34) (2023-06-20)
=====================================================================================================

## ✨ Features
 * OIDC: add delegatedauthentication to validated server config ([\#11053](https://github.com/matrix-org/matrix-react-sdk/pull/11053)). Contributed by @kerryarchibald.
 * Allow image pasting in plain mode in RTE ([\#11056](https://github.com/matrix-org/matrix-react-sdk/pull/11056)). Contributed by @alunturner.
 * Show room options menu if "UIComponent.roomOptionsMenu" is enabled ([\#10365](https://github.com/matrix-org/matrix-react-sdk/pull/10365)). Contributed by @maheichyk.
 * Allow image pasting in rich text mode in RTE ([\#11049](https://github.com/matrix-org/matrix-react-sdk/pull/11049)). Contributed by @alunturner.
 * Update voice broadcast redaction to use MSC3912 `with_rel_type` instead of `with_relations` ([\#11014](https://github.com/matrix-org/matrix-react-sdk/pull/11014)). Fixes vector-im/element-web#25471.
 * Add config to skip widget_build_url for DM rooms ([\#11044](https://github.com/matrix-org/matrix-react-sdk/pull/11044)). Fixes vector-im/customer-retainer#74.
 * Inhibit interactions on forward dialog message previews ([\#11025](https://github.com/matrix-org/matrix-react-sdk/pull/11025)). Fixes vector-im/element-web#23459.
 * Removed `DecryptionFailureBar.tsx` ([\#11027](https://github.com/matrix-org/matrix-react-sdk/pull/11027)). Fixes vector-im/element-meta#1358. Contributed by @florianduros.

## 🐛 Bug Fixes
 * Fix translucent `TextualEvent` on search results panel ([\#10810](https://github.com/matrix-org/matrix-react-sdk/pull/10810)). Fixes vector-im/element-web#25292. Contributed by @luixxiul.
 * Matrix matrix scheme permalink constructor not stripping query params ([\#11060](https://github.com/matrix-org/matrix-react-sdk/pull/11060)). Fixes vector-im/element-web#25535.
 * Fix: "manually verify by text" does nothing ([\#11059](https://github.com/matrix-org/matrix-react-sdk/pull/11059)). Fixes vector-im/element-web#25375. Contributed by @kerryarchibald.
 * Make group calls respect the ICE fallback setting ([\#11047](https://github.com/matrix-org/matrix-react-sdk/pull/11047)). Fixes vector-im/voip-internal#65.
 * Align list items on the tooltip to the start ([\#11041](https://github.com/matrix-org/matrix-react-sdk/pull/11041)). Fixes vector-im/element-web#25355. Contributed by @luixxiul.
 * Clear thread panel event permalink when changing rooms ([\#11024](https://github.com/matrix-org/matrix-react-sdk/pull/11024)). Fixes vector-im/element-web#25484.
 * Fix spinner placement on pinned widgets being reloaded ([\#10970](https://github.com/matrix-org/matrix-react-sdk/pull/10970)). Fixes vector-im/element-web#25431. Contributed by @luixxiul.

Changes in [1.11.33](https://github.com/vector-im/element-desktop/releases/tag/v1.11.33) (2023-06-09)
=====================================================================================================

## 🐛 Bug Fixes
 * Bump matrix-react-sdk to v3.73.1 for matrix-js-sdk v26.0.1 Fixes vector-im/element-web#25526.

Changes in [1.11.32](https://github.com/vector-im/element-desktop/releases/tag/v1.11.32) (2023-06-06)
=====================================================================================================

## ✨ Features
 * Redirect to the SSO page if `sso_redirect_options.on_welcome_page` is enabled and the URL hash is empty ([\#25495](https://github.com/vector-im/element-web/pull/25495)). Contributed by @dhenneke.
 * vector/index.html: Allow fetching blob urls ([\#25336](https://github.com/vector-im/element-web/pull/25336)). Contributed by @SuperKenVery.
 * When joining room in sub-space join the parents too ([\#11011](https://github.com/matrix-org/matrix-react-sdk/pull/11011)).
 * Include thread replies in message previews ([\#10631](https://github.com/matrix-org/matrix-react-sdk/pull/10631)). Fixes vector-im/element-web#23920.
 * Use semantic headings in space preferences ([\#11021](https://github.com/matrix-org/matrix-react-sdk/pull/11021)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - Ignored users ([\#11006](https://github.com/matrix-org/matrix-react-sdk/pull/11006)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - profile ([\#10973](https://github.com/matrix-org/matrix-react-sdk/pull/10973)). Fixes vector-im/element-web#25461. Contributed by @kerryarchibald.
 * Use semantic headings in user settings - account ([\#10972](https://github.com/matrix-org/matrix-react-sdk/pull/10972)). Contributed by @kerryarchibald.
 * Support `Insert from iPhone or iPad` in Safari ([\#10851](https://github.com/matrix-org/matrix-react-sdk/pull/10851)). Fixes vector-im/element-web#25327. Contributed by @SuperKenVery.
 * Specify supportedStages for User Interactive Auth ([\#10975](https://github.com/matrix-org/matrix-react-sdk/pull/10975)). Fixes vector-im/element-web#19605.
 * Pass device id to widgets ([\#10209](https://github.com/matrix-org/matrix-react-sdk/pull/10209)). Contributed by @Fox32.
 * Use semantic headings in user settings - discovery ([\#10838](https://github.com/matrix-org/matrix-react-sdk/pull/10838)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings -  Notifications ([\#10948](https://github.com/matrix-org/matrix-react-sdk/pull/10948)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - spellcheck and language ([\#10959](https://github.com/matrix-org/matrix-react-sdk/pull/10959)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings Appearance ([\#10827](https://github.com/matrix-org/matrix-react-sdk/pull/10827)). Contributed by @kerryarchibald.
 * Use semantic heading in user settings Sidebar & Voip ([\#10782](https://github.com/matrix-org/matrix-react-sdk/pull/10782)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings Security ([\#10774](https://github.com/matrix-org/matrix-react-sdk/pull/10774)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - integrations and account deletion ([\#10837](https://github.com/matrix-org/matrix-react-sdk/pull/10837)). Fixes vector-im/element-web#25378. Contributed by @kerryarchibald.
 * Use semantic headings in user settings Preferences ([\#10794](https://github.com/matrix-org/matrix-react-sdk/pull/10794)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings Keyboard ([\#10793](https://github.com/matrix-org/matrix-react-sdk/pull/10793)). Contributed by @kerryarchibald.
 * RTE plain text mentions as pills ([\#10852](https://github.com/matrix-org/matrix-react-sdk/pull/10852)). Contributed by @alunturner.
 * Allow welcome.html logo to be replaced by config ([\#25339](https://github.com/vector-im/element-web/pull/25339)). Fixes vector-im/element-web#8636.
 * Use semantic headings in user settings Labs ([\#10773](https://github.com/matrix-org/matrix-react-sdk/pull/10773)). Contributed by @kerryarchibald.
 * Use semantic list elements for menu lists and tab lists ([\#10902](https://github.com/matrix-org/matrix-react-sdk/pull/10902)). Fixes vector-im/element-web#24928.
 * Fix aria-required-children axe violation ([\#10900](https://github.com/matrix-org/matrix-react-sdk/pull/10900)). Fixes vector-im/element-web#25342.
 * Enable pagination for overlay timelines ([\#10757](https://github.com/matrix-org/matrix-react-sdk/pull/10757)). Fixes vector-im/voip-internal#107.
 * Add tooltip to disabled invite button due to lack of permissions ([\#10869](https://github.com/matrix-org/matrix-react-sdk/pull/10869)). Fixes vector-im/element-web#9824.
 * Respect configured auth_header_logo_url for default Welcome page ([\#10870](https://github.com/matrix-org/matrix-react-sdk/pull/10870)).
 * Specify lazy loading for avatars ([\#10866](https://github.com/matrix-org/matrix-react-sdk/pull/10866)). Fixes vector-im/element-web#1983.
 * Room and user mentions for plain text editor ([\#10665](https://github.com/matrix-org/matrix-react-sdk/pull/10665)). Contributed by @alunturner.
 * Add audible notifcation on broadcast error ([\#10654](https://github.com/matrix-org/matrix-react-sdk/pull/10654)). Fixes vector-im/element-web#25132.
 * Fall back from server generated thumbnail to original image ([\#10853](https://github.com/matrix-org/matrix-react-sdk/pull/10853)).
 * Use semantically correct elements for room sublist context menu ([\#10831](https://github.com/matrix-org/matrix-react-sdk/pull/10831)). Fixes vector-im/customer-retainer#46.
 * Avoid calling prepareToEncrypt onKeyDown ([\#10828](https://github.com/matrix-org/matrix-react-sdk/pull/10828)).
 * Allows search to recognize full room links ([\#8275](https://github.com/matrix-org/matrix-react-sdk/pull/8275)). Contributed by @bolu-tife.
 * "Show rooms with unread messages first" should not be on by default for new users ([\#10820](https://github.com/matrix-org/matrix-react-sdk/pull/10820)). Fixes vector-im/element-web#25304. Contributed by @kerryarchibald.
 * Fix emitter handler leak in ThreadView ([\#10803](https://github.com/matrix-org/matrix-react-sdk/pull/10803)).
 * Add better error for email invites without identity server ([\#10739](https://github.com/matrix-org/matrix-react-sdk/pull/10739)). Fixes vector-im/element-web#16893.
 * Move reaction message previews out of labs ([\#10601](https://github.com/matrix-org/matrix-react-sdk/pull/10601)). Fixes vector-im/element-web#25083.
 * Sort muted rooms to the bottom of their section of the room list ([\#10592](https://github.com/matrix-org/matrix-react-sdk/pull/10592)). Fixes vector-im/element-web#25131. Contributed by @kerryarchibald.
 * Use semantic headings in user settings Help & About ([\#10752](https://github.com/matrix-org/matrix-react-sdk/pull/10752)). Contributed by @kerryarchibald.
 * use ExternalLink components for external links ([\#10758](https://github.com/matrix-org/matrix-react-sdk/pull/10758)). Contributed by @kerryarchibald.
 * Use semantic headings in space settings ([\#10751](https://github.com/matrix-org/matrix-react-sdk/pull/10751)). Contributed by @kerryarchibald.
 * Use semantic headings for room settings content ([\#10734](https://github.com/matrix-org/matrix-react-sdk/pull/10734)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Use consistent fonts for Japanese text ([\#10980](https://github.com/matrix-org/matrix-react-sdk/pull/10980)). Fixes vector-im/element-web#22333 and vector-im/element-web#23899.
 * Fix: server picker validates unselected option ([\#11020](https://github.com/matrix-org/matrix-react-sdk/pull/11020)). Fixes vector-im/element-web#25488. Contributed by @kerryarchibald.
 * Fix room list notification badges going missing in compact layout ([\#11022](https://github.com/matrix-org/matrix-react-sdk/pull/11022)). Fixes vector-im/element-web#25372.
 * Fix call to `startSingleSignOn` passing enum in place of idpId ([\#10998](https://github.com/matrix-org/matrix-react-sdk/pull/10998)). Fixes vector-im/element-web#24953.
 * Remove hover effect from user name on a DM creation UI ([\#10887](https://github.com/matrix-org/matrix-react-sdk/pull/10887)). Fixes vector-im/element-web#25305. Contributed by @luixxiul.
 * Fix layout regression in public space invite dialog ([\#11009](https://github.com/matrix-org/matrix-react-sdk/pull/11009)). Fixes vector-im/element-web#25458.
 * Fix layout regression in session dropdown ([\#10999](https://github.com/matrix-org/matrix-react-sdk/pull/10999)). Fixes vector-im/element-web#25448.
 * Fix spacing regression in user settings - roles & permissions ([\#10993](https://github.com/matrix-org/matrix-react-sdk/pull/10993)). Fixes vector-im/element-web#25447 and vector-im/element-web#25451. Contributed by @kerryarchibald.
 * Fall back to receipt timestamp if we have no event (react-sdk part) ([\#10974](https://github.com/matrix-org/matrix-react-sdk/pull/10974)). Fixes vector-im/element-web#10954. Contributed by @andybalaam.
 * Fix: Room header 'view your device list' does not link to new session manager ([\#10979](https://github.com/matrix-org/matrix-react-sdk/pull/10979)). Fixes vector-im/element-web#25440. Contributed by @kerryarchibald.
 * Fix display of devices without encryption support in Settings dialog ([\#10977](https://github.com/matrix-org/matrix-react-sdk/pull/10977)). Fixes vector-im/element-web#25413.
 * Use aria descriptions instead of labels for TextWithTooltip ([\#10952](https://github.com/matrix-org/matrix-react-sdk/pull/10952)). Fixes vector-im/element-web#25398.
 * Use grapheme-splitter instead of lodash for saving emoji from being ripped apart ([\#10976](https://github.com/matrix-org/matrix-react-sdk/pull/10976)). Fixes vector-im/element-web#22196.
 * Fix: content overflow in settings subsection ([\#10960](https://github.com/matrix-org/matrix-react-sdk/pull/10960)). Fixes vector-im/element-web#25416. Contributed by @kerryarchibald.
 * Make `Privacy Notice` external link on integration manager ToS clickable ([\#10914](https://github.com/matrix-org/matrix-react-sdk/pull/10914)). Fixes vector-im/element-web#25384. Contributed by @luixxiul.
 * Ensure that open message context menus are updated when the event is sent ([\#10950](https://github.com/matrix-org/matrix-react-sdk/pull/10950)).
 * Ensure that open sticker picker dialogs are updated when the widget configuration is updated. ([\#10945](https://github.com/matrix-org/matrix-react-sdk/pull/10945)).
 * Fix big emoji in replies ([\#10932](https://github.com/matrix-org/matrix-react-sdk/pull/10932)). Fixes vector-im/element-web#24798.
 * Hide empty `MessageActionBar` on message edit history dialog ([\#10447](https://github.com/matrix-org/matrix-react-sdk/pull/10447)). Fixes vector-im/element-web#24903. Contributed by @luixxiul.
 * Fix roving tab index getting confused after dragging space order ([\#10901](https://github.com/matrix-org/matrix-react-sdk/pull/10901)).
 * Attempt a potential workaround for stuck notifs ([\#3384](https://github.com/matrix-org/matrix-js-sdk/pull/3384)). Fixes vector-im/element-web#25406. Contributed by @andybalaam.
 * Update to seshat 3.0.1 ([\#960](https://github.com/vector-im/element-desktop/pull/960)). Fixes #959.
 * Fix macos update check exploding ([\#944](https://github.com/vector-im/element-desktop/pull/944)). Fixes #668.
 * Handle trailing dot FQDNs for domain-specific config.json files ([\#25351](https://github.com/vector-im/element-web/pull/25351)). Fixes vector-im/element-web#8858.
 * Ignore edits in message previews when they concern messages other than latest ([\#10868](https://github.com/matrix-org/matrix-react-sdk/pull/10868)). Fixes vector-im/element-web#14872.
 * Send correct receipts when viewing a room ([\#10864](https://github.com/matrix-org/matrix-react-sdk/pull/10864)). Fixes vector-im/element-web#25196.
 * Fix timeline search bar being overlapped by the right panel ([\#10809](https://github.com/matrix-org/matrix-react-sdk/pull/10809)). Fixes vector-im/element-web#25291. Contributed by @luixxiul.
 * Fix the state shown for call in rooms ([\#10833](https://github.com/matrix-org/matrix-react-sdk/pull/10833)).
 * Add string for membership event where both displayname & avatar change ([\#10880](https://github.com/matrix-org/matrix-react-sdk/pull/10880)). Fixes vector-im/element-web#18026.
 * Fix people space notification badge not updating for new DM invites ([\#10849](https://github.com/matrix-org/matrix-react-sdk/pull/10849)). Fixes vector-im/element-web#23248.
 * Fix regression in emoji picker order mangling after clearing filter ([\#10854](https://github.com/matrix-org/matrix-react-sdk/pull/10854)). Fixes vector-im/element-web#25323.
 * Fix: Edit history modal crash ([\#10834](https://github.com/matrix-org/matrix-react-sdk/pull/10834)). Fixes vector-im/element-web#25309. Contributed by @kerryarchibald.
 * Fix long room address and name not being clipped on room info card and update `_RoomSummaryCard.pcss` ([\#10811](https://github.com/matrix-org/matrix-react-sdk/pull/10811)). Fixes vector-im/element-web#25293. Contributed by @luixxiul.
 * Treat thumbnail upload failures as complete upload failures ([\#10829](https://github.com/matrix-org/matrix-react-sdk/pull/10829)). Fixes vector-im/element-web#7069.
 * Update finite automata to match user identifiers as per spec ([\#10798](https://github.com/matrix-org/matrix-react-sdk/pull/10798)). Fixes vector-im/element-web#25246.
 * Fix icon on empty notification panel ([\#10817](https://github.com/matrix-org/matrix-react-sdk/pull/10817)). Fixes vector-im/element-web#25298 and vector-im/element-web#25302. Contributed by @luixxiul.
 * Fix: Threads button is highlighted when I create a new room ([\#10819](https://github.com/matrix-org/matrix-react-sdk/pull/10819)). Fixes vector-im/element-web#25284. Contributed by @kerryarchibald.
 * Fix the top heading of notification panel ([\#10818](https://github.com/matrix-org/matrix-react-sdk/pull/10818)). Fixes vector-im/element-web#25303. Contributed by @luixxiul.
 * Fix the color of the verified E2EE icon on `RoomSummaryCard` ([\#10812](https://github.com/matrix-org/matrix-react-sdk/pull/10812)). Fixes vector-im/element-web#25295. Contributed by @luixxiul.
 * Fix: No feedback when waiting for the server on a /delete_devices request with SSO ([\#10795](https://github.com/matrix-org/matrix-react-sdk/pull/10795)). Fixes vector-im/element-web#23096. Contributed by @kerryarchibald.
 * Fix: reveal images when image previews are disabled ([\#10781](https://github.com/matrix-org/matrix-react-sdk/pull/10781)). Fixes vector-im/element-web#25271. Contributed by @kerryarchibald.
 * Fix accessibility issues around the room list and space panel ([\#10717](https://github.com/matrix-org/matrix-react-sdk/pull/10717)). Fixes vector-im/element-web#13345.
 * Ensure tooltip contents is linked via aria to the target element ([\#10729](https://github.com/matrix-org/matrix-react-sdk/pull/10729)). Fixes vector-im/customer-retainer#43.

Changes in [1.11.31](https://github.com/vector-im/element-desktop/releases/tag/v1.11.31) (2023-05-10)
=====================================================================================================

## 🚨 BREAKING CHANGES
 * If you package Element Desktop with a static sqlcipher, you may need to tweak some build scripts: SQLCIPHER_STATIC became SQLCIPHER_BUNDLED, and OpenSSL is now included too.

## ✨ Features
 * Start packaging for Debian & Ubuntu aarch64 ([\#895](https://github.com/vector-im/element-desktop/pull/895)).
 * Use a fully static seshat build ([\#631](https://github.com/vector-im/element-desktop/pull/631)). Contributed by @MatMaul.
 * Improve Content-Security-Policy ([\#25210](https://github.com/vector-im/element-web/pull/25210)).
 * Add UIFeature.locationSharing to hide location sharing ([\#10727](https://github.com/matrix-org/matrix-react-sdk/pull/10727)).
 * Memoize field validation results ([\#10714](https://github.com/matrix-org/matrix-react-sdk/pull/10714)).
 * Commands for plain text editor ([\#10567](https://github.com/matrix-org/matrix-react-sdk/pull/10567)). Contributed by @alunturner.
 * Allow 16 lines of text in the rich text editors ([\#10670](https://github.com/matrix-org/matrix-react-sdk/pull/10670)). Contributed by @alunturner.
 * Bail out of `RoomSettingsDialog` when room is not found ([\#10662](https://github.com/matrix-org/matrix-react-sdk/pull/10662)). Contributed by @kerryarchibald.
 * Element-R: Populate device list for right-panel ([\#10671](https://github.com/matrix-org/matrix-react-sdk/pull/10671)). Contributed by @florianduros.
 * Make existing and new issue URLs configurable ([\#10710](https://github.com/matrix-org/matrix-react-sdk/pull/10710)). Fixes vector-im/element-web#24424.
 * Fix usages of ARIA tabpanel ([\#10628](https://github.com/matrix-org/matrix-react-sdk/pull/10628)). Fixes vector-im/element-web#25016.
 * Element-R: Starting a DMs with a user ([\#10673](https://github.com/matrix-org/matrix-react-sdk/pull/10673)). Contributed by @florianduros.
 * ARIA Accessibility improvements ([\#10675](https://github.com/matrix-org/matrix-react-sdk/pull/10675)).
 * ARIA Accessibility improvements ([\#10674](https://github.com/matrix-org/matrix-react-sdk/pull/10674)).
 * Add arrow key controls to emoji and reaction pickers ([\#10637](https://github.com/matrix-org/matrix-react-sdk/pull/10637)). Fixes vector-im/element-web#17189.
 * Translate credits in help about section ([\#10676](https://github.com/matrix-org/matrix-react-sdk/pull/10676)).

## 🐛 Bug Fixes
 * Fix macos update check exploding ([\#944](https://github.com/vector-im/element-desktop/pull/944)). Fixes #668.
 * Fix: reveal images when image previews are disabled ([\#10781](https://github.com/matrix-org/matrix-react-sdk/pull/10781)). Fixes vector-im/element-web#25271. Contributed by @kerryarchibald.
 * Workaround Squirrel.Mac wedging app restart after failed update check ([\#629](https://github.com/vector-im/element-desktop/pull/629)).
 * Fix autocomplete not resetting properly on message send ([\#10741](https://github.com/matrix-org/matrix-react-sdk/pull/10741)). Fixes vector-im/element-web#25170.
 * Fix start_sso not working with guests disabled ([\#10720](https://github.com/matrix-org/matrix-react-sdk/pull/10720)). Fixes vector-im/element-web#16624.
 * Fix soft crash with Element call widgets ([\#10684](https://github.com/matrix-org/matrix-react-sdk/pull/10684)).
 * Send correct receipt when marking a room as read ([\#10730](https://github.com/matrix-org/matrix-react-sdk/pull/10730)). Fixes vector-im/element-web#25207.
 * Offload some more waveform processing onto a worker ([\#9223](https://github.com/matrix-org/matrix-react-sdk/pull/9223)). Fixes vector-im/element-web#19756.
 * Consolidate login errors ([\#10722](https://github.com/matrix-org/matrix-react-sdk/pull/10722)). Fixes vector-im/element-web#17520.
 * Fix all rooms search generating permalinks to wrong room id ([\#10625](https://github.com/matrix-org/matrix-react-sdk/pull/10625)). Fixes vector-im/element-web#25115.
 * Posthog properly handle Analytics ID changing from under us ([\#10702](https://github.com/matrix-org/matrix-react-sdk/pull/10702)). Fixes vector-im/element-web#25187.
 * Fix Clock being read as an absolute time rather than duration ([\#10706](https://github.com/matrix-org/matrix-react-sdk/pull/10706)). Fixes vector-im/element-web#22582.
 * Properly translate errors in `ChangePassword.tsx` so they show up translated to the user but not in our logs ([\#10615](https://github.com/matrix-org/matrix-react-sdk/pull/10615)). Fixes vector-im/element-web#9597. Contributed by @MadLittleMods.
 * Honour feature toggles in guest mode ([\#10651](https://github.com/matrix-org/matrix-react-sdk/pull/10651)). Fixes vector-im/element-web#24513. Contributed by @andybalaam.
 * Fix default content in devtools event sender ([\#10699](https://github.com/matrix-org/matrix-react-sdk/pull/10699)). Contributed by @tulir.
 * Fix a crash when a call ends while you're in it ([\#10681](https://github.com/matrix-org/matrix-react-sdk/pull/10681)). Fixes vector-im/element-web#25153.
 * Fix lack of screen reader indication when triggering auto complete ([\#10664](https://github.com/matrix-org/matrix-react-sdk/pull/10664)). Fixes vector-im/element-web#11011.
 * Fix typing tile duplicating users ([\#10678](https://github.com/matrix-org/matrix-react-sdk/pull/10678)). Fixes vector-im/element-web#25165.
 * Fix wrong room topic tooltip position ([\#10667](https://github.com/matrix-org/matrix-react-sdk/pull/10667)). Fixes vector-im/element-web#25158.
 * Fix create subspace dialog not working ([\#10652](https://github.com/matrix-org/matrix-react-sdk/pull/10652)). Fixes vector-im/element-web#24882.

Changes in [1.11.30](https://github.com/vector-im/element-desktop/releases/tag/v1.11.30) (2023-04-25)
=====================================================================================================

## 🔒 Security
 * Fixes for [CVE-2023-30609](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-30609) / GHSA-xv83-x443-7rmw

## ✨ Features
 * Pick sensible default option for phone country dropdown ([\#10627](https://github.com/matrix-org/matrix-react-sdk/pull/10627)). Fixes vector-im/element-web#3528.
 * Relate field validation tooltip via aria-describedby ([\#10522](https://github.com/matrix-org/matrix-react-sdk/pull/10522)). Fixes vector-im/element-web#24963.
 * Handle more completion types in rte autocomplete ([\#10560](https://github.com/matrix-org/matrix-react-sdk/pull/10560)). Contributed by @alunturner.
 * Show a tile for an unloaded predecessor room if it has via_servers ([\#10483](https://github.com/matrix-org/matrix-react-sdk/pull/10483)). Contributed by @andybalaam.
 * Exclude message timestamps from aria live region ([\#10584](https://github.com/matrix-org/matrix-react-sdk/pull/10584)). Fixes vector-im/element-web#5696.
 * Make composer format bar an aria toolbar ([\#10583](https://github.com/matrix-org/matrix-react-sdk/pull/10583)). Fixes vector-im/element-web#11283.
 * Improve accessibility of font slider ([\#10473](https://github.com/matrix-org/matrix-react-sdk/pull/10473)). Fixes vector-im/element-web#20168 and vector-im/element-web#24962.
 * fix file size display from kB to KB ([\#10561](https://github.com/matrix-org/matrix-react-sdk/pull/10561)). Fixes vector-im/element-web#24866. Contributed by @NSV1991.
 * Handle /me in rte ([\#10558](https://github.com/matrix-org/matrix-react-sdk/pull/10558)). Contributed by @alunturner.
 * bind html with switch for manage extension setting option ([\#10553](https://github.com/matrix-org/matrix-react-sdk/pull/10553)). Contributed by @NSV1991.
 * Handle command completions in RTE ([\#10521](https://github.com/matrix-org/matrix-react-sdk/pull/10521)). Contributed by @alunturner.
 * Add room and user avatars to rte ([\#10497](https://github.com/matrix-org/matrix-react-sdk/pull/10497)). Contributed by @alunturner.
 * Support for MSC3882 revision 1 ([\#10443](https://github.com/matrix-org/matrix-react-sdk/pull/10443)). Contributed by @hughns.
 * Check profiles before starting a DM ([\#10472](https://github.com/matrix-org/matrix-react-sdk/pull/10472)). Fixes vector-im/element-web#24830.
 * Quick settings: Change the copy / labels on the options ([\#10427](https://github.com/matrix-org/matrix-react-sdk/pull/10427)). Fixes vector-im/element-web#24522. Contributed by @justjanne.
 * Update rte autocomplete styling ([\#10503](https://github.com/matrix-org/matrix-react-sdk/pull/10503)). Contributed by @alunturner.

## 🐛 Bug Fixes
 * Workaround Squirrel.Mac wedging app restart after failed update check ([\#629](https://github.com/vector-im/element-desktop/pull/629)).
 * Fix error about webContents on log out ([\#627](https://github.com/vector-im/element-desktop/pull/627)).
 * Fix error when breadcrumb image fails to load ([\#609](https://github.com/vector-im/element-desktop/pull/609)).
 * Fix create subspace dialog not working ([\#10652](https://github.com/matrix-org/matrix-react-sdk/pull/10652)). Fixes vector-im/element-web#24882
 * Fix multiple accessibility defects identified by AXE ([\#10606](https://github.com/matrix-org/matrix-react-sdk/pull/10606)).
 * Fix view source from edit history dialog always showing latest event ([\#10626](https://github.com/matrix-org/matrix-react-sdk/pull/10626)). Fixes vector-im/element-web#21859.
 * #21451 Fix WebGL disabled error message ([\#10589](https://github.com/matrix-org/matrix-react-sdk/pull/10589)). Contributed by @rashmitpankhania.
 * Properly translate errors in `AddThreepid.ts` so they show up translated to the user but not in our logs ([\#10432](https://github.com/matrix-org/matrix-react-sdk/pull/10432)). Contributed by @MadLittleMods.
 * Fix overflow on auth pages ([\#10605](https://github.com/matrix-org/matrix-react-sdk/pull/10605)). Fixes vector-im/element-web#19548.
 * Fix incorrect avatar background colour when using a custom theme ([\#10598](https://github.com/matrix-org/matrix-react-sdk/pull/10598)). Contributed by @jdauphant.
 * Remove dependency on `org.matrix.e2e_cross_signing` unstable feature ([\#10593](https://github.com/matrix-org/matrix-react-sdk/pull/10593)).
 * Update setting description to match reality ([\#10600](https://github.com/matrix-org/matrix-react-sdk/pull/10600)). Fixes vector-im/element-web#25106.
 * Fix no identity server in help & about settings ([\#10563](https://github.com/matrix-org/matrix-react-sdk/pull/10563)). Fixes vector-im/element-web#25077.
 * Fix: Images no longer reserve their space in the timeline correctly ([\#10571](https://github.com/matrix-org/matrix-react-sdk/pull/10571)). Fixes vector-im/element-web#25082. Contributed by @kerryarchibald.
 * Fix issues with inhibited accessible focus outlines ([\#10579](https://github.com/matrix-org/matrix-react-sdk/pull/10579)). Fixes vector-im/element-web#19742.
 * Fix read receipts falling from sky ([\#10576](https://github.com/matrix-org/matrix-react-sdk/pull/10576)). Fixes vector-im/element-web#25081.
 * Fix avatar text issue in rte ([\#10559](https://github.com/matrix-org/matrix-react-sdk/pull/10559)). Contributed by @alunturner.
 * fix resizer only work with left mouse click ([\#10546](https://github.com/matrix-org/matrix-react-sdk/pull/10546)). Contributed by @NSV1991.
 * Fix send two join requests when joining a room from spotlight search ([\#10534](https://github.com/matrix-org/matrix-react-sdk/pull/10534)). Fixes vector-im/element-web#25054.
 * Highlight event when any version triggered a highlight ([\#10502](https://github.com/matrix-org/matrix-react-sdk/pull/10502)). Fixes vector-im/element-web#24923 and vector-im/element-web#24970. Contributed by @kerryarchibald.
 * Fix spacing of headings of integration manager on General settings tab ([\#10232](https://github.com/matrix-org/matrix-react-sdk/pull/10232)). Fixes vector-im/element-web#24085. Contributed by @luixxiul.

Changes in [1.11.29](https://github.com/vector-im/element-desktop/releases/tag/v1.11.29) (2023-04-11)
=====================================================================================================

## ✨ Features
 * Ship linux tarball with static sqlcipher ([\#597](https://github.com/vector-im/element-desktop/pull/597)). Fixes vector-im/element-web#18486.
 * Show recent room breadcrumbs on touchbar ([\#183](https://github.com/vector-im/element-desktop/pull/183)). Fixes vector-im/element-web#15998.
 * Clear electron data when logging out ([\#578](https://github.com/vector-im/element-desktop/pull/578)).
 * Send Electron crashpad reports to Sentry from Nightly ([\#579](https://github.com/vector-im/element-desktop/pull/579)). Fixes vector-im/element-web#18263.
 * Recommend element-io-archive-keyring from our Debian package ([\#566](https://github.com/vector-im/element-desktop/pull/566)).
 * Allow desktop app to expose recent rooms in UI integrations ([\#16940](https://github.com/vector-im/element-web/pull/16940)).
 * Add API params to mute audio and/or video in Jitsi calls by default ([\#24820](https://github.com/vector-im/element-web/pull/24820)). Contributed by @dhenneke.
 * Style mentions as pills in rich text editor ([\#10448](https://github.com/matrix-org/matrix-react-sdk/pull/10448)). Contributed by @alunturner.
 * Show room create icon if "UIComponent.roomCreation" is enabled ([\#10364](https://github.com/matrix-org/matrix-react-sdk/pull/10364)). Contributed by @maheichyk.
 * Mentions as links rte ([\#10463](https://github.com/matrix-org/matrix-react-sdk/pull/10463)). Contributed by @alunturner.
 * Better error handling in jump to date ([\#10405](https://github.com/matrix-org/matrix-react-sdk/pull/10405)). Contributed by @MadLittleMods.
 * Show "Invite" menu option if "UIComponent.sendInvites" is enabled. ([\#10363](https://github.com/matrix-org/matrix-react-sdk/pull/10363)). Contributed by @maheichyk.
 * Added `UserProfilesStore`, `LruCache` and user permalink profile caching ([\#10425](https://github.com/matrix-org/matrix-react-sdk/pull/10425)). Fixes vector-im/element-web#10559.
 * Mentions as links rte ([\#10422](https://github.com/matrix-org/matrix-react-sdk/pull/10422)). Contributed by @alunturner.
 * Implement MSC3952: intentional mentions ([\#9983](https://github.com/matrix-org/matrix-react-sdk/pull/9983)).
 * Implement MSC3973: Search users in the user directory with the Widget API ([\#10269](https://github.com/matrix-org/matrix-react-sdk/pull/10269)). Contributed by @dhenneke.
 * Permalinks to message are now displayed as pills ([\#10392](https://github.com/matrix-org/matrix-react-sdk/pull/10392)). Fixes vector-im/element-web#24751 and vector-im/element-web#24706.
 * Show search,dial,explore in filterContainer if "UIComponent.filterContainer" is enabled ([\#10381](https://github.com/matrix-org/matrix-react-sdk/pull/10381)). Contributed by @maheichyk.
 * Increase space panel collapse clickable area ([\#6084](https://github.com/matrix-org/matrix-react-sdk/pull/6084)). Fixes vector-im/element-web#17379. Contributed by @jaiwanth-v.
 * Add fallback for replies to Polls ([\#10380](https://github.com/matrix-org/matrix-react-sdk/pull/10380)). Fixes vector-im/element-web#24197. Contributed by @kerryarchibald.
 * Permalinks to rooms and users are now pillified ([\#10388](https://github.com/matrix-org/matrix-react-sdk/pull/10388)). Fixes vector-im/element-web#24825.
 * Poll history -  access poll history from room settings ([\#10356](https://github.com/matrix-org/matrix-react-sdk/pull/10356)). Contributed by @kerryarchibald.
 * Add API params to mute audio and/or video in Jitsi calls by default ([\#10376](https://github.com/matrix-org/matrix-react-sdk/pull/10376)). Contributed by @dhenneke.
 * Notifications: inline error message on notifications saving error ([\#10288](https://github.com/matrix-org/matrix-react-sdk/pull/10288)). Contributed by @kerryarchibald.
 * Support dynamic room predecessor in SpaceProvider ([\#10348](https://github.com/matrix-org/matrix-react-sdk/pull/10348)). Contributed by @andybalaam.
 * Support dynamic room predecessors for RoomProvider ([\#10346](https://github.com/matrix-org/matrix-react-sdk/pull/10346)). Contributed by @andybalaam.
 * Support dynamic room predecessors in OwnBeaconStore ([\#10339](https://github.com/matrix-org/matrix-react-sdk/pull/10339)). Contributed by @andybalaam.
 * Support dynamic room predecessors in ForwardDialog ([\#10344](https://github.com/matrix-org/matrix-react-sdk/pull/10344)). Contributed by @andybalaam.
 * Support dynamic room predecessors in SpaceHierarchy ([\#10341](https://github.com/matrix-org/matrix-react-sdk/pull/10341)). Contributed by @andybalaam.
 * Support dynamic room predecessors in AddExistingToSpaceDialog ([\#10342](https://github.com/matrix-org/matrix-react-sdk/pull/10342)). Contributed by @andybalaam.
 * Support dynamic room predecessors in leave-behaviour ([\#10340](https://github.com/matrix-org/matrix-react-sdk/pull/10340)). Contributed by @andybalaam.
 * Support dynamic room predecessors in StopGapWidgetDriver ([\#10338](https://github.com/matrix-org/matrix-react-sdk/pull/10338)). Contributed by @andybalaam.
 * Support dynamic room predecessors in WidgetLayoutStore ([\#10326](https://github.com/matrix-org/matrix-react-sdk/pull/10326)). Contributed by @andybalaam.
 * Support dynamic room predecessors in SpaceStore ([\#10332](https://github.com/matrix-org/matrix-react-sdk/pull/10332)). Contributed by @andybalaam.
 * Sync polls push rules on changes to account_data ([\#10287](https://github.com/matrix-org/matrix-react-sdk/pull/10287)). Contributed by @kerryarchibald.
 * Support dynamic room predecessors in BreadcrumbsStore ([\#10295](https://github.com/matrix-org/matrix-react-sdk/pull/10295)). Contributed by @andybalaam.
 * Improved a11y for Field feedback and Secure Phrase input ([\#10320](https://github.com/matrix-org/matrix-react-sdk/pull/10320)). Contributed by @Sebbones.
 * Support dynamic room predecessors in RoomNotificationStateStore ([\#10297](https://github.com/matrix-org/matrix-react-sdk/pull/10297)). Contributed by @andybalaam.

## 🐛 Bug Fixes
 * Run build_linux in docker using an older glibc ([\#599](https://github.com/vector-im/element-desktop/pull/599)). Fixes vector-im/element-web#24981.
 * Use a newly generated access_token while joining Jitsi ([\#24646](https://github.com/vector-im/element-web/pull/24646)). Fixes vector-im/element-web#24687. Contributed by @emrahcom.
 * Fix cloudflare action pointing at commit hash instead of tag ([\#24777](https://github.com/vector-im/element-web/pull/24777)). Contributed by @justjanne.
 * Allow editing with RTE to overflow for autocomplete visibility ([\#10499](https://github.com/matrix-org/matrix-react-sdk/pull/10499)). Contributed by @alunturner.
 * Added auto focus to Github URL on opening of debug logs modal ([\#10479](https://github.com/matrix-org/matrix-react-sdk/pull/10479)). Contributed by @ShivamSpm.
 * Fix detection of encryption for all users in a room ([\#10487](https://github.com/matrix-org/matrix-react-sdk/pull/10487)). Fixes vector-im/element-web#24995.
 * Properly generate mentions when editing a reply with MSC3952 ([\#10486](https://github.com/matrix-org/matrix-react-sdk/pull/10486)). Fixes vector-im/element-web#24924. Contributed by @kerryarchibald.
 * Improve performance of rendering a room with many hidden events ([\#10131](https://github.com/matrix-org/matrix-react-sdk/pull/10131)). Contributed by @andybalaam.
 * Prevent future date selection in jump to date ([\#10419](https://github.com/matrix-org/matrix-react-sdk/pull/10419)). Fixes vector-im/element-web#20800. Contributed by @MadLittleMods.
 * Add aria labels to message search bar to improve accessibility ([\#10476](https://github.com/matrix-org/matrix-react-sdk/pull/10476)). Fixes vector-im/element-web#24921.
 * Fix decryption failure bar covering the timeline ([\#10360](https://github.com/matrix-org/matrix-react-sdk/pull/10360)). Fixes vector-im/element-web#24780 vector-im/element-web#24074 and vector-im/element-web#24183. Contributed by @luixxiul.
 * Improve profile picture settings accessibility ([\#10470](https://github.com/matrix-org/matrix-react-sdk/pull/10470)). Fixes vector-im/element-web#24919.
 * Handle group call redaction ([\#10465](https://github.com/matrix-org/matrix-react-sdk/pull/10465)).
 * Display relative timestamp for threads on the same calendar day ([\#10399](https://github.com/matrix-org/matrix-react-sdk/pull/10399)). Fixes vector-im/element-web#24841. Contributed by @kerryarchibald.
 * Fix timeline list and paragraph display issues ([\#10424](https://github.com/matrix-org/matrix-react-sdk/pull/10424)). Fixes vector-im/element-web#24602. Contributed by @alunturner.
 * Use unique keys for voice broadcast pips ([\#10457](https://github.com/matrix-org/matrix-react-sdk/pull/10457)). Fixes vector-im/element-web#24959.
 * Fix "show read receipts sent by other users" not applying to threads ([\#10445](https://github.com/matrix-org/matrix-react-sdk/pull/10445)). Fixes vector-im/element-web#24910.
 * Fix joining public rooms without aliases in search dialog ([\#10437](https://github.com/matrix-org/matrix-react-sdk/pull/10437)). Fixes vector-im/element-web#23937.
 * Add input validation for `m.direct` in `DMRoomMap` ([\#10436](https://github.com/matrix-org/matrix-react-sdk/pull/10436)). Fixes vector-im/element-web#24909.
 * Reduce height reserved for "collapse" button's line on IRC layout ([\#10211](https://github.com/matrix-org/matrix-react-sdk/pull/10211)). Fixes vector-im/element-web#24605. Contributed by @luixxiul.
 * Fix `creatorUserId is required` error when opening sticker picker ([\#10423](https://github.com/matrix-org/matrix-react-sdk/pull/10423)).
 * Fix block/inline Element descendants error noise in `NewRoomIntro.tsx` ([\#10412](https://github.com/matrix-org/matrix-react-sdk/pull/10412)). Contributed by @MadLittleMods.
 * Fix profile resizer to make first character of a line selectable in IRC layout ([\#10396](https://github.com/matrix-org/matrix-react-sdk/pull/10396)). Fixes vector-im/element-web#14764. Contributed by @luixxiul.
 * Ensure space between wrapped lines of room name on IRC layout ([\#10188](https://github.com/matrix-org/matrix-react-sdk/pull/10188)). Fixes vector-im/element-web#24742. Contributed by @luixxiul.
 * Remove unreadable alt attribute from the room status bar warning icon (nonsense to screenreaders) ([\#10402](https://github.com/matrix-org/matrix-react-sdk/pull/10402)). Contributed by @MadLittleMods.
 * Fix big date separators when jump to date is enabled ([\#10404](https://github.com/matrix-org/matrix-react-sdk/pull/10404)). Fixes vector-im/element-web#22969. Contributed by @MadLittleMods.
 * Fixes user authentication when registering via the module API ([\#10257](https://github.com/matrix-org/matrix-react-sdk/pull/10257)). Contributed by @maheichyk.
 * Handle more edge cases in Space Hierarchy ([\#10280](https://github.com/matrix-org/matrix-react-sdk/pull/10280)). Contributed by @justjanne.
 * Further improve performance with lots of hidden events ([\#10353](https://github.com/matrix-org/matrix-react-sdk/pull/10353)). Fixes vector-im/element-web#24480. Contributed by @andybalaam.
 * Respect user cancelling upload flow by dismissing spinner ([\#10373](https://github.com/matrix-org/matrix-react-sdk/pull/10373)). Fixes vector-im/element-web#24667.
 * When starting a DM, the end-to-end encryption status icon does now only appear if the DM can be encrypted ([\#10394](https://github.com/matrix-org/matrix-react-sdk/pull/10394)). Fixes vector-im/element-web#24397.
 * Fix `[object Object]` in feedback metadata ([\#10390](https://github.com/matrix-org/matrix-react-sdk/pull/10390)).
 * Fix pinned messages card saying nothing pinned while loading ([\#10385](https://github.com/matrix-org/matrix-react-sdk/pull/10385)). Fixes vector-im/element-web#24615.
 * Fix import e2e key dialog staying disabled after paste ([\#10375](https://github.com/matrix-org/matrix-react-sdk/pull/10375)). Fixes vector-im/element-web#24818.
 * Show all labs even if incompatible, with appropriate tooltip explaining requirements ([\#10369](https://github.com/matrix-org/matrix-react-sdk/pull/10369)). Fixes vector-im/element-web#24813.
 * Fix UIFeature.Registration not applying to all paths ([\#10371](https://github.com/matrix-org/matrix-react-sdk/pull/10371)). Fixes vector-im/element-web#24814.
 * Clicking on a user pill does now only open the profile in the right panel and no longer navigates to the home view. ([\#10359](https://github.com/matrix-org/matrix-react-sdk/pull/10359)). Fixes vector-im/element-web#24797.
 * Fix start DM with pending third party invite ([\#10347](https://github.com/matrix-org/matrix-react-sdk/pull/10347)). Fixes vector-im/element-web#24781.
 * Fix long display name overflowing reply tile on IRC layout ([\#10343](https://github.com/matrix-org/matrix-react-sdk/pull/10343)). Fixes vector-im/element-web#24738. Contributed by @luixxiul.
 * Display redacted body on ThreadView in the same way as normal messages ([\#9016](https://github.com/matrix-org/matrix-react-sdk/pull/9016)). Fixes vector-im/element-web#24729. Contributed by @luixxiul.
 * Handle more edge cases in ACL updates ([\#10279](https://github.com/matrix-org/matrix-react-sdk/pull/10279)). Contributed by @justjanne.
 * Allow parsing png files to fail if thumbnailing is successful ([\#10308](https://github.com/matrix-org/matrix-react-sdk/pull/10308)).

Changes in [1.11.28](https://github.com/vector-im/element-desktop/releases/tag/v1.11.28) (2023-03-31)
=====================================================================================================

## 🐛 Bug Fixes
 * Fix broken lockfile. Fixes vector-im/element-web#25008.

Changes in [1.11.27](https://github.com/vector-im/element-desktop/releases/tag/v1.11.27) (2023-03-31)
=====================================================================================================

## 🐛 Bug Fixes
 * Run build_linux in docker using an older glibc ([\#599](https://github.com/vector-im/element-desktop/pull/599)). Fixes vector-im/element-web#24981.
 * Fix detection of encryption for all users in a room ([\#10487](https://github.com/matrix-org/matrix-react-sdk/pull/10487)). Fixes vector-im/element-web#24995.

Changes in [1.11.26](https://github.com/vector-im/element-desktop/releases/tag/v1.11.26) (2023-03-28)
=====================================================================================================

## 🔒 Security
 * Fixes for [CVE-2023-28427](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-28427) / GHSA-mwq8-fjpf-c2gr
 * Fixes for [CVE-2023-28103](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-28103) / GHSA-6g43-88cp-w5gv

Changes in [1.11.25](https://github.com/vector-im/element-desktop/releases/tag/v1.11.25) (2023-03-15)
=====================================================================================================

## ✨ Features
 * Remove experimental PWA support for Firefox and Safari ([\#24630](https://github.com/vector-im/element-web/pull/24630)).
 * Only allow to start a DM with one email if encryption by default is enabled ([\#10253](https://github.com/matrix-org/matrix-react-sdk/pull/10253)). Fixes vector-im/element-web#23133.
 * DM rooms are now encrypted if encryption by default is enabled and only inviting a single email address. Any action in the result DM room will be blocked until the other has joined. ([\#10229](https://github.com/matrix-org/matrix-react-sdk/pull/10229)).
 * Reduce bottom margin of ReplyChain on compact modern layout ([\#8972](https://github.com/matrix-org/matrix-react-sdk/pull/8972)). Fixes vector-im/element-web#22748. Contributed by @luixxiul.
 * Support for v2 of MSC3903 ([\#10165](https://github.com/matrix-org/matrix-react-sdk/pull/10165)). Contributed by @hughns.
 * When starting a DM, existing rooms with pending third-party invites will be reused. ([\#10256](https://github.com/matrix-org/matrix-react-sdk/pull/10256)). Fixes vector-im/element-web#23139.
 * Polls push rules: synchronise poll rules with message rules ([\#10263](https://github.com/matrix-org/matrix-react-sdk/pull/10263)). Contributed by @kerryarchibald.
 * New verification request toast button labels ([\#10259](https://github.com/matrix-org/matrix-react-sdk/pull/10259)).
 * Remove padding around integration manager iframe ([\#10148](https://github.com/matrix-org/matrix-react-sdk/pull/10148)).
 * Fix block code styling in rich text editor ([\#10246](https://github.com/matrix-org/matrix-react-sdk/pull/10246)). Contributed by @alunturner.
 * Poll history: fetch more poll history ([\#10235](https://github.com/matrix-org/matrix-react-sdk/pull/10235)). Contributed by @kerryarchibald.
 * Sort short/exact emoji matches before longer incomplete matches ([\#10212](https://github.com/matrix-org/matrix-react-sdk/pull/10212)). Fixes vector-im/element-web#23210. Contributed by @grimhilt.
 * Poll history: detail screen ([\#10172](https://github.com/matrix-org/matrix-react-sdk/pull/10172)). Contributed by @kerryarchibald.
 * Provide a more detailed error message than "No known servers" ([\#6048](https://github.com/matrix-org/matrix-react-sdk/pull/6048)). Fixes vector-im/element-web#13247. Contributed by @aaronraimist.
 * Say when a call was answered from a different device ([\#10224](https://github.com/matrix-org/matrix-react-sdk/pull/10224)).
 * Widget permissions customizations using module api ([\#10121](https://github.com/matrix-org/matrix-react-sdk/pull/10121)). Contributed by @maheichyk.
 * Fix copy button icon overlapping with copyable text ([\#10227](https://github.com/matrix-org/matrix-react-sdk/pull/10227)). Contributed by @Adesh-Pandey.
 * Support joining non-peekable rooms via the module API ([\#10154](https://github.com/matrix-org/matrix-react-sdk/pull/10154)). Contributed by @maheichyk.
 * The "new login" toast does now display the same device information as in the settings. "No" does now open the device settings. "Yes, it was me" dismisses the toast. ([\#10200](https://github.com/matrix-org/matrix-react-sdk/pull/10200)).
 * Do not prompt for a password when doing a „reset all“ after login ([\#10208](https://github.com/matrix-org/matrix-react-sdk/pull/10208)).

## 🐛 Bug Fixes
 * Fix macOS notarisation using keychain credentials ([\#557](https://github.com/vector-im/element-desktop/pull/557)).
 * Let electron-builder correctly set StartupWMClass ([\#526](https://github.com/vector-im/element-desktop/pull/526)). Fixes vector-im/element-web#13780.
 * Fix incorrect copy in space creation flow ([\#10296](https://github.com/matrix-org/matrix-react-sdk/pull/10296)). Fixes vector-im/element-web#24741.
 * Fix space settings dialog having rogue title tooltip ([\#10293](https://github.com/matrix-org/matrix-react-sdk/pull/10293)). Fixes vector-im/element-web#24740.
 * Show spinner when starting a DM from the user profile (right panel) ([\#10290](https://github.com/matrix-org/matrix-react-sdk/pull/10290)).
 * Reduce height of toggle on expanded view source event ([\#10283](https://github.com/matrix-org/matrix-react-sdk/pull/10283)). Fixes vector-im/element-web#22873. Contributed by @luixxiul.
 * Pillify http and non-prefixed matrix.to links ([\#10277](https://github.com/matrix-org/matrix-react-sdk/pull/10277)). Fixes vector-im/element-web#20844.
 * Fix some features not being configurable via `features` ([\#10276](https://github.com/matrix-org/matrix-react-sdk/pull/10276)).
 * Fix starting a DM from the right panel in some cases ([\#10278](https://github.com/matrix-org/matrix-react-sdk/pull/10278)). Fixes vector-im/element-web#24722.
 * Align info EventTile and normal EventTile on IRC layout ([\#10197](https://github.com/matrix-org/matrix-react-sdk/pull/10197)). Fixes vector-im/element-web#22782. Contributed by @luixxiul.
 * Fix blowout of waveform of the voice message player on narrow UI ([\#8861](https://github.com/matrix-org/matrix-react-sdk/pull/8861)). Fixes vector-im/element-web#22604. Contributed by @luixxiul.
 * Fix the hidden view source toggle on IRC layout ([\#10266](https://github.com/matrix-org/matrix-react-sdk/pull/10266)). Fixes vector-im/element-web#22872. Contributed by @luixxiul.
 * Fix buttons on the room header being compressed due to long room name ([\#10155](https://github.com/matrix-org/matrix-react-sdk/pull/10155)). Contributed by @luixxiul.
 * Use the room avatar as a placeholder in calls ([\#10231](https://github.com/matrix-org/matrix-react-sdk/pull/10231)).
 * Fix calls showing as 'connecting' after hangup ([\#10223](https://github.com/matrix-org/matrix-react-sdk/pull/10223)).
 * Prevent multiple Jitsi calls started at the same time ([\#10183](https://github.com/matrix-org/matrix-react-sdk/pull/10183)). Fixes vector-im/element-web#23009.
 * Make localization keys compatible with agglutinative and/or SOV type languages ([\#10159](https://github.com/matrix-org/matrix-react-sdk/pull/10159)). Contributed by @luixxiul.

Changes in [1.11.24](https://github.com/vector-im/element-desktop/releases/tag/v1.11.24) (2023-02-28)
=====================================================================================================

## ✨ Features
 * Display "The sender has blocked you from receiving this message" error message instead of "Unable to decrypt message" ([\#10202](https://github.com/matrix-org/matrix-react-sdk/pull/10202)). Contributed by @florianduros.
 * Polls: show warning about undecryptable relations ([\#10179](https://github.com/matrix-org/matrix-react-sdk/pull/10179)). Contributed by @kerryarchibald.
 * Poll history: fetch last 30 days of polls ([\#10157](https://github.com/matrix-org/matrix-react-sdk/pull/10157)). Contributed by @kerryarchibald.
 * Poll history - ended polls list items ([\#10119](https://github.com/matrix-org/matrix-react-sdk/pull/10119)). Contributed by @kerryarchibald.
 * Remove threads labs flag and the ability to disable threads ([\#9878](https://github.com/matrix-org/matrix-react-sdk/pull/9878)). Fixes vector-im/element-web#24365.
 * Show a success dialog after setting up the key backup ([\#10177](https://github.com/matrix-org/matrix-react-sdk/pull/10177)). Fixes vector-im/element-web#24487.
 * Release Sign in with QR out of labs ([\#10182](https://github.com/matrix-org/matrix-react-sdk/pull/10182)). Contributed by @hughns.
 * Release Sign in with QR out of labs ([\#10066](https://github.com/matrix-org/matrix-react-sdk/pull/10066)). Contributed by @hughns.
 * Hide indent button in rte ([\#10149](https://github.com/matrix-org/matrix-react-sdk/pull/10149)). Contributed by @alunturner.
 * Add option to find own location in map views ([\#10083](https://github.com/matrix-org/matrix-react-sdk/pull/10083)).
 * Render poll end events in timeline ([\#10027](https://github.com/matrix-org/matrix-react-sdk/pull/10027)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Stop access token overflowing the box ([\#10069](https://github.com/matrix-org/matrix-react-sdk/pull/10069)). Fixes vector-im/element-web#24023. Contributed by @sbjaj33.
 * Add link to next file in the export ([\#10190](https://github.com/matrix-org/matrix-react-sdk/pull/10190)). Fixes vector-im/element-web#20272. Contributed by @grimhilt.
 * Ended poll tiles: add ended the poll message ([\#10193](https://github.com/matrix-org/matrix-react-sdk/pull/10193)). Fixes vector-im/element-web#24579. Contributed by @kerryarchibald.
 * Fix accidentally inverted condition for room ordering ([\#10178](https://github.com/matrix-org/matrix-react-sdk/pull/10178)). Fixes vector-im/element-web#24527. Contributed by @justjanne.
 * Re-focus the composer on dialogue quit ([\#10007](https://github.com/matrix-org/matrix-react-sdk/pull/10007)). Fixes vector-im/element-web#22832. Contributed by @Ashu999.
 * Try to resolve emails before creating a DM ([\#10164](https://github.com/matrix-org/matrix-react-sdk/pull/10164)).
 * Disable poll response loading test ([\#10168](https://github.com/matrix-org/matrix-react-sdk/pull/10168)). Contributed by @justjanne.
 * Fix email lookup in invite dialog ([\#10150](https://github.com/matrix-org/matrix-react-sdk/pull/10150)). Fixes vector-im/element-web#23353.
 * Remove duplicate white space characters from translation keys ([\#10152](https://github.com/matrix-org/matrix-react-sdk/pull/10152)). Contributed by @luixxiul.
 * Fix the caption of new sessions manager on Labs settings page for localization ([\#10143](https://github.com/matrix-org/matrix-react-sdk/pull/10143)). Contributed by @luixxiul.
 * Prevent start another DM with a user if one already exists ([\#10127](https://github.com/matrix-org/matrix-react-sdk/pull/10127)). Fixes vector-im/element-web#23138.
 * Remove white space characters before the horizontal ellipsis ([\#10130](https://github.com/matrix-org/matrix-react-sdk/pull/10130)). Contributed by @luixxiul.
 * Fix Selectable Text on 'Delete All' and 'Retry All' Buttons ([\#10128](https://github.com/matrix-org/matrix-react-sdk/pull/10128)). Fixes vector-im/element-web#23232. Contributed by @akshattchhabra.
 * Correctly Identify emoticons ([\#10108](https://github.com/matrix-org/matrix-react-sdk/pull/10108)). Fixes vector-im/element-web#19472. Contributed by @adarsh-sgh.
 * Remove a redundant white space ([\#10129](https://github.com/matrix-org/matrix-react-sdk/pull/10129)). Contributed by @luixxiul.

Changes in [1.11.23](https://github.com/vector-im/element-desktop/releases/tag/v1.11.23) (2023-02-14)
=====================================================================================================

## ✨ Features
 * Description of QR code sign in labs feature ([\#23513](https://github.com/vector-im/element-web/pull/23513)). Contributed by @hughns.
 * Add option to find own location in map views ([\#10083](https://github.com/matrix-org/matrix-react-sdk/pull/10083)).
 * Render poll end events in timeline ([\#10027](https://github.com/matrix-org/matrix-react-sdk/pull/10027)). Contributed by @kerryarchibald.
 * Indicate unread messages in tab title ([\#10096](https://github.com/matrix-org/matrix-react-sdk/pull/10096)). Contributed by @tnt7864.
 * Open message in editing mode when keyboard up is pressed (RTE) ([\#10079](https://github.com/matrix-org/matrix-react-sdk/pull/10079)). Contributed by @florianduros.
 * Hide superseded rooms from the room list using dynamic room predecessors ([\#10068](https://github.com/matrix-org/matrix-react-sdk/pull/10068)). Contributed by @andybalaam.
 * Support MSC3946 in RoomListStore ([\#10054](https://github.com/matrix-org/matrix-react-sdk/pull/10054)). Fixes vector-im/element-web#24325. Contributed by @andybalaam.
 * Auto focus security key field ([\#10048](https://github.com/matrix-org/matrix-react-sdk/pull/10048)).
 * use Poll model with relations API in poll rendering ([\#9877](https://github.com/matrix-org/matrix-react-sdk/pull/9877)). Contributed by @kerryarchibald.
 * Support MSC3946 in the RoomCreate tile ([\#10041](https://github.com/matrix-org/matrix-react-sdk/pull/10041)). Fixes vector-im/element-web#24323. Contributed by @andybalaam.
 * Update labs flag description for RTE ([\#10058](https://github.com/matrix-org/matrix-react-sdk/pull/10058)). Contributed by @florianduros.
 * Change ul list style to disc when editing message ([\#10043](https://github.com/matrix-org/matrix-react-sdk/pull/10043)). Contributed by @alunturner.
 * Improved click detection within PiP windows ([\#10040](https://github.com/matrix-org/matrix-react-sdk/pull/10040)). Fixes vector-im/element-web#24371.
 * Add RTE keyboard navigation in editing ([\#9980](https://github.com/matrix-org/matrix-react-sdk/pull/9980)). Fixes vector-im/element-web#23621. Contributed by @florianduros.
 * Paragraph integration for rich text editor ([\#10008](https://github.com/matrix-org/matrix-react-sdk/pull/10008)). Contributed by @alunturner.
 * Add  indentation increasing/decreasing to RTE ([\#10034](https://github.com/matrix-org/matrix-react-sdk/pull/10034)). Contributed by @florianduros.
 * Add ignore user confirmation dialog ([\#6116](https://github.com/matrix-org/matrix-react-sdk/pull/6116)). Fixes vector-im/element-web#14746.
 * Use monospace font for room, message IDs in View Source modal ([\#9956](https://github.com/matrix-org/matrix-react-sdk/pull/9956)). Fixes vector-im/element-web#21937. Contributed by @paragpoddar.
 * Implement MSC3946 for AdvancedRoomSettingsTab ([\#9995](https://github.com/matrix-org/matrix-react-sdk/pull/9995)). Fixes vector-im/element-web#24322. Contributed by @andybalaam.
 * Implementation of MSC3824 to make the client OIDC-aware ([\#8681](https://github.com/matrix-org/matrix-react-sdk/pull/8681)). Contributed by @hughns.
 * Improves a11y for avatar uploads ([\#9985](https://github.com/matrix-org/matrix-react-sdk/pull/9985)). Contributed by @GoodGuyMarco.
 * Add support for [token authenticated registration](https ([\#7275](https://github.com/matrix-org/matrix-react-sdk/pull/7275)). Fixes vector-im/element-web#18931. Contributed by @govynnus.

## 🐛 Bug Fixes
 * Update to Electron 22.2.0 - fix tray icons in Linux ([\#530](https://github.com/vector-im/element-desktop/pull/530)). Fixes vector-im/element-web#23993.
 * Jitsi requests 'requires_client' capability if auth token is provided ([\#24294](https://github.com/vector-im/element-web/pull/24294)). Contributed by @maheichyk.
 * Remove duplicate white space characters from translation keys ([\#10152](https://github.com/matrix-org/matrix-react-sdk/pull/10152)). Contributed by @luixxiul.
 * Fix the caption of new sessions manager on Labs settings page for localization ([\#10143](https://github.com/matrix-org/matrix-react-sdk/pull/10143)). Contributed by @luixxiul.
 * Prevent start another DM with a user if one already exists ([\#10127](https://github.com/matrix-org/matrix-react-sdk/pull/10127)). Fixes vector-im/element-web#23138.
 * Remove white space characters before the horizontal ellipsis ([\#10130](https://github.com/matrix-org/matrix-react-sdk/pull/10130)). Contributed by @luixxiul.
 * Fix Selectable Text on 'Delete All' and 'Retry All' Buttons ([\#10128](https://github.com/matrix-org/matrix-react-sdk/pull/10128)). Fixes vector-im/element-web#23232. Contributed by @akshattchhabra.
 * Correctly Identify emoticons ([\#10108](https://github.com/matrix-org/matrix-react-sdk/pull/10108)). Fixes vector-im/element-web#19472. Contributed by @adarsh-sgh.
 * Should open new 1:1 chat room after leaving the old one ([\#9880](https://github.com/matrix-org/matrix-react-sdk/pull/9880)). Contributed by @ahmadkadri.
 * Remove a redundant white space ([\#10129](https://github.com/matrix-org/matrix-react-sdk/pull/10129)). Contributed by @luixxiul.
 * Fix a crash when removing persistent widgets (updated) ([\#10099](https://github.com/matrix-org/matrix-react-sdk/pull/10099)). Fixes vector-im/element-web#24412. Contributed by @andybalaam.
 * Fix wrongly grouping 3pid invites into a single repeated transition ([\#10087](https://github.com/matrix-org/matrix-react-sdk/pull/10087)). Fixes vector-im/element-web#24432.
 * Fix scrollbar colliding with checkbox in add to space section ([\#10093](https://github.com/matrix-org/matrix-react-sdk/pull/10093)). Fixes vector-im/element-web#23189. Contributed by @Arnabdaz.
 * Add a whitespace character after 'broadcast?' ([\#10097](https://github.com/matrix-org/matrix-react-sdk/pull/10097)). Contributed by @luixxiul.
 * Seekbar in broadcast PiP view is now updated when switching between different broadcasts ([\#10072](https://github.com/matrix-org/matrix-react-sdk/pull/10072)). Fixes vector-im/element-web#24415.
 * Add border to "reject" button on room preview card for clickable area indication. It fixes vector-im/element-web#22623 ([\#9205](https://github.com/matrix-org/matrix-react-sdk/pull/9205)). Contributed by @gefgu.
 * Element-R: fix rageshages ([\#10081](https://github.com/matrix-org/matrix-react-sdk/pull/10081)). Fixes vector-im/element-web#24430.
 * Fix markdown paragraph display in timeline ([\#10071](https://github.com/matrix-org/matrix-react-sdk/pull/10071)). Fixes vector-im/element-web#24419. Contributed by @alunturner.
 * Prevent the remaining broadcast time from being exceeded ([\#10070](https://github.com/matrix-org/matrix-react-sdk/pull/10070)).
 * Fix cursor position when new line is created by pressing enter (RTE) ([\#10064](https://github.com/matrix-org/matrix-react-sdk/pull/10064)). Contributed by @florianduros.
 * Ensure room is actually in space hierarchy when resolving its latest version ([\#10010](https://github.com/matrix-org/matrix-react-sdk/pull/10010)).
 * Fix new line for inline code ([\#10062](https://github.com/matrix-org/matrix-react-sdk/pull/10062)). Contributed by @florianduros.
 * Member avatars without canvas ([\#9990](https://github.com/matrix-org/matrix-react-sdk/pull/9990)). Contributed by @clarkf.
 * Apply more general fix for base avatar regressions ([\#10045](https://github.com/matrix-org/matrix-react-sdk/pull/10045)). Fixes vector-im/element-web#24382 and vector-im/element-web#24370.
 * Replace list, code block and quote icons by new icons ([\#10035](https://github.com/matrix-org/matrix-react-sdk/pull/10035)). Contributed by @florianduros.
 * fix regional emojis converted to flags ([\#9294](https://github.com/matrix-org/matrix-react-sdk/pull/9294)). Fixes vector-im/element-web#19000. Contributed by @grimhilt.
 * resolved emoji description text overflowing issue ([\#10028](https://github.com/matrix-org/matrix-react-sdk/pull/10028)). Contributed by @fahadNoufal.
 * Fix MessageEditHistoryDialog crashing on complex input ([\#10018](https://github.com/matrix-org/matrix-react-sdk/pull/10018)). Fixes vector-im/element-web#23665. Contributed by @clarkf.
 * Unify unread notification state determination ([\#9941](https://github.com/matrix-org/matrix-react-sdk/pull/9941)). Contributed by @clarkf.
 * Fix layout and visual regressions around default avatars ([\#10031](https://github.com/matrix-org/matrix-react-sdk/pull/10031)). Fixes vector-im/element-web#24375 and vector-im/element-web#24369.
 * Fix useUnreadNotifications exploding with falsey room, like in notif panel ([\#10030](https://github.com/matrix-org/matrix-react-sdk/pull/10030)). Fixes matrix-org/element-web-rageshakes#19334.
 * Fix "[object Promise]" appearing in HTML exports ([\#9975](https://github.com/matrix-org/matrix-react-sdk/pull/9975)). Fixes vector-im/element-web#24272. Contributed by @clarkf.
 * changing the color of message time stamp ([\#10016](https://github.com/matrix-org/matrix-react-sdk/pull/10016)). Contributed by @nawarajshah.
 * Fix link creation with backward selection ([\#9986](https://github.com/matrix-org/matrix-react-sdk/pull/9986)). Fixes vector-im/element-web#24315. Contributed by @florianduros.
 * Misaligned reply preview in thread composer #23396 ([\#9977](https://github.com/matrix-org/matrix-react-sdk/pull/9977)). Fixes vector-im/element-web#23396. Contributed by @mustafa-kapadia1483.

Changes in [1.11.22](https://github.com/vector-im/element-desktop/releases/tag/v1.11.22) (2023-01-31)
=====================================================================================================

## 🐛 Bug Fixes
 * Bump version number to fix problems upgrading from v1.11.21-rc.1

Changes in [1.11.21](https://github.com/vector-im/element-desktop/releases/tag/v1.11.21) (2023-01-31)
=====================================================================================================

## ✨ Features
 * Move pin drop out of labs ([\#22993](https://github.com/vector-im/element-web/pull/22993)).
 * Quotes for rte ([\#9932](https://github.com/matrix-org/matrix-react-sdk/pull/9932)). Contributed by @alunturner.
 * Show the room name in the room header during calls ([\#9942](https://github.com/matrix-org/matrix-react-sdk/pull/9942)). Fixes vector-im/element-web#24268.
 * Add code blocks to rich text editor ([\#9921](https://github.com/matrix-org/matrix-react-sdk/pull/9921)). Contributed by @alunturner.
 * Add new style for inline code ([\#9936](https://github.com/matrix-org/matrix-react-sdk/pull/9936)). Contributed by @florianduros.
 * Add disabled button state to rich text editor ([\#9930](https://github.com/matrix-org/matrix-react-sdk/pull/9930)). Contributed by @alunturner.
 * Change the rageshake "app" for auto-rageshakes ([\#9909](https://github.com/matrix-org/matrix-react-sdk/pull/9909)).
 * Device manager - tweak settings display ([\#9905](https://github.com/matrix-org/matrix-react-sdk/pull/9905)). Contributed by @kerryarchibald.
 * Add list functionality to rich text editor ([\#9871](https://github.com/matrix-org/matrix-react-sdk/pull/9871)). Contributed by @alunturner.

## 🐛 Bug Fixes
 * Fix RTE focus behaviour in threads ([\#9969](https://github.com/matrix-org/matrix-react-sdk/pull/9969)). Fixes vector-im/element-web#23755. Contributed by @florianduros.
 * #22204 Issue: Centered File info in lightbox ([\#9971](https://github.com/matrix-org/matrix-react-sdk/pull/9971)). Fixes vector-im/element-web#22204. Contributed by @Spartan09.
 * Fix seekbar position for zero length audio ([\#9949](https://github.com/matrix-org/matrix-react-sdk/pull/9949)). Fixes vector-im/element-web#24248.
 * Allow thread panel to be closed after being opened from notification ([\#9937](https://github.com/matrix-org/matrix-react-sdk/pull/9937)). Fixes vector-im/element-web#23764 vector-im/element-web#23852 and vector-im/element-web#24213. Contributed by @justjanne.
 * Only highlight focused menu item if focus is supposed to be visible ([\#9945](https://github.com/matrix-org/matrix-react-sdk/pull/9945)). Fixes vector-im/element-web#23582.
 * Prevent call durations from breaking onto multiple lines ([\#9944](https://github.com/matrix-org/matrix-react-sdk/pull/9944)).
 * Tweak call lobby buttons to more closely match designs ([\#9943](https://github.com/matrix-org/matrix-react-sdk/pull/9943)).
 * Do not show a broadcast as live immediately after the recording has stopped ([\#9947](https://github.com/matrix-org/matrix-react-sdk/pull/9947)). Fixes vector-im/element-web#24233.
 * Clear the RTE before sending a message ([\#9948](https://github.com/matrix-org/matrix-react-sdk/pull/9948)). Contributed by @florianduros.
 * Fix {enter} press in RTE ([\#9927](https://github.com/matrix-org/matrix-react-sdk/pull/9927)). Contributed by @florianduros.
 * Fix the problem that the password reset email has to be confirmed twice ([\#9926](https://github.com/matrix-org/matrix-react-sdk/pull/9926)). Fixes vector-im/element-web#24226.
 * replace .at() with array.length-1 ([\#9933](https://github.com/matrix-org/matrix-react-sdk/pull/9933)). Fixes matrix-org/element-web-rageshakes#19281.
 * Fix broken threads list timestamp layout ([\#9922](https://github.com/matrix-org/matrix-react-sdk/pull/9922)). Fixes vector-im/element-web#24243 and vector-im/element-web#24191. Contributed by @justjanne.
 * Disable multiple messages when {enter} is pressed multiple times ([\#9929](https://github.com/matrix-org/matrix-react-sdk/pull/9929)). Fixes vector-im/element-web#24249. Contributed by @florianduros.
 * Fix logout devices when resetting the password ([\#9925](https://github.com/matrix-org/matrix-react-sdk/pull/9925)). Fixes vector-im/element-web#24228.
 * Fix: Poll replies overflow when not enough space ([\#9924](https://github.com/matrix-org/matrix-react-sdk/pull/9924)). Fixes vector-im/element-web#24227. Contributed by @kerryarchibald.
 * State event updates are not forwarded to the widget from invitation room ([\#9802](https://github.com/matrix-org/matrix-react-sdk/pull/9802)). Contributed by @maheichyk.
 * Fix error when viewing source of redacted events ([\#9914](https://github.com/matrix-org/matrix-react-sdk/pull/9914)). Fixes vector-im/element-web#24165. Contributed by @clarkf.
 * Replace outdated css attribute ([\#9912](https://github.com/matrix-org/matrix-react-sdk/pull/9912)). Fixes vector-im/element-web#24218. Contributed by @justjanne.
 * Clear isLogin theme override when user is no longer viewing login screens ([\#9911](https://github.com/matrix-org/matrix-react-sdk/pull/9911)). Fixes vector-im/element-web#23893.
 * Fix reply action in message context menu notif & file panels ([\#9895](https://github.com/matrix-org/matrix-react-sdk/pull/9895)). Fixes vector-im/element-web#23970.
 * Fix issue where thread dropdown would not show up correctly ([\#9872](https://github.com/matrix-org/matrix-react-sdk/pull/9872)). Fixes vector-im/element-web#24040. Contributed by @justjanne.
 * Fix unexpected composer growing ([\#9889](https://github.com/matrix-org/matrix-react-sdk/pull/9889)). Contributed by @florianduros.
 * Fix misaligned timestamps for thread roots which are emotes ([\#9875](https://github.com/matrix-org/matrix-react-sdk/pull/9875)). Fixes vector-im/element-web#23897. Contributed by @justjanne.

Changes in [1.11.20](https://github.com/vector-im/element-desktop/releases/tag/v1.11.20) (2023-01-20)
=====================================================================================================

## 🐛 Bug Fixes
 * (no effect on Element Desktop) (Part 2) fix crash on browsers that don't support `Array.at`

Changes in [1.11.19](https://github.com/vector-im/element-desktop/releases/tag/v1.11.19) (2023-01-20)
=====================================================================================================

## 🐛 Bug Fixes
 * (no effect on Element Desktop) Fix crash on browsers that don't support `Array.at` ([\#9935](https://github.com/matrix-org/matrix-react-sdk/pull/9935)). Contributed by @andybalaam.

Changes in [1.11.18](https://github.com/vector-im/element-desktop/releases/tag/v1.11.18) (2023-01-18)
=====================================================================================================

## ✨ Features
 * Switch threads on for everyone ([\#9879](https://github.com/matrix-org/matrix-react-sdk/pull/9879)).
 * Make threads use new Unable to Decrypt UI ([\#9876](https://github.com/matrix-org/matrix-react-sdk/pull/9876)). Fixes vector-im/element-web#24060.
 * Add edit and remove actions to link in RTE ([\#9864](https://github.com/matrix-org/matrix-react-sdk/pull/9864)).
 * Remove extensible events v1 experimental rendering ([\#9881](https://github.com/matrix-org/matrix-react-sdk/pull/9881)).
 * Make create poll dialog scale better (PSG-929) ([\#9873](https://github.com/matrix-org/matrix-react-sdk/pull/9873)). Fixes vector-im/element-web#21855.
 * Change RTE mode icons ([\#9861](https://github.com/matrix-org/matrix-react-sdk/pull/9861)).
 * Device manager - prune client information events after remote sign out ([\#9874](https://github.com/matrix-org/matrix-react-sdk/pull/9874)).
 * Check connection before starting broadcast ([\#9857](https://github.com/matrix-org/matrix-react-sdk/pull/9857)).
 * Enable sent receipt for poll start events (PSG-962) ([\#9870](https://github.com/matrix-org/matrix-react-sdk/pull/9870)).
 * Change clear notifications to have more readable copy ([\#9867](https://github.com/matrix-org/matrix-react-sdk/pull/9867)).
 * Combine search results when the query is present in multiple successive messages ([\#9855](https://github.com/matrix-org/matrix-react-sdk/pull/9855)). Fixes vector-im/element-web#3977. Contributed by @grimhilt.
 * Disable bubbles for broadcasts ([\#9860](https://github.com/matrix-org/matrix-react-sdk/pull/9860)). Fixes vector-im/element-web#24140.
 * Enable reactions and replies for broadcasts ([\#9856](https://github.com/matrix-org/matrix-react-sdk/pull/9856)). Fixes vector-im/element-web#24042.
 * Improve switching between rich and plain editing modes ([\#9776](https://github.com/matrix-org/matrix-react-sdk/pull/9776)).
 * Redesign the picture-in-picture window ([\#9800](https://github.com/matrix-org/matrix-react-sdk/pull/9800)). Fixes vector-im/element-web#23980.
 * User on-boarding tasks now appear in a static order. ([\#9799](https://github.com/matrix-org/matrix-react-sdk/pull/9799)). Contributed by @GoodGuyMarco.
 * Device manager - contextual menus ([\#9832](https://github.com/matrix-org/matrix-react-sdk/pull/9832)).
 * If listening a non-live broadcast and changing the room, the broadcast will be paused ([\#9825](https://github.com/matrix-org/matrix-react-sdk/pull/9825)). Fixes vector-im/element-web#24078.
 * Consider own broadcasts from other device as a playback ([\#9821](https://github.com/matrix-org/matrix-react-sdk/pull/9821)). Fixes vector-im/element-web#24068.
 * Add link creation to rich text editor ([\#9775](https://github.com/matrix-org/matrix-react-sdk/pull/9775)).
 * Add mark as read option in room setting ([\#9798](https://github.com/matrix-org/matrix-react-sdk/pull/9798)). Fixes vector-im/element-web#24053.
 * Device manager - current device design and copy tweaks ([\#9801](https://github.com/matrix-org/matrix-react-sdk/pull/9801)).
 * Unify notifications panel event design ([\#9754](https://github.com/matrix-org/matrix-react-sdk/pull/9754)).
 * Add actions for integration manager to send and read certain events ([\#9740](https://github.com/matrix-org/matrix-react-sdk/pull/9740)).
 * Device manager - design tweaks ([\#9768](https://github.com/matrix-org/matrix-react-sdk/pull/9768)).
 * Change room list sorting to activity and unread first by default ([\#9773](https://github.com/matrix-org/matrix-react-sdk/pull/9773)). Fixes vector-im/element-web#24014.
 * Add a config flag to enable the rust crypto-sdk ([\#9759](https://github.com/matrix-org/matrix-react-sdk/pull/9759)).
 * Improve decryption error UI by consolidating error messages and providing instructions when possible ([\#9544](https://github.com/matrix-org/matrix-react-sdk/pull/9544)). Contributed by @duxovni.
 * Honor font settings in Element Call ([\#9751](https://github.com/matrix-org/matrix-react-sdk/pull/9751)). Fixes vector-im/element-web#23661.
 * Device manager - use deleteAccountData to prune device manager client information events ([\#9734](https://github.com/matrix-org/matrix-react-sdk/pull/9734)).

## 🐛 Bug Fixes
 * Display rooms & threads as unread (bold) if threads have unread messages. ([\#9763](https://github.com/matrix-org/matrix-react-sdk/pull/9763)). Fixes vector-im/element-web#23907.
 * Don't prefer STIXGeneral over the default font ([\#9711](https://github.com/matrix-org/matrix-react-sdk/pull/9711)). Fixes vector-im/element-web#23899.
 * Use the same avatar colour when creating 1:1 DM rooms ([\#9850](https://github.com/matrix-org/matrix-react-sdk/pull/9850)). Fixes vector-im/element-web#23476.
 * Fix space lock icon size ([\#9854](https://github.com/matrix-org/matrix-react-sdk/pull/9854)). Fixes vector-im/element-web#24128.
 * Make calls automatically disconnect if the widget disappears ([\#9862](https://github.com/matrix-org/matrix-react-sdk/pull/9862)). Fixes vector-im/element-web#23664.
 * Fix emoji in RTE editing ([\#9827](https://github.com/matrix-org/matrix-react-sdk/pull/9827)).
 * Fix export with attachments on formats txt and json ([\#9851](https://github.com/matrix-org/matrix-react-sdk/pull/9851)). Fixes vector-im/element-web#24130. Contributed by @grimhilt.
 * Fixed empty `Content-Type` for encrypted uploads ([\#9848](https://github.com/matrix-org/matrix-react-sdk/pull/9848)). Contributed by @K3das.
 * Fix sign-in instead link on password reset page ([\#9820](https://github.com/matrix-org/matrix-react-sdk/pull/9820)). Fixes vector-im/element-web#24087.
 * The seekbar now initially shows the current position ([\#9796](https://github.com/matrix-org/matrix-react-sdk/pull/9796)). Fixes vector-im/element-web#24051.
 * Fix: Editing a poll will silently change it to a closed poll ([\#9809](https://github.com/matrix-org/matrix-react-sdk/pull/9809)). Fixes vector-im/element-web#23176.
 * Make call tiles look less broken in the right panel ([\#9808](https://github.com/matrix-org/matrix-react-sdk/pull/9808)). Fixes vector-im/element-web#23716.
 * Prevent unnecessary m.direct updates ([\#9805](https://github.com/matrix-org/matrix-react-sdk/pull/9805)). Fixes vector-im/element-web#24059.
 * Fix checkForPreJoinUISI for thread roots ([\#9803](https://github.com/matrix-org/matrix-react-sdk/pull/9803)). Fixes vector-im/element-web#24054.
 * Snap in PiP widget when content changed ([\#9797](https://github.com/matrix-org/matrix-react-sdk/pull/9797)). Fixes vector-im/element-web#24050.
 * Load RTE components only when RTE labs is enabled ([\#9804](https://github.com/matrix-org/matrix-react-sdk/pull/9804)).
 * Ensure that events are correctly updated when they are edited. ([\#9789](https://github.com/matrix-org/matrix-react-sdk/pull/9789)).
 * When stopping a broadcast also stop the playback ([\#9795](https://github.com/matrix-org/matrix-react-sdk/pull/9795)). Fixes vector-im/element-web#24052.
 * Prevent to start two broadcasts at the same time ([\#9744](https://github.com/matrix-org/matrix-react-sdk/pull/9744)). Fixes vector-im/element-web#23973.
 * Correctly handle limited sync responses by resetting the thread timeline ([\#3056](https://github.com/matrix-org/matrix-js-sdk/pull/3056)). Fixes vector-im/element-web#23952.
 * Fix failure to start in firefox private browser ([\#3058](https://github.com/matrix-org/matrix-js-sdk/pull/3058)). Fixes vector-im/element-web#24216.

Changes in [1.11.17](https://github.com/vector-im/element-desktop/releases/tag/v1.11.17) (2022-12-21)
=====================================================================================================

## 🚨 BREAKING CHANGES
 * This allows the update server to be entirely static, such as a CDN or object store, as defined at https ([\#461](https://github.com/vector-im/element-desktop/pull/461)).

## ✨ Features
 * Enable threads by default ([\#9736](https://github.com/matrix-org/matrix-react-sdk/pull/9736)). Fixes vector-im/element-web#19270 vector-im/element-web#21910 and vector-im/element-web#23946.
 * Add inline code formatting to rich text editor ([\#9720](https://github.com/matrix-org/matrix-react-sdk/pull/9720)).
 * Add emoji handling for plain text mode of the new rich text editor ([\#9727](https://github.com/matrix-org/matrix-react-sdk/pull/9727)).
 * Overlay virtual room call events into main timeline ([\#9626](https://github.com/matrix-org/matrix-react-sdk/pull/9626)). Fixes vector-im/element-web#22929.
 * Adds a new section under "Room Settings" > "Roles & Permissions" which adds the possibility to multiselect users from this room and grant them more permissions. ([\#9596](https://github.com/matrix-org/matrix-react-sdk/pull/9596)). Contributed by @GoodGuyMarco.
 * Add emoji handling for rich text mode ([\#9661](https://github.com/matrix-org/matrix-react-sdk/pull/9661)).
 * Add setting to hide bold notifications ([\#9705](https://github.com/matrix-org/matrix-react-sdk/pull/9705)).
 * Further password reset flow enhancements ([\#9662](https://github.com/matrix-org/matrix-react-sdk/pull/9662)).
 * Snooze the bulk unverified sessions reminder on dismiss ([\#9706](https://github.com/matrix-org/matrix-react-sdk/pull/9706)).
 * Honor advanced audio processing settings when recording voice messages ([\#9610](https://github.com/matrix-org/matrix-react-sdk/pull/9610)). Contributed by @MrAnno.
 * Improve the visual balance of bubble layout ([\#9704](https://github.com/matrix-org/matrix-react-sdk/pull/9704)).
 * Add config setting to disable bulk unverified sessions nag ([\#9657](https://github.com/matrix-org/matrix-react-sdk/pull/9657)).
 * Only display bulk unverified sessions nag when current sessions is verified ([\#9656](https://github.com/matrix-org/matrix-react-sdk/pull/9656)).
 * Separate labs and betas more clearly ([\#8969](https://github.com/matrix-org/matrix-react-sdk/pull/8969)). Fixes vector-im/element-web#22706.
 * Show user an error if we fail to create a DM for verification. ([\#9624](https://github.com/matrix-org/matrix-react-sdk/pull/9624)).

## 🐛 Bug Fixes
 * Prevent unnecessary m.direct updates ([\#9805](https://github.com/matrix-org/matrix-react-sdk/pull/9805)). Fixes vector-im/element-web#24059.
 * Fix checkForPreJoinUISI for thread roots ([\#9803](https://github.com/matrix-org/matrix-react-sdk/pull/9803)). Fixes vector-im/element-web#24054.
 * Load RTE components only when RTE labs is enabled ([\#9804](https://github.com/matrix-org/matrix-react-sdk/pull/9804)).
 * Fix issue where thread panel did not update correctly ([\#9746](https://github.com/matrix-org/matrix-react-sdk/pull/9746)). Fixes vector-im/element-web#23971.
 * Remove async call to get virtual room from room load ([\#9743](https://github.com/matrix-org/matrix-react-sdk/pull/9743)). Fixes vector-im/element-web#23968.
 * Check each thread for unread messages. ([\#9723](https://github.com/matrix-org/matrix-react-sdk/pull/9723)).
 * Device manage - handle sessions that don't support encryption ([\#9717](https://github.com/matrix-org/matrix-react-sdk/pull/9717)). Fixes vector-im/element-web#23722.
 * Fix hover state for formatting buttons (Rich text editor) (fix vector-im/element-web/issues/23832) ([\#9715](https://github.com/matrix-org/matrix-react-sdk/pull/9715)).
 * Don't allow group calls to be unterminated ([\#9710](https://github.com/matrix-org/matrix-react-sdk/pull/9710)).
 * Fix replies to emotes not showing as inline ([\#9707](https://github.com/matrix-org/matrix-react-sdk/pull/9707)). Fixes vector-im/element-web#23903.
 * Update copy of 'Change layout' button to match Element Call ([\#9703](https://github.com/matrix-org/matrix-react-sdk/pull/9703)).
 * Fix call splitbrains when switching between rooms ([\#9692](https://github.com/matrix-org/matrix-react-sdk/pull/9692)).
 * bugfix: fix an issue where the Notifier would incorrectly fire for non-timeline events ([\#9664](https://github.com/matrix-org/matrix-react-sdk/pull/9664)). Fixes vector-im/element-web#17263.
 * Fix power selector being wrongly disabled for admins themselves ([\#9681](https://github.com/matrix-org/matrix-react-sdk/pull/9681)). Fixes vector-im/element-web#23882.
 * Show day counts in call durations ([\#9641](https://github.com/matrix-org/matrix-react-sdk/pull/9641)).

Changes in [1.11.16](https://github.com/vector-im/element-desktop/releases/tag/v1.11.16) (2022-12-06)
=====================================================================================================

## ✨ Features
 * Update to Electron 21 ([\#458](https://github.com/vector-im/element-desktop/pull/458)). Fixes vector-im/element-web#23783.
 * Further improve replies ([\#6396](https://github.com/matrix-org/matrix-react-sdk/pull/6396)). Fixes vector-im/element-web#19074, vector-im/element-web#18194 vector-im/element-web#18027 and vector-im/element-web#19179.
 * Enable users to join group calls from multiple devices ([\#9625](https://github.com/matrix-org/matrix-react-sdk/pull/9625)).
 * fix(visual): make cursor a pointer for summaries ([\#9419](https://github.com/matrix-org/matrix-react-sdk/pull/9419)). Contributed by @r00ster91.
 * Add placeholder for rich text editor ([\#9613](https://github.com/matrix-org/matrix-react-sdk/pull/9613)).
 * Consolidate public room search experience ([\#9605](https://github.com/matrix-org/matrix-react-sdk/pull/9605)). Fixes vector-im/element-web#22846.
 * New password reset flow ([\#9581](https://github.com/matrix-org/matrix-react-sdk/pull/9581)). Fixes vector-im/element-web#23131.
 * Device manager - add tooltip to device details toggle ([\#9594](https://github.com/matrix-org/matrix-react-sdk/pull/9594)).
 * sliding sync: add lazy-loading member support ([\#9530](https://github.com/matrix-org/matrix-react-sdk/pull/9530)).
 * Limit formatting bar offset to top of composer ([\#9365](https://github.com/matrix-org/matrix-react-sdk/pull/9365)). Fixes vector-im/element-web#12359. Contributed by @owi92.

## 🐛 Bug Fixes
 * Fix issues around up arrow event edit shortcut ([\#9645](https://github.com/matrix-org/matrix-react-sdk/pull/9645)). Fixes vector-im/element-web#18497 and vector-im/element-web#18964.
 * Fix search not being cleared when clicking on a result ([\#9635](https://github.com/matrix-org/matrix-react-sdk/pull/9635)). Fixes vector-im/element-web#23845.
 * Fix screensharing in 1:1 calls ([\#9612](https://github.com/matrix-org/matrix-react-sdk/pull/9612)). Fixes vector-im/element-web#23808.
 * Fix the background color flashing when joining a call ([\#9640](https://github.com/matrix-org/matrix-react-sdk/pull/9640)).
 * Fix the size of the 'Private space' icon ([\#9638](https://github.com/matrix-org/matrix-react-sdk/pull/9638)).
 * Fix reply editing in rich text editor (https ([\#9615](https://github.com/matrix-org/matrix-react-sdk/pull/9615)).
 * Fix thread list jumping back down while scrolling ([\#9606](https://github.com/matrix-org/matrix-react-sdk/pull/9606)). Fixes vector-im/element-web#23727.
 * Fix regression with TimelinePanel props updates not taking effect ([\#9608](https://github.com/matrix-org/matrix-react-sdk/pull/9608)). Fixes vector-im/element-web#23794.
 * Fix form tooltip positioning ([\#9598](https://github.com/matrix-org/matrix-react-sdk/pull/9598)). Fixes vector-im/element-web#22861.
 * Extract Search handling from RoomView into its own Component ([\#9574](https://github.com/matrix-org/matrix-react-sdk/pull/9574)). Fixes vector-im/element-web#498.
 * Fix call splitbrains when switching between rooms ([\#9692](https://github.com/matrix-org/matrix-react-sdk/pull/9692)).

Changes in [1.11.15](https://github.com/vector-im/element-desktop/releases/tag/v1.11.15) (2022-11-22)
=====================================================================================================

## ✨ Features
 * Switch to notarytool ([\#440](https://github.com/vector-im/element-desktop/pull/440)).
 * Make clear notifications work with threads ([\#9575](https://github.com/matrix-org/matrix-react-sdk/pull/9575)). Fixes vector-im/element-web#23751.
 * Change "None" to "Off" in notification options ([\#9539](https://github.com/matrix-org/matrix-react-sdk/pull/9539)). Contributed by @Arnei.
 * Advanced audio processing settings ([\#8759](https://github.com/matrix-org/matrix-react-sdk/pull/8759)). Fixes vector-im/element-web#6278. Contributed by @MrAnno.
 * Add way to create a user notice via config.json ([\#9559](https://github.com/matrix-org/matrix-react-sdk/pull/9559)).
 * Improve design of the rich text editor ([\#9533](https://github.com/matrix-org/matrix-react-sdk/pull/9533)).
 * Enable user to zoom beyond image size ([\#5949](https://github.com/matrix-org/matrix-react-sdk/pull/5949)). Contributed by @jaiwanth-v.
 * Fix: Move "Leave Space" option to the bottom of space context menu ([\#9535](https://github.com/matrix-org/matrix-react-sdk/pull/9535)). Contributed by @hanadi92.

## 🐛 Bug Fixes
 * Fix encrypted message search indexing for non-default `--profile` instances. ([\#433](https://github.com/vector-im/element-desktop/pull/433)).
 * Make build scripts work on NixOS ([\#23740](https://github.com/vector-im/element-web/pull/23740)).
 * Fix integration manager `get_open_id_token` action and add E2E tests ([\#9520](https://github.com/matrix-org/matrix-react-sdk/pull/9520)).
 * Fix links being mangled by markdown processing ([\#9570](https://github.com/matrix-org/matrix-react-sdk/pull/9570)). Fixes vector-im/element-web#23743.
 * Fix: inline links selecting radio button ([\#9543](https://github.com/matrix-org/matrix-react-sdk/pull/9543)). Contributed by @hanadi92.
 * fix wrong error message in registration when phone number threepid is in use. ([\#9571](https://github.com/matrix-org/matrix-react-sdk/pull/9571)). Contributed by @bagvand.
 * Fix missing avatar for show current profiles ([\#9563](https://github.com/matrix-org/matrix-react-sdk/pull/9563)). Fixes vector-im/element-web#23733.
 * fix read receipts trickling down correctly ([\#9567](https://github.com/matrix-org/matrix-react-sdk/pull/9567)). Fixes vector-im/element-web#23746.
 * Resilience fix for homeserver without thread notification support ([\#9565](https://github.com/matrix-org/matrix-react-sdk/pull/9565)).
 * Don't switch to the home page needlessly after leaving a room ([\#9477](https://github.com/matrix-org/matrix-react-sdk/pull/9477)).
 * Differentiate download and decryption errors when showing images ([\#9562](https://github.com/matrix-org/matrix-react-sdk/pull/9562)). Fixes vector-im/element-web#3892.
 * Close context menu when a modal is opened to prevent user getting stuck ([\#9560](https://github.com/matrix-org/matrix-react-sdk/pull/9560)). Fixes vector-im/element-web#15610 and vector-im/element-web#10781.
 * Fix TimelineReset handling when no room associated ([\#9553](https://github.com/matrix-org/matrix-react-sdk/pull/9553)).
 * Always use current profile on thread events ([\#9524](https://github.com/matrix-org/matrix-react-sdk/pull/9524)). Fixes vector-im/element-web#23648.
 * Fix `ThreadView` tests not using thread flag ([\#9547](https://github.com/matrix-org/matrix-react-sdk/pull/9547)).
 * Fix regressions around media uploads failing and causing soft crashes ([\#9549](https://github.com/matrix-org/matrix-react-sdk/pull/9549)). Fixes matrix-org/element-web-rageshakes#16831, matrix-org/element-web-rageshakes#16824 matrix-org/element-web-rageshakes#16810 and vector-im/element-web#23641.
 * Handle deletion of `m.call` events ([\#9540](https://github.com/matrix-org/matrix-react-sdk/pull/9540)). Fixes vector-im/element-web#23663.
 * Fix /myroomavatar slash command ([\#9536](https://github.com/matrix-org/matrix-react-sdk/pull/9536)). Fixes matrix-org/synapse#14321.
 * Fix incorrect notification count after leaving a room with notifications ([\#9518](https://github.com/matrix-org/matrix-react-sdk/pull/9518)). Contributed by @Arnei.

Changes in [1.11.14](https://github.com/vector-im/element-desktop/releases/tag/v1.11.14) (2022-11-08)
=====================================================================================================

## ✨ Features
 * Switch to notarytool ([\#440](https://github.com/vector-im/element-desktop/pull/440)).
 * Loading threads with server-side assistance ([\#9356](https://github.com/matrix-org/matrix-react-sdk/pull/9356)). Fixes vector-im/element-web#21807, vector-im/element-web#21799, vector-im/element-web#21911, vector-im/element-web#22141, vector-im/element-web#22157, vector-im/element-web#22641, vector-im/element-web#22501 vector-im/element-web#22438 and vector-im/element-web#21678. Contributed by @justjanne.
 * Make thread replies trigger a room list re-ordering ([\#9510](https://github.com/matrix-org/matrix-react-sdk/pull/9510)). Fixes vector-im/element-web#21700.
 * Device manager - add extra details to device security and renaming ([\#9501](https://github.com/matrix-org/matrix-react-sdk/pull/9501)). Contributed by @kerryarchibald.
 * Add plain text mode to the wysiwyg composer ([\#9503](https://github.com/matrix-org/matrix-react-sdk/pull/9503)). Contributed by @florianduros.
 * Sliding Sync: improve sort order, show subspace rooms, better tombstoned room handling ([\#9484](https://github.com/matrix-org/matrix-react-sdk/pull/9484)).
 * Device manager - add learn more popups to filtered sessions section ([\#9497](https://github.com/matrix-org/matrix-react-sdk/pull/9497)). Contributed by @kerryarchibald.
 * Show thread notification if thread timeline is closed ([\#9495](https://github.com/matrix-org/matrix-react-sdk/pull/9495)). Fixes vector-im/element-web#23589.
 * Add message editing to wysiwyg composer ([\#9488](https://github.com/matrix-org/matrix-react-sdk/pull/9488)). Contributed by @florianduros.
 * Device manager - confirm sign out of other sessions ([\#9487](https://github.com/matrix-org/matrix-react-sdk/pull/9487)). Contributed by @kerryarchibald.
 * Automatically request logs from other users in a call when submitting logs ([\#9492](https://github.com/matrix-org/matrix-react-sdk/pull/9492)).
 * Add thread notification with server assistance (MSC3773) ([\#9400](https://github.com/matrix-org/matrix-react-sdk/pull/9400)). Fixes vector-im/element-web#21114, vector-im/element-web#21413, vector-im/element-web#21416, vector-im/element-web#21433, vector-im/element-web#21481, vector-im/element-web#21798, vector-im/element-web#21823 vector-im/element-web#23192 and vector-im/element-web#21765.
 * Support for login + E2EE set up with QR ([\#9403](https://github.com/matrix-org/matrix-react-sdk/pull/9403)). Contributed by @hughns.
 * Allow pressing Enter to send messages in new composer ([\#9451](https://github.com/matrix-org/matrix-react-sdk/pull/9451)). Contributed by @andybalaam.

## 🐛 Bug Fixes
 * Fix regressions around media uploads failing and causing soft crashes ([\#9549](https://github.com/matrix-org/matrix-react-sdk/pull/9549)). Fixes matrix-org/element-web-rageshakes#16831, matrix-org/element-web-rageshakes#16824 matrix-org/element-web-rageshakes#16810 and vector-im/element-web#23641.
 * Fix /myroomavatar slash command ([\#9536](https://github.com/matrix-org/matrix-react-sdk/pull/9536)). Fixes matrix-org/synapse#14321.
 * Fix i18n interpolation ([\#432](https://github.com/vector-im/element-desktop/pull/432)). Fixes vector-im/element-web#23568.
 * Fix config.json failing to load for Jitsi wrapper in non-root deployment ([\#23577](https://github.com/vector-im/element-web/pull/23577)).
 * Fix NotificationBadge unsent color ([\#9522](https://github.com/matrix-org/matrix-react-sdk/pull/9522)). Fixes vector-im/element-web#23646.
 * Fix room list sorted by recent on app startup ([\#9515](https://github.com/matrix-org/matrix-react-sdk/pull/9515)). Fixes vector-im/element-web#23635.
 * Reset custom power selector when blurred on empty ([\#9508](https://github.com/matrix-org/matrix-react-sdk/pull/9508)). Fixes vector-im/element-web#23481.
 * Reinstate timeline/redaction callbacks when updating notification state ([\#9494](https://github.com/matrix-org/matrix-react-sdk/pull/9494)). Fixes vector-im/element-web#23554.
 * Only render NotificationBadge when needed ([\#9493](https://github.com/matrix-org/matrix-react-sdk/pull/9493)). Fixes vector-im/element-web#23584.
 * Fix embedded Element Call screen sharing ([\#9485](https://github.com/matrix-org/matrix-react-sdk/pull/9485)). Fixes vector-im/element-web#23571.
 * Send Content-Type: application/json header for integration manager /register API ([\#9490](https://github.com/matrix-org/matrix-react-sdk/pull/9490)). Fixes vector-im/element-web#23580.
 * Fix joining calls without audio or video inputs ([\#9486](https://github.com/matrix-org/matrix-react-sdk/pull/9486)). Fixes vector-im/element-web#23511.
 * Ensure spaces in the spotlight dialog have rounded square avatars ([\#9480](https://github.com/matrix-org/matrix-react-sdk/pull/9480)). Fixes vector-im/element-web#23515.
 * Only show mini avatar uploader in room intro when no avatar yet exists ([\#9479](https://github.com/matrix-org/matrix-react-sdk/pull/9479)). Fixes vector-im/element-web#23552.
 * Fix threads fallback incorrectly targets root event ([\#9229](https://github.com/matrix-org/matrix-react-sdk/pull/9229)). Fixes vector-im/element-web#23147.
 * Align video call icon with banner text ([\#9460](https://github.com/matrix-org/matrix-react-sdk/pull/9460)).
 * Set relations helper when creating event tile context menu ([\#9253](https://github.com/matrix-org/matrix-react-sdk/pull/9253)). Fixes vector-im/element-web#22018.
 * Device manager - put client/browser device metadata in correct section ([\#9447](https://github.com/matrix-org/matrix-react-sdk/pull/9447)). Contributed by @kerryarchibald.
 * Update the room unread notification counter when the server changes the value without any related read receipt ([\#9438](https://github.com/matrix-org/matrix-react-sdk/pull/9438)).

Changes in [1.11.13](https://github.com/vector-im/element-desktop/releases/tag/v1.11.13) (2022-11-01)
=====================================================================================================

## 🐛 Bug Fixes
 * Fix default behavior of Room.getBlacklistUnverifiedDevices ([\#2830](https://github.com/matrix-org/matrix-js-sdk/pull/2830)). Contributed by @duxovni.
 * Catch server versions API call exception when starting the client ([\#2828](https://github.com/matrix-org/matrix-js-sdk/pull/2828)). Fixes vector-im/element-web#23634.
 * Fix authedRequest including `Authorization: Bearer undefined` for password resets ([\#2822](https://github.com/matrix-org/matrix-js-sdk/pull/2822)). Fixes vector-im/element-web#23655.

Changes in [1.11.12](https://github.com/vector-im/element-desktop/releases/tag/v1.11.12) (2022-10-26)
=====================================================================================================

## 🐛 Bug Fixes
 * Fix config.json failing to load for Jitsi wrapper in non-root deployment ([\#23577](https://github.com/vector-im/element-web/pull/23577)).

Changes in [1.11.11](https://github.com/vector-im/element-desktop/releases/tag/v1.11.11) (2022-10-25)
=====================================================================================================

## ✨ Features
 * Device manager - tweak string formatting of default device name ([\#23457](https://github.com/vector-im/element-web/pull/23457)).
 * Add Element Call participant limit ([\#23431](https://github.com/vector-im/element-web/pull/23431)).
 * Add Element Call `brand` ([\#23443](https://github.com/vector-im/element-web/pull/23443)).
 * Include a file-safe room name and ISO date in chat exports ([\#9440](https://github.com/matrix-org/matrix-react-sdk/pull/9440)). Fixes vector-im/element-web#21812 and vector-im/element-web#19724.
 * Room call banner ([\#9378](https://github.com/matrix-org/matrix-react-sdk/pull/9378)). Fixes vector-im/element-web#23453. Contributed by @toger5.
 * Device manager - spinners while devices are signing out ([\#9433](https://github.com/matrix-org/matrix-react-sdk/pull/9433)). Fixes vector-im/element-web#15865.
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
 * Delete the remainder of groups ([\#9357](https://github.com/matrix-org/matrix-react-sdk/pull/9357)). Fixes vector-im/element-web#22770.
 * Device manager - display client information in device details ([\#9315](https://github.com/matrix-org/matrix-react-sdk/pull/9315)).

## 🐛 Bug Fixes
 * Send Content-Type: application/json header for integration manager /register API ([\#9490](https://github.com/matrix-org/matrix-react-sdk/pull/9490)). Fixes vector-im/element-web#23580.
 * Make ErrorView & CompatibilityView scrollable ([\#23468](https://github.com/vector-im/element-web/pull/23468)). Fixes vector-im/element-web#23376.
 * Device manager - put client/browser device metadata in correct section ([\#9447](https://github.com/matrix-org/matrix-react-sdk/pull/9447)).
 * update the room unread notification counter when the server changes the value without any related read receipt ([\#9438](https://github.com/matrix-org/matrix-react-sdk/pull/9438)).
 * Don't show call banners in video rooms ([\#9441](https://github.com/matrix-org/matrix-react-sdk/pull/9441)).
 * Prevent useContextMenu isOpen from being true if the button ref goes away ([\#9418](https://github.com/matrix-org/matrix-react-sdk/pull/9418)). Fixes matrix-org/element-web-rageshakes#15637.
 * Automatically focus the WYSIWYG composer when you enter a room ([\#9412](https://github.com/matrix-org/matrix-react-sdk/pull/9412)).
 * Improve the tooltips on the call lobby join button ([\#9428](https://github.com/matrix-org/matrix-react-sdk/pull/9428)).
 * Pass the homeserver's base URL to Element Call ([\#9429](https://github.com/matrix-org/matrix-react-sdk/pull/9429)). Fixes vector-im/element-web#23301.
 * Better accommodate long room names in call toasts ([\#9426](https://github.com/matrix-org/matrix-react-sdk/pull/9426)).
 * Hide virtual widgets from the room info panel ([\#9424](https://github.com/matrix-org/matrix-react-sdk/pull/9424)). Fixes vector-im/element-web#23494.
 * Inhibit clicking on sender avatar in threads list ([\#9417](https://github.com/matrix-org/matrix-react-sdk/pull/9417)). Fixes vector-im/element-web#23482.
 * Correct the dir parameter of MSC3715 ([\#9391](https://github.com/matrix-org/matrix-react-sdk/pull/9391)). Contributed by @dhenneke.
 * Use a more correct subset of users in `/remakeolm` developer command ([\#9402](https://github.com/matrix-org/matrix-react-sdk/pull/9402)).
 * use correct default for notification silencing ([\#9388](https://github.com/matrix-org/matrix-react-sdk/pull/9388)). Fixes vector-im/element-web#23456.
 * Device manager - eagerly create `m.local_notification_settings` events ([\#9353](https://github.com/matrix-org/matrix-react-sdk/pull/9353)).
 * Close incoming Element call toast when viewing the call lobby ([\#9375](https://github.com/matrix-org/matrix-react-sdk/pull/9375)).
 * Always allow enabling sending read receipts ([\#9367](https://github.com/matrix-org/matrix-react-sdk/pull/9367)). Fixes vector-im/element-web#23433.
 * Fixes (vector-im/element-web/issues/22609) where the white theme is not applied when `white -> dark -> white` sequence is done. ([\#9320](https://github.com/matrix-org/matrix-react-sdk/pull/9320)). Contributed by @florianduros.
 * Fix applying programmatically set height for "top" room layout ([\#9339](https://github.com/matrix-org/matrix-react-sdk/pull/9339)). Contributed by @Fox32.

Changes in [1.11.10](https://github.com/vector-im/element-desktop/releases/tag/v1.11.10) (2022-10-11)
=====================================================================================================

## 🐛 Bug Fixes
 * Use correct default for notification silencing ([\#9388](https://github.com/matrix-org/matrix-react-sdk/pull/9388)). Fixes vector-im/element-web#23456.

Changes in [1.11.9](https://github.com/vector-im/element-desktop/releases/tag/v1.11.9) (2022-10-11)
===================================================================================================

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
 * Read receipts for threads ([\#9239](https://github.com/matrix-org/matrix-react-sdk/pull/9239)). Fixes vector-im/element-web#23191.

## 🐛 Bug Fixes
 * Use the correct sender key when checking shared secret ([\#2730](https://github.com/matrix-org/matrix-js-sdk/pull/2730)). Fixes vector-im/element-web#23374.
 * Fix device selection in pre-join screen for Element Call video rooms ([\#9321](https://github.com/matrix-org/matrix-react-sdk/pull/9321)). Fixes vector-im/element-web#23331.
 * Don't render a 1px high room topic if the room topic is empty ([\#9317](https://github.com/matrix-org/matrix-react-sdk/pull/9317)). Contributed by @Arnei.
 * Don't show feedback prompts when that UIFeature is disabled ([\#9305](https://github.com/matrix-org/matrix-react-sdk/pull/9305)). Fixes vector-im/element-web#23327.
 * Fix soft crash around unknown room pills ([\#9301](https://github.com/matrix-org/matrix-react-sdk/pull/9301)). Fixes matrix-org/element-web-rageshakes#15465.
 * Fix spaces feedback prompt wrongly showing when feedback is disabled ([\#9302](https://github.com/matrix-org/matrix-react-sdk/pull/9302)). Fixes vector-im/element-web#23314.
 * Fix tile soft crash in ReplyInThreadButton ([\#9300](https://github.com/matrix-org/matrix-react-sdk/pull/9300)). Fixes matrix-org/element-web-rageshakes#15493.

Changes in [1.11.8](https://github.com/vector-im/element-desktop/releases/tag/v1.11.8) (2022-09-28)
===================================================================================================

## 🐛 Bug Fixes
 * Bump IDB crypto store version ([\#2705](https://github.com/matrix-org/matrix-js-sdk/pull/2705)).

Changes in [1.11.7](https://github.com/vector-im/element-desktop/releases/tag/v1.11.7) (2022-09-28)
===================================================================================================

## 🔒 Security
* Fix for [CVE-2022-39249](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39249)
* Fix for [CVE-2022-39250](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39250)
* Fix for [CVE-2022-39251](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39251)
* Fix for [CVE-2022-39236](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D39236)

Changes in [1.11.6](https://github.com/vector-im/element-desktop/releases/tag/v1.11.6) (2022-09-20)
=============================================================================================================

## ✨ Features
 * Element Call video rooms ([\#9267](https://github.com/matrix-org/matrix-react-sdk/pull/9267)).
 * Device manager - rename session ([\#9282](https://github.com/matrix-org/matrix-react-sdk/pull/9282)).
 * Allow widgets to read related events ([\#9210](https://github.com/matrix-org/matrix-react-sdk/pull/9210)). Contributed by @dhenneke.
 * Device manager - logout of other session ([\#9280](https://github.com/matrix-org/matrix-react-sdk/pull/9280)).
 * Device manager - logout current session ([\#9275](https://github.com/matrix-org/matrix-react-sdk/pull/9275)).
 * Device manager - verify other devices ([\#9274](https://github.com/matrix-org/matrix-react-sdk/pull/9274)).
 * Allow integration managers to remove users ([\#9211](https://github.com/matrix-org/matrix-react-sdk/pull/9211)).
 * Device manager - add verify current session button ([\#9252](https://github.com/matrix-org/matrix-react-sdk/pull/9252)).
 * Add NotifPanel dot back. ([\#9242](https://github.com/matrix-org/matrix-react-sdk/pull/9242)). Fixes vector-im/element-web#17641.
 * Implement MSC3575: Sliding Sync ([\#8328](https://github.com/matrix-org/matrix-react-sdk/pull/8328)).
 * Add the clipboard read permission for widgets ([\#9250](https://github.com/matrix-org/matrix-react-sdk/pull/9250)). Contributed by @stefanmuhle.

## 🐛 Bug Fixes
 * Make autocomplete pop-up wider in thread view ([\#9289](https://github.com/matrix-org/matrix-react-sdk/pull/9289)).
 * Fix soft crash around inviting invalid MXIDs in start DM on first message flow ([\#9281](https://github.com/matrix-org/matrix-react-sdk/pull/9281)). Fixes matrix-org/element-web-rageshakes#15060 and matrix-org/element-web-rageshakes#15140.
 * Fix in-reply-to previews not disappearing when swapping rooms ([\#9278](https://github.com/matrix-org/matrix-react-sdk/pull/9278)).
 * Fix invalid instanceof operand window.OffscreenCanvas ([\#9276](https://github.com/matrix-org/matrix-react-sdk/pull/9276)). Fixes vector-im/element-web#23275.
 * Fix memory leak caused by unremoved listener ([\#9273](https://github.com/matrix-org/matrix-react-sdk/pull/9273)).
 * Fix thumbnail generation when offscreen canvas fails ([\#9272](https://github.com/matrix-org/matrix-react-sdk/pull/9272)). Fixes vector-im/element-web#23265.
 * Prevent sliding sync from showing a room under multiple sublists ([\#9266](https://github.com/matrix-org/matrix-react-sdk/pull/9266)).
 * Fix tile crash around tooltipify links ([\#9270](https://github.com/matrix-org/matrix-react-sdk/pull/9270)). Fixes vector-im/element-web#23253.
 * Device manager - filter out nulled metadatas in device tile properly ([\#9251](https://github.com/matrix-org/matrix-react-sdk/pull/9251)).
 * Fix a sliding sync bug which could cause rooms to loop ([\#9268](https://github.com/matrix-org/matrix-react-sdk/pull/9268)).
 * Remove the grey gradient on images in bubbles in the timeline ([\#9241](https://github.com/matrix-org/matrix-react-sdk/pull/9241)). Fixes vector-im/element-web#21651.
 * Fix html export not including images ([\#9260](https://github.com/matrix-org/matrix-react-sdk/pull/9260)). Fixes vector-im/element-web#22059.
 * Fix possible soft crash from a race condition in space hierarchies ([\#9254](https://github.com/matrix-org/matrix-react-sdk/pull/9254)). Fixes matrix-org/element-web-rageshakes#15225.
 * Disable all types of autocorrect, -complete, -capitalize, etc on Spotlight's search field ([\#9259](https://github.com/matrix-org/matrix-react-sdk/pull/9259)).
 * Handle M_INVALID_USERNAME on /register/available ([\#9237](https://github.com/matrix-org/matrix-react-sdk/pull/9237)). Fixes vector-im/element-web#23161.
 * Fix issue with quiet zone around QR code ([\#9243](https://github.com/matrix-org/matrix-react-sdk/pull/9243)). Fixes vector-im/element-web#23199.

Changes in [1.11.5](https://github.com/vector-im/element-desktop/releases/tag/v1.11.5) (2022-09-13)
===================================================================================================

## ✨ Features
 * Device manager - hide unverified security recommendation when only current session is unverified ([\#9228](https://github.com/matrix-org/matrix-react-sdk/pull/9228)). Contributed by @kerryarchibald.
 * Device manager - scroll to filtered list from security recommendations ([\#9227](https://github.com/matrix-org/matrix-react-sdk/pull/9227)). Contributed by @kerryarchibald.
 * Device manager - updated dropdown style in filtered device list ([\#9226](https://github.com/matrix-org/matrix-react-sdk/pull/9226)). Contributed by @kerryarchibald.
 * Device manager - device type and verification icons on device tile ([\#9197](https://github.com/matrix-org/matrix-react-sdk/pull/9197)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Description of DM room with more than two other people is now being displayed correctly ([\#9231](https://github.com/matrix-org/matrix-react-sdk/pull/9231)). Fixes vector-im/element-web#23094.
 * Fix voice messages with multiple composers ([\#9208](https://github.com/matrix-org/matrix-react-sdk/pull/9208)). Fixes vector-im/element-web#23023. Contributed by @grimhilt.
 * Fix suggested rooms going missing ([\#9236](https://github.com/matrix-org/matrix-react-sdk/pull/9236)). Fixes vector-im/element-web#23190.
 * Fix tooltip infinitely recursing ([\#9235](https://github.com/matrix-org/matrix-react-sdk/pull/9235)). Fixes matrix-org/element-web-rageshakes#15107, matrix-org/element-web-rageshakes#15093 matrix-org/element-web-rageshakes#15092 and matrix-org/element-web-rageshakes#15077.
 * Fix plain text export saving ([\#9230](https://github.com/matrix-org/matrix-react-sdk/pull/9230)). Contributed by @jryans.
 * Add missing space in SecurityRoomSettingsTab ([\#9222](https://github.com/matrix-org/matrix-react-sdk/pull/9222)). Contributed by @gefgu.
 * Make use of js-sdk roomNameGenerator to handle i18n for generated room names ([\#9209](https://github.com/matrix-org/matrix-react-sdk/pull/9209)). Fixes vector-im/element-web#21369.
 * Fix progress bar regression throughout the app ([\#9219](https://github.com/matrix-org/matrix-react-sdk/pull/9219)). Fixes vector-im/element-web#23121.
 * Reuse empty string & space string logic for event types in devtools ([\#9218](https://github.com/matrix-org/matrix-react-sdk/pull/9218)). Fixes vector-im/element-web#23115.

Changes in [1.11.4](https://github.com/vector-im/element-desktop/releases/tag/v1.11.4) (2022-08-31)
===================================================================================================

## 🔒 Security
* Fixes for [CVE-2022-36059](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D36059) and [CVE-2022-36060](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE%2D2022%2D36060)

Learn more about what we've been up to at https://element.io/blog/element-web-desktop-1-11-4-a-security-update-deferred-dms-and-more/
Find more details of the vulnerabilities at https://matrix.org/blog/2022/08/31/security-releases-matrix-js-sdk-19-4-0-and-matrix-react-sdk-3-53-0

## ✨ Features
 * Upgrade to Electron 20 ([\#403](https://github.com/vector-im/element-desktop/pull/403)).
 * Device manager - scroll to filtered list from security recommendations ([\#9227](https://github.com/matrix-org/matrix-react-sdk/pull/9227)). Contributed by @kerryarchibald.
 * Device manager - updated dropdown style in filtered device list ([\#9226](https://github.com/matrix-org/matrix-react-sdk/pull/9226)). Contributed by @kerryarchibald.
 * Device manager - device type and verification icons on device tile ([\#9197](https://github.com/matrix-org/matrix-react-sdk/pull/9197)). Contributed by @kerryarchibald.
 * Ignore unreads in low priority rooms in the space panel ([\#6518](https://github.com/matrix-org/matrix-react-sdk/pull/6518)). Fixes vector-im/element-web#16836.
 * Release message right-click context menu out of labs ([\#8613](https://github.com/matrix-org/matrix-react-sdk/pull/8613)).
 * Device manager - expandable session details in device list ([\#9188](https://github.com/matrix-org/matrix-react-sdk/pull/9188)). Contributed by @kerryarchibald.
 * Device manager - device list filtering ([\#9181](https://github.com/matrix-org/matrix-react-sdk/pull/9181)). Contributed by @kerryarchibald.
 * Device manager - add verification details to session details ([\#9187](https://github.com/matrix-org/matrix-react-sdk/pull/9187)). Contributed by @kerryarchibald.
 * Device manager - current session expandable details ([\#9185](https://github.com/matrix-org/matrix-react-sdk/pull/9185)). Contributed by @kerryarchibald.
 * Device manager - security recommendations section ([\#9179](https://github.com/matrix-org/matrix-react-sdk/pull/9179)). Contributed by @kerryarchibald.
 * The Welcome Home Screen: Return Button ([\#9089](https://github.com/matrix-org/matrix-react-sdk/pull/9089)). Fixes vector-im/element-web#22917. Contributed by @justjanne.
 * Device manager - label devices as inactive ([\#9175](https://github.com/matrix-org/matrix-react-sdk/pull/9175)). Contributed by @kerryarchibald.
 * Device manager - other sessions list ([\#9155](https://github.com/matrix-org/matrix-react-sdk/pull/9155)). Contributed by @kerryarchibald.
 * Implement MSC3846: Allowing widgets to access TURN servers ([\#9061](https://github.com/matrix-org/matrix-react-sdk/pull/9061)).
 * Allow widgets to send/receive to-device messages ([\#8885](https://github.com/matrix-org/matrix-react-sdk/pull/8885)).

## 🐛 Bug Fixes
 * Add super cool feature ([\#9222](https://github.com/matrix-org/matrix-react-sdk/pull/9222)). Contributed by @gefgu.
 * Make use of js-sdk roomNameGenerator to handle i18n for generated room names ([\#9209](https://github.com/matrix-org/matrix-react-sdk/pull/9209)). Fixes vector-im/element-web#21369.
 * Fix progress bar regression throughout the app ([\#9219](https://github.com/matrix-org/matrix-react-sdk/pull/9219)). Fixes vector-im/element-web#23121.
 * Reuse empty string & space string logic for event types in devtools ([\#9218](https://github.com/matrix-org/matrix-react-sdk/pull/9218)). Fixes vector-im/element-web#23115.
 * Reduce amount of requests done by the onboarding task list ([\#9194](https://github.com/matrix-org/matrix-react-sdk/pull/9194)). Fixes vector-im/element-web#23085. Contributed by @justjanne.
 * Avoid hardcoding branding in user onboarding ([\#9206](https://github.com/matrix-org/matrix-react-sdk/pull/9206)). Fixes vector-im/element-web#23111. Contributed by @justjanne.
 * End jitsi call when member is banned ([\#8879](https://github.com/matrix-org/matrix-react-sdk/pull/8879)). Contributed by @maheichyk.
 * Fix context menu being opened when clicking message action bar buttons ([\#9200](https://github.com/matrix-org/matrix-react-sdk/pull/9200)). Fixes vector-im/element-web#22279 and vector-im/element-web#23100.
 * Add gap between checkbox and text in report dialog following the same pattern (8px) used in the gap between the two buttons. It fixes vector-im/element-web#23060 ([\#9195](https://github.com/matrix-org/matrix-react-sdk/pull/9195)). Contributed by @gefgu.
 * Fix url preview AXE and layout issue & add percy test ([\#9189](https://github.com/matrix-org/matrix-react-sdk/pull/9189)). Fixes vector-im/element-web#23083.
 * Wrap long space names ([\#9201](https://github.com/matrix-org/matrix-react-sdk/pull/9201)). Fixes vector-im/element-web#23095.
 * Attempt to fix `Failed to execute 'removeChild' on 'Node'` ([\#9196](https://github.com/matrix-org/matrix-react-sdk/pull/9196)).
 * Fix soft crash around space hierarchy changing between spaces ([\#9191](https://github.com/matrix-org/matrix-react-sdk/pull/9191)). Fixes matrix-org/element-web-rageshakes#14613.
 * Fix soft crash around room view store metrics ([\#9190](https://github.com/matrix-org/matrix-react-sdk/pull/9190)). Fixes matrix-org/element-web-rageshakes#14361.
 * Fix the same person appearing multiple times when searching for them. ([\#9177](https://github.com/matrix-org/matrix-react-sdk/pull/9177)). Fixes vector-im/element-web#22851.
 * Fix space panel subspace indentation going missing ([\#9167](https://github.com/matrix-org/matrix-react-sdk/pull/9167)). Fixes vector-im/element-web#23049.
 * Fix invisible power levels tile when showing hidden events ([\#9162](https://github.com/matrix-org/matrix-react-sdk/pull/9162)). Fixes vector-im/element-web#23013.
 * Space panel accessibility improvements ([\#9157](https://github.com/matrix-org/matrix-react-sdk/pull/9157)). Fixes vector-im/element-web#22995.
 * Fix inverted logic for showing UserWelcomeTop component ([\#9164](https://github.com/matrix-org/matrix-react-sdk/pull/9164)). Fixes vector-im/element-web#23037.

Changes in [1.11.3](https://github.com/vector-im/element-desktop/releases/tag/v1.11.3) (2022-08-16)
===================================================================================================

## ✨ Features
 * Improve auth aria attributes and semantics ([\#22948](https://github.com/vector-im/element-web/pull/22948)).
 * Device manager - New device tile info design ([\#9122](https://github.com/matrix-org/matrix-react-sdk/pull/9122)). Contributed by @kerryarchibald.
 * Device manager generic settings subsection component ([\#9147](https://github.com/matrix-org/matrix-react-sdk/pull/9147)). Contributed by @kerryarchibald.
 * Migrate the hidden read receipts flag to new "send read receipts" option ([\#9141](https://github.com/matrix-org/matrix-react-sdk/pull/9141)).
 * Live location sharing - share location at most every 5 seconds ([\#9148](https://github.com/matrix-org/matrix-react-sdk/pull/9148)). Contributed by @kerryarchibald.
 * Increase max length of voice messages to 15m ([\#9133](https://github.com/matrix-org/matrix-react-sdk/pull/9133)). Fixes vector-im/element-web#18620.
 * Move pin drop out of labs ([\#9135](https://github.com/matrix-org/matrix-react-sdk/pull/9135)).
 * Start DM on first message ([\#8612](https://github.com/matrix-org/matrix-react-sdk/pull/8612)). Fixes vector-im/element-web#14736.
 * Remove "Add Space" button from RoomListHeader when user cannot create spaces ([\#9129](https://github.com/matrix-org/matrix-react-sdk/pull/9129)).
 * The Welcome Home Screen: Dedicated Download Apps Dialog ([\#9120](https://github.com/matrix-org/matrix-react-sdk/pull/9120)). Fixes vector-im/element-web#22921. Contributed by @justjanne.
 * The Welcome Home Screen: "Submit Feedback" pane ([\#9090](https://github.com/matrix-org/matrix-react-sdk/pull/9090)). Fixes vector-im/element-web#22918. Contributed by @justjanne.
 * New User Onboarding Task List ([\#9083](https://github.com/matrix-org/matrix-react-sdk/pull/9083)). Fixes vector-im/element-web#22919. Contributed by @justjanne.
 * Add support for disabling spell checking ([\#8604](https://github.com/matrix-org/matrix-react-sdk/pull/8604)). Fixes vector-im/element-web#21901.
 * Live location share - leave maximised map open when beacons expire ([\#9098](https://github.com/matrix-org/matrix-react-sdk/pull/9098)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Some slash-commands (`/myroomnick`) have temporarily been disabled before the first message in a DM is sent. ([\#9193](https://github.com/matrix-org/matrix-react-sdk/pull/9193)).
 * Use stable reference for active tab in tabbedView ([\#9145](https://github.com/matrix-org/matrix-react-sdk/pull/9145)). Contributed by @kerryarchibald.
 * Fix pillification sometimes doubling up ([\#9152](https://github.com/matrix-org/matrix-react-sdk/pull/9152)). Fixes vector-im/element-web#23036.
 * Fix composer padding ([\#9137](https://github.com/matrix-org/matrix-react-sdk/pull/9137)). Fixes vector-im/element-web#22992.
 * Fix highlights not being applied to plaintext messages ([\#9126](https://github.com/matrix-org/matrix-react-sdk/pull/9126)). Fixes vector-im/element-web#22787.
 * Fix dismissing edit composer when change was undone ([\#9109](https://github.com/matrix-org/matrix-react-sdk/pull/9109)). Fixes vector-im/element-web#22932.
 * 1-to-1 DM rooms with bots now act like DM rooms instead of multi-user-rooms before ([\#9124](https://github.com/matrix-org/matrix-react-sdk/pull/9124)). Fixes vector-im/element-web#22894.
 * Apply inline start padding to selected lines on modern layout only ([\#9006](https://github.com/matrix-org/matrix-react-sdk/pull/9006)). Fixes vector-im/element-web#22768. Contributed by @luixxiul.
 * Peek into world-readable rooms from spotlight ([\#9115](https://github.com/matrix-org/matrix-react-sdk/pull/9115)). Fixes vector-im/element-web#22862.
 * Use default styling on nested numbered lists due to MD being sensitive ([\#9110](https://github.com/matrix-org/matrix-react-sdk/pull/9110)). Fixes vector-im/element-web#22935.
 * Fix replying using chat effect commands ([\#9101](https://github.com/matrix-org/matrix-react-sdk/pull/9101)). Fixes vector-im/element-web#22824.

Changes in [1.11.2](https://github.com/vector-im/element-desktop/releases/tag/v1.11.2) (2022-08-03)
===================================================================================================

## ✨ Features
 * Live location share -  focus on user location on list item click ([\#9051](https://github.com/matrix-org/matrix-react-sdk/pull/9051)). Contributed by @kerryarchibald.
 * Live location sharing - don't trigger unread counts for beacon location events ([\#9071](https://github.com/matrix-org/matrix-react-sdk/pull/9071)). Contributed by @kerryarchibald.
 * Support for sending voice messages as replies and in threads ([\#9097](https://github.com/matrix-org/matrix-react-sdk/pull/9097)). Fixes vector-im/element-web#22031.
 * Add `Reply in thread` button to the right-click message context-menu ([\#9004](https://github.com/matrix-org/matrix-react-sdk/pull/9004)). Fixes vector-im/element-web#22745.
 * Starred_Messages_Feature_Contd_II/Outreachy ([\#9086](https://github.com/matrix-org/matrix-react-sdk/pull/9086)).
 * Use "frequently used emojis" for autocompletion in composer ([\#8998](https://github.com/matrix-org/matrix-react-sdk/pull/8998)). Fixes vector-im/element-web#18978. Contributed by @grimhilt.
 * Improve clickability of view source event toggle button  ([\#9068](https://github.com/matrix-org/matrix-react-sdk/pull/9068)). Fixes vector-im/element-web#21856. Contributed by @luixxiul.
 * Improve clickability of "collapse" link button on bubble layout ([\#9037](https://github.com/matrix-org/matrix-react-sdk/pull/9037)). Fixes vector-im/element-web#22864. Contributed by @luixxiul.
 * Starred_Messages_Feature/Outreachy ([\#8842](https://github.com/matrix-org/matrix-react-sdk/pull/8842)).
 * Implement Use Case Selection screen ([\#8984](https://github.com/matrix-org/matrix-react-sdk/pull/8984)). Contributed by @justjanne.
 * Live location share - handle insufficient permissions in location sharing ([\#9047](https://github.com/matrix-org/matrix-react-sdk/pull/9047)). Contributed by @kerryarchibald.
 * Improve _FilePanel.scss ([\#9031](https://github.com/matrix-org/matrix-react-sdk/pull/9031)). Contributed by @luixxiul.
 * Improve spotlight accessibility by adding context menus ([\#8907](https://github.com/matrix-org/matrix-react-sdk/pull/8907)). Fixes vector-im/element-web#20875 and vector-im/element-web#22675. Contributed by @justjanne.

## 🐛 Bug Fixes
 * Replace mask-images with svg components in MessageActionBar ([\#9088](https://github.com/matrix-org/matrix-react-sdk/pull/9088)). Fixes vector-im/element-web#22912. Contributed by @kerryarchibald.
 * Unbreak in-app permalink tooltips ([\#9087](https://github.com/matrix-org/matrix-react-sdk/pull/9087)). Fixes vector-im/element-web#22874.
 * Show a back button when viewing a space member ([\#9095](https://github.com/matrix-org/matrix-react-sdk/pull/9095)). Fixes vector-im/element-web#22898.
 * Align the right edge of info tile lines with normal ones on IRC layout ([\#9058](https://github.com/matrix-org/matrix-react-sdk/pull/9058)). Fixes vector-im/element-web#22871. Contributed by @luixxiul.
 * Prevent email verification from overriding existing sessions ([\#9075](https://github.com/matrix-org/matrix-react-sdk/pull/9075)). Fixes vector-im/element-web#22881. Contributed by @justjanne.
 * Fix wrong buttons being used when exploring public rooms ([\#9062](https://github.com/matrix-org/matrix-react-sdk/pull/9062)). Fixes vector-im/element-web#22862.
 * Re-add padding to generic event list summary on IRC layout ([\#9063](https://github.com/matrix-org/matrix-react-sdk/pull/9063)). Fixes vector-im/element-web#22869. Contributed by @luixxiul.
 * Joining federated rooms via the spotlight search should no longer cause a "No known servers" error. ([\#9055](https://github.com/matrix-org/matrix-react-sdk/pull/9055)). Fixes vector-im/element-web#22845. Contributed by @Half-Shot.

Changes in [1.11.1](https://github.com/vector-im/element-desktop/releases/tag/v1.11.1) (2022-07-26)
===================================================================================================

## ✨ Features
 * Enable URL tooltips on hover for Element Desktop ([\#22286](https://github.com/vector-im/element-web/pull/22286)). Fixes undefined/element-web#6532.
 * Hide screenshare button in video rooms on Desktop ([\#9045](https://github.com/matrix-org/matrix-react-sdk/pull/9045)).
 * Add a developer command to reset Megolm and Olm sessions ([\#9044](https://github.com/matrix-org/matrix-react-sdk/pull/9044)).
 * add spaces to TileErrorBoundary ([\#9012](https://github.com/matrix-org/matrix-react-sdk/pull/9012)). Contributed by @HarHarLinks.
 * Location sharing - add localised strings to map ([\#9025](https://github.com/matrix-org/matrix-react-sdk/pull/9025)). Fixes vector-im/element-web#21443. Contributed by @kerryarchibald.
 * Added trim to ignore whitespaces in email check ([\#9027](https://github.com/matrix-org/matrix-react-sdk/pull/9027)). Contributed by @ankur12-1610.
 * Improve _GenericEventListSummary.scss ([\#9005](https://github.com/matrix-org/matrix-react-sdk/pull/9005)). Contributed by @luixxiul.
 * Live location share - tiles without tile server (PSG-591) ([\#8962](https://github.com/matrix-org/matrix-react-sdk/pull/8962)). Contributed by @kerryarchibald.
 * Add option to display tooltip on link hover ([\#8394](https://github.com/matrix-org/matrix-react-sdk/pull/8394)). Fixes vector-im/element-web#21907.
 * Support a module API surface for custom functionality ([\#8246](https://github.com/matrix-org/matrix-react-sdk/pull/8246)).
 * Adjust encryption copy when creating a video room ([\#8989](https://github.com/matrix-org/matrix-react-sdk/pull/8989)). Fixes vector-im/element-web#22737.
 * Add bidirectonal isolation for pills ([\#8985](https://github.com/matrix-org/matrix-react-sdk/pull/8985)). Contributed by @sha-265.
 * Delabs `Show current avatar and name for users in message history` ([\#8764](https://github.com/matrix-org/matrix-react-sdk/pull/8764)). Fixes vector-im/element-web#22336.
 * Live location share - open latest location in map site ([\#8981](https://github.com/matrix-org/matrix-react-sdk/pull/8981)). Contributed by @kerryarchibald.
 * Improve LinkPreviewWidget ([\#8881](https://github.com/matrix-org/matrix-react-sdk/pull/8881)). Fixes vector-im/element-web#22634. Contributed by @luixxiul.
 * Render HTML topics in rooms on space home ([\#8939](https://github.com/matrix-org/matrix-react-sdk/pull/8939)).
 * Hide timestamp on event tiles being edited on every layout ([\#8956](https://github.com/matrix-org/matrix-react-sdk/pull/8956)). Contributed by @luixxiul.
 * Introduce new copy icon ([\#8942](https://github.com/matrix-org/matrix-react-sdk/pull/8942)).
 * Allow finding group DMs by members in spotlight ([\#8922](https://github.com/matrix-org/matrix-react-sdk/pull/8922)). Fixes vector-im/element-web#22564. Contributed by @justjanne.
 * Live location share - explicitly stop beacons replaced beacons ([\#8933](https://github.com/matrix-org/matrix-react-sdk/pull/8933)). Contributed by @kerryarchibald.
 * Remove unpin from widget kebab menu ([\#8924](https://github.com/matrix-org/matrix-react-sdk/pull/8924)).
 * Live location share - redact related locations on beacon redaction ([\#8926](https://github.com/matrix-org/matrix-react-sdk/pull/8926)). Contributed by @kerryarchibald.
 * Live location share - disallow message pinning ([\#8928](https://github.com/matrix-org/matrix-react-sdk/pull/8928)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Fix manual update checks not working after being dismissed ([\#388](https://github.com/vector-im/element-desktop/pull/388)). Fixes vector-im/element-web#22795.
 * Don't check for updates if we already have one downloaded and queued ([\#386](https://github.com/vector-im/element-desktop/pull/386)).
 * Fix default file name in save-image-as ([\#385](https://github.com/vector-im/element-desktop/pull/385)). Fixes vector-im/element-web#20838.
 * Remove the ability to hide yourself in video rooms ([\#22806](https://github.com/vector-im/element-web/pull/22806)). Fixes vector-im/element-web#22805.
 * Unbreak in-app permalink tooltips  ([\#9100](https://github.com/matrix-org/matrix-react-sdk/pull/9100)).
 * Add space for the stroke on message editor on IRC layout ([\#9030](https://github.com/matrix-org/matrix-react-sdk/pull/9030)). Fixes vector-im/element-web#22785. Contributed by @luixxiul.
 * Fix pinned messages not re-linkifying on edit ([\#9042](https://github.com/matrix-org/matrix-react-sdk/pull/9042)). Fixes vector-im/element-web#22726.
 * Don't unnecessarily persist the host signup dialog ([\#9043](https://github.com/matrix-org/matrix-react-sdk/pull/9043)). Fixes vector-im/element-web#22778.
 * Fix URL previews causing messages to become unrenderable ([\#9028](https://github.com/matrix-org/matrix-react-sdk/pull/9028)). Fixes vector-im/element-web#22766.
 * Fix event list summaries including invalid events ([\#9041](https://github.com/matrix-org/matrix-react-sdk/pull/9041)). Fixes vector-im/element-web#22790.
 * Correct accessibility labels for unread rooms in spotlight ([\#9003](https://github.com/matrix-org/matrix-react-sdk/pull/9003)). Contributed by @justjanne.
 * Enable search strings highlight on bubble layout ([\#9032](https://github.com/matrix-org/matrix-react-sdk/pull/9032)). Fixes vector-im/element-web#22786. Contributed by @luixxiul.
 * Unbreak URL preview for formatted links with tooltips ([\#9022](https://github.com/matrix-org/matrix-react-sdk/pull/9022)). Fixes vector-im/element-web#22764.
 * Re-add margin to tiles based on EventTileBubble ([\#9015](https://github.com/matrix-org/matrix-react-sdk/pull/9015)). Fixes vector-im/element-web#22772. Contributed by @luixxiul.
 * Fix Shortcut prompt for Search showing in minimized Roomlist ([\#9014](https://github.com/matrix-org/matrix-react-sdk/pull/9014)). Fixes vector-im/element-web#22739. Contributed by @justjanne.
 * Fix avatar position on event info line for hidden events on a thread ([\#9019](https://github.com/matrix-org/matrix-react-sdk/pull/9019)). Fixes vector-im/element-web#22777. Contributed by @luixxiul.
 * Fix lost padding of event tile info line ([\#9009](https://github.com/matrix-org/matrix-react-sdk/pull/9009)). Fixes vector-im/element-web#22754 and vector-im/element-web#22759. Contributed by @luixxiul.
 * Align verification bubble with normal event tiles on IRC layout ([\#9001](https://github.com/matrix-org/matrix-react-sdk/pull/9001)). Fixes vector-im/element-web#22758. Contributed by @luixxiul.
 * Ensure timestamp on generic event list summary is not hidden from TimelineCard ([\#9000](https://github.com/matrix-org/matrix-react-sdk/pull/9000)). Fixes vector-im/element-web#22755. Contributed by @luixxiul.
 * Fix headings margin on security user settings tab ([\#8826](https://github.com/matrix-org/matrix-react-sdk/pull/8826)). Contributed by @luixxiul.
 * Fix timestamp position on file panel ([\#8976](https://github.com/matrix-org/matrix-react-sdk/pull/8976)). Fixes vector-im/element-web#22718. Contributed by @luixxiul.
 * Stop using :not() pseudo class for mx_GenericEventListSummary ([\#8944](https://github.com/matrix-org/matrix-react-sdk/pull/8944)). Fixes vector-im/element-web#22602. Contributed by @luixxiul.
 * Don't show the same user twice in Spotlight ([\#8978](https://github.com/matrix-org/matrix-react-sdk/pull/8978)). Fixes vector-im/element-web#22697.
 * Align the right edge of expand / collapse link buttons of generic event list summary in bubble layout with a variable ([\#8992](https://github.com/matrix-org/matrix-react-sdk/pull/8992)). Fixes vector-im/element-web#22743. Contributed by @luixxiul.
 * Display own avatars on search results panel in bubble layout ([\#8990](https://github.com/matrix-org/matrix-react-sdk/pull/8990)). Contributed by @luixxiul.
 * Fix text flow of thread summary content on threads list ([\#8991](https://github.com/matrix-org/matrix-react-sdk/pull/8991)). Fixes vector-im/element-web#22738. Contributed by @luixxiul.
 * Fix the size of the clickable area of images ([\#8987](https://github.com/matrix-org/matrix-react-sdk/pull/8987)). Fixes vector-im/element-web#22282.
 * Fix font size of MessageTimestamp on TimelineCard ([\#8950](https://github.com/matrix-org/matrix-react-sdk/pull/8950)). Contributed by @luixxiul.
 * Improve security room settings tab style rules ([\#8844](https://github.com/matrix-org/matrix-react-sdk/pull/8844)). Fixes vector-im/element-web#22575. Contributed by @luixxiul.
 * Align E2E icon and avatar of info tile in compact modern layout ([\#8965](https://github.com/matrix-org/matrix-react-sdk/pull/8965)). Fixes vector-im/element-web#22652. Contributed by @luixxiul.
 * Fix clickable area of general event list summary toggle ([\#8979](https://github.com/matrix-org/matrix-react-sdk/pull/8979)). Fixes vector-im/element-web#22722. Contributed by @luixxiul.
 * Fix resizing room topic ([\#8966](https://github.com/matrix-org/matrix-react-sdk/pull/8966)). Fixes vector-im/element-web#22689.
 * Dismiss the search dialogue when starting a DM ([\#8967](https://github.com/matrix-org/matrix-react-sdk/pull/8967)). Fixes vector-im/element-web#22700.
 * Fix "greyed out" text style inconsistency on search result panel ([\#8974](https://github.com/matrix-org/matrix-react-sdk/pull/8974)). Contributed by @luixxiul.
 * Add top padding to EventTilePreview loader ([\#8977](https://github.com/matrix-org/matrix-react-sdk/pull/8977)). Fixes vector-im/element-web#22719. Contributed by @luixxiul.
 * Fix read receipts group position on TimelineCard in compact modern/group layout ([\#8971](https://github.com/matrix-org/matrix-react-sdk/pull/8971)). Fixes vector-im/element-web#22715. Contributed by @luixxiul.
 * Fix calls on homeservers without the unstable thirdparty endpoints. ([\#8931](https://github.com/matrix-org/matrix-react-sdk/pull/8931)). Fixes vector-im/element-web#21680. Contributed by @deepbluev7.
 * Enable ReplyChain text to be expanded on IRC layout ([\#8959](https://github.com/matrix-org/matrix-react-sdk/pull/8959)). Fixes vector-im/element-web#22709. Contributed by @luixxiul.
 * Fix hidden timestamp on message edit history dialog ([\#8955](https://github.com/matrix-org/matrix-react-sdk/pull/8955)). Fixes vector-im/element-web#22701. Contributed by @luixxiul.
 * Enable ReplyChain text to be expanded on bubble layout ([\#8958](https://github.com/matrix-org/matrix-react-sdk/pull/8958)). Fixes vector-im/element-web#22709. Contributed by @luixxiul.
 * Fix expand/collapse state wrong in metaspaces ([\#8952](https://github.com/matrix-org/matrix-react-sdk/pull/8952)). Fixes vector-im/element-web#22632.
 * Location (live) share replies now provide a fallback content ([\#8949](https://github.com/matrix-org/matrix-react-sdk/pull/8949)).
 * Fix space settings not opening for script-created spaces ([\#8957](https://github.com/matrix-org/matrix-react-sdk/pull/8957)). Fixes vector-im/element-web#22703.
 * Respect `filename` field on `m.file` events ([\#8951](https://github.com/matrix-org/matrix-react-sdk/pull/8951)).
 * Fix PlatformSettingsHandler always returning true due to returning a Promise ([\#8954](https://github.com/matrix-org/matrix-react-sdk/pull/8954)). Fixes vector-im/element-web#22616.
 * Improve high-contrast support for spotlight ([\#8948](https://github.com/matrix-org/matrix-react-sdk/pull/8948)). Fixes vector-im/element-web#22481. Contributed by @justjanne.
 * Fix wrong assertions that all media events have a mimetype ([\#8946](https://github.com/matrix-org/matrix-react-sdk/pull/8946)). Fixes matrix-org/element-web-rageshakes#13727.
 * Make invite dialogue fixed height ([\#8934](https://github.com/matrix-org/matrix-react-sdk/pull/8934)). Fixes vector-im/element-web#22659.
 * Fix all megolm error reported as unknown ([\#8916](https://github.com/matrix-org/matrix-react-sdk/pull/8916)).
 * Remove line-height declarations from _ReplyTile.scss ([\#8932](https://github.com/matrix-org/matrix-react-sdk/pull/8932)). Fixes vector-im/element-web#22687. Contributed by @luixxiul.
 * Reduce video rooms log spam ([\#8913](https://github.com/matrix-org/matrix-react-sdk/pull/8913)).
 * Correct new search input’s rounded corners ([\#8921](https://github.com/matrix-org/matrix-react-sdk/pull/8921)). Fixes vector-im/element-web#22576. Contributed by @justjanne.
 * Align unread notification dot on threads list in compact modern=group layout ([\#8911](https://github.com/matrix-org/matrix-react-sdk/pull/8911)). Fixes vector-im/element-web#22677. Contributed by @luixxiul.

Changes in [1.11.0](https://github.com/vector-im/element-desktop/releases/tag/v1.11.0) (2022-07-05)
===================================================================================================

## 🚨 BREAKING CHANGES
 * Remove Piwik support ([\#8835](https://github.com/matrix-org/matrix-react-sdk/pull/8835)).

## ✨ Features
 * Support compilation on more Linux targets ([\#376](https://github.com/vector-im/element-desktop/pull/376)). Contributed by @jcgruenhage.
 * Document how to configure a custom `home.html`. ([\#21066](https://github.com/vector-im/element-web/pull/21066)). Contributed by @johannes-krude.
 * Move New Search Experience out of beta ([\#8859](https://github.com/matrix-org/matrix-react-sdk/pull/8859)). Contributed by @justjanne.
 * Switch video rooms to spotlight layout when in PiP mode ([\#8912](https://github.com/matrix-org/matrix-react-sdk/pull/8912)). Fixes vector-im/element-web#22574.
 * Live location sharing - render message deleted tile for redacted beacons ([\#8905](https://github.com/matrix-org/matrix-react-sdk/pull/8905)). Contributed by @kerryarchibald.
 * Improve view source dialog style ([\#8883](https://github.com/matrix-org/matrix-react-sdk/pull/8883)). Fixes vector-im/element-web#22636. Contributed by @luixxiul.
 * Improve integration manager dialog style ([\#8888](https://github.com/matrix-org/matrix-react-sdk/pull/8888)). Fixes vector-im/element-web#22642. Contributed by @luixxiul.
 * Implement MSC3827: Filtering of `/publicRooms` by room type ([\#8866](https://github.com/matrix-org/matrix-react-sdk/pull/8866)). Fixes vector-im/element-web#22578.
 * Show chat panel when opening a video room with unread messages ([\#8812](https://github.com/matrix-org/matrix-react-sdk/pull/8812)). Fixes vector-im/element-web#22527.
 * Live location share - forward latest location ([\#8860](https://github.com/matrix-org/matrix-react-sdk/pull/8860)). Contributed by @kerryarchibald.
 * Allow integration managers to validate user identity after opening ([\#8782](https://github.com/matrix-org/matrix-react-sdk/pull/8782)). Contributed by @Half-Shot.
 * Create a common header on right panel cards on BaseCard ([\#8808](https://github.com/matrix-org/matrix-react-sdk/pull/8808)). Contributed by @luixxiul.
 * Integrate searching public rooms and people into the new search experience ([\#8707](https://github.com/matrix-org/matrix-react-sdk/pull/8707)). Fixes vector-im/element-web#21354 and vector-im/element-web#19349. Contributed by @justjanne.
 * Bring back waveform for voice messages and retain seeking ([\#8843](https://github.com/matrix-org/matrix-react-sdk/pull/8843)). Fixes vector-im/element-web#21904.
 * Improve colors in settings  ([\#7283](https://github.com/matrix-org/matrix-react-sdk/pull/7283)).
 * Keep draft in composer when a slash command syntax errors ([\#8811](https://github.com/matrix-org/matrix-react-sdk/pull/8811)). Fixes vector-im/element-web#22384.
 * Release video rooms as a beta feature ([\#8431](https://github.com/matrix-org/matrix-react-sdk/pull/8431)).
 * Clarify logout key backup warning dialog. Contributed by @notramo. ([\#8741](https://github.com/matrix-org/matrix-react-sdk/pull/8741)). Fixes vector-im/element-web#15565. Contributed by @MadLittleMods.
 * Slightly improve the look of the `Message edits` dialog ([\#8763](https://github.com/matrix-org/matrix-react-sdk/pull/8763)). Fixes vector-im/element-web#22410.
 * Add support for MD / HTML in room topics ([\#8215](https://github.com/matrix-org/matrix-react-sdk/pull/8215)). Fixes vector-im/element-web#5180. Contributed by @Johennes.
 * Live location share - link to timeline tile from share warning ([\#8752](https://github.com/matrix-org/matrix-react-sdk/pull/8752)). Contributed by @kerryarchibald.
 * Improve composer visiblity ([\#8578](https://github.com/matrix-org/matrix-react-sdk/pull/8578)). Fixes vector-im/element-web#22072 and vector-im/element-web#17362.
 * Makes the avatar of the user menu non-draggable ([\#8765](https://github.com/matrix-org/matrix-react-sdk/pull/8765)). Contributed by @luixxiul.
 * Improve widget buttons behaviour and layout ([\#8734](https://github.com/matrix-org/matrix-react-sdk/pull/8734)).
 * Use AccessibleButton for 'Reset All' link button on SetupEncryptionBody ([\#8730](https://github.com/matrix-org/matrix-react-sdk/pull/8730)). Contributed by @luixxiul.
 * Adjust message timestamp position on TimelineCard in non-bubble layouts ([\#8745](https://github.com/matrix-org/matrix-react-sdk/pull/8745)). Fixes vector-im/element-web#22426. Contributed by @luixxiul.
 * Use AccessibleButton for 'In reply to' link button on ReplyChain ([\#8726](https://github.com/matrix-org/matrix-react-sdk/pull/8726)). Fixes vector-im/element-web#22407. Contributed by @luixxiul.
 * Live location share - enable reply and react to tiles ([\#8721](https://github.com/matrix-org/matrix-react-sdk/pull/8721)). Contributed by @kerryarchibald.
 * Change dash to em dash issues fixed ([\#8455](https://github.com/matrix-org/matrix-react-sdk/pull/8455)). Fixes vector-im/element-web#21895. Contributed by @goelesha.

## 🐛 Bug Fixes
 * Upgrade to Electron 19 ([\#372](https://github.com/vector-im/element-desktop/pull/372)). Fixes vector-im/element-web#21147.
 * Reduce video rooms log spam ([\#22665](https://github.com/vector-im/element-web/pull/22665)).
 * Connect to Jitsi unmuted by default ([\#22660](https://github.com/vector-im/element-web/pull/22660)). Fixes vector-im/element-web#22637.
 * Work around a Jitsi bug with display name encoding ([\#22525](https://github.com/vector-im/element-web/pull/22525)). Fixes vector-im/element-web#22521.
 * Make invite dialogue fixed height ([\#8945](https://github.com/matrix-org/matrix-react-sdk/pull/8945)).
 * Correct issue with tab order in new search experience ([\#8919](https://github.com/matrix-org/matrix-react-sdk/pull/8919)). Fixes vector-im/element-web#22670. Contributed by @justjanne.
 * Clicking location replies now redirects to the replied event instead of opening the map ([\#8918](https://github.com/matrix-org/matrix-react-sdk/pull/8918)). Fixes vector-im/element-web#22667.
 * Keep clicks on pills within the app ([\#8917](https://github.com/matrix-org/matrix-react-sdk/pull/8917)). Fixes vector-im/element-web#22653.
 * Don't overlap tile bubbles with timestamps in modern layout ([\#8908](https://github.com/matrix-org/matrix-react-sdk/pull/8908)). Fixes vector-im/element-web#22425.
 * Connect to Jitsi unmuted by default ([\#8909](https://github.com/matrix-org/matrix-react-sdk/pull/8909)).
 * Maximize width value of display name on TimelineCard with IRC/modern layout ([\#8904](https://github.com/matrix-org/matrix-react-sdk/pull/8904)). Fixes vector-im/element-web#22651. Contributed by @luixxiul.
 * Align the avatar and the display name on TimelineCard ([\#8900](https://github.com/matrix-org/matrix-react-sdk/pull/8900)). Contributed by @luixxiul.
 * Remove inline margin from reactions row on IRC layout ([\#8891](https://github.com/matrix-org/matrix-react-sdk/pull/8891)). Fixes vector-im/element-web#22644. Contributed by @luixxiul.
 * Align "From a thread" on search result panel on IRC layout ([\#8892](https://github.com/matrix-org/matrix-react-sdk/pull/8892)). Fixes vector-im/element-web#22645. Contributed by @luixxiul.
 * Display description of E2E advanced panel as subsection text ([\#8889](https://github.com/matrix-org/matrix-react-sdk/pull/8889)). Contributed by @luixxiul.
 * Remove inline end margin from images on file panel ([\#8886](https://github.com/matrix-org/matrix-react-sdk/pull/8886)). Fixes vector-im/element-web#22640. Contributed by @luixxiul.
 * Disable option to `Quote` when we don't have sufficient permissions ([\#8893](https://github.com/matrix-org/matrix-react-sdk/pull/8893)). Fixes vector-im/element-web#22643.
 * Add padding to font scaling loader for message bubble layout ([\#8875](https://github.com/matrix-org/matrix-react-sdk/pull/8875)). Fixes vector-im/element-web#22626. Contributed by @luixxiul.
 * Set 100% max-width to display name on reply tiles ([\#8867](https://github.com/matrix-org/matrix-react-sdk/pull/8867)). Fixes vector-im/element-web#22615. Contributed by @luixxiul.
 * Fix alignment of pill letter ([\#8874](https://github.com/matrix-org/matrix-react-sdk/pull/8874)). Fixes vector-im/element-web#22622. Contributed by @luixxiul.
 * Move the beta pill to the right side and display the pill on video room only ([\#8873](https://github.com/matrix-org/matrix-react-sdk/pull/8873)). Fixes vector-im/element-web#22619 and vector-im/element-web#22620. Contributed by @luixxiul.
 * Stop using absolute property to place beta pill on RoomPreviewCard ([\#8872](https://github.com/matrix-org/matrix-react-sdk/pull/8872)). Fixes vector-im/element-web#22617. Contributed by @luixxiul.
 * Make the pill text single line ([\#8744](https://github.com/matrix-org/matrix-react-sdk/pull/8744)). Fixes vector-im/element-web#22427. Contributed by @luixxiul.
 * Hide overflow of public room description on spotlight dialog result ([\#8870](https://github.com/matrix-org/matrix-react-sdk/pull/8870)). Contributed by @luixxiul.
 * Fix position of message action bar on the info tile on TimelineCard in message bubble layout ([\#8865](https://github.com/matrix-org/matrix-react-sdk/pull/8865)). Fixes vector-im/element-web#22614. Contributed by @luixxiul.
 * Remove inline start margin from display name on reply tiles on TimelineCard ([\#8864](https://github.com/matrix-org/matrix-react-sdk/pull/8864)). Fixes vector-im/element-web#22613. Contributed by @luixxiul.
 * Improve homeserver dropdown dialog styling ([\#8850](https://github.com/matrix-org/matrix-react-sdk/pull/8850)). Fixes vector-im/element-web#22552. Contributed by @justjanne.
 * Fix crash when drawing blurHash for portrait videos PSB-139 ([\#8855](https://github.com/matrix-org/matrix-react-sdk/pull/8855)). Fixes vector-im/element-web#22597. Contributed by @andybalaam.
 * Fix grid blowout on pinned event tiles ([\#8816](https://github.com/matrix-org/matrix-react-sdk/pull/8816)). Fixes vector-im/element-web#22543. Contributed by @luixxiul.
 * Fix temporary sync errors if there's weird settings stored in account data ([\#8857](https://github.com/matrix-org/matrix-react-sdk/pull/8857)).
 * Fix reactions row overflow and gap between reactions ([\#8813](https://github.com/matrix-org/matrix-react-sdk/pull/8813)). Fixes vector-im/element-web#22093. Contributed by @luixxiul.
 * Fix issues with the Create new room button in Spotlight ([\#8851](https://github.com/matrix-org/matrix-react-sdk/pull/8851)). Contributed by @justjanne.
 * Remove margin from E2E icon between avatar and hidden event ([\#8584](https://github.com/matrix-org/matrix-react-sdk/pull/8584)). Fixes vector-im/element-web#22186. Contributed by @luixxiul.
 * Fix waveform on a message bubble ([\#8852](https://github.com/matrix-org/matrix-react-sdk/pull/8852)). Contributed by @luixxiul.
 * Location sharing maps are now loaded after reconnection ([\#8848](https://github.com/matrix-org/matrix-react-sdk/pull/8848)). Fixes vector-im/element-web#20993.
 * Update the avatar mask so it doesn’t cut off spaces’ avatars anymore ([\#8849](https://github.com/matrix-org/matrix-react-sdk/pull/8849)). Contributed by @justjanne.
 * Add a bit of safety around timestamp handling for threads ([\#8845](https://github.com/matrix-org/matrix-react-sdk/pull/8845)).
 * Remove top margin from event tile on a narrow viewport ([\#8814](https://github.com/matrix-org/matrix-react-sdk/pull/8814)). Contributed by @luixxiul.
 * Fix keyboard shortcuts on settings tab being wrapped ([\#8825](https://github.com/matrix-org/matrix-react-sdk/pull/8825)). Fixes vector-im/element-web#22547. Contributed by @luixxiul.
 * Add try-catch around blurhash loading ([\#8830](https://github.com/matrix-org/matrix-react-sdk/pull/8830)).
 * Prevent new composer from overflowing from non-breakable text ([\#8829](https://github.com/matrix-org/matrix-react-sdk/pull/8829)). Fixes vector-im/element-web#22507. Contributed by @justjanne.
 * Use common subheading on sidebar user settings tab ([\#8823](https://github.com/matrix-org/matrix-react-sdk/pull/8823)). Contributed by @luixxiul.
 * Fix clickable area of advanced toggle on appearance user settings tab ([\#8820](https://github.com/matrix-org/matrix-react-sdk/pull/8820)). Fixes vector-im/element-web#22546. Contributed by @luixxiul.
 * Disable redacting reactions if we don't have sufficient permissions  ([\#8767](https://github.com/matrix-org/matrix-react-sdk/pull/8767)). Fixes vector-im/element-web#22262.
 * Update the live timeline when the JS SDK resets it ([\#8806](https://github.com/matrix-org/matrix-react-sdk/pull/8806)). Fixes vector-im/element-web#22421.
 * Fix flex blowout on image reply ([\#8809](https://github.com/matrix-org/matrix-react-sdk/pull/8809)). Fixes vector-im/element-web#22509 and vector-im/element-web#22510. Contributed by @luixxiul.
 * Enable background color on hover for chat panel and thread panel ([\#8644](https://github.com/matrix-org/matrix-react-sdk/pull/8644)). Fixes vector-im/element-web#22273. Contributed by @luixxiul.
 * Fix #20026: send read marker as soon as we change it ([\#8802](https://github.com/matrix-org/matrix-react-sdk/pull/8802)). Fixes vector-im/element-web#20026. Contributed by @andybalaam.
 * Allow AppTiles to shrink as much as necessary ([\#8805](https://github.com/matrix-org/matrix-react-sdk/pull/8805)). Fixes vector-im/element-web#22499.
 * Make widgets in video rooms immutable again ([\#8803](https://github.com/matrix-org/matrix-react-sdk/pull/8803)). Fixes vector-im/element-web#22497.
 * Use MessageActionBar style declarations on pinned message card ([\#8757](https://github.com/matrix-org/matrix-react-sdk/pull/8757)). Fixes vector-im/element-web#22444. Contributed by @luixxiul.
 * Expire video member events after 1 hour ([\#8776](https://github.com/matrix-org/matrix-react-sdk/pull/8776)).
 * Name lists on invite dialog ([\#8046](https://github.com/matrix-org/matrix-react-sdk/pull/8046)). Fixes vector-im/element-web#21400 and vector-im/element-web#19463. Contributed by @luixxiul.
 * Live location share - show loading UI for beacons with start timestamp in the future ([\#8775](https://github.com/matrix-org/matrix-react-sdk/pull/8775)). Fixes vector-im/element-web#22437. Contributed by @kerryarchibald.
 * Fix scroll jump issue with the composer ([\#8788](https://github.com/matrix-org/matrix-react-sdk/pull/8788)). Fixes vector-im/element-web#22464.
 * Fix the incorrect nesting of download button on MessageActionBar ([\#8785](https://github.com/matrix-org/matrix-react-sdk/pull/8785)). Contributed by @luixxiul.
 * Revert link color change in composer ([\#8784](https://github.com/matrix-org/matrix-react-sdk/pull/8784)). Fixes vector-im/element-web#22468.
 * Fix 'Logout' inline link on the splash screen ([\#8770](https://github.com/matrix-org/matrix-react-sdk/pull/8770)). Fixes vector-im/element-web#22449. Contributed by @luixxiul.
 * Fix disappearing widget poput button when changing the widget layout ([\#8754](https://github.com/matrix-org/matrix-react-sdk/pull/8754)).
 * Reduce gutter with the new read receipt UI ([\#8736](https://github.com/matrix-org/matrix-react-sdk/pull/8736)). Fixes vector-im/element-web#21890.
 * Add ellipsis effect to hidden beacon status ([\#8755](https://github.com/matrix-org/matrix-react-sdk/pull/8755)). Fixes vector-im/element-web#22441. Contributed by @luixxiul.
 * Make the pill on the basic message composer compatible with display name in RTL languages ([\#8758](https://github.com/matrix-org/matrix-react-sdk/pull/8758)). Fixes vector-im/element-web#22445. Contributed by @luixxiul.
 * Prevent the banner text from being selected, replacing the spacing values with the variable ([\#8756](https://github.com/matrix-org/matrix-react-sdk/pull/8756)). Fixes vector-im/element-web#22442. Contributed by @luixxiul.
 * Ensure the first device on a newly-registered account gets cross-signed properly ([\#8750](https://github.com/matrix-org/matrix-react-sdk/pull/8750)). Fixes vector-im/element-web#21977. Contributed by @duxovni.
 * Hide live location option in threads composer ([\#8746](https://github.com/matrix-org/matrix-react-sdk/pull/8746)). Fixes vector-im/element-web#22424. Contributed by @kerryarchibald.
 * Make sure MessageTimestamp is not hidden by EventTile_line on TimelineCard ([\#8748](https://github.com/matrix-org/matrix-react-sdk/pull/8748)). Contributed by @luixxiul.
 * Make PiP motion smoother and react to window resizes correctly ([\#8747](https://github.com/matrix-org/matrix-react-sdk/pull/8747)). Fixes vector-im/element-web#22292.
 * Prevent Invite and DevTools dialogs from being cut off ([\#8646](https://github.com/matrix-org/matrix-react-sdk/pull/8646)). Fixes vector-im/element-web#20911 and undefined/matrix-react-sdk#8165. Contributed by @justjanne.
 * Squish event bubble tiles less ([\#8740](https://github.com/matrix-org/matrix-react-sdk/pull/8740)).
 * Use random widget IDs for video rooms ([\#8739](https://github.com/matrix-org/matrix-react-sdk/pull/8739)). Fixes vector-im/element-web#22417.
 * Fix read avatars overflow from the right chat panel with a maximized widget on bubble message layout ([\#8470](https://github.com/matrix-org/matrix-react-sdk/pull/8470)). Contributed by @luixxiul.
 * Fix `CallView` crash ([\#8735](https://github.com/matrix-org/matrix-react-sdk/pull/8735)). Fixes vector-im/element-web#22394.

Changes in [1.10.15](https://github.com/vector-im/element-desktop/releases/tag/v1.10.15) (2022-06-14)
=====================================================================================================

## 🐛 Bug Fixes
 * Fix missing element desktop preferences ([\#8798](https://github.com/matrix-org/matrix-react-sdk/pull/8798)). Contributed by @t3chguy.

Changes in [1.10.14](https://github.com/vector-im/element-desktop/releases/tag/v1.10.14) (2022-06-07)
=====================================================================================================

## ✨ Features
 * Builds Windows 32-bit builds once more! ([\#369](https://github.com/vector-im/element-desktop/pull/369)). Fixes vector-im/element-web#13175.
 * Option to disable hardware acceleration ([\#365](https://github.com/vector-im/element-desktop/pull/365)). Fixes vector-im/element-web#13648. Contributed by @novocaine.
 * Make Lao translation available ([\#22358](https://github.com/vector-im/element-web/pull/22358)). Fixes vector-im/element-web#22327.
 * Option to disable hardware acceleration on Element Desktop ([\#22295](https://github.com/vector-im/element-web/pull/22295)). Contributed by @novocaine.
 * Configure custom home.html via `.well-known/matrix/client["io.element.embedded_pages"]["home_url"]` for all your element-web/desktop users ([\#7790](https://github.com/matrix-org/matrix-react-sdk/pull/7790)). Contributed by @johannes-krude.
 * Live location sharing - open location in OpenStreetMap ([\#8695](https://github.com/matrix-org/matrix-react-sdk/pull/8695)). Contributed by @kerryarchibald.
 * Show a dialog when Jitsi encounters an error ([\#8701](https://github.com/matrix-org/matrix-react-sdk/pull/8701)). Fixes vector-im/element-web#22284.
 * Add support for setting the `avatar_url` of widgets by integration managers. ([\#8550](https://github.com/matrix-org/matrix-react-sdk/pull/8550)). Contributed by @Fox32.
 * Add an option to ignore (block) a user when reporting their events ([\#8471](https://github.com/matrix-org/matrix-react-sdk/pull/8471)).
 * Add the option to disable hardware acceleration ([\#8655](https://github.com/matrix-org/matrix-react-sdk/pull/8655)). Contributed by @novocaine.
 * Slightly better presentation of read receipts to screen reader users ([\#8662](https://github.com/matrix-org/matrix-react-sdk/pull/8662)). Fixes vector-im/element-web#22293. Contributed by @pvagner.
 * Add jump to related event context menu item ([\#6775](https://github.com/matrix-org/matrix-react-sdk/pull/6775)). Fixes vector-im/element-web#19883.
 * Add public room directory hook ([\#8626](https://github.com/matrix-org/matrix-react-sdk/pull/8626)).

## 🐛 Bug Fixes
 * Revert back to using libsqlcipher0 for Debian & Ubuntu packages of Desktop ([\#367](https://github.com/vector-im/element-desktop/pull/367)). Fixes vector-im/element-web#22325.
 * Stop Jitsi if we time out while connecting to a video room ([\#22301](https://github.com/vector-im/element-web/pull/22301)). Fixes vector-im/element-web#22283.
 * Remove inline margin from UTD error message inside a reply tile on ThreadView ([\#8708](https://github.com/matrix-org/matrix-react-sdk/pull/8708)). Fixes vector-im/element-web#22376. Contributed by @luixxiul.
 * Move unread notification dots of the threads list to the expected position ([\#8700](https://github.com/matrix-org/matrix-react-sdk/pull/8700)). Fixes vector-im/element-web#22350. Contributed by @luixxiul.
 * Prevent overflow of grid items on a bubble with UTD generally ([\#8697](https://github.com/matrix-org/matrix-react-sdk/pull/8697)). Contributed by @luixxiul.
 * Create 'Unable To Decrypt' grid layout for hidden events on a bubble layout ([\#8704](https://github.com/matrix-org/matrix-react-sdk/pull/8704)). Fixes vector-im/element-web#22365. Contributed by @luixxiul.
 * Fix - AccessibleButton does not set disabled attribute ([\#8682](https://github.com/matrix-org/matrix-react-sdk/pull/8682)). Contributed by @kerryarchibald.
 * Fix font not resetting when logging out ([\#8670](https://github.com/matrix-org/matrix-react-sdk/pull/8670)). Fixes vector-im/element-web#17228.
 * Fix local aliases section of room settings not working for some homeservers (ie ([\#8698](https://github.com/matrix-org/matrix-react-sdk/pull/8698)). Fixes vector-im/element-web#22337.
 * Align EventTile_line with display name on message bubble ([\#8692](https://github.com/matrix-org/matrix-react-sdk/pull/8692)). Fixes vector-im/element-web#22343. Contributed by @luixxiul.
 * Convert references to direct chat -> direct message ([\#8694](https://github.com/matrix-org/matrix-react-sdk/pull/8694)). Contributed by @novocaine.
 * Improve combining diacritics for U+20D0 to U+20F0 in Chrome ([\#8687](https://github.com/matrix-org/matrix-react-sdk/pull/8687)).
 * Make the empty thread panel fill BaseCard ([\#8690](https://github.com/matrix-org/matrix-react-sdk/pull/8690)). Fixes vector-im/element-web#22338. Contributed by @luixxiul.
 * Fix edge case around composer handling gendered facepalm emoji ([\#8686](https://github.com/matrix-org/matrix-react-sdk/pull/8686)).
 * Fix a grid blowout due to nowrap displayName on a bubble with UTD ([\#8688](https://github.com/matrix-org/matrix-react-sdk/pull/8688)). Fixes vector-im/element-web#21914. Contributed by @luixxiul.
 * Apply the same max-width to image tile on the thread timeline as message bubble ([\#8669](https://github.com/matrix-org/matrix-react-sdk/pull/8669)). Fixes vector-im/element-web#22313. Contributed by @luixxiul.
 * Fix dropdown button size for picture-in-picture CallView ([\#8680](https://github.com/matrix-org/matrix-react-sdk/pull/8680)). Fixes vector-im/element-web#22316. Contributed by @luixxiul.
 * Live location sharing - fix square border for image-less avatar (PSF-1052) ([\#8679](https://github.com/matrix-org/matrix-react-sdk/pull/8679)). Contributed by @kerryarchibald.
 * Stop connecting to a video room if the widget messaging disappears ([\#8660](https://github.com/matrix-org/matrix-react-sdk/pull/8660)).
 * Fix file button and audio player overflowing from message bubble ([\#8666](https://github.com/matrix-org/matrix-react-sdk/pull/8666)). Fixes vector-im/element-web#22308. Contributed by @luixxiul.
 * Don't show broken composer format bar when selection is whitespace ([\#8673](https://github.com/matrix-org/matrix-react-sdk/pull/8673)). Fixes vector-im/element-web#10788.
 * Fix media upload http 413 handling ([\#8674](https://github.com/matrix-org/matrix-react-sdk/pull/8674)).
 * Fix emoji picker for editing thread responses ([\#8671](https://github.com/matrix-org/matrix-react-sdk/pull/8671)). Fixes matrix-org/element-web-rageshakes#13129.
 * Map attribution while sharing live location is now visible ([\#8621](https://github.com/matrix-org/matrix-react-sdk/pull/8621)). Fixes vector-im/element-web#22236. Contributed by @weeman1337.
 * Fix info tile overlapping the time stamp on TimelineCard ([\#8639](https://github.com/matrix-org/matrix-react-sdk/pull/8639)). Fixes vector-im/element-web#22256. Contributed by @luixxiul.
 * Fix position of wide images on IRC / modern layout ([\#8667](https://github.com/matrix-org/matrix-react-sdk/pull/8667)). Fixes vector-im/element-web#22309. Contributed by @luixxiul.
 * Fix other user's displayName being wrapped on the bubble message layout ([\#8456](https://github.com/matrix-org/matrix-react-sdk/pull/8456)). Fixes vector-im/element-web#22004. Contributed by @luixxiul.
 * Set spacing declarations to elements in mx_EventTile_mediaLine ([\#8665](https://github.com/matrix-org/matrix-react-sdk/pull/8665)). Fixes vector-im/element-web#22307. Contributed by @luixxiul.
 * Fix wide image overflowing from the thumbnail container ([\#8663](https://github.com/matrix-org/matrix-react-sdk/pull/8663)). Fixes vector-im/element-web#22303. Contributed by @luixxiul.
 * Fix styles of "Show all" link button on ReactionsRow ([\#8658](https://github.com/matrix-org/matrix-react-sdk/pull/8658)). Fixes vector-im/element-web#22300. Contributed by @luixxiul.
 * Automatically log in after registration ([\#8654](https://github.com/matrix-org/matrix-react-sdk/pull/8654)). Fixes vector-im/element-web#19305. Contributed by @justjanne.
 * Fix offline status in window title not working reliably ([\#8656](https://github.com/matrix-org/matrix-react-sdk/pull/8656)).
 * Align input area with event body's first letter in a thread on IRC/modern layout ([\#8636](https://github.com/matrix-org/matrix-react-sdk/pull/8636)). Fixes vector-im/element-web#22252. Contributed by @luixxiul.
 * Fix crash on null idp for SSO buttons ([\#8650](https://github.com/matrix-org/matrix-react-sdk/pull/8650)). Contributed by @hughns.
 * Don't open the regular browser or our context menu on right-clicking the `Options` button in the message action bar ([\#8648](https://github.com/matrix-org/matrix-react-sdk/pull/8648)). Fixes vector-im/element-web#22279.
 * Show notifications even when Element is focused ([\#8590](https://github.com/matrix-org/matrix-react-sdk/pull/8590)). Contributed by @sumnerevans.
 * Remove padding from the buttons on edit message composer of a event tile on a thread ([\#8632](https://github.com/matrix-org/matrix-react-sdk/pull/8632)). Contributed by @luixxiul.
 * ensure metaspace changes correctly notify listeners ([\#8611](https://github.com/matrix-org/matrix-react-sdk/pull/8611)). Fixes vector-im/element-web#21006. Contributed by @justjanne.
 * Hide image banner on stickers, they have a tooltip already ([\#8641](https://github.com/matrix-org/matrix-react-sdk/pull/8641)). Fixes vector-im/element-web#22244.
 * Adjust EditMessageComposer style declarations ([\#8631](https://github.com/matrix-org/matrix-react-sdk/pull/8631)). Fixes vector-im/element-web#22231. Contributed by @luixxiul.

Changes in [1.10.13](https://github.com/vector-im/element-desktop/releases/tag/v1.10.13) (2022-05-24)
=====================================================================================================

## ✨ Features
 * Go to space landing page when clicking on a selected space ([\#6442](https://github.com/matrix-org/matrix-react-sdk/pull/6442)). Fixes vector-im/element-web#20296.
 * Fall back to untranslated string rather than showing missing translation error ([\#8609](https://github.com/matrix-org/matrix-react-sdk/pull/8609)).
 * Show file name and size on images on hover ([\#6511](https://github.com/matrix-org/matrix-react-sdk/pull/6511)). Fixes vector-im/element-web#18197.
 * Iterate on search results for message bubbles ([\#7047](https://github.com/matrix-org/matrix-react-sdk/pull/7047)). Fixes vector-im/element-web#20315.
 * registration: redesign email verification page ([\#8554](https://github.com/matrix-org/matrix-react-sdk/pull/8554)). Fixes vector-im/element-web#21984.
 * Show full thread message in hover title on thread summary ([\#8568](https://github.com/matrix-org/matrix-react-sdk/pull/8568)). Fixes vector-im/element-web#22037.
 * Tweak video rooms copy ([\#8582](https://github.com/matrix-org/matrix-react-sdk/pull/8582)). Fixes vector-im/element-web#22176.
 * Live location share - beacon tooltip in maximised view ([\#8572](https://github.com/matrix-org/matrix-react-sdk/pull/8572)).
 * Add dialog to navigate long room topics ([\#8517](https://github.com/matrix-org/matrix-react-sdk/pull/8517)). Fixes vector-im/element-web#9623.
 * Change spaceroomfacepile tooltip if memberlist is shown ([\#8571](https://github.com/matrix-org/matrix-react-sdk/pull/8571)). Fixes vector-im/element-web#17406.
 * Improve message editing UI ([\#8483](https://github.com/matrix-org/matrix-react-sdk/pull/8483)). Fixes vector-im/element-web#9752 and vector-im/element-web#22108.
 * Make date changes more obvious ([\#6410](https://github.com/matrix-org/matrix-react-sdk/pull/6410)). Fixes vector-im/element-web#16221.
 * Enable forwarding static locations ([\#8553](https://github.com/matrix-org/matrix-react-sdk/pull/8553)).
 * Log `TimelinePanel` debugging info when opening the bug report modal ([\#8502](https://github.com/matrix-org/matrix-react-sdk/pull/8502)).
 * Improve welcome screen, add opt-out analytics ([\#8474](https://github.com/matrix-org/matrix-react-sdk/pull/8474)). Fixes vector-im/element-web#21946.
 * Converting selected text to MD link when pasting a URL ([\#8242](https://github.com/matrix-org/matrix-react-sdk/pull/8242)). Fixes vector-im/element-web#21634. Contributed by @Sinharitik589.
 * Support Inter on custom themes ([\#8399](https://github.com/matrix-org/matrix-react-sdk/pull/8399)). Fixes vector-im/element-web#16293.
 * Add a `Copy link` button to the right-click message context-menu labs feature ([\#8527](https://github.com/matrix-org/matrix-react-sdk/pull/8527)).
 * Move widget screenshots labs flag to devtools ([\#8522](https://github.com/matrix-org/matrix-react-sdk/pull/8522)).
 * Remove some labs features which don't get used or create maintenance burden: custom status, multiple integration managers, and do not disturb ([\#8521](https://github.com/matrix-org/matrix-react-sdk/pull/8521)).
 * Add a way to toggle `ScrollPanel` and `TimelinePanel` debug logs ([\#8513](https://github.com/matrix-org/matrix-react-sdk/pull/8513)).
 * Spaces: remove blue beta dot ([\#8511](https://github.com/matrix-org/matrix-react-sdk/pull/8511)). Fixes vector-im/element-web#22061.
 * Order new search dialog results by recency ([\#8444](https://github.com/matrix-org/matrix-react-sdk/pull/8444)).
 * Improve pills ([\#6398](https://github.com/matrix-org/matrix-react-sdk/pull/6398)). Fixes vector-im/element-web#16948 and vector-im/element-web#21281.
 * Add a way to maximize/pin widget from the PiP view ([\#7672](https://github.com/matrix-org/matrix-react-sdk/pull/7672)). Fixes vector-im/element-web#20723.
 * Iterate video room designs in labs ([\#8499](https://github.com/matrix-org/matrix-react-sdk/pull/8499)).
 * Improve UI/UX in calls ([\#7791](https://github.com/matrix-org/matrix-react-sdk/pull/7791)). Fixes vector-im/element-web#19937.
 * Add ability to change audio and video devices during a call ([\#7173](https://github.com/matrix-org/matrix-react-sdk/pull/7173)). Fixes vector-im/element-web#15595.

## 🐛 Bug Fixes
 * Fix video rooms sometimes connecting muted when they shouldn't ([\#22125](https://github.com/vector-im/element-web/pull/22125)).
 * Avoid flashing the 'join conference' button at the user in video rooms ([\#22120](https://github.com/vector-im/element-web/pull/22120)).
 * Fully close Jitsi conferences on errors ([\#22060](https://github.com/vector-im/element-web/pull/22060)).
 * Fix click behavior of notification badges on spaces ([\#8627](https://github.com/matrix-org/matrix-react-sdk/pull/8627)). Fixes vector-im/element-web#22241.
 * Add missing return values in Read Receipt animation code ([\#8625](https://github.com/matrix-org/matrix-react-sdk/pull/8625)). Fixes vector-im/element-web#22175.
 * Fix 'continue' button not working after accepting identity server terms of service ([\#8619](https://github.com/matrix-org/matrix-react-sdk/pull/8619)). Fixes vector-im/element-web#20003.
 * Proactively fix stuck devices in video rooms ([\#8587](https://github.com/matrix-org/matrix-react-sdk/pull/8587)). Fixes vector-im/element-web#22131.
 * Fix position of the message action bar on left side bubbles ([\#8398](https://github.com/matrix-org/matrix-react-sdk/pull/8398)). Fixes vector-im/element-web#21879. Contributed by @luixxiul.
 * Fix edge case thread summaries around events without a msgtype ([\#8576](https://github.com/matrix-org/matrix-react-sdk/pull/8576)).
 * Fix favourites metaspace not updating ([\#8594](https://github.com/matrix-org/matrix-react-sdk/pull/8594)). Fixes vector-im/element-web#22156.
 * Stop spaces from displaying as rooms in new breadcrumbs ([\#8595](https://github.com/matrix-org/matrix-react-sdk/pull/8595)). Fixes vector-im/element-web#22165.
 * Fix avatar position of hidden event on ThreadView ([\#8592](https://github.com/matrix-org/matrix-react-sdk/pull/8592)). Fixes vector-im/element-web#22199. Contributed by @luixxiul.
 * Fix MessageTimestamp position next to redacted messages on IRC/modern layout ([\#8591](https://github.com/matrix-org/matrix-react-sdk/pull/8591)). Fixes vector-im/element-web#22181. Contributed by @luixxiul.
 * Fix padding of messages in threads ([\#8574](https://github.com/matrix-org/matrix-react-sdk/pull/8574)). Contributed by @luixxiul.
 * Enable overflow of hidden events content ([\#8585](https://github.com/matrix-org/matrix-react-sdk/pull/8585)). Fixes vector-im/element-web#22187. Contributed by @luixxiul.
 * Increase composer line height to avoid cutting off emoji ([\#8583](https://github.com/matrix-org/matrix-react-sdk/pull/8583)). Fixes vector-im/element-web#22170.
 * Don't consider threads for breaking continuation until actually created ([\#8581](https://github.com/matrix-org/matrix-react-sdk/pull/8581)). Fixes vector-im/element-web#22164.
 * Fix displaying hidden events on threads  ([\#8555](https://github.com/matrix-org/matrix-react-sdk/pull/8555)). Fixes vector-im/element-web#22058. Contributed by @luixxiul.
 * Fix button width and align 絵文字 (emoji) on the user panel ([\#8562](https://github.com/matrix-org/matrix-react-sdk/pull/8562)). Fixes vector-im/element-web#22142. Contributed by @luixxiul.
 * Standardise the margin for settings tabs ([\#7963](https://github.com/matrix-org/matrix-react-sdk/pull/7963)). Fixes vector-im/element-web#20767. Contributed by @yuktea.
 * Fix room history not being visible even if we have historical keys ([\#8563](https://github.com/matrix-org/matrix-react-sdk/pull/8563)). Fixes vector-im/element-web#16983.
 * Fix oblong avatars in video room lobbies ([\#8565](https://github.com/matrix-org/matrix-react-sdk/pull/8565)).
 * Update thread summary when latest event gets decrypted ([\#8564](https://github.com/matrix-org/matrix-react-sdk/pull/8564)). Fixes vector-im/element-web#22151.
 * Fix codepath which can wrongly cause automatic space switch from all rooms ([\#8560](https://github.com/matrix-org/matrix-react-sdk/pull/8560)). Fixes vector-im/element-web#21373.
 * Fix effect of URL preview toggle not updating live ([\#8561](https://github.com/matrix-org/matrix-react-sdk/pull/8561)). Fixes vector-im/element-web#22148.
 * Fix visual bugs on AccessSecretStorageDialog ([\#8160](https://github.com/matrix-org/matrix-react-sdk/pull/8160)). Fixes vector-im/element-web#19426. Contributed by @luixxiul.
 * Fix the width bounce of the clock on the AudioPlayer ([\#8320](https://github.com/matrix-org/matrix-react-sdk/pull/8320)). Fixes vector-im/element-web#21788. Contributed by @luixxiul.
 * Hide the verification left stroke only on the thread list ([\#8525](https://github.com/matrix-org/matrix-react-sdk/pull/8525)). Fixes vector-im/element-web#22132. Contributed by @luixxiul.
 * Hide recently_viewed dropdown when other modal opens ([\#8538](https://github.com/matrix-org/matrix-react-sdk/pull/8538)). Contributed by @yaya-usman.
 * Only jump to date after pressing the 'go' button ([\#8548](https://github.com/matrix-org/matrix-react-sdk/pull/8548)). Fixes vector-im/element-web#20799.
 * Fix download button not working on events that were decrypted too late ([\#8556](https://github.com/matrix-org/matrix-react-sdk/pull/8556)). Fixes vector-im/element-web#19427.
 * Align thread summary button with bubble messages on the left side ([\#8388](https://github.com/matrix-org/matrix-react-sdk/pull/8388)). Fixes vector-im/element-web#21873. Contributed by @luixxiul.
 * Fix unresponsive notification toggles ([\#8549](https://github.com/matrix-org/matrix-react-sdk/pull/8549)). Fixes vector-im/element-web#22109.
 * Set color-scheme property in themes ([\#8547](https://github.com/matrix-org/matrix-react-sdk/pull/8547)). Fixes vector-im/element-web#22124.
 * Improve the styling of error messages during search initialization. ([\#6899](https://github.com/matrix-org/matrix-react-sdk/pull/6899)). Fixes vector-im/element-web#19245 and vector-im/element-web#18164. Contributed by @KalleStruik.
 * Don't leave button tooltips open when closing modals ([\#8546](https://github.com/matrix-org/matrix-react-sdk/pull/8546)). Fixes vector-im/element-web#22121.
 * update matrix-analytics-events ([\#8543](https://github.com/matrix-org/matrix-react-sdk/pull/8543)).
 * Handle Jitsi Meet crashes more gracefully ([\#8541](https://github.com/matrix-org/matrix-react-sdk/pull/8541)).
 * Fix regression around pasting links ([\#8537](https://github.com/matrix-org/matrix-react-sdk/pull/8537)). Fixes vector-im/element-web#22117.
 * Fixes suggested room not ellipsized on shrinking ([\#8536](https://github.com/matrix-org/matrix-react-sdk/pull/8536)). Contributed by @yaya-usman.
 * Add global spacing between display name and location body ([\#8523](https://github.com/matrix-org/matrix-react-sdk/pull/8523)). Fixes vector-im/element-web#22111. Contributed by @luixxiul.
 * Add box-shadow to the reply preview on the main (left) panel only ([\#8397](https://github.com/matrix-org/matrix-react-sdk/pull/8397)). Fixes vector-im/element-web#21894. Contributed by @luixxiul.
 * Set line-height: 1 to RedactedBody inside GenericEventListSummary for IRC/modern layout ([\#8529](https://github.com/matrix-org/matrix-react-sdk/pull/8529)). Fixes vector-im/element-web#22112. Contributed by @luixxiul.
 * Fix position of timestamp on the chat panel in IRC layout and message edits history modal window ([\#8464](https://github.com/matrix-org/matrix-react-sdk/pull/8464)). Fixes vector-im/element-web#22011 and vector-im/element-web#22014. Contributed by @luixxiul.
 * Fix unexpected and inconsistent inheritance of line-height property for mx_TextualEvent ([\#8485](https://github.com/matrix-org/matrix-react-sdk/pull/8485)). Fixes vector-im/element-web#22041. Contributed by @luixxiul.
 * Set the same margin to the right side of NewRoomIntro on TimelineCard ([\#8453](https://github.com/matrix-org/matrix-react-sdk/pull/8453)). Contributed by @luixxiul.
 * Remove duplicate tooltip from user pills ([\#8512](https://github.com/matrix-org/matrix-react-sdk/pull/8512)).
 * Set max-width for MLocationBody and MLocationBody_map by default ([\#8519](https://github.com/matrix-org/matrix-react-sdk/pull/8519)). Fixes vector-im/element-web#21983. Contributed by @luixxiul.
 * Simplify ReplyPreview UI implementation ([\#8516](https://github.com/matrix-org/matrix-react-sdk/pull/8516)). Fixes vector-im/element-web#22091. Contributed by @luixxiul.
 * Fix thread summary overflow on narrow message panel on bubble message layout ([\#8520](https://github.com/matrix-org/matrix-react-sdk/pull/8520)). Fixes vector-im/element-web#22097. Contributed by @luixxiul.
 * Live location sharing - refresh beacon timers on tab becoming active ([\#8515](https://github.com/matrix-org/matrix-react-sdk/pull/8515)).
 * Enlarge emoji again ([\#8509](https://github.com/matrix-org/matrix-react-sdk/pull/8509)). Fixes vector-im/element-web#22086.
 * Order receipts with the most recent on the right ([\#8506](https://github.com/matrix-org/matrix-react-sdk/pull/8506)). Fixes vector-im/element-web#22044.
 * Disconnect from video rooms when leaving ([\#8500](https://github.com/matrix-org/matrix-react-sdk/pull/8500)).
 * Fix soft crash around threads when room isn't yet in store ([\#8496](https://github.com/matrix-org/matrix-react-sdk/pull/8496)). Fixes vector-im/element-web#22047.
 * Fix reading of cached room device setting values ([\#8491](https://github.com/matrix-org/matrix-react-sdk/pull/8491)).
 * Add loading spinners to threads panels ([\#8490](https://github.com/matrix-org/matrix-react-sdk/pull/8490)). Fixes vector-im/element-web#21335.
 * Fix forwarding UI papercuts ([\#8482](https://github.com/matrix-org/matrix-react-sdk/pull/8482)). Fixes vector-im/element-web#17616.

Changes in [1.10.12](https://github.com/vector-im/element-desktop/releases/tag/v1.10.12) (2022-05-10)
=====================================================================================================

## ✨ Features
 * Made the location map change the cursor to a pointer so it looks like it's clickable (https ([\#8451](https://github.com/matrix-org/matrix-react-sdk/pull/8451)). Fixes vector-im/element-web#21991. Contributed by @Odyssey346.
 * Implement improved spacing for the thread list and timeline ([\#8337](https://github.com/matrix-org/matrix-react-sdk/pull/8337)). Fixes vector-im/element-web#21759. Contributed by @luixxiul.
 * LLS: expose way to enable live sharing labs flag from location dialog ([\#8416](https://github.com/matrix-org/matrix-react-sdk/pull/8416)).
 * Fix source text boxes in View Source modal should have full width ([\#8425](https://github.com/matrix-org/matrix-react-sdk/pull/8425)). Fixes vector-im/element-web#21938. Contributed by @EECvision.
 * Read Receipts: never show +1, if it’s just 4, show all of them ([\#8428](https://github.com/matrix-org/matrix-react-sdk/pull/8428)). Fixes vector-im/element-web#21935.
 * Add opt-in analytics to onboarding tasks ([\#8409](https://github.com/matrix-org/matrix-react-sdk/pull/8409)). Fixes vector-im/element-web#21705.
 * Allow user to control if they are signed out of all devices when changing password ([\#8259](https://github.com/matrix-org/matrix-react-sdk/pull/8259)). Fixes vector-im/element-web#2671.
 * Implement new Read Receipt design ([\#8389](https://github.com/matrix-org/matrix-react-sdk/pull/8389)). Fixes vector-im/element-web#20574.
 * Stick connected video rooms to the top of the room list ([\#8353](https://github.com/matrix-org/matrix-react-sdk/pull/8353)).
 * LLS: fix jumpy maximised map ([\#8387](https://github.com/matrix-org/matrix-react-sdk/pull/8387)).
 * Persist audio and video mute state in video rooms ([\#8376](https://github.com/matrix-org/matrix-react-sdk/pull/8376)).
 * Forcefully disconnect from video rooms on logout and tab close ([\#8375](https://github.com/matrix-org/matrix-react-sdk/pull/8375)).
 * Add local echo of connected devices in video rooms ([\#8368](https://github.com/matrix-org/matrix-react-sdk/pull/8368)).
 * Improve text of account deactivation dialog ([\#8371](https://github.com/matrix-org/matrix-react-sdk/pull/8371)). Fixes vector-im/element-web#17421.
 * Live location sharing: own live beacon status on maximised view ([\#8374](https://github.com/matrix-org/matrix-react-sdk/pull/8374)).
 * Show a lobby screen in video rooms ([\#8287](https://github.com/matrix-org/matrix-react-sdk/pull/8287)).
 * Settings toggle to disable Composer Markdown ([\#8358](https://github.com/matrix-org/matrix-react-sdk/pull/8358)). Fixes vector-im/element-web#20321.
 * Cache localStorage objects for SettingsStore ([\#8366](https://github.com/matrix-org/matrix-react-sdk/pull/8366)).
 * Bring `View Source` back from behind developer mode ([\#8369](https://github.com/matrix-org/matrix-react-sdk/pull/8369)). Fixes vector-im/element-web#21771.

## 🐛 Bug Fixes
 * Fix update from creating desktop shortcut ([\#333](https://github.com/vector-im/element-desktop/pull/333)). Fixes vector-im/element-web#9210. Contributed by @elibroftw.
 * Fix macOS and Linux build regressions ([\#345](https://github.com/vector-im/element-desktop/pull/345)).
 * Allow loading language files with two part language code ([\#339](https://github.com/vector-im/element-desktop/pull/339)). Contributed by @TPiUnikie.
 * Fix Jitsi Meet getting wedged at startup in some cases ([\#21995](https://github.com/vector-im/element-web/pull/21995)).
 * Fix camera getting muted when disconnecting from a video room ([\#21958](https://github.com/vector-im/element-web/pull/21958)).
 * Fix race conditions around threads ([\#8448](https://github.com/matrix-org/matrix-react-sdk/pull/8448)). Fixes vector-im/element-web#21627.
 * Fix reading of cached room device setting values ([\#8495](https://github.com/matrix-org/matrix-react-sdk/pull/8495)).
 * Fix issue with dispatch happening mid-dispatch due to js-sdk emit ([\#8473](https://github.com/matrix-org/matrix-react-sdk/pull/8473)). Fixes vector-im/element-web#22019.
 * Match MSC behaviour for threads when disabled (thread-aware mode) ([\#8476](https://github.com/matrix-org/matrix-react-sdk/pull/8476)). Fixes vector-im/element-web#22033.
 * Specify position of DisambiguatedProfile inside a thread on bubble message layout ([\#8452](https://github.com/matrix-org/matrix-react-sdk/pull/8452)). Fixes vector-im/element-web#21998. Contributed by @luixxiul.
 * Location sharing: do not trackuserlocation in location picker ([\#8466](https://github.com/matrix-org/matrix-react-sdk/pull/8466)). Fixes vector-im/element-web#22013.
 * fix text and map indent in thread view ([\#8462](https://github.com/matrix-org/matrix-react-sdk/pull/8462)). Fixes vector-im/element-web#21997.
 * Live location sharing: don't group beacon info with room creation summary ([\#8468](https://github.com/matrix-org/matrix-react-sdk/pull/8468)).
 * Don't linkify code blocks ([\#7859](https://github.com/matrix-org/matrix-react-sdk/pull/7859)). Fixes vector-im/element-web#9613.
 * read receipts: improve tooltips to show names of users ([\#8438](https://github.com/matrix-org/matrix-react-sdk/pull/8438)). Fixes vector-im/element-web#21940.
 * Fix poll overflowing a reply tile on bubble message layout ([\#8459](https://github.com/matrix-org/matrix-react-sdk/pull/8459)). Fixes vector-im/element-web#22005. Contributed by @luixxiul.
 * Fix text link buttons on UserInfo panel ([\#8247](https://github.com/matrix-org/matrix-react-sdk/pull/8247)). Fixes vector-im/element-web#21702. Contributed by @luixxiul.
 * Clear local storage settings handler cache on logout ([\#8454](https://github.com/matrix-org/matrix-react-sdk/pull/8454)). Fixes vector-im/element-web#21994.
 * Fix jump to bottom button being always displayed in non-overflowing timelines ([\#8460](https://github.com/matrix-org/matrix-react-sdk/pull/8460)). Fixes vector-im/element-web#22003.
 * fix timeline search with empty text box should do nothing ([\#8262](https://github.com/matrix-org/matrix-react-sdk/pull/8262)). Fixes vector-im/element-web#21714. Contributed by @EECvision.
 * Fixes "space panel kebab menu is rendered out of view on sub spaces"  ([\#8350](https://github.com/matrix-org/matrix-react-sdk/pull/8350)). Contributed by @yaya-usman.
 * Add margin to the location map inside ThreadView ([\#8442](https://github.com/matrix-org/matrix-react-sdk/pull/8442)). Fixes vector-im/element-web#21982. Contributed by @luixxiul.
 * Patch: "Reloading the registration page should warn about data loss" ([\#8377](https://github.com/matrix-org/matrix-react-sdk/pull/8377)). Contributed by @yaya-usman.
 * Live location sharing: fix safari timestamps pt 2 ([\#8443](https://github.com/matrix-org/matrix-react-sdk/pull/8443)).
 * Fix issue with thread notification state ignoring initial events ([\#8417](https://github.com/matrix-org/matrix-react-sdk/pull/8417)). Fixes vector-im/element-web#21927.
 * Fix event text overflow on bubble message layout ([\#8391](https://github.com/matrix-org/matrix-react-sdk/pull/8391)). Fixes vector-im/element-web#21882. Contributed by @luixxiul.
 * Disable the message action bar when hovering over the 1px border between threads on the list ([\#8429](https://github.com/matrix-org/matrix-react-sdk/pull/8429)). Fixes vector-im/element-web#21955. Contributed by @luixxiul.
 * correctly align read receipts to state events in bubble layout ([\#8419](https://github.com/matrix-org/matrix-react-sdk/pull/8419)). Fixes vector-im/element-web#21899.
 * Fix issue with underfilled timelines when barren of content ([\#8432](https://github.com/matrix-org/matrix-react-sdk/pull/8432)). Fixes vector-im/element-web#21930.
 * Fix baseline misalignment of thread panel summary by deduplication ([\#8413](https://github.com/matrix-org/matrix-react-sdk/pull/8413)).
 * Fix editing of non-html replies ([\#8418](https://github.com/matrix-org/matrix-react-sdk/pull/8418)). Fixes vector-im/element-web#21928.
 * Read Receipts "Fall from the Sky" ([\#8414](https://github.com/matrix-org/matrix-react-sdk/pull/8414)). Fixes vector-im/element-web#21888.
 * Make read receipts handle nullable roomMembers correctly ([\#8410](https://github.com/matrix-org/matrix-react-sdk/pull/8410)). Fixes vector-im/element-web#21896.
 * Don't form continuations on either side of a thread root ([\#8408](https://github.com/matrix-org/matrix-react-sdk/pull/8408)). Fixes vector-im/element-web#20908.
 * Fix centering issue with sticker placeholder ([\#8404](https://github.com/matrix-org/matrix-react-sdk/pull/8404)). Fixes vector-im/element-web#18014 and vector-im/element-web#6449.
 * Disable download option on <video/> , preferring dedicated download button ([\#8403](https://github.com/matrix-org/matrix-react-sdk/pull/8403)). Fixes vector-im/element-web#21902.
 * Fix infinite loop when pinning/unpinning persistent widgets ([\#8396](https://github.com/matrix-org/matrix-react-sdk/pull/8396)). Fixes vector-im/element-web#21864.
 * Tweak ReadReceiptGroup to better handle disambiguation ([\#8402](https://github.com/matrix-org/matrix-react-sdk/pull/8402)). Fixes vector-im/element-web#21897.
 * stop the bottom edge of buttons getting clipped in devtools ([\#8400](https://github.com/matrix-org/matrix-react-sdk/pull/8400)).
 * Fix issue with threads timelines with few events cropping events ([\#8392](https://github.com/matrix-org/matrix-react-sdk/pull/8392)). Fixes vector-im/element-web#20594.
 * Changed font-weight to 400 to support light weight font ([\#8345](https://github.com/matrix-org/matrix-react-sdk/pull/8345)). Fixes vector-im/element-web#21171. Contributed by @goelesha.
 * Fix issue with thread panel not updating when it loads on first render ([\#8382](https://github.com/matrix-org/matrix-react-sdk/pull/8382)). Fixes vector-im/element-web#21737.
 * fix: "Mention highlight and cursor hover highlight has different corner radius" ([\#8384](https://github.com/matrix-org/matrix-react-sdk/pull/8384)). Contributed by @yaya-usman.
 * Fix regression around haveRendererForEvent for hidden events ([\#8379](https://github.com/matrix-org/matrix-react-sdk/pull/8379)). Fixes vector-im/element-web#21862 and vector-im/element-web#21725.
 * Fix regression around the room list treeview keyboard a11y ([\#8385](https://github.com/matrix-org/matrix-react-sdk/pull/8385)). Fixes vector-im/element-web#21436.
 * Remove float property to let the margin between events appear on bubble message layout ([\#8373](https://github.com/matrix-org/matrix-react-sdk/pull/8373)). Fixes vector-im/element-web#21861. Contributed by @luixxiul.
 * Fix race in Registration between server change and flows fetch ([\#8359](https://github.com/matrix-org/matrix-react-sdk/pull/8359)). Fixes vector-im/element-web#21800.
 * fix rainbow breaks compound emojis ([\#8245](https://github.com/matrix-org/matrix-react-sdk/pull/8245)). Fixes vector-im/element-web#21371. Contributed by @EECvision.
 * Fix RightPanelStore handling first room on app launch wrong ([\#8370](https://github.com/matrix-org/matrix-react-sdk/pull/8370)). Fixes vector-im/element-web#21741.
 * Fix UnknownBody error message unalignment ([\#8346](https://github.com/matrix-org/matrix-react-sdk/pull/8346)). Fixes vector-im/element-web#21828. Contributed by @luixxiul.
 * Use -webkit-line-clamp for the room header topic overflow ([\#8367](https://github.com/matrix-org/matrix-react-sdk/pull/8367)). Fixes vector-im/element-web#21852. Contributed by @luixxiul.
 * Fix issue with ServerInfo crashing the modal ([\#8364](https://github.com/matrix-org/matrix-react-sdk/pull/8364)).
 * Fixes around threads beta in degraded mode ([\#8319](https://github.com/matrix-org/matrix-react-sdk/pull/8319)). Fixes vector-im/element-web#21762.

Changes in [1.10.11](https://github.com/vector-im/element-desktop/releases/tag/v1.10.11) (2022-04-26)
=====================================================================================================

## ✨ Features
 * Handle forced disconnects from Jitsi ([\#21697](https://github.com/vector-im/element-web/pull/21697)). Fixes vector-im/element-web#21517.
 * Improve performance of switching to rooms with lots of servers and ACLs ([\#8347](https://github.com/matrix-org/matrix-react-sdk/pull/8347)).
 * Avoid a reflow when setting caret position on an empty composer ([\#8348](https://github.com/matrix-org/matrix-react-sdk/pull/8348)).
 * Add message right-click context menu as a labs feature ([\#5672](https://github.com/matrix-org/matrix-react-sdk/pull/5672)).
 * Live location sharing - basic maximised beacon map ([\#8310](https://github.com/matrix-org/matrix-react-sdk/pull/8310)).
 * Live location sharing - render users own beacons in timeline ([\#8296](https://github.com/matrix-org/matrix-react-sdk/pull/8296)).
 * Improve Threads beta around degraded mode ([\#8318](https://github.com/matrix-org/matrix-react-sdk/pull/8318)).
 * Live location sharing -  beacon in timeline happy path ([\#8285](https://github.com/matrix-org/matrix-react-sdk/pull/8285)).
 * Add copy button to View Source screen ([\#8278](https://github.com/matrix-org/matrix-react-sdk/pull/8278)). Fixes vector-im/element-web#21482. Contributed by @olivialivia.
 * Add heart effect ([\#6188](https://github.com/matrix-org/matrix-react-sdk/pull/6188)). Contributed by @CicadaCinema.
 * Update new room icon ([\#8239](https://github.com/matrix-org/matrix-react-sdk/pull/8239)).

## 🐛 Bug Fixes
 * Prevent packing of native modules ([\#337](https://github.com/vector-im/element-desktop/pull/337)). Fixes vector-im/element-web#17188. Contributed by @PF4Public.
 * Fix: "Code formatting button does not escape backticks" ([\#8181](https://github.com/matrix-org/matrix-react-sdk/pull/8181)). Contributed by @yaya-usman.
 * Fix beta indicator dot causing excessive CPU usage ([\#8340](https://github.com/matrix-org/matrix-react-sdk/pull/8340)). Fixes vector-im/element-web#21793.
 * Fix overlapping timestamps on empty messages ([\#8205](https://github.com/matrix-org/matrix-react-sdk/pull/8205)). Fixes vector-im/element-web#21381. Contributed by @goelesha.
 * Fix power selector not showing up in user info when state_default undefined ([\#8297](https://github.com/matrix-org/matrix-react-sdk/pull/8297)). Fixes vector-im/element-web#21669.
 * Avoid looking up settings during timeline rendering ([\#8313](https://github.com/matrix-org/matrix-react-sdk/pull/8313)). Fixes vector-im/element-web#21740.
 * Fix a soft crash with video rooms ([\#8333](https://github.com/matrix-org/matrix-react-sdk/pull/8333)).
 * Fixes call tiles overflow ([\#8096](https://github.com/matrix-org/matrix-react-sdk/pull/8096)). Fixes vector-im/element-web#20254. Contributed by @luixxiul.
 * Fix a bug with emoji autocomplete sorting where adding the final "&#58;" would cause the emoji with the typed shortcode to no longer be at the top of the autocomplete list. ([\#8086](https://github.com/matrix-org/matrix-react-sdk/pull/8086)). Fixes vector-im/element-web#19302. Contributed by @commonlawfeature.
 * Fix image preview sizing for edge cases ([\#8322](https://github.com/matrix-org/matrix-react-sdk/pull/8322)). Fixes vector-im/element-web#20088.
 * Refactor SecurityRoomSettingsTab and remove unused state ([\#8306](https://github.com/matrix-org/matrix-react-sdk/pull/8306)). Fixes matrix-org/element-web-rageshakes#12002.
 * Don't show the prompt to enable desktop notifications immediately after registration ([\#8274](https://github.com/matrix-org/matrix-react-sdk/pull/8274)).
 * Stop tracking threads if threads support is disabled ([\#8308](https://github.com/matrix-org/matrix-react-sdk/pull/8308)). Fixes vector-im/element-web#21766.
 * Fix some issues with threads rendering ([\#8305](https://github.com/matrix-org/matrix-react-sdk/pull/8305)). Fixes vector-im/element-web#21670.
 * Fix threads rendering issue in Safari ([\#8298](https://github.com/matrix-org/matrix-react-sdk/pull/8298)). Fixes vector-im/element-web#21757.
 * Fix space panel width change on hovering over space item ([\#8299](https://github.com/matrix-org/matrix-react-sdk/pull/8299)). Fixes vector-im/element-web#19891.
 * Hide the reply in thread button in deployments where beta is forcibly disabled ([\#8294](https://github.com/matrix-org/matrix-react-sdk/pull/8294)). Fixes vector-im/element-web#21753.
 * Prevent soft crash around room list header context menu when space changes ([\#8289](https://github.com/matrix-org/matrix-react-sdk/pull/8289)). Fixes matrix-org/element-web-rageshakes#11416, matrix-org/element-web-rageshakes#11692, matrix-org/element-web-rageshakes#11739, matrix-org/element-web-rageshakes#11772, matrix-org/element-web-rageshakes#11891 matrix-org/element-web-rageshakes#11858 and matrix-org/element-web-rageshakes#11456.
 * When selecting reply in thread on a thread response open existing thread ([\#8291](https://github.com/matrix-org/matrix-react-sdk/pull/8291)). Fixes vector-im/element-web#21743.
 * Handle thread bundled relationships coming from the server via MSC3666 ([\#8292](https://github.com/matrix-org/matrix-react-sdk/pull/8292)). Fixes vector-im/element-web#21450.
 * Fix: Avatar preview does not update when same file is selected repeatedly ([\#8288](https://github.com/matrix-org/matrix-react-sdk/pull/8288)). Fixes vector-im/element-web#20098.
 * Fix a bug where user gets a warning when changing powerlevel from **Admin** to **custom level (100)** ([\#8248](https://github.com/matrix-org/matrix-react-sdk/pull/8248)). Fixes vector-im/element-web#21682. Contributed by @Jumeb.
 * Use a consistent alignment for all text items in a list ([\#8276](https://github.com/matrix-org/matrix-react-sdk/pull/8276)). Fixes vector-im/element-web#21731. Contributed by @luixxiul.
 * Fixes button labels being collapsed per a character in CJK languages ([\#8212](https://github.com/matrix-org/matrix-react-sdk/pull/8212)). Fixes vector-im/element-web#21287. Contributed by @luixxiul.
 * Fix: Remove jittery timeline scrolling after jumping to an event ([\#8263](https://github.com/matrix-org/matrix-react-sdk/pull/8263)).
 * Fix regression of edits showing up in the timeline with hidden events shown ([\#8260](https://github.com/matrix-org/matrix-react-sdk/pull/8260)). Fixes vector-im/element-web#21694.
 * Fix reporting events not working ([\#8257](https://github.com/matrix-org/matrix-react-sdk/pull/8257)). Fixes vector-im/element-web#21713.
 * Make Jitsi widgets in video rooms immutable ([\#8244](https://github.com/matrix-org/matrix-react-sdk/pull/8244)). Fixes vector-im/element-web#21647.
 * Fix: Ensure links to events scroll the correct events into view ([\#8250](https://github.com/matrix-org/matrix-react-sdk/pull/8250)). Fixes vector-im/element-web#19934.

Changes in [1.10.10](https://github.com/vector-im/element-desktop/releases/tag/v1.10.10) (2022-04-14)
=====================================================================================================

## 🐛 Bug Fixes
 * Fixes around threads beta in degraded mode ([\#8319](https://github.com/matrix-org/matrix-react-sdk/pull/8319)). Fixes vector-im/element-web#21762.

Changes in [1.10.9](https://github.com/vector-im/element-desktop/releases/tag/v1.10.9) (2022-04-12)
===================================================================================================

## ✨ Features
 * Release threads as a beta feature ([\#8081](https://github.com/matrix-org/matrix-react-sdk/pull/8081)). Fixes vector-im/element-web#21351.
 * More video rooms design updates ([\#8222](https://github.com/matrix-org/matrix-react-sdk/pull/8222)).
 * Update video rooms to new design specs ([\#8207](https://github.com/matrix-org/matrix-react-sdk/pull/8207)). Fixes vector-im/element-web#21515, vector-im/element-web#21516 vector-im/element-web#21519 and vector-im/element-web#21526.
 * Live Location Sharing - left panel warning with error ([\#8201](https://github.com/matrix-org/matrix-react-sdk/pull/8201)).
 * Live location sharing - Stop publishing location to beacons with consecutive errors ([\#8194](https://github.com/matrix-org/matrix-react-sdk/pull/8194)).
 * Live location sharing: allow retry when stop sharing fails ([\#8193](https://github.com/matrix-org/matrix-react-sdk/pull/8193)).
 * Allow voice messages to be scrubbed in the timeline ([\#8079](https://github.com/matrix-org/matrix-react-sdk/pull/8079)). Fixes vector-im/element-web#18713.
 * Live location sharing - stop sharing to beacons in rooms you left ([\#8187](https://github.com/matrix-org/matrix-react-sdk/pull/8187)).
 * Allow sending and thumbnailing AVIF images ([\#8172](https://github.com/matrix-org/matrix-react-sdk/pull/8172)).
 * Live location sharing - handle geolocation errors ([\#8179](https://github.com/matrix-org/matrix-react-sdk/pull/8179)).
 * Show voice room participants when not connected ([\#8136](https://github.com/matrix-org/matrix-react-sdk/pull/8136)). Fixes vector-im/element-web#21513.
 * Add margins between labs sections ([\#8169](https://github.com/matrix-org/matrix-react-sdk/pull/8169)).
 * Live location sharing - send geolocation beacon events - happy path ([\#8127](https://github.com/matrix-org/matrix-react-sdk/pull/8127)).
 * Add support for Animated (A)PNG ([\#8158](https://github.com/matrix-org/matrix-react-sdk/pull/8158)). Fixes vector-im/element-web#12967.
 * Don't form continuations from thread roots ([\#8166](https://github.com/matrix-org/matrix-react-sdk/pull/8166)). Fixes vector-im/element-web#20908.
 * Improve handling of animated GIF and WEBP images ([\#8153](https://github.com/matrix-org/matrix-react-sdk/pull/8153)). Fixes vector-im/element-web#16193 and vector-im/element-web#6684.
 * Wire up file preview for video files ([\#8140](https://github.com/matrix-org/matrix-react-sdk/pull/8140)). Fixes vector-im/element-web#21539.
 * When showing thread, always auto-focus its composer ([\#8115](https://github.com/matrix-org/matrix-react-sdk/pull/8115)). Fixes vector-im/element-web#21438.
 * Live location sharing - refresh beacon expiry in room ([\#8116](https://github.com/matrix-org/matrix-react-sdk/pull/8116)).
 * Use styled mxids in member list v2 ([\#8110](https://github.com/matrix-org/matrix-react-sdk/pull/8110)). Fixes vector-im/element-web#14825. Contributed by @SimonBrandner.
 * Delete groups (legacy communities system) ([\#8027](https://github.com/matrix-org/matrix-react-sdk/pull/8027)). Fixes vector-im/element-web#17532.
 * Add a prototype of voice rooms in labs ([\#8084](https://github.com/matrix-org/matrix-react-sdk/pull/8084)). Fixes vector-im/element-web#3546.

## 🐛 Bug Fixes
 * Avoid flashing the Jitsi prejoin screen at the user before skipping it ([\#21665](https://github.com/vector-im/element-web/pull/21665)).
 * Fix editing `<ol>` tags with a non-1 start attribute ([\#8211](https://github.com/matrix-org/matrix-react-sdk/pull/8211)). Fixes vector-im/element-web#21625.
 * Fix URL previews being enabled when room first created ([\#8227](https://github.com/matrix-org/matrix-react-sdk/pull/8227)). Fixes vector-im/element-web#21659.
 * Don't use m.call for Jitsi video rooms ([\#8223](https://github.com/matrix-org/matrix-react-sdk/pull/8223)).
 * Scale emoji with size of surrounding text ([\#8224](https://github.com/matrix-org/matrix-react-sdk/pull/8224)).
 * Make "Jump to date" translatable ([\#8218](https://github.com/matrix-org/matrix-react-sdk/pull/8218)).
 * Normalize call buttons ([\#8129](https://github.com/matrix-org/matrix-react-sdk/pull/8129)). Fixes vector-im/element-web#21493. Contributed by @luixxiul.
 * Show room preview bar with maximised widgets ([\#8180](https://github.com/matrix-org/matrix-react-sdk/pull/8180)). Fixes vector-im/element-web#21542.
 * Update more strings to not wrongly mention room when it is/could be a space ([\#7722](https://github.com/matrix-org/matrix-react-sdk/pull/7722)). Fixes vector-im/element-web#20243 and vector-im/element-web#20910.
 * Fix issue with redacting via edit composer flow causing stuck editStates ([\#8184](https://github.com/matrix-org/matrix-react-sdk/pull/8184)).
 * Fix some image/video scroll jumps ([\#8182](https://github.com/matrix-org/matrix-react-sdk/pull/8182)).
 * Fix "react error on share dialog" ([\#8170](https://github.com/matrix-org/matrix-react-sdk/pull/8170)). Contributed by @yaya-usman.
 * Fix disambiguated profile in threads in bubble layout ([\#8168](https://github.com/matrix-org/matrix-react-sdk/pull/8168)). Fixes vector-im/element-web#21570. Contributed by @SimonBrandner.
 * Responsive BetaCard on Labs ([\#8154](https://github.com/matrix-org/matrix-react-sdk/pull/8154)). Fixes vector-im/element-web#21554. Contributed by @luixxiul.
 * Display button as inline in room directory dialog ([\#8164](https://github.com/matrix-org/matrix-react-sdk/pull/8164)). Fixes vector-im/element-web#21567. Contributed by @luixxiul.
 * Null guard TimelinePanel unmount edge ([\#8171](https://github.com/matrix-org/matrix-react-sdk/pull/8171)).
 * Fix beta pill label breaking ([\#8162](https://github.com/matrix-org/matrix-react-sdk/pull/8162)). Fixes vector-im/element-web#21566. Contributed by @luixxiul.
 * Strip relations when forwarding ([\#7929](https://github.com/matrix-org/matrix-react-sdk/pull/7929)). Fixes vector-im/element-web#19769, vector-im/element-web#18067 vector-im/element-web#21015 and vector-im/element-web#10924.
 * Don't try (and fail) to show replies for redacted events ([\#8141](https://github.com/matrix-org/matrix-react-sdk/pull/8141)). Fixes vector-im/element-web#21435.
 * Fix 3pid member info for space member list ([\#8128](https://github.com/matrix-org/matrix-react-sdk/pull/8128)). Fixes vector-im/element-web#21534.
 * Set max-width to user context menu ([\#8089](https://github.com/matrix-org/matrix-react-sdk/pull/8089)). Fixes vector-im/element-web#21486. Contributed by @luixxiul.
 * Fix issue with falsey hrefs being sent in events ([\#8113](https://github.com/matrix-org/matrix-react-sdk/pull/8113)). Fixes vector-im/element-web#21417.
 * Make video sizing consistent with images ([\#8102](https://github.com/matrix-org/matrix-react-sdk/pull/8102)). Fixes vector-im/element-web#20072.

Changes in [1.10.7](https://github.com/vector-im/element-desktop/releases/tag/v1.10.7) (2022-03-15)
===================================================================================================

## 🔒 SECURITY FIXES

 * Fix a bug where URL previews could be enabled in the left-panel when they
   should not have been.

## ✨ Features
 * Add a config.json option to skip the built-in Jitsi welcome screen ([\#21190](https://github.com/vector-im/element-web/pull/21190)).
 * Add unexposed account setting for hiding poll creation ([\#7972](https://github.com/matrix-org/matrix-react-sdk/pull/7972)).
 * Allow pinning polls ([\#7922](https://github.com/matrix-org/matrix-react-sdk/pull/7922)). Fixes vector-im/element-web#20152.
 * Make trailing `:` into a setting ([\#6711](https://github.com/matrix-org/matrix-react-sdk/pull/6711)). Fixes vector-im/element-web#16682. Contributed by @SimonBrandner.
 * Location sharing > back button ([\#7958](https://github.com/matrix-org/matrix-react-sdk/pull/7958)).
 * use LocationAssetType ([\#7965](https://github.com/matrix-org/matrix-react-sdk/pull/7965)).
 * Location share type UI ([\#7924](https://github.com/matrix-org/matrix-react-sdk/pull/7924)).
 * Add a few more UIComponent flags, and ensure they are used in existing code ([\#7937](https://github.com/matrix-org/matrix-react-sdk/pull/7937)).
 * Add support for overriding strings in the app ([\#7886](https://github.com/matrix-org/matrix-react-sdk/pull/7886)).
 * Add support for redirecting to external pages after logout ([\#7905](https://github.com/matrix-org/matrix-react-sdk/pull/7905)).
 * Expose redaction power level in room settings ([\#7599](https://github.com/matrix-org/matrix-react-sdk/pull/7599)). Fixes vector-im/element-web#20590. Contributed by @SimonBrandner.
 * Update and expand ways to access pinned messages ([\#7906](https://github.com/matrix-org/matrix-react-sdk/pull/7906)). Fixes vector-im/element-web#21209 and vector-im/element-web#21211.
 * Add slash command to switch to a room's virtual room ([\#7839](https://github.com/matrix-org/matrix-react-sdk/pull/7839)).

## 🐛 Bug Fixes
 * Remove Lojban translation ([\#21302](https://github.com/vector-im/element-web/pull/21302)).
 * Merge pull request from GHSA-qmf4-7w7j-vf23 ([\#8059](https://github.com/matrix-org/matrix-react-sdk/pull/8059)).
 * Add another null guard for member ([\#7984](https://github.com/matrix-org/matrix-react-sdk/pull/7984)). Fixes vector-im/element-web#21319.
 * Fix room account settings ([\#7999](https://github.com/matrix-org/matrix-react-sdk/pull/7999)).
 * Fix missing summary text for pinned message changes ([\#7989](https://github.com/matrix-org/matrix-react-sdk/pull/7989)). Fixes vector-im/element-web#19823.
 * Pass room to getRoomTombstone to avoid racing with setState ([\#7986](https://github.com/matrix-org/matrix-react-sdk/pull/7986)).
 * Hide composer and call buttons when the room is tombstoned ([\#7975](https://github.com/matrix-org/matrix-react-sdk/pull/7975)). Fixes vector-im/element-web#21286.
 * Fix bad ternary statement in autocomplete user pill insertions ([\#7977](https://github.com/matrix-org/matrix-react-sdk/pull/7977)). Fixes vector-im/element-web#21307.
 * Fix sending locations into threads and fix i18n ([\#7943](https://github.com/matrix-org/matrix-react-sdk/pull/7943)). Fixes vector-im/element-web#21267.
 * Fix location map attribution rendering over message action bar ([\#7974](https://github.com/matrix-org/matrix-react-sdk/pull/7974)). Fixes vector-im/element-web#21297.
 * Fix wrongly asserting that PushRule::conditions is non-null ([\#7973](https://github.com/matrix-org/matrix-react-sdk/pull/7973)). Fixes vector-im/element-web#21305.
 * Fix account & room settings race condition ([\#7953](https://github.com/matrix-org/matrix-react-sdk/pull/7953)). Fixes vector-im/element-web#21163.
 * Fix bug with some space selections not being applied ([\#7971](https://github.com/matrix-org/matrix-react-sdk/pull/7971)). Fixes vector-im/element-web#21290.
 * Revert "replace all require(.svg) with esm import" ([\#7969](https://github.com/matrix-org/matrix-react-sdk/pull/7969)). Fixes vector-im/element-web#21293.
 * Hide unpinnable pinned messages in more cases ([\#7921](https://github.com/matrix-org/matrix-react-sdk/pull/7921)).
 * Fix room list being laggy while scrolling 🐌 ([\#7939](https://github.com/matrix-org/matrix-react-sdk/pull/7939)). Fixes vector-im/element-web#21262.
 * Make pinned messages more reliably reflect edits ([\#7920](https://github.com/matrix-org/matrix-react-sdk/pull/7920)). Fixes vector-im/element-web#17098.
 * Improve accessibility of the BetaPill ([\#7949](https://github.com/matrix-org/matrix-react-sdk/pull/7949)). Fixes vector-im/element-web#21255.
 * Autofocus correct composer after sending reaction ([\#7950](https://github.com/matrix-org/matrix-react-sdk/pull/7950)). Fixes vector-im/element-web#21273.
 * Consider polls as message events for rendering redactions ([\#7944](https://github.com/matrix-org/matrix-react-sdk/pull/7944)). Fixes vector-im/element-web#21125.
 * Prevent event tiles being shrunk/collapsed by flexbox ([\#7942](https://github.com/matrix-org/matrix-react-sdk/pull/7942)). Fixes vector-im/element-web#21269.
 * Fix ExportDialog title on export cancellation ([\#7936](https://github.com/matrix-org/matrix-react-sdk/pull/7936)). Fixes vector-im/element-web#21260. Contributed by @luixxiul.
 * Mandate use of js-sdk/src/matrix import over js-sdk/src ([\#7933](https://github.com/matrix-org/matrix-react-sdk/pull/7933)). Fixes vector-im/element-web#21253.
 * Fix backspace not working in the invite dialog ([\#7931](https://github.com/matrix-org/matrix-react-sdk/pull/7931)). Fixes vector-im/element-web#21249. Contributed by @SimonBrandner.
 * Fix right panel soft crashes due to missing room prop ([\#7923](https://github.com/matrix-org/matrix-react-sdk/pull/7923)). Fixes vector-im/element-web#21243.
 * fix color of location share caret ([\#7917](https://github.com/matrix-org/matrix-react-sdk/pull/7917)).
 * Wrap all EventTiles with a TileErrorBoundary and guard parsePermalink ([\#7916](https://github.com/matrix-org/matrix-react-sdk/pull/7916)). Fixes vector-im/element-web#21216.
 * Fix changing space sometimes bouncing to the wrong space ([\#7910](https://github.com/matrix-org/matrix-react-sdk/pull/7910)). Fixes vector-im/element-web#20425.
 * Ensure EventListSummary key does not change during backpagination ([\#7915](https://github.com/matrix-org/matrix-react-sdk/pull/7915)). Fixes vector-im/element-web#9192.
 * Fix positioning of the thread context menu ([\#7918](https://github.com/matrix-org/matrix-react-sdk/pull/7918)). Fixes vector-im/element-web#21236.
 * Inject sender into pinned messages ([\#7904](https://github.com/matrix-org/matrix-react-sdk/pull/7904)). Fixes vector-im/element-web#20314.
 * Tweak info message padding in right panel timeline ([\#7901](https://github.com/matrix-org/matrix-react-sdk/pull/7901)). Fixes vector-im/element-web#21212.
 * Fix another freeze on room switch ([\#7900](https://github.com/matrix-org/matrix-react-sdk/pull/7900)). Fixes vector-im/element-web#21127.
 * Clean up error listener when location picker closes ([\#7902](https://github.com/matrix-org/matrix-react-sdk/pull/7902)). Fixes vector-im/element-web#21213.
 * Fix edge case in context menu chevron positioning ([\#7899](https://github.com/matrix-org/matrix-react-sdk/pull/7899)).
 * Fix composer format buttons on WebKit ([\#7898](https://github.com/matrix-org/matrix-react-sdk/pull/7898)). Fixes vector-im/element-web#20868.
 * manage voicerecording state when deleting or sending a voice message ([\#7896](https://github.com/matrix-org/matrix-react-sdk/pull/7896)). Fixes vector-im/element-web#21151.
 * Fix bug with useRoomHierarchy tight-looping loadMore on error ([\#7893](https://github.com/matrix-org/matrix-react-sdk/pull/7893)).
 * Fix upload button & shortcut not working for narrow composer mode ([\#7894](https://github.com/matrix-org/matrix-react-sdk/pull/7894)). Fixes vector-im/element-web#21175 and vector-im/element-web#21142.
 * Fix emoji insertion in thread composer going to the main composer ([\#7895](https://github.com/matrix-org/matrix-react-sdk/pull/7895)). Fixes vector-im/element-web#21202.
 * Try harder to keep context menus inside the window ([\#7863](https://github.com/matrix-org/matrix-react-sdk/pull/7863)). Fixes vector-im/element-web#17527 and vector-im/element-web#18377.
 * Fix edge case around event list summary layout ([\#7891](https://github.com/matrix-org/matrix-react-sdk/pull/7891)). Fixes vector-im/element-web#21180.
 * Fix event list summary 1 hidden message pluralisation ([\#7890](https://github.com/matrix-org/matrix-react-sdk/pull/7890)). Fixes vector-im/element-web#21196.
 * Fix vanishing recently viewed menu ([\#7887](https://github.com/matrix-org/matrix-react-sdk/pull/7887)). Fixes vector-im/element-web#20827.
 * Fix freeze on room switch ([\#7884](https://github.com/matrix-org/matrix-react-sdk/pull/7884)). Fixes vector-im/element-web#21127.
 * Check 'useSystemTheme' in quick settings theme switcher ([\#7809](https://github.com/matrix-org/matrix-react-sdk/pull/7809)). Fixes vector-im/element-web#21061.
 * Fix 'my threads' filtering to include participated threads ([\#7882](https://github.com/matrix-org/matrix-react-sdk/pull/7882)). Fixes vector-im/element-web#20877.
 * Remove log line to try to fix freeze on answering VoIP call ([\#7883](https://github.com/matrix-org/matrix-react-sdk/pull/7883)).
 * Support social login & password on soft logout page ([\#7879](https://github.com/matrix-org/matrix-react-sdk/pull/7879)). Fixes vector-im/element-web#21099.
 * Fix missing padding on server picker ([\#7864](https://github.com/matrix-org/matrix-react-sdk/pull/7864)).
 * Throttle RoomState.members handlers ([\#7876](https://github.com/matrix-org/matrix-react-sdk/pull/7876)). Fixes vector-im/element-web#21127.
 * Only show joined/invited in search dialog ([\#7875](https://github.com/matrix-org/matrix-react-sdk/pull/7875)). Fixes vector-im/element-web#21161.
 * Don't pillify code blocks ([\#7861](https://github.com/matrix-org/matrix-react-sdk/pull/7861)). Fixes vector-im/element-web#20851 and vector-im/element-web#18687.
 * Fix keyboard shortcut icons on macOS ([\#7869](https://github.com/matrix-org/matrix-react-sdk/pull/7869)).

Changes in [1.10.6](https://github.com/vector-im/element-desktop/releases/tag/v1.10.6) (2022-03-01)
===================================================================================================

## 🐛 Bug Fixes
 * Fix some crashes in the right panel

Changes in [1.10.5](https://github.com/vector-im/element-desktop/releases/tag/v1.10.5) (2022-02-28)
===================================================================================================

## 🌐 Translations
 * This release contains a significant update to the Japanese translations, contributed by Suguru Hirahara (@luixxiul). ありがとうございます!

## ✨ Features
 * Support "closed" polls whose votes are not visible until they are ended ([\#7842](https://github.com/matrix-org/matrix-react-sdk/pull/7842)).
 * Focus trap in poll creation dialog ([\#7847](https://github.com/matrix-org/matrix-react-sdk/pull/7847)). Fixes vector-im/element-web#20281.
 * Add labs flag: Show only current profile on historical messages ([\#7815](https://github.com/matrix-org/matrix-react-sdk/pull/7815)).
 * Keep unsent voice messages in memory until they are deleted or sent ([\#7840](https://github.com/matrix-org/matrix-react-sdk/pull/7840)). Fixes vector-im/element-web#17979.
 * A link to `#/dm` in a custom home.html will open the "Direct Messages" dialog. ([\#7783](https://github.com/matrix-org/matrix-react-sdk/pull/7783)). Contributed by @johannes-krude.
 * set icon-button-color to be configurable via quaternary-content variable ([\#7725](https://github.com/matrix-org/matrix-react-sdk/pull/7725)). Fixes vector-im/element-web#20925. Contributed by @acxz.
 * Allow editing polls ([\#7806](https://github.com/matrix-org/matrix-react-sdk/pull/7806)).
 * Abstract spotlight to allow non-room results too ([\#7804](https://github.com/matrix-org/matrix-react-sdk/pull/7804)). Fixes vector-im/element-web#20968, matrix-org/element-web-rageshakes#10766, matrix-org/element-web-rageshakes#10777, matrix-org/element-web-rageshakes#10767 matrix-org/element-web-rageshakes#10760 and matrix-org/element-web-rageshakes#10752.
 * Display '(edited)' next to edited polls ([\#7789](https://github.com/matrix-org/matrix-react-sdk/pull/7789)).
 * Use the resize observer polyfill consistently ([\#7796](https://github.com/matrix-org/matrix-react-sdk/pull/7796)). Fixes matrix-org/element-web-rageshakes#10700.
 * Consolidate, simplify and improve copied tooltips ([\#7799](https://github.com/matrix-org/matrix-react-sdk/pull/7799)). Fixes vector-im/element-web#21069.
 * Suggest `@room` when `@channel`, `@everyone`, or `@here` is typed in composer ([\#7737](https://github.com/matrix-org/matrix-react-sdk/pull/7737)). Fixes vector-im/element-web#20972. Contributed by @aaronraimist.
 * Add customisation point to disable space creation ([\#7766](https://github.com/matrix-org/matrix-react-sdk/pull/7766)).
 * Consolidate RedactionGrouper and HiddenEventGrouper into MELS ([\#7739](https://github.com/matrix-org/matrix-react-sdk/pull/7739)). Fixes vector-im/element-web#20958.
 * Unify widget header actions with those in right panel ([\#7734](https://github.com/matrix-org/matrix-react-sdk/pull/7734)).
 * Improve new search dialog context text for exactly 2 parent spaces ([\#7761](https://github.com/matrix-org/matrix-react-sdk/pull/7761)).

## 🐛 Bug Fixes
 * Fix command key missing in keyboard shortcuts tab ([\#21102](https://github.com/vector-im/element-web/pull/21102)). Contributed by @SimonBrandner.
 * [Release] Tweak info message padding in right panel timeline ([\#7909](https://github.com/matrix-org/matrix-react-sdk/pull/7909)).
 * [Release] Fix edge case around event list summary layout ([\#7892](https://github.com/matrix-org/matrix-react-sdk/pull/7892)).
 * Wire up CallEventGroupers for Search Results ([\#7866](https://github.com/matrix-org/matrix-react-sdk/pull/7866)). Fixes vector-im/element-web#21150.
 * Fix edge case around event list summary layout ([\#7867](https://github.com/matrix-org/matrix-react-sdk/pull/7867)). Fixes vector-im/element-web#21153.
 * Fix misalignment with Event List Summaries ([\#7865](https://github.com/matrix-org/matrix-react-sdk/pull/7865)). Fixes vector-im/element-web#21149.
 * Fix non-customizable keybindings not working as expected ([\#7855](https://github.com/matrix-org/matrix-react-sdk/pull/7855)). Fixes vector-im/element-web#21136 and matrix-org/element-web-rageshakes#10830.
 * Fix accessibility around the room list treeview and new search beta ([\#7856](https://github.com/matrix-org/matrix-react-sdk/pull/7856)). Fixes matrix-org/element-web-rageshakes#10873.
 * Inhibit tooltip on timeline pill avatars, the whole pill has its own ([\#7854](https://github.com/matrix-org/matrix-react-sdk/pull/7854)). Fixes vector-im/element-web#21135.
 * Fix virtual / native room mapping on call transfers ([\#7848](https://github.com/matrix-org/matrix-react-sdk/pull/7848)).
 * Fix ScrollPanel data-scrollbar not responding to window resizing ([\#7841](https://github.com/matrix-org/matrix-react-sdk/pull/7841)). Fixes vector-im/element-web#20594.
 * add cursor: pointer to actionable poll options ([\#7826](https://github.com/matrix-org/matrix-react-sdk/pull/7826)). Fixes vector-im/element-web#21033.
 * Tear down AppTile using lifecycle tracking ([\#7833](https://github.com/matrix-org/matrix-react-sdk/pull/7833)). Fixes vector-im/element-web#21025.
 * Fix layout inconsistencies with the room search minimized button ([\#7824](https://github.com/matrix-org/matrix-react-sdk/pull/7824)). Fixes vector-im/element-web#21106.
 * Fix space panel notification badge behaviour and metrics ([\#7823](https://github.com/matrix-org/matrix-react-sdk/pull/7823)). Fixes vector-im/element-web#21092.
 * Fix left panel widgets causing app crashes (again) ([\#7814](https://github.com/matrix-org/matrix-react-sdk/pull/7814)).
 * Fix right panel data flow ([\#7811](https://github.com/matrix-org/matrix-react-sdk/pull/7811)). Fixes vector-im/element-web#20929.
 * set mask-size for icons ([\#7812](https://github.com/matrix-org/matrix-react-sdk/pull/7812)). Fixes vector-im/element-web#21047.
 * Fix room create tile not showing up with hidden events shown ([\#7810](https://github.com/matrix-org/matrix-react-sdk/pull/7810)). Fixes vector-im/element-web#20893.
 * Fix delayed badge update for mentions in encrypted rooms ([\#7813](https://github.com/matrix-org/matrix-react-sdk/pull/7813)). Fixes vector-im/element-web#20859.
 * Fix add existing space not showing any spaces ([\#7801](https://github.com/matrix-org/matrix-react-sdk/pull/7801)). Fixes vector-im/element-web#21087. Contributed by @c-cal.
 * Fix edge cases around event list summaries with hidden events and redactions ([\#7797](https://github.com/matrix-org/matrix-react-sdk/pull/7797)). Fixes vector-im/element-web#21030 vector-im/element-web#21050 and vector-im/element-web#21055.
 * Improve styling of edge case devtools state keys ([\#7794](https://github.com/matrix-org/matrix-react-sdk/pull/7794)). Fixes vector-im/element-web#21056.
 * Don't scroll to bottom when executing non-message slash commands ([\#7793](https://github.com/matrix-org/matrix-react-sdk/pull/7793)). Fixes vector-im/element-web#21065.
 * Fix cutout misalignment on some decorated room avatars ([\#7784](https://github.com/matrix-org/matrix-react-sdk/pull/7784)). Fixes vector-im/element-web#21038.
 * Fix desktop notifications for invites showing user IDs instead of displaynames ([\#7780](https://github.com/matrix-org/matrix-react-sdk/pull/7780)). Fixes vector-im/element-web#21022. Contributed by @c-cal.
 * Fix bad pluralisation on event list summary hidden message handling ([\#7778](https://github.com/matrix-org/matrix-react-sdk/pull/7778)).
 * Properly recurse subspaces for leave space dialog options ([\#7775](https://github.com/matrix-org/matrix-react-sdk/pull/7775)). Fixes vector-im/element-web#20949 and vector-im/element-web#21012.
 * Fix translation for keyboard shortcut displaynames ([\#7758](https://github.com/matrix-org/matrix-react-sdk/pull/7758)). Fixes vector-im/element-web#20992. Contributed by @c-cal.
 * Fix space member list opening with back button ([\#7773](https://github.com/matrix-org/matrix-react-sdk/pull/7773)). Fixes vector-im/element-web#21009. Contributed by @c-cal.
 * Fix sort order for facepiles which was exactly reverse ([\#7771](https://github.com/matrix-org/matrix-react-sdk/pull/7771)).
 * Fix state events being wrongly hidden when redacted ([\#7768](https://github.com/matrix-org/matrix-react-sdk/pull/7768)). Fixes vector-im/element-web#20959.
 * Event List Summary guard against missing event senders ([\#7767](https://github.com/matrix-org/matrix-react-sdk/pull/7767)). Fixes vector-im/element-web#21004.
 * Fix all settings button opening sidebar settings tab ([\#7765](https://github.com/matrix-org/matrix-react-sdk/pull/7765)). Fixes vector-im/element-web#20998. Contributed by @c-cal.
 * Fix theme selector dropdown overflow ([\#7764](https://github.com/matrix-org/matrix-react-sdk/pull/7764)). Fixes vector-im/element-web#20996. Contributed by @c-cal.
 * Fix widget and mjolnir state events showing with mxid not name ([\#7760](https://github.com/matrix-org/matrix-react-sdk/pull/7760)). Fixes vector-im/element-web#20986.
 * Fix space member list not opening ([\#7747](https://github.com/matrix-org/matrix-react-sdk/pull/7747)). Fixes vector-im/element-web#20982. Contributed by @c-cal.
 * Handle highlight notifications in timeline card button ([\#7762](https://github.com/matrix-org/matrix-react-sdk/pull/7762)). Fixes vector-im/element-web#20987. Contributed by @SimonBrandner.
 * Fix add existing space not showing any spaces ([\#7751](https://github.com/matrix-org/matrix-react-sdk/pull/7751)).
 * Inhibit Room List keyboard pass-thru when the search beta is enabled ([\#7752](https://github.com/matrix-org/matrix-react-sdk/pull/7752)). Fixes vector-im/element-web#20984.
 * Add unread notification dot to timeline card button ([\#7749](https://github.com/matrix-org/matrix-react-sdk/pull/7749)). Fixes vector-im/element-web#20946. Contributed by @SimonBrandner.

Changes in [1.10.4](https://github.com/vector-im/element-desktop/releases/tag/v1.10.4) (2022-02-17)
===================================================================================================

## 🐛 Bug Fixes
 * Fix bug where badge colour on encrypted rooms may not be correct until anothe rmessage is sent

Changes in [1.10.3](https://github.com/vector-im/element-desktop/releases/tag/v1.10.3) (2022-02-14)
===================================================================================================

 * Add map tile config to fix location sharing maps

Changes in [1.10.2](https://github.com/vector-im/element-desktop/releases/tag/v1.10.2) (2022-02-14)
===================================================================================================

## ✨ Features
 * Support a config option to change the default device name ([\#20790](https://github.com/vector-im/element-web/pull/20790)).
 * Capitalize "Privacy" in UserMenu ([\#7738](https://github.com/matrix-org/matrix-react-sdk/pull/7738)). Contributed by @aaronraimist.
 * Move new search experience to a Beta ([\#7718](https://github.com/matrix-org/matrix-react-sdk/pull/7718)). Fixes vector-im/element-meta#139 vector-im/element-web#20618 and vector-im/element-web#20339.
 * Auto select "Other homeserver" when user press "Edit" in homeserver field ([\#7337](https://github.com/matrix-org/matrix-react-sdk/pull/7337)). Fixes vector-im/element-web#20125. Contributed by @SimonBrandner.
 * Add unread badges and avatar decorations to spotlight search ([\#7696](https://github.com/matrix-org/matrix-react-sdk/pull/7696)). Fixes vector-im/element-web#20821.
 * Enable location sharing ([\#7703](https://github.com/matrix-org/matrix-react-sdk/pull/7703)).
 * Simplify Composer buttons ([\#7678](https://github.com/matrix-org/matrix-react-sdk/pull/7678)).
 * Add a warning to the console to discourage attacks and encourage contributing ([\#7673](https://github.com/matrix-org/matrix-react-sdk/pull/7673)). Fixes vector-im/element-web#2803. Contributed by @SimonBrandner.
 * Don't show replaced calls in the timeline ([\#7452](https://github.com/matrix-org/matrix-react-sdk/pull/7452)). Contributed by @SimonBrandner.
 * Tweak `/addwidget` widget names ([\#7681](https://github.com/matrix-org/matrix-react-sdk/pull/7681)).
 * Chat export parameter customisation ([\#7647](https://github.com/matrix-org/matrix-react-sdk/pull/7647)).
 * Put call on hold when transfer dialog is opened ([\#7669](https://github.com/matrix-org/matrix-react-sdk/pull/7669)).
 * Share e2ee keys when using /invite SlashCommand ([\#7655](https://github.com/matrix-org/matrix-react-sdk/pull/7655)). Fixes vector-im/element-web#20778 and vector-im/element-web#16982.
 * Tweak spotlight roving behaviour to reset when changing query ([\#7656](https://github.com/matrix-org/matrix-react-sdk/pull/7656)). Fixes vector-im/element-web#20537 vector-im/element-web#20612 and vector-im/element-web#20184.
 * Look up tile server info in homeserver's .well-known area ([\#7623](https://github.com/matrix-org/matrix-react-sdk/pull/7623)).
 * Add grouper for hidden events ([\#7649](https://github.com/matrix-org/matrix-react-sdk/pull/7649)).
 * The keyboard shortcut is control (or cmd) shift h. ([\#7584](https://github.com/matrix-org/matrix-react-sdk/pull/7584)). Contributed by @UwUnyaa.

## 🐛 Bug Fixes
 * [Release] Fix cutout misalignment on some decorated room avatars ([\#7785](https://github.com/matrix-org/matrix-react-sdk/pull/7785)).
 * [Release] Fix add existing space not showing any spaces ([\#7756](https://github.com/matrix-org/matrix-react-sdk/pull/7756)).
 * [Release] Inhibit Room List keyboard pass-thru when the search beta is enabled ([\#7754](https://github.com/matrix-org/matrix-react-sdk/pull/7754)).
 * [Release] Fix space member list not opening ([\#7755](https://github.com/matrix-org/matrix-react-sdk/pull/7755)).
 * Null-guard ELS from null summaryMembers ([\#7744](https://github.com/matrix-org/matrix-react-sdk/pull/7744)). Fixes vector-im/element-web#20807.
 * Improve responsiveness of the layout switcher ([\#7736](https://github.com/matrix-org/matrix-react-sdk/pull/7736)).
 * Tweak timeline card layout ([\#7743](https://github.com/matrix-org/matrix-react-sdk/pull/7743)). Fixes vector-im/element-web#20846.
 * Ensure location bodies have a width in bubbles ([\#7742](https://github.com/matrix-org/matrix-react-sdk/pull/7742)). Fixes vector-im/element-web#20916.
 * Tune aria-live regions around clocks/timers ([\#7735](https://github.com/matrix-org/matrix-react-sdk/pull/7735)). Fixes vector-im/element-web#20967.
 * Fix instances of decorated room avatar wrongly having their own tabIndex ([\#7730](https://github.com/matrix-org/matrix-react-sdk/pull/7730)).
 * Remove weird padding on stickers ([\#6271](https://github.com/matrix-org/matrix-react-sdk/pull/6271)). Fixes vector-im/element-web#17787. Contributed by @SimonBrandner.
 * Fix width issue of the composer overflow menu items ([\#7731](https://github.com/matrix-org/matrix-react-sdk/pull/7731)). Fixes vector-im/element-web#20898.
 * Properly handle persistent widgets when room is left ([\#7724](https://github.com/matrix-org/matrix-react-sdk/pull/7724)). Fixes vector-im/element-web#20901.
 * Null guard space hierarchy ([\#7729](https://github.com/matrix-org/matrix-react-sdk/pull/7729)). Fixes matrix-org/element-web-rageshakes#10433.
 * Fix add existing rooms button ([\#7728](https://github.com/matrix-org/matrix-react-sdk/pull/7728)). Fixes vector-im/element-web#20924. Contributed by @SimonBrandner.
 * Truncate long server names on login/register screen ([\#7702](https://github.com/matrix-org/matrix-react-sdk/pull/7702)). Fixes vector-im/element-web#18452.
 * Update PollCreateDialog-test to snapshot the html and not react tree ([\#7712](https://github.com/matrix-org/matrix-react-sdk/pull/7712)).
 * Fix creating polls outside of threads ([\#7711](https://github.com/matrix-org/matrix-react-sdk/pull/7711)). Fixes vector-im/element-web#20882.
 * Open native room when clicking notification from a virtual room ([\#7709](https://github.com/matrix-org/matrix-react-sdk/pull/7709)).
 * Fix relative link handling in Element Desktop ([\#7708](https://github.com/matrix-org/matrix-react-sdk/pull/7708)). Fixes vector-im/element-web#20783.
 * Reuse CopyableText component in all places it can be ([\#7701](https://github.com/matrix-org/matrix-react-sdk/pull/7701)). Fixes vector-im/element-web#20855.
 * Fit location into the width of the container ([\#7705](https://github.com/matrix-org/matrix-react-sdk/pull/7705)). Fixes vector-im/element-web#20861.
 * Make Spotlight Dialog roving reset more stable ([\#7698](https://github.com/matrix-org/matrix-react-sdk/pull/7698)). Fixes vector-im/element-web#20826.
 * Fix incorrect sizing of DecoratedRoomAvatar in RoomHeader ([\#7697](https://github.com/matrix-org/matrix-react-sdk/pull/7697)). Fixes vector-im/element-web#20090.
 * Use a more correct test for emoji ([\#7685](https://github.com/matrix-org/matrix-react-sdk/pull/7685)). Fixes vector-im/element-web#20824. Contributed by @robintown.
 * Fix vertical spacing in `compact` `<ContextMenu>` ([\#7684](https://github.com/matrix-org/matrix-react-sdk/pull/7684)). Fixes vector-im/element-web#20801.
 * Fix the sticker picker ([\#7692](https://github.com/matrix-org/matrix-react-sdk/pull/7692)). Fixes vector-im/element-web#20797.
 * Fix publishing address wrongly demanding the alias be available ([\#7690](https://github.com/matrix-org/matrix-react-sdk/pull/7690)). Fixes vector-im/element-web#12013 and vector-im/element-web#20833.
 * Prevent MemberAvatar soft-crashing when rendered with null member prop ([\#7691](https://github.com/matrix-org/matrix-react-sdk/pull/7691)). Fixes vector-im/element-web#20714.
 * Ensure UserInfo can be rendered without a room ([\#7687](https://github.com/matrix-org/matrix-react-sdk/pull/7687)). Fixes vector-im/element-web#20830.
 * Make polls fill column width in bubbles layout ([\#7661](https://github.com/matrix-org/matrix-react-sdk/pull/7661)). Fixes vector-im/element-web#20712.
 * Add a background to expanded nick name in IRC layout to make it readable. ([\#7652](https://github.com/matrix-org/matrix-react-sdk/pull/7652)). Fixes vector-im/element-web#20757. Contributed by @UwUnyaa.
 * Fix accessibility and consistency of MessageComposerButtons ([\#7679](https://github.com/matrix-org/matrix-react-sdk/pull/7679)). Fixes vector-im/element-web#20814.
 * Don't show shield next to deleted messages ([\#7671](https://github.com/matrix-org/matrix-react-sdk/pull/7671)). Fixes vector-im/element-web#20475. Contributed by @SimonBrandner.
 * Fix font size of spaces between big emoji ([\#7675](https://github.com/matrix-org/matrix-react-sdk/pull/7675)). Contributed by @robintown.
 * Fix shift-enter repeating last character ([\#7665](https://github.com/matrix-org/matrix-react-sdk/pull/7665)). Fixes vector-im/element-web#17215. Contributed by @SimonBrandner.
 * Remove Unpin option from maximised widget context menu ([\#7657](https://github.com/matrix-org/matrix-react-sdk/pull/7657)).
 * Fix new call event grouper implementation for encrypted rooms ([\#7654](https://github.com/matrix-org/matrix-react-sdk/pull/7654)).
 * Fix issue with tile error boundaries collapsing in bubbles layout ([\#7653](https://github.com/matrix-org/matrix-react-sdk/pull/7653)).
 * Fix emojis getting cropped in irc & bubble layouts by anti-zalgo ([\#7637](https://github.com/matrix-org/matrix-react-sdk/pull/7637)). Fixes vector-im/element-web#20744.
 * Fix space panel edge gradient not applying on load ([\#7644](https://github.com/matrix-org/matrix-react-sdk/pull/7644)). Fixes vector-im/element-web#20756.
 * Fix search results view for layouts other than Group/Modern ([\#7648](https://github.com/matrix-org/matrix-react-sdk/pull/7648)). Fixes vector-im/element-web#20745.

Changes in [1.10.1](https://github.com/vector-im/element-desktop/releases/tag/v1.10.1) (2022-02-01)
===================================================================================================

## 🐛 Bug Fixes
 * Fix the sticker picker ([\#7692](https://github.com/matrix-org/matrix-react-sdk/pull/7692)). Fixes vector-im/element-web#20797. 
 * Ensure UserInfo can be rendered without a room ([\#7687](https://github.com/matrix-org/matrix-react-sdk/pull/7687)). Fixes vector-im/element-web#20830.
 * Fix publishing address wrongly demanding the alias be available ([\#7690](https://github.com/matrix-org/matrix-react-sdk/pull/7690)). Fixes vector-im/element-web#12013 and vector-im/element-web#20833.

Changes in [1.10.0](https://github.com/vector-im/element-desktop/releases/tag/v1.10.0) (2022-01-31)
===================================================================================================

## ✨ Features
 * Enable posthog on app.element.io ([\#20539](https://github.com/vector-im/element-web/pull/20539)).
 * Tweak room list header menu for when space is active ([\#7577](https://github.com/matrix-org/matrix-react-sdk/pull/7577)). Fixes vector-im/element-web#20601.
 * Tweak light hover & active color for bubble layout ([\#7626](https://github.com/matrix-org/matrix-react-sdk/pull/7626)). Fixes vector-im/element-web#19475.
 * De-labs Metaspaces ([\#7613](https://github.com/matrix-org/matrix-react-sdk/pull/7613)).
 * De-labs Message Bubbles layout ([\#7612](https://github.com/matrix-org/matrix-react-sdk/pull/7612)).
 * Add customisation point for mxid display ([\#7595](https://github.com/matrix-org/matrix-react-sdk/pull/7595)).
 * Add labs flag for default open right panel ([\#7618](https://github.com/matrix-org/matrix-react-sdk/pull/7618)). Fixes vector-im/element-web#20666.
 * Tweak copy for the Sidebar tab in User Settings ([\#7578](https://github.com/matrix-org/matrix-react-sdk/pull/7578)). Fixes vector-im/element-web#20619.
 * Make widgets not reload (persistent) between center and top container  ([\#7575](https://github.com/matrix-org/matrix-react-sdk/pull/7575)). Fixes vector-im/element-web#20596. Contributed by @toger5.
 * Don't render a bubble around emotes in bubble layout ([\#7573](https://github.com/matrix-org/matrix-react-sdk/pull/7573)). Fixes vector-im/element-web#20617.
 * Add ability to switch between voice & video in calls ([\#7155](https://github.com/matrix-org/matrix-react-sdk/pull/7155)). Fixes vector-im/element-web#18619. Contributed by @SimonBrandner.
 * Re-renable Share option for location messages ([\#7596](https://github.com/matrix-org/matrix-react-sdk/pull/7596)).
 * Make room ID copyable ([\#7600](https://github.com/matrix-org/matrix-react-sdk/pull/7600)). Fixes vector-im/element-web#20675. Contributed by @SimonBrandner.
 * Improve the look of the keyboard settings tab ([\#7562](https://github.com/matrix-org/matrix-react-sdk/pull/7562)). Contributed by @SimonBrandner.
 * Add tooltips to emoji in messages ([\#7592](https://github.com/matrix-org/matrix-react-sdk/pull/7592)). Fixes vector-im/element-web#9911 and vector-im/element-web#20661. Contributed by @robintown.
 * Improve redundant tooltip on send button in forward dialog ([\#7594](https://github.com/matrix-org/matrix-react-sdk/pull/7594)). Contributed by @twigleingrid.
 * Allow downloads from widgets. ([\#7502](https://github.com/matrix-org/matrix-react-sdk/pull/7502)). Contributed by @Fox32.
 * Parse matrix-schemed URIs ([\#7453](https://github.com/matrix-org/matrix-react-sdk/pull/7453)).
 * Show a tile at beginning of visible history ([\#5887](https://github.com/matrix-org/matrix-react-sdk/pull/5887)). Fixes vector-im/element-web#16818 vector-im/element-web#16679 and vector-im/element-web#19888. Contributed by @robintown.
 * Enable the polls feature ([\#7581](https://github.com/matrix-org/matrix-react-sdk/pull/7581)).
 * Display general marker on non-self location shares ([\#7574](https://github.com/matrix-org/matrix-react-sdk/pull/7574)).
 * Improve/add notifications for location and poll events ([\#7552](https://github.com/matrix-org/matrix-react-sdk/pull/7552)). Fixes vector-im/element-web#20561. Contributed by @SimonBrandner.
 * Upgrade linkify to v3.0 ([\#7282](https://github.com/matrix-org/matrix-react-sdk/pull/7282)). Fixes vector-im/element-web#17133 vector-im/element-web#16825 and vector-im/element-web#5808. Contributed by @Palid.
 * Update sidebar icon from Compound ([\#7572](https://github.com/matrix-org/matrix-react-sdk/pull/7572)). Fixes vector-im/element-web#20615.
 * Replace home icon with new one ([\#7571](https://github.com/matrix-org/matrix-react-sdk/pull/7571)). Fixes vector-im/element-web#20606.
 * Make the `Keyboard Shortcuts` dialog into a settings tab ([\#7198](https://github.com/matrix-org/matrix-react-sdk/pull/7198)). Fixes vector-im/element-web#19866. Contributed by @SimonBrandner.
 * Add setting for enabling location sharing ([\#7547](https://github.com/matrix-org/matrix-react-sdk/pull/7547)).
 * Add a developer mode 'view source' button to crashed event tiles ([\#7537](https://github.com/matrix-org/matrix-react-sdk/pull/7537)).
 * Replace `kick` terminology with `Remove from chat` ([\#7469](https://github.com/matrix-org/matrix-react-sdk/pull/7469)). Fixes vector-im/element-web#9547.
 * Render events as extensible events (behind labs) ([\#7462](https://github.com/matrix-org/matrix-react-sdk/pull/7462)).
 * Render Jitsi (and other sticky widgets) in PiP container, so it can be dragged and the "jump to room functionality" is provided ([\#7450](https://github.com/matrix-org/matrix-react-sdk/pull/7450)). Fixes vector-im/element-web#15682. Contributed by @toger5.
 * Allow bubble layout in Thread View ([\#7478](https://github.com/matrix-org/matrix-react-sdk/pull/7478)). Fixes vector-im/element-web#20419.
 * Make LocationPicker appearance cleaner ([\#7516](https://github.com/matrix-org/matrix-react-sdk/pull/7516)).
 * Limit max-width for bubble layout to 1200px ([\#7458](https://github.com/matrix-org/matrix-react-sdk/pull/7458)). Fixes vector-im/element-web#18072.
 * Improve look of call events in bubble layout ([\#7445](https://github.com/matrix-org/matrix-react-sdk/pull/7445)). Fixes vector-im/element-web#20324. Contributed by @SimonBrandner.
 * Make files & voice memos in bubble layout match colouring ([\#7457](https://github.com/matrix-org/matrix-react-sdk/pull/7457)). Fixes vector-im/element-web#20326.
 * Allow cancelling events whilst they are encrypting ([\#7483](https://github.com/matrix-org/matrix-react-sdk/pull/7483)). Fixes vector-im/element-web#17726.

## 🐛 Bug Fixes
 * [Release] Fix left panel widgets causing app-wide crash ([\#7660](https://github.com/matrix-org/matrix-react-sdk/pull/7660)).
 * Load light theme prior to HTML export to ensure it is present ([\#7643](https://github.com/matrix-org/matrix-react-sdk/pull/7643)). Fixes vector-im/element-web#20276.
 * Fix soft-crash when hanging up Jitsi via PIP ([\#7645](https://github.com/matrix-org/matrix-react-sdk/pull/7645)). Fixes vector-im/element-web#20766.
 * Fix RightPanelStore assuming isViewingRoom is false on load ([\#7642](https://github.com/matrix-org/matrix-react-sdk/pull/7642)).
 * Correctly handle Room.timeline events which have a nullable `Room` ([\#7635](https://github.com/matrix-org/matrix-react-sdk/pull/7635)). Fixes matrix-org/element-web-rageshakes#9490.
 * Translate keyboard shortcut alternate key names ([\#7633](https://github.com/matrix-org/matrix-react-sdk/pull/7633)). Fixes vector-im/element-web#20739.
 * Fix unfocused paste handling and focus return for file uploads ([\#7625](https://github.com/matrix-org/matrix-react-sdk/pull/7625)).
 * Changed MacOS hotkey for GoToHome view. ([\#7631](https://github.com/matrix-org/matrix-react-sdk/pull/7631)). Contributed by @aj-ya.
 * Fix issue with the new composer EmojiPart which caused infinite loops ([\#7629](https://github.com/matrix-org/matrix-react-sdk/pull/7629)). Fixes vector-im/element-web#20746.
 * Upgrade linkifyjs to fix schemes as domain prefixes ([\#7628](https://github.com/matrix-org/matrix-react-sdk/pull/7628)). Fixes vector-im/element-web#20720.
 * Show bubble tile timestamps for bubble layout inside the bubble ([\#7622](https://github.com/matrix-org/matrix-react-sdk/pull/7622)). Fixes vector-im/element-web#20562.
 *  Improve taken username warning in registration for when request fails ([\#7621](https://github.com/matrix-org/matrix-react-sdk/pull/7621)).
 * Avoid double dialog after clicking to remove a public room ([\#7604](https://github.com/matrix-org/matrix-react-sdk/pull/7604)). Fixes vector-im/element-web#20681. Contributed by @c-cal.
 * Fix space member list right panel state ([\#7617](https://github.com/matrix-org/matrix-react-sdk/pull/7617)). Fixes vector-im/element-web#20716.
 * Fall back to legacy analytics for guest users ([\#7616](https://github.com/matrix-org/matrix-react-sdk/pull/7616)).
 * Always emit a space filter update when the space is actually changed ([\#7611](https://github.com/matrix-org/matrix-react-sdk/pull/7611)). Fixes vector-im/element-web#20664.
 * Enlarge emoji in composer ([\#7602](https://github.com/matrix-org/matrix-react-sdk/pull/7602)). Fixes vector-im/element-web#20665 vector-im/element-web#15635 and vector-im/element-web#20688. Contributed by @robintown.
 * Disable location sharing button on Desktop ([\#7590](https://github.com/matrix-org/matrix-react-sdk/pull/7590)).
 * Make pills more natural to navigate around ([\#7607](https://github.com/matrix-org/matrix-react-sdk/pull/7607)). Fixes vector-im/element-web#20678. Contributed by @robintown.
 * Fix excessive padding on inline images ([\#7605](https://github.com/matrix-org/matrix-react-sdk/pull/7605)). Contributed by @robintown.
 * Prevent pills from being split by formatting actions ([\#7606](https://github.com/matrix-org/matrix-react-sdk/pull/7606)). Contributed by @robintown.
 * Fix translation of "powerText" ([\#7603](https://github.com/matrix-org/matrix-react-sdk/pull/7603)). Contributed by @c-cal.
 * Unhide display names when switching back to modern layout ([\#7601](https://github.com/matrix-org/matrix-react-sdk/pull/7601)). Fixes vector-im/element-web#20676. Contributed by @robintown.
 * Fix space member list not opening ([\#7609](https://github.com/matrix-org/matrix-react-sdk/pull/7609)). Fixes vector-im/element-web#20679. Contributed by @SimonBrandner.
 * Fix translation for the "Add room" tooltip ([\#7532](https://github.com/matrix-org/matrix-react-sdk/pull/7532)). Contributed by @c-cal.
 * Make the close button of the location share dialog visible in high-contrast theme ([\#7597](https://github.com/matrix-org/matrix-react-sdk/pull/7597)).
 * Cancel pending events in virtual room when call placed ([\#7583](https://github.com/matrix-org/matrix-react-sdk/pull/7583)). Fixes vector-im/element-web#17594.
 * Fix alignment of unread badge in thread list ([\#7582](https://github.com/matrix-org/matrix-react-sdk/pull/7582)). Fixes vector-im/element-web#20643.
 * Fix left positioned tooltips being wrong and offset by fixed value ([\#7551](https://github.com/matrix-org/matrix-react-sdk/pull/7551)).
 * Fix MAB overlapping or overflowing in bubbles layout and threads regressions ([\#7569](https://github.com/matrix-org/matrix-react-sdk/pull/7569)). Fixes vector-im/element-web#20403 and vector-im/element-web#20404.
 * Fix wrong icon being used for appearance tab in space preferences dialog ([\#7570](https://github.com/matrix-org/matrix-react-sdk/pull/7570)). Fixes vector-im/element-web#20608.
 * Fix `/jumptodate` using wrong MSC feature flag ([\#7563](https://github.com/matrix-org/matrix-react-sdk/pull/7563)).
 * Ensure maps show up in replies and threads, by creating unique IDs ([\#7568](https://github.com/matrix-org/matrix-react-sdk/pull/7568)).
 * Differentiate between hover and roving focus in spotlight dialog ([\#7564](https://github.com/matrix-org/matrix-react-sdk/pull/7564)). Fixes vector-im/element-web#20597.
 * Fix timeline jumping issues related to bubble layout ([\#7529](https://github.com/matrix-org/matrix-react-sdk/pull/7529)). Fixes vector-im/element-web#20302.
 * Start a conference in a room with 2 people + invitee rather than a 1:1 call ([\#7557](https://github.com/matrix-org/matrix-react-sdk/pull/7557)). Fixes vector-im/element-web#1202. Contributed by @SimonBrandner.
 * Wait for initial profile load before displaying widget ([\#7556](https://github.com/matrix-org/matrix-react-sdk/pull/7556)).
 * Make widgets and calls span across the whole room width when using bubble layout ([\#7553](https://github.com/matrix-org/matrix-react-sdk/pull/7553)). Fixes vector-im/element-web#20560. Contributed by @SimonBrandner.
 * Always show right panel after setting a card ([\#7544](https://github.com/matrix-org/matrix-react-sdk/pull/7544)). Contributed by @toger5.
 * Support deserialising HR tags for editing ([\#7543](https://github.com/matrix-org/matrix-react-sdk/pull/7543)). Fixes vector-im/element-web#20553.
 * Refresh ThreadView after React state has been updated ([\#7539](https://github.com/matrix-org/matrix-react-sdk/pull/7539)). Fixes vector-im/element-web#20549.
 * Set initial zoom level to 1 to make zooming to location faster ([\#7541](https://github.com/matrix-org/matrix-react-sdk/pull/7541)).
 * truncate room name on pip header ([\#7538](https://github.com/matrix-org/matrix-react-sdk/pull/7538)).
 * Prevent enter to send edit weirdness when no change has been made ([\#7522](https://github.com/matrix-org/matrix-react-sdk/pull/7522)). Fixes vector-im/element-web#20507.
 * Allow using room pills in slash commands ([\#7513](https://github.com/matrix-org/matrix-react-sdk/pull/7513)). Fixes vector-im/element-web#20343.

Changes in [1.9.9](https://github.com/vector-im/element-desktop/releases/tag/v1.9.9) (2022-01-17)
=================================================================================================

## ✨ Features
 * Add permission dropdown for sending reactions ([\#7492](https://github.com/matrix-org/matrix-react-sdk/pull/7492)). Fixes vector-im/element-web#20450.
 * Ship maximised widgets and remove feature flag ([\#7509](https://github.com/matrix-org/matrix-react-sdk/pull/7509)).
 * Properly maintain aspect ratio of inline images ([\#7503](https://github.com/matrix-org/matrix-react-sdk/pull/7503)).
 * Add zoom buttons to the location view ([\#7482](https://github.com/matrix-org/matrix-react-sdk/pull/7482)).
 * Remove bubble from around location events ([\#7459](https://github.com/matrix-org/matrix-react-sdk/pull/7459)). Fixes vector-im/element-web#20323.
 * Disable "Publish this room" option in invite only rooms ([\#7441](https://github.com/matrix-org/matrix-react-sdk/pull/7441)). Fixes vector-im/element-web#6596. Contributed by @aaronraimist.
 * Give secret key field an `id` ([\#7489](https://github.com/matrix-org/matrix-react-sdk/pull/7489)). Fixes vector-im/element-web#20390. Contributed by @SimonBrandner.
 * Display a tooltip when you hover over a location ([\#7472](https://github.com/matrix-org/matrix-react-sdk/pull/7472)).
 * Open map in a dialog when it is clicked ([\#7465](https://github.com/matrix-org/matrix-react-sdk/pull/7465)).
 * a11y - wrap notification level radios in fieldsets ([\#7471](https://github.com/matrix-org/matrix-react-sdk/pull/7471)).
 * Wrap inputs in fieldsets in Space visibility settings ([\#7350](https://github.com/matrix-org/matrix-react-sdk/pull/7350)).
 * History based navigation with new right panel store ([\#7398](https://github.com/matrix-org/matrix-react-sdk/pull/7398)). Fixes vector-im/element-web#19686 vector-im/element-web#19660 and vector-im/element-web#19634.
 * Associate room alias warning with public option in settings ([\#7430](https://github.com/matrix-org/matrix-react-sdk/pull/7430)).
 * Disable quick reactions button when no permissions ([\#7412](https://github.com/matrix-org/matrix-react-sdk/pull/7412)). Fixes vector-im/element-web#20270.
 * Allow opening a map view in OpenStreetMap ([\#7428](https://github.com/matrix-org/matrix-react-sdk/pull/7428)).
 * Display the user's avatar when they shared their location ([\#7424](https://github.com/matrix-org/matrix-react-sdk/pull/7424)).
 * Remove the Forward and Share buttons for location messages only ([\#7423](https://github.com/matrix-org/matrix-react-sdk/pull/7423)).
 * Add configuration to disable relative date markers in timeline ([\#7405](https://github.com/matrix-org/matrix-react-sdk/pull/7405)).
 * Space preferences for whether or not you see DMs in a Space ([\#7250](https://github.com/matrix-org/matrix-react-sdk/pull/7250)). Fixes vector-im/element-web#19529 and vector-im/element-web#19955.
 * Have LocalEchoWrapper emit updates so the app can react faster ([\#7358](https://github.com/matrix-org/matrix-react-sdk/pull/7358)). Fixes vector-im/element-web#19749.
 * Use semantic heading on dialog component ([\#7383](https://github.com/matrix-org/matrix-react-sdk/pull/7383)).
 * Add `/jumptodate` slash command ([\#7372](https://github.com/matrix-org/matrix-react-sdk/pull/7372)). Fixes vector-im/element-web#7677.
 * Update room context menu copy ([\#7361](https://github.com/matrix-org/matrix-react-sdk/pull/7361)). Fixes vector-im/element-web#20133.
 * Use lazy rendering in the AddExistingToSpaceDialog ([\#7369](https://github.com/matrix-org/matrix-react-sdk/pull/7369)). Fixes vector-im/element-web#18784.
 * Tweak FacePile tooltip to include whether or not you are included ([\#7367](https://github.com/matrix-org/matrix-react-sdk/pull/7367)). Fixes vector-im/element-web#17278.

## 🐛 Bug Fixes
 * Ensure group audio-only calls don't switch on the webcam on join ([\#20234](https://github.com/vector-im/element-web/pull/20234)). Fixes vector-im/element-web#20212.
 * Fix wrongly wrapping code blocks, breaking line numbers ([\#7507](https://github.com/matrix-org/matrix-react-sdk/pull/7507)). Fixes vector-im/element-web#20316.
 * Set header buttons to no phase when right panel is closed ([\#7506](https://github.com/matrix-org/matrix-react-sdk/pull/7506)).
 * Fix active Jitsi calls (and other active widgets) not being visible on screen, by showing them in PiP if they are not visible in any other container ([\#7435](https://github.com/matrix-org/matrix-react-sdk/pull/7435)). Fixes vector-im/element-web#15169 and vector-im/element-web#20275.
 * Fix layout of message bubble preview in settings ([\#7497](https://github.com/matrix-org/matrix-react-sdk/pull/7497)).
 * Prevent mutations of js-sdk owned objects as it breaks accountData ([\#7504](https://github.com/matrix-org/matrix-react-sdk/pull/7504)). Fixes matrix-org/element-web-rageshakes#7822.
 * fallback properly with pluralized strings ([\#7495](https://github.com/matrix-org/matrix-react-sdk/pull/7495)). Fixes vector-im/element-web#20455.
 * Consider continuations when resolving whether a tile is last in section ([\#7461](https://github.com/matrix-org/matrix-react-sdk/pull/7461)). Fixes vector-im/element-web#20368 and vector-im/element-web#20369.
 * Fix read receipts and sent indicators for bubble layout ([\#7460](https://github.com/matrix-org/matrix-react-sdk/pull/7460)). Fixes vector-im/element-web#18298 and vector-im/element-web#20345.
 * null-guard dataset mxTheme to prevent html exports from exploding ([\#7493](https://github.com/matrix-org/matrix-react-sdk/pull/7493)). Fixes vector-im/element-web#20453.
 * Fix avatar container overlapping give feedback cta ([\#7491](https://github.com/matrix-org/matrix-react-sdk/pull/7491)). Fixes matrix-org/element-web-rageshakes#7987.
 * Fix jump to bottom button working when on a permalink ([\#7494](https://github.com/matrix-org/matrix-react-sdk/pull/7494)). Fixes vector-im/element-web#19813.
 * Remove the Description from the location picker ([\#7485](https://github.com/matrix-org/matrix-react-sdk/pull/7485)).
 * Fix look of the untrusted device dialog ([\#7487](https://github.com/matrix-org/matrix-react-sdk/pull/7487)). Fixes vector-im/element-web#20447. Contributed by @SimonBrandner.
 * Hide maximise button in the sticker picker  ([\#7488](https://github.com/matrix-org/matrix-react-sdk/pull/7488)). Fixes vector-im/element-web#20443. Contributed by @SimonBrandner.
 * Fix space ordering to match newer spec ([\#7481](https://github.com/matrix-org/matrix-react-sdk/pull/7481)).
 * Fix typing notification colors ([\#7490](https://github.com/matrix-org/matrix-react-sdk/pull/7490)). Fixes vector-im/element-web#20144. Contributed by @SimonBrandner.
 * fix fallback for pluralized strings ([\#7480](https://github.com/matrix-org/matrix-react-sdk/pull/7480)). Fixes vector-im/element-web#20426.
 * Fix right panel soft crashes chat rooms ([\#7479](https://github.com/matrix-org/matrix-react-sdk/pull/7479)). Fixes vector-im/element-web#20433.
 * update yarn.lock and i18n ([\#7476](https://github.com/matrix-org/matrix-react-sdk/pull/7476)). Fixes vector-im/element-web#20426 and vector-im/element-web#20423.
 * Don't send typing notification when restoring composer draft ([\#7477](https://github.com/matrix-org/matrix-react-sdk/pull/7477)). Fixes vector-im/element-web#20424.
 * Fix room joining spinner being incorrect if you change room mid-join ([\#7473](https://github.com/matrix-org/matrix-react-sdk/pull/7473)).
 * Only return the approved widget capabilities instead of accepting all requested capabilities ([\#7454](https://github.com/matrix-org/matrix-react-sdk/pull/7454)). Contributed by @dhenneke.
 * Fix quoting messages from the search view ([\#7466](https://github.com/matrix-org/matrix-react-sdk/pull/7466)). Fixes vector-im/element-web#20353.
 * Attribute fallback i18n strings with lang attribute ([\#7323](https://github.com/matrix-org/matrix-react-sdk/pull/7323)).
 * Fix spotlight cmd-k wrongly expanding left panel ([\#7463](https://github.com/matrix-org/matrix-react-sdk/pull/7463)). Fixes vector-im/element-web#20399.
 * Fix room_id check when adding user widgets ([\#7448](https://github.com/matrix-org/matrix-react-sdk/pull/7448)). Fixes vector-im/element-web#19382. Contributed by @bink.
 * Add new line in settings label ([\#7451](https://github.com/matrix-org/matrix-react-sdk/pull/7451)). Fixes vector-im/element-web#20365.
 * Fix handling incoming redactions in EventIndex ([\#7443](https://github.com/matrix-org/matrix-react-sdk/pull/7443)). Fixes vector-im/element-web#19326.
 * Fix room alias address isn't checked for validity before being shown as added ([\#7107](https://github.com/matrix-org/matrix-react-sdk/pull/7107)). Fixes vector-im/element-web#19609. Contributed by @Palid.
 * Call view accessibility fixes ([\#7439](https://github.com/matrix-org/matrix-react-sdk/pull/7439)). Fixes vector-im/element-web#18516.
 * Fix offscreen canvas breaking with split-brained firefox support ([\#7440](https://github.com/matrix-org/matrix-react-sdk/pull/7440)).
 * Removed red shield in forwarding preview. ([\#7447](https://github.com/matrix-org/matrix-react-sdk/pull/7447)). Contributed by @ankur12-1610.
 * Wrap status message ([\#7325](https://github.com/matrix-org/matrix-react-sdk/pull/7325)). Fixes vector-im/element-web#20092. Contributed by @SimonBrandner.
 * Move hideSender logic into state so it causes re-render ([\#7413](https://github.com/matrix-org/matrix-react-sdk/pull/7413)). Fixes vector-im/element-web#18448.
 * Fix dialpad positioning ([\#7446](https://github.com/matrix-org/matrix-react-sdk/pull/7446)). Fixes vector-im/element-web#20175. Contributed by @SimonBrandner.
 * Hide non-functional list options on Suggested sublist ([\#7410](https://github.com/matrix-org/matrix-react-sdk/pull/7410)). Fixes vector-im/element-web#20252.
 * Fix width overflow in mini composer overflow menu ([\#7411](https://github.com/matrix-org/matrix-react-sdk/pull/7411)). Fixes vector-im/element-web#20263.
 * Fix being wrongly sent to Home space when creating/joining/leaving rooms ([\#7418](https://github.com/matrix-org/matrix-react-sdk/pull/7418)). Fixes matrix-org/element-web-rageshakes#7331 vector-im/element-web#20246 and vector-im/element-web#20240.
 * Fix HTML Export where the data-mx-theme is `Light` not `light` ([\#7415](https://github.com/matrix-org/matrix-react-sdk/pull/7415)).
 * Don't disable username/password fields whilst doing wk-lookup ([\#7438](https://github.com/matrix-org/matrix-react-sdk/pull/7438)). Fixes vector-im/element-web#20121.
 * Prevent keyboard propagation out of context menus ([\#7437](https://github.com/matrix-org/matrix-react-sdk/pull/7437)). Fixes vector-im/element-web#20317.
 * Fix nulls leaking into geo urls ([\#7433](https://github.com/matrix-org/matrix-react-sdk/pull/7433)).
 * Fix zIndex of peristent apps in miniMode ([\#7429](https://github.com/matrix-org/matrix-react-sdk/pull/7429)).
 * Space panel should watch spaces for space name changes ([\#7432](https://github.com/matrix-org/matrix-react-sdk/pull/7432)).
 * Fix list formatting alternating on edit ([\#7422](https://github.com/matrix-org/matrix-react-sdk/pull/7422)). Fixes vector-im/element-web#20073. Contributed by @renancleyson-dev.
 * Don't show `Testing small changes` without UIFeature.Feedback ([\#7427](https://github.com/matrix-org/matrix-react-sdk/pull/7427)). Fixes vector-im/element-web#20298.
 * Fix invisible toggle space panel button ([\#7426](https://github.com/matrix-org/matrix-react-sdk/pull/7426)). Fixes vector-im/element-web#20279.
 * Fix legacy breadcrumbs wrongly showing up ([\#7425](https://github.com/matrix-org/matrix-react-sdk/pull/7425)).
 * Space Panel use SettingsStore instead of SpaceStore as source of truth ([\#7404](https://github.com/matrix-org/matrix-react-sdk/pull/7404)). Fixes vector-im/element-web#20250.
 * Fix inline code block nowrap issue ([\#7406](https://github.com/matrix-org/matrix-react-sdk/pull/7406)).
 * Fix notification badge for All Rooms space ([\#7401](https://github.com/matrix-org/matrix-react-sdk/pull/7401)). Fixes vector-im/element-web#20229.
 * Show error if could not load space hierarchy ([\#7399](https://github.com/matrix-org/matrix-react-sdk/pull/7399)). Fixes vector-im/element-web#20221.
 * Increase gap between ELS and the subsequent event to prevent overlap ([\#7391](https://github.com/matrix-org/matrix-react-sdk/pull/7391)). Fixes vector-im/element-web#18319.
 * Fix list of members in space preview ([\#7356](https://github.com/matrix-org/matrix-react-sdk/pull/7356)). Fixes vector-im/element-web#19781.
 * Fix sizing of e2e shield in bubble layout ([\#7394](https://github.com/matrix-org/matrix-react-sdk/pull/7394)). Fixes vector-im/element-web#19090.
 * Fix bubble radius wrong when followed by a state event from same user ([\#7393](https://github.com/matrix-org/matrix-react-sdk/pull/7393)). Fixes vector-im/element-web#18982.
 * Fix alignment between ELS and Events in bubble layout ([\#7392](https://github.com/matrix-org/matrix-react-sdk/pull/7392)). Fixes vector-im/element-web#19652 and vector-im/element-web#19057.
 * Don't include the accuracy parameter in location events if accuracy could not be determined. ([\#7375](https://github.com/matrix-org/matrix-react-sdk/pull/7375)).
 * Make compact layout only apply to Modern layout ([\#7382](https://github.com/matrix-org/matrix-react-sdk/pull/7382)). Fixes vector-im/element-web#18412.
 * Pin qrcode to fix e2e verification bug ([\#7378](https://github.com/matrix-org/matrix-react-sdk/pull/7378)). Fixes vector-im/element-web#20188.
 * Add internationalisation to progress strings in room export dialog ([\#7385](https://github.com/matrix-org/matrix-react-sdk/pull/7385)). Fixes vector-im/element-web#20208.
 * Prevent escape to cancel edit from also scrolling to bottom ([\#7380](https://github.com/matrix-org/matrix-react-sdk/pull/7380)). Fixes vector-im/element-web#20182.
 * Fix narrow mode composer buttons for polls labs ([\#7386](https://github.com/matrix-org/matrix-react-sdk/pull/7386)). Fixes vector-im/element-web#20067.
 * Fix useUserStatusMessage exploding on unknown user ([\#7365](https://github.com/matrix-org/matrix-react-sdk/pull/7365)).
 * Fix room join spinner in room list header ([\#7364](https://github.com/matrix-org/matrix-react-sdk/pull/7364)). Fixes vector-im/element-web#20139.
 * Fix room search sometimes not opening spotlight ([\#7363](https://github.com/matrix-org/matrix-react-sdk/pull/7363)). Fixes matrix-org/element-web-rageshakes#7288.

Changes in [1.9.8](https://github.com/vector-im/element-desktop/releases/tag/v1.9.8) (2021-12-20)
=================================================================================================

## ✨ Features
 * Include Vietnamese language ([\#20029](https://github.com/vector-im/element-web/pull/20029)).
 * Simple static location sharing ([\#19754](https://github.com/vector-im/element-web/pull/19754)).
 * Add support for the Indonesian language ([\#20032](https://github.com/vector-im/element-web/pull/20032)). Fixes vector-im/element-web#20030. Contributed by @Linerly.
 * Always unhide widgets on layout change (pinning a widget) ([\#7299](https://github.com/matrix-org/matrix-react-sdk/pull/7299)).
 * Update status message in the member list and user info panel when it is changed ([\#7338](https://github.com/matrix-org/matrix-react-sdk/pull/7338)). Fixes vector-im/element-web#20127. Contributed by @SimonBrandner.
 * Iterate space panel toggle collapse interaction ([\#7335](https://github.com/matrix-org/matrix-react-sdk/pull/7335)). Fixes vector-im/element-web#20079.
 * Spotlight search labs ([\#7116](https://github.com/matrix-org/matrix-react-sdk/pull/7116)). Fixes vector-im/element-web#19530.
 * Put room settings form elements in fieldsets ([\#7311](https://github.com/matrix-org/matrix-react-sdk/pull/7311)).
 * Add descriptions to ambiguous links for screen readers ([\#7310](https://github.com/matrix-org/matrix-react-sdk/pull/7310)).
 * Make tooltips keyboard accessible ([\#7281](https://github.com/matrix-org/matrix-react-sdk/pull/7281)).
 * Iterate room context menus for DMs ([\#7308](https://github.com/matrix-org/matrix-react-sdk/pull/7308)). Fixes vector-im/element-web#19527.
 * Update space panel expand mechanism ([\#7230](https://github.com/matrix-org/matrix-react-sdk/pull/7230)). Fixes vector-im/element-web#17993.
 * Add CSS variable to make the UI gaps consistent and fix the resize handle position ([\#7234](https://github.com/matrix-org/matrix-react-sdk/pull/7234)). Fixes vector-im/element-web#19904 and vector-im/element-web#19938.
 * Custom location sharing. ([\#7185](https://github.com/matrix-org/matrix-react-sdk/pull/7185)).
 * Simple static location sharing ([\#7135](https://github.com/matrix-org/matrix-react-sdk/pull/7135)).
 * Finish sending pending messages before leaving room ([\#7276](https://github.com/matrix-org/matrix-react-sdk/pull/7276)). Fixes vector-im/element-web#4702.
 * Dropdown follow wai-aria practices for expanding on arrow keys ([\#7277](https://github.com/matrix-org/matrix-react-sdk/pull/7277)). Fixes vector-im/element-web#3687.
 * Expose PL control for pinned events when lab enabled ([\#7278](https://github.com/matrix-org/matrix-react-sdk/pull/7278)). Fixes vector-im/element-web#5396.
 * In People & Favourites metaspaces always show all rooms ([\#7288](https://github.com/matrix-org/matrix-react-sdk/pull/7288)). Fixes vector-im/element-web#20048.
 * Don't allow calls when the connection the server has been lost ([\#7287](https://github.com/matrix-org/matrix-react-sdk/pull/7287)). Fixes vector-im/element-web#2096. Contributed by @SimonBrandner.
 * Analytics opt in for posthog ([\#6936](https://github.com/matrix-org/matrix-react-sdk/pull/6936)).
 * Don't inhibit current room notifications if user has Modal open ([\#7274](https://github.com/matrix-org/matrix-react-sdk/pull/7274)). Fixes vector-im/element-web#1118.
 * Remove the `Screen sharing is here!` dialog ([\#7266](https://github.com/matrix-org/matrix-react-sdk/pull/7266)). Fixes vector-im/element-web#18824. Contributed by @SimonBrandner.
 * Make composer buttons react to settings without having to change room ([\#7264](https://github.com/matrix-org/matrix-react-sdk/pull/7264)). Fixes vector-im/element-web#20011.
 * Decorate view keyboard shortcuts link as a link ([\#7260](https://github.com/matrix-org/matrix-react-sdk/pull/7260)). Fixes vector-im/element-web#20007.
 * Improve ease of focusing on Room list Search ([\#7255](https://github.com/matrix-org/matrix-react-sdk/pull/7255)). Fixes matrix-org/element-web-rageshakes#7017.
 * Autofocus device panel entry when renaming device ([\#7249](https://github.com/matrix-org/matrix-react-sdk/pull/7249)). Fixes vector-im/element-web#19984.
 * Update Space Panel scrollable region ([\#7245](https://github.com/matrix-org/matrix-react-sdk/pull/7245)). Fixes vector-im/element-web#19978.
 * Replace breadcrumbs with recently viewed menu ([\#7073](https://github.com/matrix-org/matrix-react-sdk/pull/7073)). Fixes vector-im/element-web#19528.
 * Tweaks to informational architecture 1.1 ([\#7052](https://github.com/matrix-org/matrix-react-sdk/pull/7052)). Fixes vector-im/element-web#19526, vector-im/element-web#19379, vector-im/element-web#17792, vector-im/element-web#16450, vector-im/element-web#19881, vector-im/element-web#19892, vector-im/element-web#19300, vector-im/element-web#19324, vector-im/element-web#17307, vector-im/element-web#17468 vector-im/element-web#19932 and vector-im/element-web#19956.

## 🐛 Bug Fixes
 * Enable webgl ([\#284](https://github.com/vector-im/element-desktop/pull/284)). Fixes vector-im/element-web#20132. Contributed by @SimonBrandner.
 * [Release] Fix inline code block nowrap issue ([\#7407](https://github.com/matrix-org/matrix-react-sdk/pull/7407)).
 * don't collapse spaces in inline code blocks (https ([\#7328](https://github.com/matrix-org/matrix-react-sdk/pull/7328)). Fixes vector-im/element-web#6051. Contributed by @HarHarLinks.
 * Fix accessibility regressions ([\#7336](https://github.com/matrix-org/matrix-react-sdk/pull/7336)).
 * Debounce User Info start dm "Message" button ([\#7357](https://github.com/matrix-org/matrix-react-sdk/pull/7357)). Fixes vector-im/element-web#7763.
 * Fix thread filter being cut-off on narrow screens ([\#7354](https://github.com/matrix-org/matrix-react-sdk/pull/7354)). Fixes vector-im/element-web#20146.
 * Fix upgraded rooms wrongly showing up in spotlight ([\#7341](https://github.com/matrix-org/matrix-react-sdk/pull/7341)). Fixes vector-im/element-web#20141.
 * Show votes in replied-to polls (pass in getRelationsForEvent) ([\#7345](https://github.com/matrix-org/matrix-react-sdk/pull/7345)). Fixes vector-im/element-web#20153.
 * Keep all previously approved widget capabilities when requesting new capabilities ([\#7340](https://github.com/matrix-org/matrix-react-sdk/pull/7340)). Contributed by @dhenneke.
 * Only show poll previews when the polls feature is enabled ([\#7331](https://github.com/matrix-org/matrix-react-sdk/pull/7331)).
 * No-op action:join if the user is already invited for scalar ([\#7334](https://github.com/matrix-org/matrix-react-sdk/pull/7334)). Fixes vector-im/element-web#20134.
 * Don't show polls in timeline if polls are disabled ([\#7332](https://github.com/matrix-org/matrix-react-sdk/pull/7332)). Fixes vector-im/element-web#20130.
 * Don't send a poll response event if you are voting for your current c… ([\#7326](https://github.com/matrix-org/matrix-react-sdk/pull/7326)). Fixes vector-im/element-web#20129.
 * Don't show options button when the user can't modify widgets ([\#7324](https://github.com/matrix-org/matrix-react-sdk/pull/7324)). Fixes vector-im/element-web#20114. Contributed by @SimonBrandner.
 * Add vertical spacing between buttons when they go over multiple lines ([\#7314](https://github.com/matrix-org/matrix-react-sdk/pull/7314)). Contributed by @twigleingrid.
 * Improve accessibility of opening space create menu ([\#7316](https://github.com/matrix-org/matrix-react-sdk/pull/7316)).
 * Correct tab order in room preview dialog ([\#7302](https://github.com/matrix-org/matrix-react-sdk/pull/7302)).
 * Fix favourites and people metaspaces not rendering their content ([\#7315](https://github.com/matrix-org/matrix-react-sdk/pull/7315)). Fixes vector-im/element-web#20070.
 * Make clear button images visible in high contrast theme ([\#7306](https://github.com/matrix-org/matrix-react-sdk/pull/7306)). Fixes vector-im/element-web#19931.
 * Fix html exporting and improve output size ([\#7312](https://github.com/matrix-org/matrix-react-sdk/pull/7312)). Fixes vector-im/element-web#19436 vector-im/element-web#20107 and vector-im/element-web#19441.
 * Fix textual message stripping new line ([\#7239](https://github.com/matrix-org/matrix-react-sdk/pull/7239)). Fixes vector-im/element-web#15320. Contributed by @renancleyson-dev.
 * Fix issue with room list resizer getting clipped in firefox ([\#7303](https://github.com/matrix-org/matrix-react-sdk/pull/7303)). Fixes vector-im/element-web#20076.
 * Fix wrong indentation with nested ordered list unnesting list on edit ([\#7300](https://github.com/matrix-org/matrix-react-sdk/pull/7300)). Contributed by @renancleyson-dev.
 * Fix input field behaviour inside context menus ([\#7293](https://github.com/matrix-org/matrix-react-sdk/pull/7293)). Fixes vector-im/element-web#19881.
 * Corrected the alignment of the Edit button on LoginPage. ([\#7292](https://github.com/matrix-org/matrix-react-sdk/pull/7292)). Contributed by @ankur12-1610.
 * Allow sharing manual location without giving location permission ([\#7295](https://github.com/matrix-org/matrix-react-sdk/pull/7295)). Fixes vector-im/element-web#20065. Contributed by @tulir.
 * Make emoji picker search placeholder localizable ([\#7294](https://github.com/matrix-org/matrix-react-sdk/pull/7294)).
 * Fix jump to bottom on message send ([\#7280](https://github.com/matrix-org/matrix-react-sdk/pull/7280)). Fixes vector-im/element-web#19859. Contributed by @SimonBrandner.
 * Fix: Warning: Unsupported style property pointer-events. Did you mean pointerEvents? ([\#7291](https://github.com/matrix-org/matrix-react-sdk/pull/7291)).
 * Add edits and replies to the right panel timeline & prepare the timelineCard to share code with threads ([\#7262](https://github.com/matrix-org/matrix-react-sdk/pull/7262)). Fixes vector-im/element-web#20012 and vector-im/element-web#19928.
 * Fix labs exploding when lab group is empty ([\#7290](https://github.com/matrix-org/matrix-react-sdk/pull/7290)). Fixes vector-im/element-web#20051.
 * Update URL when room aliases are modified ([\#7289](https://github.com/matrix-org/matrix-react-sdk/pull/7289)). Fixes vector-im/element-web#1616 and vector-im/element-web#1925.
 * Render mini user menu for when space panel is disabled ([\#7258](https://github.com/matrix-org/matrix-react-sdk/pull/7258)). Fixes vector-im/element-web#19998.
 * When accepting DM from People metaspace don't switch to Home ([\#7272](https://github.com/matrix-org/matrix-react-sdk/pull/7272)). Fixes vector-im/element-web#19995.
 * Fix CallPreview `room is null` ([\#7265](https://github.com/matrix-org/matrix-react-sdk/pull/7265)). Fixes vector-im/element-web#19990, vector-im/element-web#19972, matrix-org/element-web-rageshakes#7004 matrix-org/element-web-rageshakes#6991 and matrix-org/element-web-rageshakes#6964.
 * Fixes more instances of double-translation ([\#7259](https://github.com/matrix-org/matrix-react-sdk/pull/7259)). Fixes vector-im/element-web#20010.
 * Fix video calls ([\#7256](https://github.com/matrix-org/matrix-react-sdk/pull/7256)). Fixes vector-im/element-web#20008. Contributed by @SimonBrandner.
 * Fix broken i18n in Forgot & Change password ([\#7252](https://github.com/matrix-org/matrix-react-sdk/pull/7252)). Fixes vector-im/element-web#19989.
 * Fix setBotPower to not use `.content` ([\#7179](https://github.com/matrix-org/matrix-react-sdk/pull/7179)). Fixes vector-im/element-web#19845.
 * Break long words in pinned messages to prevent overflow ([\#7251](https://github.com/matrix-org/matrix-react-sdk/pull/7251)). Fixes vector-im/element-web#19985.
 * Disallow sending empty feedbacks ([\#7240](https://github.com/matrix-org/matrix-react-sdk/pull/7240)).
 * Fix wrongly sized default sub-space icons in space panel ([\#7243](https://github.com/matrix-org/matrix-react-sdk/pull/7243)). Fixes vector-im/element-web#19973.
 * Hide clear cache and reload button if crash is before client init ([\#7242](https://github.com/matrix-org/matrix-react-sdk/pull/7242)). Fixes matrix-org/element-web-rageshakes#6996.
 * Fix automatic space switching wrongly going via Home for room aliases ([\#7247](https://github.com/matrix-org/matrix-react-sdk/pull/7247)). Fixes vector-im/element-web#19974.
 * Fix links being parsed as markdown links improperly ([\#7200](https://github.com/matrix-org/matrix-react-sdk/pull/7200)). Contributed by @Palid.

Changes in [1.9.7](https://github.com/vector-im/element-desktop/releases/tag/v1.9.7) (2021-12-13)
=================================================================================================

## 🔒 SECURITY FIXES
* Security release with updated version of Olm to fix https://matrix.org/blog/2021/12/03/pre-disclosure-upcoming-security-release-of-libolm-and-matrix-js-sdk
* Upgrade Electron to 13.5.2 to fix https://matrix.org/blog/2022/01/31/high-severity-vulnerability-in-element-desktop-1-9-6-and-earlier (https://github.com/vector-im/element-desktop/security/advisories/GHSA-mjrg-9f8r-h3m7)

## 🐛 Bug Fixes
* Fix a crash on logout

Changes in [1.9.6](https://github.com/vector-im/element-desktop/releases/tag/v1.9.6) (2021-12-06)
=================================================================================================

## ✨ Features
 * Add unread indicator to the timelineCard header icon ([\#7156](https://github.com/matrix-org/matrix-react-sdk/pull/7156)). Fixes vector-im/element-web#19635.
 * Only show core navigation elements (call/chat/notification/info) when a widget is maximised ([\#7114](https://github.com/matrix-org/matrix-react-sdk/pull/7114)). Fixes vector-im/element-web#19632.
 * Improve ThreadPanel ctx menu accessibility ([\#7217](https://github.com/matrix-org/matrix-react-sdk/pull/7217)). Fixes vector-im/element-web#19885.
 * Allow filtering room list during treeview navigation ([\#7219](https://github.com/matrix-org/matrix-react-sdk/pull/7219)). Fixes vector-im/element-web#14702.
 * Add right panel chat timeline ([\#7112](https://github.com/matrix-org/matrix-react-sdk/pull/7112)). Fixes vector-im/element-web#19633.
 * Hide server options hint when disable_custom_urls is true ([\#7215](https://github.com/matrix-org/matrix-react-sdk/pull/7215)). Fixes vector-im/element-web#19919.
 * Improve right panel resize handle usability ([\#7204](https://github.com/matrix-org/matrix-react-sdk/pull/7204)). Fixes vector-im/element-web#15145. Contributed by @weeman1337.
 * Spaces quick settings ([\#7196](https://github.com/matrix-org/matrix-react-sdk/pull/7196)).
 * Maximised widgets always force a call to be shown in PIP mode ([\#7163](https://github.com/matrix-org/matrix-react-sdk/pull/7163)). Fixes vector-im/element-web#19637.
 * Group Labs flags ([\#7190](https://github.com/matrix-org/matrix-react-sdk/pull/7190)).
 * Show room context details in forward dialog ([\#7162](https://github.com/matrix-org/matrix-react-sdk/pull/7162)). Fixes vector-im/element-web#19793.
 * Remove chevrons from RoomSummaryCard_Button ([\#7137](https://github.com/matrix-org/matrix-react-sdk/pull/7137)). Fixes vector-im/element-web#19644.
 * Disable op/deop commands where user has no permissions ([\#7161](https://github.com/matrix-org/matrix-react-sdk/pull/7161)). Fixes vector-im/element-web#15390.
 * Add option to change the size of images/videos in the timeline ([\#7017](https://github.com/matrix-org/matrix-react-sdk/pull/7017)). Fixes vector-im/element-meta#49 vector-im/element-web#1520 and vector-im/element-web#19498.

## 🐛 Bug Fixes
 * Fix left panel glow in Safari ([\#7236](https://github.com/matrix-org/matrix-react-sdk/pull/7236)). Fixes vector-im/element-web#19863.
 * Fix newline on edit messages with quotes ([\#7227](https://github.com/matrix-org/matrix-react-sdk/pull/7227)). Fixes vector-im/element-web#12535. Contributed by @renancleyson-dev.
 * Guard against null refs in findSiblingElement ([\#7228](https://github.com/matrix-org/matrix-react-sdk/pull/7228)).
 * Tweak bottom of space panel buttons in expanded state ([\#7213](https://github.com/matrix-org/matrix-react-sdk/pull/7213)). Fixes vector-im/element-web#19921.
 * Fix multiline paragraph rendering as single line ([\#7210](https://github.com/matrix-org/matrix-react-sdk/pull/7210)). Fixes vector-im/element-web#8786. Contributed by @renancleyson-dev.
 * Improve room list message previews ([\#7224](https://github.com/matrix-org/matrix-react-sdk/pull/7224)). Fixes vector-im/element-web#17101 and vector-im/element-web#16169.
 * Fix EmojiPicker lazy loaded rendering bug ([\#7225](https://github.com/matrix-org/matrix-react-sdk/pull/7225)). Fixes vector-im/element-web#15341.
 * Prevent default avatar in UserInfo having pointer cursor ([\#7218](https://github.com/matrix-org/matrix-react-sdk/pull/7218)). Fixes vector-im/element-web#13872.
 * Prevent duplicate avatars in Event List Summaries ([\#7222](https://github.com/matrix-org/matrix-react-sdk/pull/7222)). Fixes vector-im/element-web#17706.
 * Respect the home page as a context for the Home space ([\#7216](https://github.com/matrix-org/matrix-react-sdk/pull/7216)). Fixes vector-im/element-web#19554.
 * Fix RoomUpgradeWarningBar exploding ([\#7214](https://github.com/matrix-org/matrix-react-sdk/pull/7214)). Fixes vector-im/element-web#19920.
 * Polish threads misalignments and UI diversion ([\#7209](https://github.com/matrix-org/matrix-react-sdk/pull/7209)). Fixes vector-im/element-web#19772, vector-im/element-web#19710 vector-im/element-web#19629 and vector-im/element-web#19711.
 * Fix Manage Restricted Join Rule Dialog for Spaces ([\#7208](https://github.com/matrix-org/matrix-react-sdk/pull/7208)). Fixes vector-im/element-web#19610.
 * Fix wrongly showing unpin in pinned messages tile with no perms ([\#7197](https://github.com/matrix-org/matrix-react-sdk/pull/7197)). Fixes vector-im/element-web#19886.
 * Make image size constrained by height when using the ImageSize.Large option ([\#7171](https://github.com/matrix-org/matrix-react-sdk/pull/7171)). Fixes vector-im/element-web#19788.
 * Prevent programmatic scrolling within truncated room sublists ([\#7191](https://github.com/matrix-org/matrix-react-sdk/pull/7191)).
 * Remove leading slash from /addwidget Jitsi confs ([\#7175](https://github.com/matrix-org/matrix-react-sdk/pull/7175)). Fixes vector-im/element-web#19839. Contributed by @AndrewFerr.
 * Fix automatic composer focus, regressed by threads work ([\#7167](https://github.com/matrix-org/matrix-react-sdk/pull/7167)). Fixes vector-im/element-web#19479.
 * Show space members when not invited even if summary didn't fail ([\#7153](https://github.com/matrix-org/matrix-react-sdk/pull/7153)). Fixes vector-im/element-web#19781.
 * Prevent custom power levels from breaking roles & permissions tab ([\#7160](https://github.com/matrix-org/matrix-react-sdk/pull/7160)). Fixes vector-im/element-web#19812.
 * Room Context Menu should respond to tag changes ([\#7154](https://github.com/matrix-org/matrix-react-sdk/pull/7154)). Fixes vector-im/element-web#19776.
 * Fix an edge case when trying to join an upgraded room ([\#7159](https://github.com/matrix-org/matrix-react-sdk/pull/7159)).

Changes in [1.9.5](https://github.com/vector-im/element-desktop/releases/tag/v1.9.5) (2021-11-22)
=================================================================================================

## ✨ Features
 * Make double-clicking the PiP take you to the call room ([\#7142](https://github.com/matrix-org/matrix-react-sdk/pull/7142)). Fixes vector-im/element-web#18421 vector-im/element-web#15920 and vector-im/element-web#18421. Contributed by @SimonBrandner.
 * Add maximise widget functionality ([\#7098](https://github.com/matrix-org/matrix-react-sdk/pull/7098)). Fixes vector-im/element-web#19619, vector-im/element-web#19621 vector-im/element-web#19760 and vector-im/element-web#19619.
 * Add rainfall effect ([\#7086](https://github.com/matrix-org/matrix-react-sdk/pull/7086)). Contributed by @justjosias.
 * Add root folder to zip file created by export chat feature ([\#7097](https://github.com/matrix-org/matrix-react-sdk/pull/7097)). Fixes vector-im/element-web#19653 and vector-im/element-web#19653. Contributed by @aaronraimist.
 * Improve VoIP UI/UX ([\#7048](https://github.com/matrix-org/matrix-react-sdk/pull/7048)). Fixes vector-im/element-web#19513 and vector-im/element-web#19513. Contributed by @SimonBrandner.
 * Unified room context menus ([\#7072](https://github.com/matrix-org/matrix-react-sdk/pull/7072)). Fixes vector-im/element-web#19527 and vector-im/element-web#19527.
 * In forgot password screen, show validation errors inline in the form, instead of in modals ([\#7113](https://github.com/matrix-org/matrix-react-sdk/pull/7113)). Contributed by @psrpinto.
 * Implement more meta-spaces ([\#7077](https://github.com/matrix-org/matrix-react-sdk/pull/7077)). Fixes vector-im/element-web#18634 vector-im/element-web#17295 and vector-im/element-web#18634.
 * Expose power level control for m.space.child ([\#7120](https://github.com/matrix-org/matrix-react-sdk/pull/7120)).
 * Forget member-list query when switching out of a room ([\#7093](https://github.com/matrix-org/matrix-react-sdk/pull/7093)). Fixes vector-im/element-web#19432 and vector-im/element-web#19432. Contributed by @SimonBrandner.
 * Do pre-submit availability check on username during registration ([\#6978](https://github.com/matrix-org/matrix-react-sdk/pull/6978)). Fixes vector-im/element-web#9545 and vector-im/element-web#9545.

## 🐛 Bug Fixes
 * Adjust recovery key button sizes depending on text width ([\#7134](https://github.com/matrix-org/matrix-react-sdk/pull/7134)). Fixes vector-im/element-web#19511 and vector-im/element-web#19511. Contributed by @weeman1337.
 * Fix bulk invite button getting a negative count ([\#7122](https://github.com/matrix-org/matrix-react-sdk/pull/7122)). Fixes vector-im/element-web#19466 and vector-im/element-web#19466. Contributed by @renancleyson-dev.
 * Fix maximised / pinned widget state being loaded correctly ([\#7146](https://github.com/matrix-org/matrix-react-sdk/pull/7146)). Fixes vector-im/element-web#19768 and vector-im/element-web#19768.
 * Don't reload the page when user hits enter when entering ban reason ([\#7145](https://github.com/matrix-org/matrix-react-sdk/pull/7145)). Fixes vector-im/element-web#19763 and vector-im/element-web#19763.
 * Fix timeline text when sharing room layout ([\#7140](https://github.com/matrix-org/matrix-react-sdk/pull/7140)). Fixes vector-im/element-web#19622 and vector-im/element-web#19622.
 * Fix look of emoji verification ([\#7133](https://github.com/matrix-org/matrix-react-sdk/pull/7133)). Fixes vector-im/element-web#19740 and vector-im/element-web#19740. Contributed by @SimonBrandner.
 * Fixes element not remembering widget hidden state per room ([\#7136](https://github.com/matrix-org/matrix-react-sdk/pull/7136)). Fixes vector-im/element-web#16672, matrix-org/element-web-rageshakes#4407, vector-im/element-web#15718 vector-im/element-web#15768 and vector-im/element-web#16672.
 * Don't keep spinning if joining space child failed ([\#7129](https://github.com/matrix-org/matrix-react-sdk/pull/7129)). Fixes matrix-org/element-web-rageshakes#6813 and matrix-org/element-web-rageshakes#6813.
 * Guard around SpaceStore onAccountData handler prevEvent ([\#7123](https://github.com/matrix-org/matrix-react-sdk/pull/7123)). Fixes vector-im/element-web#19705 and vector-im/element-web#19705.
 * Fix missing spaces in threads copy ([\#7119](https://github.com/matrix-org/matrix-react-sdk/pull/7119)). Fixes vector-im/element-web#19702 and vector-im/element-web#19702.
 * Fix hover tile border ([\#7117](https://github.com/matrix-org/matrix-react-sdk/pull/7117)). Fixes vector-im/element-web#19698 and vector-im/element-web#19698. Contributed by @SimonBrandner.
 * Fix quote button ([\#7096](https://github.com/matrix-org/matrix-react-sdk/pull/7096)). Fixes vector-im/element-web#19659 and vector-im/element-web#19659. Contributed by @SimonBrandner.
 * Fix space panel layout edge cases ([\#7101](https://github.com/matrix-org/matrix-react-sdk/pull/7101)). Fixes vector-im/element-web#19668 and vector-im/element-web#19668.
 * Update powerlevel/role when the user changes in the user info panel ([\#7099](https://github.com/matrix-org/matrix-react-sdk/pull/7099)). Fixes vector-im/element-web#19666 and vector-im/element-web#19666. Contributed by @SimonBrandner.
 * Fix avatar disappearing when setting a room topic ([\#7092](https://github.com/matrix-org/matrix-react-sdk/pull/7092)). Fixes vector-im/element-web#19226 and vector-im/element-web#19226. Contributed by @SimonBrandner.
 * Fix possible infinite loop on widget start ([\#7071](https://github.com/matrix-org/matrix-react-sdk/pull/7071)). Fixes vector-im/element-web#15494 and vector-im/element-web#15494.
 * Use device IDs for nameless devices in device list ([\#7081](https://github.com/matrix-org/matrix-react-sdk/pull/7081)). Fixes vector-im/element-web#19608 and vector-im/element-web#19608.
 * Don't re-sort rooms on no-op RoomUpdateCause.PossibleTagChange ([\#7053](https://github.com/matrix-org/matrix-react-sdk/pull/7053)). Contributed by @bradtgmurray.

Changes in [1.9.4](https://github.com/vector-im/element-desktop/releases/tag/v1.9.4) (2021-11-08)
=================================================================================================

## ✨ Features
 * Improve the look of tooltips ([\#7049](https://github.com/matrix-org/matrix-react-sdk/pull/7049)). Contributed by @SimonBrandner.
 * Improve the look of the spinner ([\#6083](https://github.com/matrix-org/matrix-react-sdk/pull/6083)). Contributed by @SimonBrandner.
 * Polls: Creation form & start event ([\#7001](https://github.com/matrix-org/matrix-react-sdk/pull/7001)).
 * Show a gray shield when encrypted by deleted session ([\#6119](https://github.com/matrix-org/matrix-react-sdk/pull/6119)). Contributed by @SimonBrandner.
 * Silence some widgets for better screen reader presentation. ([\#7057](https://github.com/matrix-org/matrix-react-sdk/pull/7057)). Contributed by @ndarilek.
 * Make message separator more accessible. ([\#7056](https://github.com/matrix-org/matrix-react-sdk/pull/7056)). Contributed by @ndarilek.
 * Give each room directory entry the `listitem` role to correspond with the containing `list`. ([\#7035](https://github.com/matrix-org/matrix-react-sdk/pull/7035)). Contributed by @ndarilek.
 * Implement RequiresClient capability for widgets ([\#7005](https://github.com/matrix-org/matrix-react-sdk/pull/7005)). Fixes vector-im/element-web#15744 and vector-im/element-web#15744.
 * Respect the system high contrast setting when using system theme ([\#7043](https://github.com/matrix-org/matrix-react-sdk/pull/7043)).
 * Remove redundant duplicate mimetype field which doesn't conform to spec ([\#7045](https://github.com/matrix-org/matrix-react-sdk/pull/7045)). Fixes vector-im/element-web#17145 and vector-im/element-web#17145.
 * Make join button on space hierarchy action in the background ([\#7041](https://github.com/matrix-org/matrix-react-sdk/pull/7041)). Fixes vector-im/element-web#17388 and vector-im/element-web#17388.
 * Add a high contrast theme (a variant of the light theme) ([\#7036](https://github.com/matrix-org/matrix-react-sdk/pull/7036)).
 * Improve timeline message for restricted join rule changes ([\#6984](https://github.com/matrix-org/matrix-react-sdk/pull/6984)). Fixes vector-im/element-web#18980 and vector-im/element-web#18980.
 * Improve the appearance of the font size slider ([\#7038](https://github.com/matrix-org/matrix-react-sdk/pull/7038)).
 * Improve RovingTabIndex & Room List filtering performance ([\#6987](https://github.com/matrix-org/matrix-react-sdk/pull/6987)). Fixes vector-im/element-web#17864 and vector-im/element-web#17864.
 * Remove outdated Spaces restricted rooms warning ([\#6927](https://github.com/matrix-org/matrix-react-sdk/pull/6927)).
 * Make /msg <message> param optional for more flexibility ([\#7028](https://github.com/matrix-org/matrix-react-sdk/pull/7028)). Fixes vector-im/element-web#19481 and vector-im/element-web#19481.
 * Add decoration to space hierarchy for tiles which have already been j… ([\#6969](https://github.com/matrix-org/matrix-react-sdk/pull/6969)). Fixes vector-im/element-web#18755 and vector-im/element-web#18755.
 * Add insert link button to the format bar ([\#5879](https://github.com/matrix-org/matrix-react-sdk/pull/5879)). Contributed by @SimonBrandner.
 * Improve visibility of font size chooser ([\#6988](https://github.com/matrix-org/matrix-react-sdk/pull/6988)).
 * Soften border-radius on selected/hovered messages ([\#6525](https://github.com/matrix-org/matrix-react-sdk/pull/6525)). Fixes vector-im/element-web#18108. Contributed by @SimonBrandner.
 * Add a developer mode flag and use it for accessing space timelines ([\#6994](https://github.com/matrix-org/matrix-react-sdk/pull/6994)). Fixes vector-im/element-web#19416 and vector-im/element-web#19416.
 * Position toggle switch more clearly ([\#6914](https://github.com/matrix-org/matrix-react-sdk/pull/6914)). Contributed by @CicadaCinema.
 * Validate email address in forgot password dialog ([\#6983](https://github.com/matrix-org/matrix-react-sdk/pull/6983)). Fixes vector-im/element-web#9978 and vector-im/element-web#9978. Contributed by @psrpinto.
 * Handle and i18n M_THREEPID_IN_USE during registration ([\#6986](https://github.com/matrix-org/matrix-react-sdk/pull/6986)). Fixes vector-im/element-web#13767 and vector-im/element-web#13767.
 * For space invite previews, use room summary API to get the right member count ([\#6982](https://github.com/matrix-org/matrix-react-sdk/pull/6982)). Fixes vector-im/element-web#19123 and vector-im/element-web#19123.
 * Simplify Space Panel notification badge layout ([\#6977](https://github.com/matrix-org/matrix-react-sdk/pull/6977)). Fixes vector-im/element-web#18527 and vector-im/element-web#18527.
 * Use prettier hsName during 3pid registration where possible ([\#6980](https://github.com/matrix-org/matrix-react-sdk/pull/6980)). Fixes vector-im/element-web#19162 and vector-im/element-web#19162.

## 🐛 Bug Fixes
 * Add a condition to only activate the resizer which belongs to the clicked handle ([\#7055](https://github.com/matrix-org/matrix-react-sdk/pull/7055)). Fixes vector-im/element-web#19521 and vector-im/element-web#19521.
 * Restore composer focus after event edit ([\#7065](https://github.com/matrix-org/matrix-react-sdk/pull/7065)). Fixes vector-im/element-web#19469 and vector-im/element-web#19469.
 * Don't apply message bubble visual style to media messages ([\#7040](https://github.com/matrix-org/matrix-react-sdk/pull/7040)).
 * Handle no selected screen when screen-sharing ([\#7018](https://github.com/matrix-org/matrix-react-sdk/pull/7018)). Fixes vector-im/element-web#19460 and vector-im/element-web#19460. Contributed by @SimonBrandner.
 * Add history entry before completing emoji ([\#7007](https://github.com/matrix-org/matrix-react-sdk/pull/7007)). Fixes vector-im/element-web#19177 and vector-im/element-web#19177. Contributed by @RafaelGoncalves8.
 * Add padding between controls on edit form in message bubbles ([\#7039](https://github.com/matrix-org/matrix-react-sdk/pull/7039)).
 * Respect the roomState right container request for the Jitsi widget ([\#7033](https://github.com/matrix-org/matrix-react-sdk/pull/7033)). Fixes vector-im/element-web#16552 and vector-im/element-web#16552.
 * Fix cannot read length of undefined for room upgrades ([\#7037](https://github.com/matrix-org/matrix-react-sdk/pull/7037)). Fixes vector-im/element-web#19509 and vector-im/element-web#19509.
 * Cleanup re-dispatching around timelines and composers ([\#7023](https://github.com/matrix-org/matrix-react-sdk/pull/7023)). Fixes vector-im/element-web#19491 and vector-im/element-web#19491. Contributed by @SimonBrandner.
 * Fix removing a room from a Space and interaction with `m.space.parent` ([\#6944](https://github.com/matrix-org/matrix-react-sdk/pull/6944)). Fixes vector-im/element-web#19363 and vector-im/element-web#19363.
 * Fix recent css regression ([\#7022](https://github.com/matrix-org/matrix-react-sdk/pull/7022)). Fixes vector-im/element-web#19470 and vector-im/element-web#19470. Contributed by @CicadaCinema.
 * Fix ModalManager reRender racing with itself ([\#7027](https://github.com/matrix-org/matrix-react-sdk/pull/7027)). Fixes vector-im/element-web#19489 and vector-im/element-web#19489.
 * Fix fullscreening a call while connecting ([\#7019](https://github.com/matrix-org/matrix-react-sdk/pull/7019)). Fixes vector-im/element-web#19309 and vector-im/element-web#19309. Contributed by @SimonBrandner.
 * Allow scrolling right in reply-quoted code block ([\#7024](https://github.com/matrix-org/matrix-react-sdk/pull/7024)). Fixes vector-im/element-web#19487 and vector-im/element-web#19487. Contributed by @SimonBrandner.
 * Fix dark theme codeblock colors ([\#6384](https://github.com/matrix-org/matrix-react-sdk/pull/6384)). Fixes vector-im/element-web#17998. Contributed by @SimonBrandner.
 * Show passphrase input label ([\#6992](https://github.com/matrix-org/matrix-react-sdk/pull/6992)). Fixes vector-im/element-web#19428 and vector-im/element-web#19428. Contributed by @RafaelGoncalves8.
 * Always render disabled settings as disabled ([\#7014](https://github.com/matrix-org/matrix-react-sdk/pull/7014)).
 * Make "Security Phrase" placeholder look consistent cross-browser ([\#6870](https://github.com/matrix-org/matrix-react-sdk/pull/6870)). Fixes vector-im/element-web#19006 and vector-im/element-web#19006. Contributed by @neer17.
 * Fix direction override characters breaking member event text direction ([\#6999](https://github.com/matrix-org/matrix-react-sdk/pull/6999)).
 * Remove redundant text in verification dialogs ([\#6993](https://github.com/matrix-org/matrix-react-sdk/pull/6993)). Fixes vector-im/element-web#19290 and vector-im/element-web#19290. Contributed by @RafaelGoncalves8.
 * Fix space panel name overflowing ([\#6995](https://github.com/matrix-org/matrix-react-sdk/pull/6995)). Fixes vector-im/element-web#19455 and vector-im/element-web#19455.
 * Fix conflicting CSS on syntax highlighted blocks ([\#6991](https://github.com/matrix-org/matrix-react-sdk/pull/6991)). Fixes vector-im/element-web#19445 and vector-im/element-web#19445.

Changes in [1.9.3](https://github.com/vector-im/element-desktop/releases/tag/v1.9.3) (2021-10-25)
=================================================================================================

## ✨ Features
 * Convert the "Cryptography" settings panel to an HTML table to assist screen reader users. ([\#6968](https://github.com/matrix-org/matrix-react-sdk/pull/6968)). Contributed by [andybalaam](https://github.com/andybalaam).
 * Swap order of private space creation and tweak copy ([\#6967](https://github.com/matrix-org/matrix-react-sdk/pull/6967)). Fixes vector-im/element-web#18768 and vector-im/element-web#18768.
 * Add spacing to Room settings - Notifications subsection ([\#6962](https://github.com/matrix-org/matrix-react-sdk/pull/6962)). Contributed by [CicadaCinema](https://github.com/CicadaCinema).
 * Use HTML tables for some tabular user interface areas, to assist with screen reader use ([\#6955](https://github.com/matrix-org/matrix-react-sdk/pull/6955)). Contributed by [andybalaam](https://github.com/andybalaam).
 * Fix space invite edge cases ([\#6884](https://github.com/matrix-org/matrix-react-sdk/pull/6884)). Fixes vector-im/element-web#19010 vector-im/element-web#17345 and vector-im/element-web#19010.
 * Allow options to cascade kicks/bans throughout spaces ([\#6829](https://github.com/matrix-org/matrix-react-sdk/pull/6829)). Fixes vector-im/element-web#18969 and vector-im/element-web#18969.
 * Make public space alias field mandatory again ([\#6921](https://github.com/matrix-org/matrix-react-sdk/pull/6921)). Fixes vector-im/element-web#19003 and vector-im/element-web#19003.
 * Add progress bar to restricted room upgrade dialog ([\#6919](https://github.com/matrix-org/matrix-react-sdk/pull/6919)). Fixes vector-im/element-web#19146 and vector-im/element-web#19146.
 * Add customisation point for visibility of invites and room creation ([\#6922](https://github.com/matrix-org/matrix-react-sdk/pull/6922)). Fixes vector-im/element-web#19331 and vector-im/element-web#19331.
 * Inhibit `Unable to get validated threepid` error during UIA ([\#6928](https://github.com/matrix-org/matrix-react-sdk/pull/6928)). Fixes vector-im/element-web#18883 and vector-im/element-web#18883.
 * Tweak room list skeleton UI height and behaviour ([\#6926](https://github.com/matrix-org/matrix-react-sdk/pull/6926)). Fixes vector-im/element-web#18231 vector-im/element-web#16581 and vector-im/element-web#18231.
 * If public room creation fails, retry without publishing it ([\#6872](https://github.com/matrix-org/matrix-react-sdk/pull/6872)). Fixes vector-im/element-web#19194 and vector-im/element-web#19194. Contributed by [AndrewFerr](https://github.com/AndrewFerr).
 * Iterate invite your teammates to Space view ([\#6925](https://github.com/matrix-org/matrix-react-sdk/pull/6925)). Fixes vector-im/element-web#18772 and vector-im/element-web#18772.
 * Make placeholder more grey when no input ([\#6840](https://github.com/matrix-org/matrix-react-sdk/pull/6840)). Fixes vector-im/element-web#17243 and vector-im/element-web#17243. Contributed by [wlach](https://github.com/wlach).
 * Respect tombstones in locally known rooms for Space children ([\#6906](https://github.com/matrix-org/matrix-react-sdk/pull/6906)). Fixes vector-im/element-web#19246 vector-im/element-web#19256 and vector-im/element-web#19246.
 * Improve emoji shortcodes generated from annotations ([\#6907](https://github.com/matrix-org/matrix-react-sdk/pull/6907)). Fixes vector-im/element-web#19304 and vector-im/element-web#19304.
 * Hide kick & ban options in UserInfo when looking at own profile ([\#6911](https://github.com/matrix-org/matrix-react-sdk/pull/6911)). Fixes vector-im/element-web#19066 and vector-im/element-web#19066.
 * Add progress bar to Community to Space migration tool ([\#6887](https://github.com/matrix-org/matrix-react-sdk/pull/6887)). Fixes vector-im/element-web#19216 and vector-im/element-web#19216.

## 🐛 Bug Fixes
 * Fix leave space cancel button exploding ([\#6966](https://github.com/matrix-org/matrix-react-sdk/pull/6966)).
 * Fix edge case behaviour of the space join spinner for guests ([\#6972](https://github.com/matrix-org/matrix-react-sdk/pull/6972)). Fixes vector-im/element-web#19359 and vector-im/element-web#19359.
 * Convert emoticon to emoji at the end of a line on send even if the cursor isn't there ([\#6965](https://github.com/matrix-org/matrix-react-sdk/pull/6965)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix text overflows button on Home page ([\#6898](https://github.com/matrix-org/matrix-react-sdk/pull/6898)). Fixes vector-im/element-web#19180 and vector-im/element-web#19180. Contributed by [oliver-pham](https://github.com/oliver-pham).
 * Space Room View should react to join rule changes down /sync ([\#6945](https://github.com/matrix-org/matrix-react-sdk/pull/6945)). Fixes vector-im/element-web#19390 and vector-im/element-web#19390.
 * Hide leave section button if user isn't in the room e.g peeking ([\#6920](https://github.com/matrix-org/matrix-react-sdk/pull/6920)). Fixes vector-im/element-web#17410 and vector-im/element-web#17410.
 * Fix bug where room list would get stuck showing no rooms ([\#6939](https://github.com/matrix-org/matrix-react-sdk/pull/6939)). Fixes vector-im/element-web#19373 and vector-im/element-web#19373.
 * Update room settings dialog title when room name changes ([\#6916](https://github.com/matrix-org/matrix-react-sdk/pull/6916)). Fixes vector-im/element-web#17480 and vector-im/element-web#17480. Contributed by [psrpinto](https://github.com/psrpinto).
 * Fix editing losing emote-ness and rainbow-ness of messages ([\#6931](https://github.com/matrix-org/matrix-react-sdk/pull/6931)). Fixes vector-im/element-web#19350 and vector-im/element-web#19350.
 * Remove semicolon from notifications panel ([\#6930](https://github.com/matrix-org/matrix-react-sdk/pull/6930)). Contributed by [robintown](https://github.com/robintown).
 * Prevent profile image in left panel's backdrop from being selected ([\#6924](https://github.com/matrix-org/matrix-react-sdk/pull/6924)). Contributed by [rom4nik](https://github.com/rom4nik).
 * Validate that the phone number verification field is filled before allowing user to submit ([\#6918](https://github.com/matrix-org/matrix-react-sdk/pull/6918)). Fixes vector-im/element-web#19316 and vector-im/element-web#19316. Contributed by [VFermat](https://github.com/VFermat).
 * Updated how save button becomes disabled in room settings to listen for all fields instead of the most recent ([\#6917](https://github.com/matrix-org/matrix-react-sdk/pull/6917)). Contributed by [LoganArnett](https://github.com/LoganArnett).
 * Use FocusLock around ContextMenus to simplify focus management ([\#6311](https://github.com/matrix-org/matrix-react-sdk/pull/6311)). Fixes vector-im/element-web#19259 and vector-im/element-web#19259.
 * Fix space hierarchy pagination ([\#6908](https://github.com/matrix-org/matrix-react-sdk/pull/6908)). Fixes vector-im/element-web#19276 and vector-im/element-web#19276.
 * Fix spaces keyboard shortcuts not working for last space ([\#6909](https://github.com/matrix-org/matrix-react-sdk/pull/6909)). Fixes vector-im/element-web#19255 and vector-im/element-web#19255.
 * Use fallback avatar only for DMs with 2 people. ([\#6895](https://github.com/matrix-org/matrix-react-sdk/pull/6895)). Fixes vector-im/element-web#18747 and vector-im/element-web#18747. Contributed by [andybalaam](https://github.com/andybalaam).

Changes in [1.9.2](https://github.com/vector-im/element-desktop/releases/tag/v1.9.2) (2021-10-12)
=================================================================================================

## 🐛 Bug Fixes
 * Upgrade to matrix-js-sdk#14.0.1

Changes in [1.9.1](https://github.com/vector-im/element-desktop/releases/tag/v1.9.1) (2021-10-11)
=================================================================================================

## ✨ Features
 * Decrease profile button touch target ([\#6900](https://github.com/matrix-org/matrix-react-sdk/pull/6900)). Contributed by [ColonisationCaptain](https://github.com/ColonisationCaptain).
 * Don't let click events propagate out of context menus ([\#6892](https://github.com/matrix-org/matrix-react-sdk/pull/6892)).
 * Allow closing Dropdown via its chevron ([\#6885](https://github.com/matrix-org/matrix-react-sdk/pull/6885)). Fixes vector-im/element-web#19030 and vector-im/element-web#19030.
 * Improve AUX panel behaviour ([\#6699](https://github.com/matrix-org/matrix-react-sdk/pull/6699)). Fixes vector-im/element-web#18787 and vector-im/element-web#18787. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * A nicer opening animation for the Image View ([\#6454](https://github.com/matrix-org/matrix-react-sdk/pull/6454)). Fixes vector-im/element-web#18186 and vector-im/element-web#18186. Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * [Release] Fix space hierarchy pagination ([\#6910](https://github.com/matrix-org/matrix-react-sdk/pull/6910)).
 * Fix leaving space via other client leaving you in undefined-land ([\#6891](https://github.com/matrix-org/matrix-react-sdk/pull/6891)). Fixes vector-im/element-web#18455 and vector-im/element-web#18455.
 * Handle newer voice message encrypted event format for chat export ([\#6893](https://github.com/matrix-org/matrix-react-sdk/pull/6893)). Contributed by [jaiwanth-v](https://github.com/jaiwanth-v).
 * Fix pagination when filtering space hierarchy ([\#6876](https://github.com/matrix-org/matrix-react-sdk/pull/6876)). Fixes vector-im/element-web#19235 and vector-im/element-web#19235.
 * Fix spaces null-guard breaking the dispatcher settings watching ([\#6886](https://github.com/matrix-org/matrix-react-sdk/pull/6886)). Fixes vector-im/element-web#19223 and vector-im/element-web#19223.
 * Fix space children without specific `order` being sorted after those with one ([\#6878](https://github.com/matrix-org/matrix-react-sdk/pull/6878)). Fixes vector-im/element-web#19192 and vector-im/element-web#19192.
 * Ensure that sub-spaces aren't considered for notification badges ([\#6881](https://github.com/matrix-org/matrix-react-sdk/pull/6881)). Fixes vector-im/element-web#18975 and vector-im/element-web#18975.
 * Fix timeline autoscroll with non-standard DPI settings. ([\#6880](https://github.com/matrix-org/matrix-react-sdk/pull/6880)). Fixes vector-im/element-web#18984 and vector-im/element-web#18984.
 * Pluck out JoinRuleSettings styles so they apply in space settings too ([\#6879](https://github.com/matrix-org/matrix-react-sdk/pull/6879)). Fixes vector-im/element-web#19164 and vector-im/element-web#19164.
 * Null guard around the matrixClient in SpaceStore ([\#6874](https://github.com/matrix-org/matrix-react-sdk/pull/6874)).
 * Fix issue (https ([\#6871](https://github.com/matrix-org/matrix-react-sdk/pull/6871)). Fixes vector-im/element-web#19138 and vector-im/element-web#19138. Contributed by [psrpinto](https://github.com/psrpinto).
 * Fix pills being cut off in message bubble layout ([\#6865](https://github.com/matrix-org/matrix-react-sdk/pull/6865)). Fixes vector-im/element-web#18627 and vector-im/element-web#18627. Contributed by [robintown](https://github.com/robintown).
 * Fix space admin check false positive on multiple admins ([\#6824](https://github.com/matrix-org/matrix-react-sdk/pull/6824)).
 * Fix the User View ([\#6860](https://github.com/matrix-org/matrix-react-sdk/pull/6860)). Fixes vector-im/element-web#19158 and vector-im/element-web#19158.
 * Fix spacing for message composer buttons ([\#6852](https://github.com/matrix-org/matrix-react-sdk/pull/6852)). Fixes vector-im/element-web#18999 and vector-im/element-web#18999.
 * Always show root event of a thread in room's timeline ([\#6842](https://github.com/matrix-org/matrix-react-sdk/pull/6842)). Fixes vector-im/element-web#19016 and vector-im/element-web#19016.

Changes in [1.9.0](https://github.com/vector-im/element-desktop/releases/tag/v1.9.0) (2021-09-27)
=================================================================================================

## ✨ Features
 * Fix space keyboard shortcuts conflicting with native zoom shortcuts ([\#19037](https://github.com/vector-im/element-web/pull/19037)). Fixes vector-im/element-web#18481 and undefined/element-web#18481.
 * Say Joining space instead of Joining room where we know its a space ([\#6818](https://github.com/matrix-org/matrix-react-sdk/pull/6818)). Fixes vector-im/element-web#19064 and vector-im/element-web#19064.
 * Add warning that some spaces may not be relinked to the newly upgraded room ([\#6805](https://github.com/matrix-org/matrix-react-sdk/pull/6805)). Fixes vector-im/element-web#18858 and vector-im/element-web#18858.
 * Delabs Spaces, iterate some copy and move communities/space toggle to preferences ([\#6594](https://github.com/matrix-org/matrix-react-sdk/pull/6594)). Fixes vector-im/element-web#18088, vector-im/element-web#18524 vector-im/element-web#18088 and vector-im/element-web#18088.
 * Show "Message" in the user info panel instead of "Start chat" ([\#6319](https://github.com/matrix-org/matrix-react-sdk/pull/6319)). Fixes vector-im/element-web#17877 and vector-im/element-web#17877. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix space keyboard shortcuts conflicting with native zoom shortcuts ([\#6804](https://github.com/matrix-org/matrix-react-sdk/pull/6804)).
 * Replace plain text emoji at the end of a line ([\#6784](https://github.com/matrix-org/matrix-react-sdk/pull/6784)). Fixes vector-im/element-web#18833 and vector-im/element-web#18833. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Simplify Space Panel layout and fix some edge cases ([\#6800](https://github.com/matrix-org/matrix-react-sdk/pull/6800)). Fixes vector-im/element-web#18694 and vector-im/element-web#18694.
 * Show unsent message warning on Space Panel buttons ([\#6778](https://github.com/matrix-org/matrix-react-sdk/pull/6778)). Fixes vector-im/element-web#18891 and vector-im/element-web#18891.
 * Hide mute/unmute button in UserInfo for Spaces as it makes no sense ([\#6790](https://github.com/matrix-org/matrix-react-sdk/pull/6790)). Fixes vector-im/element-web#19007 and vector-im/element-web#19007.
 * Fix automatic field population in space create menu not validating ([\#6792](https://github.com/matrix-org/matrix-react-sdk/pull/6792)). Fixes vector-im/element-web#19005 and vector-im/element-web#19005.
 * Optimize input label transition on focus ([\#6783](https://github.com/matrix-org/matrix-react-sdk/pull/6783)). Fixes vector-im/element-web#12876 and vector-im/element-web#12876. Contributed by [MadLittleMods](https://github.com/MadLittleMods).
 * Adapt and re-use the RolesRoomSettingsTab for Spaces ([\#6779](https://github.com/matrix-org/matrix-react-sdk/pull/6779)). Fixes vector-im/element-web#18908 vector-im/element-web#18909 and vector-im/element-web#18908.
 * Deduplicate join rule management between rooms and spaces ([\#6724](https://github.com/matrix-org/matrix-react-sdk/pull/6724)). Fixes vector-im/element-web#18798 and vector-im/element-web#18798.
 * Add config option to turn on in-room event sending timing metrics ([\#6766](https://github.com/matrix-org/matrix-react-sdk/pull/6766)).
 * Improve the upgrade for restricted user experience ([\#6764](https://github.com/matrix-org/matrix-react-sdk/pull/6764)). Fixes vector-im/element-web#18677 and vector-im/element-web#18677.
 * Improve tooltips on space quick actions and explore button ([\#6760](https://github.com/matrix-org/matrix-react-sdk/pull/6760)). Fixes vector-im/element-web#18528 and vector-im/element-web#18528.
 * Make space members and user info behave more expectedly ([\#6765](https://github.com/matrix-org/matrix-react-sdk/pull/6765)). Fixes vector-im/element-web#17018 and vector-im/element-web#17018.
 * hide no-op m.room.encryption events and better word param changes ([\#6747](https://github.com/matrix-org/matrix-react-sdk/pull/6747)). Fixes vector-im/element-web#18597 and vector-im/element-web#18597.
 * Respect m.space.parent relations if they hold valid permissions ([\#6746](https://github.com/matrix-org/matrix-react-sdk/pull/6746)). Fixes vector-im/element-web#10935 and vector-im/element-web#10935.
 * Space panel accessibility improvements ([\#6744](https://github.com/matrix-org/matrix-react-sdk/pull/6744)). Fixes vector-im/element-web#18892 and vector-im/element-web#18892.

## 🐛 Bug Fixes
 * Fix spacing for message composer buttons ([\#6854](https://github.com/matrix-org/matrix-react-sdk/pull/6854)).
 * Fix accessing field on oobData which may be undefined ([\#6830](https://github.com/matrix-org/matrix-react-sdk/pull/6830)). Fixes vector-im/element-web#19085 and vector-im/element-web#19085.
 * Fix reactions aria-label not being a string and thus being read as [Object object] ([\#6828](https://github.com/matrix-org/matrix-react-sdk/pull/6828)).
 * Fix missing null guard in space hierarchy pagination ([\#6821](https://github.com/matrix-org/matrix-react-sdk/pull/6821)). Fixes matrix-org/element-web-rageshakes#6299 and matrix-org/element-web-rageshakes#6299.
 * Fix checks to show prompt to start new chats ([\#6812](https://github.com/matrix-org/matrix-react-sdk/pull/6812)).
 * Fix room list scroll jumps ([\#6777](https://github.com/matrix-org/matrix-react-sdk/pull/6777)). Fixes vector-im/element-web#17460 vector-im/element-web#18440 and vector-im/element-web#17460. Contributed by [robintown](https://github.com/robintown).
 * Fix various message bubble alignment issues ([\#6785](https://github.com/matrix-org/matrix-react-sdk/pull/6785)). Fixes vector-im/element-web#18293, vector-im/element-web#18294 vector-im/element-web#18305 and vector-im/element-web#18293. Contributed by [robintown](https://github.com/robintown).
 * Make message bubble font size consistent ([\#6795](https://github.com/matrix-org/matrix-react-sdk/pull/6795)). Contributed by [robintown](https://github.com/robintown).
 * Fix edge cases around joining new room which does not belong to active space ([\#6797](https://github.com/matrix-org/matrix-react-sdk/pull/6797)). Fixes vector-im/element-web#19025 and vector-im/element-web#19025.
 * Fix edge case space issues around creation and initial view ([\#6798](https://github.com/matrix-org/matrix-react-sdk/pull/6798)). Fixes vector-im/element-web#19023 and vector-im/element-web#19023.
 * Stop spinner on space preview if the join fails ([\#6803](https://github.com/matrix-org/matrix-react-sdk/pull/6803)). Fixes vector-im/element-web#19034 and vector-im/element-web#19034.
 * Fix emoji picker and stickerpicker not appearing correctly when opened ([\#6793](https://github.com/matrix-org/matrix-react-sdk/pull/6793)). Fixes vector-im/element-web#19012 and vector-im/element-web#19012. Contributed by [Palid](https://github.com/Palid).
 * Fix autocomplete not having y-scroll ([\#6794](https://github.com/matrix-org/matrix-react-sdk/pull/6794)). Fixes vector-im/element-web#18997 and vector-im/element-web#18997. Contributed by [Palid](https://github.com/Palid).
 * Fix broken edge case with public space creation with no alias ([\#6791](https://github.com/matrix-org/matrix-react-sdk/pull/6791)). Fixes vector-im/element-web#19003 and vector-im/element-web#19003.
 * Redirect from /#/welcome to /#/home if already logged in ([\#6786](https://github.com/matrix-org/matrix-react-sdk/pull/6786)). Fixes vector-im/element-web#18990 and vector-im/element-web#18990. Contributed by [aaronraimist](https://github.com/aaronraimist).
 * Fix build issues from two conflicting PRs landing without merge conflict ([\#6780](https://github.com/matrix-org/matrix-react-sdk/pull/6780)).
 * Render guest settings only in public rooms/spaces ([\#6693](https://github.com/matrix-org/matrix-react-sdk/pull/6693)). Fixes vector-im/element-web#18776 and vector-im/element-web#18776. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix message bubble corners being wrong in the presence of hidden events ([\#6776](https://github.com/matrix-org/matrix-react-sdk/pull/6776)). Fixes vector-im/element-web#18124 and vector-im/element-web#18124. Contributed by [robintown](https://github.com/robintown).
 * Debounce read marker update on scroll ([\#6771](https://github.com/matrix-org/matrix-react-sdk/pull/6771)). Fixes vector-im/element-web#18961 and vector-im/element-web#18961.
 * Use cursor:pointer on space panel buttons ([\#6770](https://github.com/matrix-org/matrix-react-sdk/pull/6770)). Fixes vector-im/element-web#18951 and vector-im/element-web#18951.
 * Fix regressed tab view buttons in space update toast ([\#6761](https://github.com/matrix-org/matrix-react-sdk/pull/6761)). Fixes vector-im/element-web#18781 and vector-im/element-web#18781.

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

Changes in [1.8.4](https://github.com/vector-im/element-desktop/releases/tag/v1.8.4) (2021-09-13)
=================================================================================================

## 🔒 SECURITY FIXES
 * Fix a security issue with message key sharing. See https://matrix.org/blog/2021/09/13/vulnerability-disclosure-key-sharing
   for details.

Changes in [1.8.2](https://github.com/vector-im/element-desktop/releases/tag/v1.8.2) (2021-08-31)
=================================================================================================

## ✨ Features
 * Enable Pipewire support for Wayland screen-sharing ([\#256](https://github.com/vector-im/element-desktop/pull/256)). Fixes vector-im/element-web#18607 and vector-im/element-web#18607. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Documentation for sentry config ([\#18608](https://github.com/vector-im/element-web/pull/18608)). Contributed by [novocaine](https://github.com/novocaine).
 * [Release]Increase general app performance by optimizing layers ([\#6672](https://github.com/matrix-org/matrix-react-sdk/pull/6672)). Fixes vector-im/element-web#18730 and vector-im/element-web#18730. Contributed by [Palid](https://github.com/Palid).
 * Add a warning on E2EE rooms if you try to make them public ([\#5698](https://github.com/matrix-org/matrix-react-sdk/pull/5698)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Allow pagination of the space hierarchy and use new APIs ([\#6507](https://github.com/matrix-org/matrix-react-sdk/pull/6507)). Fixes vector-im/element-web#18089 and vector-im/element-web#18427.
 * Improve emoji in composer ([\#6650](https://github.com/matrix-org/matrix-react-sdk/pull/6650)). Fixes vector-im/element-web#18593 and vector-im/element-web#18593. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Allow playback of replied-to voice message ([\#6629](https://github.com/matrix-org/matrix-react-sdk/pull/6629)). Fixes vector-im/element-web#18599 and vector-im/element-web#18599. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Format autocomplete suggestions vertically ([\#6620](https://github.com/matrix-org/matrix-react-sdk/pull/6620)). Fixes vector-im/element-web#17574 and vector-im/element-web#17574. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Remember last `MemberList` search query per-room ([\#6640](https://github.com/matrix-org/matrix-react-sdk/pull/6640)). Fixes vector-im/element-web#18613 and vector-im/element-web#18613. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Sentry rageshakes ([\#6597](https://github.com/matrix-org/matrix-react-sdk/pull/6597)). Fixes vector-im/element-web#11111 and vector-im/element-web#11111. Contributed by [novocaine](https://github.com/novocaine).
 * Autocomplete has been updated to match modern accessibility standards. Navigate via up/down arrows rather than Tab. Enter or Tab to confirm a suggestion. This should be familiar to Slack & Discord users. You can now use Tab to navigate around the application and do more without touching your mouse. No more accidentally sending half of people's names because the completion didn't fire on Enter! ([\#5659](https://github.com/matrix-org/matrix-react-sdk/pull/5659)). Fixes vector-im/element-web#4872, vector-im/element-web#11071, vector-im/element-web#17171, vector-im/element-web#15646 vector-im/element-web#4872 and vector-im/element-web#4872.
 * Add new call tile states ([\#6610](https://github.com/matrix-org/matrix-react-sdk/pull/6610)). Fixes vector-im/element-web#18521 and vector-im/element-web#18521. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Left align call tiles ([\#6609](https://github.com/matrix-org/matrix-react-sdk/pull/6609)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Make loading encrypted images look snappier ([\#6590](https://github.com/matrix-org/matrix-react-sdk/pull/6590)). Fixes vector-im/element-web#17878 and vector-im/element-web#17862. Contributed by [Palid](https://github.com/Palid).
 * Offer a way to create a space based on existing community ([\#6543](https://github.com/matrix-org/matrix-react-sdk/pull/6543)). Fixes vector-im/element-web#18092.
 * Accessibility improvements in and around Spaces ([\#6569](https://github.com/matrix-org/matrix-react-sdk/pull/6569)). Fixes vector-im/element-web#18094 and vector-im/element-web#18094.

## 🐛 Bug Fixes
 * [Release] Fix commit edit history ([\#6690](https://github.com/matrix-org/matrix-react-sdk/pull/6690)). Fixes vector-im/element-web#18742 and vector-im/element-web#18742. Contributed by [Palid](https://github.com/Palid).
 * Fix images not rendering when sent from other clients. ([\#6661](https://github.com/matrix-org/matrix-react-sdk/pull/6661)). Fixes vector-im/element-web#18702 and vector-im/element-web#18702.
 * Fix autocomplete scrollbar and make the autocomplete a little smaller ([\#6655](https://github.com/matrix-org/matrix-react-sdk/pull/6655)). Fixes vector-im/element-web#18682 and vector-im/element-web#18682. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix replies on the bubble layout ([\#6451](https://github.com/matrix-org/matrix-react-sdk/pull/6451)). Fixes vector-im/element-web#18184. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Show "Enable encryption in settings" only when the user can do that ([\#6646](https://github.com/matrix-org/matrix-react-sdk/pull/6646)). Fixes vector-im/element-web#18646 and vector-im/element-web#18646. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix cross signing setup from settings screen ([\#6633](https://github.com/matrix-org/matrix-react-sdk/pull/6633)). Fixes vector-im/element-web#17761 and vector-im/element-web#17761.
 * Fix call tiles on the bubble layout ([\#6647](https://github.com/matrix-org/matrix-react-sdk/pull/6647)). Fixes vector-im/element-web#18648 and vector-im/element-web#18648. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix error on accessing encrypted media without encryption keys ([\#6625](https://github.com/matrix-org/matrix-react-sdk/pull/6625)). Contributed by [Palid](https://github.com/Palid).
 * Fix jitsi widget sometimes being permanently stuck in the bottom-right corner ([\#6632](https://github.com/matrix-org/matrix-react-sdk/pull/6632)). Fixes vector-im/element-web#17226 and vector-im/element-web#17226. Contributed by [Palid](https://github.com/Palid).
 * Fix FilePanel pagination in E2EE rooms ([\#6630](https://github.com/matrix-org/matrix-react-sdk/pull/6630)). Fixes vector-im/element-web#18415 and vector-im/element-web#18415. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix call tile buttons ([\#6624](https://github.com/matrix-org/matrix-react-sdk/pull/6624)). Fixes vector-im/element-web#18565 and vector-im/element-web#18565. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix vertical call tile spacing issues ([\#6621](https://github.com/matrix-org/matrix-react-sdk/pull/6621)). Fixes vector-im/element-web#18558 and vector-im/element-web#18558. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix long display names in call tiles ([\#6618](https://github.com/matrix-org/matrix-react-sdk/pull/6618)). Fixes vector-im/element-web#18562 and vector-im/element-web#18562. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Avoid access token overflow ([\#6616](https://github.com/matrix-org/matrix-react-sdk/pull/6616)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Properly handle media errors  ([\#6615](https://github.com/matrix-org/matrix-react-sdk/pull/6615)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix glare related regressions ([\#6614](https://github.com/matrix-org/matrix-react-sdk/pull/6614)). Fixes vector-im/element-web#18538 and vector-im/element-web#18538. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix long display names in call toasts ([\#6617](https://github.com/matrix-org/matrix-react-sdk/pull/6617)). Fixes vector-im/element-web#18557 and vector-im/element-web#18557. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix PiP of held calls ([\#6611](https://github.com/matrix-org/matrix-react-sdk/pull/6611)). Fixes vector-im/element-web#18539 and vector-im/element-web#18539. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix call tile behaviour on narrow layouts ([\#6556](https://github.com/matrix-org/matrix-react-sdk/pull/6556)). Fixes vector-im/element-web#18398. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix video call persisting when widget removed ([\#6608](https://github.com/matrix-org/matrix-react-sdk/pull/6608)). Fixes vector-im/element-web#15703 and vector-im/element-web#15703.
 * Fix toast colors ([\#6606](https://github.com/matrix-org/matrix-react-sdk/pull/6606)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Remove tiny scrollbar dot from code blocks ([\#6596](https://github.com/matrix-org/matrix-react-sdk/pull/6596)). Fixes vector-im/element-web#18474. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve handling of pills in the composer ([\#6353](https://github.com/matrix-org/matrix-react-sdk/pull/6353)). Fixes vector-im/element-web#10134 vector-im/element-web#10896 and vector-im/element-web#15037. Contributed by [SimonBrandner](https://github.com/SimonBrandner).

Changes in [1.8.1](https://github.com/vector-im/element-desktop/releases/tag/v1.8.1) (2021-08-17)
=================================================================================================

## 🐛 Bug Fixes
 * Fix multiple VoIP regressions ([matrix-org/matrix-js-sdk#1860](https://github.com/matrix-org/matrix-js-sdk/pull/1860)).

Changes in [1.8.0](https://github.com/vector-im/element-desktop/releases/tag/v1.8.0) (2021-08-16)
=================================================================================================

## ✨ Features
 * Show how long a call was on call tiles ([\#6570](https://github.com/matrix-org/matrix-react-sdk/pull/6570)). Fixes vector-im/element-web#18405. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Add regional indicators to emoji picker ([\#6490](https://github.com/matrix-org/matrix-react-sdk/pull/6490)). Fixes vector-im/element-web#14963. Contributed by [robintown](https://github.com/robintown).
 * Make call control buttons accessible to screen reader users ([\#6181](https://github.com/matrix-org/matrix-react-sdk/pull/6181)). Fixes vector-im/element-web#18358. Contributed by [pvagner](https://github.com/pvagner).
 * Skip sending a thumbnail if it is not a sufficient saving over the original ([\#6559](https://github.com/matrix-org/matrix-react-sdk/pull/6559)). Fixes vector-im/element-web#17906.
 * Increase PiP snapping speed ([\#6539](https://github.com/matrix-org/matrix-react-sdk/pull/6539)). Fixes vector-im/element-web#18371. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve and move the incoming call toast ([\#6470](https://github.com/matrix-org/matrix-react-sdk/pull/6470)). Fixes vector-im/element-web#17912. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Allow all of the URL schemes that Firefox allows ([\#6457](https://github.com/matrix-org/matrix-react-sdk/pull/6457)). Contributed by [aaronraimist](https://github.com/aaronraimist).
 * Improve bubble layout colors ([\#6452](https://github.com/matrix-org/matrix-react-sdk/pull/6452)). Fixes vector-im/element-web#18081. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Spaces let users switch between Home and All Rooms behaviours ([\#6497](https://github.com/matrix-org/matrix-react-sdk/pull/6497)). Fixes vector-im/element-web#18093.
 * Support for MSC2285 (hidden read receipts) ([\#6390](https://github.com/matrix-org/matrix-react-sdk/pull/6390)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Group pinned message events with MELS ([\#6349](https://github.com/matrix-org/matrix-react-sdk/pull/6349)). Fixes vector-im/element-web#17938. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Make version copiable ([\#6227](https://github.com/matrix-org/matrix-react-sdk/pull/6227)). Fixes vector-im/element-web#17603 and vector-im/element-web#18329. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve voice messages uploading state ([\#6530](https://github.com/matrix-org/matrix-react-sdk/pull/6530)). Fixes vector-im/element-web#18226 and vector-im/element-web#18224.
 * Add surround with feature ([\#5510](https://github.com/matrix-org/matrix-react-sdk/pull/5510)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Improve call event tile wording ([\#6545](https://github.com/matrix-org/matrix-react-sdk/pull/6545)). Fixes vector-im/element-web#18376. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Show an avatar/a turned off microphone icon for muted users ([\#6486](https://github.com/matrix-org/matrix-react-sdk/pull/6486)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Prompt user to leave rooms/subspaces in a space when leaving space ([\#6424](https://github.com/matrix-org/matrix-react-sdk/pull/6424)). Fixes vector-im/element-web#18071.
 * Add customisation point to override widget variables ([\#6455](https://github.com/matrix-org/matrix-react-sdk/pull/6455)). Fixes vector-im/element-web#18035.
 * Add support for screen sharing in 1:1 calls ([\#5992](https://github.com/matrix-org/matrix-react-sdk/pull/5992)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).

## 🐛 Bug Fixes
 * Dismiss electron download toast when clicking Open ([\#18267](https://github.com/vector-im/element-web/pull/18267)). Fixes vector-im/element-web#18266.
 * [Release] Fix glare related regressions ([\#6622](https://github.com/matrix-org/matrix-react-sdk/pull/6622)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * [Release] Fix PiP of held calls ([\#6612](https://github.com/matrix-org/matrix-react-sdk/pull/6612)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * [Release] Fix toast colors ([\#6607](https://github.com/matrix-org/matrix-react-sdk/pull/6607)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix [object Object] in Widget Permissions ([\#6560](https://github.com/matrix-org/matrix-react-sdk/pull/6560)). Fixes vector-im/element-web#18384. Contributed by [Palid](https://github.com/Palid).
 * Fix right margin for events on IRC layout ([\#6542](https://github.com/matrix-org/matrix-react-sdk/pull/6542)). Fixes vector-im/element-web#18354.
 * Mirror only usermedia feeds ([\#6512](https://github.com/matrix-org/matrix-react-sdk/pull/6512)). Fixes vector-im/element-web#5633. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix LogoutDialog warning + TypeScript migration ([\#6533](https://github.com/matrix-org/matrix-react-sdk/pull/6533)).
 * Fix the wrong font being used in the room topic field ([\#6527](https://github.com/matrix-org/matrix-react-sdk/pull/6527)). Fixes vector-im/element-web#18339. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix inconsistent styling for links on hover ([\#6513](https://github.com/matrix-org/matrix-react-sdk/pull/6513)). Contributed by [janogarcia](https://github.com/janogarcia).
 * Fix incorrect height for encoded placeholder images ([\#6514](https://github.com/matrix-org/matrix-react-sdk/pull/6514)). Contributed by [Palid](https://github.com/Palid).
 * Fix call events layout for message bubble ([\#6465](https://github.com/matrix-org/matrix-react-sdk/pull/6465)). Fixes vector-im/element-web#18144.
 * Improve subspaces and some utilities around room/space creation ([\#6458](https://github.com/matrix-org/matrix-react-sdk/pull/6458)). Fixes vector-im/element-web#18090 vector-im/element-web#18091 and vector-im/element-web#17256.
 * Restore pointer cursor for SenderProfile in message bubbles ([\#6501](https://github.com/matrix-org/matrix-react-sdk/pull/6501)). Fixes vector-im/element-web#18249.
 * Fix issues with the Call View ([\#6472](https://github.com/matrix-org/matrix-react-sdk/pull/6472)). Fixes vector-im/element-web#18221. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Align event list summary read receipts when using message bubbles ([\#6500](https://github.com/matrix-org/matrix-react-sdk/pull/6500)). Fixes vector-im/element-web#18143.
 * Better positioning for unbubbled events in timeline ([\#6477](https://github.com/matrix-org/matrix-react-sdk/pull/6477)). Fixes vector-im/element-web#18132.
 * Realign reactions row with messages in modern layout ([\#6491](https://github.com/matrix-org/matrix-react-sdk/pull/6491)). Fixes vector-im/element-web#18118. Contributed by [robintown](https://github.com/robintown).
 * Fix CreateRoomDialog exploding when making public room outside of a space ([\#6492](https://github.com/matrix-org/matrix-react-sdk/pull/6492)). Fixes vector-im/element-web#18275.
 * Fix call crashing because `element` was undefined ([\#6488](https://github.com/matrix-org/matrix-react-sdk/pull/6488)). Fixes vector-im/element-web#18270. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Upscale thumbnails to the container size ([\#6589](https://github.com/matrix-org/matrix-react-sdk/pull/6589)). Fixes vector-im/element-web#18307.
 * Fix create room dialog in spaces no longer adding to the space ([\#6587](https://github.com/matrix-org/matrix-react-sdk/pull/6587)). Fixes vector-im/element-web#18465.
 * Don't show a modal on call reject/user hangup ([\#6580](https://github.com/matrix-org/matrix-react-sdk/pull/6580)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fade Call View Buttons after `componentDidMount` ([\#6581](https://github.com/matrix-org/matrix-react-sdk/pull/6581)). Fixes vector-im/element-web#18439. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix missing expand button on codeblocks ([\#6565](https://github.com/matrix-org/matrix-react-sdk/pull/6565)). Fixes vector-im/element-web#18388. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * allow customizing the bubble layout colors ([\#6568](https://github.com/matrix-org/matrix-react-sdk/pull/6568)). Fixes vector-im/element-web#18408. Contributed by [benneti](https://github.com/benneti).
 * Don't flash "Missed call" when accepting a call ([\#6567](https://github.com/matrix-org/matrix-react-sdk/pull/6567)). Fixes vector-im/element-web#18404. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix clicking whitespaces on replies ([\#6571](https://github.com/matrix-org/matrix-react-sdk/pull/6571)). Fixes vector-im/element-web#18327. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix disabled state for voice messages + send button tooltip ([\#6562](https://github.com/matrix-org/matrix-react-sdk/pull/6562)). Fixes vector-im/element-web#18413.
 * Fix voice feed being cut-off ([\#6550](https://github.com/matrix-org/matrix-react-sdk/pull/6550)). Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix sizing issues of the screen picker ([\#6498](https://github.com/matrix-org/matrix-react-sdk/pull/6498)). Fixes vector-im/element-web#18281. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Stop voice messages that are playing when starting a recording ([\#6563](https://github.com/matrix-org/matrix-react-sdk/pull/6563)). Fixes vector-im/element-web#18410.
 * Properly set style attribute on shared usercontent iframe ([\#6561](https://github.com/matrix-org/matrix-react-sdk/pull/6561)). Fixes vector-im/element-web#18414.
 * Null guard space inviter to prevent the app exploding ([\#6558](https://github.com/matrix-org/matrix-react-sdk/pull/6558)).
 * Make the ringing sound mutable/disablable ([\#6534](https://github.com/matrix-org/matrix-react-sdk/pull/6534)). Fixes vector-im/element-web#15591. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix wrong cursor being used in PiP ([\#6551](https://github.com/matrix-org/matrix-react-sdk/pull/6551)). Fixes vector-im/element-web#18383. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Re-pin Jitsi if the widget already exists ([\#6226](https://github.com/matrix-org/matrix-react-sdk/pull/6226)). Fixes vector-im/element-web#17679. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix broken call notification regression ([\#6526](https://github.com/matrix-org/matrix-react-sdk/pull/6526)). Fixes vector-im/element-web#18335. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * createRoom, only send join rule event if we have a join rule to put in it ([\#6516](https://github.com/matrix-org/matrix-react-sdk/pull/6516)). Fixes vector-im/element-web#18301.
 * Fix clicking pills inside replies ([\#6508](https://github.com/matrix-org/matrix-react-sdk/pull/6508)). Fixes vector-im/element-web#18283. Contributed by [SimonBrandner](https://github.com/SimonBrandner).
 * Fix grecaptcha regression ([\#6503](https://github.com/matrix-org/matrix-react-sdk/pull/6503)). Fixes vector-im/element-web#18284. Contributed by [Palid](https://github.com/Palid).

Changes in [1.7.34](https://github.com/vector-im/element-desktop/releases/tag/v1.7.34) (2021-08-02)
===================================================================================================

## 🔒 SECURITY FIXES
 * Sanitize untrusted variables from message previews before translation
   Fixes vector-im/element-web#18314

## ✨ Features
 * Fix editing of `<sub>` & `<sup`> & `<u>`
   [\#6469](https://github.com/matrix-org/matrix-react-sdk/pull/6469)
   Fixes vector-im/element-web#18211
 * Zoom images in lightbox to where the cursor points
   [\#6418](https://github.com/matrix-org/matrix-react-sdk/pull/6418)
   Fixes vector-im/element-web#17870
 * Avoid hitting the settings store from TextForEvent
   [\#6205](https://github.com/matrix-org/matrix-react-sdk/pull/6205)
   Fixes vector-im/element-web#17650
 * Initial MSC3083 + MSC3244 support
   [\#6212](https://github.com/matrix-org/matrix-react-sdk/pull/6212)
   Fixes vector-im/element-web#17686 and vector-im/element-web#17661
 * Navigate to the first room with notifications when clicked on space notification dot
   [\#5974](https://github.com/matrix-org/matrix-react-sdk/pull/5974)
 * Add matrix: to the list of permitted URL schemes
   [\#6388](https://github.com/matrix-org/matrix-react-sdk/pull/6388)
 * Add "Copy Link" to room context menu
   [\#6374](https://github.com/matrix-org/matrix-react-sdk/pull/6374)
 * 💭 Message bubble layout
   [\#6291](https://github.com/matrix-org/matrix-react-sdk/pull/6291)
   Fixes vector-im/element-web#4635, vector-im/element-web#17773 vector-im/element-web#16220 and vector-im/element-web#7687
 * Play only one audio file at a time
   [\#6417](https://github.com/matrix-org/matrix-react-sdk/pull/6417)
   Fixes vector-im/element-web#17439
 * Move download button for media to the action bar
   [\#6386](https://github.com/matrix-org/matrix-react-sdk/pull/6386)
   Fixes vector-im/element-web#17943
 * Improved display of one-to-one call history with summary boxes for each call
   [\#6121](https://github.com/matrix-org/matrix-react-sdk/pull/6121)
   Fixes vector-im/element-web#16409
 * Notification settings UI refresh
   [\#6352](https://github.com/matrix-org/matrix-react-sdk/pull/6352)
   Fixes vector-im/element-web#17782
 * Fix EventIndex double handling events and erroring
   [\#6385](https://github.com/matrix-org/matrix-react-sdk/pull/6385)
   Fixes vector-im/element-web#18008
 * Improve reply rendering
   [\#3553](https://github.com/matrix-org/matrix-react-sdk/pull/3553)
   Fixes vector-im/riot-web#9217, vector-im/riot-web#7633, vector-im/riot-web#7530, vector-im/riot-web#7169, vector-im/riot-web#7151, vector-im/riot-web#6692 vector-im/riot-web#6579 and vector-im/element-web#17440

## 🐛 Bug Fixes
 * Fix browser history getting stuck looping back to the same room
   [\#18053](https://github.com/vector-im/element-web/pull/18053)
 * Fix space shortcuts on layouts with non-English keys in the places of numbers
   [\#17780](https://github.com/vector-im/element-web/pull/17780)
   Fixes vector-im/element-web#17776
 * Fix CreateRoomDialog exploding when making public room outside of a space
   [\#6493](https://github.com/matrix-org/matrix-react-sdk/pull/6493)
 * Fix regression where registration would soft-crash on captcha
   [\#6505](https://github.com/matrix-org/matrix-react-sdk/pull/6505)
   Fixes vector-im/element-web#18284
 * only send join rule event if we have a join rule to put in it
   [\#6517](https://github.com/matrix-org/matrix-react-sdk/pull/6517)
 * Improve the new download button's discoverability and interactions.
   [\#6510](https://github.com/matrix-org/matrix-react-sdk/pull/6510)
 * Fix voice recording UI looking broken while microphone permissions are being requested.
   [\#6479](https://github.com/matrix-org/matrix-react-sdk/pull/6479)
   Fixes vector-im/element-web#18223
 * Match colors of room and user avatars in DMs
   [\#6393](https://github.com/matrix-org/matrix-react-sdk/pull/6393)
   Fixes vector-im/element-web#2449
 * Fix onPaste handler to work with copying files from Finder
   [\#5389](https://github.com/matrix-org/matrix-react-sdk/pull/5389)
   Fixes vector-im/element-web#15536 and vector-im/element-web#16255
 * Fix infinite pagination loop when offline
   [\#6478](https://github.com/matrix-org/matrix-react-sdk/pull/6478)
   Fixes vector-im/element-web#18242
 * Fix blurhash rounded corners missing regression
   [\#6467](https://github.com/matrix-org/matrix-react-sdk/pull/6467)
   Fixes vector-im/element-web#18110
 * Fix position of the space hierarchy spinner
   [\#6462](https://github.com/matrix-org/matrix-react-sdk/pull/6462)
   Fixes vector-im/element-web#18182
 * Fix display of image messages that lack thumbnails
   [\#6456](https://github.com/matrix-org/matrix-react-sdk/pull/6456)
   Fixes vector-im/element-web#18175
 * Fix crash with large audio files.
   [\#6436](https://github.com/matrix-org/matrix-react-sdk/pull/6436)
   Fixes vector-im/element-web#18149
 * Make diff colors in codeblocks more pleasant
   [\#6355](https://github.com/matrix-org/matrix-react-sdk/pull/6355)
   Fixes vector-im/element-web#17939
 * Show the correct audio file duration while loading the file.
   [\#6435](https://github.com/matrix-org/matrix-react-sdk/pull/6435)
   Fixes vector-im/element-web#18160
 * Fix various timeline settings not applying immediately.
   [\#6261](https://github.com/matrix-org/matrix-react-sdk/pull/6261)
   Fixes vector-im/element-web#17748
 * Fix issues with room list duplication
   [\#6391](https://github.com/matrix-org/matrix-react-sdk/pull/6391)
   Fixes vector-im/element-web#14508
 * Fix grecaptcha throwing useless error sometimes
   [\#6401](https://github.com/matrix-org/matrix-react-sdk/pull/6401)
   Fixes vector-im/element-web#15142
 * Update Emojibase and Twemoji and switch to IamCal (Slack-style) shortcodes
   [\#6347](https://github.com/matrix-org/matrix-react-sdk/pull/6347)
   Fixes vector-im/element-web#13857 and vector-im/element-web#13334
 * Respect compound emojis in default avatar initial generation
   [\#6397](https://github.com/matrix-org/matrix-react-sdk/pull/6397)
   Fixes vector-im/element-web#18040
 * Fix bug where the 'other homeserver' field in the server selection dialog would become briefly focus and then unfocus when clicked.
   [\#6394](https://github.com/matrix-org/matrix-react-sdk/pull/6394)
   Fixes vector-im/element-web#18031
 * Standardise spelling and casing of homeserver, identity server, and integration manager 
   [\#6365](https://github.com/matrix-org/matrix-react-sdk/pull/6365)
 * Fix widgets not receiving decrypted events when they have permission.
   [\#6371](https://github.com/matrix-org/matrix-react-sdk/pull/6371)
   Fixes vector-im/element-web#17615
 * Prevent client hangs when calculating blurhashes
   [\#6366](https://github.com/matrix-org/matrix-react-sdk/pull/6366)
   Fixes vector-im/element-web#17945
 * Exclude state events from widgets reading room events
   [\#6378](https://github.com/matrix-org/matrix-react-sdk/pull/6378)
 * Cache feature_spaces\* flags to improve performance
   [\#6381](https://github.com/matrix-org/matrix-react-sdk/pull/6381)

Changes in [1.7.33](https://github.com/vector-im/element-desktop/releases/tag/v1.7.33) (2021-07-19)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.32...v1.7.33)

 * Translations update from Weblate
   [\#232](https://github.com/vector-im/element-desktop/pull/232)
 * Add VS Code to gitignore
   [\#231](https://github.com/vector-im/element-desktop/pull/231)
 * Use the target-specific build dir for sqlcipher / openssl
   [\#230](https://github.com/vector-im/element-desktop/pull/230)
 * Fix not specifying a target
   [\#229](https://github.com/vector-im/element-desktop/pull/229)
 * Do not generate a lockfile when running in CI
   [\#227](https://github.com/vector-im/element-desktop/pull/227)
 * Use double quotes in readme
   [\#228](https://github.com/vector-im/element-desktop/pull/228)
 * Support universal builds
   [\#226](https://github.com/vector-im/element-desktop/pull/226)
 * Check target with rustc directly
   [\#225](https://github.com/vector-im/element-desktop/pull/225)

Changes in [1.7.32](https://github.com/vector-im/element-desktop/releases/tag/v1.7.32) (2021-07-05)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.31...v1.7.32)

 * Fix the build: make the rootDir correct
   [\#224](https://github.com/vector-im/element-desktop/pull/224)
 * Fix i18n in Element Desktop
   [\#223](https://github.com/vector-im/element-desktop/pull/223)
 * Convert preload.js to Typescript so that it gets copied to `lib`
   [\#222](https://github.com/vector-im/element-desktop/pull/222)
 * Bundle the `lib` dir now, not `src`
   [\#221](https://github.com/vector-im/element-desktop/pull/221)
 * Initial Typescripting for Element Desktop
   [\#219](https://github.com/vector-im/element-desktop/pull/219)
 * Translations update from Weblate
   [\#220](https://github.com/vector-im/element-desktop/pull/220)
 * Fix Windows target arch in native build
   [\#218](https://github.com/vector-im/element-desktop/pull/218)
 * Add libera.chat to default room directory
   [\#217](https://github.com/vector-im/element-desktop/pull/217)
 * Add update and native build support for Apple silicon
   [\#216](https://github.com/vector-im/element-desktop/pull/216)
 * Add numpad accelerators for zooming
   [\#203](https://github.com/vector-im/element-desktop/pull/203)
 * Add warning dialog when custom config.json is invalid
   [\#201](https://github.com/vector-im/element-desktop/pull/201)
 * Don't show Quit warning on keyUp residual event
   [\#215](https://github.com/vector-im/element-desktop/pull/215)
 * Fix accelerator for save-image-as clashing with copy-link-address
   [\#213](https://github.com/vector-im/element-desktop/pull/213)

Changes in [1.7.31](https://github.com/vector-im/element-desktop/releases/tag/v1.7.31) (2021-06-21)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.31-rc.1...v1.7.31)

 * No changes since rc.1

Changes in [1.7.31-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.31-rc.1) (2021-06-15)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.30...v1.7.31-rc.1)

 * Upgrade to Electron 12.0.11
   [\#211](https://github.com/vector-im/element-desktop/pull/211)
 * Translations update from Weblate
   [\#214](https://github.com/vector-im/element-desktop/pull/214)
 * Upgrade to Node 14
   [\#212](https://github.com/vector-im/element-desktop/pull/212)
 * Bump npm-registry-fetch from 4.0.2 to 4.0.7
   [\#210](https://github.com/vector-im/element-desktop/pull/210)
 * Update electron-builder for Node 16 compatibility
   [\#204](https://github.com/vector-im/element-desktop/pull/204)
 * Bump hosted-git-info from 2.8.5 to 2.8.9
   [\#209](https://github.com/vector-im/element-desktop/pull/209)
 * Bump glob-parent from 5.1.1 to 5.1.2
   [\#206](https://github.com/vector-im/element-desktop/pull/206)
 * Bump dot-prop from 4.2.0 to 4.2.1
   [\#208](https://github.com/vector-im/element-desktop/pull/208)
 * Bump y18n from 3.2.1 to 3.2.2
   [\#207](https://github.com/vector-im/element-desktop/pull/207)
 * Bump normalize-url from 4.5.0 to 4.5.1
   [\#205](https://github.com/vector-im/element-desktop/pull/205)
 * Put Preferences menu item in correct location on macOS
   [\#200](https://github.com/vector-im/element-desktop/pull/200)
 * Switch zoomIn accelerator to default
   [\#202](https://github.com/vector-im/element-desktop/pull/202)

Changes in [1.7.30](https://github.com/vector-im/element-desktop/releases/tag/v1.7.30) (2021-06-07)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.30-rc.1...v1.7.30)

 * No changes since rc.1

Changes in [1.7.30-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.30-rc.1) (2021-06-01)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.29...v1.7.30-rc.1)

 * Translations update from Weblate
   [\#199](https://github.com/vector-im/element-desktop/pull/199)
 * Migrate to `eslint-plugin-matrix-org`
   [\#197](https://github.com/vector-im/element-desktop/pull/197)
 * Upgrade to Electron 12.0.9
   [\#198](https://github.com/vector-im/element-desktop/pull/198)

Changes in [1.7.29](https://github.com/vector-im/element-desktop/releases/tag/v1.7.29) (2021-05-24)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.29-rc.1...v1.7.29)

 * No changes since rc.1

Changes in [1.7.29-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.29-rc.1) (2021-05-19)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.28...v1.7.29-rc.1)

 * Translations update from Weblate
   [\#196](https://github.com/vector-im/element-desktop/pull/196)
 * Translations update from Weblate
   [\#195](https://github.com/vector-im/element-desktop/pull/195)

Changes in [1.7.28](https://github.com/vector-im/element-desktop/releases/tag/v1.7.28) (2021-05-17)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.28-rc.1...v1.7.28)

 * No changes since rc.1

Changes in [1.7.28-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.28-rc.1) (2021-05-11)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.27...v1.7.28-rc.1)

 * Add Windows native module requirements
   [\#190](https://github.com/vector-im/element-desktop/pull/190)
 * Prevent black screen when closing window while in full screen mode on macOS
   [\#192](https://github.com/vector-im/element-desktop/pull/192)

Changes in [1.7.27](https://github.com/vector-im/element-desktop/releases/tag/v1.7.27) (2021-05-10)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.27-rc.1...v1.7.27)

 * No changes since rc.1

Changes in [1.7.27-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.27-rc.1) (2021-05-04)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.26...v1.7.27-rc.1)

 * Translations update from Weblate
   [\#191](https://github.com/vector-im/element-desktop/pull/191)
 * Bump ssri from 6.0.1 to 6.0.2
   [\#187](https://github.com/vector-im/element-desktop/pull/187)
 * Disables HardwareMediaKeyHandling
   [\#180](https://github.com/vector-im/element-desktop/pull/180)
 * Translations update from Weblate
   [\#189](https://github.com/vector-im/element-desktop/pull/189)
 * Add internationalisation support
   [\#188](https://github.com/vector-im/element-desktop/pull/188)
 * Fix event index passphrase change process
   [\#186](https://github.com/vector-im/element-desktop/pull/186)

Changes in [1.7.26](https://github.com/vector-im/element-desktop/releases/tag/v1.7.26) (2021-04-26)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.26-rc.1...v1.7.26)

 * No changes since rc.1

Changes in [1.7.26-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.26-rc.1) (2021-04-21)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.25...v1.7.26-rc.1)

 * Remove Debian dependency libappindicator3-1
   [\#170](https://github.com/vector-im/element-desktop/pull/170)
 * Fix exit shortcuts for non QWERTY keyboards
   [\#185](https://github.com/vector-im/element-desktop/pull/185)
 * Fix using yarn run fetch with a specific version
   [\#182](https://github.com/vector-im/element-desktop/pull/182)
 * Switch nightly to not-staging Scalar by default
   [\#181](https://github.com/vector-im/element-desktop/pull/181)

Changes in [1.7.25](https://github.com/vector-im/element-desktop/releases/tag/v1.7.25) (2021-04-12)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.25-rc.1...v1.7.25)

 * No changes since rc.1

Changes in [1.7.25-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.25-rc.1) (2021-04-07)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.24...v1.7.25-rc.1)

 * Fix disabling spellchecker
   [\#179](https://github.com/vector-im/element-desktop/pull/179)
 * Upgrade to Electron 12.0.2
   [\#178](https://github.com/vector-im/element-desktop/pull/178)
 * Avoid exit listener to hijack other application shortcuts
   [\#177](https://github.com/vector-im/element-desktop/pull/177)
 * Migrate native-node-modules docs to element-desktop
   [\#176](https://github.com/vector-im/element-desktop/pull/176)
 * Add prompt to warn before quitting the application
   [\#173](https://github.com/vector-im/element-desktop/pull/173)
 * Upgrade to Electron 11.4.1
   [\#172](https://github.com/vector-im/element-desktop/pull/172)
 * Fix docker:build:native documentation typo
   [\#174](https://github.com/vector-im/element-desktop/pull/174)

Changes in [1.7.24](https://github.com/vector-im/element-desktop/releases/tag/v1.7.24) (2021-03-29)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.24-rc.1...v1.7.24)

 * No changes since rc.1

Changes in [1.7.24-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.24-rc.1) (2021-03-25)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.23...v1.7.24-rc.1)

 * No changes since 1.7.23

Changes in [1.7.23](https://github.com/vector-im/element-desktop/releases/tag/v1.7.23) (2021-03-15)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.23-rc.1...v1.7.23)

 * No changes since rc.1

Changes in [1.7.23-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.23-rc.1) (2021-03-11)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.22...v1.7.23-rc.1)

 * Fix disabling spell-checker
   [\#171](https://github.com/vector-im/element-desktop/pull/171)
 * Add multi language spell check
   [\#154](https://github.com/vector-im/element-desktop/pull/154)

Changes in [1.7.22](https://github.com/vector-im/element-desktop/releases/tag/v1.7.22) (2021-03-01)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.22-rc.1...v1.7.22)

 * No changes since rc.1

Changes in [1.7.22-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.22-rc.1) (2021-02-24)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.21...v1.7.22-rc.1)

 * Disable Countly
   [\#169](https://github.com/vector-im/element-desktop/pull/169)
 * Upgrade to Electron 11.2.3
   [\#168](https://github.com/vector-im/element-desktop/pull/168)

Changes in [1.7.21](https://github.com/vector-im/element-desktop/releases/tag/v1.7.21) (2021-02-16)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.21-rc.1...v1.7.21)

 * No changes since rc.1

Changes in [1.7.21-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.21-rc.1) (2021-02-10)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.20...v1.7.21-rc.1)

 * Fix desktop Matrix screen sharing
   [\#161](https://github.com/vector-im/element-desktop/pull/161)

Changes in [1.7.20](https://github.com/vector-im/element-desktop/releases/tag/v1.7.20) (2021-02-04)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.19...v1.7.20)

 * No changes since 1.7.19

Changes in [1.7.19](https://github.com/vector-im/element-desktop/releases/tag/v1.7.19) (2021-02-03)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.19-rc.1...v1.7.19)

 * No changes since rc.1

Changes in [1.7.19-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.19-rc.1) (2021-01-29)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.18...v1.7.19-rc.1)

 * Remove Buildkite pipeline file
   [\#167](https://github.com/vector-im/element-desktop/pull/167)
 * Upgrade deps 2021-01-18
   [\#166](https://github.com/vector-im/element-desktop/pull/166)
 * package: Bump our seshat version
   [\#164](https://github.com/vector-im/element-desktop/pull/164)
 * Enable context isolation, bridge expected IPC
   [\#163](https://github.com/vector-im/element-desktop/pull/163)

Changes in [1.7.18](https://github.com/vector-im/element-desktop/releases/tag/v1.7.18) (2021-01-26)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.17...v1.7.18)

 * No changes since 1.7.17

Changes in [1.7.17](https://github.com/vector-im/element-desktop/releases/tag/v1.7.17) (2021-01-18)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.17-rc.1...v1.7.17)

 * [Release] package: Bump our seshat version
   [\#165](https://github.com/vector-im/element-desktop/pull/165)

Changes in [1.7.17-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.17-rc.1) (2021-01-13)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.16...v1.7.17-rc.1)

 * package: Bump our Seshat version
   [\#162](https://github.com/vector-im/element-desktop/pull/162)
 * Upgrade to Electron 10.2.0
   [\#159](https://github.com/vector-im/element-desktop/pull/159)

Changes in [1.7.16](https://github.com/vector-im/element-desktop/releases/tag/v1.7.16) (2020-12-21)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.16-rc.1...v1.7.16)

 * No changes since rc.1

Changes in [1.7.16-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.16-rc.1) (2020-12-16)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.15...v1.7.16-rc.1)

 * Bump ini from 1.3.5 to 1.3.8
   [\#158](https://github.com/vector-im/element-desktop/pull/158)
 * Add gitter.im to room directory
   [\#157](https://github.com/vector-im/element-desktop/pull/157)

Changes in [1.7.15](https://github.com/vector-im/element-desktop/releases/tag/v1.7.15) (2020-12-07)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.15-rc.1...v1.7.15)

 * No changes since rc.1

Changes in [1.7.15-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.15-rc.1) (2020-12-02)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.14...v1.7.15-rc.1)

 * No changes since 1.7.14

Changes in [1.7.14](https://github.com/vector-im/element-desktop/releases/tag/v1.7.14) (2020-11-23)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.14-rc.1...v1.7.14)

 * No changes since rc.1

Changes in [1.7.14-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.14-rc.1) (2020-11-18)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.13...v1.7.14-rc.1)

 * Correct spelling mistakes
   [\#151](https://github.com/vector-im/element-desktop/pull/151)

Changes in [1.7.13](https://github.com/vector-im/element-desktop/releases/tag/v1.7.13) (2020-11-09)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.13-rc.1...v1.7.13)

 * No changes since rc.1

Changes in [1.7.13-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.13-rc.1) (2020-11-04)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.12...v1.7.13-rc.1)

 * Add countly experiment to develop/nightly configs
   [\#150](https://github.com/vector-im/element-desktop/pull/150)

Changes in [1.7.12](https://github.com/vector-im/element-desktop/releases/tag/v1.7.12) (2020-10-28)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.11...v1.7.12)

 * No changes since 1.7.11

Changes in [1.7.11](https://github.com/vector-im/element-desktop/releases/tag/v1.7.11) (2020-10-26)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.11-rc.1...v1.7.11)

 * No changes since rc.1

Changes in [1.7.11-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.11-rc.1) (2020-10-21)
=============================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.10...v1.7.11-rc.1)

 * Bump npm-user-validate from 1.0.0 to 1.0.1
   [\#148](https://github.com/vector-im/element-desktop/pull/148)
 * Use keytar for the seshat passphrase.
   [\#147](https://github.com/vector-im/element-desktop/pull/147)
 * Upgrade to Electron 10.1.3
   [\#146](https://github.com/vector-im/element-desktop/pull/146)

Changes in [1.7.10](https://github.com/vector-im/element-desktop/releases/tag/v1.7.10) (2020-10-20)
===================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.9...v1.7.10)

 * No changes since 1.7.9

Changes in [1.7.9](https://github.com/vector-im/element-desktop/releases/tag/v1.7.9) (2020-10-12)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.9-rc.1...v1.7.9)

 * No changes since rc.1

Changes in [1.7.9-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.9-rc.1) (2020-10-07)
===========================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.8...v1.7.9-rc.1)

 * package.json: Bump the seshat version.
   [\#145](https://github.com/vector-im/element-desktop/pull/145)
 * Explicitly depend on `request` as webcontents-handler requires it
   [\#144](https://github.com/vector-im/element-desktop/pull/144)
 * Upgrade png-to-ico
   [\#143](https://github.com/vector-im/element-desktop/pull/143)
 * Point 'new issue' link at issue-type choice page
   [\#142](https://github.com/vector-im/element-desktop/pull/142)

Changes in [1.7.8](https://github.com/vector-im/element-desktop/releases/tag/v1.7.8) (2020-09-28)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.8-rc.1...v1.7.8)

 * No changes since rc.1

Changes in [1.7.8-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.8-rc.1) (2020-09-23)
===========================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.7...v1.7.8-rc.1)

 * Fix neon error by upgrading Seshat
   [\#141](https://github.com/vector-im/element-desktop/pull/141)
 * Upgrade to Electron 10.1.1
   [\#140](https://github.com/vector-im/element-desktop/pull/140)

Changes in [1.7.7](https://github.com/vector-im/element-desktop/releases/tag/v1.7.7) (2020-09-14)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.6...v1.7.7)

 * No changes since 1.7.6

Changes in [1.7.6](https://github.com/vector-im/element-desktop/releases/tag/v1.7.6) (2020-09-14)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.6-rc.1...v1.7.6)

 * No changes since rc.1

Changes in [1.7.6-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.6-rc.1) (2020-09-09)
===========================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.5...v1.7.6-rc.1)

 * Update to Element pipeline name
   [\#139](https://github.com/vector-im/element-desktop/pull/139)
 * Bump bl from 4.0.2 to 4.0.3
   [\#137](https://github.com/vector-im/element-desktop/pull/137)

Changes in [1.7.5](https://github.com/vector-im/element-desktop/releases/tag/v1.7.5) (2020-09-01)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.5-rc.1...v1.7.5)

 * No changes since 1.7.5-rc.1

Changes in [1.7.5-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.5-rc.1) (2020-08-26)
===========================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.4...v1.7.5-rc.1)

 * Settings v3: Update configs for new feature flag behaviour
   [\#135](https://github.com/vector-im/element-desktop/pull/135)
 * Add reaction preview labs flags to nightly
   [\#134](https://github.com/vector-im/element-desktop/pull/134)

Changes in [1.7.4](https://github.com/vector-im/element-desktop/releases/tag/v1.7.4) (2020-08-17)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.4-rc.1...v1.7.4)

 * No changes since 1.7.4-rc.1

Changes in [1.7.4-rc.1](https://github.com/vector-im/element-desktop/releases/tag/v1.7.4-rc.1) (2020-08-13)
===========================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.3...v1.7.4-rc.1)

 * Update policy links to element.io
   [\#132](https://github.com/vector-im/element-desktop/pull/132)
 * Update bug report submission URL
   [\#131](https://github.com/vector-im/element-desktop/pull/131)
 * Update code signing cert for Windows
   [\#130](https://github.com/vector-im/element-desktop/pull/130)
 * Replace Riot with Element in docs and comments
   [\#129](https://github.com/vector-im/element-desktop/pull/129)
 * Fix order of README steps
   [\#128](https://github.com/vector-im/element-desktop/pull/128)
 * Upgrade to Electron 9.1.2
   [\#127](https://github.com/vector-im/element-desktop/pull/127)

Changes in [1.7.3](https://github.com/vector-im/element-desktop/releases/tag/v1.7.3) (2020-08-05)
=================================================================================================
[Full Changelog](https://github.com/vector-im/element-desktop/compare/v1.7.3-rc.1...v1.7.3)

 * No changes since 1.7.3-rc.1

Changes in [1.7.3-rc.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.7.3-rc.1) (2020-07-31)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.7.2...v1.7.3-rc.1)

 * Clean up linting
   [\#126](https://github.com/vector-im/riot-desktop/pull/126)
 * Update renaming workaround for 'Element' name
   [\#125](https://github.com/vector-im/riot-desktop/pull/125)

Changes in [1.7.2](https://github.com/vector-im/riot-desktop/releases/tag/v1.7.2) (2020-07-27)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.7.1...v1.7.2)

 * Catch exceptions from main method in fetch script
   [\#124](https://github.com/vector-im/riot-desktop/pull/124)
 * Use new eslint package
   [\#122](https://github.com/vector-im/riot-desktop/pull/122)
 * Remove ' (Riot)' from app name
   [\#123](https://github.com/vector-im/riot-desktop/pull/123)

Changes in [1.7.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.7.1) (2020-07-16)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.7.0...v1.7.1)

 * Bump lodash from 4.17.15 to 4.17.19
   [\#121](https://github.com/vector-im/riot-desktop/pull/121)
 * Don't forget nightly when computing userData path
   [\#120](https://github.com/vector-im/riot-desktop/pull/120)
 * Fix hosting link
   [\#119](https://github.com/vector-im/riot-desktop/pull/119)
 * New macOS icon
   [\#117](https://github.com/vector-im/riot-desktop/pull/117)
 * Update README.md
   [\#118](https://github.com/vector-im/riot-desktop/pull/118)
 * More icon updates
   [\#115](https://github.com/vector-im/riot-desktop/pull/115)
 * Don't forget to yarn install
   [\#114](https://github.com/vector-im/riot-desktop/pull/114)

Changes in [1.7.0](https://github.com/vector-im/riot-desktop/releases/tag/v1.7.0) (2020-07-15)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.8...v1.7.0)

 * Fix lint error
   [\#113](https://github.com/vector-im/riot-desktop/pull/113)
 * Delabs font-scaling
   [\#112](https://github.com/vector-im/riot-desktop/pull/112)
 * Remove room list labs flag from config
   [\#109](https://github.com/vector-im/riot-desktop/pull/109)
 * Remove the irc layout setting from labs
   [\#111](https://github.com/vector-im/riot-desktop/pull/111)
 * Update npm to ^6.14.6
   [\#108](https://github.com/vector-im/riot-desktop/pull/108)

Changes in [1.6.8](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.8) (2020-07-03)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.8-rc.1...v1.6.8)

 * No changes since rc.1

Changes in [1.6.8-rc.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.8-rc.1) (2020-07-01)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.7...v1.6.8-rc.1)

 * Show expiring toast on completed downloads to prompt user to open
   [\#106](https://github.com/vector-im/riot-desktop/pull/106)
 * Upgrade to Electron 9.0.5
   [\#107](https://github.com/vector-im/riot-desktop/pull/107)
 * Add new spinner labs option to config.json
   [\#105](https://github.com/vector-im/riot-desktop/pull/105)
 * electron-main: Skip the reindex if we're going to delete the db anyways.
   [\#104](https://github.com/vector-im/riot-desktop/pull/104)
 * riot-desktop: Bump the required seshat version.
   [\#103](https://github.com/vector-im/riot-desktop/pull/103)
 * main: Add an event index IPC method to check if a room is being indexed.
   [\#100](https://github.com/vector-im/riot-desktop/pull/100)
 * electron-main: Add support to set and get the user version.
   [\#102](https://github.com/vector-im/riot-desktop/pull/102)
 * Upgrade to Electron 9
   [\#94](https://github.com/vector-im/riot-desktop/pull/94)

Changes in [1.6.7](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.7) (2020-06-29)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.6...v1.6.7)

 * No changes since 1.6.6

Changes in [1.6.6](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.6) (2020-06-23)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.6-rc.1...v1.6.6)

 * No changes since rc.1

Changes in [1.6.6-rc.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.6-rc.1) (2020-06-17)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.5...v1.6.6-rc.1)

 * Upgrade needle to avoid bugs with modern Node
   [\#101](https://github.com/vector-im/riot-desktop/pull/101)
 * Fix riot-desktop manual update check getting stuck on Downloading...
   [\#99](https://github.com/vector-im/riot-desktop/pull/99)
 * Electron recall latest downloaded update for when the user manually asks
   [\#98](https://github.com/vector-im/riot-desktop/pull/98)
 * use keytar to store pickle keys
   [\#95](https://github.com/vector-im/riot-desktop/pull/95)

Changes in [1.6.5](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.5) (2020-06-16)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.4...v1.6.5)

 * No changes since 1.6.4

Changes in [1.6.4](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.4) (2020-06-05)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.3...v1.6.4)

 * No changes since 1.6.3

Changes in [1.6.3](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.3) (2020-06-04)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.3-rc.1...v1.6.3)

 * No changes since rc.1

Changes in [1.6.3-rc.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.3-rc.1) (2020-06-02)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.2...v1.6.3-rc.1)

 * Fix electron context menu copy/save-as
   [\#96](https://github.com/vector-im/riot-desktop/pull/96)
 * Fixed error in README.md/User-specified config.json
   [\#97](https://github.com/vector-im/riot-desktop/pull/97)
 * Update Modular hosting link
   [\#92](https://github.com/vector-im/riot-desktop/pull/92)
 * Enforce sandbox on all spawned BrowserWindow objects
   [\#91](https://github.com/vector-im/riot-desktop/pull/91)
 * Run before-quit on updates too to flush rageshake
   [\#93](https://github.com/vector-im/riot-desktop/pull/93)
 * Enable new room list labs flag
   [\#87](https://github.com/vector-im/riot-desktop/pull/87)
 * Add asar-webapp script
   [\#59](https://github.com/vector-im/riot-desktop/pull/59)
 * Bump acorn from 6.4.0 to 6.4.1
   [\#50](https://github.com/vector-im/riot-desktop/pull/50)
 * Enable font scaling flag for nightly
   [\#89](https://github.com/vector-im/riot-desktop/pull/89)
 * Enable IRC UI labs flag in nightly
   [\#88](https://github.com/vector-im/riot-desktop/pull/88)
 * Update help message to fix broken url to electron docs
   [\#86](https://github.com/vector-im/riot-desktop/pull/86)

Changes in [1.6.2](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.2) (2020-05-22)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.1...v1.6.2)

 * No changes since 1.6.2

Changes in [1.6.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.1) (2020-05-19)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.1-rc.1...v1.6.1)

 * No changes since rc.1

Changes in [1.6.1-rc.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.1-rc.1) (2020-05-14)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0...v1.6.1-rc.1)

 * Add CI scripts to install and link JS SDK
   [\#85](https://github.com/vector-im/riot-desktop/pull/85)
 * Use Xenial as the build image's base distribution
   [\#84](https://github.com/vector-im/riot-desktop/pull/84)
 * Persist GPG keys for Linux builds via Docker
   [\#83](https://github.com/vector-im/riot-desktop/pull/83)
 * Update README to mention profile support
   [\#81](https://github.com/vector-im/riot-desktop/pull/81)
 * Remove Conflicts from riot-desktop
   [\#82](https://github.com/vector-im/riot-desktop/pull/82)
 * Add a default Linux distribution
   [\#79](https://github.com/vector-im/riot-desktop/pull/79)
 * Remove invite only padlocks feature flag config
   [\#77](https://github.com/vector-im/riot-desktop/pull/77)
 * package.json: Bump the Seshat dep.
   [\#75](https://github.com/vector-im/riot-desktop/pull/75)
 * Remove encrypted message search feature flag
   [\#74](https://github.com/vector-im/riot-desktop/pull/74)
 * Update readme now it's the real source
   [\#73](https://github.com/vector-im/riot-desktop/pull/73)

Changes in [1.6.0](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0) (2020-05-05)
==============================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0-rc.6...v1.6.0)

 * No changes since rc.6

Changes in [1.6.0-rc.6](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0-rc.6) (2020-05-01)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0-rc.5...v1.6.0-rc.6)

 * No changes since rc.5

Changes in [1.6.0-rc.5](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0-rc.5) (2020-04-30)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0-rc.4...v1.6.0-rc.5)

 * Remove feature flag docs from docs on release
   [\#78](https://github.com/vector-im/riot-desktop/pull/78)
 * package.json: Bump the Seshat dep.
   [\#76](https://github.com/vector-im/riot-desktop/pull/76)

Changes in [1.6.0-rc.4](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0-rc.4) (2020-04-23)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0-rc.3...v1.6.0-rc.4)

 * No changes since rc.3

Changes in [1.6.0-rc.3](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0-rc.3) (2020-04-17)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0-rc.2...v1.6.0-rc.3)

 * widen search paths / fix vector-im/riot-web#13190 [to release]
   [\#72](https://github.com/vector-im/riot-desktop/pull/72)

Changes in [1.6.0-rc.2](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0-rc.2) (2020-04-16)
========================================================================================================
[Full Changelog](https://github.com/vector-im/riot-desktop/compare/v1.6.0-rc.1...v1.6.0-rc.2)

 * No changes since rc.1

Changes in [1.6.0-rc.1](https://github.com/vector-im/riot-desktop/releases/tag/v1.6.0-rc.1) (2020-04-15)
========================================================================================================

 * Enable cross-signing / E2EE by default for DM on release
   [\#70](https://github.com/vector-im/riot-desktop/pull/70)
 * Add a release script
   [\#69](https://github.com/vector-im/riot-desktop/pull/69)
 * Fix Electron SSO handling to support multiple profiles
   [\#67](https://github.com/vector-im/riot-desktop/pull/67)
 * Add riot-desktop shortcuts for forward/back matching browsers&slack
   [\#68](https://github.com/vector-im/riot-desktop/pull/68)
 * package.json: Bump the Seshat version.
   [\#66](https://github.com/vector-im/riot-desktop/pull/66)
 * Bump minimist from 1.2.2 to 1.2.3
   [\#64](https://github.com/vector-im/riot-desktop/pull/64)
 * Add cfg to access the hak.json
   [\#65](https://github.com/vector-im/riot-desktop/pull/65)
 * Extract dep versions out to hak.json
   [\#63](https://github.com/vector-im/riot-desktop/pull/63)
 * Make the openssl version a variable
   [\#62](https://github.com/vector-im/riot-desktop/pull/62)
 * Update openssl
   [\#61](https://github.com/vector-im/riot-desktop/pull/61)
 * Fix spellcheck language fallback algorithm
   [\#60](https://github.com/vector-im/riot-desktop/pull/60)
 * package.json: Bump the required Seshat version.
   [\#57](https://github.com/vector-im/riot-desktop/pull/57)
 * Remove welcome user from config
   [\#56](https://github.com/vector-im/riot-desktop/pull/56)
 * electron-main: Immediately set the eventIndex variable to null when
   closing.
   [\#55](https://github.com/vector-im/riot-desktop/pull/55)
 * Enable Seshat on Nightly
   [\#54](https://github.com/vector-im/riot-desktop/pull/54)
 * Register Mac electron specific Cmd+, shortcut to User Settings
   [\#53](https://github.com/vector-im/riot-desktop/pull/53)
 * Bump minimist from 1.2.0 to 1.2.2
   [\#52](https://github.com/vector-im/riot-desktop/pull/52)
 * package.json: Bump the required Seshat version.
   [\#51](https://github.com/vector-im/riot-desktop/pull/51)
 * Updates for Seshat 1.2.0 (not yet released) and support to delete events
   from the index.
   [\#47](https://github.com/vector-im/riot-desktop/pull/47)
 * Add custom themes labs flag
   [\#49](https://github.com/vector-im/riot-desktop/pull/49)
 * Get the app ID from the cintext
   [\#46](https://github.com/vector-im/riot-desktop/pull/46)
 * Electron 8 changes. Deprecations. Updates.
   [\#38](https://github.com/vector-im/riot-desktop/pull/38)
 * Bump seshat dependency
   [\#45](https://github.com/vector-im/riot-desktop/pull/45)
 * Move deb control logic to builder
   [\#44](https://github.com/vector-im/riot-desktop/pull/44)
 * Add 'nightly' to brand too
   [\#43](https://github.com/vector-im/riot-desktop/pull/43)
 * Enable seshat in labs on nightly
   [\#42](https://github.com/vector-im/riot-desktop/pull/42)
 * Add config for Riot Nightly
   [\#41](https://github.com/vector-im/riot-desktop/pull/41)
 * Add a windows signing script
   [\#40](https://github.com/vector-im/riot-desktop/pull/40)
 * riot-desktop open SSO in browser so user doesn't have to auth twice
   [\#37](https://github.com/vector-im/riot-desktop/pull/37)
 * Remove the certificate config for windows
   [\#39](https://github.com/vector-im/riot-desktop/pull/39)
 * Missed an await
   [\#36](https://github.com/vector-im/riot-desktop/pull/36)
 * Exit with exit code on exception
   [\#35](https://github.com/vector-im/riot-desktop/pull/35)
 * Fix the set-version script
   [\#34](https://github.com/vector-im/riot-desktop/pull/34)
 * Pass through the env var we actually use to docker
   [\#33](https://github.com/vector-im/riot-desktop/pull/33)
 * Upgrade to electron 8.0.1 and implement spellchecking
   [\#30](https://github.com/vector-im/riot-desktop/pull/30)
 * Fix check script
   [\#31](https://github.com/vector-im/riot-desktop/pull/31)
 * Support fetching the latest develop build
   [\#29](https://github.com/vector-im/riot-desktop/pull/29)
 * Hopefully enable subpixel font rendering
   [\#28](https://github.com/vector-im/riot-desktop/pull/28)
 * Add our native modules separately into the files
   [\#27](https://github.com/vector-im/riot-desktop/pull/27)
 * Fix setversion script's yarn call on windows
   [\#26](https://github.com/vector-im/riot-desktop/pull/26)
 * Split 32/64 bit building
   [\#25](https://github.com/vector-im/riot-desktop/pull/25)
 * Build on 32 bit Windows
   [\#23](https://github.com/vector-im/riot-desktop/pull/23)
 * Build seshat on Linux
   [\#22](https://github.com/vector-im/riot-desktop/pull/22)
 * Native module builds: matrix-seshat for mac & win
   [\#21](https://github.com/vector-im/riot-desktop/pull/21)
 * Port desktop fixes
   [\#20](https://github.com/vector-im/riot-desktop/pull/20)
 * Add accelerators to context menu options like cut&paste in electron
   [\#19](https://github.com/vector-im/riot-desktop/pull/19)
 * Build the deb into a repo
   [\#18](https://github.com/vector-im/riot-desktop/pull/18)
 * Better Docker Support
   [\#17](https://github.com/vector-im/riot-desktop/pull/17)
 * Use a custom control file for the Debian package
   [\#14](https://github.com/vector-im/riot-desktop/pull/14)
 * Support config directories
   [\#15](https://github.com/vector-im/riot-desktop/pull/15)
 * Don't bail if we can't notarise
   [\#16](https://github.com/vector-im/riot-desktop/pull/16)
 * Set version automatically
   [\#13](https://github.com/vector-im/riot-desktop/pull/13)
 * Sign natively on Windows
   [\#12](https://github.com/vector-im/riot-desktop/pull/12)
 * Fix the linting errors
   [\#11](https://github.com/vector-im/riot-desktop/pull/11)
 * Electron API Updates
   [\#10](https://github.com/vector-im/riot-desktop/pull/10)
 * Package webapp into an asar archive
   [\#9](https://github.com/vector-im/riot-desktop/pull/9)
 * Sanitise scripts
   [\#8](https://github.com/vector-im/riot-desktop/pull/8)
 * Exit after importing key
   [\#6](https://github.com/vector-im/riot-desktop/pull/6)
 * Use portable mkdirp
   [\#5](https://github.com/vector-im/riot-desktop/pull/5)
 * Add explicit 'node' to scripts
   [\#4](https://github.com/vector-im/riot-desktop/pull/4)
 * Check properly
   [\#3](https://github.com/vector-im/riot-desktop/pull/3)
 * Add rimraf
   [\#2](https://github.com/vector-im/riot-desktop/pull/2)
 * Build electron app from pre-built tarball
   [\#1](https://github.com/vector-im/riot-desktop/pull/1)


