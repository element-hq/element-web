hanges in [0.8.4](https://github.com/vector-im/vector-web/releases/tag/v0.8.4) (2016-11-04)
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
