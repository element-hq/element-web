Changes in [1.11.86](https://github.com/element-hq/element-web/releases/tag/v1.11.86) (2024-11-19)
==================================================================================================
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


Changes in [1.11.85](https://github.com/element-hq/element-web/releases/tag/v1.11.85) (2024-11-12)
==================================================================================================
# Security
- Fixes for [CVE-2024-51750](https://www.cve.org/CVERecord?id=CVE-2024-51750) / [GHSA-w36j-v56h-q9pc](https://github.com/element-hq/element-web/security/advisories/GHSA-w36j-v56h-q9pc)
- Fixes for [CVE-2024-51749](https://www.cve.org/CVERecord?id=CVE-2024-51749) / [GHSA-5486-384g-mcx2](https://github.com/element-hq/element-web/security/advisories/GHSA-5486-384g-mcx2)
- Update JS SDK with the fixes for [CVE-2024-50336](https://www.cve.org/CVERecord?id=CVE-2024-50336) / [GHSA-xvg8-m4x3-w6xr](https://github.com/matrix-org/matrix-js-sdk/security/advisories/GHSA-xvg8-m4x3-w6xr)


Changes in [1.11.84](https://github.com/element-hq/element-web/releases/tag/v1.11.84) (2024-11-05)
==================================================================================================
## ✨ Features

* Remove abandoned MSC3886, MSC3903, MSC3906 implementations ([#28274](https://github.com/element-hq/element-web/pull/28274)). Contributed by @t3chguy.
* Update to React 18 ([#24763](https://github.com/element-hq/element-web/pull/24763)). Contributed by @t3chguy.
* Deduplicate icons using Compound ([#28239](https://github.com/element-hq/element-web/pull/28239)). Contributed by @t3chguy.
* Replace legacy Tooltips with Compound tooltips ([#28231](https://github.com/element-hq/element-web/pull/28231)). Contributed by @t3chguy.
* Deduplicate icons using Compound Design Tokens ([#28219](https://github.com/element-hq/element-web/pull/28219)). Contributed by @t3chguy.
* Add reactions to html export ([#28210](https://github.com/element-hq/element-web/pull/28210)). Contributed by @langleyd.
* Remove feature\_dehydration ([#28173](https://github.com/element-hq/element-web/pull/28173)). Contributed by @florianduros.

## 🐛 Bug Fixes

* Remove upgrade encryption in `DeviceListener` and `SetupEncryptionToast` ([#28299](https://github.com/element-hq/element-web/pull/28299)). Contributed by @florianduros.
* Fix 'remove alias' button in room settings ([#28269](https://github.com/element-hq/element-web/pull/28269)). Contributed by @Dev-Gurjar.
* Add back unencrypted path in `StopGapWidgetDriver.sendToDevice` ([#28295](https://github.com/element-hq/element-web/pull/28295)). Contributed by @florianduros.
* Fix other devices not being decorated as such ([#28279](https://github.com/element-hq/element-web/pull/28279)). Contributed by @t3chguy.
* Fix pill contrast in invitation dialog ([#28250](https://github.com/element-hq/element-web/pull/28250)). Contributed by @florianduros.
* Close right panel chat when minimising maximised voip widget ([#28241](https://github.com/element-hq/element-web/pull/28241)). Contributed by @t3chguy.
* Fix develop changelog parsing ([#28232](https://github.com/element-hq/element-web/pull/28232)). Contributed by @t3chguy.
* Fix Ctrl+F shortcut not working with minimised room summary card ([#28223](https://github.com/element-hq/element-web/pull/28223)). Contributed by @t3chguy.
* Fix network dropdown missing checkbox \& aria-checked ([#28220](https://github.com/element-hq/element-web/pull/28220)). Contributed by @t3chguy.


Changes in [1.11.83](https://github.com/element-hq/element-web/releases/tag/v1.11.83) (2024-10-29)
==================================================================================================
## ✨ Features

* Enable Element Call by default on release instances ([#28314](https://github.com/element-hq/element-web/pull/28314)). Contributed by @t3chguy.



Changes in [1.11.82](https://github.com/element-hq/element-web/releases/tag/v1.11.82) (2024-10-22)
==================================================================================================
## ✨ Features

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



Changes in [1.11.81](https://github.com/element-hq/element-web/releases/tag/v1.11.81) (2024-10-15)
==================================================================================================
This release fixes High severity vulnerability CVE-2024-47771 / GHSA-963w-49j9-gxj6

Changes in [1.11.80](https://github.com/element-hq/element-web/releases/tag/v1.11.80) (2024-10-08)
==================================================================================================
## ✨ Features

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



Changes in [1.11.79](https://github.com/element-hq/element-web/releases/tag/v1.11.79) (2024-10-01)
==================================================================================================
* No changes

## ✨ Features

* [Backport staging] Allow joining calls and video rooms without enabling the labs flags ([#106](https://github.com/element-hq/matrix-react-sdk/pull/106)). Contributed by @RiotRobot.



Changes in [1.11.78](https://github.com/element-hq/element-web/releases/tag/v1.11.78) (2024-09-24)
==================================================================================================
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


Changes in [1.11.77](https://github.com/element-hq/element-web/releases/tag/v1.11.77) (2024-09-10)
==================================================================================================
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



Changes in [1.11.76](https://github.com/element-hq/element-web/releases/tag/v1.11.76) (2024-08-27)
==================================================================================================
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


Changes in [1.11.75](https://github.com/element-hq/element-web/releases/tag/v1.11.75) (2024-08-20)
==================================================================================================
* No changes



Changes in [1.11.74](https://github.com/element-hq/element-web/releases/tag/v1.11.74) (2024-08-13)
==================================================================================================
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



Changes in [1.11.73](https://github.com/element-hq/element-web/releases/tag/v1.11.73) (2024-08-06)
==================================================================================================
Fixes for CVE-2024-42347 / GHSA-f83w-wqhc-cfp4



Changes in [1.11.72](https://github.com/element-hq/element-web/releases/tag/v1.11.72) (2024-07-30)
==================================================================================================
## ✨ Features

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

* Add a modernizr check for WebAssembly support ([#27776](https://github.com/element-hq/element-web/pull/27776)). Contributed by @dbkr.
* Test for lack of WebAssembly support ([#12792](https://github.com/matrix-org/matrix-react-sdk/pull/12792)). Contributed by @dbkr.
* Fix stray 'account' heading ([#12791](https://github.com/matrix-org/matrix-react-sdk/pull/12791)). Contributed by @dbkr.
* Add test for the unsupported browser screen ([#12787](https://github.com/matrix-org/matrix-react-sdk/pull/12787)). Contributed by @dbkr.
* Fix HTML export test ([#12778](https://github.com/matrix-org/matrix-react-sdk/pull/12778)). Contributed by @dbkr.
* Fix HTML export missing a bunch of Compound variables ([#12774](https://github.com/matrix-org/matrix-react-sdk/pull/12774)). Contributed by @t3chguy.
* Fix inability to change accent colour consistently in custom theming ([#12772](https://github.com/matrix-org/matrix-react-sdk/pull/12772)). Contributed by @t3chguy.
* Fix edge case of landing on 3pid email link with registration disabled ([#12771](https://github.com/matrix-org/matrix-react-sdk/pull/12771)). Contributed by @t3chguy.



Changes in [1.11.71](https://github.com/element-hq/element-web/releases/tag/v1.11.71) (2024-07-16)
==================================================================================================
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



Changes in [1.11.70](https://github.com/element-hq/element-web/releases/tag/v1.11.70) (2024-07-08)
==================================================================================================
## ✨ Features

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
