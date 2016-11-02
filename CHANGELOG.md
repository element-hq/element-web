Changes in [0.7.5-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.5-rc.1) (2016-11-02)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.7.4...v0.7.5-rc.1)

 * Explicitly list files in package.json
   [\#530](https://github.com/matrix-org/matrix-react-sdk/pull/530)
 * Fix some markdown in the code style doc
   [\#529](https://github.com/matrix-org/matrix-react-sdk/pull/529)
 * Run highlight.js asynchronously
   [\#527](https://github.com/matrix-org/matrix-react-sdk/pull/527)
 * Fix room tinting
   [\#528](https://github.com/matrix-org/matrix-react-sdk/pull/528)
 * Fix CPU spin on joining rooms
   [\#525](https://github.com/matrix-org/matrix-react-sdk/pull/525)
 * Don't send read receipt if user has logged out
   [\#526](https://github.com/matrix-org/matrix-react-sdk/pull/526)
 * Switch to babel 6, again
   [\#523](https://github.com/matrix-org/matrix-react-sdk/pull/523)
 * Keyboard shortcuts to mute microphone/camera
   [\#522](https://github.com/matrix-org/matrix-react-sdk/pull/522)
 * Give our input fields names
   [\#520](https://github.com/matrix-org/matrix-react-sdk/pull/520)
 * Revert "Switch to babel 6"
   [\#521](https://github.com/matrix-org/matrix-react-sdk/pull/521)
 * Switch to babel 6
   [\#519](https://github.com/matrix-org/matrix-react-sdk/pull/519)
 * Interactive auth for device delete
   [\#517](https://github.com/matrix-org/matrix-react-sdk/pull/517)
 * InteractiveAuthDialog
   [\#516](https://github.com/matrix-org/matrix-react-sdk/pull/516)
 * Prevent spamming emails by reusing client secret
   [\#514](https://github.com/matrix-org/matrix-react-sdk/pull/514)
 * Refactor CaptchaForm to put less logic in signupstages
   [\#515](https://github.com/matrix-org/matrix-react-sdk/pull/515)

Changes in [0.7.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.4) (2016-10-12)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.7.3...v0.7.4)

 * A bundle of fixes to the react tests
   [\#513](https://github.com/matrix-org/matrix-react-sdk/pull/513)
 * Fix registration retry
   [\#512](https://github.com/matrix-org/matrix-react-sdk/pull/512)
 * Fix registration
   [\#511](https://github.com/matrix-org/matrix-react-sdk/pull/511)
 * Fix bug where riot would keep requesting tokens
   [\#510](https://github.com/matrix-org/matrix-react-sdk/pull/510)

Changes in [0.7.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.3) (2016-10-05)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.7.2...v0.7.3)

 * Move 'show join button' functionality out
   [\#502](https://github.com/matrix-org/matrix-react-sdk/pull/502)
 * Update to linkify 2.1.3
   [\#508](https://github.com/matrix-org/matrix-react-sdk/pull/508)
 * Fix version going blank after logging in
   [\#505](https://github.com/matrix-org/matrix-react-sdk/pull/505)
 * Use 'Sign In' / 'Sign Out' universally
   [\#506](https://github.com/matrix-org/matrix-react-sdk/pull/506)
 * Prevent error when clicking 'log in'
   [\#504](https://github.com/matrix-org/matrix-react-sdk/pull/504)
 * Make RTE mode use the new Markdown wrapper class
   [\#497](https://github.com/matrix-org/matrix-react-sdk/pull/497)
 * Add 'getHomeServerName' util to client peg
   [\#501](https://github.com/matrix-org/matrix-react-sdk/pull/501)
 * Fix markdown link syntax
   [\#499](https://github.com/matrix-org/matrix-react-sdk/pull/499)
 * Fail hard & fast if linkifyjs version is wrong
   [\#500](https://github.com/matrix-org/matrix-react-sdk/pull/500)
 * Bring back the little green men without slowness
   [\#498](https://github.com/matrix-org/matrix-react-sdk/pull/498)
 * Directory search join button
   [\#496](https://github.com/matrix-org/matrix-react-sdk/pull/496)
 * Fix links to IRC rooms
   [\#495](https://github.com/matrix-org/matrix-react-sdk/pull/495)
 * Make markdown less aggressive
   [\#492](https://github.com/matrix-org/matrix-react-sdk/pull/492)
 * Move the device verification buttons to their own class
   [\#493](https://github.com/matrix-org/matrix-react-sdk/pull/493)
 * Add the deviceId back to memberdeviceinfo
   [\#494](https://github.com/matrix-org/matrix-react-sdk/pull/494)
 * Force-hide autocomplete after sending message.
   [\#489](https://github.com/matrix-org/matrix-react-sdk/pull/489)
 * force old selection state after creating entities
   [\#488](https://github.com/matrix-org/matrix-react-sdk/pull/488)

Changes in [0.7.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.2) (2016-09-21)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.7.1...v0.7.2)

 * Revert #333
   [\#491](https://github.com/matrix-org/matrix-react-sdk/pull/491)
 * EncryptedEventDialog updates
   [\#490](https://github.com/matrix-org/matrix-react-sdk/pull/490)
 * Apply heuristic on incoming DMs
   [\#487](https://github.com/matrix-org/matrix-react-sdk/pull/487)

Changes in [0.7.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.1) (2016-09-21)
===================================================================================================
 * Correct js-sdk version dependency

Changes in [0.7.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.0) (2016-09-21)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.5-r3...v0.7.0)

 * Rebrand
   [\#485](https://github.com/matrix-org/matrix-react-sdk/pull/485)
 * Pass close_scalar postMessage action through to the dispatcher
   [\#484](https://github.com/matrix-org/matrix-react-sdk/pull/484)
 * Replace <p>s with <br/>s consistently
   [\#482](https://github.com/matrix-org/matrix-react-sdk/pull/482)
 * Add 'startAtBottom' flag
   [\#483](https://github.com/matrix-org/matrix-react-sdk/pull/483)
 * Add the olm version to the settings page.
   [\#474](https://github.com/matrix-org/matrix-react-sdk/pull/474)
 * Pass through config for Room Directory
   [\#479](https://github.com/matrix-org/matrix-react-sdk/pull/479)
 * Fix unicode completions in autocomplete.
   [\#481](https://github.com/matrix-org/matrix-react-sdk/pull/481)
 * Add ability to set plumbing state in a room
   [\#477](https://github.com/matrix-org/matrix-react-sdk/pull/477)
 * Disable username and room decorators
   [\#480](https://github.com/matrix-org/matrix-react-sdk/pull/480)
 * Wmwragg/correct incoming call positioning
   [\#478](https://github.com/matrix-org/matrix-react-sdk/pull/478)
 * Wmwragg/remove old filter
   [\#475](https://github.com/matrix-org/matrix-react-sdk/pull/475)
 * Corrected onKeyUp misstype and return can now be used instead of clic…
   [\#476](https://github.com/matrix-org/matrix-react-sdk/pull/476)
 * Wmwragg/multi invite bugfix
   [\#473](https://github.com/matrix-org/matrix-react-sdk/pull/473)
 * Revert "Fix linkification and bump linkifyjs dep"
   [\#471](https://github.com/matrix-org/matrix-react-sdk/pull/471)
 * Wmwragg/chat multi invite
   [\#469](https://github.com/matrix-org/matrix-react-sdk/pull/469)
 * Matthew/right panel collapse
   [\#470](https://github.com/matrix-org/matrix-react-sdk/pull/470)
 * Fix linkification and bump linkifyjs dep
   [\#460](https://github.com/matrix-org/matrix-react-sdk/pull/460)
 * Add modal dialog on new room button
   [\#468](https://github.com/matrix-org/matrix-react-sdk/pull/468)
 * Flag incoming DMs as such
   [\#463](https://github.com/matrix-org/matrix-react-sdk/pull/463)
 * Improve autocomplete behaviour
   [\#466](https://github.com/matrix-org/matrix-react-sdk/pull/466)
 * Pull multi-inviting functionality out of MultiInviteDialog
   [\#467](https://github.com/matrix-org/matrix-react-sdk/pull/467)
 * Remove markdown line breaks
   [\#464](https://github.com/matrix-org/matrix-react-sdk/pull/464)
 * Fix un-marking rooms as DM  rooms
   [\#465](https://github.com/matrix-org/matrix-react-sdk/pull/465)
 * Don't re-use parted rooms for DMs
   [\#461](https://github.com/matrix-org/matrix-react-sdk/pull/461)
 * Update createRoom to support creating DM rooms
   [\#458](https://github.com/matrix-org/matrix-react-sdk/pull/458)
 * First wave of E2E Visuals
   [\#462](https://github.com/matrix-org/matrix-react-sdk/pull/462)
 * FilePanel, NotificationPanel and EventTimelineSet support
   [\#450](https://github.com/matrix-org/matrix-react-sdk/pull/450)
 * Fix CAS support by using a temporary Matrix client
   [\#459](https://github.com/matrix-org/matrix-react-sdk/pull/459)
 * Don't crash if no DM rooms with someone
   [\#457](https://github.com/matrix-org/matrix-react-sdk/pull/457)
 * Don't always show DM rooms in Direct Messages
   [\#456](https://github.com/matrix-org/matrix-react-sdk/pull/456)
 * Add DM rooms with that person to the MemberInfo panel
   [\#455](https://github.com/matrix-org/matrix-react-sdk/pull/455)
 * Add some tests for the rich text editor
   [\#452](https://github.com/matrix-org/matrix-react-sdk/pull/452)
 * Fix bug whereby refreshing Vector would not allow querying of membership
   state
   [\#454](https://github.com/matrix-org/matrix-react-sdk/pull/454)
 * Wmwragg/one to one indicators
   [\#453](https://github.com/matrix-org/matrix-react-sdk/pull/453)
 * Update MemberDeviceInfo display
   [\#451](https://github.com/matrix-org/matrix-react-sdk/pull/451)
 * Wmwragg/one to one chat
   [\#448](https://github.com/matrix-org/matrix-react-sdk/pull/448)
 * Scalar Messaging: Expose join_rules and restrict to currently viewed room
   [\#443](https://github.com/matrix-org/matrix-react-sdk/pull/443)
 * API for (un)marking rooms as DM rooms
   [\#449](https://github.com/matrix-org/matrix-react-sdk/pull/449)
 * Formatting toolbar for RTE message composer.
   [\#440](https://github.com/matrix-org/matrix-react-sdk/pull/440)
 * Refactor MatrixTools to Rooms
   [\#447](https://github.com/matrix-org/matrix-react-sdk/pull/447)
 * Track DM rooms in account data
   [\#446](https://github.com/matrix-org/matrix-react-sdk/pull/446)
 * Fix: conference rooms were no longer hidden
   [\#445](https://github.com/matrix-org/matrix-react-sdk/pull/445)
 * Fix error dialog on conf call error
   [\#444](https://github.com/matrix-org/matrix-react-sdk/pull/444)
 * Make MemberInfo to use client.getStoredDevicesForUser
   [\#441](https://github.com/matrix-org/matrix-react-sdk/pull/441)
 * Implement starter link support
   [\#437](https://github.com/matrix-org/matrix-react-sdk/pull/437)
 * Convert MemberDeviceInfo to ES6 class
   [\#442](https://github.com/matrix-org/matrix-react-sdk/pull/442)
 * Make the 'encrypt this room' knob be megolm
   [\#439](https://github.com/matrix-org/matrix-react-sdk/pull/439)
 * Show something when we see a no-op join event
   [\#438](https://github.com/matrix-org/matrix-react-sdk/pull/438)
 * Handle broken OlmAccounts
   [\#436](https://github.com/matrix-org/matrix-react-sdk/pull/436)
 * Show session restore errors on the login screen
   [\#435](https://github.com/matrix-org/matrix-react-sdk/pull/435)
 * use a top-level audio tag for playing all VoIP audio.
   [\#434](https://github.com/matrix-org/matrix-react-sdk/pull/434)
 * use promises to mediate access to HTMLAudioElements
   [\#433](https://github.com/matrix-org/matrix-react-sdk/pull/433)
 * Wmwragg/direct chat sublist
   [\#432](https://github.com/matrix-org/matrix-react-sdk/pull/432)

Changes in [0.6.5-r3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.5-r3) (2016-09-02)
=========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.5-r2...v0.6.5-r3)

 * revert accidental debug logging >:(


Changes in [0.6.5-r2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.5-r2) (2016-09-02)
=========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.5-r1...v0.6.5-r2)

 * Workaround vector-im/vector-web#2020 where floods of joins could crash the browser
   (as seen in #matrix-dev right now)

Changes in [0.6.5-r1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.5-r1) (2016-09-01)
=========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.5...v0.6.5-r1)

 * Fix guest access

Changes in [0.6.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.5) (2016-08-28)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.4-r1...v0.6.5)

 * re-add leave button in RoomSettings
 * add /user URLs
 * recognise matrix.to links and other vector links
 * fix linkify dependency
 * fix avatar clicking in MemberInfo
 * fix emojione sizing
   [\#431](https://github.com/matrix-org/matrix-react-sdk/pull/431)
 * Fix NPE when we don't know the sender of an event
   [\#430](https://github.com/matrix-org/matrix-react-sdk/pull/430)
 * Update annoying TimelinePanel test
   [\#429](https://github.com/matrix-org/matrix-react-sdk/pull/429)
 * add fancy changelog dialog
   [\#416](https://github.com/matrix-org/matrix-react-sdk/pull/416)
 * Send bot options with leading underscore on the state key
   [\#428](https://github.com/matrix-org/matrix-react-sdk/pull/428)
 * Update autocomplete design and scroll it correctly
   [\#419](https://github.com/matrix-org/matrix-react-sdk/pull/419)
 * Add ability to query and set bot options
   [\#427](https://github.com/matrix-org/matrix-react-sdk/pull/427)
 * Add .travis.yml
   [\#425](https://github.com/matrix-org/matrix-react-sdk/pull/425)
 * Added event/info message avatars back in
   [\#426](https://github.com/matrix-org/matrix-react-sdk/pull/426)
 * Add postMessage API required for integration provisioning
   [\#423](https://github.com/matrix-org/matrix-react-sdk/pull/423)
 * Fix TimelinePanel test
   [\#424](https://github.com/matrix-org/matrix-react-sdk/pull/424)
 * Wmwragg/chat message presentation
   [\#422](https://github.com/matrix-org/matrix-react-sdk/pull/422)
 * Only try to delete room rule if it exists
   [\#421](https://github.com/matrix-org/matrix-react-sdk/pull/421)
 * Make the notification slider work
   [\#420](https://github.com/matrix-org/matrix-react-sdk/pull/420)
 * Don't download E2E devices if feature disabled
   [\#418](https://github.com/matrix-org/matrix-react-sdk/pull/418)
 * strip (IRC) suffix from tabcomplete entries
   [\#417](https://github.com/matrix-org/matrix-react-sdk/pull/417)
 * ignore local busy
   [\#415](https://github.com/matrix-org/matrix-react-sdk/pull/415)
 * defaultDeviceDisplayName should be a prop
   [\#414](https://github.com/matrix-org/matrix-react-sdk/pull/414)
 * Use server-generated deviceId
   [\#410](https://github.com/matrix-org/matrix-react-sdk/pull/410)
 * Set initial_device_display_name on login and register
   [\#413](https://github.com/matrix-org/matrix-react-sdk/pull/413)
 * Add device_id to devices display
   [\#409](https://github.com/matrix-org/matrix-react-sdk/pull/409)
 * Don't use MatrixClientPeg for temporary clients
   [\#408](https://github.com/matrix-org/matrix-react-sdk/pull/408)

Changes in [0.6.4-r1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.4-r1) (2016-08-12)
=========================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.4...v0.6.4-r1)
 * Fix inviting multiple people

Changes in [0.6.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.4) (2016-08-11)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.3...v0.6.4)

 * Only show Autocomplete if autocomplete is enabled
   [\#411](https://github.com/matrix-org/matrix-react-sdk/pull/411)
 * Wmwragg/room tag menu
   [\#402](https://github.com/matrix-org/matrix-react-sdk/pull/402)
 * Move guest registration into the login logic
   [\#407](https://github.com/matrix-org/matrix-react-sdk/pull/407)
 * Better support for inviting multiple people
   [\#403](https://github.com/matrix-org/matrix-react-sdk/pull/403)
 * Refactor login token
   [\#406](https://github.com/matrix-org/matrix-react-sdk/pull/406)
 * Use the current HS for guest login
   [\#405](https://github.com/matrix-org/matrix-react-sdk/pull/405)
 * Various fixes and improvements to emojification.
   [\#395](https://github.com/matrix-org/matrix-react-sdk/pull/395)
 * Fix settings resetting on refresh
   [\#404](https://github.com/matrix-org/matrix-react-sdk/pull/404)
 * Avoid flashing up login screen during guest registration
   [\#401](https://github.com/matrix-org/matrix-react-sdk/pull/401)
 * Cancel calls to rate-limited funcs on unmount
   [\#400](https://github.com/matrix-org/matrix-react-sdk/pull/400)
 * Move rehydration of MatrixClients from MatrixClientPeg to SessionLoader
   [\#399](https://github.com/matrix-org/matrix-react-sdk/pull/399)
 * Don't show integrations header if setting not on
   [\#398](https://github.com/matrix-org/matrix-react-sdk/pull/398)
 * Start to factor out session-loading magic
   [\#397](https://github.com/matrix-org/matrix-react-sdk/pull/397)
 * Hack around a react warning
   [\#396](https://github.com/matrix-org/matrix-react-sdk/pull/396)
 * Add config to hide the labs section
   [\#393](https://github.com/matrix-org/matrix-react-sdk/pull/393)
 * Dbkr/scalar
   [\#392](https://github.com/matrix-org/matrix-react-sdk/pull/392)
 * Wmwragg/mute mention state fix
   [\#390](https://github.com/matrix-org/matrix-react-sdk/pull/390)
 * Fix long freeze when opening 'historical' section
   [\#391](https://github.com/matrix-org/matrix-react-sdk/pull/391)
 * Refactor UI error effects
   [\#388](https://github.com/matrix-org/matrix-react-sdk/pull/388)
 * Implement account deactivation
   [\#381](https://github.com/matrix-org/matrix-react-sdk/pull/381)
 * Don't leave isRoomPublished as undefined
   [\#389](https://github.com/matrix-org/matrix-react-sdk/pull/389)
 * Call the logout API when we log out
   [\#377](https://github.com/matrix-org/matrix-react-sdk/pull/377)
 * feat: code cleanup & emoji replacement in composer
   [\#335](https://github.com/matrix-org/matrix-react-sdk/pull/335)
 * Add more logging to TimelinePanel-test
   [\#387](https://github.com/matrix-org/matrix-react-sdk/pull/387)
 * DevicesPanel: use device_id as a placeholder
   [\#386](https://github.com/matrix-org/matrix-react-sdk/pull/386)
 * MemberDeviceInfo: Use the device name, where available
   [\#385](https://github.com/matrix-org/matrix-react-sdk/pull/385)
 * Wmwragg/mention state menu
   [\#369](https://github.com/matrix-org/matrix-react-sdk/pull/369)
 * fix upload for video or image files where sniffing fails
   [\#383](https://github.com/matrix-org/matrix-react-sdk/pull/383)
 * fix: allow up/down normally for no completions
   [\#384](https://github.com/matrix-org/matrix-react-sdk/pull/384)
 * fix: autocomplete to use tab instead of return
   [\#382](https://github.com/matrix-org/matrix-react-sdk/pull/382)
 * strip (IRC) displayname suffix from autocomplete
   [\#375](https://github.com/matrix-org/matrix-react-sdk/pull/375)
 * Include rooms with 1 person invited
   [\#379](https://github.com/matrix-org/matrix-react-sdk/pull/379)
 * Fix 'start new direct chat'
   [\#378](https://github.com/matrix-org/matrix-react-sdk/pull/378)
 * Fix warnings from MessageComposer
   [\#376](https://github.com/matrix-org/matrix-react-sdk/pull/376)
 * New voice and video call buttons
   [\#371](https://github.com/matrix-org/matrix-react-sdk/pull/371)
 * Silence some more react warnings
   [\#373](https://github.com/matrix-org/matrix-react-sdk/pull/373)
 * Fix warnings emanating from Velociraptor elements
   [\#372](https://github.com/matrix-org/matrix-react-sdk/pull/372)
 * Wmwragg/button updates
   [\#353](https://github.com/matrix-org/matrix-react-sdk/pull/353)
 * Implement device management UI
   [\#370](https://github.com/matrix-org/matrix-react-sdk/pull/370)
 * Factor EditableTextContainer out of ChangeDisplayName
   [\#368](https://github.com/matrix-org/matrix-react-sdk/pull/368)
 * Stop the Avatar classes setting properties on <span>s
   [\#367](https://github.com/matrix-org/matrix-react-sdk/pull/367)
 * Remove relayoutOnUpdate prop on gemini-scrollbar
   [\#366](https://github.com/matrix-org/matrix-react-sdk/pull/366)
 * Fix bug where vector freezes on power level event
   [\#364](https://github.com/matrix-org/matrix-react-sdk/pull/364)
 * Refactor MatrixClientPeg
   [\#361](https://github.com/matrix-org/matrix-react-sdk/pull/361)
 * Fix 'start chat' button on MemberInfo
   [\#363](https://github.com/matrix-org/matrix-react-sdk/pull/363)
 * Bump dependency versions
   [\#362](https://github.com/matrix-org/matrix-react-sdk/pull/362)
 * Fix tab complete order properly
   [\#360](https://github.com/matrix-org/matrix-react-sdk/pull/360)
 * Add removeListener for account data listener
   [\#359](https://github.com/matrix-org/matrix-react-sdk/pull/359)
 * Set the device_id on pre-login MatrixClient
   [\#358](https://github.com/matrix-org/matrix-react-sdk/pull/358)
 * Wmwragg/mention state indicator round 2
   [\#357](https://github.com/matrix-org/matrix-react-sdk/pull/357)
 * Support for disabling/enabling URL previews per-user, per-room and per-user-
   per-room
   [\#356](https://github.com/matrix-org/matrix-react-sdk/pull/356)
 * Use HS proxy API for requestToken on adding email
   [\#336](https://github.com/matrix-org/matrix-react-sdk/pull/336)
 * Error if email already in use when resetting pw
   [\#337](https://github.com/matrix-org/matrix-react-sdk/pull/337)
 * Fix enourmous video bug
   [\#355](https://github.com/matrix-org/matrix-react-sdk/pull/355)
 * Add support for sending uploaded content as m.video
   [\#354](https://github.com/matrix-org/matrix-react-sdk/pull/354)
 * Order tab complete by most recently spoke
   [\#341](https://github.com/matrix-org/matrix-react-sdk/pull/341)
 * Wmwragg/spinner fix
   [\#350](https://github.com/matrix-org/matrix-react-sdk/pull/350)
 * Now showing three dots when hovering over the badge
   [\#352](https://github.com/matrix-org/matrix-react-sdk/pull/352)
 * Fix unpublishing room in room settings
   [\#351](https://github.com/matrix-org/matrix-react-sdk/pull/351)
 * Fix race when creating rooms where invite list can be blank
   [\#347](https://github.com/matrix-org/matrix-react-sdk/pull/347)
 * improve wording of MemberInfo's start chat button.
   [\#348](https://github.com/matrix-org/matrix-react-sdk/pull/348)
 * Revert "Amends react template and removes opening image in lightbox"
   [\#346](https://github.com/matrix-org/matrix-react-sdk/pull/346)
 * Wmwragg/modal restyle
   [\#345](https://github.com/matrix-org/matrix-react-sdk/pull/345)
 * Amends react template and removes opening image in lightbox
   [\#343](https://github.com/matrix-org/matrix-react-sdk/pull/343)
 * Remove the member list loading hack
   [\#344](https://github.com/matrix-org/matrix-react-sdk/pull/344)
 * CSS classes to colour offline users differently
   [\#342](https://github.com/matrix-org/matrix-react-sdk/pull/342)
 * Listen for the new lastPreseceTs event
   [\#340](https://github.com/matrix-org/matrix-react-sdk/pull/340)
 * Fix filtering user list by ID
   [\#339](https://github.com/matrix-org/matrix-react-sdk/pull/339)
 * Update tab completion list when we have a room
   [\#338](https://github.com/matrix-org/matrix-react-sdk/pull/338)
 * JS code style guide
   [\#330](https://github.com/matrix-org/matrix-react-sdk/pull/330)
 * Error on registration if email taken
   [\#334](https://github.com/matrix-org/matrix-react-sdk/pull/334)
 * feat: render unicode emoji as emojione images
   [\#332](https://github.com/matrix-org/matrix-react-sdk/pull/332)
 * feat: unblacklist img tags with data URIs
   [\#333](https://github.com/matrix-org/matrix-react-sdk/pull/333)
 * Autocomplete fixes
   [\#331](https://github.com/matrix-org/matrix-react-sdk/pull/331)
 * Better autocomplete
   [\#296](https://github.com/matrix-org/matrix-react-sdk/pull/296)
 * feat: add and configure eslint
   [\#329](https://github.com/matrix-org/matrix-react-sdk/pull/329)
 * Fix user links
   [\#326](https://github.com/matrix-org/matrix-react-sdk/pull/326)
 * Fix ordering of Memberlist
   [\#327](https://github.com/matrix-org/matrix-react-sdk/pull/327)
 * Display an error message if room not found
   [\#325](https://github.com/matrix-org/matrix-react-sdk/pull/325)
 * Implement device blocking
   [\#324](https://github.com/matrix-org/matrix-react-sdk/pull/324)
 * Remove /encrypt command
   [\#322](https://github.com/matrix-org/matrix-react-sdk/pull/322)
 * RoomSettings: add encryption setting
   [\#321](https://github.com/matrix-org/matrix-react-sdk/pull/321)
 * Fix a pair of warnings from RoomSettings
   [\#320](https://github.com/matrix-org/matrix-react-sdk/pull/320)
 * RoomSettings: refactor permissions calculations
   [\#319](https://github.com/matrix-org/matrix-react-sdk/pull/319)
 * Fix https://github.com/vector-im/vector-web/issues/1679
   [\#318](https://github.com/matrix-org/matrix-react-sdk/pull/318)
 * Fix /join to be consistent with the other code
   [\#317](https://github.com/matrix-org/matrix-react-sdk/pull/317)
 * UserSettings: fix the displayed version of the react-sdk
   [\#316](https://github.com/matrix-org/matrix-react-sdk/pull/316)
 * Show canonical alias in URL bar
   [\#314](https://github.com/matrix-org/matrix-react-sdk/pull/314)
 * Some basic tests for RoomView
   [\#313](https://github.com/matrix-org/matrix-react-sdk/pull/313)
 * Support for making devices unverified
   [\#315](https://github.com/matrix-org/matrix-react-sdk/pull/315)
 * Fix eventListener warning
   [\#312](https://github.com/matrix-org/matrix-react-sdk/pull/312)
 * Fix peeking and member list vanishing
   [\#307](https://github.com/matrix-org/matrix-react-sdk/pull/307)
 * Use different keys for new MessageComposerInput
   [\#311](https://github.com/matrix-org/matrix-react-sdk/pull/311)
 * Fix RTE escaping, HTML output with breaks
   [\#310](https://github.com/matrix-org/matrix-react-sdk/pull/310)
 * Fix cursor bug, persist editor mode & rte default
   [\#308](https://github.com/matrix-org/matrix-react-sdk/pull/308)
 * Rich Text Editor
   [\#292](https://github.com/matrix-org/matrix-react-sdk/pull/292)
 * Hide e2e features if not enabled
   [\#306](https://github.com/matrix-org/matrix-react-sdk/pull/306)
 * Add experimental "Labs" section to settings
   [\#305](https://github.com/matrix-org/matrix-react-sdk/pull/305)
 * Make the room directory join rooms by alias
   [\#304](https://github.com/matrix-org/matrix-react-sdk/pull/304)
 * Factor out common parts of room creation
   [\#303](https://github.com/matrix-org/matrix-react-sdk/pull/303)
 * Fix spinner-of-doom in member info for guests
   [\#302](https://github.com/matrix-org/matrix-react-sdk/pull/302)
 * Support for marking devices as verified
   [\#300](https://github.com/matrix-org/matrix-react-sdk/pull/300)
 * Make the config optional
   [\#301](https://github.com/matrix-org/matrix-react-sdk/pull/301)
 * Pass brand parameter down to Notifications
   [\#299](https://github.com/matrix-org/matrix-react-sdk/pull/299)
 * Second attempt at fixing the Velocity memory leak
   [\#298](https://github.com/matrix-org/matrix-react-sdk/pull/298)

Changes in [0.6.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.3) (2016-06-03)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.2...v0.6.3)

 * Change invite text field wording
 * Fix bug with new email invite UX where the invite could get wedged
 * Label app versions sensibly in UserSettings

Changes in [0.6.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.2) (2016-06-02)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.1...v0.6.2)

 * Correctly bump dep on matrix-js-sdk 0.5.4

Changes in [0.6.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.1) (2016-06-02)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.6.0...v0.6.1)

 * Fix focusing race in new UX for 3pid invites
 * Fix jenkins.sh

Changes in [0.6.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.6.0) (2016-06-02)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.5.2...v0.6.0)

 * implement new UX for 3pid invites
   [\#297](https://github.com/matrix-org/matrix-react-sdk/pull/297)
 * multiple URL preview support
   [\#290](https://github.com/matrix-org/matrix-react-sdk/pull/290)
 * Add a fallback home server to log into
   [\#293](https://github.com/matrix-org/matrix-react-sdk/pull/293)
 * Hopefully fix memory leak with velocity
   [\#291](https://github.com/matrix-org/matrix-react-sdk/pull/291)
 * Support for enabling email notifications
   [\#289](https://github.com/matrix-org/matrix-react-sdk/pull/289)
 * Correct Readme instructions how to customize the UI
   [\#286](https://github.com/matrix-org/matrix-react-sdk/pull/286)
 * Avoid rerendering during Room unmount
   [\#285](https://github.com/matrix-org/matrix-react-sdk/pull/285)

Changes in [0.5.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.5.2) (2016-04-22)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.5.1...v0.5.2)

Performance improvements:

 * Reduce number of events shown in a room to 250
   [afb301f](https://github.com/matrix-org/matrix-react-sdk/commit/afb301ffb78c019a50e40caa5d9042ad39c117fe)
 * add heuristics to hide URL previews...
   [\#284](https://github.com/matrix-org/matrix-react-sdk/pull/284)
 * Fix bug which stopped us scrolling down after we scrolled up
   [\#283](https://github.com/matrix-org/matrix-react-sdk/pull/283)
 * Don't relayout scrollpanels every time something changes
   [\#280](https://github.com/matrix-org/matrix-react-sdk/pull/280)
 * Reduce number of renders on received events
   [\#279](https://github.com/matrix-org/matrix-react-sdk/pull/279)
 * Avoid rerendering EventTiles when not necessary
   [\#278](https://github.com/matrix-org/matrix-react-sdk/pull/278)
 * Speed up processing of TimelinePanel updates on new events
   [\#277](https://github.com/matrix-org/matrix-react-sdk/pull/277)

Other bug fixes:
 * Fix read-receipt animation
   [\#282](https://github.com/matrix-org/matrix-react-sdk/pull/282),
   [\#281](https://github.com/matrix-org/matrix-react-sdk/pull/281)

Changes in [0.5.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.5.1) (2016-04-19)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.4.0...v0.5.1)

 * Upgrade to react 15.0
 * Fix many thinkos in sorting the MemberList
   [\#275](https://github.com/matrix-org/matrix-react-sdk/pull/275)
 * Don't setState after unmounting a component
   [\#276](https://github.com/matrix-org/matrix-react-sdk/pull/276)
 * Drop workaround for object.onLoad
   [\#274](https://github.com/matrix-org/matrix-react-sdk/pull/274)
 * Make sure that we update the room name
   [\#272](https://github.com/matrix-org/matrix-react-sdk/pull/272)
 * Matthew/design tweaks
   [\#273](https://github.com/matrix-org/matrix-react-sdk/pull/273)
 * Hack around absence of String.codePointAt on PhantomJS
   [\#271](https://github.com/matrix-org/matrix-react-sdk/pull/271)
 * RoomView: Handle joining federated rooms
   [\#270](https://github.com/matrix-org/matrix-react-sdk/pull/270)
 * Stop the MatrixClient when the MatrixChat is unmounted
   [\#269](https://github.com/matrix-org/matrix-react-sdk/pull/269)
 * make the UI fadable to help with decluttering
   [\#268](https://github.com/matrix-org/matrix-react-sdk/pull/268)
 * URL previewing support
   [\#260](https://github.com/matrix-org/matrix-react-sdk/pull/260)
 * Remember to load new timeline events
   [\#267](https://github.com/matrix-org/matrix-react-sdk/pull/267)
 * Stop trying to paginate after we get a failure
   [\#265](https://github.com/matrix-org/matrix-react-sdk/pull/265)
 * Improvements to the react-sdk test framework
   [\#264](https://github.com/matrix-org/matrix-react-sdk/pull/264)
 * Fix password resetting
   [\#263](https://github.com/matrix-org/matrix-react-sdk/pull/263)
 * Catch pageup/down and ctrl-home/end at the top level
   [\#262](https://github.com/matrix-org/matrix-react-sdk/pull/262)
 * Fix an issue where the scroll stopped working.
   [\#261](https://github.com/matrix-org/matrix-react-sdk/pull/261)
 * Fix a bug where we tried to show two ghost read markers at once.
   [\#254](https://github.com/matrix-org/matrix-react-sdk/pull/254)
 * File upload improvements
   [\#258](https://github.com/matrix-org/matrix-react-sdk/pull/258)
 * Show full-size avatar on MemberInfo avatar click
   [\#257](https://github.com/matrix-org/matrix-react-sdk/pull/257)
 * Whitelist \<u> tag
   [\#256](https://github.com/matrix-org/matrix-react-sdk/pull/256)
 * Don't reload the DOM if we can jump straight to the RM
   [\#253](https://github.com/matrix-org/matrix-react-sdk/pull/253)

[0.5.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.5.0) was
incorrectly released.

Changes in [0.4.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.4.0) (2016-03-30)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.3.1...v0.4.0)

 * Prettier, animated placeholder :D
   [\#251](https://github.com/matrix-org/matrix-react-sdk/pull/251)
 * Refactor RoomHeader, and fix topic updates
   [\#252](https://github.com/matrix-org/matrix-react-sdk/pull/252)
 * Disable the message composer if we don't have permission to post
   [\#250](https://github.com/matrix-org/matrix-react-sdk/pull/250)
 * notification issue fixed
   [\#240](https://github.com/matrix-org/matrix-react-sdk/pull/240)
 * Fix scroll offset popping around during image load by putting explicit
   height back on images
   [\#248](https://github.com/matrix-org/matrix-react-sdk/pull/248)
 * Split a textinput component out of MessageComposer
   [\#249](https://github.com/matrix-org/matrix-react-sdk/pull/249)

Changes in [0.3.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.3.1) (2016-03-23)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.3.0...v0.3.1)

 * Disable debug logging in ScrollPanel

Changes in [0.3.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.3.0) (2016-03-23)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.2.0...v0.3.0)

 * Fix off-by-one error in read-marker advancing
   [\#246](https://github.com/matrix-org/matrix-react-sdk/pull/246)
 * Another go at fixing the jumpy scroll
   [\#245](https://github.com/matrix-org/matrix-react-sdk/pull/245)
 * Move read-marker past our own events when we switch to a room
   [\#244](https://github.com/matrix-org/matrix-react-sdk/pull/244)
 * Add better user-facing error messages
   [\#243](https://github.com/matrix-org/matrix-react-sdk/pull/243)
 * Make the read-marker less annoying
   [\#242](https://github.com/matrix-org/matrix-react-sdk/pull/242)
 * rework roomsettings for new visibility UI
   [\#241](https://github.com/matrix-org/matrix-react-sdk/pull/241)
 * Show a spinner when we back-paginate search results
   [\#236](https://github.com/matrix-org/matrix-react-sdk/pull/236)
 * Only ignore scroll echoes once
   [\#237](https://github.com/matrix-org/matrix-react-sdk/pull/237)
 * Add 'cancel all' option to 'unsent messages' bar
   [\#238](https://github.com/matrix-org/matrix-react-sdk/pull/238)
 * Show an error when a direct-to-event link fails
   [\#239](https://github.com/matrix-org/matrix-react-sdk/pull/239)
 * if we're not peeking in a room, stop any ongoing peeking
   [\#234](https://github.com/matrix-org/matrix-react-sdk/pull/234)
 * linkify vector.im URLs directly into the app, both from HTML and non-HTML
   messages
   [\#235](https://github.com/matrix-org/matrix-react-sdk/pull/235)
 * Use new pendingEventList functionality from matrix-js-sdk
   [\#231](https://github.com/matrix-org/matrix-react-sdk/pull/231)
 * Display a warning if a third party invite for a room was sent to an address
   that is not bound publicly to our account
   [\#233](https://github.com/matrix-org/matrix-react-sdk/pull/233)
 * Fix cancelling dialog boxes by clicking on the background
   [\#232](https://github.com/matrix-org/matrix-react-sdk/pull/232)
 * fix zero length tab complete so it doesn't fire automatically on empty
   MessageComposer
   [\#229](https://github.com/matrix-org/matrix-react-sdk/pull/229)
 * click on nicks to insert them into the MessageComposer
   [\#230](https://github.com/matrix-org/matrix-react-sdk/pull/230)
 * Correctly fix notif spam after logout/login
   [\#227](https://github.com/matrix-org/matrix-react-sdk/pull/227)
 * fix last_active_ago timestamps, tab completion ordering, and implement
   currently_active semantics
   [\#226](https://github.com/matrix-org/matrix-react-sdk/pull/226)
 * make MemberTiles actually update in realtime
   [\#222](https://github.com/matrix-org/matrix-react-sdk/pull/222)
 * Bring up MemberInfo on avatar click in EventTile
   [\#225](https://github.com/matrix-org/matrix-react-sdk/pull/225)
 * Make getCurrent[H|I]SUrl honour the state setting that comes from the url
   bar
   [\#228](https://github.com/matrix-org/matrix-react-sdk/pull/228)
 * Poll for email validation once the validation email has been sent
   [\#223](https://github.com/matrix-org/matrix-react-sdk/pull/223)
 * Display sync status in favicon and title.
   [\#221](https://github.com/matrix-org/matrix-react-sdk/pull/221)
 * grey out roomsettings that you can't edit
   [\#217](https://github.com/matrix-org/matrix-react-sdk/pull/217)
 * allow registration and login from guest to be cancellable
   [\#220](https://github.com/matrix-org/matrix-react-sdk/pull/220)
 * let registering guests either upgrade or create a new account by spec…
   [\#219](https://github.com/matrix-org/matrix-react-sdk/pull/219)
 * Remove (broken, as it turns out) permission logic from react sdk
   [\#187](https://github.com/matrix-org/matrix-react-sdk/pull/187)
 * Bring back lost functionality on login/register/password-reset screens
   [\#200](https://github.com/matrix-org/matrix-react-sdk/pull/200)
 * Handle the new Session.logged_out event.
   [\#218](https://github.com/matrix-org/matrix-react-sdk/pull/218)
 * hopefully fix https://github.com/vector-im/vector-web/issues/819
   [\#216](https://github.com/matrix-org/matrix-react-sdk/pull/216)
 * Adjust the scroll position when the gemini panel is resized
   [\#215](https://github.com/matrix-org/matrix-react-sdk/pull/215)
 * Use our fork of react-gemini-scrollbar to fix resize issues
   [\#214](https://github.com/matrix-org/matrix-react-sdk/pull/214)
 * Put direct-linked events and search clickthroughs in the middle
   [\#212](https://github.com/matrix-org/matrix-react-sdk/pull/212)
 * prettyprint conference joins and parts properly
   [\#198](https://github.com/matrix-org/matrix-react-sdk/pull/198)
 * Don't crash on redacted (or otherwise invalid) 3pid invites
   [\#213](https://github.com/matrix-org/matrix-react-sdk/pull/213)

Changes in matrix-react-sdk v0.2.0 (2016-03-11)
===============================================
(originally incorrectly released as 0.1.1)
 * Various significant changes

Changes in matrix-react-sdk v0.1.0 (2016-02-24)
===============================================
 * Significant refactor: remove separation between views and controllers
 * This release of the react-sdk will require additional components to function.
   See https://github.com/vector-im/vector-web for a complete application.

Changes in matrix-react-sdk v0.0.2 (2015-10-28)
===============================================
 * Initial release
