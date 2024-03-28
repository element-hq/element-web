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
