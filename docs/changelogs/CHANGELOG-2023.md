

Changes in [1.11.52](https://github.com/element-hq/element-web/releases/tag/v1.11.52) (2023-12-19)
==================================================================================================


## ✨ Features

* Keep more recent rageshake logs ([#12003](https://github.com/matrix-org/matrix-react-sdk/pull/12003)). Contributed by @richvdh.

## 🐛 Bug Fixes

* Fix bug which prevented correct clean up of rageshake store ([#12002](https://github.com/matrix-org/matrix-react-sdk/pull/12002)). Contributed by @richvdh.
* Set up key backup using non-deprecated APIs ([#12005](https://github.com/matrix-org/matrix-react-sdk/pull/12005)). Contributed by @andybalaam.
* Fix notifications appearing for old events ([#3946](https://github.com/matrix-org/matrix-js-sdk/pull/3946)). Contributed by @dbkr.
* Prevent phantom notifications from events not in a room's timeline ([#3942](https://github.com/matrix-org/matrix-js-sdk/pull/3942)). Contributed by @dbkr.


Changes in [1.11.51](https://github.com/vector-im/element-web/releases/tag/v1.11.51) (2023-12-05)
=================================================================================================
## ✨ Features

* Improve debian package and docs ([#26618](https://github.com/vector-im/element-web/pull/26618)). Contributed by @t3chguy.

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


Changes in [1.11.50](https://github.com/vector-im/element-web/releases/tag/v1.11.50) (2023-11-21)
=================================================================================================

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

Changes in [1.11.49](https://github.com/vector-im/element-web/releases/tag/v1.11.49) (2023-11-13)
=================================================================================================

## ✨ Features
 * Ship element-web as a debian package ([\#26533](https://github.com/vector-im/element-web/pull/26533)). Fixes #2777.

## 🐛 Bug Fixes
 * Ensure `setUserCreator` is called when a store is assigned ([\#3867](https://github.com/matrix-org/matrix-js-sdk/pull/3867)). Fixes vector-im/element-web#26520. Contributed by @MidhunSureshR.

Changes in [1.11.48](https://github.com/vector-im/element-web/releases/tag/v1.11.48) (2023-11-07)
=================================================================================================

## ✨ Features
 * Correctly fill window.matrixChat even when a Wrapper module is active ([\#26395](https://github.com/vector-im/element-web/pull/26395)). Contributed by @dhenneke.
 * Knock on a ask-to-join room if a module wants to join the room when navigating to a room ([\#11787](https://github.com/matrix-org/matrix-react-sdk/pull/11787)). Contributed by @dhenneke.
 * Element-R:  Include crypto info in sentry ([\#11798](https://github.com/matrix-org/matrix-react-sdk/pull/11798)). Contributed by @florianduros.
 * Element-R:  Include crypto info in rageshake ([\#11797](https://github.com/matrix-org/matrix-react-sdk/pull/11797)). Contributed by @florianduros.
 * Element-R: Add current version of the rust-sdk and vodozemac ([\#11785](https://github.com/matrix-org/matrix-react-sdk/pull/11785)). Contributed by @florianduros.
 * Fix unfederated invite dialog ([\#9618](https://github.com/matrix-org/matrix-react-sdk/pull/9618)). Fixes vector-im/element-meta#1466 and #22102. Contributed by @owi92.
 * New right panel visual language ([\#11664](https://github.com/matrix-org/matrix-react-sdk/pull/11664)).
 * OIDC: add friendly errors ([\#11184](https://github.com/matrix-org/matrix-react-sdk/pull/11184)). Fixes #25665. Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Fix rightpanel hiding scrollbar ([\#11831](https://github.com/matrix-org/matrix-react-sdk/pull/11831)). Contributed by @kerryarchibald.
 * Fix multi-tab session lock on Firefox not being cleared ([\#11800](https://github.com/matrix-org/matrix-react-sdk/pull/11800)). Fixes #26165. Contributed by @ManuelHu.
 * Deserialise spoilers back into slash command form ([\#11805](https://github.com/matrix-org/matrix-react-sdk/pull/11805)). Fixes #26344.
 * Fix Incorrect message scaling for verification request ([\#11793](https://github.com/matrix-org/matrix-react-sdk/pull/11793)). Fixes #24304. Contributed by @capGoblin.
 * Fix: Unable to restore a soft-logged-out session established via SSO ([\#11794](https://github.com/matrix-org/matrix-react-sdk/pull/11794)). Fixes #25957. Contributed by @kerryarchibald.
 * Use configurable github issue links more consistently ([\#11796](https://github.com/matrix-org/matrix-react-sdk/pull/11796)).
 * Fix io.element.late_event received_ts vs received_at ([\#11789](https://github.com/matrix-org/matrix-react-sdk/pull/11789)).
 * Make invitation dialog scrollable when infos are too long ([\#11753](https://github.com/matrix-org/matrix-react-sdk/pull/11753)). Contributed by @nurjinjafar.
 * Fix spoiler text-align ([\#11790](https://github.com/matrix-org/matrix-react-sdk/pull/11790)). Contributed by @ajbura.
 * Fix: Right panel keeps showing chat when unmaximizing widget.  ([\#11697](https://github.com/matrix-org/matrix-react-sdk/pull/11697)). Fixes #26265. Contributed by @manancodes.
 * Fix margin of invite to room button ([\#11780](https://github.com/matrix-org/matrix-react-sdk/pull/11780)). Fixes #26410.
 * Update base64 import ([\#11784](https://github.com/matrix-org/matrix-react-sdk/pull/11784)).
 * Set max size for Element logo in search warning ([\#11779](https://github.com/matrix-org/matrix-react-sdk/pull/11779)). Fixes #26408.
 * Fix: emoji size in room header topic, remove obsolete emoji style ([\#11757](https://github.com/matrix-org/matrix-react-sdk/pull/11757)). Fixes #26326. Contributed by @kerryarchibald.
 * Fix: Bubble layout design is broken ([\#11763](https://github.com/matrix-org/matrix-react-sdk/pull/11763)). Fixes #25818. Contributed by @manancodes.

Changes in [1.11.47](https://github.com/vector-im/element-web/releases/tag/v1.11.47) (2023-10-24)
=================================================================================================

## 🦖 Deprecations
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes #25733.

## ✨ Features
 * vector-im/element-x-ios/issues/1824 - Convert the apple-app-site-association file to a newer format… ([\#26307](https://github.com/vector-im/element-web/pull/26307)). Contributed by @stefanceriu.
 * Iterate `io.element.late_event` decoration ([\#11760](https://github.com/matrix-org/matrix-react-sdk/pull/11760)). Fixes #26384.
 * Render timeline separator for late event groups ([\#11739](https://github.com/matrix-org/matrix-react-sdk/pull/11739)).
 * OIDC: revoke tokens on logout ([\#11718](https://github.com/matrix-org/matrix-react-sdk/pull/11718)). Fixes #25394. Contributed by @kerryarchibald.
 * Show `io.element.late_event` in MessageTimestamp when known ([\#11733](https://github.com/matrix-org/matrix-react-sdk/pull/11733)).
 * Show all labs flags if developerMode enabled ([\#11746](https://github.com/matrix-org/matrix-react-sdk/pull/11746)). Fixes #24571 and #8498.
 * Use Compound tooltips on MessageTimestamp to improve UX of date time discovery ([\#11732](https://github.com/matrix-org/matrix-react-sdk/pull/11732)). Fixes #25913.
 * Consolidate 4s passphrase input fields and use stable IDs ([\#11743](https://github.com/matrix-org/matrix-react-sdk/pull/11743)). Fixes #26228.
 * Disable upgraderoom command without developer mode enabled ([\#11744](https://github.com/matrix-org/matrix-react-sdk/pull/11744)). Fixes #17620.
 * Avoid rendering app download buttons if disabled in config ([\#11741](https://github.com/matrix-org/matrix-react-sdk/pull/11741)). Fixes #26309.
 * OIDC: refresh tokens ([\#11699](https://github.com/matrix-org/matrix-react-sdk/pull/11699)). Fixes #25839. Contributed by @kerryarchibald.
 * OIDC: register ([\#11727](https://github.com/matrix-org/matrix-react-sdk/pull/11727)). Fixes #25393. Contributed by @kerryarchibald.
 * Use stable get_login_token and remove unstable MSC3882 support ([\#11001](https://github.com/matrix-org/matrix-react-sdk/pull/11001)). Contributed by @hughns.

## 🐛 Bug Fixes
 * Set max size for Element logo in search warning ([\#11779](https://github.com/matrix-org/matrix-react-sdk/pull/11779)). Fixes #26408.
 * Avoid error when DMing oneself ([\#11754](https://github.com/matrix-org/matrix-react-sdk/pull/11754)). Fixes #7242.
 * Fix: Message shield alignment is not right. ([\#11703](https://github.com/matrix-org/matrix-react-sdk/pull/11703)). Fixes #26142. Contributed by @manancodes.
 * fix logging full event ([\#11755](https://github.com/matrix-org/matrix-react-sdk/pull/11755)). Fixes #26376.
 * OIDC: use delegated auth account URL from `OidcClientStore` ([\#11723](https://github.com/matrix-org/matrix-react-sdk/pull/11723)). Fixes #26305. Contributed by @kerryarchibald.
 * Fix: Members list shield alignment is not right. ([\#11700](https://github.com/matrix-org/matrix-react-sdk/pull/11700)). Fixes #26261. Contributed by @manancodes.
 * Fix: <detail> HTML elements clickable area too wide. ([\#11666](https://github.com/matrix-org/matrix-react-sdk/pull/11666)). Fixes #25454. Contributed by @manancodes.
 * Fix untranslated headings in the devtools dialog ([\#11734](https://github.com/matrix-org/matrix-react-sdk/pull/11734)).
 * Fixes invite dialog alignment and pill color contrast ([\#11722](https://github.com/matrix-org/matrix-react-sdk/pull/11722)). Contributed by @gabrc52.
 * Prevent select element in General settings overflowing in a room with very long room-id ([\#11597](https://github.com/matrix-org/matrix-react-sdk/pull/11597)). Contributed by @ABHIXIT2.
 * Fix: Clicking on members pile does nothing. ([\#11657](https://github.com/matrix-org/matrix-react-sdk/pull/11657)). Fixes #26164. Contributed by @manancodes.
 * Fix: Wierd shadow below room avatar in dark mode. ([\#11678](https://github.com/matrix-org/matrix-react-sdk/pull/11678)). Fixes #26153. Contributed by @manancodes.
 * Fix start_sso / start_cas URLs failing to redirect to a authentication prompt ([\#11681](https://github.com/matrix-org/matrix-react-sdk/pull/11681)). Contributed by @Half-Shot.

Changes in [1.11.46](https://github.com/vector-im/element-web/releases/tag/v1.11.46) (2023-10-10)
=================================================================================================

## ✨ Features
 * Use .well-known to discover a default rendezvous server for use with Sign in with QR ([\#11655](https://github.com/matrix-org/matrix-react-sdk/pull/11655)). Contributed by @hughns.
 * Message layout will update according to the selected style  ([\#10170](https://github.com/matrix-org/matrix-react-sdk/pull/10170)). Fixes #21782. Contributed by @manancodes.
 * Implement MSC4039: Add an MSC for a new Widget API action to upload files into the media repository ([\#11311](https://github.com/matrix-org/matrix-react-sdk/pull/11311)). Contributed by @dhenneke.
 * Render space pills with square corners to match new avatar ([\#11632](https://github.com/matrix-org/matrix-react-sdk/pull/11632)). Fixes #26056.
 * Linkify room topic ([\#11631](https://github.com/matrix-org/matrix-react-sdk/pull/11631)). Fixes #26185.
 * Show knock rooms in the list ([\#11573](https://github.com/matrix-org/matrix-react-sdk/pull/11573)). Contributed by @maheichyk.

## 🐛 Bug Fixes
 * Bump matrix-web-i18n dependency to 3.1.3 ([\#26287](https://github.com/vector-im/element-web/pull/26287))
 * Fix: Avatar shrinks with long names ([\#11698](https://github.com/matrix-org/matrix-react-sdk/pull/11698)). Fixes #26252. Contributed by @manancodes.
 * Update custom translations to support nested fields in structured JSON ([\#11685](https://github.com/matrix-org/matrix-react-sdk/pull/11685)).
 * Fix: Edited message remove button is hard to reach. ([\#11674](https://github.com/matrix-org/matrix-react-sdk/pull/11674)). Fixes #24917. Contributed by @manancodes.
 * Fix: Theme selector radio button not aligned in center with the text ([\#11676](https://github.com/matrix-org/matrix-react-sdk/pull/11676)). Fixes #25460. Contributed by @manancodes.
 * Fix: Unread notification dot aligned ([\#11658](https://github.com/matrix-org/matrix-react-sdk/pull/11658)). Fixes #25285. Contributed by @manancodes.
 * Fix: sync intentional mentions push rules with legacy rules ([\#11667](https://github.com/matrix-org/matrix-react-sdk/pull/11667)). Fixes #26227. Contributed by @kerryarchibald.
 * Revert "Fix regression around FacePile with overflow (#11527)" ([\#11634](https://github.com/matrix-org/matrix-react-sdk/pull/11634)). Fixes #26209.
 * Fix: Alignment Fixed ([\#11648](https://github.com/matrix-org/matrix-react-sdk/pull/11648)). Fixes #26169. Contributed by @manancodes.
 * Fix: onFinished added which closes the menu ([\#11647](https://github.com/matrix-org/matrix-react-sdk/pull/11647)). Fixes #25556. Contributed by @manancodes.
 * Don't start key backups when opening settings ([\#11640](https://github.com/matrix-org/matrix-react-sdk/pull/11640)).
 * Fix add to space avatar text centering ([\#11643](https://github.com/matrix-org/matrix-react-sdk/pull/11643)). Fixes #26154.
 * fix avatar styling in lightbox ([\#11641](https://github.com/matrix-org/matrix-react-sdk/pull/11641)). Fixes #26196.

Changes in [1.11.45](https://github.com/vector-im/element-web/releases/tag/v1.11.45) (2023-09-29)
=================================================================================================

## 🐛 Bug Fixes
 * Fix Emoji font on Safari 17 ([\#11673](https://github.com/matrix-org/matrix-react-sdk/pull/11673)).

Changes in [1.11.44](https://github.com/vector-im/element-web/releases/tag/v1.11.44) (2023-09-26)
=================================================================================================

## ✨ Features
 * Make video & voice call buttons pin conference widget if unpinned ([\#11576](https://github.com/matrix-org/matrix-react-sdk/pull/11576)). Fixes vector-im/customer-retainer#72.
 * OIDC: persist refresh token ([\#11249](https://github.com/matrix-org/matrix-react-sdk/pull/11249)). Contributed by @kerryarchibald.
 * ElementR: Cross user verification ([\#11364](https://github.com/matrix-org/matrix-react-sdk/pull/11364)). Fixes #25752. Contributed by @florianduros.
 * Default intentional mentions ([\#11602](https://github.com/matrix-org/matrix-react-sdk/pull/11602)).
 * Notify users about denied access on ask-to-join  rooms ([\#11480](https://github.com/matrix-org/matrix-react-sdk/pull/11480)). Contributed by @nurjinjafar.
 * Allow setting knock room directory visibility ([\#11529](https://github.com/matrix-org/matrix-react-sdk/pull/11529)). Contributed by @charlynguyen.

## 🐛 Bug Fixes
 * Revert "Fix regression around FacePile with overflow (#11527)" ([\#11634](https://github.com/matrix-org/matrix-react-sdk/pull/11634)). Fixes #26209.
 * Escape placeholder before injecting it into the style ([\#11607](https://github.com/matrix-org/matrix-react-sdk/pull/11607)).
 * Move ViewUser action callback to RoomView ([\#11495](https://github.com/matrix-org/matrix-react-sdk/pull/11495)). Fixes #26040.
 * Fix room timeline search toggling behaviour edge case ([\#11605](https://github.com/matrix-org/matrix-react-sdk/pull/11605)). Fixes #26105.
 * Avoid rendering view-message link in RoomKnocksBar unnecessarily ([\#11598](https://github.com/matrix-org/matrix-react-sdk/pull/11598)). Contributed by @charlynguyen.
 * Use knock rooms sync to reflect the knock state ([\#11596](https://github.com/matrix-org/matrix-react-sdk/pull/11596)). Fixes #26043 and #26044. Contributed by @charlynguyen.
 * Fix avatar in right panel not using the correct font ([\#11593](https://github.com/matrix-org/matrix-react-sdk/pull/11593)). Fixes #26061. Contributed by @MidhunSureshR.
 * Add waits in Spotlight Cypress tests, hoping this unflakes them ([\#11590](https://github.com/matrix-org/matrix-react-sdk/pull/11590)). Fixes #26053, #26140 #26139 and #26138. Contributed by @andybalaam.
 * Fix vertical alignment of default avatar font ([\#11582](https://github.com/matrix-org/matrix-react-sdk/pull/11582)). Fixes #26081.
 * Fix avatars in public room & space search being flex shrunk ([\#11580](https://github.com/matrix-org/matrix-react-sdk/pull/11580)). Fixes #26133.
 * Fix EventTile avatars being rendered with a size of 0 instead of hidden ([\#11558](https://github.com/matrix-org/matrix-react-sdk/pull/11558)). Fixes #26075.

Changes in [1.11.43](https://github.com/vector-im/element-web/releases/tag/v1.11.43) (2023-09-15)
=================================================================================================

(No changes - bumping the version number for an element-desktop release.)

Changes in [1.11.42](https://github.com/vector-im/element-web/releases/tag/v1.11.42) (2023-09-13)
=================================================================================================

## 🐛 Bug Fixes
 * Update Compound to fix Firefox-specific avatar regression ([\#11604](https://github.com/matrix-org/matrix-react-sdk/pull/11604)). Fixes #26155.

Changes in [1.11.41](https://github.com/vector-im/element-web/releases/tag/v1.11.41) (2023-09-12)
=================================================================================================

## 🦖 Deprecations
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes #25733.

## ✨ Features
 * Make SVGR icons use forward ref ([\#26082](https://github.com/vector-im/element-web/pull/26082)).
 * Add support for rendering a custom wrapper around Element ([\#25537](https://github.com/vector-im/element-web/pull/25537)). Contributed by @maheichyk.
 * Allow creating public knock rooms ([\#11481](https://github.com/matrix-org/matrix-react-sdk/pull/11481)). Contributed by @charlynguyen.
 * Render custom images in reactions according to MSC4027 ([\#11087](https://github.com/matrix-org/matrix-react-sdk/pull/11087)). Contributed by @sumnerevans.
 * Introduce room knocks bar ([\#11475](https://github.com/matrix-org/matrix-react-sdk/pull/11475)). Contributed by @charlynguyen.
 * Room header UI updates ([\#11507](https://github.com/matrix-org/matrix-react-sdk/pull/11507)). Fixes #25892.
 * Remove green "verified" bar for encrypted events ([\#11496](https://github.com/matrix-org/matrix-react-sdk/pull/11496)).
 * Update member count on room summary update ([\#11488](https://github.com/matrix-org/matrix-react-sdk/pull/11488)).
 * Support for E2EE in Element Call  ([\#11492](https://github.com/matrix-org/matrix-react-sdk/pull/11492)).
 * Allow requesting to join knock rooms via spotlight ([\#11482](https://github.com/matrix-org/matrix-react-sdk/pull/11482)). Contributed by @charlynguyen.
 * Lock out the first tab if Element is opened in a second tab. ([\#11425](https://github.com/matrix-org/matrix-react-sdk/pull/11425)). Fixes #25157.
 * Change avatar to use Compound implementation ([\#11448](https://github.com/matrix-org/matrix-react-sdk/pull/11448)).

## 🐛 Bug Fixes
 * Fix vertical alignment of default avatar font ([\#11582](https://github.com/matrix-org/matrix-react-sdk/pull/11582)). Fixes #26081.
 * Fix avatars in public room & space search being flex shrunk ([\#11580](https://github.com/matrix-org/matrix-react-sdk/pull/11580)). Fixes #26133.
 * Fix EventTile avatars being rendered with a size of 0 instead of hidden ([\#11558](https://github.com/matrix-org/matrix-react-sdk/pull/11558)). Fixes #26075.
 * Fix compound external assets path in bundle ([\#26069](https://github.com/vector-im/element-web/pull/26069)).
 * Use RoomStateEvent.Update for knocks ([\#11516](https://github.com/matrix-org/matrix-react-sdk/pull/11516)). Contributed by @charlynguyen.
 * Prevent event propagation when clicking icon buttons ([\#11515](https://github.com/matrix-org/matrix-react-sdk/pull/11515)).
 * Only display RoomKnocksBar when feature flag is enabled ([\#11513](https://github.com/matrix-org/matrix-react-sdk/pull/11513)). Contributed by @andybalaam.
 * Fix avatars of knock members for people tab of room settings ([\#11506](https://github.com/matrix-org/matrix-react-sdk/pull/11506)). Fixes #26083. Contributed by @charlynguyen.
 * Fixes read receipt avatar offset ([\#11483](https://github.com/matrix-org/matrix-react-sdk/pull/11483)). Fixes #26067, #26064 #26059 and #26061.
 * Fix avatar defects ([\#11473](https://github.com/matrix-org/matrix-react-sdk/pull/11473)). Fixes #26051 and #26046.
 * Fix consistent avatar output for Percy ([\#11472](https://github.com/matrix-org/matrix-react-sdk/pull/11472)). Fixes #26049 and #26052.
 * Fix colour of avatar and colour matching with username ([\#11470](https://github.com/matrix-org/matrix-react-sdk/pull/11470)). Fixes #26042.
 * Fix incompatibility of Soft Logout with Element-R ([\#11468](https://github.com/matrix-org/matrix-react-sdk/pull/11468)).
 * Fix instances of double translation and guard translation calls using typescript ([\#11443](https://github.com/matrix-org/matrix-react-sdk/pull/11443)).

Changes in [1.11.40](https://github.com/vector-im/element-web/releases/tag/v1.11.40) (2023-08-29)
=================================================================================================

## ✨ Features
 * Hide account deactivation for externally managed accounts ([\#11445](https://github.com/matrix-org/matrix-react-sdk/pull/11445)). Fixes #26022. Contributed by @kerryarchibald.
 * OIDC: Redirect to delegated auth provider when signing out ([\#11432](https://github.com/matrix-org/matrix-react-sdk/pull/11432)). Fixes #26000. Contributed by @kerryarchibald.
 * Disable 3pid fields in settings when `m.3pid_changes` capability is disabled ([\#11430](https://github.com/matrix-org/matrix-react-sdk/pull/11430)). Fixes #25995. Contributed by @kerryarchibald.
 * OIDC: disable multi session signout for OIDC-aware servers in session manager ([\#11431](https://github.com/matrix-org/matrix-react-sdk/pull/11431)). Contributed by @kerryarchibald.
 * Implement updated open dialog method of the Module API ([\#11395](https://github.com/matrix-org/matrix-react-sdk/pull/11395)). Contributed by @dhenneke.
 * Polish & delabs `Exploring public spaces` feature ([\#11423](https://github.com/matrix-org/matrix-react-sdk/pull/11423)).
 * Treat lists with a single empty item as plain text, not Markdown. ([\#6833](https://github.com/matrix-org/matrix-react-sdk/pull/6833)). Fixes vector-im/element-meta#1265.
 * Allow managing room knocks ([\#11404](https://github.com/matrix-org/matrix-react-sdk/pull/11404)). Contributed by @charlynguyen.
 * Pin the action buttons to the bottom of the scrollable dialogs ([\#11407](https://github.com/matrix-org/matrix-react-sdk/pull/11407)). Contributed by @dhenneke.
 * Support Matrix 1.1 (drop legacy r0 versions) ([\#9819](https://github.com/matrix-org/matrix-react-sdk/pull/9819)).

## 🐛 Bug Fixes
 * Fix path separator for Windows based systems ([\#25997](https://github.com/vector-im/element-web/pull/25997)).
 * Fix instances of double translation and guard translation calls using typescript ([\#11443](https://github.com/matrix-org/matrix-react-sdk/pull/11443)).
 * Fix export type "Current timeline" to match its behaviour to its name ([\#11426](https://github.com/matrix-org/matrix-react-sdk/pull/11426)). Fixes #25988.
 * Fix Room Settings > Notifications file upload input being shown superfluously ([\#11415](https://github.com/matrix-org/matrix-react-sdk/pull/11415)). Fixes #18392.
 * Simplify registration with email validation ([\#11398](https://github.com/matrix-org/matrix-react-sdk/pull/11398)). Fixes #25832 #23601 and #22297.
 * correct home server URL ([\#11391](https://github.com/matrix-org/matrix-react-sdk/pull/11391)). Fixes #25931. Contributed by @NSV1991.
 * Include non-matching DMs in Spotlight recent conversations when the DM's userId is part of the search API results ([\#11374](https://github.com/matrix-org/matrix-react-sdk/pull/11374)). Contributed by @mgcm.
 * Fix useRoomMembers missing updates causing incorrect membership counts ([\#11392](https://github.com/matrix-org/matrix-react-sdk/pull/11392)). Fixes #17096.
 * Show error when searching public rooms fails ([\#11378](https://github.com/matrix-org/matrix-react-sdk/pull/11378)).

Changes in [1.11.39](https://github.com/vector-im/element-web/releases/tag/v1.11.39) (2023-08-15)
=================================================================================================

## 🦖 Deprecations
 * Deprecate camelCase config options ([\#25800](https://github.com/vector-im/element-web/pull/25800)).
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes #25733.

## ✨ Features
 * Update labs.md for knock rooms ([\#25923](https://github.com/vector-im/element-web/pull/25923)). Contributed by @charlynguyen.
 * Package release builds of element-web in package.element.io debs ([\#25198](https://github.com/vector-im/element-web/pull/25198)).
 * Allow knocking rooms ([\#11353](https://github.com/matrix-org/matrix-react-sdk/pull/11353)). Contributed by @charlynguyen.
 * Support adding space-restricted joins on rooms not members of those spaces ([\#9017](https://github.com/matrix-org/matrix-react-sdk/pull/9017)). Fixes #19213.
 * Clear requiresClient and show pop-out if widget-api fails to ready ([\#11321](https://github.com/matrix-org/matrix-react-sdk/pull/11321)). Fixes vector-im/customer-retainer#73.
 * Bump pagination sizes due to hidden events ([\#11342](https://github.com/matrix-org/matrix-react-sdk/pull/11342)).
 * Remove display of key backup signatures from backup settings ([\#11333](https://github.com/matrix-org/matrix-react-sdk/pull/11333)).
 * Use PassphraseFields in ExportE2eKeysDialog to enforce minimum passphrase complexity ([\#11222](https://github.com/matrix-org/matrix-react-sdk/pull/11222)). Fixes #9478.

## 🐛 Bug Fixes
 * Fix "Export chat" not respecting configured time format in plain text mode ([\#10696](https://github.com/matrix-org/matrix-react-sdk/pull/10696)). Fixes #23838. Contributed by @rashmitpankhania.
 * Fix some missing 1-count pluralisations around event list summaries ([\#11371](https://github.com/matrix-org/matrix-react-sdk/pull/11371)). Fixes #25925.
 * Fix create subspace dialog not working for public space creation ([\#11367](https://github.com/matrix-org/matrix-react-sdk/pull/11367)). Fixes #25916.
 * Search for users on paste ([\#11304](https://github.com/matrix-org/matrix-react-sdk/pull/11304)). Fixes #17523. Contributed by @peterscheu-aceart.
 * Fix AppTile context menu not always showing up when it has options ([\#11358](https://github.com/matrix-org/matrix-react-sdk/pull/11358)). Fixes #25914.
 * Fix clicking on home all rooms space notification not working ([\#11337](https://github.com/matrix-org/matrix-react-sdk/pull/11337)). Fixes #22844.
 * Fix joining a suggested room switching space away ([\#11347](https://github.com/matrix-org/matrix-react-sdk/pull/11347)). Fixes #25838.
 * Fix home/all rooms context menu in space panel ([\#11350](https://github.com/matrix-org/matrix-react-sdk/pull/11350)). Fixes #25896.
 * Make keyboard handling in and out of autocomplete completions consistent ([\#11344](https://github.com/matrix-org/matrix-react-sdk/pull/11344)). Fixes #25878.
 * De-duplicate reactions by sender to account for faulty/malicious servers ([\#11340](https://github.com/matrix-org/matrix-react-sdk/pull/11340)). Fixes #25872.
 * Fix disable_3pid_login being ignored for the email field ([\#11335](https://github.com/matrix-org/matrix-react-sdk/pull/11335)). Fixes #25863.
 * Upgrade wysiwyg editor for ctrl+backspace windows fix ([\#11324](https://github.com/matrix-org/matrix-react-sdk/pull/11324)). Fixes vector-im/verticals-internal#102.
 * Unhide the view source event toggle - it works well enough ([\#11336](https://github.com/matrix-org/matrix-react-sdk/pull/11336)). Fixes #25861.

Changes in [1.11.38](https://github.com/vector-im/element-web/releases/tag/v1.11.38) (2023-08-04)
=================================================================================================

## ✨ Features
 * Package release builds of element-web in package.element.io debs ([\#25198](https://github.com/vector-im/element-web/pull/25198)).

## 🐛 Bug Fixes
 * Revert to using the /presence API for presence ([\#11366](https://github.com/matrix-org/matrix-react-sdk/pull/11366))

Changes in [1.11.37](https://github.com/vector-im/element-web/releases/tag/v1.11.37) (2023-08-01)
=================================================================================================

## 🦖 Deprecations
 * Deprecate camelCase config options ([\#25800](https://github.com/vector-im/element-web/pull/25800)).
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes #25733.

## ✨ Features
 * Do not show "Forget room" button in Room View header for guest users ([\#10898](https://github.com/matrix-org/matrix-react-sdk/pull/10898)). Contributed by @spantaleev.
 * Switch to updating presence via /sync calls instead of PUT /presence ([\#11223](https://github.com/matrix-org/matrix-react-sdk/pull/11223)). Fixes #20809 #13877 and #4813.
 * Fix blockquote colour contrast ([\#11299](https://github.com/matrix-org/matrix-react-sdk/pull/11299)). Fixes matrix-org/element-web-rageshakes#21800.
 * Don't hide room header buttons in video rooms and rooms with a call ([\#9712](https://github.com/matrix-org/matrix-react-sdk/pull/9712)). Fixes #23900.
 * OIDC: Persist details in session storage, create store ([\#11302](https://github.com/matrix-org/matrix-react-sdk/pull/11302)). Fixes #25710. Contributed by @kerryarchibald.
 * Allow setting room join rule to knock ([\#11248](https://github.com/matrix-org/matrix-react-sdk/pull/11248)). Contributed by @charlynguyen.
 * Retry joins on 524 (Cloudflare timeout) also ([\#11296](https://github.com/matrix-org/matrix-react-sdk/pull/11296)). Fixes #8776.
 * Make sure users returned by the homeserver search API are displayed. Don't silently drop any. ([\#9556](https://github.com/matrix-org/matrix-react-sdk/pull/9556)). Fixes #24422. Contributed by @maxmalek.
 * Offer to unban user during invite if inviter has sufficient permissions ([\#11256](https://github.com/matrix-org/matrix-react-sdk/pull/11256)). Fixes #3222.
 * Split join and goto slash commands, the latter shouldn't auto_join ([\#11259](https://github.com/matrix-org/matrix-react-sdk/pull/11259)). Fixes #10128.
 * Integration work for rich text editor 2.3.1 ([\#11172](https://github.com/matrix-org/matrix-react-sdk/pull/11172)). Contributed by @alunturner.
 * Compound color pass ([\#11079](https://github.com/matrix-org/matrix-react-sdk/pull/11079)). Fixes vector-im/internal-planning#450 and #25547.
 * Warn when demoting self via /op and /deop slash commands ([\#11214](https://github.com/matrix-org/matrix-react-sdk/pull/11214)). Fixes #13726.

## 🐛 Bug Fixes
 * Correct Jitsi preferred_domain property ([\#25813](https://github.com/vector-im/element-web/pull/25813)). Contributed by @benbz.
 * Fix edge case with sent indicator being drawn when it shouldn't be ([\#11320](https://github.com/matrix-org/matrix-react-sdk/pull/11320)).
 * Use correct translation function for WYSIWYG buttons ([\#11315](https://github.com/matrix-org/matrix-react-sdk/pull/11315)). Fixes vector-im/verticals-internal#109.
 * Handle empty own profile ([\#11319](https://github.com/matrix-org/matrix-react-sdk/pull/11319)). Fixes #25510.
 * Fix peeked rooms showing up in historical ([\#11316](https://github.com/matrix-org/matrix-react-sdk/pull/11316)). Fixes #22473.
 * Ensure consistency when rendering the sent event indicator ([\#11314](https://github.com/matrix-org/matrix-react-sdk/pull/11314)). Fixes #17937.
 * Prevent re-filtering user directory results in spotlight ([\#11290](https://github.com/matrix-org/matrix-react-sdk/pull/11290)). Fixes #24422.
 * Fix GIF label on dark theme ([\#11312](https://github.com/matrix-org/matrix-react-sdk/pull/11312)). Fixes #25836.
 * Fix issues around room notification settings flaking out ([\#11306](https://github.com/matrix-org/matrix-react-sdk/pull/11306)). Fixes #16472 #21309 and #6828.
 * Fix invite dialog showing the same user multiple times ([\#11308](https://github.com/matrix-org/matrix-react-sdk/pull/11308)). Fixes #25578.
 * Don't show composer send button if user cannot send ([\#11298](https://github.com/matrix-org/matrix-react-sdk/pull/11298)). Fixes #25825.
 * Restore color for sender in imageview ([\#11289](https://github.com/matrix-org/matrix-react-sdk/pull/11289)). Fixes #25822.
 * Fix changelog dialog heading size ([\#11286](https://github.com/matrix-org/matrix-react-sdk/pull/11286)). Fixes #25789.
 * Restore offline presence badge color ([\#11287](https://github.com/matrix-org/matrix-react-sdk/pull/11287)). Fixes #25792.
 * Fix bubble message layout avatar overlap ([\#11284](https://github.com/matrix-org/matrix-react-sdk/pull/11284)). Fixes #25818.
 * Fix voice call tile size ([\#11285](https://github.com/matrix-org/matrix-react-sdk/pull/11285)). Fixes #25684.
 * Fix layout of sessions tab buttons ([\#11279](https://github.com/matrix-org/matrix-react-sdk/pull/11279)). Fixes #25545.
 * Don't bother showing redundant tooltip on space menu ([\#11276](https://github.com/matrix-org/matrix-react-sdk/pull/11276)). Fixes #20380.
 * Remove reply fallback from notifications ([\#11278](https://github.com/matrix-org/matrix-react-sdk/pull/11278)). Fixes #17859.
 * Populate info.duration for audio & video file uploads ([\#11225](https://github.com/matrix-org/matrix-react-sdk/pull/11225)). Fixes #17720.
 * Hide widget menu button if it there are no options available ([\#11257](https://github.com/matrix-org/matrix-react-sdk/pull/11257)). Fixes #24826.
 * Fix colour regressions ([\#11273](https://github.com/matrix-org/matrix-react-sdk/pull/11273)). Fixes #25788, #25808 #25811 and #25812.
 * Fix room view not properly maintaining scroll position ([\#11274](https://github.com/matrix-org/matrix-react-sdk/pull/11274)). Fixes #25810.
 * Prevent user from accidentally double clicking user info admin actions ([\#11254](https://github.com/matrix-org/matrix-react-sdk/pull/11254)). Fixes #10944.
 * Fix missing metaspace notification badges ([\#11269](https://github.com/matrix-org/matrix-react-sdk/pull/11269)). Fixes #25679.
 * Fix clicking MXID in timeline going to matrix.to ([\#11263](https://github.com/matrix-org/matrix-react-sdk/pull/11263)). Fixes #23342.
 * Restoring optional ligatures by resetting letter-spacing ([\#11202](https://github.com/matrix-org/matrix-react-sdk/pull/11202)). Fixes #25727.
 * Allow emoji presentation selector to not break BigEmoji styling ([\#11253](https://github.com/matrix-org/matrix-react-sdk/pull/11253)). Fixes #17848.
 * Make event highliht use primary content token ([\#11255](https://github.com/matrix-org/matrix-react-sdk/pull/11255)).
 * Fix event info events size and color ([\#11252](https://github.com/matrix-org/matrix-react-sdk/pull/11252)). Fixes #25778.
 * Fix color mapping for blockquote border ([\#11251](https://github.com/matrix-org/matrix-react-sdk/pull/11251)). Fixes #25782.
 * Strip emoji variation when searching emoji by emoji ([\#11221](https://github.com/matrix-org/matrix-react-sdk/pull/11221)). Fixes #18703.

Changes in [1.11.36](https://github.com/vector-im/element-web/releases/tag/v1.11.36) (2023-07-18)
=================================================================================================

## 🔒 Security
 * Fixes for [CVE-2023-37259](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-37259) / [GHSA-c9vx-2g7w-rp65](https://github.com/matrix-org/matrix-react-sdk/security/advisories/GHSA-c9vx-2g7w-rp65)

## 🦖 Deprecations
 * Deprecate customisations in favour of Module API ([\#25736](https://github.com/vector-im/element-web/pull/25736)). Fixes #25733.

## ✨ Features
 * OIDC: store initial screen in session storage  ([\#25688](https://github.com/vector-im/element-web/pull/25688)). Fixes #25656. Contributed by @kerryarchibald.
 * Allow default_server_config as a fallback config ([\#25682](https://github.com/vector-im/element-web/pull/25682)). Contributed by @ShadowRZ.
 * OIDC: remove auth params from url after login attempt ([\#25664](https://github.com/vector-im/element-web/pull/25664)). Contributed by @kerryarchibald.
 * feat(faq): remove keyboard shortcuts button ([\#9342](https://github.com/matrix-org/matrix-react-sdk/pull/9342)). Fixes #22625. Contributed by @gefgu.
 * GYU: Update banner ([\#11211](https://github.com/matrix-org/matrix-react-sdk/pull/11211)). Fixes #25530. Contributed by @justjanne.
 * Linkify mxc:// URLs as links to your media repo ([\#11213](https://github.com/matrix-org/matrix-react-sdk/pull/11213)). Fixes #6942.
 * OIDC: Log in ([\#11199](https://github.com/matrix-org/matrix-react-sdk/pull/11199)). Fixes #25657. Contributed by @kerryarchibald.
 * Handle all permitted url schemes in linkify ([\#11215](https://github.com/matrix-org/matrix-react-sdk/pull/11215)). Fixes #4457 and #8720.
 * Autoapprove Element Call oidc requests ([\#11209](https://github.com/matrix-org/matrix-react-sdk/pull/11209)). Contributed by @toger5.
 * Allow creating knock rooms ([\#11182](https://github.com/matrix-org/matrix-react-sdk/pull/11182)). Contributed by @charlynguyen.
 * Expose and pre-populate thread ID in devtools dialog ([\#10953](https://github.com/matrix-org/matrix-react-sdk/pull/10953)).
 * Hide URL preview if it will be empty ([\#9029](https://github.com/matrix-org/matrix-react-sdk/pull/9029)).
 * Change wording from avatar to profile picture ([\#7015](https://github.com/matrix-org/matrix-react-sdk/pull/7015)). Fixes vector-im/element-meta#1331. Contributed by @aaronraimist.
 * Quick and dirty devtool to explore state history ([\#11197](https://github.com/matrix-org/matrix-react-sdk/pull/11197)).
 * Consider more user inputs when calculating zxcvbn score ([\#11180](https://github.com/matrix-org/matrix-react-sdk/pull/11180)).
 * GYU: Account Notification Settings ([\#11008](https://github.com/matrix-org/matrix-react-sdk/pull/11008)). Fixes #24567. Contributed by @justjanne.
 * Compound Typography pass ([\#11103](https://github.com/matrix-org/matrix-react-sdk/pull/11103)). Fixes #25548.
 * OIDC: navigate to authorization endpoint ([\#11096](https://github.com/matrix-org/matrix-react-sdk/pull/11096)). Fixes #25574. Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Fix read receipt sending behaviour around thread roots ([\#3600](https://github.com/matrix-org/matrix-js-sdk/pull/3600)).
 * Fix missing metaspace notification badges ([\#11269](https://github.com/matrix-org/matrix-react-sdk/pull/11269)). Fixes #25679.
 * Make checkboxes less rounded ([\#11224](https://github.com/matrix-org/matrix-react-sdk/pull/11224)). Contributed by @andybalaam.
 * GYU: Fix issues with audible keywords without activated mentions ([\#11218](https://github.com/matrix-org/matrix-react-sdk/pull/11218)). Contributed by @justjanne.
 * PosthogAnalytics unwatch settings on logout ([\#11207](https://github.com/matrix-org/matrix-react-sdk/pull/11207)). Fixes #25703.
 * Avoid trying to set room account data for pinned events as guest ([\#11216](https://github.com/matrix-org/matrix-react-sdk/pull/11216)). Fixes #6300.
 * GYU: Disable sound for DMs checkbox when DM notifications are disabled ([\#11210](https://github.com/matrix-org/matrix-react-sdk/pull/11210)). Contributed by @justjanne.
 * force to allow calls without video and audio in embedded mode ([\#11131](https://github.com/matrix-org/matrix-react-sdk/pull/11131)). Contributed by @EnricoSchw.
 * Fix room tile text clipping ([\#11196](https://github.com/matrix-org/matrix-react-sdk/pull/11196)). Fixes #25718.
 * Handle newlines in user pills ([\#11166](https://github.com/matrix-org/matrix-react-sdk/pull/11166)). Fixes #10994.
 * Limit width of user menu in space panel ([\#11192](https://github.com/matrix-org/matrix-react-sdk/pull/11192)). Fixes #22627.
 * Add isLocation to ComposerEvent analytics events ([\#11187](https://github.com/matrix-org/matrix-react-sdk/pull/11187)). Contributed by @andybalaam.
 * Fix: hide unsupported login elements ([\#11185](https://github.com/matrix-org/matrix-react-sdk/pull/11185)). Fixes #25711. Contributed by @kerryarchibald.
 * Scope smaller font size to user info panel ([\#11178](https://github.com/matrix-org/matrix-react-sdk/pull/11178)). Fixes #25683.
 * Apply i18n to strings in the html export ([\#11176](https://github.com/matrix-org/matrix-react-sdk/pull/11176)).
 * Inhibit url previews on MXIDs containing slashes same as those without ([\#11160](https://github.com/matrix-org/matrix-react-sdk/pull/11160)).
 * Make event info size consistent with state events ([\#11181](https://github.com/matrix-org/matrix-react-sdk/pull/11181)).
 * Fix markdown content spacing ([\#11177](https://github.com/matrix-org/matrix-react-sdk/pull/11177)). Fixes #25685.
 * Fix font-family definition for emojis ([\#11170](https://github.com/matrix-org/matrix-react-sdk/pull/11170)). Fixes #25686.
 * Fix spurious error sending receipt in thread errors ([\#11157](https://github.com/matrix-org/matrix-react-sdk/pull/11157)).
 * Consider the empty push rule actions array equiv to deprecated dont_notify ([\#11155](https://github.com/matrix-org/matrix-react-sdk/pull/11155)). Fixes #25674.
 * Only trap escape key for cancel reply if there is a reply ([\#11140](https://github.com/matrix-org/matrix-react-sdk/pull/11140)). Fixes #25640.
 * Update linkify to 4.1.1 ([\#11132](https://github.com/matrix-org/matrix-react-sdk/pull/11132)). Fixes #23806.

Changes in [1.11.35](https://github.com/vector-im/element-web/releases/tag/v1.11.35) (2023-07-04)
=================================================================================================

## 🦖 Deprecations
 * Remove `feature_favourite_messages` as it is has been abandoned for now ([\#11097](https://github.com/matrix-org/matrix-react-sdk/pull/11097)). Fixes #25555.

## ✨ Features
 * Don't setup keys on login when encryption is force disabled ([\#11125](https://github.com/matrix-org/matrix-react-sdk/pull/11125)). Contributed by @kerryarchibald.
 * OIDC: attempt dynamic client registration ([\#11074](https://github.com/matrix-org/matrix-react-sdk/pull/11074)). Fixes #25468 and #25467. Contributed by @kerryarchibald.
 * OIDC: Check static client registration and add login flow ([\#11088](https://github.com/matrix-org/matrix-react-sdk/pull/11088)). Fixes #25467. Contributed by @kerryarchibald.
 * Improve message body output from plain text editor ([\#11124](https://github.com/matrix-org/matrix-react-sdk/pull/11124)). Contributed by @alunturner.
 * Disable encryption toggle in room settings when force disabled ([\#11122](https://github.com/matrix-org/matrix-react-sdk/pull/11122)). Contributed by @kerryarchibald.
 * Add .well-known config option to force disable encryption on room creation ([\#11120](https://github.com/matrix-org/matrix-react-sdk/pull/11120)). Contributed by @kerryarchibald.
 * Handle permalinks in room topic ([\#11115](https://github.com/matrix-org/matrix-react-sdk/pull/11115)). Fixes #23395.
 * Add at room avatar for RTE ([\#11106](https://github.com/matrix-org/matrix-react-sdk/pull/11106)). Contributed by @alunturner.
 * Remove new room breadcrumbs ([\#11104](https://github.com/matrix-org/matrix-react-sdk/pull/11104)).
 * Update rich text editor dependency and associated changes ([\#11098](https://github.com/matrix-org/matrix-react-sdk/pull/11098)). Contributed by @alunturner.
 * Implement new model, hooks and reconcilation code for new GYU notification settings ([\#11089](https://github.com/matrix-org/matrix-react-sdk/pull/11089)). Contributed by @justjanne.
 * Allow maintaining a different right panel width for thread panels ([\#11064](https://github.com/matrix-org/matrix-react-sdk/pull/11064)). Fixes #25487.
 * Make AppPermission pane scrollable ([\#10954](https://github.com/matrix-org/matrix-react-sdk/pull/10954)). Fixes #25438 and #25511. Contributed by @luixxiul.
 * Integrate compound design tokens ([\#11091](https://github.com/matrix-org/matrix-react-sdk/pull/11091)). Fixes vector-im/internal-planning#450.
 * Don't warn about the effects of redacting state events when redacting non-state-events ([\#11071](https://github.com/matrix-org/matrix-react-sdk/pull/11071)). Fixes #8478.
 * Allow specifying help URLs in config.json ([\#11070](https://github.com/matrix-org/matrix-react-sdk/pull/11070)). Fixes #15268.

## 🐛 Bug Fixes
 * Fix error when generating error for polling for updates ([\#25609](https://github.com/vector-im/element-web/pull/25609)).
 * Fix spurious notifications on non-live events ([\#11133](https://github.com/matrix-org/matrix-react-sdk/pull/11133)). Fixes #24336.
 * Prevent auto-translation within composer ([\#11114](https://github.com/matrix-org/matrix-react-sdk/pull/11114)). Fixes #25624.
 * Fix caret jump when backspacing into empty line at beginning of editor ([\#11128](https://github.com/matrix-org/matrix-react-sdk/pull/11128)). Fixes #22335.
 * Fix server picker not allowing you to switch from custom to default ([\#11127](https://github.com/matrix-org/matrix-react-sdk/pull/11127)). Fixes #25650.
 * Consider the unthreaded read receipt for Unread dot state ([\#11117](https://github.com/matrix-org/matrix-react-sdk/pull/11117)). Fixes #24229.
 * Increase RTE resilience ([\#11111](https://github.com/matrix-org/matrix-react-sdk/pull/11111)). Fixes #25277. Contributed by @alunturner.
 * Fix RoomView ignoring alias lookup errors due to them not knowing the roomId ([\#11099](https://github.com/matrix-org/matrix-react-sdk/pull/11099)). Fixes #24783 and #25562.
 * Fix style inconsistencies on SecureBackupPanel ([\#11102](https://github.com/matrix-org/matrix-react-sdk/pull/11102)). Fixes #25615. Contributed by @luixxiul.
 * Remove unknown MXIDs from invite suggestions ([\#11055](https://github.com/matrix-org/matrix-react-sdk/pull/11055)). Fixes #25446.
 * Reduce volume of ring sounds to normalised levels ([\#9143](https://github.com/matrix-org/matrix-react-sdk/pull/9143)). Contributed by @JMoVS.
 * Fix slash commands not being enabled in certain cases ([\#11090](https://github.com/matrix-org/matrix-react-sdk/pull/11090)). Fixes #25572.
 * Prevent escape in threads from sending focus to main timeline composer ([\#11061](https://github.com/matrix-org/matrix-react-sdk/pull/11061)). Fixes #23397.

Changes in [1.11.34](https://github.com/vector-im/element-web/releases/tag/v1.11.34) (2023-06-20)
=================================================================================================

## ✨ Features
 * OIDC: add delegatedauthentication to validated server config ([\#11053](https://github.com/matrix-org/matrix-react-sdk/pull/11053)). Contributed by @kerryarchibald.
 * Allow image pasting in plain mode in RTE ([\#11056](https://github.com/matrix-org/matrix-react-sdk/pull/11056)). Contributed by @alunturner.
 * Show room options menu if "UIComponent.roomOptionsMenu" is enabled ([\#10365](https://github.com/matrix-org/matrix-react-sdk/pull/10365)). Contributed by @maheichyk.
 * Allow image pasting in rich text mode in RTE ([\#11049](https://github.com/matrix-org/matrix-react-sdk/pull/11049)). Contributed by @alunturner.
 * Update voice broadcast redaction to use MSC3912 `with_rel_type` instead of `with_relations` ([\#11014](https://github.com/matrix-org/matrix-react-sdk/pull/11014)). Fixes #25471.
 * Add config to skip widget_build_url for DM rooms ([\#11044](https://github.com/matrix-org/matrix-react-sdk/pull/11044)). Fixes vector-im/customer-retainer#74.
 * Inhibit interactions on forward dialog message previews ([\#11025](https://github.com/matrix-org/matrix-react-sdk/pull/11025)). Fixes #23459.
 * Removed `DecryptionFailureBar.tsx` ([\#11027](https://github.com/matrix-org/matrix-react-sdk/pull/11027)). Fixes vector-im/element-meta#1358. Contributed by @florianduros.

## 🐛 Bug Fixes
 * Fix translucent `TextualEvent` on search results panel ([\#10810](https://github.com/matrix-org/matrix-react-sdk/pull/10810)). Fixes #25292. Contributed by @luixxiul.
 * Matrix matrix scheme permalink constructor not stripping query params ([\#11060](https://github.com/matrix-org/matrix-react-sdk/pull/11060)). Fixes #25535.
 * Fix: "manually verify by text" does nothing ([\#11059](https://github.com/matrix-org/matrix-react-sdk/pull/11059)). Fixes #25375. Contributed by @kerryarchibald.
 * Make group calls respect the ICE fallback setting ([\#11047](https://github.com/matrix-org/matrix-react-sdk/pull/11047)). Fixes vector-im/voip-internal#65.
 * Align list items on the tooltip to the start ([\#11041](https://github.com/matrix-org/matrix-react-sdk/pull/11041)). Fixes #25355. Contributed by @luixxiul.
 * Clear thread panel event permalink when changing rooms ([\#11024](https://github.com/matrix-org/matrix-react-sdk/pull/11024)). Fixes #25484.
 * Fix spinner placement on pinned widgets being reloaded ([\#10970](https://github.com/matrix-org/matrix-react-sdk/pull/10970)). Fixes #25431. Contributed by @luixxiul.

Changes in [1.11.33](https://github.com/vector-im/element-web/releases/tag/v1.11.33) (2023-06-09)
=================================================================================================

## 🐛 Bug Fixes
 * Bump matrix-react-sdk to v3.73.1 for matrix-js-sdk v26.0.1. Fixes #25526.

Changes in [1.11.32](https://github.com/vector-im/element-web/releases/tag/v1.11.32) (2023-06-06)
=================================================================================================

## ✨ Features
 * Redirect to the SSO page if `sso_redirect_options.on_welcome_page` is enabled and the URL hash is empty ([\#25495](https://github.com/vector-im/element-web/pull/25495)). Contributed by @dhenneke.
 * vector/index.html: Allow fetching blob urls ([\#25336](https://github.com/vector-im/element-web/pull/25336)). Contributed by @SuperKenVery.
 * When joining room in sub-space join the parents too ([\#11011](https://github.com/matrix-org/matrix-react-sdk/pull/11011)).
 * Include thread replies in message previews ([\#10631](https://github.com/matrix-org/matrix-react-sdk/pull/10631)). Fixes #23920.
 * Use semantic headings in space preferences ([\#11021](https://github.com/matrix-org/matrix-react-sdk/pull/11021)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - Ignored users ([\#11006](https://github.com/matrix-org/matrix-react-sdk/pull/11006)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - profile ([\#10973](https://github.com/matrix-org/matrix-react-sdk/pull/10973)). Fixes #25461. Contributed by @kerryarchibald.
 * Use semantic headings in user settings - account ([\#10972](https://github.com/matrix-org/matrix-react-sdk/pull/10972)). Contributed by @kerryarchibald.
 * Support `Insert from iPhone or iPad` in Safari ([\#10851](https://github.com/matrix-org/matrix-react-sdk/pull/10851)). Fixes #25327. Contributed by @SuperKenVery.
 * Specify supportedStages for User Interactive Auth ([\#10975](https://github.com/matrix-org/matrix-react-sdk/pull/10975)). Fixes #19605.
 * Pass device id to widgets ([\#10209](https://github.com/matrix-org/matrix-react-sdk/pull/10209)). Contributed by @Fox32.
 * Use semantic headings in user settings - discovery ([\#10838](https://github.com/matrix-org/matrix-react-sdk/pull/10838)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings -  Notifications ([\#10948](https://github.com/matrix-org/matrix-react-sdk/pull/10948)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - spellcheck and language ([\#10959](https://github.com/matrix-org/matrix-react-sdk/pull/10959)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings Appearance ([\#10827](https://github.com/matrix-org/matrix-react-sdk/pull/10827)). Contributed by @kerryarchibald.
 * Use semantic heading in user settings Sidebar & Voip ([\#10782](https://github.com/matrix-org/matrix-react-sdk/pull/10782)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings Security ([\#10774](https://github.com/matrix-org/matrix-react-sdk/pull/10774)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings - integrations and account deletion ([\#10837](https://github.com/matrix-org/matrix-react-sdk/pull/10837)). Fixes #25378. Contributed by @kerryarchibald.
 * Use semantic headings in user settings Preferences ([\#10794](https://github.com/matrix-org/matrix-react-sdk/pull/10794)). Contributed by @kerryarchibald.
 * Use semantic headings in user settings Keyboard ([\#10793](https://github.com/matrix-org/matrix-react-sdk/pull/10793)). Contributed by @kerryarchibald.
 * RTE plain text mentions as pills ([\#10852](https://github.com/matrix-org/matrix-react-sdk/pull/10852)). Contributed by @alunturner.
 * Allow welcome.html logo to be replaced by config ([\#25339](https://github.com/vector-im/element-web/pull/25339)). Fixes #8636.
 * Use semantic headings in user settings Labs ([\#10773](https://github.com/matrix-org/matrix-react-sdk/pull/10773)). Contributed by @kerryarchibald.
 * Use semantic list elements for menu lists and tab lists ([\#10902](https://github.com/matrix-org/matrix-react-sdk/pull/10902)). Fixes #24928.
 * Fix aria-required-children axe violation ([\#10900](https://github.com/matrix-org/matrix-react-sdk/pull/10900)). Fixes #25342.
 * Enable pagination for overlay timelines ([\#10757](https://github.com/matrix-org/matrix-react-sdk/pull/10757)). Fixes vector-im/voip-internal#107.
 * Add tooltip to disabled invite button due to lack of permissions ([\#10869](https://github.com/matrix-org/matrix-react-sdk/pull/10869)). Fixes #9824.
 * Respect configured auth_header_logo_url for default Welcome page ([\#10870](https://github.com/matrix-org/matrix-react-sdk/pull/10870)).
 * Specify lazy loading for avatars ([\#10866](https://github.com/matrix-org/matrix-react-sdk/pull/10866)). Fixes #1983.
 * Room and user mentions for plain text editor ([\#10665](https://github.com/matrix-org/matrix-react-sdk/pull/10665)). Contributed by @alunturner.
 * Add audible notifcation on broadcast error ([\#10654](https://github.com/matrix-org/matrix-react-sdk/pull/10654)). Fixes #25132.
 * Fall back from server generated thumbnail to original image ([\#10853](https://github.com/matrix-org/matrix-react-sdk/pull/10853)).
 * Use semantically correct elements for room sublist context menu ([\#10831](https://github.com/matrix-org/matrix-react-sdk/pull/10831)). Fixes vector-im/customer-retainer#46.
 * Avoid calling prepareToEncrypt onKeyDown ([\#10828](https://github.com/matrix-org/matrix-react-sdk/pull/10828)).
 * Allows search to recognize full room links ([\#8275](https://github.com/matrix-org/matrix-react-sdk/pull/8275)). Contributed by @bolu-tife.
 * "Show rooms with unread messages first" should not be on by default for new users ([\#10820](https://github.com/matrix-org/matrix-react-sdk/pull/10820)). Fixes #25304. Contributed by @kerryarchibald.
 * Fix emitter handler leak in ThreadView ([\#10803](https://github.com/matrix-org/matrix-react-sdk/pull/10803)).
 * Add better error for email invites without identity server ([\#10739](https://github.com/matrix-org/matrix-react-sdk/pull/10739)). Fixes #16893.
 * Move reaction message previews out of labs ([\#10601](https://github.com/matrix-org/matrix-react-sdk/pull/10601)). Fixes #25083.
 * Sort muted rooms to the bottom of their section of the room list ([\#10592](https://github.com/matrix-org/matrix-react-sdk/pull/10592)). Fixes #25131. Contributed by @kerryarchibald.
 * Use semantic headings in user settings Help & About ([\#10752](https://github.com/matrix-org/matrix-react-sdk/pull/10752)). Contributed by @kerryarchibald.
 * use ExternalLink components for external links ([\#10758](https://github.com/matrix-org/matrix-react-sdk/pull/10758)). Contributed by @kerryarchibald.
 * Use semantic headings in space settings ([\#10751](https://github.com/matrix-org/matrix-react-sdk/pull/10751)). Contributed by @kerryarchibald.
 * Use semantic headings for room settings content ([\#10734](https://github.com/matrix-org/matrix-react-sdk/pull/10734)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Use consistent fonts for Japanese text ([\#10980](https://github.com/matrix-org/matrix-react-sdk/pull/10980)). Fixes #22333 and #23899.
 * Fix: server picker validates unselected option ([\#11020](https://github.com/matrix-org/matrix-react-sdk/pull/11020)). Fixes #25488. Contributed by @kerryarchibald.
 * Fix room list notification badges going missing in compact layout ([\#11022](https://github.com/matrix-org/matrix-react-sdk/pull/11022)). Fixes #25372.
 * Fix call to `startSingleSignOn` passing enum in place of idpId ([\#10998](https://github.com/matrix-org/matrix-react-sdk/pull/10998)). Fixes #24953.
 * Remove hover effect from user name on a DM creation UI ([\#10887](https://github.com/matrix-org/matrix-react-sdk/pull/10887)). Fixes #25305. Contributed by @luixxiul.
 * Fix layout regression in public space invite dialog ([\#11009](https://github.com/matrix-org/matrix-react-sdk/pull/11009)). Fixes #25458.
 * Fix layout regression in session dropdown ([\#10999](https://github.com/matrix-org/matrix-react-sdk/pull/10999)). Fixes #25448.
 * Fix spacing regression in user settings - roles & permissions ([\#10993](https://github.com/matrix-org/matrix-react-sdk/pull/10993)). Fixes #25447 and #25451. Contributed by @kerryarchibald.
 * Fall back to receipt timestamp if we have no event (react-sdk part) ([\#10974](https://github.com/matrix-org/matrix-react-sdk/pull/10974)). Fixes #10954. Contributed by @andybalaam.
 * Fix: Room header 'view your device list' does not link to new session manager ([\#10979](https://github.com/matrix-org/matrix-react-sdk/pull/10979)). Fixes #25440. Contributed by @kerryarchibald.
 * Fix display of devices without encryption support in Settings dialog ([\#10977](https://github.com/matrix-org/matrix-react-sdk/pull/10977)). Fixes #25413.
 * Use aria descriptions instead of labels for TextWithTooltip ([\#10952](https://github.com/matrix-org/matrix-react-sdk/pull/10952)). Fixes #25398.
 * Use grapheme-splitter instead of lodash for saving emoji from being ripped apart ([\#10976](https://github.com/matrix-org/matrix-react-sdk/pull/10976)). Fixes #22196.
 * Fix: content overflow in settings subsection ([\#10960](https://github.com/matrix-org/matrix-react-sdk/pull/10960)). Fixes #25416. Contributed by @kerryarchibald.
 * Make `Privacy Notice` external link on integration manager ToS clickable ([\#10914](https://github.com/matrix-org/matrix-react-sdk/pull/10914)). Fixes #25384. Contributed by @luixxiul.
 * Ensure that open message context menus are updated when the event is sent ([\#10950](https://github.com/matrix-org/matrix-react-sdk/pull/10950)).
 * Ensure that open sticker picker dialogs are updated when the widget configuration is updated. ([\#10945](https://github.com/matrix-org/matrix-react-sdk/pull/10945)).
 * Fix big emoji in replies ([\#10932](https://github.com/matrix-org/matrix-react-sdk/pull/10932)). Fixes #24798.
 * Hide empty `MessageActionBar` on message edit history dialog ([\#10447](https://github.com/matrix-org/matrix-react-sdk/pull/10447)). Fixes #24903. Contributed by @luixxiul.
 * Fix roving tab index getting confused after dragging space order ([\#10901](https://github.com/matrix-org/matrix-react-sdk/pull/10901)).
 * Attempt a potential workaround for stuck notifs ([\#3384](https://github.com/matrix-org/matrix-js-sdk/pull/3384)). Fixes vector-im/element-web#25406. Contributed by @andybalaam.
 * Handle trailing dot FQDNs for domain-specific config.json files ([\#25351](https://github.com/vector-im/element-web/pull/25351)). Fixes #8858.
 * Ignore edits in message previews when they concern messages other than latest ([\#10868](https://github.com/matrix-org/matrix-react-sdk/pull/10868)). Fixes #14872.
 * Send correct receipts when viewing a room ([\#10864](https://github.com/matrix-org/matrix-react-sdk/pull/10864)). Fixes #25196.
 * Fix timeline search bar being overlapped by the right panel ([\#10809](https://github.com/matrix-org/matrix-react-sdk/pull/10809)). Fixes #25291. Contributed by @luixxiul.
 * Fix the state shown for call in rooms ([\#10833](https://github.com/matrix-org/matrix-react-sdk/pull/10833)).
 * Add string for membership event where both displayname & avatar change ([\#10880](https://github.com/matrix-org/matrix-react-sdk/pull/10880)). Fixes #18026.
 * Fix people space notification badge not updating for new DM invites ([\#10849](https://github.com/matrix-org/matrix-react-sdk/pull/10849)). Fixes #23248.
 * Fix regression in emoji picker order mangling after clearing filter ([\#10854](https://github.com/matrix-org/matrix-react-sdk/pull/10854)). Fixes #25323.
 * Fix: Edit history modal crash ([\#10834](https://github.com/matrix-org/matrix-react-sdk/pull/10834)). Fixes #25309. Contributed by @kerryarchibald.
 * Fix long room address and name not being clipped on room info card and update `_RoomSummaryCard.pcss` ([\#10811](https://github.com/matrix-org/matrix-react-sdk/pull/10811)). Fixes #25293. Contributed by @luixxiul.
 * Treat thumbnail upload failures as complete upload failures ([\#10829](https://github.com/matrix-org/matrix-react-sdk/pull/10829)). Fixes #7069.
 * Update finite automata to match user identifiers as per spec ([\#10798](https://github.com/matrix-org/matrix-react-sdk/pull/10798)). Fixes #25246.
 * Fix icon on empty notification panel ([\#10817](https://github.com/matrix-org/matrix-react-sdk/pull/10817)). Fixes #25298 and #25302. Contributed by @luixxiul.
 * Fix: Threads button is highlighted when I create a new room ([\#10819](https://github.com/matrix-org/matrix-react-sdk/pull/10819)). Fixes #25284. Contributed by @kerryarchibald.
 * Fix the top heading of notification panel ([\#10818](https://github.com/matrix-org/matrix-react-sdk/pull/10818)). Fixes #25303. Contributed by @luixxiul.
 * Fix the color of the verified E2EE icon on `RoomSummaryCard` ([\#10812](https://github.com/matrix-org/matrix-react-sdk/pull/10812)). Fixes #25295. Contributed by @luixxiul.
 * Fix: No feedback when waiting for the server on a /delete_devices request with SSO ([\#10795](https://github.com/matrix-org/matrix-react-sdk/pull/10795)). Fixes #23096. Contributed by @kerryarchibald.
 * Fix: reveal images when image previews are disabled ([\#10781](https://github.com/matrix-org/matrix-react-sdk/pull/10781)). Fixes #25271. Contributed by @kerryarchibald.
 * Fix accessibility issues around the room list and space panel ([\#10717](https://github.com/matrix-org/matrix-react-sdk/pull/10717)). Fixes #13345.
 * Ensure tooltip contents is linked via aria to the target element ([\#10729](https://github.com/matrix-org/matrix-react-sdk/pull/10729)). Fixes vector-im/customer-retainer#43.

Changes in [1.11.31](https://github.com/vector-im/element-web/releases/tag/v1.11.31) (2023-05-10)
=================================================================================================

## ✨ Features
 * Improve Content-Security-Policy ([\#25210](https://github.com/vector-im/element-web/pull/25210)).
 * Add UIFeature.locationSharing to hide location sharing ([\#10727](https://github.com/matrix-org/matrix-react-sdk/pull/10727)).
 * Memoize field validation results ([\#10714](https://github.com/matrix-org/matrix-react-sdk/pull/10714)).
 * Commands for plain text editor ([\#10567](https://github.com/matrix-org/matrix-react-sdk/pull/10567)). Contributed by @alunturner.
 * Allow 16 lines of text in the rich text editors ([\#10670](https://github.com/matrix-org/matrix-react-sdk/pull/10670)). Contributed by @alunturner.
 * Bail out of `RoomSettingsDialog` when room is not found ([\#10662](https://github.com/matrix-org/matrix-react-sdk/pull/10662)). Contributed by @kerryarchibald.
 * Element-R: Populate device list for right-panel ([\#10671](https://github.com/matrix-org/matrix-react-sdk/pull/10671)). Contributed by @florianduros.
 * Make existing and new issue URLs configurable ([\#10710](https://github.com/matrix-org/matrix-react-sdk/pull/10710)). Fixes #24424.
 * Fix usages of ARIA tabpanel ([\#10628](https://github.com/matrix-org/matrix-react-sdk/pull/10628)). Fixes #25016.
 * Element-R: Starting a DMs with a user ([\#10673](https://github.com/matrix-org/matrix-react-sdk/pull/10673)). Contributed by @florianduros.
 * ARIA Accessibility improvements ([\#10675](https://github.com/matrix-org/matrix-react-sdk/pull/10675)).
 * ARIA Accessibility improvements ([\#10674](https://github.com/matrix-org/matrix-react-sdk/pull/10674)).
 * Add arrow key controls to emoji and reaction pickers ([\#10637](https://github.com/matrix-org/matrix-react-sdk/pull/10637)). Fixes #17189.
 * Translate credits in help about section ([\#10676](https://github.com/matrix-org/matrix-react-sdk/pull/10676)).

## 🐛 Bug Fixes
 * Fix: reveal images when image previews are disabled ([\#10781](https://github.com/matrix-org/matrix-react-sdk/pull/10781)). Fixes #25271. Contributed by @kerryarchibald.
 * Fix autocomplete not resetting properly on message send ([\#10741](https://github.com/matrix-org/matrix-react-sdk/pull/10741)). Fixes #25170.
 * Fix start_sso not working with guests disabled ([\#10720](https://github.com/matrix-org/matrix-react-sdk/pull/10720)). Fixes #16624.
 * Fix soft crash with Element call widgets ([\#10684](https://github.com/matrix-org/matrix-react-sdk/pull/10684)).
 * Send correct receipt when marking a room as read ([\#10730](https://github.com/matrix-org/matrix-react-sdk/pull/10730)). Fixes #25207.
 * Offload some more waveform processing onto a worker ([\#9223](https://github.com/matrix-org/matrix-react-sdk/pull/9223)). Fixes #19756.
 * Consolidate login errors ([\#10722](https://github.com/matrix-org/matrix-react-sdk/pull/10722)). Fixes #17520.
 * Fix all rooms search generating permalinks to wrong room id ([\#10625](https://github.com/matrix-org/matrix-react-sdk/pull/10625)). Fixes #25115.
 * Posthog properly handle Analytics ID changing from under us ([\#10702](https://github.com/matrix-org/matrix-react-sdk/pull/10702)). Fixes #25187.
 * Fix Clock being read as an absolute time rather than duration ([\#10706](https://github.com/matrix-org/matrix-react-sdk/pull/10706)). Fixes #22582.
 * Properly translate errors in `ChangePassword.tsx` so they show up translated to the user but not in our logs ([\#10615](https://github.com/matrix-org/matrix-react-sdk/pull/10615)). Fixes #9597. Contributed by @MadLittleMods.
 * Honour feature toggles in guest mode ([\#10651](https://github.com/matrix-org/matrix-react-sdk/pull/10651)). Fixes #24513. Contributed by @andybalaam.
 * Fix default content in devtools event sender ([\#10699](https://github.com/matrix-org/matrix-react-sdk/pull/10699)). Contributed by @tulir.
 * Fix a crash when a call ends while you're in it ([\#10681](https://github.com/matrix-org/matrix-react-sdk/pull/10681)). Fixes #25153.
 * Fix lack of screen reader indication when triggering auto complete ([\#10664](https://github.com/matrix-org/matrix-react-sdk/pull/10664)). Fixes #11011.
 * Fix typing tile duplicating users ([\#10678](https://github.com/matrix-org/matrix-react-sdk/pull/10678)). Fixes #25165.
 * Fix wrong room topic tooltip position ([\#10667](https://github.com/matrix-org/matrix-react-sdk/pull/10667)). Fixes #25158.
 * Fix create subspace dialog not working ([\#10652](https://github.com/matrix-org/matrix-react-sdk/pull/10652)). Fixes #24882.

Changes in [1.11.30](https://github.com/vector-im/element-web/releases/tag/v1.11.30) (2023-04-25)
=================================================================================================

## 🔒 Security
 * Fixes for [CVE-2023-30609](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-30609) / GHSA-xv83-x443-7rmw

## ✨ Features
 * Pick sensible default option for phone country dropdown ([\#10627](https://github.com/matrix-org/matrix-react-sdk/pull/10627)). Fixes #3528.
 * Relate field validation tooltip via aria-describedby ([\#10522](https://github.com/matrix-org/matrix-react-sdk/pull/10522)). Fixes #24963.
 * Handle more completion types in rte autocomplete ([\#10560](https://github.com/matrix-org/matrix-react-sdk/pull/10560)). Contributed by @alunturner.
 * Show a tile for an unloaded predecessor room if it has via_servers ([\#10483](https://github.com/matrix-org/matrix-react-sdk/pull/10483)). Contributed by @andybalaam.
 * Exclude message timestamps from aria live region ([\#10584](https://github.com/matrix-org/matrix-react-sdk/pull/10584)). Fixes #5696.
 * Make composer format bar an aria toolbar ([\#10583](https://github.com/matrix-org/matrix-react-sdk/pull/10583)). Fixes #11283.
 * Improve accessibility of font slider ([\#10473](https://github.com/matrix-org/matrix-react-sdk/pull/10473)). Fixes #20168 and #24962.
 * fix file size display from kB to KB ([\#10561](https://github.com/matrix-org/matrix-react-sdk/pull/10561)). Fixes #24866. Contributed by @NSV1991.
 * Handle /me in rte ([\#10558](https://github.com/matrix-org/matrix-react-sdk/pull/10558)). Contributed by @alunturner.
 * bind html with switch for manage extension setting option ([\#10553](https://github.com/matrix-org/matrix-react-sdk/pull/10553)). Contributed by @NSV1991.
 * Handle command completions in RTE ([\#10521](https://github.com/matrix-org/matrix-react-sdk/pull/10521)). Contributed by @alunturner.
 * Add room and user avatars to rte ([\#10497](https://github.com/matrix-org/matrix-react-sdk/pull/10497)). Contributed by @alunturner.
 * Support for MSC3882 revision 1 ([\#10443](https://github.com/matrix-org/matrix-react-sdk/pull/10443)). Contributed by @hughns.
 * Check profiles before starting a DM ([\#10472](https://github.com/matrix-org/matrix-react-sdk/pull/10472)). Fixes #24830.
 * Quick settings: Change the copy / labels on the options ([\#10427](https://github.com/matrix-org/matrix-react-sdk/pull/10427)). Fixes #24522. Contributed by @justjanne.
 * Update rte autocomplete styling ([\#10503](https://github.com/matrix-org/matrix-react-sdk/pull/10503)). Contributed by @alunturner.

## 🐛 Bug Fixes
 * Fix create subspace dialog not working ([\#10652](https://github.com/matrix-org/matrix-react-sdk/pull/10652)). Fixes vector-im/element-web#24882
 * Fix multiple accessibility defects identified by AXE ([\#10606](https://github.com/matrix-org/matrix-react-sdk/pull/10606)).
 * Fix view source from edit history dialog always showing latest event ([\#10626](https://github.com/matrix-org/matrix-react-sdk/pull/10626)). Fixes #21859.
 * #21451 Fix WebGL disabled error message ([\#10589](https://github.com/matrix-org/matrix-react-sdk/pull/10589)). Contributed by @rashmitpankhania.
 * Properly translate errors in `AddThreepid.ts` so they show up translated to the user but not in our logs ([\#10432](https://github.com/matrix-org/matrix-react-sdk/pull/10432)). Contributed by @MadLittleMods.
 * Fix overflow on auth pages ([\#10605](https://github.com/matrix-org/matrix-react-sdk/pull/10605)). Fixes #19548.
 * Fix incorrect avatar background colour when using a custom theme ([\#10598](https://github.com/matrix-org/matrix-react-sdk/pull/10598)). Contributed by @jdauphant.
 * Remove dependency on `org.matrix.e2e_cross_signing` unstable feature ([\#10593](https://github.com/matrix-org/matrix-react-sdk/pull/10593)).
 * Update setting description to match reality ([\#10600](https://github.com/matrix-org/matrix-react-sdk/pull/10600)). Fixes #25106.
 * Fix no identity server in help & about settings ([\#10563](https://github.com/matrix-org/matrix-react-sdk/pull/10563)). Fixes #25077.
 * Fix: Images no longer reserve their space in the timeline correctly ([\#10571](https://github.com/matrix-org/matrix-react-sdk/pull/10571)). Fixes #25082. Contributed by @kerryarchibald.
 * Fix issues with inhibited accessible focus outlines ([\#10579](https://github.com/matrix-org/matrix-react-sdk/pull/10579)). Fixes #19742.
 * Fix read receipts falling from sky ([\#10576](https://github.com/matrix-org/matrix-react-sdk/pull/10576)). Fixes #25081.
 * Fix avatar text issue in rte ([\#10559](https://github.com/matrix-org/matrix-react-sdk/pull/10559)). Contributed by @alunturner.
 * fix resizer only work with left mouse click ([\#10546](https://github.com/matrix-org/matrix-react-sdk/pull/10546)). Contributed by @NSV1991.
 * Fix send two join requests when joining a room from spotlight search ([\#10534](https://github.com/matrix-org/matrix-react-sdk/pull/10534)). Fixes #25054.
 * Highlight event when any version triggered a highlight ([\#10502](https://github.com/matrix-org/matrix-react-sdk/pull/10502)). Fixes #24923 and #24970. Contributed by @kerryarchibald.
 * Fix spacing of headings of integration manager on General settings tab ([\#10232](https://github.com/matrix-org/matrix-react-sdk/pull/10232)). Fixes #24085. Contributed by @luixxiul.

Changes in [1.11.29](https://github.com/vector-im/element-web/releases/tag/v1.11.29) (2023-04-11)
=================================================================================================

## ✨ Features
 * Allow desktop app to expose recent rooms in UI integrations ([\#16940](https://github.com/vector-im/element-web/pull/16940)).
 * Add API params to mute audio and/or video in Jitsi calls by default ([\#24820](https://github.com/vector-im/element-web/pull/24820)). Contributed by @dhenneke.
 * Style mentions as pills in rich text editor ([\#10448](https://github.com/matrix-org/matrix-react-sdk/pull/10448)). Contributed by @alunturner.
 * Show room create icon if "UIComponent.roomCreation" is enabled ([\#10364](https://github.com/matrix-org/matrix-react-sdk/pull/10364)). Contributed by @maheichyk.
 * Mentions as links rte ([\#10463](https://github.com/matrix-org/matrix-react-sdk/pull/10463)). Contributed by @alunturner.
 * Better error handling in jump to date ([\#10405](https://github.com/matrix-org/matrix-react-sdk/pull/10405)). Contributed by @MadLittleMods.
 * Show "Invite" menu option if "UIComponent.sendInvites" is enabled. ([\#10363](https://github.com/matrix-org/matrix-react-sdk/pull/10363)). Contributed by @maheichyk.
 * Added `UserProfilesStore`, `LruCache` and user permalink profile caching ([\#10425](https://github.com/matrix-org/matrix-react-sdk/pull/10425)). Fixes #10559.
 * Mentions as links rte ([\#10422](https://github.com/matrix-org/matrix-react-sdk/pull/10422)). Contributed by @alunturner.
 * Implement MSC3952: intentional mentions ([\#9983](https://github.com/matrix-org/matrix-react-sdk/pull/9983)).
 * Implement MSC3973: Search users in the user directory with the Widget API ([\#10269](https://github.com/matrix-org/matrix-react-sdk/pull/10269)). Contributed by @dhenneke.
 * Permalinks to message are now displayed as pills ([\#10392](https://github.com/matrix-org/matrix-react-sdk/pull/10392)). Fixes #24751 and #24706.
 * Show search,dial,explore in filterContainer if "UIComponent.filterContainer" is enabled ([\#10381](https://github.com/matrix-org/matrix-react-sdk/pull/10381)). Contributed by @maheichyk.
 * Increase space panel collapse clickable area ([\#6084](https://github.com/matrix-org/matrix-react-sdk/pull/6084)). Fixes #17379. Contributed by @jaiwanth-v.
 * Add fallback for replies to Polls ([\#10380](https://github.com/matrix-org/matrix-react-sdk/pull/10380)). Fixes #24197. Contributed by @kerryarchibald.
 * Permalinks to rooms and users are now pillified ([\#10388](https://github.com/matrix-org/matrix-react-sdk/pull/10388)). Fixes #24825.
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
 * Use a newly generated access_token while joining Jitsi ([\#24646](https://github.com/vector-im/element-web/pull/24646)). Fixes #24687. Contributed by @emrahcom.
 * Fix cloudflare action pointing at commit hash instead of tag ([\#24777](https://github.com/vector-im/element-web/pull/24777)). Contributed by @justjanne.
 * Allow editing with RTE to overflow for autocomplete visibility ([\#10499](https://github.com/matrix-org/matrix-react-sdk/pull/10499)). Contributed by @alunturner.
 * Added auto focus to Github URL on opening of debug logs modal ([\#10479](https://github.com/matrix-org/matrix-react-sdk/pull/10479)). Contributed by @ShivamSpm.
 * Fix detection of encryption for all users in a room ([\#10487](https://github.com/matrix-org/matrix-react-sdk/pull/10487)). Fixes #24995.
 * Properly generate mentions when editing a reply with MSC3952 ([\#10486](https://github.com/matrix-org/matrix-react-sdk/pull/10486)). Fixes #24924. Contributed by @kerryarchibald.
 * Improve performance of rendering a room with many hidden events ([\#10131](https://github.com/matrix-org/matrix-react-sdk/pull/10131)). Contributed by @andybalaam.
 * Prevent future date selection in jump to date ([\#10419](https://github.com/matrix-org/matrix-react-sdk/pull/10419)). Fixes #20800. Contributed by @MadLittleMods.
 * Add aria labels to message search bar to improve accessibility ([\#10476](https://github.com/matrix-org/matrix-react-sdk/pull/10476)). Fixes #24921.
 * Fix decryption failure bar covering the timeline ([\#10360](https://github.com/matrix-org/matrix-react-sdk/pull/10360)). Fixes #24780 #24074 and #24183. Contributed by @luixxiul.
 * Improve profile picture settings accessibility ([\#10470](https://github.com/matrix-org/matrix-react-sdk/pull/10470)). Fixes #24919.
 * Handle group call redaction ([\#10465](https://github.com/matrix-org/matrix-react-sdk/pull/10465)).
 * Display relative timestamp for threads on the same calendar day ([\#10399](https://github.com/matrix-org/matrix-react-sdk/pull/10399)). Fixes #24841. Contributed by @kerryarchibald.
 * Fix timeline list and paragraph display issues ([\#10424](https://github.com/matrix-org/matrix-react-sdk/pull/10424)). Fixes #24602. Contributed by @alunturner.
 * Use unique keys for voice broadcast pips ([\#10457](https://github.com/matrix-org/matrix-react-sdk/pull/10457)). Fixes #24959.
 * Fix "show read receipts sent by other users" not applying to threads ([\#10445](https://github.com/matrix-org/matrix-react-sdk/pull/10445)). Fixes #24910.
 * Fix joining public rooms without aliases in search dialog ([\#10437](https://github.com/matrix-org/matrix-react-sdk/pull/10437)). Fixes #23937.
 * Add input validation for `m.direct` in `DMRoomMap` ([\#10436](https://github.com/matrix-org/matrix-react-sdk/pull/10436)). Fixes #24909.
 * Reduce height reserved for "collapse" button's line on IRC layout ([\#10211](https://github.com/matrix-org/matrix-react-sdk/pull/10211)). Fixes #24605. Contributed by @luixxiul.
 * Fix `creatorUserId is required` error when opening sticker picker ([\#10423](https://github.com/matrix-org/matrix-react-sdk/pull/10423)).
 * Fix block/inline Element descendants error noise in `NewRoomIntro.tsx` ([\#10412](https://github.com/matrix-org/matrix-react-sdk/pull/10412)). Contributed by @MadLittleMods.
 * Fix profile resizer to make first character of a line selectable in IRC layout ([\#10396](https://github.com/matrix-org/matrix-react-sdk/pull/10396)). Fixes #14764. Contributed by @luixxiul.
 * Ensure space between wrapped lines of room name on IRC layout ([\#10188](https://github.com/matrix-org/matrix-react-sdk/pull/10188)). Fixes #24742. Contributed by @luixxiul.
 * Remove unreadable alt attribute from the room status bar warning icon (nonsense to screenreaders) ([\#10402](https://github.com/matrix-org/matrix-react-sdk/pull/10402)). Contributed by @MadLittleMods.
 * Fix big date separators when jump to date is enabled ([\#10404](https://github.com/matrix-org/matrix-react-sdk/pull/10404)). Fixes #22969. Contributed by @MadLittleMods.
 * Fixes user authentication when registering via the module API ([\#10257](https://github.com/matrix-org/matrix-react-sdk/pull/10257)). Contributed by @maheichyk.
 * Handle more edge cases in Space Hierarchy ([\#10280](https://github.com/matrix-org/matrix-react-sdk/pull/10280)). Contributed by @justjanne.
 * Further improve performance with lots of hidden events ([\#10353](https://github.com/matrix-org/matrix-react-sdk/pull/10353)). Fixes #24480. Contributed by @andybalaam.
 * Respect user cancelling upload flow by dismissing spinner ([\#10373](https://github.com/matrix-org/matrix-react-sdk/pull/10373)). Fixes #24667.
 * When starting a DM, the end-to-end encryption status icon does now only appear if the DM can be encrypted ([\#10394](https://github.com/matrix-org/matrix-react-sdk/pull/10394)). Fixes #24397.
 * Fix `[object Object]` in feedback metadata ([\#10390](https://github.com/matrix-org/matrix-react-sdk/pull/10390)).
 * Fix pinned messages card saying nothing pinned while loading ([\#10385](https://github.com/matrix-org/matrix-react-sdk/pull/10385)). Fixes #24615.
 * Fix import e2e key dialog staying disabled after paste ([\#10375](https://github.com/matrix-org/matrix-react-sdk/pull/10375)). Fixes #24818.
 * Show all labs even if incompatible, with appropriate tooltip explaining requirements ([\#10369](https://github.com/matrix-org/matrix-react-sdk/pull/10369)). Fixes #24813.
 * Fix UIFeature.Registration not applying to all paths ([\#10371](https://github.com/matrix-org/matrix-react-sdk/pull/10371)). Fixes #24814.
 * Clicking on a user pill does now only open the profile in the right panel and no longer navigates to the home view. ([\#10359](https://github.com/matrix-org/matrix-react-sdk/pull/10359)). Fixes #24797.
 * Fix start DM with pending third party invite ([\#10347](https://github.com/matrix-org/matrix-react-sdk/pull/10347)). Fixes #24781.
 * Fix long display name overflowing reply tile on IRC layout ([\#10343](https://github.com/matrix-org/matrix-react-sdk/pull/10343)). Fixes #24738. Contributed by @luixxiul.
 * Display redacted body on ThreadView in the same way as normal messages ([\#9016](https://github.com/matrix-org/matrix-react-sdk/pull/9016)). Fixes #24729. Contributed by @luixxiul.
 * Handle more edge cases in ACL updates ([\#10279](https://github.com/matrix-org/matrix-react-sdk/pull/10279)). Contributed by @justjanne.
 * Allow parsing png files to fail if thumbnailing is successful ([\#10308](https://github.com/matrix-org/matrix-react-sdk/pull/10308)).

Changes in [1.11.28](https://github.com/vector-im/element-web/releases/tag/v1.11.28) (2023-03-31)
=================================================================================================

## 🐛 Bug Fixes
 * (No changes, version bumped to sync with element-desktop.)

Changes in [1.11.27](https://github.com/vector-im/element-web/releases/tag/v1.11.27) (2023-03-31)
=================================================================================================

## 🐛 Bug Fixes
 * Fix detection of encryption for all users in a room ([\#10487](https://github.com/matrix-org/matrix-react-sdk/pull/10487)). Fixes #24995.

Changes in [1.11.26](https://github.com/vector-im/element-web/releases/tag/v1.11.26) (2023-03-28)
=================================================================================================

## 🔒 Security
 * Fixes for [CVE-2023-28427](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-28427) / GHSA-mwq8-fjpf-c2gr
 * Fixes for [CVE-2023-28103](https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=CVE-2023-28103) / GHSA-6g43-88cp-w5gv

Changes in [1.11.25](https://github.com/vector-im/element-web/releases/tag/v1.11.25) (2023-03-15)
=================================================================================================

## ✨ Features
 * Remove experimental PWA support for Firefox and Safari ([\#24630](https://github.com/vector-im/element-web/pull/24630)).
 * Only allow to start a DM with one email if encryption by default is enabled ([\#10253](https://github.com/matrix-org/matrix-react-sdk/pull/10253)). Fixes #23133.
 * DM rooms are now encrypted if encryption by default is enabled and only inviting a single email address. Any action in the result DM room will be blocked until the other has joined. ([\#10229](https://github.com/matrix-org/matrix-react-sdk/pull/10229)).
 * Reduce bottom margin of ReplyChain on compact modern layout ([\#8972](https://github.com/matrix-org/matrix-react-sdk/pull/8972)). Fixes #22748. Contributed by @luixxiul.
 * Support for v2 of MSC3903 ([\#10165](https://github.com/matrix-org/matrix-react-sdk/pull/10165)). Contributed by @hughns.
 * When starting a DM, existing rooms with pending third-party invites will be reused. ([\#10256](https://github.com/matrix-org/matrix-react-sdk/pull/10256)). Fixes #23139.
 * Polls push rules: synchronise poll rules with message rules ([\#10263](https://github.com/matrix-org/matrix-react-sdk/pull/10263)). Contributed by @kerryarchibald.
 * New verification request toast button labels ([\#10259](https://github.com/matrix-org/matrix-react-sdk/pull/10259)).
 * Remove padding around integration manager iframe ([\#10148](https://github.com/matrix-org/matrix-react-sdk/pull/10148)).
 * Fix block code styling in rich text editor ([\#10246](https://github.com/matrix-org/matrix-react-sdk/pull/10246)). Contributed by @alunturner.
 * Poll history: fetch more poll history ([\#10235](https://github.com/matrix-org/matrix-react-sdk/pull/10235)). Contributed by @kerryarchibald.
 * Sort short/exact emoji matches before longer incomplete matches ([\#10212](https://github.com/matrix-org/matrix-react-sdk/pull/10212)). Fixes #23210. Contributed by @grimhilt.
 * Poll history: detail screen ([\#10172](https://github.com/matrix-org/matrix-react-sdk/pull/10172)). Contributed by @kerryarchibald.
 * Provide a more detailed error message than "No known servers" ([\#6048](https://github.com/matrix-org/matrix-react-sdk/pull/6048)). Fixes #13247. Contributed by @aaronraimist.
 * Say when a call was answered from a different device ([\#10224](https://github.com/matrix-org/matrix-react-sdk/pull/10224)).
 * Widget permissions customizations using module api ([\#10121](https://github.com/matrix-org/matrix-react-sdk/pull/10121)). Contributed by @maheichyk.
 * Fix copy button icon overlapping with copyable text ([\#10227](https://github.com/matrix-org/matrix-react-sdk/pull/10227)). Contributed by @Adesh-Pandey.
 * Support joining non-peekable rooms via the module API ([\#10154](https://github.com/matrix-org/matrix-react-sdk/pull/10154)). Contributed by @maheichyk.
 * The "new login" toast does now display the same device information as in the settings. "No" does now open the device settings. "Yes, it was me" dismisses the toast. ([\#10200](https://github.com/matrix-org/matrix-react-sdk/pull/10200)).
 * Do not prompt for a password when doing a „reset all“ after login ([\#10208](https://github.com/matrix-org/matrix-react-sdk/pull/10208)).

## 🐛 Bug Fixes
 * Fix incorrect copy in space creation flow ([\#10296](https://github.com/matrix-org/matrix-react-sdk/pull/10296)). Fixes #24741.
 * Fix space settings dialog having rogue title tooltip ([\#10293](https://github.com/matrix-org/matrix-react-sdk/pull/10293)). Fixes #24740.
 * Show spinner when starting a DM from the user profile (right panel) ([\#10290](https://github.com/matrix-org/matrix-react-sdk/pull/10290)).
 * Reduce height of toggle on expanded view source event ([\#10283](https://github.com/matrix-org/matrix-react-sdk/pull/10283)). Fixes #22873. Contributed by @luixxiul.
 * Pillify http and non-prefixed matrix.to links ([\#10277](https://github.com/matrix-org/matrix-react-sdk/pull/10277)). Fixes #20844.
 * Fix some features not being configurable via `features` ([\#10276](https://github.com/matrix-org/matrix-react-sdk/pull/10276)).
 * Fix starting a DM from the right panel in some cases ([\#10278](https://github.com/matrix-org/matrix-react-sdk/pull/10278)). Fixes #24722.
 * Align info EventTile and normal EventTile on IRC layout ([\#10197](https://github.com/matrix-org/matrix-react-sdk/pull/10197)). Fixes #22782. Contributed by @luixxiul.
 * Fix blowout of waveform of the voice message player on narrow UI ([\#8861](https://github.com/matrix-org/matrix-react-sdk/pull/8861)). Fixes #22604. Contributed by @luixxiul.
 * Fix the hidden view source toggle on IRC layout ([\#10266](https://github.com/matrix-org/matrix-react-sdk/pull/10266)). Fixes #22872. Contributed by @luixxiul.
 * Fix buttons on the room header being compressed due to long room name ([\#10155](https://github.com/matrix-org/matrix-react-sdk/pull/10155)). Contributed by @luixxiul.
 * Use the room avatar as a placeholder in calls ([\#10231](https://github.com/matrix-org/matrix-react-sdk/pull/10231)).
 * Fix calls showing as 'connecting' after hangup ([\#10223](https://github.com/matrix-org/matrix-react-sdk/pull/10223)).
 * Prevent multiple Jitsi calls started at the same time ([\#10183](https://github.com/matrix-org/matrix-react-sdk/pull/10183)). Fixes #23009.
 * Make localization keys compatible with agglutinative and/or SOV type languages ([\#10159](https://github.com/matrix-org/matrix-react-sdk/pull/10159)). Contributed by @luixxiul.

Changes in [1.11.24](https://github.com/vector-im/element-web/releases/tag/v1.11.24) (2023-02-28)
=================================================================================================

## ✨ Features
 * Display "The sender has blocked you from receiving this message" error message instead of "Unable to decrypt message" ([\#10202](https://github.com/matrix-org/matrix-react-sdk/pull/10202)). Contributed by @florianduros.
 * Polls: show warning about undecryptable relations ([\#10179](https://github.com/matrix-org/matrix-react-sdk/pull/10179)). Contributed by @kerryarchibald.
 * Poll history: fetch last 30 days of polls ([\#10157](https://github.com/matrix-org/matrix-react-sdk/pull/10157)). Contributed by @kerryarchibald.
 * Poll history - ended polls list items ([\#10119](https://github.com/matrix-org/matrix-react-sdk/pull/10119)). Contributed by @kerryarchibald.
 * Remove threads labs flag and the ability to disable threads ([\#9878](https://github.com/matrix-org/matrix-react-sdk/pull/9878)). Fixes #24365.
 * Show a success dialog after setting up the key backup ([\#10177](https://github.com/matrix-org/matrix-react-sdk/pull/10177)). Fixes #24487.
 * Release Sign in with QR out of labs ([\#10182](https://github.com/matrix-org/matrix-react-sdk/pull/10182)). Contributed by @hughns.
 * Hide indent button in rte ([\#10149](https://github.com/matrix-org/matrix-react-sdk/pull/10149)). Contributed by @alunturner.
 * Add option to find own location in map views ([\#10083](https://github.com/matrix-org/matrix-react-sdk/pull/10083)).
 * Render poll end events in timeline ([\#10027](https://github.com/matrix-org/matrix-react-sdk/pull/10027)). Contributed by @kerryarchibald.

## 🐛 Bug Fixes
 * Stop access token overflowing the box ([\#10069](https://github.com/matrix-org/matrix-react-sdk/pull/10069)). Fixes #24023. Contributed by @sbjaj33.
 * Add link to next file in the export ([\#10190](https://github.com/matrix-org/matrix-react-sdk/pull/10190)). Fixes #20272. Contributed by @grimhilt.
 * Ended poll tiles: add ended the poll message ([\#10193](https://github.com/matrix-org/matrix-react-sdk/pull/10193)). Fixes #24579. Contributed by @kerryarchibald.
 * Fix accidentally inverted condition for room ordering ([\#10178](https://github.com/matrix-org/matrix-react-sdk/pull/10178)). Fixes #24527. Contributed by @justjanne.
 * Re-focus the composer on dialogue quit ([\#10007](https://github.com/matrix-org/matrix-react-sdk/pull/10007)). Fixes #22832. Contributed by @Ashu999.
 * Try to resolve emails before creating a DM ([\#10164](https://github.com/matrix-org/matrix-react-sdk/pull/10164)).
 * Disable poll response loading test ([\#10168](https://github.com/matrix-org/matrix-react-sdk/pull/10168)). Contributed by @justjanne.
 * Fix email lookup in invite dialog ([\#10150](https://github.com/matrix-org/matrix-react-sdk/pull/10150)). Fixes #23353.
 * Remove duplicate white space characters from translation keys ([\#10152](https://github.com/matrix-org/matrix-react-sdk/pull/10152)). Contributed by @luixxiul.
 * Fix the caption of new sessions manager on Labs settings page for localization ([\#10143](https://github.com/matrix-org/matrix-react-sdk/pull/10143)). Contributed by @luixxiul.
 * Prevent start another DM with a user if one already exists ([\#10127](https://github.com/matrix-org/matrix-react-sdk/pull/10127)). Fixes #23138.
 * Remove white space characters before the horizontal ellipsis ([\#10130](https://github.com/matrix-org/matrix-react-sdk/pull/10130)). Contributed by @luixxiul.
 * Fix Selectable Text on 'Delete All' and 'Retry All' Buttons ([\#10128](https://github.com/matrix-org/matrix-react-sdk/pull/10128)). Fixes #23232. Contributed by @akshattchhabra.
 * Correctly Identify emoticons ([\#10108](https://github.com/matrix-org/matrix-react-sdk/pull/10108)). Fixes #19472. Contributed by @adarsh-sgh.
 * Remove a redundant white space ([\#10129](https://github.com/matrix-org/matrix-react-sdk/pull/10129)). Contributed by @luixxiul.

Changes in [1.11.23](https://github.com/vector-im/element-web/releases/tag/v1.11.23) (2023-02-14)
=================================================================================================

## ✨ Features
 * Description of QR code sign in labs feature ([\#23513](https://github.com/vector-im/element-web/pull/23513)). Contributed by @hughns.
 * Add option to find own location in map views ([\#10083](https://github.com/matrix-org/matrix-react-sdk/pull/10083)).
 * Render poll end events in timeline ([\#10027](https://github.com/matrix-org/matrix-react-sdk/pull/10027)). Contributed by @kerryarchibald.
 * Indicate unread messages in tab title ([\#10096](https://github.com/matrix-org/matrix-react-sdk/pull/10096)). Contributed by @tnt7864.
 * Open message in editing mode when keyboard up is pressed (RTE) ([\#10079](https://github.com/matrix-org/matrix-react-sdk/pull/10079)). Contributed by @florianduros.
 * Hide superseded rooms from the room list using dynamic room predecessors ([\#10068](https://github.com/matrix-org/matrix-react-sdk/pull/10068)). Contributed by @andybalaam.
 * Support MSC3946 in RoomListStore ([\#10054](https://github.com/matrix-org/matrix-react-sdk/pull/10054)). Fixes #24325. Contributed by @andybalaam.
 * Auto focus security key field ([\#10048](https://github.com/matrix-org/matrix-react-sdk/pull/10048)).
 * use Poll model with relations API in poll rendering ([\#9877](https://github.com/matrix-org/matrix-react-sdk/pull/9877)). Contributed by @kerryarchibald.
 * Support MSC3946 in the RoomCreate tile ([\#10041](https://github.com/matrix-org/matrix-react-sdk/pull/10041)). Fixes #24323. Contributed by @andybalaam.
 * Update labs flag description for RTE ([\#10058](https://github.com/matrix-org/matrix-react-sdk/pull/10058)). Contributed by @florianduros.
 * Change ul list style to disc when editing message ([\#10043](https://github.com/matrix-org/matrix-react-sdk/pull/10043)). Contributed by @alunturner.
 * Improved click detection within PiP windows ([\#10040](https://github.com/matrix-org/matrix-react-sdk/pull/10040)). Fixes #24371.
 * Add RTE keyboard navigation in editing ([\#9980](https://github.com/matrix-org/matrix-react-sdk/pull/9980)). Fixes #23621. Contributed by @florianduros.
 * Paragraph integration for rich text editor ([\#10008](https://github.com/matrix-org/matrix-react-sdk/pull/10008)). Contributed by @alunturner.
 * Add  indentation increasing/decreasing to RTE ([\#10034](https://github.com/matrix-org/matrix-react-sdk/pull/10034)). Contributed by @florianduros.
 * Add ignore user confirmation dialog ([\#6116](https://github.com/matrix-org/matrix-react-sdk/pull/6116)). Fixes #14746.
 * Use monospace font for room, message IDs in View Source modal ([\#9956](https://github.com/matrix-org/matrix-react-sdk/pull/9956)). Fixes #21937. Contributed by @paragpoddar.
 * Implement MSC3946 for AdvancedRoomSettingsTab ([\#9995](https://github.com/matrix-org/matrix-react-sdk/pull/9995)). Fixes #24322. Contributed by @andybalaam.
 * Implementation of MSC3824 to make the client OIDC-aware ([\#8681](https://github.com/matrix-org/matrix-react-sdk/pull/8681)). Contributed by @hughns.
 * Improves a11y for avatar uploads ([\#9985](https://github.com/matrix-org/matrix-react-sdk/pull/9985)). Contributed by @GoodGuyMarco.
 * Add support for [token authenticated registration](https ([\#7275](https://github.com/matrix-org/matrix-react-sdk/pull/7275)). Fixes #18931. Contributed by @govynnus.

## 🐛 Bug Fixes
 * Jitsi requests 'requires_client' capability if auth token is provided ([\#24294](https://github.com/vector-im/element-web/pull/24294)). Contributed by @maheichyk.
 * Remove duplicate white space characters from translation keys ([\#10152](https://github.com/matrix-org/matrix-react-sdk/pull/10152)). Contributed by @luixxiul.
 * Fix the caption of new sessions manager on Labs settings page for localization ([\#10143](https://github.com/matrix-org/matrix-react-sdk/pull/10143)). Contributed by @luixxiul.
 * Prevent start another DM with a user if one already exists ([\#10127](https://github.com/matrix-org/matrix-react-sdk/pull/10127)). Fixes #23138.
 * Remove white space characters before the horizontal ellipsis ([\#10130](https://github.com/matrix-org/matrix-react-sdk/pull/10130)). Contributed by @luixxiul.
 * Fix Selectable Text on 'Delete All' and 'Retry All' Buttons ([\#10128](https://github.com/matrix-org/matrix-react-sdk/pull/10128)). Fixes #23232. Contributed by @akshattchhabra.
 * Correctly Identify emoticons ([\#10108](https://github.com/matrix-org/matrix-react-sdk/pull/10108)). Fixes #19472. Contributed by @adarsh-sgh.
 * Should open new 1:1 chat room after leaving the old one ([\#9880](https://github.com/matrix-org/matrix-react-sdk/pull/9880)). Contributed by @ahmadkadri.
 * Remove a redundant white space ([\#10129](https://github.com/matrix-org/matrix-react-sdk/pull/10129)). Contributed by @luixxiul.
 * Fix a crash when removing persistent widgets (updated) ([\#10099](https://github.com/matrix-org/matrix-react-sdk/pull/10099)). Fixes #24412. Contributed by @andybalaam.
 * Fix wrongly grouping 3pid invites into a single repeated transition ([\#10087](https://github.com/matrix-org/matrix-react-sdk/pull/10087)). Fixes #24432.
 * Fix scrollbar colliding with checkbox in add to space section ([\#10093](https://github.com/matrix-org/matrix-react-sdk/pull/10093)). Fixes #23189. Contributed by @Arnabdaz.
 * Add a whitespace character after 'broadcast?' ([\#10097](https://github.com/matrix-org/matrix-react-sdk/pull/10097)). Contributed by @luixxiul.
 * Seekbar in broadcast PiP view is now updated when switching between different broadcasts ([\#10072](https://github.com/matrix-org/matrix-react-sdk/pull/10072)). Fixes #24415.
 * Add border to "reject" button on room preview card for clickable area indication. It fixes vector-im/element-web#22623 ([\#9205](https://github.com/matrix-org/matrix-react-sdk/pull/9205)). Contributed by @gefgu.
 * Element-R: fix rageshages ([\#10081](https://github.com/matrix-org/matrix-react-sdk/pull/10081)). Fixes #24430.
 * Fix markdown paragraph display in timeline ([\#10071](https://github.com/matrix-org/matrix-react-sdk/pull/10071)). Fixes #24419. Contributed by @alunturner.
 * Prevent the remaining broadcast time from being exceeded ([\#10070](https://github.com/matrix-org/matrix-react-sdk/pull/10070)).
 * Fix cursor position when new line is created by pressing enter (RTE) ([\#10064](https://github.com/matrix-org/matrix-react-sdk/pull/10064)). Contributed by @florianduros.
 * Ensure room is actually in space hierarchy when resolving its latest version ([\#10010](https://github.com/matrix-org/matrix-react-sdk/pull/10010)).
 * Fix new line for inline code ([\#10062](https://github.com/matrix-org/matrix-react-sdk/pull/10062)). Contributed by @florianduros.
 * Member avatars without canvas ([\#9990](https://github.com/matrix-org/matrix-react-sdk/pull/9990)). Contributed by @clarkf.
 * Apply more general fix for base avatar regressions ([\#10045](https://github.com/matrix-org/matrix-react-sdk/pull/10045)). Fixes #24382 and #24370.
 * Replace list, code block and quote icons by new icons ([\#10035](https://github.com/matrix-org/matrix-react-sdk/pull/10035)). Contributed by @florianduros.
 * fix regional emojis converted to flags ([\#9294](https://github.com/matrix-org/matrix-react-sdk/pull/9294)). Fixes #19000. Contributed by @grimhilt.
 * resolved emoji description text overflowing issue ([\#10028](https://github.com/matrix-org/matrix-react-sdk/pull/10028)). Contributed by @fahadNoufal.
 * Fix MessageEditHistoryDialog crashing on complex input ([\#10018](https://github.com/matrix-org/matrix-react-sdk/pull/10018)). Fixes #23665. Contributed by @clarkf.
 * Unify unread notification state determination ([\#9941](https://github.com/matrix-org/matrix-react-sdk/pull/9941)). Contributed by @clarkf.
 * Fix layout and visual regressions around default avatars ([\#10031](https://github.com/matrix-org/matrix-react-sdk/pull/10031)). Fixes #24375 and #24369.
 * Fix useUnreadNotifications exploding with falsey room, like in notif panel ([\#10030](https://github.com/matrix-org/matrix-react-sdk/pull/10030)). Fixes matrix-org/element-web-rageshakes#19334.
 * Fix "[object Promise]" appearing in HTML exports ([\#9975](https://github.com/matrix-org/matrix-react-sdk/pull/9975)). Fixes #24272. Contributed by @clarkf.
 * changing the color of message time stamp ([\#10016](https://github.com/matrix-org/matrix-react-sdk/pull/10016)). Contributed by @nawarajshah.
 * Fix link creation with backward selection ([\#9986](https://github.com/matrix-org/matrix-react-sdk/pull/9986)). Fixes #24315. Contributed by @florianduros.
 * Misaligned reply preview in thread composer #23396 ([\#9977](https://github.com/matrix-org/matrix-react-sdk/pull/9977)). Fixes #23396. Contributed by @mustafa-kapadia1483.

Changes in [1.11.22](https://github.com/vector-im/element-web/releases/tag/v1.11.22) (2023-01-31)
=================================================================================================

## 🐛 Bug Fixes
 * Bump version number to fix problems upgrading from v1.11.21-rc.1

Changes in [1.11.21](https://github.com/vector-im/element-web/releases/tag/v1.11.21) (2023-01-31)
=================================================================================================

## ✨ Features
 * Move pin drop out of labs ([\#22993](https://github.com/vector-im/element-web/pull/22993)).
 * Quotes for rich text editor (RTE) ([\#9932](https://github.com/matrix-org/matrix-react-sdk/pull/9932)). Contributed by @alunturner.
 * Show the room name in the room header during calls ([\#9942](https://github.com/matrix-org/matrix-react-sdk/pull/9942)). Fixes #24268.
 * Add code blocks to rich text editor ([\#9921](https://github.com/matrix-org/matrix-react-sdk/pull/9921)). Contributed by @alunturner.
 * Add new style for inline code ([\#9936](https://github.com/matrix-org/matrix-react-sdk/pull/9936)). Contributed by @florianduros.
 * Add disabled button state to rich text editor ([\#9930](https://github.com/matrix-org/matrix-react-sdk/pull/9930)). Contributed by @alunturner.
 * Change the rageshake "app" for auto-rageshakes ([\#9909](https://github.com/matrix-org/matrix-react-sdk/pull/9909)).
 * Device manager - tweak settings display ([\#9905](https://github.com/matrix-org/matrix-react-sdk/pull/9905)). Contributed by @kerryarchibald.
 * Add list functionality to rich text editor ([\#9871](https://github.com/matrix-org/matrix-react-sdk/pull/9871)). Contributed by @alunturner.

## 🐛 Bug Fixes
 * Fix RTE focus behaviour in threads ([\#9969](https://github.com/matrix-org/matrix-react-sdk/pull/9969)). Fixes #23755. Contributed by @florianduros.
 * #22204 Issue: Centered File info in lightbox ([\#9971](https://github.com/matrix-org/matrix-react-sdk/pull/9971)). Fixes #22204. Contributed by @Spartan09.
 * Fix seekbar position for zero length audio ([\#9949](https://github.com/matrix-org/matrix-react-sdk/pull/9949)). Fixes #24248.
 * Allow thread panel to be closed after being opened from notification ([\#9937](https://github.com/matrix-org/matrix-react-sdk/pull/9937)). Fixes #23764 #23852 and #24213. Contributed by @justjanne.
 * Only highlight focused menu item if focus is supposed to be visible ([\#9945](https://github.com/matrix-org/matrix-react-sdk/pull/9945)). Fixes #23582.
 * Prevent call durations from breaking onto multiple lines ([\#9944](https://github.com/matrix-org/matrix-react-sdk/pull/9944)).
 * Tweak call lobby buttons to more closely match designs ([\#9943](https://github.com/matrix-org/matrix-react-sdk/pull/9943)).
 * Do not show a broadcast as live immediately after the recording has stopped ([\#9947](https://github.com/matrix-org/matrix-react-sdk/pull/9947)). Fixes #24233.
 * Clear the RTE before sending a message ([\#9948](https://github.com/matrix-org/matrix-react-sdk/pull/9948)). Contributed by @florianduros.
 * Fix {enter} press in RTE ([\#9927](https://github.com/matrix-org/matrix-react-sdk/pull/9927)). Contributed by @florianduros.
 * Fix the problem that the password reset email has to be confirmed twice ([\#9926](https://github.com/matrix-org/matrix-react-sdk/pull/9926)). Fixes #24226.
 * replace .at() with array.length-1 ([\#9933](https://github.com/matrix-org/matrix-react-sdk/pull/9933)). Fixes matrix-org/element-web-rageshakes#19281.
 * Fix broken threads list timestamp layout ([\#9922](https://github.com/matrix-org/matrix-react-sdk/pull/9922)). Fixes #24243 and #24191. Contributed by @justjanne.
 * Disable multiple messages when {enter} is pressed multiple times ([\#9929](https://github.com/matrix-org/matrix-react-sdk/pull/9929)). Fixes #24249. Contributed by @florianduros.
 * Fix logout devices when resetting the password ([\#9925](https://github.com/matrix-org/matrix-react-sdk/pull/9925)). Fixes #24228.
 * Fix: Poll replies overflow when not enough space ([\#9924](https://github.com/matrix-org/matrix-react-sdk/pull/9924)). Fixes #24227. Contributed by @kerryarchibald.
 * State event updates are not forwarded to the widget from invitation room ([\#9802](https://github.com/matrix-org/matrix-react-sdk/pull/9802)). Contributed by @maheichyk.
 * Fix error when viewing source of redacted events ([\#9914](https://github.com/matrix-org/matrix-react-sdk/pull/9914)). Fixes #24165. Contributed by @clarkf.
 * Replace outdated css attribute ([\#9912](https://github.com/matrix-org/matrix-react-sdk/pull/9912)). Fixes #24218. Contributed by @justjanne.
 * Clear isLogin theme override when user is no longer viewing login screens ([\#9911](https://github.com/matrix-org/matrix-react-sdk/pull/9911)). Fixes #23893.
 * Fix reply action in message context menu notif & file panels ([\#9895](https://github.com/matrix-org/matrix-react-sdk/pull/9895)). Fixes #23970.
 * Fix issue where thread dropdown would not show up correctly ([\#9872](https://github.com/matrix-org/matrix-react-sdk/pull/9872)). Fixes #24040. Contributed by @justjanne.
 * Fix unexpected composer growing ([\#9889](https://github.com/matrix-org/matrix-react-sdk/pull/9889)). Contributed by @florianduros.
 * Fix misaligned timestamps for thread roots which are emotes ([\#9875](https://github.com/matrix-org/matrix-react-sdk/pull/9875)). Fixes #23897. Contributed by @justjanne.

Changes in [1.11.20](https://github.com/vector-im/element-web/releases/tag/v1.11.20) (2023-01-20)
=================================================================================================

## 🐛 Bug Fixes
 * (Part 2) of prevent crash on older browsers (replace .at() with array.length-1)

Changes in [1.11.19](https://github.com/vector-im/element-web/releases/tag/v1.11.19) (2023-01-18)
=================================================================================================

## 🐛 Bug Fixes
 * fix crash on browsers that don't support `Array.at` ([\#9935](https://github.com/matrix-org/matrix-react-sdk/pull/9935)). Contributed by @andybalaam.

Changes in [1.11.18](https://github.com/vector-im/element-web/releases/tag/v1.11.18) (2023-01-18)
=================================================================================================

## ✨ Features
 * Switch threads on for everyone ([\#9879](https://github.com/matrix-org/matrix-react-sdk/pull/9879)).
 * Make threads use new Unable to Decrypt UI ([\#9876](https://github.com/matrix-org/matrix-react-sdk/pull/9876)). Fixes #24060.
 * Add edit and remove actions to link in RTE [Labs] ([\#9864](https://github.com/matrix-org/matrix-react-sdk/pull/9864)).
 * Remove extensible events v1 experimental rendering ([\#9881](https://github.com/matrix-org/matrix-react-sdk/pull/9881)).
 * Make create poll dialog scale better (PSG-929) ([\#9873](https://github.com/matrix-org/matrix-react-sdk/pull/9873)). Fixes #21855.
 * Change RTE mode icons ([\#9861](https://github.com/matrix-org/matrix-react-sdk/pull/9861)).
 * Device manager - prune client information events after remote sign out ([\#9874](https://github.com/matrix-org/matrix-react-sdk/pull/9874)).
 * Check connection before starting broadcast ([\#9857](https://github.com/matrix-org/matrix-react-sdk/pull/9857)).
 * Enable sent receipt for poll start events (PSG-962) ([\#9870](https://github.com/matrix-org/matrix-react-sdk/pull/9870)).
 * Change clear notifications to have more readable copy ([\#9867](https://github.com/matrix-org/matrix-react-sdk/pull/9867)).
 * combine search results when the query is present in multiple successive messages ([\#9855](https://github.com/matrix-org/matrix-react-sdk/pull/9855)). Fixes #3977. Contributed by @grimhilt.
 * Disable bubbles for broadcasts ([\#9860](https://github.com/matrix-org/matrix-react-sdk/pull/9860)). Fixes #24140.
 * Enable reactions and replies for broadcasts ([\#9856](https://github.com/matrix-org/matrix-react-sdk/pull/9856)). Fixes #24042.
 * Improve switching between rich and plain editing modes ([\#9776](https://github.com/matrix-org/matrix-react-sdk/pull/9776)).
 * Redesign the picture-in-picture window ([\#9800](https://github.com/matrix-org/matrix-react-sdk/pull/9800)). Fixes #23980.
 * User on-boarding tasks now appear in a static order. ([\#9799](https://github.com/matrix-org/matrix-react-sdk/pull/9799)). Contributed by @GoodGuyMarco.
 * Device manager - contextual menus ([\#9832](https://github.com/matrix-org/matrix-react-sdk/pull/9832)).
 * If listening a non-live broadcast and changing the room, the broadcast will be paused ([\#9825](https://github.com/matrix-org/matrix-react-sdk/pull/9825)). Fixes #24078.
 * Consider own broadcasts from other device as a playback ([\#9821](https://github.com/matrix-org/matrix-react-sdk/pull/9821)). Fixes #24068.
 * Add link creation to rich text editor ([\#9775](https://github.com/matrix-org/matrix-react-sdk/pull/9775)).
 * Add mark as read option in room setting ([\#9798](https://github.com/matrix-org/matrix-react-sdk/pull/9798)). Fixes #24053.
 * Device manager - current device design and copy tweaks ([\#9801](https://github.com/matrix-org/matrix-react-sdk/pull/9801)).
 * Unify notifications panel event design ([\#9754](https://github.com/matrix-org/matrix-react-sdk/pull/9754)).
 * Add actions for integration manager to send and read certain events ([\#9740](https://github.com/matrix-org/matrix-react-sdk/pull/9740)).
 * Device manager - design tweaks ([\#9768](https://github.com/matrix-org/matrix-react-sdk/pull/9768)).
 * Change room list sorting to activity and unread first by default ([\#9773](https://github.com/matrix-org/matrix-react-sdk/pull/9773)). Fixes #24014.
 * Add a config flag to enable the rust crypto-sdk ([\#9759](https://github.com/matrix-org/matrix-react-sdk/pull/9759)).
 * Improve decryption error UI by consolidating error messages and providing instructions when possible ([\#9544](https://github.com/matrix-org/matrix-react-sdk/pull/9544)). Contributed by @duxovni.
 * Honor font settings in Element Call ([\#9751](https://github.com/matrix-org/matrix-react-sdk/pull/9751)). Fixes #23661.
 * Device manager - use deleteAccountData to prune device manager client information events ([\#9734](https://github.com/matrix-org/matrix-react-sdk/pull/9734)).

## 🐛 Bug Fixes
 * Display rooms & threads as unread (bold) if threads have unread messages. ([\#9763](https://github.com/matrix-org/matrix-react-sdk/pull/9763)). Fixes #23907.
 * Don't prefer STIXGeneral over the default font ([\#9711](https://github.com/matrix-org/matrix-react-sdk/pull/9711)). Fixes #23899.
 * Use the same avatar colour when creating 1:1 DM rooms ([\#9850](https://github.com/matrix-org/matrix-react-sdk/pull/9850)). Fixes #23476.
 * Fix space lock icon size ([\#9854](https://github.com/matrix-org/matrix-react-sdk/pull/9854)). Fixes #24128.
 * Make calls automatically disconnect if the widget disappears ([\#9862](https://github.com/matrix-org/matrix-react-sdk/pull/9862)). Fixes #23664.
 * Fix emoji in RTE editing ([\#9827](https://github.com/matrix-org/matrix-react-sdk/pull/9827)).
 * Fix export with attachments on formats txt and json ([\#9851](https://github.com/matrix-org/matrix-react-sdk/pull/9851)). Fixes #24130. Contributed by @grimhilt.
 * Fixed empty `Content-Type` for encrypted uploads ([\#9848](https://github.com/matrix-org/matrix-react-sdk/pull/9848)). Contributed by @K3das.
 * Fix sign-in instead link on password reset page ([\#9820](https://github.com/matrix-org/matrix-react-sdk/pull/9820)). Fixes #24087.
 * The seekbar now initially shows the current position ([\#9796](https://github.com/matrix-org/matrix-react-sdk/pull/9796)). Fixes #24051.
 * Fix: Editing a poll will silently change it to a closed poll ([\#9809](https://github.com/matrix-org/matrix-react-sdk/pull/9809)). Fixes #23176.
 * Make call tiles look less broken in the right panel ([\#9808](https://github.com/matrix-org/matrix-react-sdk/pull/9808)). Fixes #23716.
 * Prevent unnecessary m.direct updates ([\#9805](https://github.com/matrix-org/matrix-react-sdk/pull/9805)). Fixes #24059.
 * Fix checkForPreJoinUISI for thread roots ([\#9803](https://github.com/matrix-org/matrix-react-sdk/pull/9803)). Fixes #24054.
 * Snap in PiP widget when content changed ([\#9797](https://github.com/matrix-org/matrix-react-sdk/pull/9797)). Fixes #24050.
 * Load RTE components only when RTE labs is enabled ([\#9804](https://github.com/matrix-org/matrix-react-sdk/pull/9804)).
 * Ensure that events are correctly updated when they are edited. ([\#9789](https://github.com/matrix-org/matrix-react-sdk/pull/9789)).
 * When stopping a broadcast also stop the playback ([\#9795](https://github.com/matrix-org/matrix-react-sdk/pull/9795)). Fixes #24052.
 * Prevent to start two broadcasts at the same time ([\#9744](https://github.com/matrix-org/matrix-react-sdk/pull/9744)). Fixes #23973.
 * Correctly handle limited sync responses by resetting the thread timeline ([\#3056](https://github.com/matrix-org/matrix-js-sdk/pull/3056)). Fixes vector-im/element-web#23952.
 * Fix failure to start in firefox private browser ([\#3058](https://github.com/matrix-org/matrix-js-sdk/pull/3058)). Fixes vector-im/element-web#24216.

**Changelogs for older versions can be found [here](CHANGELOG-2022.md).**
