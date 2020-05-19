Changes in [2.6.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.6.0) (2020-05-19)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.6.0-rc.1...v2.6.0)

 * Upgrade to JS SDK 6.1.0
 * Revert "ImageView make clicking off it easier"
   [\#4602](https://github.com/matrix-org/matrix-react-sdk/pull/4602)
 * Remove debugging that causes email addresses to load forever (to release)
   [\#4598](https://github.com/matrix-org/matrix-react-sdk/pull/4598)

Changes in [2.6.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.6.0-rc.1) (2020-05-14)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0...v2.6.0-rc.1)

 * Upgrade to JS SDK 6.1.0-rc.1
 * Update from Weblate
   [\#4596](https://github.com/matrix-org/matrix-react-sdk/pull/4596)
 * Fix message edits dialog being wrong and sometimes crashing
   [\#4595](https://github.com/matrix-org/matrix-react-sdk/pull/4595)
 * Acquire a new session before enacting deactivation
   [\#4584](https://github.com/matrix-org/matrix-react-sdk/pull/4584)
 * Remove UI for upgrading 4S to symmetric encryption
   [\#4581](https://github.com/matrix-org/matrix-react-sdk/pull/4581)
 * Add copy to SSO prompts during cross-signing setup
   [\#4555](https://github.com/matrix-org/matrix-react-sdk/pull/4555)
 * Re-fix OpenID requests from widgets
   [\#4592](https://github.com/matrix-org/matrix-react-sdk/pull/4592)
 * Fix persistent widgets on desktop / http
   [\#4591](https://github.com/matrix-org/matrix-react-sdk/pull/4591)
 * Updated link and added:Yarn two is not yet used.
   [\#4589](https://github.com/matrix-org/matrix-react-sdk/pull/4589)
 * Fix topic dialog not supporting escape as it didn't have a "Close"
   [\#4578](https://github.com/matrix-org/matrix-react-sdk/pull/4578)
 * Default to public room when creating room from room directory
   [\#4579](https://github.com/matrix-org/matrix-react-sdk/pull/4579)
 * Replace png flags and add Kosovo to country code dropdown
   [\#4576](https://github.com/matrix-org/matrix-react-sdk/pull/4576)
 * Rename `trash (custom).svg` as electron doesn't like paths with spaces
   [\#4583](https://github.com/matrix-org/matrix-react-sdk/pull/4583)
 * Fix sign in / up links on previewed rooms
   [\#4582](https://github.com/matrix-org/matrix-react-sdk/pull/4582)
 * Avoid soft crash if unknown device in verification
   [\#4580](https://github.com/matrix-org/matrix-react-sdk/pull/4580)
 * Add slash commands /query and /msg to match IRC
   [\#4568](https://github.com/matrix-org/matrix-react-sdk/pull/4568)
 * Send cross-signing debug booleans over rageshake
   [\#4570](https://github.com/matrix-org/matrix-react-sdk/pull/4570)
 * Prompt user to specify an alternate server if theirs has registration off
   [\#4575](https://github.com/matrix-org/matrix-react-sdk/pull/4575)
 * Don't try and redact redactions for "Remove recent messages"
   [\#4573](https://github.com/matrix-org/matrix-react-sdk/pull/4573)
 * View Source should target the replacing event rather than the root one
   [\#4571](https://github.com/matrix-org/matrix-react-sdk/pull/4571)
 * Fix passphrase reset in key backup restore dialog
   [\#4569](https://github.com/matrix-org/matrix-react-sdk/pull/4569)
 * Ensure key backup gets dealt with correctly during secret storage reset
   [\#4556](https://github.com/matrix-org/matrix-react-sdk/pull/4556)
 * Fix crash for broken invites
   [\#4565](https://github.com/matrix-org/matrix-react-sdk/pull/4565)
 * Fix rageshake with no matrix client
   [\#4572](https://github.com/matrix-org/matrix-react-sdk/pull/4572)
 * Update from Weblate
   [\#4567](https://github.com/matrix-org/matrix-react-sdk/pull/4567)
 * Bring back UnknownBody for UISIs
   [\#4564](https://github.com/matrix-org/matrix-react-sdk/pull/4564)
 * clear tag panel selection if the community selected is left
   [\#4559](https://github.com/matrix-org/matrix-react-sdk/pull/4559)
 * Close ImageView when redacting
   [\#4560](https://github.com/matrix-org/matrix-react-sdk/pull/4560)
 * Redesign redactions
   [\#4484](https://github.com/matrix-org/matrix-react-sdk/pull/4484)
 * Don't try to reload profile information when closing the user panel
   [\#4547](https://github.com/matrix-org/matrix-react-sdk/pull/4547)
 * Fix right panel hiding when viewing room member
   [\#4558](https://github.com/matrix-org/matrix-react-sdk/pull/4558)
 * Don't erase password confirm on registration error
   [\#4540](https://github.com/matrix-org/matrix-react-sdk/pull/4540)
 * Add a loading state for email addresses/phone numbers in settings
   [\#4557](https://github.com/matrix-org/matrix-react-sdk/pull/4557)
 * set the meta tag for theme-color to the same theme css background
   [\#4554](https://github.com/matrix-org/matrix-react-sdk/pull/4554)
 * Update Invite Dialog copy to include email addresses
   [\#4497](https://github.com/matrix-org/matrix-react-sdk/pull/4497)
 * Fix slider toggle regression.
   [\#4546](https://github.com/matrix-org/matrix-react-sdk/pull/4546)
 * Fix a crash where a name could unexpectedly be an empty list
   [\#4552](https://github.com/matrix-org/matrix-react-sdk/pull/4552)
 * Solves communities can be dragged from context menu
   [\#4492](https://github.com/matrix-org/matrix-react-sdk/pull/4492)
 * Remove prefixes for composer avatar urls
   [\#4553](https://github.com/matrix-org/matrix-react-sdk/pull/4553)
 * Fix reply RR spacing getting doubled
   [\#4541](https://github.com/matrix-org/matrix-react-sdk/pull/4541)
 * Differentiate copy for own untrusted device dialog
   [\#4549](https://github.com/matrix-org/matrix-react-sdk/pull/4549)
 * EventIndex: Reduce the logging the event index is producing.
   [\#4548](https://github.com/matrix-org/matrix-react-sdk/pull/4548)
 * Increase rageshake size limit to 5mb
   [\#4543](https://github.com/matrix-org/matrix-react-sdk/pull/4543)
 * Update from Weblate
   [\#4542](https://github.com/matrix-org/matrix-react-sdk/pull/4542)
 * Guard against race when waiting for cross-signing to be ready
   [\#4539](https://github.com/matrix-org/matrix-react-sdk/pull/4539)
 * Wait for user to be verified in e2e setup
   [\#4537](https://github.com/matrix-org/matrix-react-sdk/pull/4537)
 * Convert MatrixChat to a TypeScript class
   [\#4462](https://github.com/matrix-org/matrix-react-sdk/pull/4462)
 * Mark room as read when escape is pressed
   [\#4271](https://github.com/matrix-org/matrix-react-sdk/pull/4271)
 * Only show key backup reminder when confirmed by server to be missing
   [\#4534](https://github.com/matrix-org/matrix-react-sdk/pull/4534)
 * Add device name to unverified session toast
   [\#4535](https://github.com/matrix-org/matrix-react-sdk/pull/4535)
 * Show progress when loading keys
   [\#4507](https://github.com/matrix-org/matrix-react-sdk/pull/4507)
 * Fix device verification toasts not disappearing
   [\#4532](https://github.com/matrix-org/matrix-react-sdk/pull/4532)
 * Update toast copy again
   [\#4529](https://github.com/matrix-org/matrix-react-sdk/pull/4529)
 * Re-apply theme after login
   [\#4518](https://github.com/matrix-org/matrix-react-sdk/pull/4518)
 * Reduce maximum width of toasts & allow multiple lines
   [\#4525](https://github.com/matrix-org/matrix-react-sdk/pull/4525)
 * Treat sessions that are there when we log in as old
   [\#4524](https://github.com/matrix-org/matrix-react-sdk/pull/4524)
 * Allow resetting storage from the access dialog
   [\#4521](https://github.com/matrix-org/matrix-react-sdk/pull/4521)
 * Update (bulk) unverified device toast copy
   [\#4522](https://github.com/matrix-org/matrix-react-sdk/pull/4522)
 * Make new device toasts appear above review toasts
   [\#4519](https://github.com/matrix-org/matrix-react-sdk/pull/4519)
 * Separate toasts for existing & new device verification
   [\#4511](https://github.com/matrix-org/matrix-react-sdk/pull/4511)
 * Slightly darker toggle off bg color
   [\#4477](https://github.com/matrix-org/matrix-react-sdk/pull/4477)
 * Fix pill vertical align
   [\#4514](https://github.com/matrix-org/matrix-react-sdk/pull/4514)
 * Fix set up encryption toast to use "set up" as action
   [\#4502](https://github.com/matrix-org/matrix-react-sdk/pull/4502)
 * Don't enable e2ee when inviting a 3pid
   [\#4509](https://github.com/matrix-org/matrix-react-sdk/pull/4509)
 * Fix internal link styling in Security Settings
   [\#4510](https://github.com/matrix-org/matrix-react-sdk/pull/4510)
 * Small custom theming fixes
   [\#4508](https://github.com/matrix-org/matrix-react-sdk/pull/4508)
 * Fix scaling issues
   [\#4355](https://github.com/matrix-org/matrix-react-sdk/pull/4355)
 * Aggregate device verify toasts
   [\#4506](https://github.com/matrix-org/matrix-react-sdk/pull/4506)
 * Support setting username and avatar colors in custom themes
   [\#4503](https://github.com/matrix-org/matrix-react-sdk/pull/4503)
 * only clear on continuations where the clear isn't done by SenderProfile
   [\#4501](https://github.com/matrix-org/matrix-react-sdk/pull/4501)
 * cap width of editable item list item to leave space for its X button
   [\#4495](https://github.com/matrix-org/matrix-react-sdk/pull/4495)
 * Add a link from settings / devices to your user profile
   [\#4498](https://github.com/matrix-org/matrix-react-sdk/pull/4498)
 * Update from Weblate
   [\#4496](https://github.com/matrix-org/matrix-react-sdk/pull/4496)
 * Make icon change in SetupEncryptionDialog
   [\#4485](https://github.com/matrix-org/matrix-react-sdk/pull/4485)
 * Remove invite only padlocks feature flag
   [\#4487](https://github.com/matrix-org/matrix-react-sdk/pull/4487)
 * Fix incorrect toast if security setup skipped
   [\#4486](https://github.com/matrix-org/matrix-react-sdk/pull/4486)
 * Revert "Update emojibase for fixed emoji codepoints and Emoji 13 support"
   [\#4482](https://github.com/matrix-org/matrix-react-sdk/pull/4482)
 * Fix widget URL templating (again)
   [\#4481](https://github.com/matrix-org/matrix-react-sdk/pull/4481)
 * Fix recovery link on login verification flow
   [\#4479](https://github.com/matrix-org/matrix-react-sdk/pull/4479)
 * Make avatars in pills occupy the entire space using cropping
   [\#4476](https://github.com/matrix-org/matrix-react-sdk/pull/4476)
 * Use WidgetType more often to avoid breaking new sticker pickers
   [\#4458](https://github.com/matrix-org/matrix-react-sdk/pull/4458)
 * Update logging for unmanaged widgets, and add TODO comments for other areas
   [\#4460](https://github.com/matrix-org/matrix-react-sdk/pull/4460)
 * Fix OpenID requests from widgets
   [\#4459](https://github.com/matrix-org/matrix-react-sdk/pull/4459)
 * Take encrypted message search out of labs
   [\#4467](https://github.com/matrix-org/matrix-react-sdk/pull/4467)
 * Fix BigEmoji for replies
   [\#4475](https://github.com/matrix-org/matrix-react-sdk/pull/4475)
 * Update login security copy and design to match Figma
   [\#4472](https://github.com/matrix-org/matrix-react-sdk/pull/4472)
 * Fix i18n of SSO UIA copy in Deactivate Account Dialog
   [\#4471](https://github.com/matrix-org/matrix-react-sdk/pull/4471)
 * Assert type of domNode as HTMLElement to fix build
   [\#4470](https://github.com/matrix-org/matrix-react-sdk/pull/4470)
 * Unignored in settings
   [\#4466](https://github.com/matrix-org/matrix-react-sdk/pull/4466)
 * Skip auth flow test for signing upload when password present
   [\#4464](https://github.com/matrix-org/matrix-react-sdk/pull/4464)
 * If user cannot set email during registration don't tell them to
   [\#4461](https://github.com/matrix-org/matrix-react-sdk/pull/4461)
 * Fix post-ts autocomplete, it is not null
   [\#4463](https://github.com/matrix-org/matrix-react-sdk/pull/4463)
 * Convert autocomplete stuff to TypeScript
   [\#4452](https://github.com/matrix-org/matrix-react-sdk/pull/4452)
 * Add a back button to the devtools verifications panel
   [\#4455](https://github.com/matrix-org/matrix-react-sdk/pull/4455)
 * Fix: wait until cross-signing keys are fetched to show verify button
   [\#4456](https://github.com/matrix-org/matrix-react-sdk/pull/4456)
 * Handle load error in create secret storage dialog
   [\#4451](https://github.com/matrix-org/matrix-react-sdk/pull/4451)
 * Allow iframes and Jitsi URLs in /addwidget
   [\#4382](https://github.com/matrix-org/matrix-react-sdk/pull/4382)
 * Support m.jitsi-typed widgets as Jitsi widgets
   [\#4379](https://github.com/matrix-org/matrix-react-sdk/pull/4379)
 * Don't recheck DeviceListener until after initial sync is finished
   [\#4450](https://github.com/matrix-org/matrix-react-sdk/pull/4450)
 * Fix CSS class in ButtonPlaceholder
   [\#4449](https://github.com/matrix-org/matrix-react-sdk/pull/4449)
 * Password Login make sure tab takes user to password field
   [\#4441](https://github.com/matrix-org/matrix-react-sdk/pull/4441)
 * Network Dropdown fix things not scrolling properly
   [\#4439](https://github.com/matrix-org/matrix-react-sdk/pull/4439)
 * ImageView make clicking off it easier
   [\#4448](https://github.com/matrix-org/matrix-react-sdk/pull/4448)
 * Add slash command to send a rageshake
   [\#4443](https://github.com/matrix-org/matrix-react-sdk/pull/4443)
 * EventIndex: Filter out events that don't have a propper content value.
   [\#4446](https://github.com/matrix-org/matrix-react-sdk/pull/4446)
 * Revert "Fix Filepanel scroll position state lost when room is changed"
   [\#4445](https://github.com/matrix-org/matrix-react-sdk/pull/4445)
 * Update seshat copy to remove trailing full stop
   [\#4442](https://github.com/matrix-org/matrix-react-sdk/pull/4442)
 * Fix Filepanel scroll position state lost when room is changed
   [\#4388](https://github.com/matrix-org/matrix-react-sdk/pull/4388)
 * Fix end-to-end tests for end-to-end encryption verification
   [\#4436](https://github.com/matrix-org/matrix-react-sdk/pull/4436)
 * Don't explode if the e2e test directory exists when crashing
   [\#4437](https://github.com/matrix-org/matrix-react-sdk/pull/4437)
 * Bump https-proxy-agent from 2.2.1 to 2.2.4 in /test/end-to-end-tests
   [\#4430](https://github.com/matrix-org/matrix-react-sdk/pull/4430)
 * Minor updates to e2e test instructions on Windows
   [\#4432](https://github.com/matrix-org/matrix-react-sdk/pull/4432)
 * Fix typo
   [\#4435](https://github.com/matrix-org/matrix-react-sdk/pull/4435)
 * Catch errors sooner so users can recover more easily
   [\#4122](https://github.com/matrix-org/matrix-react-sdk/pull/4122)
 * Rageshake: remind user of unsupported browser and send modernizr report
   [\#4381](https://github.com/matrix-org/matrix-react-sdk/pull/4381)
 * Design tweaks for DM Room Tiles
   [\#4338](https://github.com/matrix-org/matrix-react-sdk/pull/4338)
 * Don't break spills over multiple lines, ellipsis them at max-1-line
   [\#4434](https://github.com/matrix-org/matrix-react-sdk/pull/4434)
 * Turn the end-to-end tests back on and fix the lazy-loading tests
   [\#4433](https://github.com/matrix-org/matrix-react-sdk/pull/4433)
 * Fix key backup debug panel
   [\#4431](https://github.com/matrix-org/matrix-react-sdk/pull/4431)
 * Convert cross-signing feature flag to setting
   [\#4416](https://github.com/matrix-org/matrix-react-sdk/pull/4416)
 * Make RoomPublishSetting import-skinnable
   [\#4428](https://github.com/matrix-org/matrix-react-sdk/pull/4428)
 * Iterate cross-signing copy
   [\#4425](https://github.com/matrix-org/matrix-react-sdk/pull/4425)
 * Fix: ensure twemoji font is loaded when showing SAS emojis
   [\#4422](https://github.com/matrix-org/matrix-react-sdk/pull/4422)
 * Revert "Fix: load Twemoji before login so complete security gets the right
   emojis during SAS"
   [\#4421](https://github.com/matrix-org/matrix-react-sdk/pull/4421)
 * Fix: load Twemoji before login so complete security gets the right emojis
   during SAS
   [\#4419](https://github.com/matrix-org/matrix-react-sdk/pull/4419)
 * consolidate and fix copy to clipboard
   [\#4410](https://github.com/matrix-org/matrix-react-sdk/pull/4410)
 * Fix Message Context Menu options not displaying: block
   [\#4418](https://github.com/matrix-org/matrix-react-sdk/pull/4418)
 * Fix pills being broken by unescaped characters
   [\#4411](https://github.com/matrix-org/matrix-react-sdk/pull/4411)

Changes in [2.5.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0) (2020-05-05)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0-rc.6...v2.5.0)

 * Upgrade to JS SDK 6.0.0
 * EventIndex: Reduce the logging the event index is producing.
   [\#4551](https://github.com/matrix-org/matrix-react-sdk/pull/4551)
 *  Differentiate copy for own untrusted device dialog
   [\#4550](https://github.com/matrix-org/matrix-react-sdk/pull/4550)
 * More detailed progress for key backup progress
   [\#4545](https://github.com/matrix-org/matrix-react-sdk/pull/4545)
 *  Increase rageshake size limit to 5mb
   [\#4544](https://github.com/matrix-org/matrix-react-sdk/pull/4544)

Changes in [2.5.0-rc.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0-rc.6) (2020-05-01)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0-rc.5...v2.5.0-rc.6)

 * Upgrade to JS SDK 6.0.0-rc.2
 * Wait for user to be verified in e2e setup
   [\#4538](https://github.com/matrix-org/matrix-react-sdk/pull/4538)
 * Add device name to unverified session toast
   [\#4536](https://github.com/matrix-org/matrix-react-sdk/pull/4536)

Changes in [2.5.0-rc.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0-rc.5) (2020-04-30)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0-rc.4...v2.5.0-rc.5)

 * Upgrade to JS SDK 6.0.0-rc.1
 * Fix device verification toasts not disappearing
   [\#4533](https://github.com/matrix-org/matrix-react-sdk/pull/4533)
 * Allow resetting storage from the access dialog
   [\#4526](https://github.com/matrix-org/matrix-react-sdk/pull/4526)
 * Update toast copy again
   [\#4530](https://github.com/matrix-org/matrix-react-sdk/pull/4530)
 * Reduce maximum width of toasts & allow multiple lines
   [\#4528](https://github.com/matrix-org/matrix-react-sdk/pull/4528)
 * Treat sessions that are there when we log in as old
   [\#4527](https://github.com/matrix-org/matrix-react-sdk/pull/4527)
 * Update (bulk) unverified device toast copy
   [\#4523](https://github.com/matrix-org/matrix-react-sdk/pull/4523)
 * Make new device toasts appear above review toasts
   [\#4520](https://github.com/matrix-org/matrix-react-sdk/pull/4520)
 * Separate toasts for existing & new device verification
   [\#4517](https://github.com/matrix-org/matrix-react-sdk/pull/4517)
 * Aggregate device verify toasts
   [\#4516](https://github.com/matrix-org/matrix-react-sdk/pull/4516)
 * Fix set up encryption toast to use "set up" as action
   [\#4515](https://github.com/matrix-org/matrix-react-sdk/pull/4515)
 * Fix internal link styling in Security Settings
   [\#4512](https://github.com/matrix-org/matrix-react-sdk/pull/4512)
 *  Don't enable e2ee when inviting a 3pid
   [\#4513](https://github.com/matrix-org/matrix-react-sdk/pull/4513)
 * only clear on continuations where the clear isn't done by SenderProfile
   [\#4505](https://github.com/matrix-org/matrix-react-sdk/pull/4505)
 * cap width of editable item list item to leave space for its X button
   [\#4504](https://github.com/matrix-org/matrix-react-sdk/pull/4504)
 * Add a link from settings / devices to your user profile
   [\#4499](https://github.com/matrix-org/matrix-react-sdk/pull/4499)
 * Make icon change in SetupEncryptionDialog
   [\#4490](https://github.com/matrix-org/matrix-react-sdk/pull/4490)
 * Remove invite only padlocks feature flag for release
   [\#4488](https://github.com/matrix-org/matrix-react-sdk/pull/4488)
 * Fix incorrect toast if security setup skipped
   [\#4489](https://github.com/matrix-org/matrix-react-sdk/pull/4489)
 * Revert "Update emojibase for fixed emoji codepoints and Emoji 13 support"
   [\#4483](https://github.com/matrix-org/matrix-react-sdk/pull/4483)
 * Fix recovery link on login verification flow
   [\#4480](https://github.com/matrix-org/matrix-react-sdk/pull/4480)

Changes in [2.5.0-rc.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0-rc.4) (2020-04-23)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0-rc.3...v2.5.0-rc.4)

 * Upgrade to JS SDK 5.3.1-rc.4
 * Take encrypted message search out of labs for release
   [\#4468](https://github.com/matrix-org/matrix-react-sdk/pull/4468)
 * Update login security copy and design to match Figma [to release]
   [\#4474](https://github.com/matrix-org/matrix-react-sdk/pull/4474)
 * Fix i18n of SSO UIA copy in Deactivate Account Dialog on release
   [\#4473](https://github.com/matrix-org/matrix-react-sdk/pull/4473)
 * Skip auth flow test for signing upload when password present
   [\#4465](https://github.com/matrix-org/matrix-react-sdk/pull/4465)
 * Fix: wait until cross-signing keys are fetched to show verify button
   [\#4457](https://github.com/matrix-org/matrix-react-sdk/pull/4457)
 * Handle load error in create secret storage dialog
   [\#4454](https://github.com/matrix-org/matrix-react-sdk/pull/4454)
 * Don't recheck DeviceListener until after initial sync is finished
   [\#4450](https://github.com/matrix-org/matrix-react-sdk/pull/4450)
 * EventIndex: Filter out events that don't have a propper content value.
   [\#4447](https://github.com/matrix-org/matrix-react-sdk/pull/4447)

Changes in [2.5.0-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0-rc.3) (2020-04-17)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0-rc.2...v2.5.0-rc.3)

 * Upgrade to JS SDK 5.3.1-rc.3

Changes in [2.5.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0-rc.2) (2020-04-16)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.5.0-rc.1...v2.5.0-rc.2)

 * Upgrade to JS SDK 5.3.1-rc.2
 * [Release] Convert cross-signing flag to a setting
   [\#4429](https://github.com/matrix-org/matrix-react-sdk/pull/4429)
 * Iterate cross-signing copy
   [\#4426](https://github.com/matrix-org/matrix-react-sdk/pull/4426)
 * Fix: ensure twemoji font is loaded when showing SAS emojis
   [\#4423](https://github.com/matrix-org/matrix-react-sdk/pull/4423)

Changes in [2.5.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.5.0-rc.1) (2020-04-15)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.4.0-rc.1...v2.5.0-rc.1)

 * Upgrade to JS SDK 5.3.1-rc.1
 * null-guard MatrixClientPeg in RoomViewStore
   [\#4415](https://github.com/matrix-org/matrix-react-sdk/pull/4415)
 * Fix: prevent spurious notifications from indexer
   [\#4414](https://github.com/matrix-org/matrix-react-sdk/pull/4414)
 * Login block on initialSync with spinners
   [\#4413](https://github.com/matrix-org/matrix-react-sdk/pull/4413)
 * Allow network dropdown to be scrollable and fix context menu padding calc
   [\#4408](https://github.com/matrix-org/matrix-react-sdk/pull/4408)
 * Remove end-to-end message info option when cross-signing is used
   [\#4412](https://github.com/matrix-org/matrix-react-sdk/pull/4412)
 * Minimize widgets by default
   [\#4378](https://github.com/matrix-org/matrix-react-sdk/pull/4378)
 * Add comments to highlight where we'll need m.widget support
   [\#4380](https://github.com/matrix-org/matrix-react-sdk/pull/4380)
 * Fix: dont try to enable 4S if cross-signing is disabled
   [\#4407](https://github.com/matrix-org/matrix-react-sdk/pull/4407)
 * Fix: don't confuse user with spinner during complete security step
   [\#4406](https://github.com/matrix-org/matrix-react-sdk/pull/4406)
 *  Fix: avoid potential crash during certain verification paths
   [\#4405](https://github.com/matrix-org/matrix-react-sdk/pull/4405)
 * Add riot-desktop shortcuts for forward/back matching browsers&slack
   [\#4392](https://github.com/matrix-org/matrix-react-sdk/pull/4392)
 * Convert LoggedInView to an ES6 PureComponent Class & TypeScript
   [\#4398](https://github.com/matrix-org/matrix-react-sdk/pull/4398)
 * Fix width of MVideoBody in FilePanel
   [\#4396](https://github.com/matrix-org/matrix-react-sdk/pull/4396)
 * Remove unused react-addons-css-transition-group
   [\#4397](https://github.com/matrix-org/matrix-react-sdk/pull/4397)
 * Fix emoji tooltip flickering
   [\#4395](https://github.com/matrix-org/matrix-react-sdk/pull/4395)
 * Pass along key backup for bootstrap
   [\#4374](https://github.com/matrix-org/matrix-react-sdk/pull/4374)
 * Fix create room dialog e2ee private room setting
   [\#4403](https://github.com/matrix-org/matrix-react-sdk/pull/4403)
 * Sort emoji by shortcodes for autocomplete primarily for :-1 and :+1
   [\#4391](https://github.com/matrix-org/matrix-react-sdk/pull/4391)
 * Fix invalid commands when figuring out whether to set isTyping
   [\#4390](https://github.com/matrix-org/matrix-react-sdk/pull/4390)
 * op/deop return error if trying to affect an unknown user
   [\#4389](https://github.com/matrix-org/matrix-react-sdk/pull/4389)
 * Composer pills respect showPillAvatar setting
   [\#4384](https://github.com/matrix-org/matrix-react-sdk/pull/4384)
 * Only send typing notification when composing commands which send messages
   [\#4385](https://github.com/matrix-org/matrix-react-sdk/pull/4385)
 * Reverse order of they match/they don't match buttons
   [\#4386](https://github.com/matrix-org/matrix-react-sdk/pull/4386)
 * Use singular text on 'delete sessions' button for SSO
   [\#4383](https://github.com/matrix-org/matrix-react-sdk/pull/4383)
 * Pass widget data through from sticker picker
   [\#4377](https://github.com/matrix-org/matrix-react-sdk/pull/4377)
 * Obliterate widgets when they are minimized
   [\#4376](https://github.com/matrix-org/matrix-react-sdk/pull/4376)
 * Fix image thumbnail width when read receipts are hidden
   [\#4370](https://github.com/matrix-org/matrix-react-sdk/pull/4370)
 * Add toggle for e2ee when creating private room
   [\#4362](https://github.com/matrix-org/matrix-react-sdk/pull/4362)
 * Fix logging for failed searches
   [\#4372](https://github.com/matrix-org/matrix-react-sdk/pull/4372)
 * Ensure UI is updated when cross-signing gets disabled
   [\#4369](https://github.com/matrix-org/matrix-react-sdk/pull/4369)
 * Retry the request for the master key from SSSS on login
   [\#4371](https://github.com/matrix-org/matrix-react-sdk/pull/4371)
 * Upgrade deps
   [\#4365](https://github.com/matrix-org/matrix-react-sdk/pull/4365)
 * App load tweaks, i18n and localStorage
   [\#4367](https://github.com/matrix-org/matrix-react-sdk/pull/4367)
 * Fix encoding of widget arguments
   [\#4366](https://github.com/matrix-org/matrix-react-sdk/pull/4366)

Changes in [2.4.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.4.0-rc.1) (2020-04-08)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.3.1...v2.4.0-rc.1)

 * Upgrade to JS SDK to 5.3.0-rc.1
 * EventIndex: Log if we had all events in a checkpoint but are continuing.
   [\#4363](https://github.com/matrix-org/matrix-react-sdk/pull/4363)
 * Update from Weblate
   [\#4364](https://github.com/matrix-org/matrix-react-sdk/pull/4364)
 * Support deactivating your account with SSO
   [\#4356](https://github.com/matrix-org/matrix-react-sdk/pull/4356)
 * Add debug status for cached backup key format
   [\#4359](https://github.com/matrix-org/matrix-react-sdk/pull/4359)
 * Fix composer placeholder not updating
   [\#4361](https://github.com/matrix-org/matrix-react-sdk/pull/4361)
 * Fix sas verification buttons to match figma
   [\#4358](https://github.com/matrix-org/matrix-react-sdk/pull/4358)
 * Don't show fallback text for verification requests
   [\#4345](https://github.com/matrix-org/matrix-react-sdk/pull/4345)
 * Fix share dialog correctly
   [\#4360](https://github.com/matrix-org/matrix-react-sdk/pull/4360)
 * Use singular copy when only deleting one device
   [\#4357](https://github.com/matrix-org/matrix-react-sdk/pull/4357)
 * Deem m.sticker events as actionable for reacting
   [\#4288](https://github.com/matrix-org/matrix-react-sdk/pull/4288)
 * Don't show spinner over encryption setup dialogs
   [\#4354](https://github.com/matrix-org/matrix-react-sdk/pull/4354)
 * Support Jitsi information from client .well-known
   [\#4348](https://github.com/matrix-org/matrix-react-sdk/pull/4348)
 * Add new default home page fallback
   [\#4350](https://github.com/matrix-org/matrix-react-sdk/pull/4350)
 * Check more account data in toast listener
   [\#4351](https://github.com/matrix-org/matrix-react-sdk/pull/4351)
 * Don't try to send presence updates until the client is started
   [\#4353](https://github.com/matrix-org/matrix-react-sdk/pull/4353)
 * Fix copy button on code blocks when there is no code tag just pre
   [\#4352](https://github.com/matrix-org/matrix-react-sdk/pull/4352)
 * Clear sessionStorage on sign out
   [\#4346](https://github.com/matrix-org/matrix-react-sdk/pull/4346)
 * Re-request room keys after auth
   [\#4341](https://github.com/matrix-org/matrix-react-sdk/pull/4341)
 * Update emojibase for fixed emoji codepoints and Emoji 13 support
   [\#4344](https://github.com/matrix-org/matrix-react-sdk/pull/4344)
 * App load order tweaks for code splitting
   [\#4343](https://github.com/matrix-org/matrix-react-sdk/pull/4343)
 * Fix alignment of e2e icon in userinfo and expose full displayname in title
   [\#4312](https://github.com/matrix-org/matrix-react-sdk/pull/4312)
 * Adjust copy & UX for self-verification
   [\#4342](https://github.com/matrix-org/matrix-react-sdk/pull/4342)
 * QR code reciprocation
   [\#4334](https://github.com/matrix-org/matrix-react-sdk/pull/4334)
 * Fix Hangul typing does not work properly
   [\#4339](https://github.com/matrix-org/matrix-react-sdk/pull/4339)
 * Fix: dismiss setup encryption toast if cross-signing is ready
   [\#4336](https://github.com/matrix-org/matrix-react-sdk/pull/4336)
 * Fix read marker visibility for grouped events
   [\#4340](https://github.com/matrix-org/matrix-react-sdk/pull/4340)
 * Make all 'font-size's and 'line-height's rem
   [\#4305](https://github.com/matrix-org/matrix-react-sdk/pull/4305)
 * Fix spurious extra devices on registration
   [\#4337](https://github.com/matrix-org/matrix-react-sdk/pull/4337)
 * Fix the edit messager composer
   [\#4333](https://github.com/matrix-org/matrix-react-sdk/pull/4333)
 * Fix Room Settings Dialog Notifications tab icon
   [\#4321](https://github.com/matrix-org/matrix-react-sdk/pull/4321)
 * Fix various cases of React warnings by silencing them
   [\#4331](https://github.com/matrix-org/matrix-react-sdk/pull/4331)
 * Only apply padding to standard textual buttons (kind buttons)
   [\#4332](https://github.com/matrix-org/matrix-react-sdk/pull/4332)
 * Use console.log in place of console.warn for less warnings
   [\#4330](https://github.com/matrix-org/matrix-react-sdk/pull/4330)
 * Revert componentDidMount changes on breadcrumbs
   [\#4329](https://github.com/matrix-org/matrix-react-sdk/pull/4329)
 * Use new method for checking secret storage key
   [\#4309](https://github.com/matrix-org/matrix-react-sdk/pull/4309)
 * Label and use UNSAFE_componentWillMount to minimize warnings
   [\#4315](https://github.com/matrix-org/matrix-react-sdk/pull/4315)
 * Fix a number of minor code quality issues
   [\#4314](https://github.com/matrix-org/matrix-react-sdk/pull/4314)
 * Use componentDidMount in place of componentWillMount where possible
   [\#4313](https://github.com/matrix-org/matrix-react-sdk/pull/4313)
 * EventIndex: Mark the initial checkpoints for a full crawl.
   [\#4325](https://github.com/matrix-org/matrix-react-sdk/pull/4325)
 * Fix UserInfo e2e buttons to match Figma
   [\#4320](https://github.com/matrix-org/matrix-react-sdk/pull/4320)
 * Only auto-scroll to RoomTile when clicking on RoomTile or via shortcuts
   [\#4316](https://github.com/matrix-org/matrix-react-sdk/pull/4316)
 * Support SSO for interactive authentication
   [\#4292](https://github.com/matrix-org/matrix-react-sdk/pull/4292)
 * Fix /invite Slash Command
   [\#4328](https://github.com/matrix-org/matrix-react-sdk/pull/4328)
 * Fix jitsi popout URL
   [\#4326](https://github.com/matrix-org/matrix-react-sdk/pull/4326)
 * Use our own jitsi widget for the popout URL
   [\#4323](https://github.com/matrix-org/matrix-react-sdk/pull/4323)
 * Fix popout support for jitsi widgets
   [\#4319](https://github.com/matrix-org/matrix-react-sdk/pull/4319)
 * Fix: legacy verify user throwing error
   [\#4318](https://github.com/matrix-org/matrix-react-sdk/pull/4318)
 * Document settingDefaults
   [\#3046](https://github.com/matrix-org/matrix-react-sdk/pull/3046)
 * Fix Ctrl+/ for Finnish keyboard where it includes Shift
   [\#4317](https://github.com/matrix-org/matrix-react-sdk/pull/4317)
 * Rework SlashCommands to better expose aliases
   [\#4302](https://github.com/matrix-org/matrix-react-sdk/pull/4302)
 * Fix EventListSummary when RR rendering is disabled
   [\#4311](https://github.com/matrix-org/matrix-react-sdk/pull/4311)
 * Update link to css location.
   [\#4299](https://github.com/matrix-org/matrix-react-sdk/pull/4299)
 * Fix peeking keeping two timeline update mechanisms in play
   [\#4310](https://github.com/matrix-org/matrix-react-sdk/pull/4310)
 * Pass new secret storage key to bootstrap path
   [\#4308](https://github.com/matrix-org/matrix-react-sdk/pull/4308)
 * Show red shield for users that become unverified
   [\#4303](https://github.com/matrix-org/matrix-react-sdk/pull/4303)
 * Accessibility fixed for Event List Summary and Composer Format Bar
   [\#4295](https://github.com/matrix-org/matrix-react-sdk/pull/4295)
 * Support $riot: Templates for SSO/CAS urls in the welcome.html page
   [\#4279](https://github.com/matrix-org/matrix-react-sdk/pull/4279)
 * Added the /html command
   [\#4296](https://github.com/matrix-org/matrix-react-sdk/pull/4296)
 * EventIndex: Better logging on how many events are added.
   [\#4301](https://github.com/matrix-org/matrix-react-sdk/pull/4301)
 * Field: mark id as optional in propTypes
   [\#4307](https://github.com/matrix-org/matrix-react-sdk/pull/4307)
 * Fix view community link icon contrast
   [\#4254](https://github.com/matrix-org/matrix-react-sdk/pull/4254)
 * Remove underscore from Jitsi conference names
   [\#4304](https://github.com/matrix-org/matrix-react-sdk/pull/4304)
 * Refactor shield display logic; changed rules for DMs
   [\#4290](https://github.com/matrix-org/matrix-react-sdk/pull/4290)
 * Fix: bring back global thin scrollbars
   [\#4300](https://github.com/matrix-org/matrix-react-sdk/pull/4300)
 * Keyboard shortcuts: Escape cancel reply and fix Ctrl+K
   [\#4297](https://github.com/matrix-org/matrix-react-sdk/pull/4297)
 * Field: make id optional, generate one if not provided
   [\#4298](https://github.com/matrix-org/matrix-react-sdk/pull/4298)
 * Fix ugly scrollbars in TabbedView (settings), emojipicker and widgets
   [\#4293](https://github.com/matrix-org/matrix-react-sdk/pull/4293)
 * Rename secret storage force-reset variable to avoid confusion
   [\#4274](https://github.com/matrix-org/matrix-react-sdk/pull/4274)
 * Fix: can't dismiss unverified session toast when encryption hasn't been
   upgraded
   [\#4291](https://github.com/matrix-org/matrix-react-sdk/pull/4291)
 * Blank out UserInfo avatar when changing between members
   [\#4289](https://github.com/matrix-org/matrix-react-sdk/pull/4289)
 * Add cancel button to verification panel
   [\#4283](https://github.com/matrix-org/matrix-react-sdk/pull/4283)
 * Show ongoing verification request straight away when navigating to member
   [\#4284](https://github.com/matrix-org/matrix-react-sdk/pull/4284)
 * Fix: allow scrolling while window is not focused & remove scrollbar hack
   [\#4276](https://github.com/matrix-org/matrix-react-sdk/pull/4276)
 * Show whether backup key is cached
   [\#4287](https://github.com/matrix-org/matrix-react-sdk/pull/4287)
 * Rename unverified session toast
   [\#4285](https://github.com/matrix-org/matrix-react-sdk/pull/4285)
 * Fix: pick last active DM for verification request
   [\#4286](https://github.com/matrix-org/matrix-react-sdk/pull/4286)
 * Fix formatBar not hidden after highlight and backspacing some text
   [\#4269](https://github.com/matrix-org/matrix-react-sdk/pull/4269)

Changes in [2.3.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.3.1) (2020-04-01)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.3.0...v2.3.1)

 * Fix jitsi popout URL
   [\#4327](https://github.com/matrix-org/matrix-react-sdk/pull/4327)
 * Remove underscore from Jitsi conference names
   [\#4324](https://github.com/matrix-org/matrix-react-sdk/pull/4324)
 * Fix popout support for jitsi widgets
   [\#4322](https://github.com/matrix-org/matrix-react-sdk/pull/4322)

Changes in [2.3.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.3.0) (2020-03-30)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.3.0-rc.1...v2.3.0)

 * Upgrade JS SDK to 5.2.0

Changes in [2.3.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.3.0-rc.1) (2020-03-26)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.2.3...v2.3.0-rc.1)

 * Upgrade JS SDK to 5.2.0-rc.1
 * Add a flag to control whether cross-signing signatures are trusted
   [\#4277](https://github.com/matrix-org/matrix-react-sdk/pull/4277)
 * Update from Weblate
   [\#4282](https://github.com/matrix-org/matrix-react-sdk/pull/4282)
 * Update copy on SSSS symmetric upgrade toast
   [\#4281](https://github.com/matrix-org/matrix-react-sdk/pull/4281)
 * Wait for SSSS upgrade to complete
   [\#4270](https://github.com/matrix-org/matrix-react-sdk/pull/4270)
 * Update cross-signing verification copy and fix i18n
   [\#4278](https://github.com/matrix-org/matrix-react-sdk/pull/4278)
 * Fix soft-crash on bad permalinks
   [\#4280](https://github.com/matrix-org/matrix-react-sdk/pull/4280)
 * Fix: make self-verification wait for incoming request
   [\#4267](https://github.com/matrix-org/matrix-react-sdk/pull/4267)
 * Fall back to non-standard persisted api for Safari
   [\#4272](https://github.com/matrix-org/matrix-react-sdk/pull/4272)
 * Respond to backup key sharing requests
   [\#4275](https://github.com/matrix-org/matrix-react-sdk/pull/4275)
 * Log and display secret sharing cache state
   [\#4268](https://github.com/matrix-org/matrix-react-sdk/pull/4268)
 * Support sending config and ready events to capable widgets (Jitsi)
   [\#4266](https://github.com/matrix-org/matrix-react-sdk/pull/4266)
 * If cached keys are present in the key backup dialog, use them
   [\#4273](https://github.com/matrix-org/matrix-react-sdk/pull/4273)
 * Fix formatbar not hidden on highlighted message sent
   [\#4265](https://github.com/matrix-org/matrix-react-sdk/pull/4265)
 * Support Jitsi conferences sent/received on Riot Mobile and older Riot Webs
   [\#4252](https://github.com/matrix-org/matrix-react-sdk/pull/4252)
 * Use unified function to check cross-signing is ready
   [\#4263](https://github.com/matrix-org/matrix-react-sdk/pull/4263)
 * Migrate SSSS to symmetric
   [\#4224](https://github.com/matrix-org/matrix-react-sdk/pull/4224)
 * Migration to symmetric SSSS
   [\#4242](https://github.com/matrix-org/matrix-react-sdk/pull/4242)
 * Always display verification request toasts on top
   [\#4262](https://github.com/matrix-org/matrix-react-sdk/pull/4262)
 * Fix: assume SAS is supported when starting request with .start
   [\#4249](https://github.com/matrix-org/matrix-react-sdk/pull/4249)
 * Fix logout when Olm failed to load.
   [\#4261](https://github.com/matrix-org/matrix-react-sdk/pull/4261)
 * Improve naming of Jitsi conferences
   [\#4251](https://github.com/matrix-org/matrix-react-sdk/pull/4251)
 * Handle matrix.to user permalink in-room rather than solo
   [\#4245](https://github.com/matrix-org/matrix-react-sdk/pull/4245)
 * Fix: filter room list (again) by canonical and alternative aliases
   [\#4260](https://github.com/matrix-org/matrix-react-sdk/pull/4260)
 * EventIndex: Add some logging to the file panel populating.
   [\#4250](https://github.com/matrix-org/matrix-react-sdk/pull/4250)
 * Update from Weblate
   [\#4259](https://github.com/matrix-org/matrix-react-sdk/pull/4259)
 * Migrate RoomView to React Contexts in the hope for better temporal stability
   [\#4258](https://github.com/matrix-org/matrix-react-sdk/pull/4258)
 * Update WidgetUtils.js fix Jitsi path
   [\#4256](https://github.com/matrix-org/matrix-react-sdk/pull/4256)
 * Fix local jitsi build url fail and missing argument
   [\#4255](https://github.com/matrix-org/matrix-react-sdk/pull/4255)
 * Add shortcut CmdOrCtrl+. to toggle right panel
   [\#4244](https://github.com/matrix-org/matrix-react-sdk/pull/4244)
 * Improve Keyboard Shortcuts. Add alt-arrows & alt-shift-arrows
   [\#4241](https://github.com/matrix-org/matrix-react-sdk/pull/4241)
 * Bring back legacy verification by comparing public device keys
   [\#4240](https://github.com/matrix-org/matrix-react-sdk/pull/4240)
 * Searching: Return an empty result if the search term is an empty string.
   [\#4248](https://github.com/matrix-org/matrix-react-sdk/pull/4248)
 * Break continuation on showHiddenEvents-rendered events
   [\#4247](https://github.com/matrix-org/matrix-react-sdk/pull/4247)
 * Watch for show-RR settings changes, use room-specific and fix margins
   [\#4246](https://github.com/matrix-org/matrix-react-sdk/pull/4246)
 * Register Mac electron specific Cmd+, shortcut to User Settings
   [\#4243](https://github.com/matrix-org/matrix-react-sdk/pull/4243)
 * Use a local wrapper for Jitsi calls
   [\#4234](https://github.com/matrix-org/matrix-react-sdk/pull/4234)
 * Invite Dialog fixes
   [\#4233](https://github.com/matrix-org/matrix-react-sdk/pull/4233)
 * RoomPreviewBar word-break the sender name too
   [\#4239](https://github.com/matrix-org/matrix-react-sdk/pull/4239)
 * Report to the user when a key signature upload fails
   [\#4229](https://github.com/matrix-org/matrix-react-sdk/pull/4229)
 * pre-send megolm keys when possible when a user starts typing
   [\#4235](https://github.com/matrix-org/matrix-react-sdk/pull/4235)
 * we don't do mx_fadable anymore so get rid of broken RightPanel disabling
   [\#4238](https://github.com/matrix-org/matrix-react-sdk/pull/4238)
 * Fix left left panel overflowing vertically
   [\#4237](https://github.com/matrix-org/matrix-react-sdk/pull/4237)
 * Fix custom tags causing left panel to over-expand
   [\#4236](https://github.com/matrix-org/matrix-react-sdk/pull/4236)
 * Add Keyboard shortcuts dialog
   [\#4231](https://github.com/matrix-org/matrix-react-sdk/pull/4231)
 * Don't use buildkite agent to upload logs
   [\#4232](https://github.com/matrix-org/matrix-react-sdk/pull/4232)
 * Remove Gemini Scrollbars
   [\#4217](https://github.com/matrix-org/matrix-react-sdk/pull/4217)
 * Room Directory Explore Servers redesign
   [\#4209](https://github.com/matrix-org/matrix-react-sdk/pull/4209)
 * Fix redo keyboard shortcut on macOS
   [\#4110](https://github.com/matrix-org/matrix-react-sdk/pull/4110)
 * Fix: ensure local state for aliases doesn't get garbled up
   [\#4230](https://github.com/matrix-org/matrix-react-sdk/pull/4230)
 * Rename 'jump to bottom' to avoid ublock block
   [\#4208](https://github.com/matrix-org/matrix-react-sdk/pull/4208)
 * Restore key backup in background after complete security
   [\#4225](https://github.com/matrix-org/matrix-react-sdk/pull/4225)
 * Fix key backup trust text for cross-signing
   [\#4223](https://github.com/matrix-org/matrix-react-sdk/pull/4223)
 * Add default on config setting to control call button in composer
   [\#4227](https://github.com/matrix-org/matrix-react-sdk/pull/4227)
 * Fix: make alternative addresses UX less confusing
   [\#4221](https://github.com/matrix-org/matrix-react-sdk/pull/4221)
 * Wait for verification request on login
   [\#4222](https://github.com/matrix-org/matrix-react-sdk/pull/4222)
 * EventIndex: Add support to delete events from the index.
   [\#4204](https://github.com/matrix-org/matrix-react-sdk/pull/4204)
 * EventIndex: Remove a checkpoint if the HTTP request returns a 403.
   [\#4214](https://github.com/matrix-org/matrix-react-sdk/pull/4214)
 * Move to composer when typing letters with Shift held
   [\#4216](https://github.com/matrix-org/matrix-react-sdk/pull/4216)
 * Wrap large room names when previewing them
   [\#4213](https://github.com/matrix-org/matrix-react-sdk/pull/4213)
 * Rename Review Devices to Review Sessions
   [\#4219](https://github.com/matrix-org/matrix-react-sdk/pull/4219)
 * Fix typo in tabIndex to make React happy
   [\#4215](https://github.com/matrix-org/matrix-react-sdk/pull/4215)
 * Proof of concept for custom theme adding
   [\#4148](https://github.com/matrix-org/matrix-react-sdk/pull/4148)
 * Remove stuff that yarn install doesn't think we need
   [\#4205](https://github.com/matrix-org/matrix-react-sdk/pull/4205)
 * Declare jsx in tsconfig for IDEs
   [\#4207](https://github.com/matrix-org/matrix-react-sdk/pull/4207)
 * Fix: best-effort to join room without canonical alias over federation from
   room directory
   [\#4210](https://github.com/matrix-org/matrix-react-sdk/pull/4210)
 * Test for cross-signing homeserver support during login, toasts
   [\#4206](https://github.com/matrix-org/matrix-react-sdk/pull/4206)
 * Send verification request to a single device in a way compatible with non-
   cross-signing
   [\#4202](https://github.com/matrix-org/matrix-react-sdk/pull/4202)
 * Fixes for removing local alias
   [\#4199](https://github.com/matrix-org/matrix-react-sdk/pull/4199)
 * yarn upgrade
   [\#4201](https://github.com/matrix-org/matrix-react-sdk/pull/4201)
 * Support TypeScript for React components
   [\#4203](https://github.com/matrix-org/matrix-react-sdk/pull/4203)
 * When room name is changed, show both the old and new name
   [\#4183](https://github.com/matrix-org/matrix-react-sdk/pull/4183)

Changes in [2.2.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.2.3) (2020-03-17)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.2.3-rc.1...v2.2.3)

 * Upgrade JS SDK to 5.1.1
 * Add default on config setting to control call button in composer
   [\#4228](https://github.com/matrix-org/matrix-react-sdk/pull/4228)
 * Fix: make alternative addresses UX less confusing
   [\#4226](https://github.com/matrix-org/matrix-react-sdk/pull/4226)
 * Fix: best-effort to join room without canonical alias over federation from
   room directory
   [\#4211](https://github.com/matrix-org/matrix-react-sdk/pull/4211)

Changes in [2.2.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.2.3-rc.1) (2020-03-11)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.2.1...v2.2.3-rc.1)

 * Update from Weblate
   [\#4200](https://github.com/matrix-org/matrix-react-sdk/pull/4200)
 * Revert "enable 4s when accepting a verification request"
   [\#4198](https://github.com/matrix-org/matrix-react-sdk/pull/4198)
 * Don't remount main split children on rhs collapse
   [\#4197](https://github.com/matrix-org/matrix-react-sdk/pull/4197)
 * Add fallback label for canonical alias events that dont change anything
   [\#4195](https://github.com/matrix-org/matrix-react-sdk/pull/4195)
 * Immediately switch to verification dialog when clicking [Continue] from new
   session dialog
   [\#4196](https://github.com/matrix-org/matrix-react-sdk/pull/4196)
 * Enable 4S if needed when trying to verify or accepting verification
   [\#4194](https://github.com/matrix-org/matrix-react-sdk/pull/4194)
 * Remove extraneous tab stop from room tree view.
   [\#4193](https://github.com/matrix-org/matrix-react-sdk/pull/4193)
 * Remove v1 identity server fallbacks
   [\#4191](https://github.com/matrix-org/matrix-react-sdk/pull/4191)
 * Allow editing of alt_aliases according to MSC2432
   [\#4187](https://github.com/matrix-org/matrix-react-sdk/pull/4187)
 * Update timeline rendering of aliases
   [\#4189](https://github.com/matrix-org/matrix-react-sdk/pull/4189)
 * Fix mark as read button for dark theme
   [\#4190](https://github.com/matrix-org/matrix-react-sdk/pull/4190)
 * Un-linkify version in settings
   [\#4188](https://github.com/matrix-org/matrix-react-sdk/pull/4188)
 * Make Mjolnir stop more robust
   [\#4186](https://github.com/matrix-org/matrix-react-sdk/pull/4186)
 * Fix secret sharing names to match spec
   [\#4185](https://github.com/matrix-org/matrix-react-sdk/pull/4185)
 * Share secrets with another device on request
   [\#4172](https://github.com/matrix-org/matrix-react-sdk/pull/4172)
 * Fall back to to_device verification if other user hasn't uploaded cross-
   signing keys
   [\#4181](https://github.com/matrix-org/matrix-react-sdk/pull/4181)
 * Disable edits on redacted events
   [\#4182](https://github.com/matrix-org/matrix-react-sdk/pull/4182)
 * Use crypto.verification.request even when xsign is disabled
   [\#4180](https://github.com/matrix-org/matrix-react-sdk/pull/4180)
 * Reword the status for the currently indexing rooms.
   [\#4084](https://github.com/matrix-org/matrix-react-sdk/pull/4084)
 * Moved read receipts to the bottom of the message
   [\#3892](https://github.com/matrix-org/matrix-react-sdk/pull/3892)
 * Include a mark as read X under the scroll to unread button
   [\#4159](https://github.com/matrix-org/matrix-react-sdk/pull/4159)
 * Show the room presence indicator, even when cross-singing is enabled
   [\#4178](https://github.com/matrix-org/matrix-react-sdk/pull/4178)
 * Add local echo when clicking "Manually Verify" in unverified session dialog
   [\#4179](https://github.com/matrix-org/matrix-react-sdk/pull/4179)
 * link to matrix.org/security-disclosure-policy in help screen
   [\#4129](https://github.com/matrix-org/matrix-react-sdk/pull/4129)
 * only show verify button if user has uploaded cross-signing keys
   [\#4174](https://github.com/matrix-org/matrix-react-sdk/pull/4174)
 * Fix room alias references in topics
   [\#4176](https://github.com/matrix-org/matrix-react-sdk/pull/4176)
 * Fix not being able to start chats when you have no rooms
   [\#4177](https://github.com/matrix-org/matrix-react-sdk/pull/4177)
 * Disable registration flows on SSO servers
   [\#4170](https://github.com/matrix-org/matrix-react-sdk/pull/4170)
 * Don't group blank membership changes
   [\#4160](https://github.com/matrix-org/matrix-react-sdk/pull/4160)
 * Ensure the room list always triggers updates on itself
   [\#4175](https://github.com/matrix-org/matrix-react-sdk/pull/4175)
 * Fix composer touch bar flickering on keypress in Chrome
   [\#4173](https://github.com/matrix-org/matrix-react-sdk/pull/4173)
 * Document scrollpanel and BACAT scrolling
   [\#4167](https://github.com/matrix-org/matrix-react-sdk/pull/4167)
 * riot-desktop open SSO in browser so user doesn't have to auth twice
   [\#4158](https://github.com/matrix-org/matrix-react-sdk/pull/4158)
 * Lock login and registration buttons after submit
   [\#4165](https://github.com/matrix-org/matrix-react-sdk/pull/4165)
 * Suggest the server's results as lower quality in the invite dialog
   [\#4149](https://github.com/matrix-org/matrix-react-sdk/pull/4149)
 * Adjust scroll offset with relative scrolling
   [\#4166](https://github.com/matrix-org/matrix-react-sdk/pull/4166)
 * only automatically download in usercontent if user requested it
   [\#4163](https://github.com/matrix-org/matrix-react-sdk/pull/4163)
 * Fix having to decrypt & download in two steps
   [\#4162](https://github.com/matrix-org/matrix-react-sdk/pull/4162)
 * Use bash for release script
   [\#4161](https://github.com/matrix-org/matrix-react-sdk/pull/4161)
 * Revert to manual sorting for custom tag rooms
   [\#4157](https://github.com/matrix-org/matrix-react-sdk/pull/4157)
 * Fix the last char of people's names being cut off in the invite dialog
   [\#4150](https://github.com/matrix-org/matrix-react-sdk/pull/4150)
 * Add /whois SlashCommand to open UserInfo
   [\#4154](https://github.com/matrix-org/matrix-react-sdk/pull/4154)
 * word-break in pills and wrap the background correctly
   [\#4155](https://github.com/matrix-org/matrix-react-sdk/pull/4155)
 * don't show "This alias is available to use" if the alias is invalid
   [\#4153](https://github.com/matrix-org/matrix-react-sdk/pull/4153)
 * Don't ask to enable analytics when Do Not Track is enabled
   [\#4098](https://github.com/matrix-org/matrix-react-sdk/pull/4098)
 * Fix MELS not breaking on day boundaries regression
   [\#4152](https://github.com/matrix-org/matrix-react-sdk/pull/4152)
 * Fix Quote on search results page
   [\#4151](https://github.com/matrix-org/matrix-react-sdk/pull/4151)
 * Ensure errors when creating a DM are raised to the user
   [\#4144](https://github.com/matrix-org/matrix-react-sdk/pull/4144)
 * Add a Login button to startAnyRegistrationFlow
   [\#3829](https://github.com/matrix-org/matrix-react-sdk/pull/3829)
 * Use latest backup status directly rather than via state
   [\#4147](https://github.com/matrix-org/matrix-react-sdk/pull/4147)
 * Prefer account password variation of upgrading
   [\#4146](https://github.com/matrix-org/matrix-react-sdk/pull/4146)
 * Hide user avatars from screen readers in group and room user lists.
   [\#4145](https://github.com/matrix-org/matrix-react-sdk/pull/4145)
 * Room List sorting algorithms
   [\#4085](https://github.com/matrix-org/matrix-react-sdk/pull/4085)
 * Clear selected tags when disabling tag panel
   [\#4143](https://github.com/matrix-org/matrix-react-sdk/pull/4143)
 * Ignore cursor jumping shortcuts with shift
   [\#4142](https://github.com/matrix-org/matrix-react-sdk/pull/4142)
 * add local echo for clicking 'start verification' button
   [\#4138](https://github.com/matrix-org/matrix-react-sdk/pull/4138)
 * Fix formatting buttons not marking the composer as modified
   [\#4141](https://github.com/matrix-org/matrix-react-sdk/pull/4141)
 * Upgrade deps
   [\#4136](https://github.com/matrix-org/matrix-react-sdk/pull/4136)
 * Remove debug line from Analytics
   [\#4137](https://github.com/matrix-org/matrix-react-sdk/pull/4137)
 * Use the right function for creating binary verification QR codes
   [\#4140](https://github.com/matrix-org/matrix-react-sdk/pull/4140)
 * Ensure verification QR codes use the right buffer size
   [\#4139](https://github.com/matrix-org/matrix-react-sdk/pull/4139)
 * Don't prefix QR codes with the length of the static marker string
   [\#4128](https://github.com/matrix-org/matrix-react-sdk/pull/4128)
 * Solve fixed-width digit display in flowed text
   [\#4127](https://github.com/matrix-org/matrix-react-sdk/pull/4127)
 * Limit UserInfo Displayname to 3 lines to get rid of scrollbars
   [\#4135](https://github.com/matrix-org/matrix-react-sdk/pull/4135)

Changes in [2.2.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.2.1) (2020-03-04)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.2.0...v2.2.1)

 * Adjust scroll offset with relative scrolling
   [\#4171](https://github.com/matrix-org/matrix-react-sdk/pull/4171)
 * Disable registration flows on SSO servers
   [\#4169](https://github.com/matrix-org/matrix-react-sdk/pull/4169)

Changes in [2.2.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.2.0) (2020-03-02)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.2.0-rc.1...v2.2.0)

 * Upgrade JS SDK to 5.1.0
 * Ignore cursor jumping shortcuts with shift
   [\#4142](https://github.com/matrix-org/matrix-react-sdk/pull/4142)

Changes in [2.2.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.2.0-rc.1) (2020-02-26)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.1.1...v2.2.0-rc.1)

 * Upgrade JS SDK to 5.1.0-rc.1
 * Fix message context menu breaking on invalid m.room.pinned_events event
   [\#4133](https://github.com/matrix-org/matrix-react-sdk/pull/4133)
 * Update from Weblate
   [\#4134](https://github.com/matrix-org/matrix-react-sdk/pull/4134)
 * Notify platform of language changes
   [\#4121](https://github.com/matrix-org/matrix-react-sdk/pull/4121)
 * Handle errors when previewing rooms more safely
   [\#4132](https://github.com/matrix-org/matrix-react-sdk/pull/4132)
 * Don't try to collapse zero events with a group
   [\#4131](https://github.com/matrix-org/matrix-react-sdk/pull/4131)
 * Don't print errors when the tab is used with no autocomplete present
   [\#4130](https://github.com/matrix-org/matrix-react-sdk/pull/4130)
 * Improve UI feedback while waiting for network
   [\#4126](https://github.com/matrix-org/matrix-react-sdk/pull/4126)
 * Ensure DMs tagged outside of account data work in the invite dialog
   [\#4123](https://github.com/matrix-org/matrix-react-sdk/pull/4123)
 * Show a warning dialog when user indicates a new session wasn't them
   [\#4125](https://github.com/matrix-org/matrix-react-sdk/pull/4125)
 * Show cancel events as hidden events if we wouldn't usually render them
   [\#4120](https://github.com/matrix-org/matrix-react-sdk/pull/4120)
 * Collapsed room list has unaligned room tiles #4030 version 2
   [\#4033](https://github.com/matrix-org/matrix-react-sdk/pull/4033)
 * Check for cross-signing homeserver support
   [\#4118](https://github.com/matrix-org/matrix-react-sdk/pull/4118)
 * Don't leak if show_sas never comes (or already came)
   [\#4119](https://github.com/matrix-org/matrix-react-sdk/pull/4119)
 * Add verification request viewer in devtools
   [\#4106](https://github.com/matrix-org/matrix-react-sdk/pull/4106)
 * update phase when request prop changes
   [\#4117](https://github.com/matrix-org/matrix-react-sdk/pull/4117)
 * Handle file downloading locally in electron rather than sending to browser
   [\#4113](https://github.com/matrix-org/matrix-react-sdk/pull/4113)
 * Remove unused CIDER setting watcher
   [\#4116](https://github.com/matrix-org/matrix-react-sdk/pull/4116)
 * Use alt_aliases for pills and autocomplete
   [\#4102](https://github.com/matrix-org/matrix-react-sdk/pull/4102)
 * Add shortcuts for beginning / end of composer
   [\#4108](https://github.com/matrix-org/matrix-react-sdk/pull/4108)
 * Update from Weblate
   [\#4115](https://github.com/matrix-org/matrix-react-sdk/pull/4115)
 * Revert "Fix escaped markdown passing backslashes through"
   [\#4114](https://github.com/matrix-org/matrix-react-sdk/pull/4114)
 * Fix a couple of React warnings/errors
   [\#4112](https://github.com/matrix-org/matrix-react-sdk/pull/4112)
 * Fix two big DOM leaks which were locking Chrome solid.
   [\#4111](https://github.com/matrix-org/matrix-react-sdk/pull/4111)
 * Filter out empty strings when pasting IDs into the invite dialog
   [\#4109](https://github.com/matrix-org/matrix-react-sdk/pull/4109)
 * Remove buildkite pipeline
   [\#4107](https://github.com/matrix-org/matrix-react-sdk/pull/4107)
 * Use binary packing for verification QR codes
   [\#4091](https://github.com/matrix-org/matrix-react-sdk/pull/4091)
 * Fix several small bugs with the invite/DM dialog
   [\#4099](https://github.com/matrix-org/matrix-react-sdk/pull/4099)
 * ignore e2e tests node_modules during linting
   [\#4103](https://github.com/matrix-org/matrix-react-sdk/pull/4103)
 * Apply null-guard to room pills for when we can't fetch the room
   [\#4104](https://github.com/matrix-org/matrix-react-sdk/pull/4104)
 * Fix theme being overridden to light even after login is completed
   [\#4105](https://github.com/matrix-org/matrix-react-sdk/pull/4105)
 * Fix bug where SSSS could be overwritten if user never cross-signs
   [\#4100](https://github.com/matrix-org/matrix-react-sdk/pull/4100)
 * Accept canonical alias for pills
   [\#4096](https://github.com/matrix-org/matrix-react-sdk/pull/4096)
 * Fix: don't advertise ability to scan a QR code for verification
   [\#4094](https://github.com/matrix-org/matrix-react-sdk/pull/4094)
 * Fixes for printing event indexing stats.
   [\#4082](https://github.com/matrix-org/matrix-react-sdk/pull/4082)
 * Remove exec so release script continues
   [\#4095](https://github.com/matrix-org/matrix-react-sdk/pull/4095)
 * Use Persistent Storage where possible
   [\#4092](https://github.com/matrix-org/matrix-react-sdk/pull/4092)
 * Fix user page (missing null check)
   [\#4088](https://github.com/matrix-org/matrix-react-sdk/pull/4088)
 * Cancel verification request on dialog close
   [\#4081](https://github.com/matrix-org/matrix-react-sdk/pull/4081)
 * Fix various memory leaks due to method re-binding
   [\#4093](https://github.com/matrix-org/matrix-react-sdk/pull/4093)
 * Fix share message context menu option keyboard a11y
   [\#4073](https://github.com/matrix-org/matrix-react-sdk/pull/4073)

Changes in [2.1.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.1.1) (2020-02-19)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.1.0...v2.1.1)

 * show spinner while loading local aliases
   [\#4090](https://github.com/matrix-org/matrix-react-sdk/pull/4090)
 * Don't index key verification events.
   [\#4083](https://github.com/matrix-org/matrix-react-sdk/pull/4083)
 * Get rid of dependence on usercontent.riot.im
   [\#4046](https://github.com/matrix-org/matrix-react-sdk/pull/4046)
 * also detect aliases using new /aliases endpoint for room access settings
   [\#4089](https://github.com/matrix-org/matrix-react-sdk/pull/4089)
 * get local aliases from /aliases in room settings
   [\#4086](https://github.com/matrix-org/matrix-react-sdk/pull/4086)
 * Start verification sessions in an E2E DM where possible
   [\#4080](https://github.com/matrix-org/matrix-react-sdk/pull/4080)
 * Only show supported verification methods
   [\#4077](https://github.com/matrix-org/matrix-react-sdk/pull/4077)
 * Use local echo in VerificationRequest for accepting/declining a verification
   request
   [\#4072](https://github.com/matrix-org/matrix-react-sdk/pull/4072)
 * Report installed PWA, touch input status in rageshakes, analytics
   [\#4078](https://github.com/matrix-org/matrix-react-sdk/pull/4078)
 * refactor event grouping into separate helper classes
   [\#4059](https://github.com/matrix-org/matrix-react-sdk/pull/4059)
 * Find existing requests when starting a new verification request
   [\#4070](https://github.com/matrix-org/matrix-react-sdk/pull/4070)
 * Always speak the full text of the typing indicator when it updates.
   [\#4074](https://github.com/matrix-org/matrix-react-sdk/pull/4074)
 * Fix escaped markdown passing backslashes through
   [\#4008](https://github.com/matrix-org/matrix-react-sdk/pull/4008)
 * Move the sidebar to below the sidebar tab buttons for screen readers.
   [\#4071](https://github.com/matrix-org/matrix-react-sdk/pull/4071)

Changes in [2.1.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.1.0) (2020-02-17)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.1.0-rc.2...v2.1.0)

 * Automate SDK dep upgrades for release
   [\#4076](https://github.com/matrix-org/matrix-react-sdk/pull/4076)

Changes in [2.1.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.1.0-rc.2) (2020-02-13)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.1.0-rc.1...v2.1.0-rc.2)

 * Fix error in previous attempt to upgrade JS SDK 

Changes in [2.1.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.1.0-rc.1) (2020-02-13)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.0.0...v2.1.0-rc.1)

 * Upgrade JS SDK to 5.0.0-rc.1
 * don't show tooltips on big icons
   [\#4067](https://github.com/matrix-org/matrix-react-sdk/pull/4067)
 * Update from Weblate
   [\#4069](https://github.com/matrix-org/matrix-react-sdk/pull/4069)
 * Fix sending of visit variables to Matomo
   [\#4068](https://github.com/matrix-org/matrix-react-sdk/pull/4068)
 * Use embedded piwik script rather than piwik.js to respect CSP
   [\#4066](https://github.com/matrix-org/matrix-react-sdk/pull/4066)
 * remove methods arg to requestVerification(DM)
   [\#4058](https://github.com/matrix-org/matrix-react-sdk/pull/4058)
 * Check for null config settings a bit safer
   [\#4061](https://github.com/matrix-org/matrix-react-sdk/pull/4061)
 * Score user ID searches higher when they match nearly exactly
   [\#4060](https://github.com/matrix-org/matrix-react-sdk/pull/4060)
 * Fix uncentered letter inside avatar for currently typing users
   [\#4051](https://github.com/matrix-org/matrix-react-sdk/pull/4051)
 * Disable 'start' button after clicking in VerificationPanel
   [\#4065](https://github.com/matrix-org/matrix-react-sdk/pull/4065)
 * Fixed bug where key reset didn't always return the right key
   [\#4057](https://github.com/matrix-org/matrix-react-sdk/pull/4057)
 * Don't render avatars in pills for screen readers.
   [\#4062](https://github.com/matrix-org/matrix-react-sdk/pull/4062)
 * Make QR self-verification compatible with RiotX
   [\#4044](https://github.com/matrix-org/matrix-react-sdk/pull/4044)
 * Verify single device from other user in right panel & Not Trusted dialog
   [\#4043](https://github.com/matrix-org/matrix-react-sdk/pull/4043)
 * Disable verification buttons after clicking to avoid double submission
   [\#4049](https://github.com/matrix-org/matrix-react-sdk/pull/4049)
 * Verification toast fixes
   [\#4048](https://github.com/matrix-org/matrix-react-sdk/pull/4048)
 * Use EncryptionPanel everywhere, part I
   [\#4042](https://github.com/matrix-org/matrix-react-sdk/pull/4042)
 * quick fix for cross-signing reset bug
   [\#4056](https://github.com/matrix-org/matrix-react-sdk/pull/4056)
 * Fix error message rendering for key entry
   [\#4055](https://github.com/matrix-org/matrix-react-sdk/pull/4055)
 * Fix recaptcha blocked by CSP for non-SSL origins
   [\#4052](https://github.com/matrix-org/matrix-react-sdk/pull/4052)
 * Fix watcher for showTypingNotifications setting
   [\#4054](https://github.com/matrix-org/matrix-react-sdk/pull/4054)
 * Allow custom hs url submission on enter
   [\#4053](https://github.com/matrix-org/matrix-react-sdk/pull/4053)
 * Support keepSecretStoragePassphraseForSession at the config level too
   [\#4045](https://github.com/matrix-org/matrix-react-sdk/pull/4045)
 * Add setting to allow hiding of typing indicator
   [\#4047](https://github.com/matrix-org/matrix-react-sdk/pull/4047)
 * Button to reset cross-signing and SSSS keys
   [\#4041](https://github.com/matrix-org/matrix-react-sdk/pull/4041)
 * Use forms to wrap password fields so Chrome doesn't go wild
   [\#3974](https://github.com/matrix-org/matrix-react-sdk/pull/3974)
 * Update QR code rendering to support VerificationRequests
   [\#4001](https://github.com/matrix-org/matrix-react-sdk/pull/4001)
 * Differentiate AccessSecretStorageDialog dismiss dialog based on which key we
   want to read
   [\#4038](https://github.com/matrix-org/matrix-react-sdk/pull/4038)
 * Only emit in RoomViewStore when state actually changes
   [\#4039](https://github.com/matrix-org/matrix-react-sdk/pull/4039)
 * Mark AccessSecretStorageDialog to not be closed by clicking background
   [\#4029](https://github.com/matrix-org/matrix-react-sdk/pull/4029)
 * Let pointer events fall through to scroll button
   [\#4037](https://github.com/matrix-org/matrix-react-sdk/pull/4037)
 * Improve event indexing status strings for translation
   [\#4035](https://github.com/matrix-org/matrix-react-sdk/pull/4035)
 * Button size reviewed for word consuming languages & Settings showing devices
   are a bit too tight
   [\#4024](https://github.com/matrix-org/matrix-react-sdk/pull/4024)
 * Only enumerate settings handlers which are supported
   [\#4034](https://github.com/matrix-org/matrix-react-sdk/pull/4034)
 * Fix listener removal in verification tile
   [\#4036](https://github.com/matrix-org/matrix-react-sdk/pull/4036)
 * Do not show alarming red shields on large encrypted rooms for your own
   device
   [\#4028](https://github.com/matrix-org/matrix-react-sdk/pull/4028)
 * Add a class for styling room directory permissions
   [\#4007](https://github.com/matrix-org/matrix-react-sdk/pull/4007)
 * double-check user verification
   [\#4010](https://github.com/matrix-org/matrix-react-sdk/pull/4010)
 * Use minimist instead of optimist as it is deprecated
   [\#4031](https://github.com/matrix-org/matrix-react-sdk/pull/4031)
 * SettingsStore, use a counter instead of wall clock for watcher ids
   [\#4032](https://github.com/matrix-org/matrix-react-sdk/pull/4032)
 * Don't crash immediately if the room directory chunk is null/empty
   [\#4027](https://github.com/matrix-org/matrix-react-sdk/pull/4027)
 * Fix verification toast to close at 0s
   [\#3998](https://github.com/matrix-org/matrix-react-sdk/pull/3998)
 * Fix listener leak in TagPanel
   [\#4026](https://github.com/matrix-org/matrix-react-sdk/pull/4026)
 * Update from Weblate
   [\#4025](https://github.com/matrix-org/matrix-react-sdk/pull/4025)
 * Honour the isLogin flag in theme.js
   [\#4023](https://github.com/matrix-org/matrix-react-sdk/pull/4023)
 * ManageEventIndexDialog: Show how many rooms are being currently crawled.
   [\#4022](https://github.com/matrix-org/matrix-react-sdk/pull/4022)
 * Advertise that we can scan QR codes even though we can't
   [\#4021](https://github.com/matrix-org/matrix-react-sdk/pull/4021)
 * Checkpoint addition fixes and return of the crawler sleep time setting.
   [\#4020](https://github.com/matrix-org/matrix-react-sdk/pull/4020)
 * Truncate SAS emoji labels to fit
   [\#4018](https://github.com/matrix-org/matrix-react-sdk/pull/4018)
 * Apply copy edits to security setup flow
   [\#4017](https://github.com/matrix-org/matrix-react-sdk/pull/4017)
 * Fix user trust text to match what was checked
   [\#4016](https://github.com/matrix-org/matrix-react-sdk/pull/4016)
 * Fix size of invite only icon
   [\#4015](https://github.com/matrix-org/matrix-react-sdk/pull/4015)
 * Add temporary feature flag to control padlocks
   [\#4013](https://github.com/matrix-org/matrix-react-sdk/pull/4013)
 * Add an override for the theme
   [\#4014](https://github.com/matrix-org/matrix-react-sdk/pull/4014)
 * Add title to complete security loading
   [\#4011](https://github.com/matrix-org/matrix-react-sdk/pull/4011)
 * Only display the first zxcvbn warning/suggestion
   [\#4012](https://github.com/matrix-org/matrix-react-sdk/pull/4012)
 * Log exceptions from accessSecretStorage
   [\#4009](https://github.com/matrix-org/matrix-react-sdk/pull/4009)
 * Add advanced option to keep secret storage in memory for session
   [\#3995](https://github.com/matrix-org/matrix-react-sdk/pull/3995)
 * Add shields to member list, move power label to text
   [\#4006](https://github.com/matrix-org/matrix-react-sdk/pull/4006)
 * Make encryption events into bubble-style tiles
   [\#4005](https://github.com/matrix-org/matrix-react-sdk/pull/4005)
 * Update copy when the user verifies their own devices
   [\#4000](https://github.com/matrix-org/matrix-react-sdk/pull/4000)
 * Use Sets instead of array scans and simplify hiding of invalid users when
   inviting
   [\#4004](https://github.com/matrix-org/matrix-react-sdk/pull/4004)
 * Fix room completion for invited rooms and upgraded rooms
   [\#4003](https://github.com/matrix-org/matrix-react-sdk/pull/4003)
 * Make shields in UserInfo black if user isn't verified
   [\#3999](https://github.com/matrix-org/matrix-react-sdk/pull/3999)
 * Change verify user text
   [\#3994](https://github.com/matrix-org/matrix-react-sdk/pull/3994)
 * Disable all inputs in login form while busy, not just the submit button
   [\#3996](https://github.com/matrix-org/matrix-react-sdk/pull/3996)
 * fix SAS dialog width
   [\#3993](https://github.com/matrix-org/matrix-react-sdk/pull/3993)
 * Update placeholder in the composer when it gets changed
   [\#3990](https://github.com/matrix-org/matrix-react-sdk/pull/3990)
 * Send initial device display name on register
   [\#3992](https://github.com/matrix-org/matrix-react-sdk/pull/3992)
 * Update QR code handling for new spec
   [\#3959](https://github.com/matrix-org/matrix-react-sdk/pull/3959)
 * Apply the Olympic effect to SAS Emoji Verification
   [\#3989](https://github.com/matrix-org/matrix-react-sdk/pull/3989)
 * Pass an ID to the <Field/> as needed and fix div inside p nesting
   [\#3988](https://github.com/matrix-org/matrix-react-sdk/pull/3988)
 * Update user info for device and trust changes
   [\#3987](https://github.com/matrix-org/matrix-react-sdk/pull/3987)
 * Relax secret storage account data check
   [\#3985](https://github.com/matrix-org/matrix-react-sdk/pull/3985)
 * Fix various races that prevented the right panel being in the right state
   for verifications
   [\#3984](https://github.com/matrix-org/matrix-react-sdk/pull/3984)
 * Fix verifying individual devices
   [\#3986](https://github.com/matrix-org/matrix-react-sdk/pull/3986)
 * Update from Weblate
   [\#3982](https://github.com/matrix-org/matrix-react-sdk/pull/3982)
 * Replace device with session in UI text
   [\#3980](https://github.com/matrix-org/matrix-react-sdk/pull/3980)
 * Add missing await causing promises to be leaked as room IDs
   [\#3981](https://github.com/matrix-org/matrix-react-sdk/pull/3981)
 * Change new session toast to unverified
   [\#3978](https://github.com/matrix-org/matrix-react-sdk/pull/3978)
 * Replace Verify button in UserInfo verification with "Learn more"
   [\#3975](https://github.com/matrix-org/matrix-react-sdk/pull/3975)
 * Don't peek until the matrix client is ready
   [\#3979](https://github.com/matrix-org/matrix-react-sdk/pull/3979)
 * Verification: don't block UI update on verification finishing
   [\#3976](https://github.com/matrix-org/matrix-react-sdk/pull/3976)
 * Adjust icons with in person with design
   [\#3977](https://github.com/matrix-org/matrix-react-sdk/pull/3977)
 * Update copy for right panel verification
   [\#3973](https://github.com/matrix-org/matrix-react-sdk/pull/3973)
 * Check for timeline in pre-join UISI path
   [\#3972](https://github.com/matrix-org/matrix-react-sdk/pull/3972)
 * Let users paste text if they've already started filtering invite targets
   [\#3970](https://github.com/matrix-org/matrix-react-sdk/pull/3970)
 * Filter event types when deciding on activity metrics for DM suggestions
   [\#3969](https://github.com/matrix-org/matrix-react-sdk/pull/3969)
 * Revert a change causing a login loop
   [\#3971](https://github.com/matrix-org/matrix-react-sdk/pull/3971)
 * Improve the docs for the event index and fix some type hints.
   [\#3960](https://github.com/matrix-org/matrix-react-sdk/pull/3960)
 * Automatically focus on the invite dialog input
   [\#3968](https://github.com/matrix-org/matrix-react-sdk/pull/3968)
 * Restore key backup in Complete Security dialog
   [\#3966](https://github.com/matrix-org/matrix-react-sdk/pull/3966)
 * Right Panel Verification improvements
   [\#3967](https://github.com/matrix-org/matrix-react-sdk/pull/3967)
 * Cross Signing Right Panel Verification Decoration
   [\#3950](https://github.com/matrix-org/matrix-react-sdk/pull/3950)
 * Passing refireParams actually prevented this from working
   [\#3965](https://github.com/matrix-org/matrix-react-sdk/pull/3965)
 * Start new key backup in security setup flow
   [\#3964](https://github.com/matrix-org/matrix-react-sdk/pull/3964)
 * Tweak styling of the unread indicator circle.
   [\#3958](https://github.com/matrix-org/matrix-react-sdk/pull/3958)
 * Add device IDs in user info tooltips
   [\#3963](https://github.com/matrix-org/matrix-react-sdk/pull/3963)
 * Improve encryption upgrade on login flow
   [\#3962](https://github.com/matrix-org/matrix-react-sdk/pull/3962)
 * Switch back to legacy decorators
   [\#3961](https://github.com/matrix-org/matrix-react-sdk/pull/3961)
 * Style bridge settings tab according to design
   [\#3894](https://github.com/matrix-org/matrix-react-sdk/pull/3894)
 * Fix skinning and babel targets
   [\#3957](https://github.com/matrix-org/matrix-react-sdk/pull/3957)
 * Enable cross-signing lab when key in storage
   [\#3956](https://github.com/matrix-org/matrix-react-sdk/pull/3956)
 * Add new session verification details dialog
   [\#3953](https://github.com/matrix-org/matrix-react-sdk/pull/3953)
 * Fix issue where we don't notice if our own devices shouldn't be trusted
   [\#3949](https://github.com/matrix-org/matrix-react-sdk/pull/3949)
 * Add separate component for post-auth security flows
   [\#3951](https://github.com/matrix-org/matrix-react-sdk/pull/3951)
 * Add more logging to settings watchers
   [\#3952](https://github.com/matrix-org/matrix-react-sdk/pull/3952)
 * Use https for recaptcha for all non-http protocols
   [\#3944](https://github.com/matrix-org/matrix-react-sdk/pull/3944)
 * Add status and management UI for the event indexer
   [\#3672](https://github.com/matrix-org/matrix-react-sdk/pull/3672)
 * Remove DM icons if `feature_cross_signing` is enabled; hide padlocks in DM
   room headers
   [\#3948](https://github.com/matrix-org/matrix-react-sdk/pull/3948)
 * Stop rogue verification toast if you verify during login
   [\#3943](https://github.com/matrix-org/matrix-react-sdk/pull/3943)
 * Show incoming verification requests in the 'complete security' phase
   [\#3942](https://github.com/matrix-org/matrix-react-sdk/pull/3942)
 * Dismiss logged out device toasts
   [\#3941](https://github.com/matrix-org/matrix-react-sdk/pull/3941)
 * Verification nag toasts
   [\#3940](https://github.com/matrix-org/matrix-react-sdk/pull/3940)
 * Update from Weblate
   [\#3947](https://github.com/matrix-org/matrix-react-sdk/pull/3947)
 * Remember password for e2e bootstrapping
   [\#3939](https://github.com/matrix-org/matrix-react-sdk/pull/3939)
 * fix compound emoji
   [\#3946](https://github.com/matrix-org/matrix-react-sdk/pull/3946)
 * Setup flow for cross-signing on login / registration
   [\#3937](https://github.com/matrix-org/matrix-react-sdk/pull/3937)
 * Update profile avatar letter size
   [\#3935](https://github.com/matrix-org/matrix-react-sdk/pull/3935)
 * Hide default encryption algorithm
   [\#3936](https://github.com/matrix-org/matrix-react-sdk/pull/3936)
 * Resolve default export warnings from Webpack
   [\#3938](https://github.com/matrix-org/matrix-react-sdk/pull/3938)
 * Add null check for cross-signing info in verification panel
   [\#3934](https://github.com/matrix-org/matrix-react-sdk/pull/3934)
 * Add trace logging to figure out which component is causing weird events
   [\#3926](https://github.com/matrix-org/matrix-react-sdk/pull/3926)
 * Remove user lists feature flag, making it the default
   [\#3906](https://github.com/matrix-org/matrix-react-sdk/pull/3906)
 * Last bit of polish for user lists
   [\#3925](https://github.com/matrix-org/matrix-react-sdk/pull/3925)
 * QR code verification
   [\#3871](https://github.com/matrix-org/matrix-react-sdk/pull/3871)
 * Do less unnecessary work on CI
   [\#3933](https://github.com/matrix-org/matrix-react-sdk/pull/3933)
 * Re-enable stylelint on CI
   [\#3932](https://github.com/matrix-org/matrix-react-sdk/pull/3932)
 * Design pass for room icons
   [\#3931](https://github.com/matrix-org/matrix-react-sdk/pull/3931)
 * Populate the file panel using the event index if available.
   [\#3858](https://github.com/matrix-org/matrix-react-sdk/pull/3858)
 * Split AsyncWrapper out from Modal
   [\#3928](https://github.com/matrix-org/matrix-react-sdk/pull/3928)
 * Fix error in verification code on develop
   [\#3930](https://github.com/matrix-org/matrix-react-sdk/pull/3930)
 * Seperates out the padlock icon, and adds a tooltip
   [\#3929](https://github.com/matrix-org/matrix-react-sdk/pull/3929)
 * Cross Signing redesign for composer
   [\#3910](https://github.com/matrix-org/matrix-react-sdk/pull/3910)
 * Fix verifying your own devices with to_device messages
   [\#3927](https://github.com/matrix-org/matrix-react-sdk/pull/3927)
 * Room list reflects encryption state
   [\#3908](https://github.com/matrix-org/matrix-react-sdk/pull/3908)
 * Make the entire User Info scrollable, sticky close button
   [\#3914](https://github.com/matrix-org/matrix-react-sdk/pull/3914)
 * Remove riot logo from the security setup screens
   [\#3916](https://github.com/matrix-org/matrix-react-sdk/pull/3916)
 * Only say the session is verified if it is now verified
   [\#3917](https://github.com/matrix-org/matrix-react-sdk/pull/3917)
 * Hide password section if you can't change your password
   [\#3924](https://github.com/matrix-org/matrix-react-sdk/pull/3924)
 * Ensure a plaintext version of the composer ends up on the clipboard
   [\#3922](https://github.com/matrix-org/matrix-react-sdk/pull/3922)
 * Move & upgrade babel runtime into dependencies (like it wants)
   [\#3920](https://github.com/matrix-org/matrix-react-sdk/pull/3920)
 * Don't list every single alias when there's many
   [\#3918](https://github.com/matrix-org/matrix-react-sdk/pull/3918)
 * Try to populate user IDs even when the server's directory fails us
   [\#3907](https://github.com/matrix-org/matrix-react-sdk/pull/3907)
 * Remove .event property on verification request
   [\#3912](https://github.com/matrix-org/matrix-react-sdk/pull/3912)
 * Attempt to fix Safari + VoiceOver misunderstanding the timeline list
   [\#3911](https://github.com/matrix-org/matrix-react-sdk/pull/3911)
 * Enable encryption in DMs with device keys
   [\#3913](https://github.com/matrix-org/matrix-react-sdk/pull/3913)
 * Fix scrollable area and padding in user lists dialog
   [\#3905](https://github.com/matrix-org/matrix-react-sdk/pull/3905)
 * Add Reject & Ignore user button to invites view
   [\#3909](https://github.com/matrix-org/matrix-react-sdk/pull/3909)
 * Fix paragraph-awareness of the composer formatting features
   [\#3891](https://github.com/matrix-org/matrix-react-sdk/pull/3891)
 * Updated visuals for cross-signing bootstrap
   [\#3903](https://github.com/matrix-org/matrix-react-sdk/pull/3903)
 * Implement some parts of new cross signing bootstrap UI
   [\#3897](https://github.com/matrix-org/matrix-react-sdk/pull/3897)
 * Treat links as external in report content admin message
   [\#3904](https://github.com/matrix-org/matrix-react-sdk/pull/3904)
 * Be consistent about our settings svg, free the other one
   [\#3902](https://github.com/matrix-org/matrix-react-sdk/pull/3902)
 * Change prepublish script to prepare
   [\#3899](https://github.com/matrix-org/matrix-react-sdk/pull/3899)
 * Remove the react-sdk version
   [\#3901](https://github.com/matrix-org/matrix-react-sdk/pull/3901)
 * BuildKite: Retry end-to-end tests automatically once if they fail
   [\#3900](https://github.com/matrix-org/matrix-react-sdk/pull/3900)
 * Slash Command improvements around sending messages with leading slash
   [\#3893](https://github.com/matrix-org/matrix-react-sdk/pull/3893)
 * Support admin configurable message when reporting content
   [\#3898](https://github.com/matrix-org/matrix-react-sdk/pull/3898)
 * Don't warn on unverified users; ensured behavior stays the same with flags
   off
   [\#3896](https://github.com/matrix-org/matrix-react-sdk/pull/3896)
 * Fix roving room list for resizer and ff tabstop a11y
   [\#3895](https://github.com/matrix-org/matrix-react-sdk/pull/3895)
 * Verify individual messages via cross-signing
   [\#3875](https://github.com/matrix-org/matrix-react-sdk/pull/3875)
 * Fix layering of dependencies in riot-web and e2e tests
   [\#3882](https://github.com/matrix-org/matrix-react-sdk/pull/3882)
 * Implement Roving Tab Index and Room List as TreeView
   [\#3844](https://github.com/matrix-org/matrix-react-sdk/pull/3844)
 * Move room header shields over the avatar for the room
   [\#3888](https://github.com/matrix-org/matrix-react-sdk/pull/3888)
 * Fix toast icon to prevent clipping
   [\#3890](https://github.com/matrix-org/matrix-react-sdk/pull/3890)
 * Only show devices and verify actions in E2EE rooms
   [\#3889](https://github.com/matrix-org/matrix-react-sdk/pull/3889)
 * Change user info verification checks to use cross-signing
   [\#3887](https://github.com/matrix-org/matrix-react-sdk/pull/3887)
 * Fix click-to-ping not inserting colon if composer non-empty
   [\#3886](https://github.com/matrix-org/matrix-react-sdk/pull/3886)
 * Fix emoticon space completion for upper case emoticons like :D xD
   [\#3884](https://github.com/matrix-org/matrix-react-sdk/pull/3884)
 * Repair cross-signing panel with async status
   [\#3880](https://github.com/matrix-org/matrix-react-sdk/pull/3880)
 * Remove temporary key backup button
   [\#3878](https://github.com/matrix-org/matrix-react-sdk/pull/3878)
 * Score users who have recently spoken higher in invite suggestions
   [\#3866](https://github.com/matrix-org/matrix-react-sdk/pull/3866)
 * Initial support for verification in right panel
   [\#3796](https://github.com/matrix-org/matrix-react-sdk/pull/3796)
 * Prevent the invite dialog from jumping around when elements change
   [\#3868](https://github.com/matrix-org/matrix-react-sdk/pull/3868)
 * Add prepublish script
   [\#3876](https://github.com/matrix-org/matrix-react-sdk/pull/3876)

Changes in [2.0.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.0.0) (2020-01-27)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.0.0-rc.2...v2.0.0)

 * Ensure a plaintext version of the composer ends up on the clipboard
   [\#3923](https://github.com/matrix-org/matrix-react-sdk/pull/3923)
 * Move & upgrade babel runtime into dependencies (like it wants)
   [\#3921](https://github.com/matrix-org/matrix-react-sdk/pull/3921)
 * Don't list every single alias when there's many
   [\#3919](https://github.com/matrix-org/matrix-react-sdk/pull/3919)

Changes in [2.0.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.0.0-rc.2) (2020-01-20)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v2.0.0-rc.1...v2.0.0-rc.2)

 * Add prepublish script
   [\#3877](https://github.com/matrix-org/matrix-react-sdk/pull/3877)

Changes in [2.0.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v2.0.0-rc.1) (2020-01-20)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.6...v2.0.0-rc.1)

BREAKING CHANGES
================
 * The react-sdk node module now exports ES6 rather than ES5. If you
   wish to supports target that aren't compatible with ES6, you
   will need to transpile the react-sdk to a suitable dialect.

All Changes
===========
 * Fix arrows keys moving through edit history
   [\#3874](https://github.com/matrix-org/matrix-react-sdk/pull/3874)
 * Fix error about MessagePanel not being available for read markers
   [\#3867](https://github.com/matrix-org/matrix-react-sdk/pull/3867)
 * Adjust secret storage to work before sync
   [\#3864](https://github.com/matrix-org/matrix-react-sdk/pull/3864)
 * Update from Weblate
   [\#3872](https://github.com/matrix-org/matrix-react-sdk/pull/3872)
 * Remove unused deps and dev-deps
   [\#3870](https://github.com/matrix-org/matrix-react-sdk/pull/3870)
 * Tidy Jest test stuff and dependencies
   [\#3869](https://github.com/matrix-org/matrix-react-sdk/pull/3869)
 * Move feature flag check for new session toast
   [\#3865](https://github.com/matrix-org/matrix-react-sdk/pull/3865)
 * Catch exception in checkTerms if no ID server
   [\#3863](https://github.com/matrix-org/matrix-react-sdk/pull/3863)
 * Catch exception if passphrase dialog cancelled
   [\#3862](https://github.com/matrix-org/matrix-react-sdk/pull/3862)
 * Disable key request dialogs with cross-signing
   [\#3860](https://github.com/matrix-org/matrix-react-sdk/pull/3860)
 * Toasts for new, unverified sessions
   [\#3859](https://github.com/matrix-org/matrix-react-sdk/pull/3859)
 * Check for a matrixclient before trying to use it
   [\#3861](https://github.com/matrix-org/matrix-react-sdk/pull/3861)
 * Room header & message box shields now reflect cross-signing state
   [\#3850](https://github.com/matrix-org/matrix-react-sdk/pull/3850)
 * Fix Array.concat undefined
   [\#3857](https://github.com/matrix-org/matrix-react-sdk/pull/3857)
 * Update chokidar to fix reskindex not working
   [\#3856](https://github.com/matrix-org/matrix-react-sdk/pull/3856)
 * Make the new DM invite dialog work for regular invites too
   [\#3854](https://github.com/matrix-org/matrix-react-sdk/pull/3854)
 * Fix event handler leak in MemberStatusMessageAvatar
   [\#3855](https://github.com/matrix-org/matrix-react-sdk/pull/3855)
 * Move DM creation logic into DMInviteDialog
   [\#3843](https://github.com/matrix-org/matrix-react-sdk/pull/3843)
 * Remove all text when cutting in the composer
   [\#3848](https://github.com/matrix-org/matrix-react-sdk/pull/3848)
 * Add a ToastStore
   [\#3853](https://github.com/matrix-org/matrix-react-sdk/pull/3853)
 * 'Members' button always toggle the right panel
   [\#3804](https://github.com/matrix-org/matrix-react-sdk/pull/3804)
 * Fix timing of when Composer considers itself to be modified
   [\#3842](https://github.com/matrix-org/matrix-react-sdk/pull/3842)
 * Compute download file icon immediately
   [\#3851](https://github.com/matrix-org/matrix-react-sdk/pull/3851)
 * Fix not being able to open profiles from the timeline
   [\#3852](https://github.com/matrix-org/matrix-react-sdk/pull/3852)
 * Add post-login complete security flow
   [\#3847](https://github.com/matrix-org/matrix-react-sdk/pull/3847)
 * Added cut/copy and pasting user pills from editor.
   [\#3828](https://github.com/matrix-org/matrix-react-sdk/pull/3828)
 * Fix imports for help & support tab
   [\#3846](https://github.com/matrix-org/matrix-react-sdk/pull/3846)
 * Humanize the recent DM rooms ourselves for translations
   [\#3841](https://github.com/matrix-org/matrix-react-sdk/pull/3841)
 * Improve the quality of invite suggestions by filtering out DMs
   [\#3840](https://github.com/matrix-org/matrix-react-sdk/pull/3840)
 * Fix linter and tests on develop
   [\#3845](https://github.com/matrix-org/matrix-react-sdk/pull/3845)
 * Fix sourcemaps by refactoring the build system
   [\#3839](https://github.com/matrix-org/matrix-react-sdk/pull/3839)
 * Don't error on unverified/unknown devices.
   [\#3837](https://github.com/matrix-org/matrix-react-sdk/pull/3837)
 * Padlock icons in room header
   [\#3835](https://github.com/matrix-org/matrix-react-sdk/pull/3835)
 * Don't allow upgrade from untrusted key backup.
   [\#3822](https://github.com/matrix-org/matrix-react-sdk/pull/3822)
 * Emoji verification: Change name of 🔒 to lock
   [\#3825](https://github.com/matrix-org/matrix-react-sdk/pull/3825)
 * Room padlock decorations only if cross-signing is enabled
   [\#3838](https://github.com/matrix-org/matrix-react-sdk/pull/3838)
 * Enable end-to-end tests for sourcemaps (+Windows instructions)
   [\#3827](https://github.com/matrix-org/matrix-react-sdk/pull/3827)
 * Repair community member info panel
   [\#3832](https://github.com/matrix-org/matrix-react-sdk/pull/3832)
 * Add feature flag around the presence indicator in room list
   [\#3831](https://github.com/matrix-org/matrix-react-sdk/pull/3831)
 * Display a padlock icon beside invite-only rooms in the room list
   [\#3821](https://github.com/matrix-org/matrix-react-sdk/pull/3821)
 * Update from Weblate
   [\#3830](https://github.com/matrix-org/matrix-react-sdk/pull/3830)
 * Fix listener leak on RoomView
   [\#3826](https://github.com/matrix-org/matrix-react-sdk/pull/3826)
 * Regenerate i18n for sourcemaps branch
   [\#3824](https://github.com/matrix-org/matrix-react-sdk/pull/3824)
 * Fix tests for sourcemaps branch
   [\#3823](https://github.com/matrix-org/matrix-react-sdk/pull/3823)
 * Jest
   [\#3724](https://github.com/matrix-org/matrix-react-sdk/pull/3724)
 * Sourcemaps: develop -> feature branch
   [\#3817](https://github.com/matrix-org/matrix-react-sdk/pull/3817)
 * Support pasting a bunch of identifiers into the invite dialog
   [\#3820](https://github.com/matrix-org/matrix-react-sdk/pull/3820)
 * Support 3PIDs (email addresses) in the invite dialog
   [\#3819](https://github.com/matrix-org/matrix-react-sdk/pull/3819)
 * Placeholder PR for cleaner diffs: ES6
   [\#3765](https://github.com/matrix-org/matrix-react-sdk/pull/3765)
 * Misc fixes for ES6 imports/exports
   [\#3766](https://github.com/matrix-org/matrix-react-sdk/pull/3766)
 * Wire up the invite targets dialog to a real composer and show selections
   [\#3815](https://github.com/matrix-org/matrix-react-sdk/pull/3815)
 * Change ref handling in TextualBody to prevent it parsing generated nodes
   [\#3711](https://github.com/matrix-org/matrix-react-sdk/pull/3711)
 * Render encoded html entities in og:description
   [\#3789](https://github.com/matrix-org/matrix-react-sdk/pull/3789)
 * Update package.json for new build process + cosmetics
   [\#3767](https://github.com/matrix-org/matrix-react-sdk/pull/3767)
 * Convert CommonJS exports to ES6 exports
   [\#3761](https://github.com/matrix-org/matrix-react-sdk/pull/3761)
 * Round 2 of CommonJS to ES6 imports
   [\#3764](https://github.com/matrix-org/matrix-react-sdk/pull/3764)
 * Strip all variation selectors on emoji
   [\#3814](https://github.com/matrix-org/matrix-react-sdk/pull/3814)
 * Use the new js-sdk imports and import from src
   [\#3763](https://github.com/matrix-org/matrix-react-sdk/pull/3763)
 * Convert many imports to handle ES6 exports
   [\#3762](https://github.com/matrix-org/matrix-react-sdk/pull/3762)
 * Fix userinfo for users not in the room
   [\#3812](https://github.com/matrix-org/matrix-react-sdk/pull/3812)
 * Attempt to fix e2e tests
   [\#3811](https://github.com/matrix-org/matrix-react-sdk/pull/3811)
 * Add bunch of null-guards and similar to fix React Errors/complaints
   [\#3752](https://github.com/matrix-org/matrix-react-sdk/pull/3752)
 * Delegate all room alias validation to the RoomAliasField validator
   [\#3807](https://github.com/matrix-org/matrix-react-sdk/pull/3807)
 * Support filtering and searching for users to invite in DMs
   [\#3802](https://github.com/matrix-org/matrix-react-sdk/pull/3802)
 * Add suggestions for which users to invite to chat
   [\#3801](https://github.com/matrix-org/matrix-react-sdk/pull/3801)
 * Use `flex-start` instead of `start` for postcss
   [\#3760](https://github.com/matrix-org/matrix-react-sdk/pull/3760)
 * Define getLanguageFromBrowser() for LanguageDropdown
   [\#3769](https://github.com/matrix-org/matrix-react-sdk/pull/3769)
 * Introduce babel's export-default-from plugin to fix build errors
   [\#3768](https://github.com/matrix-org/matrix-react-sdk/pull/3768)
 * Add a bit of debugging to incorrect components in the Skinner
   [\#3770](https://github.com/matrix-org/matrix-react-sdk/pull/3770)
 * [BREAKING] Refactor the entire build process for babel@7 and TypeScript
   (chunk 1 of many)
   [\#3722](https://github.com/matrix-org/matrix-react-sdk/pull/3722)
 * Implementation of new potential skinning mechanism
   [\#3723](https://github.com/matrix-org/matrix-react-sdk/pull/3723)

Changes in [1.7.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.6) (2020-01-13)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.6-rc.2...v1.7.6)

 * Repair community member info panel
   [\#3834](https://github.com/matrix-org/matrix-react-sdk/pull/3834)
 * Add feature flag around the presence indicator in room list
   [\#3833](https://github.com/matrix-org/matrix-react-sdk/pull/3833)

Changes in [1.7.6-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.6-rc.2) (2020-01-08)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.6-rc.1...v1.7.6-rc.2)

 * Strip all variation selectors on emoji
   [\#3818](https://github.com/matrix-org/matrix-react-sdk/pull/3818)

Changes in [1.7.6-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.6-rc.1) (2020-01-06)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.5...v1.7.6-rc.1)

 * Deduplicate recent emoji
   [\#3806](https://github.com/matrix-org/matrix-react-sdk/pull/3806)
 * Fix ability to remove avatars
   [\#3803](https://github.com/matrix-org/matrix-react-sdk/pull/3803)
 * Update from Weblate
   [\#3810](https://github.com/matrix-org/matrix-react-sdk/pull/3810)
 * User Info fetch latest RoomMember instead of showing historical data
   [\#3788](https://github.com/matrix-org/matrix-react-sdk/pull/3788)
 * Remove all usages of slate in favour of CIDER
   [\#3808](https://github.com/matrix-org/matrix-react-sdk/pull/3808)
 * Use display name when pinned messages are changed
   [\#3809](https://github.com/matrix-org/matrix-react-sdk/pull/3809)
 * Fix inverted diff line highlighting in dark theme
   [\#3790](https://github.com/matrix-org/matrix-react-sdk/pull/3790)
 * Bridge info settings tab
   [\#3693](https://github.com/matrix-org/matrix-react-sdk/pull/3693)
 * Send the labs flags the client is running with in rageshake
   [\#3805](https://github.com/matrix-org/matrix-react-sdk/pull/3805)
 * Initial implementation of FTUE user lists design
   [\#3792](https://github.com/matrix-org/matrix-react-sdk/pull/3792)
 * Update key backup creation and recovery paths for SSSS
   [\#3800](https://github.com/matrix-org/matrix-react-sdk/pull/3800)
 * Don't fail if logs exists and is an empty dir
   [\#3798](https://github.com/matrix-org/matrix-react-sdk/pull/3798)
 * Comment remaining non-cross-signing-compliant components
   [\#3799](https://github.com/matrix-org/matrix-react-sdk/pull/3799)
 * Remove 'unverify' from UserInfoPanel
   [\#3797](https://github.com/matrix-org/matrix-react-sdk/pull/3797)
 * Use deviceTrust when displaying key backup trust status
   [\#3795](https://github.com/matrix-org/matrix-react-sdk/pull/3795)
 * Don't crash if a keyshare request is removed
   [\#3793](https://github.com/matrix-org/matrix-react-sdk/pull/3793)
 * Convert /verify to checkDeviceTrust
   [\#3794](https://github.com/matrix-org/matrix-react-sdk/pull/3794)
 * Remove E2eIcon onClick
   [\#3791](https://github.com/matrix-org/matrix-react-sdk/pull/3791)
 * support channel names with slash in name/alias
   [\#3778](https://github.com/matrix-org/matrix-react-sdk/pull/3778)
 * Fix NPE when filtering the room list
   [\#3787](https://github.com/matrix-org/matrix-react-sdk/pull/3787)
 * Turn RoomAliasField into properly controlled and use in RoomSettings
   [\#3782](https://github.com/matrix-org/matrix-react-sdk/pull/3782)
 * fuzzy-sort MemberList
   [\#3783](https://github.com/matrix-org/matrix-react-sdk/pull/3783)
 * Serialize file uploads into room to match confirmation dialog order
   [\#3786](https://github.com/matrix-org/matrix-react-sdk/pull/3786)
 * Do not show Top Unread Messages Bar and Jump to bottom button if searching
   [\#3785](https://github.com/matrix-org/matrix-react-sdk/pull/3785)
 * Fix sticker picker chevron offset calculation
   [\#3784](https://github.com/matrix-org/matrix-react-sdk/pull/3784)
 * Fix not being able to promote others to the same power level as your own
   [\#3781](https://github.com/matrix-org/matrix-react-sdk/pull/3781)
 * Room Tile DMs online/active green dot
   [\#3751](https://github.com/matrix-org/matrix-react-sdk/pull/3751)
 * Fix spelling and grammar in README
   [\#3780](https://github.com/matrix-org/matrix-react-sdk/pull/3780)
 * Reintroduce working resizer code for right panel
   [\#3776](https://github.com/matrix-org/matrix-react-sdk/pull/3776)
 * Fix wrong scope binding on openHelp for TopLeftMenu
   [\#3775](https://github.com/matrix-org/matrix-react-sdk/pull/3775)
 * UserInfo hide kick/mute buttons if they make no sense
   [\#3774](https://github.com/matrix-org/matrix-react-sdk/pull/3774)
 * Fix duplicate Incoming Call prompt on Community Invite sublist
   [\#3773](https://github.com/matrix-org/matrix-react-sdk/pull/3773)
 * Apply new design to highlighted tags and add toggle mechanic
   [\#3755](https://github.com/matrix-org/matrix-react-sdk/pull/3755)
 * stop using ReactDOM.findDOMNode in componentWillUnmount, use refs
   [\#3771](https://github.com/matrix-org/matrix-react-sdk/pull/3771)
 * Add alt="" to presentational images
   [\#3772](https://github.com/matrix-org/matrix-react-sdk/pull/3772)
 * Fix room list filtering weird case sensitivity
   [\#3759](https://github.com/matrix-org/matrix-react-sdk/pull/3759)
 * Don't show the 'verify' button if the user is verified
   [\#3758](https://github.com/matrix-org/matrix-react-sdk/pull/3758)
 * Switch to using checkDeviceTrust
   [\#3757](https://github.com/matrix-org/matrix-react-sdk/pull/3757)
 * Migrate away from React Legacy contexts API
   [\#3743](https://github.com/matrix-org/matrix-react-sdk/pull/3743)
 * Migrate key backups to SSSS
   [\#3749](https://github.com/matrix-org/matrix-react-sdk/pull/3749)
 * Get rid of stripped-emoji.json in favour of an in-memory single source of
   truth
   [\#3745](https://github.com/matrix-org/matrix-react-sdk/pull/3745)
 * Combine cross signing and verification over DM feature flags
   [\#3753](https://github.com/matrix-org/matrix-react-sdk/pull/3753)
 * apply unhomoglyph when filtering room list to fuzzify it
   [\#3754](https://github.com/matrix-org/matrix-react-sdk/pull/3754)
 * Make EmojiPicker an unmanaged Context Menu as it is too complex to be
   managed
   [\#3746](https://github.com/matrix-org/matrix-react-sdk/pull/3746)
 * Internationalise M_TOO_LARGE error from Synapse
   [\#3750](https://github.com/matrix-org/matrix-react-sdk/pull/3750)
 * Replace UserInfo avatar with <MemberAvatar/> for fallback logic
   [\#3748](https://github.com/matrix-org/matrix-react-sdk/pull/3748)
 * Dropdown stop keyboard propagation if key handled
   [\#3741](https://github.com/matrix-org/matrix-react-sdk/pull/3741)
 * Fix right panel for multiple member info viewings
   [\#3742](https://github.com/matrix-org/matrix-react-sdk/pull/3742)
 * Fix Field validation tooltip sticking if blurred before async validation
   resolved
   [\#3740](https://github.com/matrix-org/matrix-react-sdk/pull/3740)
 * Fix UserInfo exploding without a room being passed to it
   [\#3738](https://github.com/matrix-org/matrix-react-sdk/pull/3738)
 * Fix room directory maintaining and error state
   [\#3737](https://github.com/matrix-org/matrix-react-sdk/pull/3737)
 * Stop trapping tab in AddressPickerDialog
   [\#3735](https://github.com/matrix-org/matrix-react-sdk/pull/3735)
 * Stop using KeyboardEvent.keyCode as it is deprecated
   [\#3736](https://github.com/matrix-org/matrix-react-sdk/pull/3736)
 * Implement new design for uploading/removing avatars
   [\#3733](https://github.com/matrix-org/matrix-react-sdk/pull/3733)
 * Fix aspect ratio on room/profile avatar preview
   [\#3731](https://github.com/matrix-org/matrix-react-sdk/pull/3731)
 * Switch to react-focus-lock for it to comprehend Portals
   [\#3732](https://github.com/matrix-org/matrix-react-sdk/pull/3732)
 * Make combobox dropdown keyboard and screen reader accessible
   [\#3729](https://github.com/matrix-org/matrix-react-sdk/pull/3729)
 * Verify users when cross-signing enabled
   [\#3728](https://github.com/matrix-org/matrix-react-sdk/pull/3728)
 * Update from Weblate
   [\#3730](https://github.com/matrix-org/matrix-react-sdk/pull/3730)
 * Improve a11y of the unignore button in Settings
   [\#3727](https://github.com/matrix-org/matrix-react-sdk/pull/3727)
 * Fix ToggleSwitch A11Y (trapping tab and switch v. checkbox)
   [\#3726](https://github.com/matrix-org/matrix-react-sdk/pull/3726)
 * Make URL previews dismissable via keyboard and accessible to screen readers
   [\#3725](https://github.com/matrix-org/matrix-react-sdk/pull/3725)
 * Create new key backups using secret storage
   [\#3720](https://github.com/matrix-org/matrix-react-sdk/pull/3720)
 * Replace sign-ins with sessions
   [\#3721](https://github.com/matrix-org/matrix-react-sdk/pull/3721)
 * Refactor RightPanel to match expected behaviour
   [\#3703](https://github.com/matrix-org/matrix-react-sdk/pull/3703)
 * Render policy room event updates in the timeline
   [\#3716](https://github.com/matrix-org/matrix-react-sdk/pull/3716)
 * Wrap the await call for unknown device lookups
   [\#3718](https://github.com/matrix-org/matrix-react-sdk/pull/3718)
 * Add testing flow to bootstrap secret storage
   [\#3640](https://github.com/matrix-org/matrix-react-sdk/pull/3640)
 * Fix remaining context menu regressions
   [\#3715](https://github.com/matrix-org/matrix-react-sdk/pull/3715)
 * Migrate away from React Legacy string refs
   [\#3712](https://github.com/matrix-org/matrix-react-sdk/pull/3712)
 * Update copy for DM invites
   [\#3706](https://github.com/matrix-org/matrix-react-sdk/pull/3706)
 * Fix message action bar reaction picker regression
   [\#3714](https://github.com/matrix-org/matrix-react-sdk/pull/3714)
 * Add what-input to allow different scoping to focus-visible for MAB a11y
   [\#3709](https://github.com/matrix-org/matrix-react-sdk/pull/3709)
 * Mark the This/All Rooms scope buttons as radios for a11y
   [\#3708](https://github.com/matrix-org/matrix-react-sdk/pull/3708)
 * Switch ReactionsRowButton to an AccessibleButton for space/enter handling
   [\#3707](https://github.com/matrix-org/matrix-react-sdk/pull/3707)
 * Change the (edited) link to an AccessibleButton for a11y
   [\#3710](https://github.com/matrix-org/matrix-react-sdk/pull/3710)
 * Update from Weblate
   [\#3713](https://github.com/matrix-org/matrix-react-sdk/pull/3713)
 * Fix ?via= args in SpecPermalinkConstructor.js
   [\#3694](https://github.com/matrix-org/matrix-react-sdk/pull/3694)
 * Don't mark a room as unread when server ACLs are set
   [\#3705](https://github.com/matrix-org/matrix-react-sdk/pull/3705)
 * Make reaction buttons more accessible
   [\#3704](https://github.com/matrix-org/matrix-react-sdk/pull/3704)
 * yarn upgrade
   [\#3701](https://github.com/matrix-org/matrix-react-sdk/pull/3701)
 * Make CI scripts executable
   [\#3698](https://github.com/matrix-org/matrix-react-sdk/pull/3698)
 * ARIA compliant context menus
   [\#3611](https://github.com/matrix-org/matrix-react-sdk/pull/3611)

Changes in [1.7.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.5) (2019-12-09)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.5-rc.1...v1.7.5)

 * No changes since rc.1

Changes in [1.7.5-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.5-rc.1) (2019-12-04)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.4...v1.7.5-rc.1)

 * Remove logs before running end-to-end tests
   [\#3700](https://github.com/matrix-org/matrix-react-sdk/pull/3700)
 * Update from Weblate
   [\#3699](https://github.com/matrix-org/matrix-react-sdk/pull/3699)
 * Match e2e icons on events to expectations
   [\#3697](https://github.com/matrix-org/matrix-react-sdk/pull/3697)
 * Match room upgrade warning to the new design
   [\#3695](https://github.com/matrix-org/matrix-react-sdk/pull/3695)
 * Remove unused translations
   [\#3683](https://github.com/matrix-org/matrix-react-sdk/pull/3683)
 * Remove broken velocity-ui animation
   [\#3678](https://github.com/matrix-org/matrix-react-sdk/pull/3678)
 * Update from Weblate
   [\#3696](https://github.com/matrix-org/matrix-react-sdk/pull/3696)
 * Hide Remove button in message editing history if you don't have permission
   to redact
   [\#3685](https://github.com/matrix-org/matrix-react-sdk/pull/3685)
 * Add an option to invite users to upgraded private rooms
   [\#3684](https://github.com/matrix-org/matrix-react-sdk/pull/3684)
 * Do not trap Key ContextMenu into composer for keyboard a11y
   [\#3689](https://github.com/matrix-org/matrix-react-sdk/pull/3689)
 * Make EmojiPicker filtering case-insensitive
   [\#3690](https://github.com/matrix-org/matrix-react-sdk/pull/3690)
 * Ensure the settings page accurately represents theme choices
   [\#3686](https://github.com/matrix-org/matrix-react-sdk/pull/3686)
 * Ensure read receipts end up with a valid reference to checkUnmounting
   [\#3688](https://github.com/matrix-org/matrix-react-sdk/pull/3688)
 * Convert Velociraptor component to a class
   [\#3687](https://github.com/matrix-org/matrix-react-sdk/pull/3687)
 * Add a link to the labs feature documentation
   [\#3675](https://github.com/matrix-org/matrix-react-sdk/pull/3675)
 * Improve translatable strings for calls
   [\#3682](https://github.com/matrix-org/matrix-react-sdk/pull/3682)
 * Don't assume that diffs will have an appropriate child node
   [\#3680](https://github.com/matrix-org/matrix-react-sdk/pull/3680)
 * Fix persisted widgets getting stuck at loading screens
   [\#3681](https://github.com/matrix-org/matrix-react-sdk/pull/3681)
 * Add button to clear all notification counts, sometimes stuck in historical
   [\#2959](https://github.com/matrix-org/matrix-react-sdk/pull/2959)
 * Fix multi-invite error dialog messaging
   [\#3679](https://github.com/matrix-org/matrix-react-sdk/pull/3679)
 * Make the communities button behave more like a toggle
   [\#3670](https://github.com/matrix-org/matrix-react-sdk/pull/3670)
 * Change read markers to use CSS transitions
   [\#3674](https://github.com/matrix-org/matrix-react-sdk/pull/3674)
 * fix font smoothing to match figma
   [\#3677](https://github.com/matrix-org/matrix-react-sdk/pull/3677)
 * Update breadcrumbs when we do eventually see upgraded rooms
   [\#3669](https://github.com/matrix-org/matrix-react-sdk/pull/3669)
 * Fix override behaviour of system vs defined themes
   [\#3673](https://github.com/matrix-org/matrix-react-sdk/pull/3673)
 * console.log doesn't take %s substitutions
   [\#3671](https://github.com/matrix-org/matrix-react-sdk/pull/3671)
 * EventIndex: Move the checkpoint loading logic into the init method.
   [\#3648](https://github.com/matrix-org/matrix-react-sdk/pull/3648)
 * Clarify that cross-signing is in development
   [\#3668](https://github.com/matrix-org/matrix-react-sdk/pull/3668)
 * Hide tooltips with CSS when they aren't visible
   [\#3665](https://github.com/matrix-org/matrix-react-sdk/pull/3665)
 * a11y: adjustments for toasts
   [\#3667](https://github.com/matrix-org/matrix-react-sdk/pull/3667)
 * Update from Weblate
   [\#3666](https://github.com/matrix-org/matrix-react-sdk/pull/3666)
 * Null check on thumbnail_file
   [\#3664](https://github.com/matrix-org/matrix-react-sdk/pull/3664)
 * Fix double date separator for room upgrade tiles
   [\#3662](https://github.com/matrix-org/matrix-react-sdk/pull/3662)
 * Show incoming verification requests in in-app notifications
   [\#3661](https://github.com/matrix-org/matrix-react-sdk/pull/3661)
 * Show m.room.create event before the ELS on room upgrade
   [\#3655](https://github.com/matrix-org/matrix-react-sdk/pull/3655)
 * Convert MessagePanel to React class
   [\#3656](https://github.com/matrix-org/matrix-react-sdk/pull/3656)
 * Make addEventListener conditional
   [\#3657](https://github.com/matrix-org/matrix-react-sdk/pull/3657)
 * Fix e2e icons
   [\#3653](https://github.com/matrix-org/matrix-react-sdk/pull/3653)
 * Workaround for soft-crash with calls on startup
   [\#3654](https://github.com/matrix-org/matrix-react-sdk/pull/3654)
 * Catch exceptions when we can't play audio
   [\#3652](https://github.com/matrix-org/matrix-react-sdk/pull/3652)
 * Rename section heading for integrations in settings
   [\#3650](https://github.com/matrix-org/matrix-react-sdk/pull/3650)
 * Update copy for widgets not using message encryption
   [\#3651](https://github.com/matrix-org/matrix-react-sdk/pull/3651)
 * Ignore media actions
   [\#3649](https://github.com/matrix-org/matrix-react-sdk/pull/3649)
 * Add an option to disable the use of integration managers for provisioning
   [\#3646](https://github.com/matrix-org/matrix-react-sdk/pull/3646)
 * Move many widget options to a context menu
   [\#3645](https://github.com/matrix-org/matrix-react-sdk/pull/3645)
 * Re-add encryption warning to widget permission prompt
   [\#3644](https://github.com/matrix-org/matrix-react-sdk/pull/3644)
 * Update CIDER docs now that it is used for main composer as well
   [\#3647](https://github.com/matrix-org/matrix-react-sdk/pull/3647)
 * get rid of bluebird
   [\#3593](https://github.com/matrix-org/matrix-react-sdk/pull/3593)
 * Remove getBaseTheme
   [\#3638](https://github.com/matrix-org/matrix-react-sdk/pull/3638)
 * ReactionsRowButtonTooltip: fix null dereference if emoji owner left room
   [\#3643](https://github.com/matrix-org/matrix-react-sdk/pull/3643)
 * Add eslint-plugin-jest because we inherit js-sdk's eslintrc and it wants
   [\#3642](https://github.com/matrix-org/matrix-react-sdk/pull/3642)

Changes in [1.7.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.4) (2019-11-27)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.3...v1.7.4)

* Upgrade to JS SDK 2.5.4 to relax identity server discovery and E2EE debugging
* Fix override behaviour of system vs defined theme
* Clarify that cross-signing is in development

Changes in [1.7.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.3) (2019-11-25)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.3-rc.2...v1.7.3)

 * No changes since rc.2

Changes in [1.7.3-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.3-rc.2) (2019-11-22)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.3-rc.1...v1.7.3-rc.2)

 * Fix double date separator for room upgrade tiles
   [\#3663](https://github.com/matrix-org/matrix-react-sdk/pull/3663)
 * Show m.room.create event before the ELS on room upgrade
   [\#3660](https://github.com/matrix-org/matrix-react-sdk/pull/3660)
 * Make addEventListener conditional
   [\#3659](https://github.com/matrix-org/matrix-react-sdk/pull/3659)
 * Fix e2e icons
   [\#3658](https://github.com/matrix-org/matrix-react-sdk/pull/3658)

Changes in [1.7.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.3-rc.1) (2019-11-20)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.2...v1.7.3-rc.1)

 * Fix positioning, size, and colour of the composer e2e icon
   [\#3641](https://github.com/matrix-org/matrix-react-sdk/pull/3641)
 * upgrade nunito from 3.500 to 3.504
   [\#3639](https://github.com/matrix-org/matrix-react-sdk/pull/3639)
 * Wire up the widget permission prompt to the cross-platform setting
   [\#3630](https://github.com/matrix-org/matrix-react-sdk/pull/3630)
 * Get theme automatically from system setting
   [\#3637](https://github.com/matrix-org/matrix-react-sdk/pull/3637)
 * Update code style for our 90 char life
   [\#3636](https://github.com/matrix-org/matrix-react-sdk/pull/3636)
 * use general warning icon instead of e2e one for room status
   [\#3633](https://github.com/matrix-org/matrix-react-sdk/pull/3633)
 * Add support for platform specific event indexing and search
   [\#3550](https://github.com/matrix-org/matrix-react-sdk/pull/3550)
 * Update from Weblate
   [\#3635](https://github.com/matrix-org/matrix-react-sdk/pull/3635)
 * Use a settings watcher to set the theme
   [\#3634](https://github.com/matrix-org/matrix-react-sdk/pull/3634)
 * Merge the `feature_user_info_panel` flag into `feature_dm_verification`
   [\#3632](https://github.com/matrix-org/matrix-react-sdk/pull/3632)
 * Fix some styling regressions in member panel
   [\#3631](https://github.com/matrix-org/matrix-react-sdk/pull/3631)
 * Add a bit more safety around breadcrumbs
   [\#3629](https://github.com/matrix-org/matrix-react-sdk/pull/3629)
 * Ensure widgets always have a sender associated with them
   [\#3628](https://github.com/matrix-org/matrix-react-sdk/pull/3628)
 * re-add missing case of codepath
   [\#3627](https://github.com/matrix-org/matrix-react-sdk/pull/3627)
 * Implement the bulk of the new widget permission prompt design
   [\#3622](https://github.com/matrix-org/matrix-react-sdk/pull/3622)
 * Relax identity server discovery error handling
   [\#3588](https://github.com/matrix-org/matrix-react-sdk/pull/3588)
 * Add cross-signing feature flag
   [\#3626](https://github.com/matrix-org/matrix-react-sdk/pull/3626)
 * Attempt number two at ripping out Bluebird from rageshake.js
   [\#3624](https://github.com/matrix-org/matrix-react-sdk/pull/3624)
 * Update from Weblate
   [\#3625](https://github.com/matrix-org/matrix-react-sdk/pull/3625)
 * Remove Bluebird: phase 2.1
   [\#3618](https://github.com/matrix-org/matrix-react-sdk/pull/3618)
 * Add better error handling to Synapse user deactivation
   [\#3619](https://github.com/matrix-org/matrix-react-sdk/pull/3619)
 * New design for member panel
   [\#3620](https://github.com/matrix-org/matrix-react-sdk/pull/3620)
 * Show server details on login for unreachable homeserver
   [\#3617](https://github.com/matrix-org/matrix-react-sdk/pull/3617)
 * Add a function to get the "base" theme for a theme
   [\#3615](https://github.com/matrix-org/matrix-react-sdk/pull/3615)
 * Remove Bluebird: phase 2
   [\#3616](https://github.com/matrix-org/matrix-react-sdk/pull/3616)
 * Remove Bluebird: phase 1
   [\#3612](https://github.com/matrix-org/matrix-react-sdk/pull/3612)
 * Move notification count to in front of the room name in the page title
   [\#3613](https://github.com/matrix-org/matrix-react-sdk/pull/3613)
 * Add some logging/recovery for lost rooms
   [\#3614](https://github.com/matrix-org/matrix-react-sdk/pull/3614)
 * Add Mjolnir ban list support
   [\#3585](https://github.com/matrix-org/matrix-react-sdk/pull/3585)
 * Improve room switching performance with alias cache
   [\#3610](https://github.com/matrix-org/matrix-react-sdk/pull/3610)
 * Fix draw order when hovering composer format buttons
   [\#3609](https://github.com/matrix-org/matrix-react-sdk/pull/3609)
 * Use a ternary operator instead of relying on AND semantics in
   EditHistoryDialog
   [\#3606](https://github.com/matrix-org/matrix-react-sdk/pull/3606)
 * Update from Weblate
   [\#3608](https://github.com/matrix-org/matrix-react-sdk/pull/3608)
 * Fix HTML fallback in replies
   [\#3607](https://github.com/matrix-org/matrix-react-sdk/pull/3607)
 * Fix rounded corners for the formatting toolbar
   [\#3605](https://github.com/matrix-org/matrix-react-sdk/pull/3605)
 * Check for a message type before assuming it is a room message
   [\#3604](https://github.com/matrix-org/matrix-react-sdk/pull/3604)
 * Remove lint comments about no-descending-specificity
   [\#3603](https://github.com/matrix-org/matrix-react-sdk/pull/3603)
 * Show verification requests in the timeline
   [\#3601](https://github.com/matrix-org/matrix-react-sdk/pull/3601)
 * Match identity server registration to the IS r0.3.0 spec
   [\#3602](https://github.com/matrix-org/matrix-react-sdk/pull/3602)
 * Restore thumbs after variation selector removal
   [\#3600](https://github.com/matrix-org/matrix-react-sdk/pull/3600)
 * Fix breadcrumbs so the bar is a toolbar and the buttons are buttons.
   [\#3599](https://github.com/matrix-org/matrix-react-sdk/pull/3599)
 * Now that part of spacing is padding, make it smaller when collapsed
   [\#3597](https://github.com/matrix-org/matrix-react-sdk/pull/3597)
 * Remove variation selectors from quick reactions
   [\#3598](https://github.com/matrix-org/matrix-react-sdk/pull/3598)
 * Fix linkify imports
   [\#3595](https://github.com/matrix-org/matrix-react-sdk/pull/3595)

Changes in [1.7.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.2) (2019-11-06)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.1...v1.7.2)

 * Fix softcrash if editing silly events
   [\#3596](https://github.com/matrix-org/matrix-react-sdk/pull/3596)
 * Fix: file and notifications panel back-paginating forever.
   [\#3594](https://github.com/matrix-org/matrix-react-sdk/pull/3594)
 * Fix focus-within on EventTile and more showing onClick
   [\#3591](https://github.com/matrix-org/matrix-react-sdk/pull/3591)
 * Support RTL language in message composer
   [\#3592](https://github.com/matrix-org/matrix-react-sdk/pull/3592)
 * Update from Weblate
   [\#3590](https://github.com/matrix-org/matrix-react-sdk/pull/3590)
 * Improve A11Y of timeline. Show timestamp & Actions on focus-within
   [\#3587](https://github.com/matrix-org/matrix-react-sdk/pull/3587)
 * Fix SVG mask-image usage in a bunch of places for correct outlining
   [\#3589](https://github.com/matrix-org/matrix-react-sdk/pull/3589)
 * Handle breadcrumbs, integration manager provisioning, and allowed widgets
   Riot settings
   [\#3577](https://github.com/matrix-org/matrix-react-sdk/pull/3577)
 * Add a prompt when interacting with an identity server without terms
   [\#3582](https://github.com/matrix-org/matrix-react-sdk/pull/3582)
 * Fix bug where rooms would not appear when filtering
   [\#3584](https://github.com/matrix-org/matrix-react-sdk/pull/3584)
 * Guard against misconfigured homeservers when adding / binding phone numbers
   [\#3583](https://github.com/matrix-org/matrix-react-sdk/pull/3583)
 * Fix error message which is shown when unknown slash command attempted
   [\#3580](https://github.com/matrix-org/matrix-react-sdk/pull/3580)
 * Attempt to fix soft crash on some pinned events by null guarding member
   [\#3581](https://github.com/matrix-org/matrix-react-sdk/pull/3581)

Changes in [1.7.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.1) (2019-11-04)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.1-rc.2...v1.7.1)

 * No changes since rc.2

Changes in [1.7.1-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.1-rc.2) (2019-11-01)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.1-rc.1...v1.7.1-rc.2)

 * Fix bug where rooms would not appear when filtering
   [\#3586](https://github.com/matrix-org/matrix-react-sdk/pull/3586)

Changes in [1.7.1-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.1-rc.1) (2019-10-30)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.0...v1.7.1-rc.1)

 * Add ability to hide tray icon on non-Mac
   [\#3573](https://github.com/matrix-org/matrix-react-sdk/pull/3573)
 * Update from Weblate
   [\#3579](https://github.com/matrix-org/matrix-react-sdk/pull/3579)
 * Fix call state logging
   [\#3578](https://github.com/matrix-org/matrix-react-sdk/pull/3578)
 * Match widgets up with their integration manager
   [\#3576](https://github.com/matrix-org/matrix-react-sdk/pull/3576)
 * Add diagnostic log to catch events without an ID
   [\#3575](https://github.com/matrix-org/matrix-react-sdk/pull/3575)
 * Fix missing i18n for RoomTile ARIA labels and add a case for notif-off bold
   [\#3574](https://github.com/matrix-org/matrix-react-sdk/pull/3574)
 * LifeCycle onLoggedOut unmount before stopping client
   [\#3566](https://github.com/matrix-org/matrix-react-sdk/pull/3566)
 * Remove unneeded help about identity servers
   [\#3572](https://github.com/matrix-org/matrix-react-sdk/pull/3572)
 * Remove messages implying you need an identity server for email recovery
   [\#3571](https://github.com/matrix-org/matrix-react-sdk/pull/3571)
 * Fix quick reactions to be aligned with other emoji
   [\#3570](https://github.com/matrix-org/matrix-react-sdk/pull/3570)
 * If ToS gets rejected/any Scalar error then don't make Jitsi widget
   [\#3569](https://github.com/matrix-org/matrix-react-sdk/pull/3569)
 * Update from Weblate
   [\#3568](https://github.com/matrix-org/matrix-react-sdk/pull/3568)
 * Fix Room Create ELS using MXID instead of newly set Displayname/Avatar
   [\#3567](https://github.com/matrix-org/matrix-react-sdk/pull/3567)
 * Improve opening emoji picker performance
   [\#3565](https://github.com/matrix-org/matrix-react-sdk/pull/3565)
 * Update ServerTypeSelector for new matrix.org CS API URL
   [\#3564](https://github.com/matrix-org/matrix-react-sdk/pull/3564)
 * Accessibility Improvements
   [\#3563](https://github.com/matrix-org/matrix-react-sdk/pull/3563)
 * A11Y fixes in the Left Panel
   [\#3562](https://github.com/matrix-org/matrix-react-sdk/pull/3562)
 * Fix lint and i18n test failures
   [\#3560](https://github.com/matrix-org/matrix-react-sdk/pull/3560)
 * Fix: editor tests
   [\#3561](https://github.com/matrix-org/matrix-react-sdk/pull/3561)
 * Use Navigation Treeview pattern for RoomList Accessibility
   [\#3556](https://github.com/matrix-org/matrix-react-sdk/pull/3556)
 * Abort scroll updates when already unmounted
   [\#3557](https://github.com/matrix-org/matrix-react-sdk/pull/3557)
 * UserInfo consolidation of GroupMemberInfo and MemberInfo panels
   [\#3465](https://github.com/matrix-org/matrix-react-sdk/pull/3465)
 * Fix some things in the edit HTML parser
   [\#3552](https://github.com/matrix-org/matrix-react-sdk/pull/3552)
 * Update from Weblate
   [\#3559](https://github.com/matrix-org/matrix-react-sdk/pull/3559)
 * Merge end-to-end tests
   [\#3537](https://github.com/matrix-org/matrix-react-sdk/pull/3537)
 * Add full emoji picker for reactions
   [\#3554](https://github.com/matrix-org/matrix-react-sdk/pull/3554)
 * Accessibility fixes to autocomplete and tabpanels
   [\#3555](https://github.com/matrix-org/matrix-react-sdk/pull/3555)
 * Show warning dialog when changing unreachable IS
   [\#3549](https://github.com/matrix-org/matrix-react-sdk/pull/3549)
 * Fix reply fallback being included in edit m.new_content
   [\#3551](https://github.com/matrix-org/matrix-react-sdk/pull/3551)
 * Document composer features
   [\#3548](https://github.com/matrix-org/matrix-react-sdk/pull/3548)
 * Correctly update the banned users list when a user is unbanned
   [\#3547](https://github.com/matrix-org/matrix-react-sdk/pull/3547)
 * Summarise state events after room creation
   [\#3433](https://github.com/matrix-org/matrix-react-sdk/pull/3433)
 * Don't intercept TAB on the app outside of the composer, fix tabIndex > 0
   [\#3543](https://github.com/matrix-org/matrix-react-sdk/pull/3543)
 * Add some type checking on event body
   [\#3546](https://github.com/matrix-org/matrix-react-sdk/pull/3546)
 * Fix: crash while canceling editing an event when no selection
   [\#3544](https://github.com/matrix-org/matrix-react-sdk/pull/3544)
 * SettingsFlag always run ToggleSwitch fully-controlled
   [\#3541](https://github.com/matrix-org/matrix-react-sdk/pull/3541)
 * Use Keyboard Key consts instead of hardcoded strings
   [\#3540](https://github.com/matrix-org/matrix-react-sdk/pull/3540)

Changes in [1.7.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.0) (2019-10-18)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.7.0-rc.1...v1.7.0)

 * Upgrade to JS SDK v2.4.2
 * Fix: edit unmount when no selection
   [\#3545](https://github.com/matrix-org/matrix-react-sdk/pull/3545)
 * "SettingsFlag always run ToggleSwitch fully controlled" to release
   [\#3542](https://github.com/matrix-org/matrix-react-sdk/pull/3542)

Changes in [1.7.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.7.0-rc.1) (2019-10-09)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.6.2...v1.7.0-rc.1)

 * Update from Weblate
   [\#3539](https://github.com/matrix-org/matrix-react-sdk/pull/3539)
 * React error/warning cleanup
   [\#3529](https://github.com/matrix-org/matrix-react-sdk/pull/3529)
 * Add label to rageshakes for React soft crashes
   [\#3535](https://github.com/matrix-org/matrix-react-sdk/pull/3535)
 * Support UI Auth on adding email addresses & phone numbers
   [\#3534](https://github.com/matrix-org/matrix-react-sdk/pull/3534)
 * Unmount React components before stopping the client
   [\#3533](https://github.com/matrix-org/matrix-react-sdk/pull/3533)
 * Fix soft crash on room join
   [\#3532](https://github.com/matrix-org/matrix-react-sdk/pull/3532)
 * Fix:  Unable to verify email address error
   [\#3528](https://github.com/matrix-org/matrix-react-sdk/pull/3528)
 * Fix: submit create room dialog when pressing enter
   [\#3509](https://github.com/matrix-org/matrix-react-sdk/pull/3509)
 * Allow cyclic objects in console logs
   [\#3531](https://github.com/matrix-org/matrix-react-sdk/pull/3531)
 * Fix: watch emoticon autoreplace setting
   [\#3530](https://github.com/matrix-org/matrix-react-sdk/pull/3530)
 * Make "remove recent messages" more robust
   [\#3508](https://github.com/matrix-org/matrix-react-sdk/pull/3508)
 * Label submit button in UI auth password prompt
   [\#3527](https://github.com/matrix-org/matrix-react-sdk/pull/3527)
 * Null-guard the recaptcha setup
   [\#3526](https://github.com/matrix-org/matrix-react-sdk/pull/3526)
 * Use a mask instead of an img for "Show image" eye
   [\#3513](https://github.com/matrix-org/matrix-react-sdk/pull/3513)
 * Only limit the rageshake log size in one place
   [\#3523](https://github.com/matrix-org/matrix-react-sdk/pull/3523)
 * Rename UPPER_CAMEL_CASE to UPPER_SNAKE_CASE in Coding Style
   [\#3525](https://github.com/matrix-org/matrix-react-sdk/pull/3525)
 * Revert "Run yarn upgrade"
   [\#3524](https://github.com/matrix-org/matrix-react-sdk/pull/3524)
 * Run yarn upgrade
   [\#3521](https://github.com/matrix-org/matrix-react-sdk/pull/3521)
 * Limit Backspace-consuming workaround to just Slate, tidy Keyboard :)
   [\#3522](https://github.com/matrix-org/matrix-react-sdk/pull/3522)
 * Enable CIDER composer by default
   [\#3519](https://github.com/matrix-org/matrix-react-sdk/pull/3519)
 * Update from Weblate
   [\#3520](https://github.com/matrix-org/matrix-react-sdk/pull/3520)
 * Cull some easily fixable errors which make the console a mess
   [\#3516](https://github.com/matrix-org/matrix-react-sdk/pull/3516)

Changes in [1.6.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.6.2) (2019-10-04)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.6.2-rc.1...v1.6.2)

 * Handle null from TimelinePanel.getScrollState in RoomView _getScrollState
   [\#3518](https://github.com/matrix-org/matrix-react-sdk/pull/3518)
 * Fix Community Panel preference not taking effect until some refreshing
   [\#3517](https://github.com/matrix-org/matrix-react-sdk/pull/3517)
 * Fix backspace without slate focus killing everything
   [\#3515](https://github.com/matrix-org/matrix-react-sdk/pull/3515)
 * Fix integration manager not updating when set
   [\#3510](https://github.com/matrix-org/matrix-react-sdk/pull/3510)
 * Various ARIA a11y fixes.
   [\#3514](https://github.com/matrix-org/matrix-react-sdk/pull/3514)
 * Add a bit of debugging for where MatrixClient stops
   [\#3511](https://github.com/matrix-org/matrix-react-sdk/pull/3511)
 * Add error boundaries to catch rendering errors
   [\#3512](https://github.com/matrix-org/matrix-react-sdk/pull/3512)
 * Add an option to hide image previews
   [\#3492](https://github.com/matrix-org/matrix-react-sdk/pull/3492)
 * Fix:  stuck tooltip with composer formatting bar
   [\#3507](https://github.com/matrix-org/matrix-react-sdk/pull/3507)
 * Fix: don't let composer placeholder show horizontal scrollbar when too
   narrow
   [\#3506](https://github.com/matrix-org/matrix-react-sdk/pull/3506)

Changes in [1.6.2-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.6.2-rc.1) (2019-10-02)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.6.1...v1.6.2-rc.1)

 * Custom theming MVP
   [\#3503](https://github.com/matrix-org/matrix-react-sdk/pull/3503)
 * Don't mark a room as unread when someone adds an alias
   [\#3505](https://github.com/matrix-org/matrix-react-sdk/pull/3505)
 * Fix upgraderoom slashcommand
   [\#3504](https://github.com/matrix-org/matrix-react-sdk/pull/3504)
 * Update stripped emoji and bump emojidata to 4.0.2
   [\#3501](https://github.com/matrix-org/matrix-react-sdk/pull/3501)
 * Support local permalinks for unfederated instances
   [\#3500](https://github.com/matrix-org/matrix-react-sdk/pull/3500)
 * Accessibility fixes to the LeftPanel
   [\#3499](https://github.com/matrix-org/matrix-react-sdk/pull/3499)
 * Make Autocomplete more accessible to screen reader users
   [\#3497](https://github.com/matrix-org/matrix-react-sdk/pull/3497)
 * Fix: even more resilience to detect slash commands
   [\#3496](https://github.com/matrix-org/matrix-react-sdk/pull/3496)
 * Fix PropTypes usage, sdk import path and GroupMemberTile letter-avatar
   [\#3486](https://github.com/matrix-org/matrix-react-sdk/pull/3486)

Changes in [1.6.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.6.1) (2019-10-01)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.6.0...v1.6.1)

 * Upgrade to JS SDK 2.4.1 to ignore crypto events with empty content
 * Update from Weblate
   [\#3502](https://github.com/matrix-org/matrix-react-sdk/pull/3502)
 * Adjust details of terms dialog
   [\#3489](https://github.com/matrix-org/matrix-react-sdk/pull/3489)
 * Okay -> OK
   [\#3491](https://github.com/matrix-org/matrix-react-sdk/pull/3491)
 * Guard against falsy names in getInitialLetter
   [\#3498](https://github.com/matrix-org/matrix-react-sdk/pull/3498)
 * Update from Weblate
   [\#3495](https://github.com/matrix-org/matrix-react-sdk/pull/3495)
 * Upgrade deps
   [\#3488](https://github.com/matrix-org/matrix-react-sdk/pull/3488)
 * Fix: allow mass redaction for members with same or larger power level
   [\#3487](https://github.com/matrix-org/matrix-react-sdk/pull/3487)
 * Truncate debug logs at the start, not the end
   [\#3484](https://github.com/matrix-org/matrix-react-sdk/pull/3484)
 * Fix: don't block Shift+Tab in CIDER autocomplete
   [\#3481](https://github.com/matrix-org/matrix-react-sdk/pull/3481)
 * Fix: make command detection more resilient
   [\#3479](https://github.com/matrix-org/matrix-react-sdk/pull/3479)

Changes in [1.6.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.6.0) (2019-09-27)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.6.0-rc.2...v1.6.0)

 * Upgrade to JS SDK 2.4.0
 * Improve keyboard/screen reader accesibility some more
   [\#3483](https://github.com/matrix-org/matrix-react-sdk/pull/3483)

Changes in [1.6.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.6.0-rc.2) (2019-09-26)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.6.0-rc.1...v1.6.0-rc.2)

 * Settings a11y tweaks
   [\#3475](https://github.com/matrix-org/matrix-react-sdk/pull/3475)

Changes in [1.6.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.6.0-rc.1) (2019-09-25)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.3...v1.6.0-rc.1)

 * Upgrade to JS SDK 2.4.0-rc.1
 * Update from Weblate
   [\#3480](https://github.com/matrix-org/matrix-react-sdk/pull/3480)
 * Fix: latin input through Chinese IME
   [\#3477](https://github.com/matrix-org/matrix-react-sdk/pull/3477)
 * Move focus to first field in create room dialog when showing
   [\#3478](https://github.com/matrix-org/matrix-react-sdk/pull/3478)
 * Send MSISDN validation token to submit_url during registration
   [\#3476](https://github.com/matrix-org/matrix-react-sdk/pull/3476)
 * Hide browser a11y outline on context menus
   [\#3474](https://github.com/matrix-org/matrix-react-sdk/pull/3474)
 * Remove id_server param from threepid_creds
   [\#3473](https://github.com/matrix-org/matrix-react-sdk/pull/3473)
 * Fix: make sure client exists while logging out
   [\#3472](https://github.com/matrix-org/matrix-react-sdk/pull/3472)
 * Fix: hide details summary arrow in create room dialog on webkit too
   [\#3470](https://github.com/matrix-org/matrix-react-sdk/pull/3470)
 * put the room name in the title tag
   [\#3471](https://github.com/matrix-org/matrix-react-sdk/pull/3471)
 * Fix: when using autocomplete, ensure command is not sent as text, and @room
   notifs gets needed suffix
   [\#3468](https://github.com/matrix-org/matrix-react-sdk/pull/3468)
 * Fix: paragraphs not being preserved when editing in CIDER
   [\#3469](https://github.com/matrix-org/matrix-react-sdk/pull/3469)
 * Fix: formatbar appearing below other elements
   [\#3467](https://github.com/matrix-org/matrix-react-sdk/pull/3467)
 * Use alternate MSISDN submit URL when returned by HS
   [\#3466](https://github.com/matrix-org/matrix-react-sdk/pull/3466)
 * FTUE: Create Room Dialog update
   [\#3464](https://github.com/matrix-org/matrix-react-sdk/pull/3464)
 * Use separate 3PID add and bind flow for supporting HSes
   [\#3462](https://github.com/matrix-org/matrix-react-sdk/pull/3462)
 * Add roomavatar slash command to set avatar of the current room
   [\#3460](https://github.com/matrix-org/matrix-react-sdk/pull/3460)
 * Don't show spinner if registration is disabled
   [\#3458](https://github.com/matrix-org/matrix-react-sdk/pull/3458)
 * Use same initial device name rules for SSO login as password login
   [\#3457](https://github.com/matrix-org/matrix-react-sdk/pull/3457)
 * Fix disabled save button on message editor when pasting
   [\#3459](https://github.com/matrix-org/matrix-react-sdk/pull/3459)
 * Some delinting
   [\#3456](https://github.com/matrix-org/matrix-react-sdk/pull/3456)
 * Fix failure to render newly verified phone number and nested forms
   [\#3455](https://github.com/matrix-org/matrix-react-sdk/pull/3455)
 * Focus context menus so screen readers can find them
   [\#3454](https://github.com/matrix-org/matrix-react-sdk/pull/3454)
 * Fix unit tests: Use correct ShallowRenderer and updated lolex
   [\#3453](https://github.com/matrix-org/matrix-react-sdk/pull/3453)
 * make the lifetimes of the RM configurable
   [\#3450](https://github.com/matrix-org/matrix-react-sdk/pull/3450)
 * Point to develop dependencies and fixed react-gemini-scrollbar
   [\#3451](https://github.com/matrix-org/matrix-react-sdk/pull/3451)
 * Fix address type props to state conversion
   [\#3449](https://github.com/matrix-org/matrix-react-sdk/pull/3449)
 * Only put a room in Historical if === 'leave' not peeked
   [\#3445](https://github.com/matrix-org/matrix-react-sdk/pull/3445)
 * Reuse showRoom for onJoinClick so we join using alias if its available
   [\#3444](https://github.com/matrix-org/matrix-react-sdk/pull/3444)
 * Fix: make sure scalarUrls is never undefined
   [\#3446](https://github.com/matrix-org/matrix-react-sdk/pull/3446)
 * Tweak lock file to pull in only one React version
   [\#3447](https://github.com/matrix-org/matrix-react-sdk/pull/3447)
 * Wrap deactivation check with sanity conditions
   [\#3437](https://github.com/matrix-org/matrix-react-sdk/pull/3437)
 * Fix identity server text in AddressPickerDialog
   [\#3408](https://github.com/matrix-org/matrix-react-sdk/pull/3408)
 * Change copy for sharing an email
   [\#3438](https://github.com/matrix-org/matrix-react-sdk/pull/3438)
 * Fix: stop propagation click handler for <TR> doesn't run
   [\#3441](https://github.com/matrix-org/matrix-react-sdk/pull/3441)
 * Fix: clicking on a room directory item takes you to the room
   [\#3439](https://github.com/matrix-org/matrix-react-sdk/pull/3439)
 * Fix: only hide clear filter button when blurred & no more search term
   [\#3432](https://github.com/matrix-org/matrix-react-sdk/pull/3432)
 * Dont wrap text in room directory buttons
   [\#3430](https://github.com/matrix-org/matrix-react-sdk/pull/3430)
 * Add way to report the content of a message
   [\#3290](https://github.com/matrix-org/matrix-react-sdk/pull/3290)
 * Breadcrumbs: only show after having joined at least 10 rooms
   [\#3428](https://github.com/matrix-org/matrix-react-sdk/pull/3428)
 * Breadcrumbs: show placeholder for empty slot
   [\#3429](https://github.com/matrix-org/matrix-react-sdk/pull/3429)
 * Hide the change HS url button on SSO login flow if custom urls disabled
   [\#3421](https://github.com/matrix-org/matrix-react-sdk/pull/3421)
 * Fix register page selector buttons growing too wide
   [\#3423](https://github.com/matrix-org/matrix-react-sdk/pull/3423)
 * Left panel: visual fixes
   [\#3422](https://github.com/matrix-org/matrix-react-sdk/pull/3422)
 * EditMessageComposer: disable Save button until a change has been made
   [\#3410](https://github.com/matrix-org/matrix-react-sdk/pull/3410)
 * RoomDirectory: show spinner if loading more results
   [\#3416](https://github.com/matrix-org/matrix-react-sdk/pull/3416)
 * SSO Login: don't assume m.login.password, ask server before showing
   [\#3417](https://github.com/matrix-org/matrix-react-sdk/pull/3417)
 * Switch to React 16
   [\#3270](https://github.com/matrix-org/matrix-react-sdk/pull/3270)
 * Fix replying from search results for this and all rooms
   [\#3406](https://github.com/matrix-org/matrix-react-sdk/pull/3406)
 * Support Synapse deactivate on MemberInfo without Room (timeline pill)
   [\#3411](https://github.com/matrix-org/matrix-react-sdk/pull/3411)
 * Lift 3PID state management up to Settings tab
   [\#3419](https://github.com/matrix-org/matrix-react-sdk/pull/3419)
 * Room directory: update design
   [\#3418](https://github.com/matrix-org/matrix-react-sdk/pull/3418)
 * Room directory: add action buttons on room directly
   [\#3413](https://github.com/matrix-org/matrix-react-sdk/pull/3413)
 * Add explore button in left panel to go show room directory
   [\#3412](https://github.com/matrix-org/matrix-react-sdk/pull/3412)
 * Only update m.accepted_terms if there were changes
   [\#3415](https://github.com/matrix-org/matrix-react-sdk/pull/3415)
 * Make uses of AddressPickerDialog static dialogs
   [\#3414](https://github.com/matrix-org/matrix-react-sdk/pull/3414)
 * Support sending hidden read receipts
   [\#3395](https://github.com/matrix-org/matrix-react-sdk/pull/3395)
 * Catch error from changing room power level requirements and show modal
   [\#3407](https://github.com/matrix-org/matrix-react-sdk/pull/3407)
 * Add "Remove recent messages" button in member info for administrator
   [\#3409](https://github.com/matrix-org/matrix-react-sdk/pull/3409)
 * Add bound 3PID warning when changing IS as well
   [\#3394](https://github.com/matrix-org/matrix-react-sdk/pull/3394)
 * Stregthen bound 3PID warning dialog
   [\#3401](https://github.com/matrix-org/matrix-react-sdk/pull/3401)
 * Stop setting IS input field on account change
   [\#3398](https://github.com/matrix-org/matrix-react-sdk/pull/3398)
 * New composer: use underscore for italics so it doesn't collide with bold
   when toggling
   [\#3403](https://github.com/matrix-org/matrix-react-sdk/pull/3403)
 * Switch to createReactClass: views/elements & views/groups. React 16 :D
   [\#3404](https://github.com/matrix-org/matrix-react-sdk/pull/3404)
 * Switch to createReactClass: *everything else*. React 16 :D
   [\#3405](https://github.com/matrix-org/matrix-react-sdk/pull/3405)
 * Switch to createReactClass: views/rooms and test/components. React 16 :D
   [\#3400](https://github.com/matrix-org/matrix-react-sdk/pull/3400)
 * New composer: support toggling inline formatting
   [\#3402](https://github.com/matrix-org/matrix-react-sdk/pull/3402)
 * Fix format bar not appearing in edit composer
   [\#3399](https://github.com/matrix-org/matrix-react-sdk/pull/3399)
 * Correct case of propTypes property in ES6 React Components. React 16
   [\#3397](https://github.com/matrix-org/matrix-react-sdk/pull/3397)
 * Fix error on load in composer
   [\#3396](https://github.com/matrix-org/matrix-react-sdk/pull/3396)
 * New composer: ensure undo history is persisted before applying formatting
   [\#3391](https://github.com/matrix-org/matrix-react-sdk/pull/3391)
 * New composer: fix pasting from word processors
   [\#3392](https://github.com/matrix-org/matrix-react-sdk/pull/3392)
 * New composer: fix needing to push arrow-up twice after sending first message
   after switching to a room
   [\#3393](https://github.com/matrix-org/matrix-react-sdk/pull/3393)
 * Remove accent color as selection color
   [\#3390](https://github.com/matrix-org/matrix-react-sdk/pull/3390)
 * New composer: formatting keyboard shortcuts
   [\#3389](https://github.com/matrix-org/matrix-react-sdk/pull/3389)
 * New composer: format bar tooltips
   [\#3387](https://github.com/matrix-org/matrix-react-sdk/pull/3387)
 * New composer: show format bar on selection
   [\#3386](https://github.com/matrix-org/matrix-react-sdk/pull/3386)
 * Add new agreed URLs to account data instead of overwriting
   [\#3388](https://github.com/matrix-org/matrix-react-sdk/pull/3388)
 * Fix member power levels in room settings
   [\#3384](https://github.com/matrix-org/matrix-react-sdk/pull/3384)
 * New composer: allow escaping the first slash to not write a command
   [\#3382](https://github.com/matrix-org/matrix-react-sdk/pull/3382)
 * /plain command to bypass markdown conversion
   [\#3381](https://github.com/matrix-org/matrix-react-sdk/pull/3381)
 * Improve email invite preview messaging
   [\#3385](https://github.com/matrix-org/matrix-react-sdk/pull/3385)
 * Revert "New composer: show markdown legend on focus"
   [\#3383](https://github.com/matrix-org/matrix-react-sdk/pull/3383)
 * Disable MSISDN registration if the homeserver doesn't support it
   [\#3368](https://github.com/matrix-org/matrix-react-sdk/pull/3368)
 * Add a button to MemberInfo to deactivate a user
   [\#3371](https://github.com/matrix-org/matrix-react-sdk/pull/3371)
 * New composer: show markdown legend on focus
   [\#3378](https://github.com/matrix-org/matrix-react-sdk/pull/3378)
 * New composer: allow submitting after inserting newline
   [\#3380](https://github.com/matrix-org/matrix-react-sdk/pull/3380)
 * Message editing: deserialize headers from html back to markdown
   [\#3379](https://github.com/matrix-org/matrix-react-sdk/pull/3379)
 * New composer: share user pill postfix between autocomplete and insert
   mention
   [\#3375](https://github.com/matrix-org/matrix-react-sdk/pull/3375)
 * New composer: make command detection not break with pill candidates in
   command
   [\#3374](https://github.com/matrix-org/matrix-react-sdk/pull/3374)
 * New composer: dont allow sending empty messages
   [\#3377](https://github.com/matrix-org/matrix-react-sdk/pull/3377)
 * New composer: disable spell check for pills
   [\#3376](https://github.com/matrix-org/matrix-react-sdk/pull/3376)
 * Restrict green link colours to address picker dialog
   [\#3373](https://github.com/matrix-org/matrix-react-sdk/pull/3373)
 * New composer: fix tab-complete in commands
   [\#3372](https://github.com/matrix-org/matrix-react-sdk/pull/3372)
 * Add a dialog when inviting via slash command without IS
   [\#3367](https://github.com/matrix-org/matrix-react-sdk/pull/3367)
 * Migrate away from React.createClass for auth and views/auth. React 16 :D
   [\#3363](https://github.com/matrix-org/matrix-react-sdk/pull/3363)
 * Migrate away from React.createClass for non-auth structures. React 16 :D
   [\#3365](https://github.com/matrix-org/matrix-react-sdk/pull/3365)
 * New composer: put display name in user pill text fallback instead of mxid
   [\#3366](https://github.com/matrix-org/matrix-react-sdk/pull/3366)
 * New composer: force model update after IME composition finishes
   [\#3364](https://github.com/matrix-org/matrix-react-sdk/pull/3364)
 * New composer: append colon to completed user pill when at start of message
   [\#3361](https://github.com/matrix-org/matrix-react-sdk/pull/3361)
 * Expose power level toggle for enabling e2ee to room settings
   [\#3351](https://github.com/matrix-org/matrix-react-sdk/pull/3351)
 * Allow connecting to an IS from address picker
   [\#3359](https://github.com/matrix-org/matrix-react-sdk/pull/3359)
 * New composer: don't capture enter to close autocomplete
   [\#3362](https://github.com/matrix-org/matrix-react-sdk/pull/3362)
 * Add Spoilers as per MSC2010
   [\#3018](https://github.com/matrix-org/matrix-react-sdk/pull/3018)
 * New composer: support pasting files
   [\#3358](https://github.com/matrix-org/matrix-react-sdk/pull/3358)
 * New composer: don't update model while doing IME compositions
   [\#3357](https://github.com/matrix-org/matrix-react-sdk/pull/3357)
 * New composer: handle newlines properly when pasting
   [\#3356](https://github.com/matrix-org/matrix-react-sdk/pull/3356)
 * Bump eslint-utils from 1.4.0 to 1.4.2
   [\#3360](https://github.com/matrix-org/matrix-react-sdk/pull/3360)
 * Reveal custom IS field only when required
   [\#3343](https://github.com/matrix-org/matrix-react-sdk/pull/3343)
 * Only Destroy the expected persistent widget, not *ANY*
   [\#3338](https://github.com/matrix-org/matrix-react-sdk/pull/3338)
 * Expose upgrade room permissions in room settings and fix command
   [\#3352](https://github.com/matrix-org/matrix-react-sdk/pull/3352)
 * Don't use cursor: pointer on roomsettings avatar if you can't change it
   [\#3354](https://github.com/matrix-org/matrix-react-sdk/pull/3354)
 * New composer: support forcing auto complete on name by hitting tab
   [\#3349](https://github.com/matrix-org/matrix-react-sdk/pull/3349)
 * Update email help text
   [\#3355](https://github.com/matrix-org/matrix-react-sdk/pull/3355)
 * Don't infinite loop on server change
   [\#3350](https://github.com/matrix-org/matrix-react-sdk/pull/3350)
 * Support multiple integration managers behind a labs flag
   [\#3341](https://github.com/matrix-org/matrix-react-sdk/pull/3341)
 * Support homeserver-configured integration managers
   [\#3340](https://github.com/matrix-org/matrix-react-sdk/pull/3340)
 * Auto-replace emoticons with emojis in new composer
   [\#3342](https://github.com/matrix-org/matrix-react-sdk/pull/3342)
 * Adjust copy and include identity server changing when terms are pending
   [\#3348](https://github.com/matrix-org/matrix-react-sdk/pull/3348)
 * Migrate away from React.createClass for views/dialogs. React 16 :D
   [\#3347](https://github.com/matrix-org/matrix-react-sdk/pull/3347)
 * Migrate away from React.createClass for async-components. React 16 :D
   [\#3346](https://github.com/matrix-org/matrix-react-sdk/pull/3346)
 * Switch from react-addons-test-utils to react-dom/test-utils. React 16 :D
   [\#3345](https://github.com/matrix-org/matrix-react-sdk/pull/3345)
 * Iterate over all instances of variable/tag for _t substitutions
   [\#3339](https://github.com/matrix-org/matrix-react-sdk/pull/3339)
 * Treat 404 errors on IS as having no terms
   [\#3344](https://github.com/matrix-org/matrix-react-sdk/pull/3344)
 * Add IS access token callback
   [\#3337](https://github.com/matrix-org/matrix-react-sdk/pull/3337)
 * Tweak rageshake logging messages
   [\#3331](https://github.com/matrix-org/matrix-react-sdk/pull/3331)
 * Support editing composer to be used as main composer (feature flagged)
   [\#3287](https://github.com/matrix-org/matrix-react-sdk/pull/3287)
 * Remove tooltipClassName from the Field's input
   [\#3333](https://github.com/matrix-org/matrix-react-sdk/pull/3333)
 * Fix alignment of discovery section addresses
   [\#3335](https://github.com/matrix-org/matrix-react-sdk/pull/3335)
 * No-op removals of widgets that don't exist
   [\#3336](https://github.com/matrix-org/matrix-react-sdk/pull/3336)
 * Remove extraneous logging
   [\#3334](https://github.com/matrix-org/matrix-react-sdk/pull/3334)
 * Handle terms agreement in Discovery section of user settings
   [\#3327](https://github.com/matrix-org/matrix-react-sdk/pull/3327)
 * Don't double translate labs settings
   [\#3332](https://github.com/matrix-org/matrix-react-sdk/pull/3332)
 * Explicitly check for modifier keydown events before focusing composer
   [\#3328](https://github.com/matrix-org/matrix-react-sdk/pull/3328)
 * Touch up settings: alignment, spacing, error states
   [\#3330](https://github.com/matrix-org/matrix-react-sdk/pull/3330)
 * Fix regression on widget panel edit button
   [\#3329](https://github.com/matrix-org/matrix-react-sdk/pull/3329)
 * Clarify that device names are publicly visible
   [\#3326](https://github.com/matrix-org/matrix-react-sdk/pull/3326)
 * Tweak privacy settings copy and whitespace
   [\#3325](https://github.com/matrix-org/matrix-react-sdk/pull/3325)
 *  Persist and maintain identity server in account data
   [\#3320](https://github.com/matrix-org/matrix-react-sdk/pull/3320)
 *  Prompt for terms of service on identity server changes
   [\#3317](https://github.com/matrix-org/matrix-react-sdk/pull/3317)
 * Allow 3pids to be added with no ID server set
   [\#3323](https://github.com/matrix-org/matrix-react-sdk/pull/3323)
 * Fix up remove threepid confirmation UX
   [\#3324](https://github.com/matrix-org/matrix-react-sdk/pull/3324)
 * Improve Discovery section when no IS set
   [\#3322](https://github.com/matrix-org/matrix-react-sdk/pull/3322)
 * Allow password reset without an ID Server
   [\#3319](https://github.com/matrix-org/matrix-react-sdk/pull/3319)
 * Allow registering with email if no ID Server
   [\#3318](https://github.com/matrix-org/matrix-react-sdk/pull/3318)
 * Update from Weblate
   [\#3321](https://github.com/matrix-org/matrix-react-sdk/pull/3321)
 * Fix showing events which were replied to and then redacted
   [\#3310](https://github.com/matrix-org/matrix-react-sdk/pull/3310)
 * Prompt for terms of service on integration manager changes
   [\#3316](https://github.com/matrix-org/matrix-react-sdk/pull/3316)
 * Warn on disconnecting from IS
   [\#3314](https://github.com/matrix-org/matrix-react-sdk/pull/3314)
 * Fix set integration manager tooltip
   [\#3315](https://github.com/matrix-org/matrix-react-sdk/pull/3315)
 * Prompt for ICE server fallback permission
   [\#3309](https://github.com/matrix-org/matrix-react-sdk/pull/3309)
 * Fix Persisted Widgets (Jitsi) randomly closing on room change
   [\#3313](https://github.com/matrix-org/matrix-react-sdk/pull/3313)
 * Verifying your own device should not ask you to "contact its owner"
   [\#3312](https://github.com/matrix-org/matrix-react-sdk/pull/3312)
 * Support changing your integration manager in the UI
   [\#3308](https://github.com/matrix-org/matrix-react-sdk/pull/3308)
 * delint languageHandler
   [\#3311](https://github.com/matrix-org/matrix-react-sdk/pull/3311)
 * Disconnect from IS Button
   [\#3305](https://github.com/matrix-org/matrix-react-sdk/pull/3305)
 * Add UI in settings to change ID Server
   [\#3300](https://github.com/matrix-org/matrix-react-sdk/pull/3300)
 * Read integration managers from account data (widgets)
   [\#3302](https://github.com/matrix-org/matrix-react-sdk/pull/3302)
 * Refactor integration manager handling into a common place
   [\#3301](https://github.com/matrix-org/matrix-react-sdk/pull/3301)
 * Fix wrong default-letter-avatar for RoomAvatarEvent
   [\#3291](https://github.com/matrix-org/matrix-react-sdk/pull/3291)
 * Fix alignment of add email/phone number inputs in settings
   [\#3307](https://github.com/matrix-org/matrix-react-sdk/pull/3307)
 * Bump matrix-react-test-utils for React 16 compatibility
   [\#3306](https://github.com/matrix-org/matrix-react-sdk/pull/3306)
 * Consolidate Themes into ThemeController. Remove hardcoded themes in view
   [\#3304](https://github.com/matrix-org/matrix-react-sdk/pull/3304)
 * Deduplicate code in ModularServerConfig by extending ServerConfig
   [\#3303](https://github.com/matrix-org/matrix-react-sdk/pull/3303)
 * RegistrationForm: the Fields are controlled, fix default values
   [\#3299](https://github.com/matrix-org/matrix-react-sdk/pull/3299)
 * change Modal async/await signature to use raw promises
   [\#3298](https://github.com/matrix-org/matrix-react-sdk/pull/3298)
 * Modal.createX return thenable which extends onFinished, for async/await
   [\#3297](https://github.com/matrix-org/matrix-react-sdk/pull/3297)
 * Add mount-guards to MImageBody
   [\#3294](https://github.com/matrix-org/matrix-react-sdk/pull/3294)
 * Get rid of support for legacy login params
   [\#3296](https://github.com/matrix-org/matrix-react-sdk/pull/3296)
 * Change throttle to debounce
   [\#3295](https://github.com/matrix-org/matrix-react-sdk/pull/3295)
 * Misc fixes to karma webpack
   [\#3293](https://github.com/matrix-org/matrix-react-sdk/pull/3293)
 * Remove 3PID binding during registration
   [\#3289](https://github.com/matrix-org/matrix-react-sdk/pull/3289)
 * Add controls for toggling discovery in user settings
   [\#3288](https://github.com/matrix-org/matrix-react-sdk/pull/3288)
 * Reuse DMs whenever possible instead of asking to reuse them
   [\#3286](https://github.com/matrix-org/matrix-react-sdk/pull/3286)
 * Work with no ID server set
   [\#3285](https://github.com/matrix-org/matrix-react-sdk/pull/3285)
 * Split MessageEditor up in edit-specifics & reusable parts for main composer
   [\#3282](https://github.com/matrix-org/matrix-react-sdk/pull/3282)
 * Fix waste of space of collapsed left panel
   [\#2668](https://github.com/matrix-org/matrix-react-sdk/pull/2668)
 * Add help slash command
   [\#3257](https://github.com/matrix-org/matrix-react-sdk/pull/3257)
 * Allow setting in electron whether or not to auto hide menu bar
   [\#3278](https://github.com/matrix-org/matrix-react-sdk/pull/3278)
 * Progress towards React 16 compatibility
   [\#3276](https://github.com/matrix-org/matrix-react-sdk/pull/3276)
 * Hide settings button on Room Tile Context Menu for myMembership=invite
   [\#3284](https://github.com/matrix-org/matrix-react-sdk/pull/3284)
 * Remove withMatrixClient as we are committed to using Contexts
   [\#3279](https://github.com/matrix-org/matrix-react-sdk/pull/3279)
 * Update existing 3PID management UX
   [\#3283](https://github.com/matrix-org/matrix-react-sdk/pull/3283)
 * Let user know their account has been deactivated upon trying to login
   [\#3280](https://github.com/matrix-org/matrix-react-sdk/pull/3280)
 * Fix newline not being appended to code block while converting message to
   markdown
   [\#3274](https://github.com/matrix-org/matrix-react-sdk/pull/3274)
 * Don't load guest sessions on post-registration login link
   [\#3273](https://github.com/matrix-org/matrix-react-sdk/pull/3273)
 * Show terms modal when inviting by email
   [\#3271](https://github.com/matrix-org/matrix-react-sdk/pull/3271)
 * Add developer documentation for the new editor
   [\#3272](https://github.com/matrix-org/matrix-react-sdk/pull/3272)
 * Undo/redo support for new editor
   [\#3267](https://github.com/matrix-org/matrix-react-sdk/pull/3267)
 * Check IS v2 account tokens for validity
   [\#3268](https://github.com/matrix-org/matrix-react-sdk/pull/3268)
 * Fix dialog button border colours
   [\#3269](https://github.com/matrix-org/matrix-react-sdk/pull/3269)
 * Upgrade dependencies
   [\#3266](https://github.com/matrix-org/matrix-react-sdk/pull/3266)

Changes in [1.5.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.3) (2019-09-16)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.3-rc.3...v1.5.3)

 * Release: Directory should use the alias or server information to join the
   room
   [\#3448](https://github.com/matrix-org/matrix-react-sdk/pull/3448)

Changes in [1.5.3-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.3-rc.3) (2019-09-13)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.3-rc.2...v1.5.3-rc.3)

 * js-sdk rc.1 for report API

Changes in [1.5.3-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.3-rc.2) (2019-09-13)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.3-rc.1...v1.5.3-rc.2)

 * Fix: stop propagation click handler for <TR> doesn't run
   [\#3443](https://github.com/matrix-org/matrix-react-sdk/pull/3443)
 * Add way to report the content of a message
   [\#3442](https://github.com/matrix-org/matrix-react-sdk/pull/3442)
 * Fix synapse deactivate button for release
   [\#3436](https://github.com/matrix-org/matrix-react-sdk/pull/3436)
 * Fix: clicking on a room directory item takes you to the room
   [\#3440](https://github.com/matrix-org/matrix-react-sdk/pull/3440)

Changes in [1.5.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.3-rc.1) (2019-09-12)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.2...v1.5.3-rc.1)

 * Fix: only hide clear filter button when blurred & no more search term
   [\#3435](https://github.com/matrix-org/matrix-react-sdk/pull/3435)
 * Dont wrap text in room directory buttons
   [\#3434](https://github.com/matrix-org/matrix-react-sdk/pull/3434)

Changes in [1.5.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.2) (2019-09-12)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.2-rc.1...v1.5.2)

 * Fix register page selector buttons growing too wide
   [\#3427](https://github.com/matrix-org/matrix-react-sdk/pull/3427)
 * Left panel: visual fixes
   [\#3426](https://github.com/matrix-org/matrix-react-sdk/pull/3426)
 * Hide the change HS url button on SSO login flow if custom urls disabled
   [\#3425](https://github.com/matrix-org/matrix-react-sdk/pull/3425)
 * RoomDirectory: show spinner if loading more results
   [\#3424](https://github.com/matrix-org/matrix-react-sdk/pull/3424)

Changes in [1.5.2-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.2-rc.1) (2019-09-11)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.1...v1.5.2-rc.1)

 * Merge first pass of First Time User Experience to release branch
   [\#3420](https://github.com/matrix-org/matrix-react-sdk/pull/3420)

Changes in [1.5.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.1) (2019-08-05)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.0-rc.1...v1.5.1)

 * Let user know their account has been deactivated upon trying to login
   [\#3281](https://github.com/matrix-org/matrix-react-sdk/pull/3281)

Changes in [1.5.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.0) (2019-08-05)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.5.0-rc.1...v1.5.0)

 * Don't load guest sessions on post-registration login link
   [\#3277](https://github.com/matrix-org/matrix-react-sdk/pull/3277)

Changes in [1.5.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.5.0-rc.1) (2019-07-31)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.4.0...v1.5.0-rc.1)

 * Upgrade to JS SDK 2.3.0-rc.1
 * Update from Weblate
   [\#3265](https://github.com/matrix-org/matrix-react-sdk/pull/3265)
 * Replace React.PropTypes with usage of the `prop-types` package
   [\#3263](https://github.com/matrix-org/matrix-react-sdk/pull/3263)
 * strikethrough & underline deletions & insertions
   [\#3264](https://github.com/matrix-org/matrix-react-sdk/pull/3264)
 * Get rid of warning of required prop
   [\#3261](https://github.com/matrix-org/matrix-react-sdk/pull/3261)
 * Fix html diffs repeating text sometimes
   [\#3262](https://github.com/matrix-org/matrix-react-sdk/pull/3262)
 * Introduce RoomContext for sharing state between RoomView and children
   [\#3260](https://github.com/matrix-org/matrix-react-sdk/pull/3260)
 * Upgrade emojibase to fix :anxious:
   [\#3259](https://github.com/matrix-org/matrix-react-sdk/pull/3259)
 * Add support for IS v2 API with authentication
   [\#3256](https://github.com/matrix-org/matrix-react-sdk/pull/3256)
 * Fix autocomplete for editing being broken
   [\#3258](https://github.com/matrix-org/matrix-react-sdk/pull/3258)
 * Unit tests for new editor
   [\#3247](https://github.com/matrix-org/matrix-react-sdk/pull/3247)
 * Show MessageActionBar buttons conditionally on room state permissions
   [\#3255](https://github.com/matrix-org/matrix-react-sdk/pull/3255)
 * Handle onPaste AddressPickerDialog, allow addressing CSV/NL/Space delim list
   [\#3249](https://github.com/matrix-org/matrix-react-sdk/pull/3249)
 * Move history with alt up/down regardless of where selection is
   [\#3254](https://github.com/matrix-org/matrix-react-sdk/pull/3254)
 * Update from Weblate
   [\#3253](https://github.com/matrix-org/matrix-react-sdk/pull/3253)
 * Fix /rainbowme and /rainbow breaking apart utf-16 emoji
   [\#3248](https://github.com/matrix-org/matrix-react-sdk/pull/3248)
 * Tweak interactive tooltip buffer area allow for overshoot
   [\#3245](https://github.com/matrix-org/matrix-react-sdk/pull/3245)
 * Keep widget URL in permission screen to one line
   [\#3243](https://github.com/matrix-org/matrix-react-sdk/pull/3243)
 * Avoid visual glitch when terms appear for Integration Manager
   [\#3242](https://github.com/matrix-org/matrix-react-sdk/pull/3242)
 * Show diff for formatted messages in the edit history
   [\#3244](https://github.com/matrix-org/matrix-react-sdk/pull/3244)
 * Redirect paste to composer when event target can't receive input
   [\#3239](https://github.com/matrix-org/matrix-react-sdk/pull/3239)
 * Restore manual composing focusing logic
   [\#3241](https://github.com/matrix-org/matrix-react-sdk/pull/3241)
 * ToS for ISes/IMs: prompt on use screen
   [\#3199](https://github.com/matrix-org/matrix-react-sdk/pull/3199)
 * Defer IM token until widget is shown and permission granted
   [\#3240](https://github.com/matrix-org/matrix-react-sdk/pull/3240)
 * Move read marker past invisible events
   [\#3226](https://github.com/matrix-org/matrix-react-sdk/pull/3226)
 * Basic diff visualisation for plain text edits
   [\#3238](https://github.com/matrix-org/matrix-react-sdk/pull/3238)
 * Don't focus composer on keydown with modifier
   [\#3237](https://github.com/matrix-org/matrix-react-sdk/pull/3237)
 * Focus composer when typing anywhere in the app
   [\#3224](https://github.com/matrix-org/matrix-react-sdk/pull/3224)
 * Don't show remove button for original event in edit history
   [\#3235](https://github.com/matrix-org/matrix-react-sdk/pull/3235)
 * Remove feature flags for reactions and edits
   [\#3233](https://github.com/matrix-org/matrix-react-sdk/pull/3233)
 * Enable reactions and edits by default
   [\#3229](https://github.com/matrix-org/matrix-react-sdk/pull/3229)
 * Improve interactive tooltip safe mousing area
   [\#3228](https://github.com/matrix-org/matrix-react-sdk/pull/3228)
 * Add a previous event safe area around action bar
   [\#3227](https://github.com/matrix-org/matrix-react-sdk/pull/3227)
 * Parse integration manager origins more sensibly
   [\#3217](https://github.com/matrix-org/matrix-react-sdk/pull/3217)
 * ChatCreateOrReuse show only rooms both you and the other party still in
   [\#3225](https://github.com/matrix-org/matrix-react-sdk/pull/3225)
 * Check for liveliness on submission when the server was previously dead
   [\#3218](https://github.com/matrix-org/matrix-react-sdk/pull/3218)
 * Fix autocomplete delay text field not accepting text
   [\#3219](https://github.com/matrix-org/matrix-react-sdk/pull/3219)
 * Don't show a reason if there's no reason for a kick/ban
   [\#3220](https://github.com/matrix-org/matrix-react-sdk/pull/3220)
 * Take adjacent invisible events into account for read receipt, even if any
   but first should be ignored.
   [\#3221](https://github.com/matrix-org/matrix-react-sdk/pull/3221)
 * Check content and content.users in power levels
   [\#3216](https://github.com/matrix-org/matrix-react-sdk/pull/3216)
 * Autojoin rooms when clicking the tombstone
   [\#3206](https://github.com/matrix-org/matrix-react-sdk/pull/3206)
 * Verify i18n in CI
   [\#3209](https://github.com/matrix-org/matrix-react-sdk/pull/3209)
 * Send the correct UIA alongside the wrong UIA for backwards comaptibility
   [\#3211](https://github.com/matrix-org/matrix-react-sdk/pull/3211)
 * Remove unused identityEnabled property from ValidatedServerConfig
   [\#3213](https://github.com/matrix-org/matrix-react-sdk/pull/3213)
 * Remove misleading text about admins logging people out from soft logout
   [\#3205](https://github.com/matrix-org/matrix-react-sdk/pull/3205)

Changes in [1.4.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.4.0) (2019-07-18)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.4.0-rc.3...v1.4.0)

 * Upgrade to JS SDK 2.2.0
 * Don't show remove button for original event in edit history
   [\#3236](https://github.com/matrix-org/matrix-react-sdk/pull/3236)
 * Remove feature flags for reactions and edits
   [\#3234](https://github.com/matrix-org/matrix-react-sdk/pull/3234)
 * Enable reactions and edits by default
   [\#3232](https://github.com/matrix-org/matrix-react-sdk/pull/3232)
 * Improve interactive tooltip safe mousing area
   [\#3231](https://github.com/matrix-org/matrix-react-sdk/pull/3231)
 * Add a previous event safe area around action bar
   [\#3230](https://github.com/matrix-org/matrix-react-sdk/pull/3230)

Changes in [1.4.0-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.4.0-rc.3) (2019-07-15)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.4.0-rc.2...v1.4.0-rc.3)

 * Check content and content.users in power levels
   [\#3223](https://github.com/matrix-org/matrix-react-sdk/pull/3223)
 * Take adjacent invisible events into account for read receipt, even if any
   but first should be ignored.
   [\#3222](https://github.com/matrix-org/matrix-react-sdk/pull/3222)

Changes in [1.4.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.4.0-rc.2) (2019-07-12)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.4.0-rc.1...v1.4.0-rc.2)

 * Upgrade to JS SDK 2.2.0-rc.2 to fix regresion in listing devices
 * Remove misleading text about admins logging people out from soft logout
   [\#3215](https://github.com/matrix-org/matrix-react-sdk/pull/3215)

Changes in [1.4.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.4.0-rc.1) (2019-07-12)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.3.1...v1.4.0-rc.1)

 * Update from Weblate
   [\#3214](https://github.com/matrix-org/matrix-react-sdk/pull/3214)
 * Prevent autocomplete on paste, and verserev-ing text before and after :
   [\#3210](https://github.com/matrix-org/matrix-react-sdk/pull/3210)
 * Close settings after deactivating
   [\#3212](https://github.com/matrix-org/matrix-react-sdk/pull/3212)
 * Require an issue URL (or notes) on rageshakes
   [\#3207](https://github.com/matrix-org/matrix-react-sdk/pull/3207)
 * Use r0 media endpoints for group tests
   [\#3202](https://github.com/matrix-org/matrix-react-sdk/pull/3202)
 * Fix field styling regression
   [\#3204](https://github.com/matrix-org/matrix-react-sdk/pull/3204)
 * Upgrade dependencies
   [\#3203](https://github.com/matrix-org/matrix-react-sdk/pull/3203)
 * Show anything other than ban/invite -> leave as a kick
   [\#3198](https://github.com/matrix-org/matrix-react-sdk/pull/3198)
 * Run stylelint on all SCSS files
   [\#3200](https://github.com/matrix-org/matrix-react-sdk/pull/3200)
 * Show original event in edit history
   [\#3195](https://github.com/matrix-org/matrix-react-sdk/pull/3195)
 * Use the state variable for the password when deactivating
   [\#3201](https://github.com/matrix-org/matrix-react-sdk/pull/3201)
 * Support SSO for rehydrating a soft-logged-out session.
   [\#3197](https://github.com/matrix-org/matrix-react-sdk/pull/3197)
 * Change highlight colour on dark theme
   [\#3196](https://github.com/matrix-org/matrix-react-sdk/pull/3196)
 *  Dress up the soft logout page to look like the design
   [\#3190](https://github.com/matrix-org/matrix-react-sdk/pull/3190)
 * Overwrite the old session if the new creds are for a different user
   [\#3189](https://github.com/matrix-org/matrix-react-sdk/pull/3189)
 * Fix React crash when using a non-default homeserver on soft logout
   [\#3188](https://github.com/matrix-org/matrix-react-sdk/pull/3188)
 *  Change soft logout rehydrate text if there's pending key backups
   [\#3187](https://github.com/matrix-org/matrix-react-sdk/pull/3187)
 * Ask for the user's password to rehydrate their soft logged out session
   [\#3182](https://github.com/matrix-org/matrix-react-sdk/pull/3182)
 * Don't try to call bodyToHtml with an empty content
   [\#3194](https://github.com/matrix-org/matrix-react-sdk/pull/3194)
 * Take server-side aggregation into account for timestamp on (edited) tooltip
   [\#3193](https://github.com/matrix-org/matrix-react-sdk/pull/3193)
 * Fix some React errors
   [\#3164](https://github.com/matrix-org/matrix-react-sdk/pull/3164)
 * Preserve reply fallback on edit
   [\#3192](https://github.com/matrix-org/matrix-react-sdk/pull/3192)
 * Don't show Remove button in ImageView if can't redact, delint ImageView
   [\#3191](https://github.com/matrix-org/matrix-react-sdk/pull/3191)
 * Edit history actions
   [\#3180](https://github.com/matrix-org/matrix-react-sdk/pull/3180)
 * Don't allow editing via up-arrow when Replying
   [\#3183](https://github.com/matrix-org/matrix-react-sdk/pull/3183)
 * If oldContent matches newContent, skip sending the edit
   [\#3103](https://github.com/matrix-org/matrix-react-sdk/pull/3103)
 * Track live events in timeline and use for read receipts and read markers
   [\#3184](https://github.com/matrix-org/matrix-react-sdk/pull/3184)
 * Upgrade dependencies
   [\#3179](https://github.com/matrix-org/matrix-react-sdk/pull/3179)
 * Allow diplayed reaction values to contain anything
   [\#3186](https://github.com/matrix-org/matrix-react-sdk/pull/3186)
 * Fix interactive tooltip null target error
   [\#3185](https://github.com/matrix-org/matrix-react-sdk/pull/3185)
 * Require that users go to the soft logout page if they're soft logged out
   [\#3181](https://github.com/matrix-org/matrix-react-sdk/pull/3181)
 * Emojibase data includes blank variations, accept these when searching
   [\#3163](https://github.com/matrix-org/matrix-react-sdk/pull/3163)
 * Implement basic soft logout handling
   [\#3177](https://github.com/matrix-org/matrix-react-sdk/pull/3177)
 * De-lint ScalarAuthClient
   [\#3178](https://github.com/matrix-org/matrix-react-sdk/pull/3178)
 * show /relations error in edit history dialog
   [\#3174](https://github.com/matrix-org/matrix-react-sdk/pull/3174)

Changes in [1.3.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.3.1) (2019-07-11)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.3.0...v1.3.1)

 * Fix account deactivation
   [\#3201](https://github.com/matrix-org/matrix-react-sdk/pull/3201)
 * Upgrade lodash dependencies
 * Upgrade to JS SDK 2.1.1

Changes in [1.3.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.3.0) (2019-07-08)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.3.0-rc.1...v1.3.0)

No changes since rc.1

Changes in [1.3.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.3.0-rc.1) (2019-07-03)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.2.2...v1.3.0-rc.1)

 * MELS handle m.room.third_party_invite
   [\#3173](https://github.com/matrix-org/matrix-react-sdk/pull/3173)
 * Fix logic around MemberList invites section, specifically regarding 3pid
   [\#3172](https://github.com/matrix-org/matrix-react-sdk/pull/3172)
 * Update from Weblate
   [\#3176](https://github.com/matrix-org/matrix-react-sdk/pull/3176)
 * Track the user's own typing state external to the composer
   [\#3150](https://github.com/matrix-org/matrix-react-sdk/pull/3150)
 * Handle associated event send failures
   [\#3170](https://github.com/matrix-org/matrix-react-sdk/pull/3170)
 * Improve interactive tooltip hover behaviour
   [\#3169](https://github.com/matrix-org/matrix-react-sdk/pull/3169)
 * Fix login type selector border
   [\#3171](https://github.com/matrix-org/matrix-react-sdk/pull/3171)
 * Use the event sender instead of event ID for viaServers off a tombstone
   [\#3159](https://github.com/matrix-org/matrix-react-sdk/pull/3159)
 * Append keyshare request dialogs instead of replacing the current dialog
   [\#3160](https://github.com/matrix-org/matrix-react-sdk/pull/3160)
 * Add AccessibleTooltipButton and use it for RoomSubList buttons
   [\#3165](https://github.com/matrix-org/matrix-react-sdk/pull/3165)
 * MemberInfo wrap Device Name/ID
   [\#3166](https://github.com/matrix-org/matrix-react-sdk/pull/3166)
 * Correctly populate the dispatch for joining a room via servers
   [\#3161](https://github.com/matrix-org/matrix-react-sdk/pull/3161)
 * Clean up legacy breadcrumbs persistence fallback
   [\#3162](https://github.com/matrix-org/matrix-react-sdk/pull/3162)
 * Update from Weblate
   [\#3168](https://github.com/matrix-org/matrix-react-sdk/pull/3168)
 * Add ability to render null-rejoins in Timeline and MELS
   [\#3135](https://github.com/matrix-org/matrix-react-sdk/pull/3135)
 * Add /myavatar command
   [\#3155](https://github.com/matrix-org/matrix-react-sdk/pull/3155)
 * Update config.json docs location
   [\#3158](https://github.com/matrix-org/matrix-react-sdk/pull/3158)
 * If on trackpad, don't mess with horizontal scrolling.
   [\#3148](https://github.com/matrix-org/matrix-react-sdk/pull/3148)
 * Limit reactions row on initial display
   [\#3152](https://github.com/matrix-org/matrix-react-sdk/pull/3152)
 * Unpin highlight.js
   [\#3156](https://github.com/matrix-org/matrix-react-sdk/pull/3156)
 * Flexboxify generic error page
   [\#3154](https://github.com/matrix-org/matrix-react-sdk/pull/3154)
 * Fix weird scrollbar when devtools is in a narrow browser
   [\#3153](https://github.com/matrix-org/matrix-react-sdk/pull/3153)
 * Show a loading state for slow peeks
   [\#3142](https://github.com/matrix-org/matrix-react-sdk/pull/3142)
 * Don't show error dialog when user has no webcam
   [\#3146](https://github.com/matrix-org/matrix-react-sdk/pull/3146)
 * Make edit history work in encrypted rooms.
   [\#3151](https://github.com/matrix-org/matrix-react-sdk/pull/3151)
 * Change interactive tooltip to only flip when required
   [\#3147](https://github.com/matrix-org/matrix-react-sdk/pull/3147)
 * Edit history dialog
   [\#3144](https://github.com/matrix-org/matrix-react-sdk/pull/3144)
 * Fix the scrollbar in the community bar
   [\#3143](https://github.com/matrix-org/matrix-react-sdk/pull/3143)
 * Add focus border to edit composer
   [\#3145](https://github.com/matrix-org/matrix-react-sdk/pull/3145)
 * Supply oobData to RoomPreviewBar
   [\#3141](https://github.com/matrix-org/matrix-react-sdk/pull/3141)
 * Don't boost trackpad users in breadcrumbs
   [\#3140](https://github.com/matrix-org/matrix-react-sdk/pull/3140)
 * Fix room upgrade warning being chopped off and a spelling mistake
   [\#3139](https://github.com/matrix-org/matrix-react-sdk/pull/3139)
 * Add quick reaction buttons in tooltip
   [\#3138](https://github.com/matrix-org/matrix-react-sdk/pull/3138)
 * When joining from room directory, use auto_join
   [\#3136](https://github.com/matrix-org/matrix-react-sdk/pull/3136)
 * Improve API and interactivity of new tooltip
   [\#3137](https://github.com/matrix-org/matrix-react-sdk/pull/3137)
 * Use feature flag for displaying edits as well
   [\#3132](https://github.com/matrix-org/matrix-react-sdk/pull/3132)
 * Add interactive tooltip style
   [\#3131](https://github.com/matrix-org/matrix-react-sdk/pull/3131)
 * Remove redundant extra chevrons from ContextualMenu
   [\#3129](https://github.com/matrix-org/matrix-react-sdk/pull/3129)
 * Editor caret improvements
   [\#3126](https://github.com/matrix-org/matrix-react-sdk/pull/3126)
 * Disable left/right arrow navigating completions for now
   [\#3130](https://github.com/matrix-org/matrix-react-sdk/pull/3130)
 * Take list nesting into account for indenting
   [\#3128](https://github.com/matrix-org/matrix-react-sdk/pull/3128)
 * Add file size to UploadConfirmDialog
   [\#3127](https://github.com/matrix-org/matrix-react-sdk/pull/3127)
 * Consider cancelled verifications when mounting IncomingSasDialog
   [\#3123](https://github.com/matrix-org/matrix-react-sdk/pull/3123)
 * Make the verification cancelled dialog say OK instead of Cancel
   [\#3124](https://github.com/matrix-org/matrix-react-sdk/pull/3124)
 * Update from Weblate
   [\#3125](https://github.com/matrix-org/matrix-react-sdk/pull/3125)
 * Remove unused ContextualMenu features
   [\#3122](https://github.com/matrix-org/matrix-react-sdk/pull/3122)
 * Fix casing of TooltipButton
   [\#3119](https://github.com/matrix-org/matrix-react-sdk/pull/3119)
 * De-duplicate notif badge code
   [\#3120](https://github.com/matrix-org/matrix-react-sdk/pull/3120)
 * Fix favicon/title badge count
   [\#3121](https://github.com/matrix-org/matrix-react-sdk/pull/3121)
 * Switch ugly password boxes to Field or styled input
   [\#3071](https://github.com/matrix-org/matrix-react-sdk/pull/3071)
 * Restore warning for if you're already logged in
   [\#3118](https://github.com/matrix-org/matrix-react-sdk/pull/3118)
 * Provide default name if device label is missing
   [\#3113](https://github.com/matrix-org/matrix-react-sdk/pull/3113)
 * Support @room pills while editing
   [\#3108](https://github.com/matrix-org/matrix-react-sdk/pull/3108)

Changes in [1.2.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.2.2) (2019-06-19)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.2.2-rc.2...v1.2.2)

No changes since rc.2

Changes in [1.2.2-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.2.2-rc.2) (2019-06-18)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.2.2-rc.1...v1.2.2-rc.2)

 * Defer scalar API calls until they are needed
   [\#3115](https://github.com/matrix-org/matrix-react-sdk/pull/3115)
 * Blend pending redactions
   [\#3117](https://github.com/matrix-org/matrix-react-sdk/pull/3117)
 * Keep old arrow-up behaviour when editing is not enabled
   [\#3116](https://github.com/matrix-org/matrix-react-sdk/pull/3116)
 * Restore Composer History under shift-up & down
   [\#3098](https://github.com/matrix-org/matrix-react-sdk/pull/3098)
 * Allow changing server if validation has failed
   [\#3114](https://github.com/matrix-org/matrix-react-sdk/pull/3114)
 * Add Upload All button to UploadConfirmDialog
   [\#3109](https://github.com/matrix-org/matrix-react-sdk/pull/3109)
 * Re-enable register button
   [\#3112](https://github.com/matrix-org/matrix-react-sdk/pull/3112)
 * keep mx_Field stretching
   [\#3111](https://github.com/matrix-org/matrix-react-sdk/pull/3111)
 * Fix double-spinner
   [\#3107](https://github.com/matrix-org/matrix-react-sdk/pull/3107)
 * Fix display of canonicalAlias in group room info
   [\#3110](https://github.com/matrix-org/matrix-react-sdk/pull/3110)
 * Fix welcome user
   [\#3106](https://github.com/matrix-org/matrix-react-sdk/pull/3106)
 * Support editing emote messages
   [\#3105](https://github.com/matrix-org/matrix-react-sdk/pull/3105)
 * Use flex: 1 for mx_Field to replace all the calc(100% - 20px) and more
   [\#3104](https://github.com/matrix-org/matrix-react-sdk/pull/3104)
 * Use overflow on MemberInfo name/mxid so that the back button stays
   [\#3099](https://github.com/matrix-org/matrix-react-sdk/pull/3099)
 * Allow changing servers on nonfatal errors
   [\#3102](https://github.com/matrix-org/matrix-react-sdk/pull/3102)
 * Simplify email registration
   [\#3101](https://github.com/matrix-org/matrix-react-sdk/pull/3101)
 * Allow arrow keys navigation in autocomplete list
   [\#2966](https://github.com/matrix-org/matrix-react-sdk/pull/2966)
 * Edit unsent messages
   [\#3097](https://github.com/matrix-org/matrix-react-sdk/pull/3097)
 * Fix registration with email + non-default HS
   [\#3096](https://github.com/matrix-org/matrix-react-sdk/pull/3096)
 * Raise action bar above read marker
   [\#3095](https://github.com/matrix-org/matrix-react-sdk/pull/3095)
 * Console log more helpfully
   [\#3094](https://github.com/matrix-org/matrix-react-sdk/pull/3094)

Changes in [1.2.2-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.2.2-rc.1) (2019-06-12)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.2.1...v1.2.2-rc.1)

 * Align message context menu to right and vertically where space available
   [\#3087](https://github.com/matrix-org/matrix-react-sdk/pull/3087)
 * Allow registration to submit for non-fatal errors
   [\#3093](https://github.com/matrix-org/matrix-react-sdk/pull/3093)
 * Clear the login busy state after .well-known discovery
   [\#3092](https://github.com/matrix-org/matrix-react-sdk/pull/3092)
 * Update from Weblate
   [\#3091](https://github.com/matrix-org/matrix-react-sdk/pull/3091)
 * Fix registration after fail-fast
   [\#3090](https://github.com/matrix-org/matrix-react-sdk/pull/3090)
 * Use setBusy interface of js-sdk interactive auth
   [\#3085](https://github.com/matrix-org/matrix-react-sdk/pull/3085)
 * Don't handle identity server failure as fatal, and use the right message
   [\#3088](https://github.com/matrix-org/matrix-react-sdk/pull/3088)
 * Recheck message actions on decrypt
   [\#3084](https://github.com/matrix-org/matrix-react-sdk/pull/3084)
 * Fix exception on logout
   [\#3086](https://github.com/matrix-org/matrix-react-sdk/pull/3086)
 * Remember we were trying to accept an invite
   [\#3083](https://github.com/matrix-org/matrix-react-sdk/pull/3083)
 * Add funding details for GitHub sponsor button
   [\#3079](https://github.com/matrix-org/matrix-react-sdk/pull/3079)
 * Remove highlight from reactions
   [\#3081](https://github.com/matrix-org/matrix-react-sdk/pull/3081)
 * Clarify that only lowercase letters are allowed
   [\#3080](https://github.com/matrix-org/matrix-react-sdk/pull/3080)
 * Don't handle identity server liveliness errors as fatal
   [\#3082](https://github.com/matrix-org/matrix-react-sdk/pull/3082)
 * truncate long display names in timeline headings
   [\#3078](https://github.com/matrix-org/matrix-react-sdk/pull/3078)
 * Fail more softly on homeserver liveliness errors
   [\#3067](https://github.com/matrix-org/matrix-react-sdk/pull/3067)
 * Fix AddressPickerDialog adding wrong entry to selected list case
   [\#3076](https://github.com/matrix-org/matrix-react-sdk/pull/3076)
 * change profile keybind to backtick from i due to italics conflict
   [\#3077](https://github.com/matrix-org/matrix-react-sdk/pull/3077)
 * Look busy whilst requesting the email token
   [\#3075](https://github.com/matrix-org/matrix-react-sdk/pull/3075)
 * Fix email invites address-match checking
   [\#3074](https://github.com/matrix-org/matrix-react-sdk/pull/3074)
 * Add license info for Twemoji
   [\#3073](https://github.com/matrix-org/matrix-react-sdk/pull/3073)
 * Show read receipts on top of message
   [\#3072](https://github.com/matrix-org/matrix-react-sdk/pull/3072)
 * Be somewhat fuzzier when matching emojis to complete on space
   [\#3070](https://github.com/matrix-org/matrix-react-sdk/pull/3070)
 * Restrict reactions to a single emoji
   [\#3069](https://github.com/matrix-org/matrix-react-sdk/pull/3069)
 * Fix live updates to reaction row buttons
   [\#3068](https://github.com/matrix-org/matrix-react-sdk/pull/3068)
 * Don't refresh custom status on logout
   [\#3065](https://github.com/matrix-org/matrix-react-sdk/pull/3065)
 * Add a logged in class to EmbeddedPage and react to MatrixClient changes
   [\#3066](https://github.com/matrix-org/matrix-react-sdk/pull/3066)
 * Don't show "can't redact" dialog on network error, with redaction having
   local echo & queuing now.
   [\#3058](https://github.com/matrix-org/matrix-react-sdk/pull/3058)
 * Fix login page breaking on wrong password
   [\#3062](https://github.com/matrix-org/matrix-react-sdk/pull/3062)
 * Update from Weblate
   [\#3064](https://github.com/matrix-org/matrix-react-sdk/pull/3064)
 * Install latest JS SDK when linting
   [\#3063](https://github.com/matrix-org/matrix-react-sdk/pull/3063)
 * Ensure we always show read receipts even with hidden events
   [\#3056](https://github.com/matrix-org/matrix-react-sdk/pull/3056)
 * Advance read receipts into trailing events without tiles
   [\#3059](https://github.com/matrix-org/matrix-react-sdk/pull/3059)
 * Remove unused errorText prop
   [\#3061](https://github.com/matrix-org/matrix-react-sdk/pull/3061)
 * Remove SettingsStore reference in RoomSettingsDialog
   [\#3060](https://github.com/matrix-org/matrix-react-sdk/pull/3060)
 * Custom notification sounds for rooms
   [\#2928](https://github.com/matrix-org/matrix-react-sdk/pull/2928)
 * Fix comments in unread room tracking
   [\#3054](https://github.com/matrix-org/matrix-react-sdk/pull/3054)
 * Allow source tile handler for replacements
   [\#3057](https://github.com/matrix-org/matrix-react-sdk/pull/3057)
 * Fix linting in MessagePanel
   [\#3055](https://github.com/matrix-org/matrix-react-sdk/pull/3055)
 * Convert breadcrumbs from labs to real setting
   [\#3053](https://github.com/matrix-org/matrix-react-sdk/pull/3053)
 * Add local echo on badges in breadcrumbs
   [\#3052](https://github.com/matrix-org/matrix-react-sdk/pull/3052)
 * Counteract smooth scrolling on breadcrumbs
   [\#3051](https://github.com/matrix-org/matrix-react-sdk/pull/3051)
 * add sbix fallback twemoji font (and bump to emoji 12)
   [\#3050](https://github.com/matrix-org/matrix-react-sdk/pull/3050)
 * Add option to change the default country code
   [\#3049](https://github.com/matrix-org/matrix-react-sdk/pull/3049)
 * Accept JSX into the GenericErrorPage and expose local session vars
   [\#3043](https://github.com/matrix-org/matrix-react-sdk/pull/3043)
 * Don't try and low encryption info when signing out in low bandwidth mode
   [\#3048](https://github.com/matrix-org/matrix-react-sdk/pull/3048)
 * only capture enter if something was selected in completions
   [\#3047](https://github.com/matrix-org/matrix-react-sdk/pull/3047)
 * Fix: better HTML > MD conversion for editing, including lists and quotes
   [\#3040](https://github.com/matrix-org/matrix-react-sdk/pull/3040)
 * Native emoji require extra line-height
   [\#3044](https://github.com/matrix-org/matrix-react-sdk/pull/3044)
 * port over low_bandwidth mode to develop
   [\#2598](https://github.com/matrix-org/matrix-react-sdk/pull/2598)
 * Fix: maintain caret at current line when position is on newline part
   [\#3029](https://github.com/matrix-org/matrix-react-sdk/pull/3029)
 * Remove username on HS input label
   [\#3042](https://github.com/matrix-org/matrix-react-sdk/pull/3042)
 * Exclude chrome in ua from safari version check for colr support
   [\#3038](https://github.com/matrix-org/matrix-react-sdk/pull/3038)
 * fix COLR font check being racy
   [\#3034](https://github.com/matrix-org/matrix-react-sdk/pull/3034)
 * Override font for usercontent download link
   [\#3035](https://github.com/matrix-org/matrix-react-sdk/pull/3035)
 * Revert "Make the timeline less noisy for screen readers (mk II) #3019"
   [\#3033](https://github.com/matrix-org/matrix-react-sdk/pull/3033)
 * Hide autocomplete on Enter key press instead of sending message
   [\#2968](https://github.com/matrix-org/matrix-react-sdk/pull/2968)
 * Message editing: arrow key (up/down) navigation between editable events
   [\#3025](https://github.com/matrix-org/matrix-react-sdk/pull/3025)
 * Message editing: fix reply text appearing in edit
   [\#3032](https://github.com/matrix-org/matrix-react-sdk/pull/3032)
 * Do not try to request thumbnails with non-integer widths
   [\#3031](https://github.com/matrix-org/matrix-react-sdk/pull/3031)
 * Message editing: preserve strikethrough as well
   [\#3030](https://github.com/matrix-org/matrix-react-sdk/pull/3030)
 * Add some logging for COLR checks
   [\#3027](https://github.com/matrix-org/matrix-react-sdk/pull/3027)
 * Fixup for tab completion: take part length into account as well
   [\#3026](https://github.com/matrix-org/matrix-react-sdk/pull/3026)
 * Message editing: tab completion
   [\#3024](https://github.com/matrix-org/matrix-react-sdk/pull/3024)
 * Message editing: dont jump to next part when inserting at *start* of
   uneditable part
   [\#3021](https://github.com/matrix-org/matrix-react-sdk/pull/3021)
 * Message editing: preserve and re-apply formatting
   [\#3013](https://github.com/matrix-org/matrix-react-sdk/pull/3013)
 * Fix relationship between guests, .well-known, and auth
   [\#3001](https://github.com/matrix-org/matrix-react-sdk/pull/3001)
 * Restore use of full mxid login
   [\#2972](https://github.com/matrix-org/matrix-react-sdk/pull/2972)
 * Only expose the fallback_hs_url if the homeserver is the default homeserver
   [\#2971](https://github.com/matrix-org/matrix-react-sdk/pull/2971)
 * Refactor "Next" button into ServerConfig components
   [\#2964](https://github.com/matrix-org/matrix-react-sdk/pull/2964)
 * Render underlines and tooltips on custom server names in auth pages
   [\#2965](https://github.com/matrix-org/matrix-react-sdk/pull/2965)
 * Use validated server config for login, registration, and password reset
   [\#2941](https://github.com/matrix-org/matrix-react-sdk/pull/2941)

Changes in [1.2.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.2.1) (2019-05-31)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.2.0...v1.2.1)

 * Upgrade to JS SDK 2.0.0 which fixes an error during key backup
 * Native emoji require extra line-height for release
   [\#3045](https://github.com/matrix-org/matrix-react-sdk/pull/3045)

Changes in [1.2.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.2.0) (2019-05-29)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.2.0-rc.1...v1.2.0)

 * COLR font check fixes for release
   [\#3041](https://github.com/matrix-org/matrix-react-sdk/pull/3041)
 * Revert "Make the timeline less noisy for screen readers (mk II) #3019" for
   release
   [\#3036](https://github.com/matrix-org/matrix-react-sdk/pull/3036)
 * Override font for usercontent download link for release
   [\#3037](https://github.com/matrix-org/matrix-react-sdk/pull/3037)

Changes in [1.2.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.2.0-rc.1) (2019-05-23)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.1.2...v1.2.0-rc.1)

 * Update from Weblate
   [\#3023](https://github.com/matrix-org/matrix-react-sdk/pull/3023)
 * Use the correct line-height for bold emoji
   [\#3022](https://github.com/matrix-org/matrix-react-sdk/pull/3022)
 * Make the timeline less noisy for screen readers (mk II)
   [\#3019](https://github.com/matrix-org/matrix-react-sdk/pull/3019)
 * Label message edit field as such for screen readers
   [\#3020](https://github.com/matrix-org/matrix-react-sdk/pull/3020)
 * Move checkmark to the front of key backup message
   [\#3014](https://github.com/matrix-org/matrix-react-sdk/pull/3014)
 * Revert "Make the timeline less noisy for screen readers"
   [\#3017](https://github.com/matrix-org/matrix-react-sdk/pull/3017)
 * Translate scroll movement if the deltaX is the same as the threshold
   [\#3016](https://github.com/matrix-org/matrix-react-sdk/pull/3016)
 * Make the timeline less noisy for screen readers
   [\#3007](https://github.com/matrix-org/matrix-react-sdk/pull/3007)
 * Windows emoji tweaks
   [\#3015](https://github.com/matrix-org/matrix-react-sdk/pull/3015)
 * Message editing: update link previews after editing
   [\#3004](https://github.com/matrix-org/matrix-react-sdk/pull/3004)
 * js-sdk interactive auth now sends email token
   [\#3010](https://github.com/matrix-org/matrix-react-sdk/pull/3010)
 * remove SBIX font and fallback to native emoji
   [\#3011](https://github.com/matrix-org/matrix-react-sdk/pull/3011)
 * Update from Weblate
   [\#3012](https://github.com/matrix-org/matrix-react-sdk/pull/3012)
 * load twemoji dynamically as colr or sbix; fix monospace
   [\#3008](https://github.com/matrix-org/matrix-react-sdk/pull/3008)
 * Guard against null rooms in `onEventDecrypted`
   [\#3009](https://github.com/matrix-org/matrix-react-sdk/pull/3009)
 * Only show reactions in main message timeline
   [\#3005](https://github.com/matrix-org/matrix-react-sdk/pull/3005)
 * Add voice labels for quick add room buttons
   [\#3006](https://github.com/matrix-org/matrix-react-sdk/pull/3006)
 * Update TopLeftMenu for accessibility: Keyboard shortcut, reduced screen
   reader noise
   [\#2994](https://github.com/matrix-org/matrix-react-sdk/pull/2994)
 * Remove reacted with text when shortcode missing
   [\#3003](https://github.com/matrix-org/matrix-react-sdk/pull/3003)
 * Fixup: also change editor margin when last event and buttons are not
   overlaying
   [\#3002](https://github.com/matrix-org/matrix-react-sdk/pull/3002)
 * Message editing: render avatars for pills in the editor
   [\#2997](https://github.com/matrix-org/matrix-react-sdk/pull/2997)
 * Replace emojione with twemoji + emojibase
   [\#2995](https://github.com/matrix-org/matrix-react-sdk/pull/2995)
 * Hide WhoIsTyping component if the MessagePanel is shaped e.g file grid
   [\#3000](https://github.com/matrix-org/matrix-react-sdk/pull/3000)
 * Close copy tooltip in edge cases correctly
   [\#2999](https://github.com/matrix-org/matrix-react-sdk/pull/2999)
 * Limit reaction sender tooltip to 6 people
   [\#2998](https://github.com/matrix-org/matrix-react-sdk/pull/2998)
 * Message editing: apply design
   [\#2996](https://github.com/matrix-org/matrix-react-sdk/pull/2996)
 * Add debug feature to show hidden events in timeline
   [\#2993](https://github.com/matrix-org/matrix-react-sdk/pull/2993)
 * Mute screen readers over reactions
   [\#2986](https://github.com/matrix-org/matrix-react-sdk/pull/2986)
 * Fix not being able to edit already edited messages
   [\#2992](https://github.com/matrix-org/matrix-react-sdk/pull/2992)
 * Add a basic tooltip showing who reacted
   [\#2991](https://github.com/matrix-org/matrix-react-sdk/pull/2991)
 * Message editing: show (edited) marker on edited messages, with tooltip
   [\#2990](https://github.com/matrix-org/matrix-react-sdk/pull/2990)
 * Update from Weblate
   [\#2989](https://github.com/matrix-org/matrix-react-sdk/pull/2989)
 * Message editing: only allow editing of text messages
   [\#2988](https://github.com/matrix-org/matrix-react-sdk/pull/2988)
 * Message editing: shift+enter for newline, enter to send
   [\#2987](https://github.com/matrix-org/matrix-react-sdk/pull/2987)
 * Apply Flex voodoo for devtools send event dialog
   [\#2985](https://github.com/matrix-org/matrix-react-sdk/pull/2985)
 * Fix some source strings noticed as incorrect by translators
   [\#2984](https://github.com/matrix-org/matrix-react-sdk/pull/2984)
 * Message editing: fix some bugs in cursor behaviour
   [\#2983](https://github.com/matrix-org/matrix-react-sdk/pull/2983)
 * Message editing: local echo & back-pagination
   [\#2982](https://github.com/matrix-org/matrix-react-sdk/pull/2982)
 * Listen for removed relations
   [\#2981](https://github.com/matrix-org/matrix-react-sdk/pull/2981)
 * Update from Weblate
   [\#2980](https://github.com/matrix-org/matrix-react-sdk/pull/2980)
 * Use `getRelation` helper
   [\#2977](https://github.com/matrix-org/matrix-react-sdk/pull/2977)
 * Add tooltips to rotate and close buttons in ImageView (#9686)
   [\#2979](https://github.com/matrix-org/matrix-react-sdk/pull/2979)
 * Message editing: smaller fixes
   [\#2978](https://github.com/matrix-org/matrix-react-sdk/pull/2978)
 * Message editing: adjust to js-sdk changes of marking original event as
   replaced
   [\#2973](https://github.com/matrix-org/matrix-react-sdk/pull/2973)
 * Fix Single Sign-on
   [\#2974](https://github.com/matrix-org/matrix-react-sdk/pull/2974)
 * Initial support for editing messages
   [\#2952](https://github.com/matrix-org/matrix-react-sdk/pull/2952)
 * Check permission to invite before showing invite buttons/disable them
   [\#2957](https://github.com/matrix-org/matrix-react-sdk/pull/2957)
 * Support a backup room ID in PermalinkCreator
   [\#2963](https://github.com/matrix-org/matrix-react-sdk/pull/2963)
 * Always thumbnail for GIFs
   [\#2962](https://github.com/matrix-org/matrix-react-sdk/pull/2962)
 * Fix registration with email
   [\#2967](https://github.com/matrix-org/matrix-react-sdk/pull/2967)
 * Add configuration flag to disable minimum password requirements
   [\#2947](https://github.com/matrix-org/matrix-react-sdk/pull/2947)
 * Send and undo reaction events
   [\#2954](https://github.com/matrix-org/matrix-react-sdk/pull/2954)
 * Fix bug where email was not required where it shouldn't have been
   [\#2961](https://github.com/matrix-org/matrix-react-sdk/pull/2961)
 * add /rainbow and /rainbowme Slash Commands
   [\#2958](https://github.com/matrix-org/matrix-react-sdk/pull/2958)
 * Fix invite via MemberInfo
   [\#2956](https://github.com/matrix-org/matrix-react-sdk/pull/2956)
 * Close Room Settings upon Leave Room
   [\#2955](https://github.com/matrix-org/matrix-react-sdk/pull/2955)
 * Command to change avatar for a single room, including upload of mxc res
   [\#2953](https://github.com/matrix-org/matrix-react-sdk/pull/2953)
 * Add View Servers in Room to Devtools
   [\#2804](https://github.com/matrix-org/matrix-react-sdk/pull/2804)
 * Update 'Rooms' import RoomView.js file
   [\#2951](https://github.com/matrix-org/matrix-react-sdk/pull/2951)
 * Extract `ReactionDimension` out of `MessageActionBar`
   [\#2950](https://github.com/matrix-org/matrix-react-sdk/pull/2950)
 * Always default to the registration form
   [\#2942](https://github.com/matrix-org/matrix-react-sdk/pull/2942)
 * Check for `room` in all `Room.timeline*` handlers
   [\#2945](https://github.com/matrix-org/matrix-react-sdk/pull/2945)
 * Remove the karma junit reporter
   [\#2944](https://github.com/matrix-org/matrix-react-sdk/pull/2944)
 * yarn upgrade
   [\#2943](https://github.com/matrix-org/matrix-react-sdk/pull/2943)
 * Support changing options for .m.rule.tombstone push rule
   [\#2798](https://github.com/matrix-org/matrix-react-sdk/pull/2798)
 * Remove timeline explosion rageshake prompt
   [\#2939](https://github.com/matrix-org/matrix-react-sdk/pull/2939)
 * Add existing reactions below message
   [\#2940](https://github.com/matrix-org/matrix-react-sdk/pull/2940)
 * Fix lint errors in TimelinePanel
   [\#2938](https://github.com/matrix-org/matrix-react-sdk/pull/2938)
 * Add primary reactions to action bar
   [\#2937](https://github.com/matrix-org/matrix-react-sdk/pull/2937)

Changes in [1.1.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.1.2) (2019-05-15)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.1.1...v1.1.2)

 * Always thumbnail for GIFs
   [\#2976](https://github.com/matrix-org/matrix-react-sdk/pull/2976)
 * Fix Single Sign-on
   [\#2975](https://github.com/matrix-org/matrix-react-sdk/pull/2975)

Changes in [1.1.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.1.1) (2019-05-14)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.1.0...v1.1.1)

 * Fix registration with email
   [\#2970](https://github.com/matrix-org/matrix-react-sdk/pull/2970)
 * Fix bug where email was not required where it shouldn't have been
   [\#2969](https://github.com/matrix-org/matrix-react-sdk/pull/2969)

Changes in [1.1.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.1.0) (2019-05-07)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.1.0-rc.1...v1.1.0)

 * Relax password requirements to score of 3 out of 4
   [\#2949](https://github.com/matrix-org/matrix-react-sdk/pull/2949)
 * Restore access to message quote option on first click
   [\#2948](https://github.com/matrix-org/matrix-react-sdk/pull/2948)
 * Check for `room` in all `Room.timeline*` handlers
   [\#2946](https://github.com/matrix-org/matrix-react-sdk/pull/2946)

Changes in [1.1.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.1.0-rc.1) (2019-04-30)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.7...v1.1.0-rc.1)

 * Add important info to new preview bar
   [\#2936](https://github.com/matrix-org/matrix-react-sdk/pull/2936)
 * Add a message action bar
   [\#2935](https://github.com/matrix-org/matrix-react-sdk/pull/2935)
 * Trigger riot-web build
   [\#2934](https://github.com/matrix-org/matrix-react-sdk/pull/2934)
 * Input validation tooltips for registration
   [\#2933](https://github.com/matrix-org/matrix-react-sdk/pull/2933)
 * Also say "Connect ..." on remaining key backup buttons
   [\#2931](https://github.com/matrix-org/matrix-react-sdk/pull/2931)
 * Mark a few CSS classes as not selectable
   [\#2929](https://github.com/matrix-org/matrix-react-sdk/pull/2929)
 * Cleanup message composer render() method
   [\#2883](https://github.com/matrix-org/matrix-react-sdk/pull/2883)
 * Redesigned room preview bar
   [\#2925](https://github.com/matrix-org/matrix-react-sdk/pull/2925)
 * Prevent user pills containing only emoji from embiggening
   [\#2907](https://github.com/matrix-org/matrix-react-sdk/pull/2907)
 * Make alt-enter insert new line on macOS
   [\#2923](https://github.com/matrix-org/matrix-react-sdk/pull/2923)
 * Test `defaultServerName` before showing it on forgot password
   [\#2924](https://github.com/matrix-org/matrix-react-sdk/pull/2924)
 * Add a function to append/overwrite objects in the config on the fly
   [\#2922](https://github.com/matrix-org/matrix-react-sdk/pull/2922)
 * use SdkConfig brand name instead of static "Riot"
   [\#2921](https://github.com/matrix-org/matrix-react-sdk/pull/2921)
 * Use dedicated permalink creators in search results with multiple rooms
   [\#2898](https://github.com/matrix-org/matrix-react-sdk/pull/2898)
 * Clarify that use backup means restore
   [\#2917](https://github.com/matrix-org/matrix-react-sdk/pull/2917)
 * Fix key backup status when missing device
   [\#2919](https://github.com/matrix-org/matrix-react-sdk/pull/2919)
 * Ensure `<b>` tags appear bold for all browsers
   [\#2918](https://github.com/matrix-org/matrix-react-sdk/pull/2918)
 * Add a link in room settings to get at the tombstoned room if it exists
   [\#2908](https://github.com/matrix-org/matrix-react-sdk/pull/2908)
 * Add a generic error page element for startup errors
   [\#2915](https://github.com/matrix-org/matrix-react-sdk/pull/2915)
 * Add strings for js-sdk autodiscovery errors
   [\#2916](https://github.com/matrix-org/matrix-react-sdk/pull/2916)
 * Focus the composer view on file upload
   [\#2914](https://github.com/matrix-org/matrix-react-sdk/pull/2914)
 * use medium agent for e2e tests
   [\#2911](https://github.com/matrix-org/matrix-react-sdk/pull/2911)
 * adjust prop in HeaderButton
   [\#2912](https://github.com/matrix-org/matrix-react-sdk/pull/2912)
 * Remove breadcrumb scroll tolerances and use sensible defaults
   [\#2913](https://github.com/matrix-org/matrix-react-sdk/pull/2913)
 * Fix having to click the member list button twice to show it after having
   changed room.
   [\#2906](https://github.com/matrix-org/matrix-react-sdk/pull/2906)
 * Add period to the end of upgrade notice
   [\#2909](https://github.com/matrix-org/matrix-react-sdk/pull/2909)
 * Remove duplicate space in credits
   [\#2889](https://github.com/matrix-org/matrix-react-sdk/pull/2889)
 * Handle M_UNSUPPORTED_ROOM_VERSION in invites and room creation
   [\#2905](https://github.com/matrix-org/matrix-react-sdk/pull/2905)
 * Re-enable E2E tests
   [\#2867](https://github.com/matrix-org/matrix-react-sdk/pull/2867)
 * Remove BottomLeftMenu and supporting bits
   [\#2903](https://github.com/matrix-org/matrix-react-sdk/pull/2903)
 * Fix for retina thumbnails being massive
   [\#2439](https://github.com/matrix-org/matrix-react-sdk/pull/2439)
 * Send breadcrumb updates only when they change
   [\#2894](https://github.com/matrix-org/matrix-react-sdk/pull/2894)
 * Add some tolerances to breadcrumb scrolling
   [\#2892](https://github.com/matrix-org/matrix-react-sdk/pull/2892)
 * Fix validation to avoid `undefined` class on fields
   [\#2902](https://github.com/matrix-org/matrix-react-sdk/pull/2902)
 * Always return a client from onRegistered
   [\#2895](https://github.com/matrix-org/matrix-react-sdk/pull/2895)
 * Fix room upgrade warnings popping up in upgraded rooms
   [\#2897](https://github.com/matrix-org/matrix-react-sdk/pull/2897)
 * Fix style lint errors & enable on CI
   [\#2901](https://github.com/matrix-org/matrix-react-sdk/pull/2901)
 * Add stylelint
   [\#2900](https://github.com/matrix-org/matrix-react-sdk/pull/2900)
 * Key backup: Handle case where your onw sig is invalid
   [\#2899](https://github.com/matrix-org/matrix-react-sdk/pull/2899)
 * Simplify settings dialog CSS
   [\#2891](https://github.com/matrix-org/matrix-react-sdk/pull/2891)
 * Fix upload cancel in e2e rooms
   [\#2893](https://github.com/matrix-org/matrix-react-sdk/pull/2893)
 * Set E2E room status to warning when crypto is disabled
   [\#2890](https://github.com/matrix-org/matrix-react-sdk/pull/2890)
 * Move SettingsDialog width override to fixedWidth
   [\#2888](https://github.com/matrix-org/matrix-react-sdk/pull/2888)
 * Prevent the permalink creator from causing cascading failure
   [\#2882](https://github.com/matrix-org/matrix-react-sdk/pull/2882)
 * Don't include all networks by default in the room directory
   [\#2881](https://github.com/matrix-org/matrix-react-sdk/pull/2881)
 * Fix fixed width dialogs
   [\#2886](https://github.com/matrix-org/matrix-react-sdk/pull/2886)
 * Fix settings dialog layout
   [\#2885](https://github.com/matrix-org/matrix-react-sdk/pull/2885)
 * Update from Weblate
   [\#2884](https://github.com/matrix-org/matrix-react-sdk/pull/2884)
 * Design tweaks to dialogs
   [\#2868](https://github.com/matrix-org/matrix-react-sdk/pull/2868)
 * Remove 'try the app' link from login
   [\#2880](https://github.com/matrix-org/matrix-react-sdk/pull/2880)
 * Track store failures after startup
   [\#2870](https://github.com/matrix-org/matrix-react-sdk/pull/2870)
 * Translate vertical scrolling to horizontal movement in breadcrumbs
   [\#2877](https://github.com/matrix-org/matrix-react-sdk/pull/2877)
 * Add telemetry for breadcrumbs and have the setting apply without refresh
   [\#2873](https://github.com/matrix-org/matrix-react-sdk/pull/2873)
 * Fix a few bugs introduced in file upload rework
   [\#2879](https://github.com/matrix-org/matrix-react-sdk/pull/2879)
 * Sync breadcrumb rooms through account data
   [\#2875](https://github.com/matrix-org/matrix-react-sdk/pull/2875)
 * Scroll breadcrumbs to the left when they change
   [\#2878](https://github.com/matrix-org/matrix-react-sdk/pull/2878)
 * Add an indicator to show a room is a direct chat in breadcrumbs
   [\#2874](https://github.com/matrix-org/matrix-react-sdk/pull/2874)
 * Use the most recent version of the room in breadcrumbs
   [\#2872](https://github.com/matrix-org/matrix-react-sdk/pull/2872)
 * Autohide the scrollbar on breadcrumbs
   [\#2876](https://github.com/matrix-org/matrix-react-sdk/pull/2876)
 * Ensure the page URL is redacted before tracking analytics events
   [\#2871](https://github.com/matrix-org/matrix-react-sdk/pull/2871)
 * fix NPE for rooms with redacted tombstones
   [\#2869](https://github.com/matrix-org/matrix-react-sdk/pull/2869)
 * Don't re-init the stickerpicker unless something actually changes
   [\#2862](https://github.com/matrix-org/matrix-react-sdk/pull/2862)
 * Add option to rotate images
   [\#2855](https://github.com/matrix-org/matrix-react-sdk/pull/2855)
 * Add badges to breadcrumb rooms
   [\#2861](https://github.com/matrix-org/matrix-react-sdk/pull/2861)
 * Include the current power level in the selector
   [\#2866](https://github.com/matrix-org/matrix-react-sdk/pull/2866)
 * Apply 50% opacity to left breadcrumbs
   [\#2860](https://github.com/matrix-org/matrix-react-sdk/pull/2860)
 * Small scroll fixes
   [\#2865](https://github.com/matrix-org/matrix-react-sdk/pull/2865)
 * Put the stickerpicker below dialogs
   [\#2863](https://github.com/matrix-org/matrix-react-sdk/pull/2863)
 * Logging tweaks
   [\#2864](https://github.com/matrix-org/matrix-react-sdk/pull/2864)
 * Implement redesigned upload confirmation screens
   [\#2858](https://github.com/matrix-org/matrix-react-sdk/pull/2858)
 * Use Field component in bug report dialog
   [\#2859](https://github.com/matrix-org/matrix-react-sdk/pull/2859)
 * Notify user when crypto data is missing
   [\#2841](https://github.com/matrix-org/matrix-react-sdk/pull/2841)
 * Update from Weblate
   [\#2857](https://github.com/matrix-org/matrix-react-sdk/pull/2857)
 * Download PDFs as blobs to avoid empty grey screens
   [\#2847](https://github.com/matrix-org/matrix-react-sdk/pull/2847)
 * Set title attribute on images in lightbox
   [\#2848](https://github.com/matrix-org/matrix-react-sdk/pull/2848)
 * Add MemberInfo for 3pid invites and support revoking those invites
   [\#2843](https://github.com/matrix-org/matrix-react-sdk/pull/2843)
 * round scrollTop upwards to prevent never detecting bottom
   [\#2846](https://github.com/matrix-org/matrix-react-sdk/pull/2846)
 * Notifier is how singleton is known outside of this module
   [\#2845](https://github.com/matrix-org/matrix-react-sdk/pull/2845)
 * Delay `Notifier` check until we have push rules
   [\#2844](https://github.com/matrix-org/matrix-react-sdk/pull/2844)
 * BACAT Scrolling
   [\#2842](https://github.com/matrix-org/matrix-react-sdk/pull/2842)
 * Handle storage fallback cases in consistency check
   [\#2840](https://github.com/matrix-org/matrix-react-sdk/pull/2840)
 * Handle all the segments of a v3 event ID
   [\#2827](https://github.com/matrix-org/matrix-react-sdk/pull/2827)
 * Add custom tooltips and scrolling to breadcrumbs
   [\#2839](https://github.com/matrix-org/matrix-react-sdk/pull/2839)
 * Check if the message panel is at the end of the timeline on init
   [\#2829](https://github.com/matrix-org/matrix-react-sdk/pull/2829)
 * Persist breadcrumb state between sessions
   [\#2837](https://github.com/matrix-org/matrix-react-sdk/pull/2837)
 * Always append the current room to the breadcrumbs
   [\#2838](https://github.com/matrix-org/matrix-react-sdk/pull/2838)
 * Alert the user to unread notifications in prior versions of rooms
   [\#2831](https://github.com/matrix-org/matrix-react-sdk/pull/2831)
 * Filter out upgraded rooms from autocomplete results
   [\#2830](https://github.com/matrix-org/matrix-react-sdk/pull/2830)

Changes in [1.0.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.7) (2019-04-08)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.6...v1.0.7)

 * Hotfix: bump js-sdk to 1.0.4, see https://github.com/matrix-org/matrix-js-sdk/releases/tag/v1.0.4

Changes in [1.0.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.6) (2019-04-01)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.6-rc.1...v1.0.6)

 * Handle storage fallback cases in consistency check
   [\#2853](https://github.com/matrix-org/matrix-react-sdk/pull/2853)
 * Set title attribute on images in lightbox
   [\#2852](https://github.com/matrix-org/matrix-react-sdk/pull/2852)
 * Download PDFs as blobs to avoid empty grey screens
   [\#2851](https://github.com/matrix-org/matrix-react-sdk/pull/2851)
 * Add MemberInfo for 3pid invites and support revoking those invites
   [\#2850](https://github.com/matrix-org/matrix-react-sdk/pull/2850)

Changes in [1.0.6-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.6-rc.1) (2019-03-27)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.5...v1.0.6-rc.1)

 * Catch errors when checking IndexedDB
   [\#2836](https://github.com/matrix-org/matrix-react-sdk/pull/2836)
 * Remove noreferrer on widget pop-out
   [\#2835](https://github.com/matrix-org/matrix-react-sdk/pull/2835)
 * Rework room directory so that new room is always available
   [\#2834](https://github.com/matrix-org/matrix-react-sdk/pull/2834)
 * Send telemetry about storage consistency
   [\#2832](https://github.com/matrix-org/matrix-react-sdk/pull/2832)
 * Widget OpenID reauth implementation
   [\#2781](https://github.com/matrix-org/matrix-react-sdk/pull/2781)
 * Log results of basic storage consistency check
   [\#2826](https://github.com/matrix-org/matrix-react-sdk/pull/2826)
 * Clarify devices affected by notification settings
   [\#2828](https://github.com/matrix-org/matrix-react-sdk/pull/2828)
 * Add a command for creating custom widgets without an integration manager
   [\#2824](https://github.com/matrix-org/matrix-react-sdk/pull/2824)
 * Minimize stickerpicker when the title is clicked
   [\#2822](https://github.com/matrix-org/matrix-react-sdk/pull/2822)
 * Add <code> blocks around homeserver and identity server urls
   [\#2825](https://github.com/matrix-org/matrix-react-sdk/pull/2825)
 * Fixed drop shadow for tooltip.
   [\#2815](https://github.com/matrix-org/matrix-react-sdk/pull/2815)
 * Ask the user for debug logs when the timeline explodes
   [\#2820](https://github.com/matrix-org/matrix-react-sdk/pull/2820)
 * Fix typo preventing users from adding more widgets easily
   [\#2823](https://github.com/matrix-org/matrix-react-sdk/pull/2823)
 * Attach an onChange listener to the room's blacklist devices option
   [\#2817](https://github.com/matrix-org/matrix-react-sdk/pull/2817)
 * Use leaveRoomChain when leaving a room
   [\#2818](https://github.com/matrix-org/matrix-react-sdk/pull/2818)
 * Fix bug with NetworkList dropdown
   [\#2821](https://github.com/matrix-org/matrix-react-sdk/pull/2821)
 * Trim the logging for URL previews
   [\#2816](https://github.com/matrix-org/matrix-react-sdk/pull/2816)
 * Explicitly create `cryptoStore` in React SDK
   [\#2814](https://github.com/matrix-org/matrix-react-sdk/pull/2814)
 * Change to new consistent name for `MemoryStore`
   [\#2812](https://github.com/matrix-org/matrix-react-sdk/pull/2812)
 * Use medium agents for the more resource intensive builds
   [\#2813](https://github.com/matrix-org/matrix-react-sdk/pull/2813)
 * Add log grouping to buildkite
   [\#2810](https://github.com/matrix-org/matrix-react-sdk/pull/2810)
 * Switch to `git` protocol for CI dependencies
   [\#2809](https://github.com/matrix-org/matrix-react-sdk/pull/2809)
 * Go back to using mainine velocity
   [\#2808](https://github.com/matrix-org/matrix-react-sdk/pull/2808)
 * Warn that members won't be autojoined to upgraded rooms
   [\#2796](https://github.com/matrix-org/matrix-react-sdk/pull/2796)
 * Support CI for matching branches on forks
   [\#2807](https://github.com/matrix-org/matrix-react-sdk/pull/2807)
 * Discard old sticker picker when the URL changes
   [\#2801](https://github.com/matrix-org/matrix-react-sdk/pull/2801)
 * Reload widget messaging when widgets reload
   [\#2799](https://github.com/matrix-org/matrix-react-sdk/pull/2799)
 * Don't show calculated room name in room settings name input field
   [\#2806](https://github.com/matrix-org/matrix-react-sdk/pull/2806)
 * Disable big emoji for m.emote messages as it looks weird
   [\#2805](https://github.com/matrix-org/matrix-react-sdk/pull/2805)
 * Remove Edge from browser support statements
   [\#2803](https://github.com/matrix-org/matrix-react-sdk/pull/2803)
 * Update from Weblate
   [\#2802](https://github.com/matrix-org/matrix-react-sdk/pull/2802)
 * Really fix tag panel
   [\#2800](https://github.com/matrix-org/matrix-react-sdk/pull/2800)
 * Update CompatibilityPage to match officially supported browsers
   [\#2793](https://github.com/matrix-org/matrix-react-sdk/pull/2793)
 * Use Buildkite for CI
   [\#2788](https://github.com/matrix-org/matrix-react-sdk/pull/2788)
 * Fix CSS syntax errors preventing offline member opacity from working
   [\#2794](https://github.com/matrix-org/matrix-react-sdk/pull/2794)
 * Make the EntityTile chevron a masked SVG for theming
   [\#2795](https://github.com/matrix-org/matrix-react-sdk/pull/2795)
 * Remove refs from `RegistrationForm`
   [\#2791](https://github.com/matrix-org/matrix-react-sdk/pull/2791)
 * Fix initial letter avatar vertical offset in Firefox
   [\#2792](https://github.com/matrix-org/matrix-react-sdk/pull/2792)
 * Fix the custom tag panel
   [\#2797](https://github.com/matrix-org/matrix-react-sdk/pull/2797)
 * Ensure freshly invited members don't count towards the alone warning
   [\#2786](https://github.com/matrix-org/matrix-react-sdk/pull/2786)
 * Fix 'forgot password' warning to represent the reality of e2ee
   [\#2787](https://github.com/matrix-org/matrix-react-sdk/pull/2787)
 * Restore `Field` value getter for `RegistrationForm`
   [\#2790](https://github.com/matrix-org/matrix-react-sdk/pull/2790)
 * Initial portions of support for Field validation
   [\#2780](https://github.com/matrix-org/matrix-react-sdk/pull/2780)

Changes in [1.0.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.5) (2019-03-21)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.4...v1.0.5)

 * Hotfix: disable typing notifs jumping prevention for now
   [\#2811](https://github.com/matrix-org/matrix-react-sdk/pull/2811)

Changes in [1.0.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.4) (2019-03-18)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.4-rc.1...v1.0.4)

 * No changes since rc.1

Changes in [1.0.4-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.4-rc.1) (2019-03-13)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.3...v1.0.4-rc.1)

 * Update from Weblate
   [\#2785](https://github.com/matrix-org/matrix-react-sdk/pull/2785)
 * Remove padlock click handler to show unknown devices
   [\#2784](https://github.com/matrix-org/matrix-react-sdk/pull/2784)
 * Use modern Yarn version on Travis CI
   [\#2783](https://github.com/matrix-org/matrix-react-sdk/pull/2783)
 * Add versioning to integration manager API /register and /account calls
   [\#2782](https://github.com/matrix-org/matrix-react-sdk/pull/2782)
 * Ensure scalar_token is valid before opening integrations manager
   [\#2777](https://github.com/matrix-org/matrix-react-sdk/pull/2777)
 * Switch to `yarn` for dependency management
   [\#2773](https://github.com/matrix-org/matrix-react-sdk/pull/2773)
 * Use a distinct color for selected autocomplete items
   [\#2778](https://github.com/matrix-org/matrix-react-sdk/pull/2778)
 * Provide an escape from the registration process
   [\#2775](https://github.com/matrix-org/matrix-react-sdk/pull/2775)
 * Fix instantly sending RRs
   [\#2770](https://github.com/matrix-org/matrix-react-sdk/pull/2770)
 * Fix simple header counters to correctly handle zero, take two
   [\#2776](https://github.com/matrix-org/matrix-react-sdk/pull/2776)
 * Fix sticky hover state by listening for hover on the document
   [\#2764](https://github.com/matrix-org/matrix-react-sdk/pull/2764)
 * Fix header counters to correctly handle zero
   [\#2772](https://github.com/matrix-org/matrix-react-sdk/pull/2772)
 * Pass correct args when creating event permalink in context menu
   [\#2774](https://github.com/matrix-org/matrix-react-sdk/pull/2774)
 * Update from Weblate
   [\#2771](https://github.com/matrix-org/matrix-react-sdk/pull/2771)
 * Scroll investigation changes
   [\#2766](https://github.com/matrix-org/matrix-react-sdk/pull/2766)
 * Ability to bulk accept all invites (and fix rejecting all invites)
   [\#2757](https://github.com/matrix-org/matrix-react-sdk/pull/2757)
 * Don't trample over existing sessions when verifying email addresses
   [\#2768](https://github.com/matrix-org/matrix-react-sdk/pull/2768)
 * Misc fixes to StatusMessageContextMenu
   [\#2767](https://github.com/matrix-org/matrix-react-sdk/pull/2767)
 * Fix erroneously sending RRs, pt1.
   [\#2769](https://github.com/matrix-org/matrix-react-sdk/pull/2769)
 * Tweak country dropdown for redesign
   [\#2765](https://github.com/matrix-org/matrix-react-sdk/pull/2765)
 * Prevent space characters from stopping big emoji messages
   [\#2745](https://github.com/matrix-org/matrix-react-sdk/pull/2745)
 * Tweak auth components when dark theme is default
   [\#2763](https://github.com/matrix-org/matrix-react-sdk/pull/2763)
 * Move country dropdown inside field in Settings
   [\#2756](https://github.com/matrix-org/matrix-react-sdk/pull/2756)
 * npm audit fix --force
   [\#2758](https://github.com/matrix-org/matrix-react-sdk/pull/2758)
 * Use Field component in auth flows
   [\#2749](https://github.com/matrix-org/matrix-react-sdk/pull/2749)
 * Add /shrug command
   [\#2660](https://github.com/matrix-org/matrix-react-sdk/pull/2660)
 * Support linking to hosting providers
   [\#2748](https://github.com/matrix-org/matrix-react-sdk/pull/2748)
 * Get confirmation before enabling encryption
   [\#2728](https://github.com/matrix-org/matrix-react-sdk/pull/2728)
 * clear min-height for typing notifs when the timeline viewport changes size
   [\#2747](https://github.com/matrix-org/matrix-react-sdk/pull/2747)
 * Prevent flair pushing timeline downwards
   [\#2746](https://github.com/matrix-org/matrix-react-sdk/pull/2746)
 * Include tag name when warning about rooms running off lists
   [\#2741](https://github.com/matrix-org/matrix-react-sdk/pull/2741)
 * Reorganise props handling in Field
   [\#2740](https://github.com/matrix-org/matrix-react-sdk/pull/2740)
 * Limit Field label to size of input
   [\#2742](https://github.com/matrix-org/matrix-react-sdk/pull/2742)
 * Don't loop forever if you demote yourself via Enter on a PowerSelector
   [\#2743](https://github.com/matrix-org/matrix-react-sdk/pull/2743)
 * Check if users are already in the room before inviting them
   [\#2734](https://github.com/matrix-org/matrix-react-sdk/pull/2734)
 * Don't duplicate direct chats from other tags
   [\#2735](https://github.com/matrix-org/matrix-react-sdk/pull/2735)
 * Fix media device selectors not updating
   [\#2739](https://github.com/matrix-org/matrix-react-sdk/pull/2739)
 * Fix Room Directory custom homeserver entry not showing properly
   [\#2708](https://github.com/matrix-org/matrix-react-sdk/pull/2708)
 * Add missing permalinkCreator prop
   [\#2729](https://github.com/matrix-org/matrix-react-sdk/pull/2729)
 * Patch users not existing when opening settings
   [\#2738](https://github.com/matrix-org/matrix-react-sdk/pull/2738)
 * Use a mask for the continuation icon
   [\#2737](https://github.com/matrix-org/matrix-react-sdk/pull/2737)
 * Always insert rooms into lists when they get lost
   [\#2736](https://github.com/matrix-org/matrix-react-sdk/pull/2736)
 * Convert objects and such to usable strings in rageshake
   [\#2732](https://github.com/matrix-org/matrix-react-sdk/pull/2732)
 * Support stacking dialogs to prevent unmounting
   [\#2724](https://github.com/matrix-org/matrix-react-sdk/pull/2724)
 * Convert PowerSelector to use mxField instead
   [\#2725](https://github.com/matrix-org/matrix-react-sdk/pull/2725)
 * Don't re-enable the save button after saving profiles
   [\#2726](https://github.com/matrix-org/matrix-react-sdk/pull/2726)
 * Support multiple email pushers and remove the legacy UserSettingsStore
   [\#2727](https://github.com/matrix-org/matrix-react-sdk/pull/2727)
 * Bring back #528 fix as it still seems broken on OSX
   [\#2731](https://github.com/matrix-org/matrix-react-sdk/pull/2731)
 * Fix margin on e2e icon in member panel
   [\#2721](https://github.com/matrix-org/matrix-react-sdk/pull/2721)
 * Improved scrolling & pagination
   [\#2676](https://github.com/matrix-org/matrix-react-sdk/pull/2676)
 * Nudge karma to 3.1.2
   [\#2719](https://github.com/matrix-org/matrix-react-sdk/pull/2719)
 * Stop listening to account data when the stickerpicker is unmounted
   [\#2723](https://github.com/matrix-org/matrix-react-sdk/pull/2723)

Changes in [1.0.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.3) (2019-03-06)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.2...v1.0.3)

 * Don't duplicate direct chats from other tags
   [\#2762](https://github.com/matrix-org/matrix-react-sdk/pull/2762)
 * Include tag name when warning about rooms running off lists
   [\#2761](https://github.com/matrix-org/matrix-react-sdk/pull/2761)
 * Always insert rooms into lists when they get lost
   [\#2760](https://github.com/matrix-org/matrix-react-sdk/pull/2760)
 * Fix the ctrl+k shortcut
   [\#2759](https://github.com/matrix-org/matrix-react-sdk/pull/2759)

Changes in [1.0.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.2) (2019-03-06)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.2-rc.4...v1.0.2)

 * Only show hosting link if group admin
   [\#2755](https://github.com/matrix-org/matrix-react-sdk/pull/2755)
 * Only show hosting link if domain == matrix.org
   [\#2754](https://github.com/matrix-org/matrix-react-sdk/pull/2754)

Changes in [1.0.2-rc.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.2-rc.4) (2019-03-05)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.2-rc.3...v1.0.2-rc.4)

 * Patch users not existing when opening settings
   [\#2752](https://github.com/matrix-org/matrix-react-sdk/pull/2752)
 * Fix media device selectors not updating
   [\#2751](https://github.com/matrix-org/matrix-react-sdk/pull/2751)
 * Support linking to hosting providers
   [\#2750](https://github.com/matrix-org/matrix-react-sdk/pull/2750)

Changes in [1.0.2-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.2-rc.3) (2019-03-01)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.2-rc.2...v1.0.2-rc.3)

 * Misc room list improvements & invite fix
   [\#2722](https://github.com/matrix-org/matrix-react-sdk/pull/2722)
 * Move complex part of room sorting to a dedicated function
   [\#2716](https://github.com/matrix-org/matrix-react-sdk/pull/2716)

Changes in [1.0.2-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.2-rc.2) (2019-03-01)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.2-rc.1...v1.0.2-rc.2)

 * Use webpack alias to resolve the languages file
   [\#2730](https://github.com/matrix-org/matrix-react-sdk/pull/2730)

Changes in [1.0.2-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.2-rc.1) (2019-02-28)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.1...v1.0.2-rc.1)

 * Remove unnecessary ref from Stickerpicker
   [\#2718](https://github.com/matrix-org/matrix-react-sdk/pull/2718)
 * Update from Weblate
   [\#2720](https://github.com/matrix-org/matrix-react-sdk/pull/2720)
 * Update from Weblate.
   [\#2715](https://github.com/matrix-org/matrix-react-sdk/pull/2715)
 * Show nearest lower badge, e.g show Mod for 51... etc
   [\#2709](https://github.com/matrix-org/matrix-react-sdk/pull/2709)
 * Send Field label pointer events to input
   [\#2714](https://github.com/matrix-org/matrix-react-sdk/pull/2714)
 * move canSendMessages into state so that it will re-render the composer
   [\#2710](https://github.com/matrix-org/matrix-react-sdk/pull/2710)
 * Use a global WatchManager for settings
   [\#2705](https://github.com/matrix-org/matrix-react-sdk/pull/2705)
 * Move non-feather icons out of feather dir
   [\#2706](https://github.com/matrix-org/matrix-react-sdk/pull/2706)
 * Fix backup button in logout dialog
   [\#2713](https://github.com/matrix-org/matrix-react-sdk/pull/2713)
 * Keep registration spinner inside the auth modal
   [\#2712](https://github.com/matrix-org/matrix-react-sdk/pull/2712)
 * Try to clarify that "Show read receipts" is just for visibility
   [\#2707](https://github.com/matrix-org/matrix-react-sdk/pull/2707)
 * Make sure direct chat invites are treated as invites
   [\#2711](https://github.com/matrix-org/matrix-react-sdk/pull/2711)
 * Report validity state of all registration fields on any change
   [\#2672](https://github.com/matrix-org/matrix-react-sdk/pull/2672)
 * Export the defaults for SdkConfig
   [\#2687](https://github.com/matrix-org/matrix-react-sdk/pull/2687)
 * Change the room list algo to eagerly delete and carefully insert
   [\#2701](https://github.com/matrix-org/matrix-react-sdk/pull/2701)
 * Improve permalink performance
   [\#2671](https://github.com/matrix-org/matrix-react-sdk/pull/2671)
 * Normalise room list font weight, bold unreads
   [\#2702](https://github.com/matrix-org/matrix-react-sdk/pull/2702)
 * Settings button in Room Context Menu
   [\#2692](https://github.com/matrix-org/matrix-react-sdk/pull/2692)
 * add roomnick SlashCommand
   [\#2689](https://github.com/matrix-org/matrix-react-sdk/pull/2689)
 * replace text Inputs in Devtools with Field bcuz prettier
   [\#2697](https://github.com/matrix-org/matrix-react-sdk/pull/2697)
 * Maintenance: Clean up some stuff around settings
   [\#2685](https://github.com/matrix-org/matrix-react-sdk/pull/2685)
 * Support the old room sorting algorithm and SettingsStore watchers
   [\#2686](https://github.com/matrix-org/matrix-react-sdk/pull/2686)
 * pin highlight.js as they seem to have broken something in 9.15.2
   [\#2703](https://github.com/matrix-org/matrix-react-sdk/pull/2703)
 * Fix NPE relating to toggling notifications
   [\#2699](https://github.com/matrix-org/matrix-react-sdk/pull/2699)
 * Only set e2e info callback if the event is encrypted
   [\#2684](https://github.com/matrix-org/matrix-react-sdk/pull/2684)
 * Revert "Add some logging for riot-web#7838"
   [\#2700](https://github.com/matrix-org/matrix-react-sdk/pull/2700)
 * Add abilities to clear Filter room members input
   [\#2698](https://github.com/matrix-org/matrix-react-sdk/pull/2698)
 * make ViewSource less awkward
   [\#2696](https://github.com/matrix-org/matrix-react-sdk/pull/2696)
 * Fix share community for guests
   [\#2695](https://github.com/matrix-org/matrix-react-sdk/pull/2695)
 * Fix z ordering of the overflow tile
   [\#2694](https://github.com/matrix-org/matrix-react-sdk/pull/2694)
 * Toggle Search using Room Header button
   [\#2693](https://github.com/matrix-org/matrix-react-sdk/pull/2693)
 * view user on click typing tile
   [\#2691](https://github.com/matrix-org/matrix-react-sdk/pull/2691)
 * Change Share Message to Share Permalink if !m.room.message||redacted
   [\#2690](https://github.com/matrix-org/matrix-react-sdk/pull/2690)
 * Allow configuration of whether closing window closes or minimizes to tray
   [\#2688](https://github.com/matrix-org/matrix-react-sdk/pull/2688)
 * Remove duplicated conversion from `enableRichText`
   [\#2682](https://github.com/matrix-org/matrix-react-sdk/pull/2682)
 * Use correct initial phase for server type
   [\#2683](https://github.com/matrix-org/matrix-react-sdk/pull/2683)
 * Fix AliasSettings and RelatedGroups UX
   [\#2679](https://github.com/matrix-org/matrix-react-sdk/pull/2679)
 * Add `onClick` to Markdown buttons
   [\#2677](https://github.com/matrix-org/matrix-react-sdk/pull/2677)
 * Fix toggle for email notifications
   [\#2678](https://github.com/matrix-org/matrix-react-sdk/pull/2678)
 * Fix categorization of favourites and new rooms
   [\#2681](https://github.com/matrix-org/matrix-react-sdk/pull/2681)
 * Skip server details on registration with a default HS
   [\#2675](https://github.com/matrix-org/matrix-react-sdk/pull/2675)
 * Clarify what the username error refers to
   [\#2673](https://github.com/matrix-org/matrix-react-sdk/pull/2673)
 * RoomDirectory Dropdown should use roomDirectory.servers
   [\#2680](https://github.com/matrix-org/matrix-react-sdk/pull/2680)
 * Fix favourites losing rooms and sorting weirdly
   [\#2674](https://github.com/matrix-org/matrix-react-sdk/pull/2674)
 * "Breadcrumb" room sorting algorithm
   [\#2634](https://github.com/matrix-org/matrix-react-sdk/pull/2634)
 * Bring back user view
   [\#2666](https://github.com/matrix-org/matrix-react-sdk/pull/2666)
 * Restores support for `default_server_name` which discovers URLs via `.well-
   known`
   [\#2669](https://github.com/matrix-org/matrix-react-sdk/pull/2669)
 * Remove unreferenced images
   [\#2670](https://github.com/matrix-org/matrix-react-sdk/pull/2670)
 * Only show the first line of each commit in changelog dialog
   [\#2667](https://github.com/matrix-org/matrix-react-sdk/pull/2667)
 * Cache-bust languages.json with file-loader
   [\#2658](https://github.com/matrix-org/matrix-react-sdk/pull/2658)
 * Fix off by one error for username colors
   [\#2664](https://github.com/matrix-org/matrix-react-sdk/pull/2664)
 * Set event-sending-color in dark theme
   [\#2665](https://github.com/matrix-org/matrix-react-sdk/pull/2665)
 * Allow captchas on Riot desktop builds
   [\#2663](https://github.com/matrix-org/matrix-react-sdk/pull/2663)
 * Show link to login even during UI auth
   [\#2661](https://github.com/matrix-org/matrix-react-sdk/pull/2661)
 * Dark theme follow ups round 2
   [\#2659](https://github.com/matrix-org/matrix-react-sdk/pull/2659)
 * Rename default theme to light theme
   [\#2662](https://github.com/matrix-org/matrix-react-sdk/pull/2662)
 * make mx_SenderProfile inline-block, reduces clickable area around usernames
   [\#2653](https://github.com/matrix-org/matrix-react-sdk/pull/2653)
 * Add a bit of safety around reading events for room settings
   [\#2648](https://github.com/matrix-org/matrix-react-sdk/pull/2648)
 * Update dark theme bg-color to show hover effect on messages
   [\#2654](https://github.com/matrix-org/matrix-react-sdk/pull/2654)
 * Make pre use the same text color as code
   [\#2655](https://github.com/matrix-org/matrix-react-sdk/pull/2655)
 * Bring back the lowered opacity for offline/unavailable avatars.
   [\#2649](https://github.com/matrix-org/matrix-react-sdk/pull/2649)
 * Set h3-color in dark theme
   [\#2656](https://github.com/matrix-org/matrix-react-sdk/pull/2656)
 * Fix typo "Scisors" -> "Scissors"
   [\#2652](https://github.com/matrix-org/matrix-react-sdk/pull/2652)
 * highlight e2e icon on event when hovering whole event
   [\#2647](https://github.com/matrix-org/matrix-react-sdk/pull/2647)
 * Skinnified more icons
   [\#2633](https://github.com/matrix-org/matrix-react-sdk/pull/2633)

Changes in [1.0.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.1) (2019-02-15)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.0...v1.0.1)

 * Fix community invites crashing the app
   [\#2650](https://github.com/matrix-org/matrix-react-sdk/pull/2650)

Changes in [1.0.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.0) (2019-02-14)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.0-rc.2...v1.0.0)

 * Update from Weblate.
   [\#2646](https://github.com/matrix-org/matrix-react-sdk/pull/2646)
 * Remove 'welcome' from top-left menu
   [\#2641](https://github.com/matrix-org/matrix-react-sdk/pull/2641)
 * Turn on pin unread rooms for everyone
   [\#2645](https://github.com/matrix-org/matrix-react-sdk/pull/2645)
 * Update help buoy text and issue links
   [\#2640](https://github.com/matrix-org/matrix-react-sdk/pull/2640)
 * Fix icons being cut off in settings
   [\#2644](https://github.com/matrix-org/matrix-react-sdk/pull/2644)
 * Add credit for cover photo usage
   [\#2643](https://github.com/matrix-org/matrix-react-sdk/pull/2643)
 * make e2e icons on message transparent
   [\#2642](https://github.com/matrix-org/matrix-react-sdk/pull/2642)
 * fix close button being half off screen
   [\#2639](https://github.com/matrix-org/matrix-react-sdk/pull/2639)
 * Fix excessive timeline whitespace
   [\#2638](https://github.com/matrix-org/matrix-react-sdk/pull/2638)
 * Remove the white screen of welcome
   [\#2637](https://github.com/matrix-org/matrix-react-sdk/pull/2637)
 * always rerender room tiles
   [\#2636](https://github.com/matrix-org/matrix-react-sdk/pull/2636)

Changes in [1.0.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.0-rc.2) (2019-02-14)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v1.0.0-rc.1...v1.0.0-rc.2)

 * Update from Weblate.
   [\#2635](https://github.com/matrix-org/matrix-react-sdk/pull/2635)
 * use throttle as its more responsive
   [\#2632](https://github.com/matrix-org/matrix-react-sdk/pull/2632)
 * update range when items size changes
   [\#2631](https://github.com/matrix-org/matrix-react-sdk/pull/2631)
 * Fix registration after clicking email link
   [\#2630](https://github.com/matrix-org/matrix-react-sdk/pull/2630)
 * Re-check key backup status when settings opened
   [\#2626](https://github.com/matrix-org/matrix-react-sdk/pull/2626)
 * Improve room list rendering performance
   [\#2629](https://github.com/matrix-org/matrix-react-sdk/pull/2629)
 * Adjust top left menu items
   [\#2628](https://github.com/matrix-org/matrix-react-sdk/pull/2628)
 * Normalised icon strokes to 1px
   [\#2627](https://github.com/matrix-org/matrix-react-sdk/pull/2627)
 * Security: Force TURN setting was inverted
   [\#2623](https://github.com/matrix-org/matrix-react-sdk/pull/2623)
 * Add redesigned dark theme
   [\#2619](https://github.com/matrix-org/matrix-react-sdk/pull/2619)
 * Fix mx_RoomTile_name weighting
   [\#2610](https://github.com/matrix-org/matrix-react-sdk/pull/2610)
 * Add divider between tabs and regular buttons in room header
   [\#2621](https://github.com/matrix-org/matrix-react-sdk/pull/2621)
 * Update from Weblate.
   [\#2622](https://github.com/matrix-org/matrix-react-sdk/pull/2622)
 * Change taking a community off the left-left panel less scary
   [\#2609](https://github.com/matrix-org/matrix-react-sdk/pull/2609)
 * Fixes and styling related to e2e icons and dialogs
   [\#2620](https://github.com/matrix-org/matrix-react-sdk/pull/2620)
 * Fix: stickers layout
   [\#2618](https://github.com/matrix-org/matrix-react-sdk/pull/2618)
 * Fix: dont assume settings label only has one line
   [\#2616](https://github.com/matrix-org/matrix-react-sdk/pull/2616)
 * Labs feature: recent room breadcrumbs
   [\#2615](https://github.com/matrix-org/matrix-react-sdk/pull/2615)
 * Fix: roomlist reordering lags
   [\#2612](https://github.com/matrix-org/matrix-react-sdk/pull/2612)
 *  Change text in e2e UX to new copy
   [\#2617](https://github.com/matrix-org/matrix-react-sdk/pull/2617)
 * Add display name / avatar to incoming sas dialog
   [\#2613](https://github.com/matrix-org/matrix-react-sdk/pull/2613)
 * Restore backup on new recovery method dialog
   [\#2614](https://github.com/matrix-org/matrix-react-sdk/pull/2614)
 * Welcome page cleanup
   [\#2611](https://github.com/matrix-org/matrix-react-sdk/pull/2611)
 * Scale up settings UI to be easier to read
   [\#2604](https://github.com/matrix-org/matrix-react-sdk/pull/2604)
 * !important shouldn't have a space
   [\#2608](https://github.com/matrix-org/matrix-react-sdk/pull/2608)
 * Add legacy verification button on wait
   [\#2607](https://github.com/matrix-org/matrix-react-sdk/pull/2607)
 * Update from Weblate.
   [\#2606](https://github.com/matrix-org/matrix-react-sdk/pull/2606)

Changes in [1.0.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v1.0.0-rc.1) (2019-02-08)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.8...v1.0.0-rc.1)

 * Call isGuest correctly
   [\#2603](https://github.com/matrix-org/matrix-react-sdk/pull/2603)
 * Update from Weblate.
   [\#2602](https://github.com/matrix-org/matrix-react-sdk/pull/2602)
 * Prompt to restore backup rather than verify
   [\#2594](https://github.com/matrix-org/matrix-react-sdk/pull/2594)
 * Remove key backup & sas from labs
   [\#2599](https://github.com/matrix-org/matrix-react-sdk/pull/2599)
 * Update avatar colors
   [\#2600](https://github.com/matrix-org/matrix-react-sdk/pull/2600)
 * Fix: typeerror when creating DM
   [\#2601](https://github.com/matrix-org/matrix-react-sdk/pull/2601)
 * Render disabled mxField textareas as disabled
   [\#2591](https://github.com/matrix-org/matrix-react-sdk/pull/2591)
 * SDK support for welcome page
   [\#2597](https://github.com/matrix-org/matrix-react-sdk/pull/2597)
 * Change SAS to decimal / emoji
   [\#2596](https://github.com/matrix-org/matrix-react-sdk/pull/2596)
 * Render join rules and guest access changes in the timeline
   [\#2592](https://github.com/matrix-org/matrix-react-sdk/pull/2592)
 * Ensure toggle switches listen to property changes
   [\#2590](https://github.com/matrix-org/matrix-react-sdk/pull/2590)
 * Local echo on room access settings
   [\#2593](https://github.com/matrix-org/matrix-react-sdk/pull/2593)
 * guard custom tags with feature flag
   [\#2589](https://github.com/matrix-org/matrix-react-sdk/pull/2589)
 * remove ll feature flag, it's time!
   [\#2588](https://github.com/matrix-org/matrix-react-sdk/pull/2588)
 * Trust on decrypt
   [\#2583](https://github.com/matrix-org/matrix-react-sdk/pull/2583)
 * Remove click-to-verify from SAS
   [\#2586](https://github.com/matrix-org/matrix-react-sdk/pull/2586)
 * Fix: make sure custom tag scroller doesn't overflow parent
   [\#2587](https://github.com/matrix-org/matrix-react-sdk/pull/2587)
 * Fix: throttle custom tags updating in LLP
   [\#2585](https://github.com/matrix-org/matrix-react-sdk/pull/2585)
 * Fix firefox scrolling settings tabs differently
   [\#2579](https://github.com/matrix-org/matrix-react-sdk/pull/2579)
 * Actually change power levels when they are changed
   [\#2580](https://github.com/matrix-org/matrix-react-sdk/pull/2580)
 * Fix: logging in again breaks CustomRoomTagStore
   [\#2584](https://github.com/matrix-org/matrix-react-sdk/pull/2584)
 * Fix: click on notif badge
   [\#2582](https://github.com/matrix-org/matrix-react-sdk/pull/2582)
 * Extend slash command '/topic' to display the room topic
   [\#2532](https://github.com/matrix-org/matrix-react-sdk/pull/2532)
 * Fix: community badges
   [\#2581](https://github.com/matrix-org/matrix-react-sdk/pull/2581)
 * Bring back custom tags, also badges on communities
   [\#2575](https://github.com/matrix-org/matrix-react-sdk/pull/2575)
 * Style reset password to match design
   [\#2578](https://github.com/matrix-org/matrix-react-sdk/pull/2578)
 * Key Backup: Don't fail if no keys
   [\#2577](https://github.com/matrix-org/matrix-react-sdk/pull/2577)
 * Remove old user and room settings
   [\#2554](https://github.com/matrix-org/matrix-react-sdk/pull/2554)
 * increase debouncing of filtering because its quite laggy atm
   [\#2576](https://github.com/matrix-org/matrix-react-sdk/pull/2576)
 * Tweak field padding to avoid overlapping with selected text
   [\#2573](https://github.com/matrix-org/matrix-react-sdk/pull/2573)
 * Adapt login flow for the v2 design
   [\#2574](https://github.com/matrix-org/matrix-react-sdk/pull/2574)
 * Remove the arrow-paren lint rule
   [\#2572](https://github.com/matrix-org/matrix-react-sdk/pull/2572)
 * Ensure we show registration form when custom URLs are disabled
   [\#2571](https://github.com/matrix-org/matrix-react-sdk/pull/2571)
 * Fix: search term disappears when collapsing and expanding left panel
   [\#2568](https://github.com/matrix-org/matrix-react-sdk/pull/2568)
 * Fix: 'jump to bottom' creates big amounts of whitespace at the bottom
   [\#2567](https://github.com/matrix-org/matrix-react-sdk/pull/2567)
 * Fix: being able to size sections in leftpanel larger than their content
   while filtering
   [\#2566](https://github.com/matrix-org/matrix-react-sdk/pull/2566)
 * Redesign: widget makeover
   [\#2565](https://github.com/matrix-org/matrix-react-sdk/pull/2565)
 * Restore dropdown chevron to right
   [\#2564](https://github.com/matrix-org/matrix-react-sdk/pull/2564)
 * Remove warning about encryption being beta
   [\#2563](https://github.com/matrix-org/matrix-react-sdk/pull/2563)
 * Add e2e icon to room header/composer/member info, more ...
   [\#2557](https://github.com/matrix-org/matrix-react-sdk/pull/2557)
 * Remove guest warning bar
   [\#2562](https://github.com/matrix-org/matrix-react-sdk/pull/2562)
 * Style tweaks to support auth background
   [\#2561](https://github.com/matrix-org/matrix-react-sdk/pull/2561)
 * Set a minimum width on the settings tab content
   [\#2560](https://github.com/matrix-org/matrix-react-sdk/pull/2560)
 * Fix exception while saving room settings
   [\#2555](https://github.com/matrix-org/matrix-react-sdk/pull/2555)
 * Disable old settings, making tabbed settings the default
   [\#2559](https://github.com/matrix-org/matrix-react-sdk/pull/2559)
 * fix UnknownDeviceDialog layout
   [\#2558](https://github.com/matrix-org/matrix-react-sdk/pull/2558)
 * Misc fixes to settings
   [\#2553](https://github.com/matrix-org/matrix-react-sdk/pull/2553)
 * Add error message when registration is disabled
   [\#2548](https://github.com/matrix-org/matrix-react-sdk/pull/2548)
 * Hide registration fields that aren't used by any flow
   [\#2551](https://github.com/matrix-org/matrix-react-sdk/pull/2551)
 * Ensure correct server URLs with .well-known and server type
   [\#2547](https://github.com/matrix-org/matrix-react-sdk/pull/2547)
 * Spell homeserver correctly
   [\#2552](https://github.com/matrix-org/matrix-react-sdk/pull/2552)
 * Auto-focus username on registration
   [\#2546](https://github.com/matrix-org/matrix-react-sdk/pull/2546)
 * Fixed settings dialog header; Adjust padding on dialog
   [\#2549](https://github.com/matrix-org/matrix-react-sdk/pull/2549)
 * Fix empty lightbox when there is no avatarUrl
   [\#2314](https://github.com/matrix-org/matrix-react-sdk/pull/2314)
 * make overflow gradients much smaller and turn bottom into drop shadow
   [\#2544](https://github.com/matrix-org/matrix-react-sdk/pull/2544)
 * Make auth validation less annoying
   [\#2539](https://github.com/matrix-org/matrix-react-sdk/pull/2539)
 * layout composer independent of avatar being present
   [\#2545](https://github.com/matrix-org/matrix-react-sdk/pull/2545)
 * Matthew/cyrillic
   [\#2543](https://github.com/matrix-org/matrix-react-sdk/pull/2543)
 * Allow expanding the left panel manually when in narrow mode
   [\#2541](https://github.com/matrix-org/matrix-react-sdk/pull/2541)
 * Redesign: community page cleanup
   [\#2538](https://github.com/matrix-org/matrix-react-sdk/pull/2538)
 * Redesign: Disable ILAG
   [\#2536](https://github.com/matrix-org/matrix-react-sdk/pull/2536)
 * Use custom appearance and arrow for field selects
   [\#2540](https://github.com/matrix-org/matrix-react-sdk/pull/2540)
 * Fix typo
   [\#2537](https://github.com/matrix-org/matrix-react-sdk/pull/2537)
 * Merge redesign into develop
   [\#2535](https://github.com/matrix-org/matrix-react-sdk/pull/2535)
 * disable e2e tests everywhere as redesign breaks them for now
   [\#2534](https://github.com/matrix-org/matrix-react-sdk/pull/2534)
 * avoid horizontal scrollbar in composer when placeholder doesn't fit
   [\#2533](https://github.com/matrix-org/matrix-react-sdk/pull/2533)
 * fix dropdown style when input is shown
   [\#2531](https://github.com/matrix-org/matrix-react-sdk/pull/2531)
 * Redesign: tiny fix: stretch device label in member info if content doesn't
   fill it
   [\#2530](https://github.com/matrix-org/matrix-react-sdk/pull/2530)
 * Style registration flow
   [\#2527](https://github.com/matrix-org/matrix-react-sdk/pull/2527)
 * Redesign: small member info panel makeover
   [\#2522](https://github.com/matrix-org/matrix-react-sdk/pull/2522)
 * Render the home page when viewing the directory
   [\#2529](https://github.com/matrix-org/matrix-react-sdk/pull/2529)
 * Fix indentation on all new settings CSS
   [\#2528](https://github.com/matrix-org/matrix-react-sdk/pull/2528)
 * Round 1 of misc fixes for settings
   [\#2526](https://github.com/matrix-org/matrix-react-sdk/pull/2526)
 * Implement the Security & Privacy tab of new room settings
   [\#2523](https://github.com/matrix-org/matrix-react-sdk/pull/2523)
 * Implement the Advanced tab of new room settings
   [\#2525](https://github.com/matrix-org/matrix-react-sdk/pull/2525)
 * Implement the Roles & Permissions tab of new room settings
   [\#2524](https://github.com/matrix-org/matrix-react-sdk/pull/2524)
 * Redesign: room directory makeover
   [\#2519](https://github.com/matrix-org/matrix-react-sdk/pull/2519)
 * Iterate upon the room upgrade warning bar
   [\#2518](https://github.com/matrix-org/matrix-react-sdk/pull/2518)
 * redesign: small fixes
   [\#2520](https://github.com/matrix-org/matrix-react-sdk/pull/2520)
 * Implement the "general" tab of new room settings
   [\#2516](https://github.com/matrix-org/matrix-react-sdk/pull/2516)
 * Tweak auth overflow on Windows and Linux
   [\#2521](https://github.com/matrix-org/matrix-react-sdk/pull/2521)
 * Redesign: switch layout when filtering room sublists
   [\#2515](https://github.com/matrix-org/matrix-react-sdk/pull/2515)
 * Make native scrollbars prettier
   [\#2470](https://github.com/matrix-org/matrix-react-sdk/pull/2470)
 * Add server type selector and style login flow
   [\#2517](https://github.com/matrix-org/matrix-react-sdk/pull/2517)
 * Implement flair tab in user settings
   [\#2512](https://github.com/matrix-org/matrix-react-sdk/pull/2512)
 * Override UA/OS styles for disabled Field selects
   [\#2502](https://github.com/matrix-org/matrix-react-sdk/pull/2502)
 * Be more positive with setting labels
   [\#2504](https://github.com/matrix-org/matrix-react-sdk/pull/2504)
 * Redesign: new roomlist layout fixes
   [\#2514](https://github.com/matrix-org/matrix-react-sdk/pull/2514)
 * Redesign: new layout algorithm for room sublists.
   [\#2507](https://github.com/matrix-org/matrix-react-sdk/pull/2507)
 * Short-Authentication-String Verification
   [\#2461](https://github.com/matrix-org/matrix-react-sdk/pull/2461)
 * Fix unmount TypeError in `DeviceVerifyButtons`
   [\#2513](https://github.com/matrix-org/matrix-react-sdk/pull/2513)
 * Remove support for team servers
   [\#2511](https://github.com/matrix-org/matrix-react-sdk/pull/2511)
 * Initial structure for new room settings
   [\#2510](https://github.com/matrix-org/matrix-react-sdk/pull/2510)
 * Tweak wording on logout warning
   [\#2509](https://github.com/matrix-org/matrix-react-sdk/pull/2509)
 * Fix NPE in RoomRecoveryReminder
   [\#2508](https://github.com/matrix-org/matrix-react-sdk/pull/2508)
 * New text/caption for key backup by verifying device
   [\#2506](https://github.com/matrix-org/matrix-react-sdk/pull/2506)
 * Implement the "Security & Privacy" tab of new user settings
   [\#2499](https://github.com/matrix-org/matrix-react-sdk/pull/2499)
 * Add simple animations to toggle switches
   [\#2505](https://github.com/matrix-org/matrix-react-sdk/pull/2505)
 * Default a Field's placeholder to the label
   [\#2503](https://github.com/matrix-org/matrix-react-sdk/pull/2503)
 * Have the settings dialog be fixed in size
   [\#2501](https://github.com/matrix-org/matrix-react-sdk/pull/2501)
 * Implement the "Help & About" tab of new user settings
   [\#2500](https://github.com/matrix-org/matrix-react-sdk/pull/2500)
 * Implement the "Voice & Video" tab of new user settings
   [\#2498](https://github.com/matrix-org/matrix-react-sdk/pull/2498)
 * Add widget screenshots to the Labs section
   [\#2497](https://github.com/matrix-org/matrix-react-sdk/pull/2497)
 * Implement the "Preferences" tab on new user settings
   [\#2495](https://github.com/matrix-org/matrix-react-sdk/pull/2495)
 * Add target="_blank" to links that don't have it
   [\#2496](https://github.com/matrix-org/matrix-react-sdk/pull/2496)
 * Implement the "Notifications" tab of new user settings
   [\#2494](https://github.com/matrix-org/matrix-react-sdk/pull/2494)
 * Implement the "Labs" tab of new user settings
   [\#2492](https://github.com/matrix-org/matrix-react-sdk/pull/2492)
 * Implement the "General" tab of new user settings
   [\#2491](https://github.com/matrix-org/matrix-react-sdk/pull/2491)
 * Appease linter in auth related files
   [\#2493](https://github.com/matrix-org/matrix-react-sdk/pull/2493)
 * Update text and links in authentication flows
   [\#2489](https://github.com/matrix-org/matrix-react-sdk/pull/2489)
 * Move LanguageSelector to views
   [\#2490](https://github.com/matrix-org/matrix-react-sdk/pull/2490)
 * Restyle auth page language selector
   [\#2488](https://github.com/matrix-org/matrix-react-sdk/pull/2488)
 * Fix desktop captcha check
   [\#2487](https://github.com/matrix-org/matrix-react-sdk/pull/2487)
 * Basic structure for tabbed user settings
   [\#2476](https://github.com/matrix-org/matrix-react-sdk/pull/2476)
 * Token encouragement if zxcvbn gives no feedback
   [\#2471](https://github.com/matrix-org/matrix-react-sdk/pull/2471)
 * Fix: show rooms and people section when empty while filtering
   [\#2481](https://github.com/matrix-org/matrix-react-sdk/pull/2481)
 * Fix AuthFooter CSS rules conflicting with anchors all over the app
   [\#2486](https://github.com/matrix-org/matrix-react-sdk/pull/2486)
 * Support selects on Field
   [\#2484](https://github.com/matrix-org/matrix-react-sdk/pull/2484)
 * Fix integrations server error popup being hidden behind right panel
   [\#2482](https://github.com/matrix-org/matrix-react-sdk/pull/2482)
 * Fix: apparently room can be null here
   [\#2480](https://github.com/matrix-org/matrix-react-sdk/pull/2480)
 * Redesign: pull jump to bottom button out of room status bar
   [\#2478](https://github.com/matrix-org/matrix-react-sdk/pull/2478)
 * Redesign: set default size of 350px for left panel
   [\#2479](https://github.com/matrix-org/matrix-react-sdk/pull/2479)
 * Avoid "jumpiness" with inline typing indicator
   [\#2456](https://github.com/matrix-org/matrix-react-sdk/pull/2456)
 * De-lint CompatabilityPage & LoggedInView
   [\#2472](https://github.com/matrix-org/matrix-react-sdk/pull/2472)
 * Remove Status theme-specific hacks
   [\#2473](https://github.com/matrix-org/matrix-react-sdk/pull/2473)
 * Error if no sessions decrypted
   [\#2469](https://github.com/matrix-org/matrix-react-sdk/pull/2469)
 * Fix settings direct chat
   [\#2466](https://github.com/matrix-org/matrix-react-sdk/pull/2466)
 * Show verify button when we have a device to verify
   [\#2464](https://github.com/matrix-org/matrix-react-sdk/pull/2464)
 * Redesign: Add a form field component
   [\#2463](https://github.com/matrix-org/matrix-react-sdk/pull/2463)
 * Load fonts and images via source-relative URLs and requires
   [\#2460](https://github.com/matrix-org/matrix-react-sdk/pull/2460)
 * Say when backup is signed by unknown device
   [\#2455](https://github.com/matrix-org/matrix-react-sdk/pull/2455)
 * Add an /upgraderoom command to make upgrading easier for development
   [\#2458](https://github.com/matrix-org/matrix-react-sdk/pull/2458)
 * Merge develop->experimental
   [\#2457](https://github.com/matrix-org/matrix-react-sdk/pull/2457)
 * Fix: show hand cursor in topleft menu so its clear you can click it
   [\#2454](https://github.com/matrix-org/matrix-react-sdk/pull/2454)
 * Fix: search makeover missing icons
   [\#2453](https://github.com/matrix-org/matrix-react-sdk/pull/2453)
 * Redesign: search makeover
   [\#2448](https://github.com/matrix-org/matrix-react-sdk/pull/2448)
 * Revert "Tiled room UI"
   [\#2451](https://github.com/matrix-org/matrix-react-sdk/pull/2451)
 * Update from Weblate.
   [\#2452](https://github.com/matrix-org/matrix-react-sdk/pull/2452)
 * Improve room sublist resizing
   [\#2440](https://github.com/matrix-org/matrix-react-sdk/pull/2440)
 * Different dialog for new trusted backup
   [\#2435](https://github.com/matrix-org/matrix-react-sdk/pull/2435)
 * De-lint a few more files
   [\#2436](https://github.com/matrix-org/matrix-react-sdk/pull/2436)
 * Recalculate the visible rooms when rooms are upgraded
   [\#2433](https://github.com/matrix-org/matrix-react-sdk/pull/2433)
 * Navigate to the upgraded room's create event where possible
   [\#2432](https://github.com/matrix-org/matrix-react-sdk/pull/2432)
 * Don't show rooms with tombstones in the address picker
   [\#2429](https://github.com/matrix-org/matrix-react-sdk/pull/2429)
 * Add separate dialog for recovery method removed
   [\#2427](https://github.com/matrix-org/matrix-react-sdk/pull/2427)
 * Set which servers to try and join upgraded rooms through
   [\#2428](https://github.com/matrix-org/matrix-react-sdk/pull/2428)
 * Render a tile for tombstone events
   [\#2430](https://github.com/matrix-org/matrix-react-sdk/pull/2430)
 * Regenerate en_EN.json to sort entries
   [\#2431](https://github.com/matrix-org/matrix-react-sdk/pull/2431)
 * Key backup: Debounce passphrase feedback
   [\#2426](https://github.com/matrix-org/matrix-react-sdk/pull/2426)
 * Set backup niggles: 2
   [\#2425](https://github.com/matrix-org/matrix-react-sdk/pull/2425)
 * Fix lint errors in MessageComposerInput
   [\#2423](https://github.com/matrix-org/matrix-react-sdk/pull/2423)
 * Set backup niggles: 1
   [\#2424](https://github.com/matrix-org/matrix-react-sdk/pull/2424)
 * PoC: Add simple state counters to room heading
   [\#2388](https://github.com/matrix-org/matrix-react-sdk/pull/2388)
 * Fix a few things with cancelling recovery reminder
   [\#2420](https://github.com/matrix-org/matrix-react-sdk/pull/2420)
 * Add spaces back to async arrow functions
   [\#2422](https://github.com/matrix-org/matrix-react-sdk/pull/2422)
 * fix grid growing wider than viewport on chrome
   [\#2421](https://github.com/matrix-org/matrix-react-sdk/pull/2421)
 * Tiled room UI
   [\#2348](https://github.com/matrix-org/matrix-react-sdk/pull/2348)
 * Fix path to New Recovery Method icon
   [\#2417](https://github.com/matrix-org/matrix-react-sdk/pull/2417)
 * run unit tests on riot-web like before
   [\#2419](https://github.com/matrix-org/matrix-react-sdk/pull/2419)
 * Refactor travis-ci to use parallel jobs
   [\#2414](https://github.com/matrix-org/matrix-react-sdk/pull/2414)
 * Fix black-on-black GIF icon for stickers
   [\#2408](https://github.com/matrix-org/matrix-react-sdk/pull/2408)
 * Don't reset cached room list values when they are falsey
   [\#2413](https://github.com/matrix-org/matrix-react-sdk/pull/2413)
 * Make logout warning nag about key backups
   [\#2407](https://github.com/matrix-org/matrix-react-sdk/pull/2407)
 * Clarify readme instructions for developers
   [\#2404](https://github.com/matrix-org/matrix-react-sdk/pull/2404)
 * Add slash command for changing room name
   [\#2401](https://github.com/matrix-org/matrix-react-sdk/pull/2401)
 * Flatten and simplify the memberlist sorting algorithm
   [\#2381](https://github.com/matrix-org/matrix-react-sdk/pull/2381)
 * Tiny fixes for custom status messages on experimental
   [\#2403](https://github.com/matrix-org/matrix-react-sdk/pull/2403)
 * Part 3 of 3: Apply today's changes to experimental again
   [\#2400](https://github.com/matrix-org/matrix-react-sdk/pull/2400)
 * Part 2 of 3: Merge develop->experimental minus #2336
   [\#2399](https://github.com/matrix-org/matrix-react-sdk/pull/2399)
 * Part 1 of 3: Back out bad merge for develop->experimental
   [\#2398](https://github.com/matrix-org/matrix-react-sdk/pull/2398)
 * Fix browser navigation not working between /home, /login, /register, etc
   [\#2383](https://github.com/matrix-org/matrix-react-sdk/pull/2383)
 * Don't re-sort the room list if the user is hovering over it
   [\#2396](https://github.com/matrix-org/matrix-react-sdk/pull/2396)
 * Merge develop into experimental
   [\#2395](https://github.com/matrix-org/matrix-react-sdk/pull/2395)
 * Added colour var to all themes
   [\#2379](https://github.com/matrix-org/matrix-react-sdk/pull/2379)
 * Colour, contrast & legibility improvements
   [\#2378](https://github.com/matrix-org/matrix-react-sdk/pull/2378)
 * Redesign: add feedback dialog & button in tag panel
   [\#2376](https://github.com/matrix-org/matrix-react-sdk/pull/2376)
 * Redesign: add badge with dot to rm button, to see it catches your eye better
   [\#2371](https://github.com/matrix-org/matrix-react-sdk/pull/2371)
 * Fix misaligned (+) icon
   [\#2374](https://github.com/matrix-org/matrix-react-sdk/pull/2374)
 * Avoid 'transparent black' gradients in left panel
   [\#2373](https://github.com/matrix-org/matrix-react-sdk/pull/2373)
 * Normalised icons
   [\#2370](https://github.com/matrix-org/matrix-react-sdk/pull/2370)
 * Redesign: give right panel default width
   [\#2369](https://github.com/matrix-org/matrix-react-sdk/pull/2369)
 * Redesign:  Fix login field looking inline
   [\#2368](https://github.com/matrix-org/matrix-react-sdk/pull/2368)
 * Redesign: select search query on focus
   [\#2367](https://github.com/matrix-org/matrix-react-sdk/pull/2367)
 * Redesign: fix remaining right panel collapse issues.
   [\#2366](https://github.com/matrix-org/matrix-react-sdk/pull/2366)
 * Redesign: left panel fixes
   [\#2364](https://github.com/matrix-org/matrix-react-sdk/pull/2364)
 * Redesign: allow to hide the right panel when clicking already active button
   & persist
   [\#2361](https://github.com/matrix-org/matrix-react-sdk/pull/2361)
 * Redesign: make room tiles less high so more rooms fit on the screen
   [\#2359](https://github.com/matrix-org/matrix-react-sdk/pull/2359)
 * Redesign: ignore any unknown tags
   [\#2358](https://github.com/matrix-org/matrix-react-sdk/pull/2358)
 * Redesign: disable setting theme completely
   [\#2357](https://github.com/matrix-org/matrix-react-sdk/pull/2357)
 * Force use of dharma theme
   [\#2355](https://github.com/matrix-org/matrix-react-sdk/pull/2355)
 * Redesign: some small fixes
   [\#2354](https://github.com/matrix-org/matrix-react-sdk/pull/2354)
 * Redesign: restyle jump to first unread message & rework read marker logic
   (rebased)
   [\#2345](https://github.com/matrix-org/matrix-react-sdk/pull/2345)
 * Redesign: fix add room button alignment when collapsed
   [\#2343](https://github.com/matrix-org/matrix-react-sdk/pull/2343)
 * Redesign: confirm sign out from top left menu
   [\#2342](https://github.com/matrix-org/matrix-react-sdk/pull/2342)
 * Redesign: fix room header avatar in edit mode
   [\#2344](https://github.com/matrix-org/matrix-react-sdk/pull/2344)
 * Redesign: make community UX usable
   [\#2341](https://github.com/matrix-org/matrix-react-sdk/pull/2341)
 * Redesign: resizer persistence
   [\#2321](https://github.com/matrix-org/matrix-react-sdk/pull/2321)
 * Redesign: improve room sub list sizing & persist sizes
   [\#2297](https://github.com/matrix-org/matrix-react-sdk/pull/2297)
 * Redesign: temp solution to make room settings usable
   [\#2298](https://github.com/matrix-org/matrix-react-sdk/pull/2298)
 * Redesign: typing notifications in timeline
   [\#2276](https://github.com/matrix-org/matrix-react-sdk/pull/2276)
 * Redesign: add scroll indicator gradients to top and bottom of room sub list
   [\#2275](https://github.com/matrix-org/matrix-react-sdk/pull/2275)
 * Redesign: move member query field to bottom of member list
   [\#2270](https://github.com/matrix-org/matrix-react-sdk/pull/2270)
 * Redesign: room list visual polish
   [\#2269](https://github.com/matrix-org/matrix-react-sdk/pull/2269)
 * Redesign: bring back & restyle room filter field
   [\#2267](https://github.com/matrix-org/matrix-react-sdk/pull/2267)
 * Redesign: increase interaction rectangle of resize handles
   [\#2262](https://github.com/matrix-org/matrix-react-sdk/pull/2262)
 * Redesign: move right panel below room/group header
   [\#2260](https://github.com/matrix-org/matrix-react-sdk/pull/2260)
 * Redesign: use native auto-hiding scrollbars in room sub lists
   [\#2264](https://github.com/matrix-org/matrix-react-sdk/pull/2264)
 * Redesign: basic makeover of member info panel
   [\#2248](https://github.com/matrix-org/matrix-react-sdk/pull/2248)
 * Redesign: memberlist basic makeover
   [\#2245](https://github.com/matrix-org/matrix-react-sdk/pull/2245)
 * Redesign: tweak room list font sizes
   [\#2246](https://github.com/matrix-org/matrix-react-sdk/pull/2246)
 * Redesign: Fix room lists sizing
   [\#2234](https://github.com/matrix-org/matrix-react-sdk/pull/2234)
 * Redesign: fix import path
   [\#2243](https://github.com/matrix-org/matrix-react-sdk/pull/2243)
 * Redesign: update (most) icons
   [\#2241](https://github.com/matrix-org/matrix-react-sdk/pull/2241)
 * Redesign: fix basic room header layout
   [\#2240](https://github.com/matrix-org/matrix-react-sdk/pull/2240)
 * Redesign: 1st go at top left menu & restyling context menus
   [\#2239](https://github.com/matrix-org/matrix-react-sdk/pull/2239)
 * Redesign: Initial timeline tweaks
   [\#2238](https://github.com/matrix-org/matrix-react-sdk/pull/2238)
 * Redesign: Align visuals of room list with design
   [\#2233](https://github.com/matrix-org/matrix-react-sdk/pull/2233)
 * Redesign: room section header tidbits
   [\#2229](https://github.com/matrix-org/matrix-react-sdk/pull/2229)
 * Redesign: Add (+) button in room section header to add rooms
   [\#2228](https://github.com/matrix-org/matrix-react-sdk/pull/2228)
 * Redesign: 1st go at resizing room sublists
   [\#2226](https://github.com/matrix-org/matrix-react-sdk/pull/2226)
 * Redesign: remove room list truncation and DND
   [\#2224](https://github.com/matrix-org/matrix-react-sdk/pull/2224)
 * Redesign: resizeable/collapsible sections
   [\#2210](https://github.com/matrix-org/matrix-react-sdk/pull/2210)

Changes in [0.14.8](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.8) (2019-01-22)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.8-rc.1...v0.14.8)

 * Fix settings direct chat
   [\#2467](https://github.com/matrix-org/matrix-react-sdk/pull/2467)

Changes in [0.14.8-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.8-rc.1) (2019-01-17)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.7...v0.14.8-rc.1)

 * Change wording of 'invite anyway' setting
   [\#2450](https://github.com/matrix-org/matrix-react-sdk/pull/2450)
 * Minimal lint-fixes to make develop CI build
   [\#2449](https://github.com/matrix-org/matrix-react-sdk/pull/2449)
 * Develop->Experimental
   [\#2445](https://github.com/matrix-org/matrix-react-sdk/pull/2445)
 * Limit line length in the room directory
   [\#2438](https://github.com/matrix-org/matrix-react-sdk/pull/2438)
 * Develop->Experimental
   [\#2444](https://github.com/matrix-org/matrix-react-sdk/pull/2444)
 * Fix setting label for unknown invites
   [\#2443](https://github.com/matrix-org/matrix-react-sdk/pull/2443)
 * Merge develop -> experimental
   [\#2441](https://github.com/matrix-org/matrix-react-sdk/pull/2441)
 * Give a route for retrying invites for users which may not exist
   [\#2434](https://github.com/matrix-org/matrix-react-sdk/pull/2434)
 * Show in-room reminder when key backup creating device unverified
   [\#2394](https://github.com/matrix-org/matrix-react-sdk/pull/2394)
 * Consistent flair ordering.
   [\#2389](https://github.com/matrix-org/matrix-react-sdk/pull/2389)
 * Fetch matching e2e-test branch
   [\#2387](https://github.com/matrix-org/matrix-react-sdk/pull/2387)
 * Add some logging for riot-web#7838
   [\#2385](https://github.com/matrix-org/matrix-react-sdk/pull/2385)
 * Handle well-known data in the login response
   [\#2384](https://github.com/matrix-org/matrix-react-sdk/pull/2384)
 * Custom status messages
   [\#2347](https://github.com/matrix-org/matrix-react-sdk/pull/2347)
 * React-sdk changes to support sandboxed electron
   [\#2372](https://github.com/matrix-org/matrix-react-sdk/pull/2372)
 * Make sure to grab the InlineSpinner object
   [\#2363](https://github.com/matrix-org/matrix-react-sdk/pull/2363)
 * Standardize errors about localpart structure
   [\#2351](https://github.com/matrix-org/matrix-react-sdk/pull/2351)
 * Fix translation error on notification icon
   [\#2352](https://github.com/matrix-org/matrix-react-sdk/pull/2352)
 * Introduce a default_server_name for aesthetics and rework .well-known
   [\#2327](https://github.com/matrix-org/matrix-react-sdk/pull/2327)
 * Show the number of unread notifications above the bell on the right
   [\#2336](https://github.com/matrix-org/matrix-react-sdk/pull/2336)
 * Check to make sure email addresses look roughly valid before inviting them
   to rooms
   [\#2338](https://github.com/matrix-org/matrix-react-sdk/pull/2338)
 * Expose hidden notification rules in UI
   [\#2346](https://github.com/matrix-org/matrix-react-sdk/pull/2346)
 * Avoid preserving HS url at logout
   [\#2340](https://github.com/matrix-org/matrix-react-sdk/pull/2340)
 * Speed up room unread checks by not hitting the SettingsStore so often
   [\#2339](https://github.com/matrix-org/matrix-react-sdk/pull/2339)
 * Remove outdated info about custom skins
   [\#2337](https://github.com/matrix-org/matrix-react-sdk/pull/2337)
 * Show the IncomingCallBox if the call is for the RoomSubList
   [\#2333](https://github.com/matrix-org/matrix-react-sdk/pull/2333)
 * Don't consider ACL'd servers as permalink candidates
   [\#2331](https://github.com/matrix-org/matrix-react-sdk/pull/2331)
 * Fix pinning of rooms without badges
   [\#2330](https://github.com/matrix-org/matrix-react-sdk/pull/2330)
 * Sort translations by file name
   [\#2329](https://github.com/matrix-org/matrix-react-sdk/pull/2329)
 * Update React guide in code style
   [\#2335](https://github.com/matrix-org/matrix-react-sdk/pull/2335)
 * Remove temporary account_deactivation_preferences
   [\#2259](https://github.com/matrix-org/matrix-react-sdk/pull/2259)

Changes in [0.14.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.7) (2018-12-10)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.7-rc.2...v0.14.7)

 * No changes since rc.2

Changes in [0.14.7-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.7-rc.2) (2018-12-06)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.7-rc.1...v0.14.7-rc.2)

 * Ship the babelrc file to npm
   [\#2332](https://github.com/matrix-org/matrix-react-sdk/pull/2332)

Changes in [0.14.7-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.7-rc.1) (2018-12-06)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.6...v0.14.7-rc.1)

 * Suppress CORS errors in the 'failed to join room' dialog
   [\#2306](https://github.com/matrix-org/matrix-react-sdk/pull/2306)
 * Check if users exist before inviting them and communicate errors
   [\#2317](https://github.com/matrix-org/matrix-react-sdk/pull/2317)
 * Update from Weblate.
   [\#2328](https://github.com/matrix-org/matrix-react-sdk/pull/2328)
 * Allow group summary to load when /users fails
   [\#2326](https://github.com/matrix-org/matrix-react-sdk/pull/2326)
 * Show correct text if passphrase is skipped
   [\#2324](https://github.com/matrix-org/matrix-react-sdk/pull/2324)
 * Add password strength meter to backup creation UI
   [\#2294](https://github.com/matrix-org/matrix-react-sdk/pull/2294)
 * Check upload limits before trying to upload large files
   [\#1876](https://github.com/matrix-org/matrix-react-sdk/pull/1876)
 * Support .well-known discovery
   [\#2227](https://github.com/matrix-org/matrix-react-sdk/pull/2227)
 * Make create key backup dialog async
   [\#2291](https://github.com/matrix-org/matrix-react-sdk/pull/2291)
 * Forgot to enable continue button on download
   [\#2288](https://github.com/matrix-org/matrix-react-sdk/pull/2288)
 * Online incremental megolm backups (v2)
   [\#2169](https://github.com/matrix-org/matrix-react-sdk/pull/2169)
 * Add recovery key download button
   [\#2284](https://github.com/matrix-org/matrix-react-sdk/pull/2284)
 * Passphrase Support for e2e backups
   [\#2283](https://github.com/matrix-org/matrix-react-sdk/pull/2283)
 * Update async dialog interface to use promises
   [\#2286](https://github.com/matrix-org/matrix-react-sdk/pull/2286)
 * Support for m.login.sso
   [\#2279](https://github.com/matrix-org/matrix-react-sdk/pull/2279)
 * Added badge to non-autoplay GIFs
   [\#2235](https://github.com/matrix-org/matrix-react-sdk/pull/2235)
 * Improve terms auth flow
   [\#2277](https://github.com/matrix-org/matrix-react-sdk/pull/2277)
 * Handle crypto db version upgrade
   [\#2282](https://github.com/matrix-org/matrix-react-sdk/pull/2282)

Changes in [0.14.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.6) (2018-11-22)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.5...v0.14.6)

 * Warning when crypto DB is too new to use.

Changes in [0.14.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.5) (2018-11-19)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.5-rc.2...v0.14.5)

 * No changes since rc.1

Changes in [0.14.5-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.5-rc.2) (2018-11-15)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.5-rc.1...v0.14.5-rc.2)

 * Update to js-sdk v0.14.0-rc.1 which uses the new Olm API
   (v0.14.0-rc.1 was broken because of this).

Changes in [0.14.5-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.5-rc.1) (2018-11-15)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.4...v0.14.5-rc.1)

 * Update from Weblate.
   [\#2278](https://github.com/matrix-org/matrix-react-sdk/pull/2278)
 * Support room IDs and event permalinks in the join command
   [\#2272](https://github.com/matrix-org/matrix-react-sdk/pull/2272)
 * Align encrypted event buttons in Safari
   [\#2274](https://github.com/matrix-org/matrix-react-sdk/pull/2274)
 * Align buttons in encrypted event dialog
   [\#2273](https://github.com/matrix-org/matrix-react-sdk/pull/2273)
 * Add visible guest warning to encourage login
   [\#2268](https://github.com/matrix-org/matrix-react-sdk/pull/2268)
 * Regenerate the room list when m.fully_read is issued
   [\#2266](https://github.com/matrix-org/matrix-react-sdk/pull/2266)
 * Remove the request-only stuff we don't need anymore
   [\#2263](https://github.com/matrix-org/matrix-react-sdk/pull/2263)
 * Improve performance of room list and fix timestamp ordering when pinning
   rooms
   [\#2265](https://github.com/matrix-org/matrix-react-sdk/pull/2265)
 * Add options to pin unread/mentioned rooms to the top of the room list
   [\#1936](https://github.com/matrix-org/matrix-react-sdk/pull/1936)
 * only run e2e tests on PRs targeted on develop
   [\#2261](https://github.com/matrix-org/matrix-react-sdk/pull/2261)
 * Fix and test matrix.to alias permalinks
   [\#2254](https://github.com/matrix-org/matrix-react-sdk/pull/2254)
 * click-through svg on tag tile context menu to make it less weird
   [\#2257](https://github.com/matrix-org/matrix-react-sdk/pull/2257)
 * Hide Matthew's Time Machine
   [\#2256](https://github.com/matrix-org/matrix-react-sdk/pull/2256)
 * Update babel-eslint to 8.1.1
   [\#2255](https://github.com/matrix-org/matrix-react-sdk/pull/2255)
 * Support routing matrix.to links to joinable rooms
   [\#2250](https://github.com/matrix-org/matrix-react-sdk/pull/2250)
 * Fix autoreplacement of ascii emoji
   [\#2253](https://github.com/matrix-org/matrix-react-sdk/pull/2253)
 * Repair DevTools button padding by centralizing styles
   [\#2252](https://github.com/matrix-org/matrix-react-sdk/pull/2252)
 * Redirect widgets to another location before deleting them
   [\#2232](https://github.com/matrix-org/matrix-react-sdk/pull/2232)
 * disable e2e tests for PRs targeted at experimental (redesign)
   [\#2251](https://github.com/matrix-org/matrix-react-sdk/pull/2251)
 * Fix emoji replacement in composer
   [\#2247](https://github.com/matrix-org/matrix-react-sdk/pull/2247)
 * Add a devtools button to roomsettings
   [\#2249](https://github.com/matrix-org/matrix-react-sdk/pull/2249)
 * Add warning when administrator leaves community (#5724)
   [\#2242](https://github.com/matrix-org/matrix-react-sdk/pull/2242)

Changes in [0.14.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.4) (2018-11-13)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.3...v0.14.4)

 * Include change that was supposed to be included in orevious version

Changes in [0.14.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.3) (2018-11-13)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.2...v0.14.3)

 * Add banner with login/register links for users who aren't logged in

Changes in [0.14.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.2) (2018-10-29)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.2-rc.1...v0.14.2)

 * Fix autoreplacement of ascii emoji
   [\#2258](https://github.com/matrix-org/matrix-react-sdk/pull/2258)

Changes in [0.14.2-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.2-rc.1) (2018-10-24)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.1...v0.14.2-rc.1)

 * Update from Weblate.
   [\#2244](https://github.com/matrix-org/matrix-react-sdk/pull/2244)
 * Show the group member list again
   [\#2223](https://github.com/matrix-org/matrix-react-sdk/pull/2223)
 * lint: make colorScheme camel case
   [\#2237](https://github.com/matrix-org/matrix-react-sdk/pull/2237)
 * Change leave room button text, OK -> Leave
   [\#2236](https://github.com/matrix-org/matrix-react-sdk/pull/2236)
 * Move all dialog buttons to the right and fix their order
   [\#2231](https://github.com/matrix-org/matrix-react-sdk/pull/2231)
 * Add a bit of text to explain the purpose of the RoomPreviewSpinner
   [\#2225](https://github.com/matrix-org/matrix-react-sdk/pull/2225)
 * Move the login box from the left sidebar to where the composer is
   [\#2219](https://github.com/matrix-org/matrix-react-sdk/pull/2219)
 * Fix an error where React doesn't like value=null on a select
   [\#2230](https://github.com/matrix-org/matrix-react-sdk/pull/2230)
 * add missing sticker translation
   [\#2216](https://github.com/matrix-org/matrix-react-sdk/pull/2216)
 * Support m.login.terms during registration
   [\#2221](https://github.com/matrix-org/matrix-react-sdk/pull/2221)
 * Don't show the invite nag bar when peeking
   [\#2220](https://github.com/matrix-org/matrix-react-sdk/pull/2220)
 * Apply the user's tint once the MatrixClientPeg is moderately ready
   [\#2214](https://github.com/matrix-org/matrix-react-sdk/pull/2214)
 * Make rageshake use less memory
   [\#2217](https://github.com/matrix-org/matrix-react-sdk/pull/2217)
 * Fix autocomplete
   [\#2212](https://github.com/matrix-org/matrix-react-sdk/pull/2212)
 * Explain feature states in a lot more detail
   [\#2211](https://github.com/matrix-org/matrix-react-sdk/pull/2211)
 * Fix various lint errors
   [\#2213](https://github.com/matrix-org/matrix-react-sdk/pull/2213)

Changes in [0.14.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.1) (2018-10-19)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.0...v0.14.1)

 * Apply the user's tint once the MatrixClientPeg is moderately ready
   [\#2214](https://github.com/matrix-org/matrix-react-sdk/pull/2214)

Changes in [0.14.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.0) (2018-10-16)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.14.0-rc.1...v0.14.0)

 * Phased rollout of lazy loading
   [\#2218](https://github.com/matrix-org/matrix-react-sdk/pull/2218)

Changes in [0.14.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.0-rc.1) (2018-10-11)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.6...v0.14.0-rc.1)

 * turn LL on by default!
   [\#2209](https://github.com/matrix-org/matrix-react-sdk/pull/2209)
 * Update from Weblate.
   [\#2207](https://github.com/matrix-org/matrix-react-sdk/pull/2207)
 * Fix quote post slate update
   [\#2206](https://github.com/matrix-org/matrix-react-sdk/pull/2206)
 * Handle InvalidStoreError from js-sdk
   [\#2205](https://github.com/matrix-org/matrix-react-sdk/pull/2205)
 * Fall back to default avatar in RR when member isn't loaded yet
   [\#2204](https://github.com/matrix-org/matrix-react-sdk/pull/2204)
 * Update to new version of slate
   [\#2202](https://github.com/matrix-org/matrix-react-sdk/pull/2202)
 * Update karma to webpack 4
   [\#2203](https://github.com/matrix-org/matrix-react-sdk/pull/2203)
 * More accessible buttons - take 2
   [\#2194](https://github.com/matrix-org/matrix-react-sdk/pull/2194)
 * log correct error code when opening log idb
   [\#2200](https://github.com/matrix-org/matrix-react-sdk/pull/2200)
 * show warning when LL is disabled but was enabled before
   [\#2201](https://github.com/matrix-org/matrix-react-sdk/pull/2201)
 * Fall back to another store if indexeddb start fails
   [\#2195](https://github.com/matrix-org/matrix-react-sdk/pull/2195)
 * Silence bluebird warnings
   [\#2198](https://github.com/matrix-org/matrix-react-sdk/pull/2198)
 * Use createObjectURL instead of readAsDataURL for videos
   [\#2197](https://github.com/matrix-org/matrix-react-sdk/pull/2197)
 * Revert "Use createObjectURL instead of readAsDataURL for videos"
   [\#2196](https://github.com/matrix-org/matrix-react-sdk/pull/2196)
 * Track how far the user travels before dismissing their user settings
   [\#2183](https://github.com/matrix-org/matrix-react-sdk/pull/2183)
 * Drop (IRC) suffix hacks
   [\#2193](https://github.com/matrix-org/matrix-react-sdk/pull/2193)
 * Use createObjectURL instead of readAsDataURL for videos
   [\#2176](https://github.com/matrix-org/matrix-react-sdk/pull/2176)
 * Remove old migration code
   [\#2192](https://github.com/matrix-org/matrix-react-sdk/pull/2192)
 * Fix brace style in TextForEvent.js
   [\#2191](https://github.com/matrix-org/matrix-react-sdk/pull/2191)
 * Fix error logging
   [\#2190](https://github.com/matrix-org/matrix-react-sdk/pull/2190)
 * Fix Promise.defer warning in ScalarAuthClient.js
   [\#2188](https://github.com/matrix-org/matrix-react-sdk/pull/2188)
 * Communicate early that a 3pid is required during registration if needed
   [\#2180](https://github.com/matrix-org/matrix-react-sdk/pull/2180)
 * try to encourage people to attach logs to bugs
   [\#2185](https://github.com/matrix-org/matrix-react-sdk/pull/2185)
 * Show the 'homeserver unavailable' warning when the first sync fails
   [\#2182](https://github.com/matrix-org/matrix-react-sdk/pull/2182)
 * allow passing initial is_url like hs_url in query params
   [\#2083](https://github.com/matrix-org/matrix-react-sdk/pull/2083)
 * Update karma
   [\#2177](https://github.com/matrix-org/matrix-react-sdk/pull/2177)
 * fudge hangup reasons
   [\#2184](https://github.com/matrix-org/matrix-react-sdk/pull/2184)
 * Provide more helpful errors when i18n generation fails
   [\#2181](https://github.com/matrix-org/matrix-react-sdk/pull/2181)

Changes in [0.14.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.14.0-rc.1) (2018-10-11)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.6...v0.14.0-rc.1)

 * turn LL on by default!
   [\#2209](https://github.com/matrix-org/matrix-react-sdk/pull/2209)
 * Update from Weblate.
   [\#2207](https://github.com/matrix-org/matrix-react-sdk/pull/2207)
 * Fix quote post slate update
   [\#2206](https://github.com/matrix-org/matrix-react-sdk/pull/2206)
 * Handle InvalidStoreError from js-sdk
   [\#2205](https://github.com/matrix-org/matrix-react-sdk/pull/2205)
 * Fall back to default avatar in RR when member isn't loaded yet
   [\#2204](https://github.com/matrix-org/matrix-react-sdk/pull/2204)
 * Update to new version of slate
   [\#2202](https://github.com/matrix-org/matrix-react-sdk/pull/2202)
 * Update karma to webpack 4
   [\#2203](https://github.com/matrix-org/matrix-react-sdk/pull/2203)
 * More accessible buttons - take 2
   [\#2194](https://github.com/matrix-org/matrix-react-sdk/pull/2194)
 * log correct error code when opening log idb
   [\#2200](https://github.com/matrix-org/matrix-react-sdk/pull/2200)
 * show warning when LL is disabled but was enabled before
   [\#2201](https://github.com/matrix-org/matrix-react-sdk/pull/2201)
 * Fall back to another store if indexeddb start fails
   [\#2195](https://github.com/matrix-org/matrix-react-sdk/pull/2195)
 * Silence bluebird warnings
   [\#2198](https://github.com/matrix-org/matrix-react-sdk/pull/2198)
 * Use createObjectURL instead of readAsDataURL for videos
   [\#2197](https://github.com/matrix-org/matrix-react-sdk/pull/2197)
 * Revert "Use createObjectURL instead of readAsDataURL for videos"
   [\#2196](https://github.com/matrix-org/matrix-react-sdk/pull/2196)
 * Track how far the user travels before dismissing their user settings
   [\#2183](https://github.com/matrix-org/matrix-react-sdk/pull/2183)
 * Drop (IRC) suffix hacks
   [\#2193](https://github.com/matrix-org/matrix-react-sdk/pull/2193)
 * Use createObjectURL instead of readAsDataURL for videos
   [\#2176](https://github.com/matrix-org/matrix-react-sdk/pull/2176)
 * Remove old migration code
   [\#2192](https://github.com/matrix-org/matrix-react-sdk/pull/2192)
 * Fix brace style in TextForEvent.js
   [\#2191](https://github.com/matrix-org/matrix-react-sdk/pull/2191)
 * Fix error logging
   [\#2190](https://github.com/matrix-org/matrix-react-sdk/pull/2190)
 * Fix Promise.defer warning in ScalarAuthClient.js
   [\#2188](https://github.com/matrix-org/matrix-react-sdk/pull/2188)
 * Communicate early that a 3pid is required during registration if needed
   [\#2180](https://github.com/matrix-org/matrix-react-sdk/pull/2180)
 * try to encourage people to attach logs to bugs
   [\#2185](https://github.com/matrix-org/matrix-react-sdk/pull/2185)
 * Show the 'homeserver unavailable' warning when the first sync fails
   [\#2182](https://github.com/matrix-org/matrix-react-sdk/pull/2182)
 * allow passing initial is_url like hs_url in query params
   [\#2083](https://github.com/matrix-org/matrix-react-sdk/pull/2083)
 * Update karma
   [\#2177](https://github.com/matrix-org/matrix-react-sdk/pull/2177)
 * fudge hangup reasons
   [\#2184](https://github.com/matrix-org/matrix-react-sdk/pull/2184)
 * Provide more helpful errors when i18n generation fails
   [\#2181](https://github.com/matrix-org/matrix-react-sdk/pull/2181)

Changes in [0.13.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.6) (2018-10-08)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.5...v0.13.6)

 * Fix resuming session in Firefox private mode/Tor browser being broken
   [\#2195](https://github.com/matrix-org/matrix-react-sdk/pull/2195)
 * Show warning about using lazy-loading/non-lazy-loading versions simultaneously (/app & /develop)
   [\#2201](https://github.com/matrix-org/matrix-react-sdk/pull/2201)

Changes in [0.13.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.5) (2018-10-01)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.5-rc.1...v0.13.5)

 * No changes since rc.1

Changes in [0.13.5-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.5-rc.1) (2018-09-27)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.4...v0.13.5-rc.1)

 * resync when LL is toggled, show message when enabled
   [\#2178](https://github.com/matrix-org/matrix-react-sdk/pull/2178)
 * Update from Weblate.
   [\#2179](https://github.com/matrix-org/matrix-react-sdk/pull/2179)
 * Split npm start into an init and watch script
   [\#2175](https://github.com/matrix-org/matrix-react-sdk/pull/2175)
 * show canonical aliases in timeline, and set/remove implicit ones
   [\#2171](https://github.com/matrix-org/matrix-react-sdk/pull/2171)
 * Fix stale RR and improve LL reliability in RoomView & MemberList.
   [\#2168](https://github.com/matrix-org/matrix-react-sdk/pull/2168)
 * pass --travis flag to e2e tests to disable tests known not to work Travis CI
   [\#2170](https://github.com/matrix-org/matrix-react-sdk/pull/2170)
 * Add m.room.aliases to the timeline
   [\#2167](https://github.com/matrix-org/matrix-react-sdk/pull/2167)
 * postpone loading the members until the user joined the room
   [\#2165](https://github.com/matrix-org/matrix-react-sdk/pull/2165)
 * Allow translation tags object to be a variable
   [\#2166](https://github.com/matrix-org/matrix-react-sdk/pull/2166)
 * Don't try to exit fullscreen if not fullscreen
   [\#2164](https://github.com/matrix-org/matrix-react-sdk/pull/2164)
 * avoid updating the memberlist while the spinner is shown
   [\#2161](https://github.com/matrix-org/matrix-react-sdk/pull/2161)
 * fix logging room id when LL members fail
   [\#2163](https://github.com/matrix-org/matrix-react-sdk/pull/2163)
 * dont keep the spinner in the memberlist when fetching /members fails
   [\#2162](https://github.com/matrix-org/matrix-react-sdk/pull/2162)
 * only dispatch an action for self-membership
   [\#2160](https://github.com/matrix-org/matrix-react-sdk/pull/2160)
 * avoid unneeded lookups in memberDict
   [\#2153](https://github.com/matrix-org/matrix-react-sdk/pull/2153)
 * Update from Weblate.
   [\#2157](https://github.com/matrix-org/matrix-react-sdk/pull/2157)
 * avoid memberlist refresh for events related to rooms other but the current
   [\#2156](https://github.com/matrix-org/matrix-react-sdk/pull/2156)

Changes in [0.13.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.4) (2018-09-10)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.4-rc.1...v0.13.4)

 * No changes since rc.1

Changes in [0.13.4-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.4-rc.1) (2018-09-07)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.3...v0.13.4-rc.1)

 * Error on splash screen if sync is failing
   [\#2155](https://github.com/matrix-org/matrix-react-sdk/pull/2155)
 *  Do full registration if HS doesn't support ILAG
   [\#2150](https://github.com/matrix-org/matrix-react-sdk/pull/2150)
 * Re-apply "Don't rely on room members to query power levels"
   [\#2152](https://github.com/matrix-org/matrix-react-sdk/pull/2152)
 * s/DidMount/WillMount/ in MessageComposerInput
   [\#2151](https://github.com/matrix-org/matrix-react-sdk/pull/2151)
 * Revert "Don't rely on room members to query power levels"
   [\#2149](https://github.com/matrix-org/matrix-react-sdk/pull/2149)
 * Don't rely on room members to query power levels
   [\#2145](https://github.com/matrix-org/matrix-react-sdk/pull/2145)
 * Correctly mark email as optional
   [\#2148](https://github.com/matrix-org/matrix-react-sdk/pull/2148)
 * guests trying to join communities should fire the ILAG flow.
   [\#2059](https://github.com/matrix-org/matrix-react-sdk/pull/2059)
 * Fix DM avatars, part 3
   [\#2146](https://github.com/matrix-org/matrix-react-sdk/pull/2146)
 * Fix: show spinner again while recovering from connection error
   [\#2143](https://github.com/matrix-org/matrix-react-sdk/pull/2143)
 * Fix: infinite spinner on trying to create welcomeUserId room without consent
   [\#2147](https://github.com/matrix-org/matrix-react-sdk/pull/2147)
 * Show spinner in member list while loading members
   [\#2139](https://github.com/matrix-org/matrix-react-sdk/pull/2139)
 * Slash command to discard megolm session
   [\#2140](https://github.com/matrix-org/matrix-react-sdk/pull/2140)

Changes in [0.13.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.3) (2018-09-03)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.3-rc.2...v0.13.3)

 * No changes since rc.2

Changes in [0.13.3-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.3-rc.2) (2018-08-31)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.3-rc.1...v0.13.3-rc.2)

 * Update js-sdk to fix exception

Changes in [0.13.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.3-rc.1) (2018-08-30)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.2...v0.13.3-rc.1)

 * Fix DM avatar
   [\#2141](https://github.com/matrix-org/matrix-react-sdk/pull/2141)
 * Update from Weblate.
   [\#2142](https://github.com/matrix-org/matrix-react-sdk/pull/2142)
 * Support m.room.tombstone events
   [\#2124](https://github.com/matrix-org/matrix-react-sdk/pull/2124)
 * Support room creation events
   [\#2123](https://github.com/matrix-org/matrix-react-sdk/pull/2123)
 * Support for room upgrades
   [\#2122](https://github.com/matrix-org/matrix-react-sdk/pull/2122)
 * Fix: dont show 1:1 avatar for rooms +2 members but only <=2 members loaded
   [\#2137](https://github.com/matrix-org/matrix-react-sdk/pull/2137)
 * Render terms & conditions in settings
   [\#2136](https://github.com/matrix-org/matrix-react-sdk/pull/2136)
 * Don't crash if the value of a room tag is null
   [\#2133](https://github.com/matrix-org/matrix-react-sdk/pull/2133)
 * Add stub for getVisibleRooms()
   [\#2134](https://github.com/matrix-org/matrix-react-sdk/pull/2134)
 * Fix LL crash trying to render own avatar in composer when member isn't
   available yet
   [\#2132](https://github.com/matrix-org/matrix-react-sdk/pull/2132)
 * Support M_INCOMPATIBLE_ROOM_VERSION
   [\#2125](https://github.com/matrix-org/matrix-react-sdk/pull/2125)
 * Hide replaced rooms
   [\#2127](https://github.com/matrix-org/matrix-react-sdk/pull/2127)
 * Fix CPU spin on joining large room
   [\#2128](https://github.com/matrix-org/matrix-react-sdk/pull/2128)
 * Change format of server usage limit message
   [\#2131](https://github.com/matrix-org/matrix-react-sdk/pull/2131)
 * Re-apply "Fix showing peek preview while LL members are loading""
   [\#2130](https://github.com/matrix-org/matrix-react-sdk/pull/2130)
 * Revert "Fix showing peek preview while LL members are loading"
   [\#2129](https://github.com/matrix-org/matrix-react-sdk/pull/2129)
 * Fix showing peek preview while LL members are loading
   [\#2126](https://github.com/matrix-org/matrix-react-sdk/pull/2126)
 * Destroy non-persistent widgets when switching room
   [\#2098](https://github.com/matrix-org/matrix-react-sdk/pull/2098)
 * Lazy loading of room members
   [\#2118](https://github.com/matrix-org/matrix-react-sdk/pull/2118)
 * Lazy loading: feature toggle
   [\#2115](https://github.com/matrix-org/matrix-react-sdk/pull/2115)
 * Lazy loading: cleanup
   [\#2116](https://github.com/matrix-org/matrix-react-sdk/pull/2116)
 * Lazy loading: fix end-to-end encryption rooms
   [\#2113](https://github.com/matrix-org/matrix-react-sdk/pull/2113)
 * Lazy loading: Lazy load members while backpaginating
   [\#2104](https://github.com/matrix-org/matrix-react-sdk/pull/2104)
 * Lazy loading: don't assume we have our own member available
   [\#2102](https://github.com/matrix-org/matrix-react-sdk/pull/2102)
 * Lazy load room members - Part I
   [\#2072](https://github.com/matrix-org/matrix-react-sdk/pull/2072)

Changes in [0.13.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.2) (2018-08-23)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.1...v0.13.2)

 * Don't crash if the value of a room tag is null
   [\#2135](https://github.com/matrix-org/matrix-react-sdk/pull/2135)

Changes in [0.13.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.1) (2018-08-20)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.1-rc.1...v0.13.1)

 * No changes since rc.1

Changes in [0.13.1-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.1-rc.1) (2018-08-16)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.0...v0.13.1-rc.1)

 * Update from Weblate.
   [\#2121](https://github.com/matrix-org/matrix-react-sdk/pull/2121)
 * Shift to M_RESOURCE_LIMIT_EXCEEDED errors
   [\#2120](https://github.com/matrix-org/matrix-react-sdk/pull/2120)
 * Fix RoomSettings test
   [\#2119](https://github.com/matrix-org/matrix-react-sdk/pull/2119)
 * Show room version number in room settings
   [\#2117](https://github.com/matrix-org/matrix-react-sdk/pull/2117)
 * Warning bar for MAU limit hit
   [\#2114](https://github.com/matrix-org/matrix-react-sdk/pull/2114)
 * Recognise server notices room(s)
   [\#2112](https://github.com/matrix-org/matrix-react-sdk/pull/2112)
 * Update room tags behaviour to match spec more
   [\#2111](https://github.com/matrix-org/matrix-react-sdk/pull/2111)
 * while logging out ignore `Session.logged_out` as it is intentional
   [\#2058](https://github.com/matrix-org/matrix-react-sdk/pull/2058)
 * Don't show 'connection lost' bar on MAU error
   [\#2110](https://github.com/matrix-org/matrix-react-sdk/pull/2110)
 * Support MAU error on sync
   [\#2108](https://github.com/matrix-org/matrix-react-sdk/pull/2108)
 * Support active user limit on message send
   [\#2106](https://github.com/matrix-org/matrix-react-sdk/pull/2106)
 * Run end to end tests as part of Travis build
   [\#2091](https://github.com/matrix-org/matrix-react-sdk/pull/2091)
 * Remove package-lock.json for now
   [\#2097](https://github.com/matrix-org/matrix-react-sdk/pull/2097)
 * Support montly active user limit error on /login
   [\#2103](https://github.com/matrix-org/matrix-react-sdk/pull/2103)
 * Unpin sanitize-html
   [\#2105](https://github.com/matrix-org/matrix-react-sdk/pull/2105)
 * Pin sanitize-html to 0.18.2
   [\#2101](https://github.com/matrix-org/matrix-react-sdk/pull/2101)
 * Make clicking on side panels close settings (mk 3)
   [\#2096](https://github.com/matrix-org/matrix-react-sdk/pull/2096)
 * Fix persistent element location not updating
   [\#2092](https://github.com/matrix-org/matrix-react-sdk/pull/2092)
 * fix Devtools input autofocus && state traversal when len === 1 && key=""
   [\#2090](https://github.com/matrix-org/matrix-react-sdk/pull/2090)
 * allow autocompleting Emoji by common aliases, e.g :+1: to :thumbsup:
   [\#2085](https://github.com/matrix-org/matrix-react-sdk/pull/2085)

Changes in [0.13.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.0) (2018-07-30)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.0-rc.2...v0.13.0)

 * Fix composer bug where cursor position would change when Riot regained focus
   [\#2093](https://github.com/matrix-org/matrix-react-sdk/pull/2093)
 * Fix persistend element location not updating
   [\#2094](https://github.com/matrix-org/matrix-react-sdk/pull/2094)
 * Slate Fixes 42?
   [\#2089](https://github.com/matrix-org/matrix-react-sdk/pull/2089)

Changes in [0.13.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.0-rc.2) (2018-07-24)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.13.0-rc.1...v0.13.0-rc.2)

 * Take jitsi conf calling out of labs
   [\#2087](https://github.com/matrix-org/matrix-react-sdk/pull/2087)

Changes in [0.13.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.13.0-rc.1) (2018-07-24)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.9...v0.13.0-rc.1)

 * Update from Weblate.
   [\#2086](https://github.com/matrix-org/matrix-react-sdk/pull/2086)
 * Moar Slate Fixes
   [\#2082](https://github.com/matrix-org/matrix-react-sdk/pull/2082)
 * Destroy the widget when its permission is revoked
   [\#2081](https://github.com/matrix-org/matrix-react-sdk/pull/2081)
 * Make ActiveWidgetStore clear persistent widgets
   [\#2084](https://github.com/matrix-org/matrix-react-sdk/pull/2084)
 * CreateRoomDialog is rendered before getting the config default_federate
   [\#2078](https://github.com/matrix-org/matrix-react-sdk/pull/2078)
 * Slate Fixes
   [\#2076](https://github.com/matrix-org/matrix-react-sdk/pull/2076)
 * FIX: Don't error on rooms the user has left already
   [\#2077](https://github.com/matrix-org/matrix-react-sdk/pull/2077)
 * Fix persistent apps being the wrong size
   [\#2080](https://github.com/matrix-org/matrix-react-sdk/pull/2080)
 * Fix widgets resetting when going to the top-left
   [\#2079](https://github.com/matrix-org/matrix-react-sdk/pull/2079)
 * Jitsi: Use integrations URL from config
   [\#2062](https://github.com/matrix-org/matrix-react-sdk/pull/2062)
 * Allow jitsi in e2e rooms
   [\#2075](https://github.com/matrix-org/matrix-react-sdk/pull/2075)
 * Fix border around persisted widgets
   [\#2071](https://github.com/matrix-org/matrix-react-sdk/pull/2071)
 * Fix e2e icons floating above jitsi
   [\#2073](https://github.com/matrix-org/matrix-react-sdk/pull/2073)
 * hide some commands after space as they have special semantics
   [\#2074](https://github.com/matrix-org/matrix-react-sdk/pull/2074)
 * Even More Slate Fixes :D
   [\#2070](https://github.com/matrix-org/matrix-react-sdk/pull/2070)
 * Improve UX for Jitsi by adding local echo for widgets
   [\#2035](https://github.com/matrix-org/matrix-react-sdk/pull/2035)
 * Jitsi: Check integrations server before call
   [\#2063](https://github.com/matrix-org/matrix-react-sdk/pull/2063)
 * Jitsi: Error message on no permission
   [\#2061](https://github.com/matrix-org/matrix-react-sdk/pull/2061)
 * Fix read receipts on top of Jitsi
   [\#2065](https://github.com/matrix-org/matrix-react-sdk/pull/2065)
 * Moar Slate Fixes
   [\#2069](https://github.com/matrix-org/matrix-react-sdk/pull/2069)
 * fix 2nd typo in one PR :(
   [\#2068](https://github.com/matrix-org/matrix-react-sdk/pull/2068)
 * check if has some completions, not if >=0
   [\#2067](https://github.com/matrix-org/matrix-react-sdk/pull/2067)
 * Slate fixes
   [\#2066](https://github.com/matrix-org/matrix-react-sdk/pull/2066)
 *  Implement always-on-screen capability for widgets
   [\#2056](https://github.com/matrix-org/matrix-react-sdk/pull/2056)
 * simplify MessageComposerStore and improve its performance
   [\#2064](https://github.com/matrix-org/matrix-react-sdk/pull/2064)
 * Replace Draft with Slate
   [\#1890](https://github.com/matrix-org/matrix-react-sdk/pull/1890)
 * Fix not stopping to peek when navigating away from peeked room
   [\#2055](https://github.com/matrix-org/matrix-react-sdk/pull/2055)
 * T3chguy/slate cont2
   [\#2049](https://github.com/matrix-org/matrix-react-sdk/pull/2049)
 * add null-guard for stickerpickerWidget in StickerPicker
   [\#2057](https://github.com/matrix-org/matrix-react-sdk/pull/2057)
 * Implement always-on-screen capability for widgets
   [\#2053](https://github.com/matrix-org/matrix-react-sdk/pull/2053)
 * fix nullguard on EventTile, getComponent never returns falsey, it throws
   [\#2024](https://github.com/matrix-org/matrix-react-sdk/pull/2024)
 * Fix stickerpicker PersistedElement usage
   [\#2051](https://github.com/matrix-org/matrix-react-sdk/pull/2051)
 * encrypt for invited users if history visibility allows.
   [\#2042](https://github.com/matrix-org/matrix-react-sdk/pull/2042)
 * move nag bar clear statement to any desktop notif toggle not just 0->1
   [\#2031](https://github.com/matrix-org/matrix-react-sdk/pull/2031)
 * use TruncatedList to prevent rendering hundreds/thousands of DOM nodes
   [\#2041](https://github.com/matrix-org/matrix-react-sdk/pull/2041)
 * Fix stuff
   [\#2047](https://github.com/matrix-org/matrix-react-sdk/pull/2047)
 * Show m.room.server_acl
   [\#2046](https://github.com/matrix-org/matrix-react-sdk/pull/2046)

Changes in [0.12.9](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.9) (2018-07-09)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.9-rc.2...v0.12.9)

 * No changes since rc.1

Changes in [0.12.9-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.9-rc.2) (2018-07-06)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.9-rc.1...v0.12.9-rc.2)

 * Implement aggregation by error type for tracked decryption failures
   [\#2045](https://github.com/matrix-org/matrix-react-sdk/pull/2045)
 * make new hiding of roomsublist behaviour opt-in
   [\#2044](https://github.com/matrix-org/matrix-react-sdk/pull/2044)
 * Implement aggregation by error type for tracked decryption failures
   [\#2043](https://github.com/matrix-org/matrix-react-sdk/pull/2043)
 * make new hiding of roomsublist behaviour opt-in
   [\#2030](https://github.com/matrix-org/matrix-react-sdk/pull/2030)

Changes in [0.12.9-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.9-rc.1) (2018-07-04)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.8...v0.12.9-rc.1)

 * Update from Weblate.
   [\#2040](https://github.com/matrix-org/matrix-react-sdk/pull/2040)
 * Import react as React in src/components/views/messages/MStickerBody.js
   [\#2039](https://github.com/matrix-org/matrix-react-sdk/pull/2039)
 * Import react as React in src/GroupAddressPicker.js
   [\#2038](https://github.com/matrix-org/matrix-react-sdk/pull/2038)
 * Give PersistedElement a key
   [\#2036](https://github.com/matrix-org/matrix-react-sdk/pull/2036)
 * Revert " make click to insert nick work on join/parts, /me's etc"
   [\#2034](https://github.com/matrix-org/matrix-react-sdk/pull/2034)
 * Track an event name when tracking a decryption failure
   [\#2033](https://github.com/matrix-org/matrix-react-sdk/pull/2033)
 * warn on self-mute
   [\#1974](https://github.com/matrix-org/matrix-react-sdk/pull/1974)
 *  make click to insert nick work on join/parts, /me's etc
   [\#1945](https://github.com/matrix-org/matrix-react-sdk/pull/1945)
 * Fix layout bug introduced by #2025
   [\#2029](https://github.com/matrix-org/matrix-react-sdk/pull/2029)
 * Fix room topics/names resetting when UserSetting re-renders
   [\#2028](https://github.com/matrix-org/matrix-react-sdk/pull/2028)
 * Improve tracking of UISIs
   [\#2027](https://github.com/matrix-org/matrix-react-sdk/pull/2027)
 * Replace share icons
   [\#2026](https://github.com/matrix-org/matrix-react-sdk/pull/2026)
 * Improve status bar errors (namely the consent error)
   [\#2025](https://github.com/matrix-org/matrix-react-sdk/pull/2025)
 * Fix incorrectly positioned copy button on `<pre>` blocks
   [\#2023](https://github.com/matrix-org/matrix-react-sdk/pull/2023)
 * Redact pathnames with origin `file://`
   [\#2018](https://github.com/matrix-org/matrix-react-sdk/pull/2018)
 * Update package-lock.json
   [\#2022](https://github.com/matrix-org/matrix-react-sdk/pull/2022)
 * on room sub list badge click goto first relevant room
   [\#2021](https://github.com/matrix-org/matrix-react-sdk/pull/2021)
 * improve linkifier AGAIN
   [\#2020](https://github.com/matrix-org/matrix-react-sdk/pull/2020)
 * fix historical section
   [\#2016](https://github.com/matrix-org/matrix-react-sdk/pull/2016)
 * Fix RoomSubList headers by re-commiting 1faecfd
   [\#2014](https://github.com/matrix-org/matrix-react-sdk/pull/2014)
 * don't fire share dialog when clicking timestamp of event,
   [\#2017](https://github.com/matrix-org/matrix-react-sdk/pull/2017)
 * Revert "affix copyButton so that it doesn't get scrolled horizontally"
   [\#2013](https://github.com/matrix-org/matrix-react-sdk/pull/2013)
 * when the user switches room, close room settings
   [\#2019](https://github.com/matrix-org/matrix-react-sdk/pull/2019)
 * Refactor widgets code
   [\#2015](https://github.com/matrix-org/matrix-react-sdk/pull/2015)
 * Login local errors for blank fields
   [\#2009](https://github.com/matrix-org/matrix-react-sdk/pull/2009)
 * Update lolex to 2.7.0
   [\#1917](https://github.com/matrix-org/matrix-react-sdk/pull/1917)
 * Improve Linkifier
   [\#2011](https://github.com/matrix-org/matrix-react-sdk/pull/2011)
 * use enum constants for EventStatus and correct isSent check
   [\#2010](https://github.com/matrix-org/matrix-react-sdk/pull/2010)
 * accent insensitive autocomplete
   [\#2007](https://github.com/matrix-org/matrix-react-sdk/pull/2007)
 * default to not showing url previews in e2ee rooms.
   [\#2001](https://github.com/matrix-org/matrix-react-sdk/pull/2001)
 * allow chaining right click contextmenus
   [\#1999](https://github.com/matrix-org/matrix-react-sdk/pull/1999)
 * hide empty roomsublists when filtering via search/tagpanel
   [\#1954](https://github.com/matrix-org/matrix-react-sdk/pull/1954)
 * prevent user,room,group autocomplete firing mid-word
   [\#2012](https://github.com/matrix-org/matrix-react-sdk/pull/2012)
 * fix instances of composer not getting/regaining focus
   [\#2008](https://github.com/matrix-org/matrix-react-sdk/pull/2008)
 * notif panel fixes
   [\#2006](https://github.com/matrix-org/matrix-react-sdk/pull/2006)
 * factor out conditional LanguageSelector as functional component
   [\#2003](https://github.com/matrix-org/matrix-react-sdk/pull/2003)
 * Autocomplete and Pillify Communities
   [\#1993](https://github.com/matrix-org/matrix-react-sdk/pull/1993)
 * Very basic Jitsi integration
   [\#1971](https://github.com/matrix-org/matrix-react-sdk/pull/1971)
 * add additional classes which protect the text from overflowing
   [\#1994](https://github.com/matrix-org/matrix-react-sdk/pull/1994)
 * Upload File confirmation modal steals focus, send it back to composer
   [\#1992](https://github.com/matrix-org/matrix-react-sdk/pull/1992)
 * delint MImageBody, fixes anonymous class and hyphenated style keys which
   made react cry
   [\#1991](https://github.com/matrix-org/matrix-react-sdk/pull/1991)
 * allow using tab to navigate room list in a smarter way
   [\#1977](https://github.com/matrix-org/matrix-react-sdk/pull/1977)
 * fix no displayname usersettings
   [\#1990](https://github.com/matrix-org/matrix-react-sdk/pull/1990)
 * trigger TagTile context menu on right click
   [\#1989](https://github.com/matrix-org/matrix-react-sdk/pull/1989)
 * hide already chosen results from AddressPickerDialog
   [\#2000](https://github.com/matrix-org/matrix-react-sdk/pull/2000)
 * delint ChatCreateOrReuseDialog
   [\#2002](https://github.com/matrix-org/matrix-react-sdk/pull/2002)
 * fix set password & email flow possible to get stuck and onBlur murdering
   your email
   [\#1982](https://github.com/matrix-org/matrix-react-sdk/pull/1982)

Changes in [0.12.8](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.8) (2018-06-29)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.8-rc.2...v0.12.8)

 * Revert "affix copyButton so that it doesn't get scrolled horizontally"
   [\#2013](https://github.com/matrix-org/matrix-react-sdk/pull/2013)
 * don't fire share dialog when clicking timestamp of event
   [\#2017](https://github.com/matrix-org/matrix-react-sdk/pull/2017)
 * when the user switches room, close room settings
   [\#2019](https://github.com/matrix-org/matrix-react-sdk/pull/2019)

Changes in [0.12.8-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.8-rc.2) (2018-06-22)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.8-rc.1...v0.12.8-rc.2)

 * slash got consumed in the consolidation
   [\#1998](https://github.com/matrix-org/matrix-react-sdk/pull/1998)

Changes in [0.12.8-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.8-rc.1) (2018-06-21)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.7...v0.12.8-rc.1)

 * Update from Weblate.
   [\#1997](https://github.com/matrix-org/matrix-react-sdk/pull/1997)
 * refactor, consolidate and improve SlashCommands
   [\#1988](https://github.com/matrix-org/matrix-react-sdk/pull/1988)
 * Take replies out of labs!
   [\#1996](https://github.com/matrix-org/matrix-react-sdk/pull/1996)
 * re-merge reset PR
   [\#1987](https://github.com/matrix-org/matrix-react-sdk/pull/1987)
 * once command has a space, strict match instead of fuzzy match
   [\#1985](https://github.com/matrix-org/matrix-react-sdk/pull/1985)
 * Fix matrix.to URL RegExp
   [\#1986](https://github.com/matrix-org/matrix-react-sdk/pull/1986)
 * Fix blank sticker picker
   [\#1984](https://github.com/matrix-org/matrix-react-sdk/pull/1984)
 * fix e2ee file/media stuff
   [\#1972](https://github.com/matrix-org/matrix-react-sdk/pull/1972)
 * right click for room tile context menu
   [\#1978](https://github.com/matrix-org/matrix-react-sdk/pull/1978)
 * only show m.room.message in FilePanel
   [\#1983](https://github.com/matrix-org/matrix-react-sdk/pull/1983)
 * improve command provider
   [\#1981](https://github.com/matrix-org/matrix-react-sdk/pull/1981)
 * affix copyButton so that it doesn't get scrolled horizontally
   [\#1980](https://github.com/matrix-org/matrix-react-sdk/pull/1980)
 * split continuation if there is a gap in conversation
   [\#1979](https://github.com/matrix-org/matrix-react-sdk/pull/1979)
 * fix a bunch of instances of react console spam
   [\#1973](https://github.com/matrix-org/matrix-react-sdk/pull/1973)
 * Track decryption success/failure rate with piwik
   [\#1949](https://github.com/matrix-org/matrix-react-sdk/pull/1949)
 * route matrix.to/#/+... links internally (not just group ids)
   [\#1975](https://github.com/matrix-org/matrix-react-sdk/pull/1975)
 * implement `hitting enter after Ctrl-K should switch to the first result`
   [\#1976](https://github.com/matrix-org/matrix-react-sdk/pull/1976)
 * Remove tag panel feature flag
   [\#1970](https://github.com/matrix-org/matrix-react-sdk/pull/1970)
 * QuestionDialog pass hasCancelButton to DialogButtons
   [\#1968](https://github.com/matrix-org/matrix-react-sdk/pull/1968)
 * check type before msgtype in the case of `m.sticker` with msgtype
   [\#1965](https://github.com/matrix-org/matrix-react-sdk/pull/1965)
 * apply roomlist searchFilter to aliases if it begins with a `#`
   [\#1957](https://github.com/matrix-org/matrix-react-sdk/pull/1957)
 * Share Dialog
   [\#1948](https://github.com/matrix-org/matrix-react-sdk/pull/1948)
 * make RoomTooltip generic and add ContextMenu&Tooltip to GroupInviteTile
   [\#1950](https://github.com/matrix-org/matrix-react-sdk/pull/1950)
 *  Fix widgets re-appearing after being deleted
   [\#1958](https://github.com/matrix-org/matrix-react-sdk/pull/1958)
 * Fix crash on unspecified thumbnail info, and handle gracefully
   [\#1967](https://github.com/matrix-org/matrix-react-sdk/pull/1967)
 * fix styling of clearButton when its not there
   [\#1964](https://github.com/matrix-org/matrix-react-sdk/pull/1964)
 *  Implement slightly magical CSS soln. to thumbnail sizing
   [\#1912](https://github.com/matrix-org/matrix-react-sdk/pull/1912)
 * Select audio output for WebRTC
   [\#1932](https://github.com/matrix-org/matrix-react-sdk/pull/1932)
 * move css rule to be more generic; remove overriden rule
   [\#1962](https://github.com/matrix-org/matrix-react-sdk/pull/1962)
 * improve tag panel accessibility and remove a no-op dispatch
   [\#1960](https://github.com/matrix-org/matrix-react-sdk/pull/1960)
 * Revert "Fix exception when opening dev tools"
   [\#1963](https://github.com/matrix-org/matrix-react-sdk/pull/1963)
 * fix message appears unencrypted while encrypting and not_sent
   [\#1959](https://github.com/matrix-org/matrix-react-sdk/pull/1959)
 * Fix exception when opening dev tools
   [\#1961](https://github.com/matrix-org/matrix-react-sdk/pull/1961)
 * show redacted stickers like other redacted messages
   [\#1956](https://github.com/matrix-org/matrix-react-sdk/pull/1956)
 * add mx_filterFlipColor to mx_MemberInfo_cancel img
   [\#1951](https://github.com/matrix-org/matrix-react-sdk/pull/1951)
 * don't set the displayname on registration as Synapse now does it
   [\#1953](https://github.com/matrix-org/matrix-react-sdk/pull/1953)
 * allow CreateRoom to scale properly horizontally
   [\#1955](https://github.com/matrix-org/matrix-react-sdk/pull/1955)
 * Keep context menus that extend downwards vertically on screen
   [\#1952](https://github.com/matrix-org/matrix-react-sdk/pull/1952)
 * re-run checkIfAlone if a member change occurred in the active room
   [\#1947](https://github.com/matrix-org/matrix-react-sdk/pull/1947)
 * Persist pinned message open-ness between room switches
   [\#1935](https://github.com/matrix-org/matrix-react-sdk/pull/1935)
 * Pinned message cosmetic improvements
   [\#1933](https://github.com/matrix-org/matrix-react-sdk/pull/1933)
 * Update sinon to 5.0.7
   [\#1916](https://github.com/matrix-org/matrix-react-sdk/pull/1916)
 * re-run checkIfAlone if a member change occurred in the active room
   [\#1946](https://github.com/matrix-org/matrix-react-sdk/pull/1946)
 * Replace "Login as guest" with "Try the app first" on login page
   [\#1937](https://github.com/matrix-org/matrix-react-sdk/pull/1937)
 * kill stream when using gUM for permission to device labels to turn off
   camera
   [\#1931](https://github.com/matrix-org/matrix-react-sdk/pull/1931)

Changes in [0.12.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.7) (2018-06-12)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.7-rc.1...v0.12.7)

 * No changes since rc.1

Changes in [0.12.7-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.7-rc.1) (2018-06-06)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.6...v0.12.7-rc.1)

 * Update from Weblate.
   [\#1944](https://github.com/matrix-org/matrix-react-sdk/pull/1944)
 * Import react as React in src/components/views/elements/DNDTagTile.js
   [\#1943](https://github.com/matrix-org/matrix-react-sdk/pull/1943)
 * Fix click on faded left/right/middle panel -> close settings
   [\#1940](https://github.com/matrix-org/matrix-react-sdk/pull/1940)
 * Add null-guard to support browsers that don't support performance
   [\#1942](https://github.com/matrix-org/matrix-react-sdk/pull/1942)
 * Support third party integration managers in AppPermission
   [\#1455](https://github.com/matrix-org/matrix-react-sdk/pull/1455)
 * Update pinned messages in real time
   [\#1934](https://github.com/matrix-org/matrix-react-sdk/pull/1934)
 * Expose at-room power level setting
   [\#1938](https://github.com/matrix-org/matrix-react-sdk/pull/1938)

Changes in [0.12.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.6) (2018-05-25)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.6-rc.1...v0.12.6)

 * No changes since v0.12.6-rc.1

Changes in [0.12.6-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.6-rc.1) (2018-05-24)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.5...v0.12.6-rc.1)

 * Add a "reload widget" button.
   [\#1920](https://github.com/matrix-org/matrix-react-sdk/pull/1920)
 * Make devTools styling more consistent and easier to edit event data.
   [\#1923](https://github.com/matrix-org/matrix-react-sdk/pull/1923)
 * Update from Weblate.
   [\#1930](https://github.com/matrix-org/matrix-react-sdk/pull/1930)
 * Cookie bar update
   [\#1929](https://github.com/matrix-org/matrix-react-sdk/pull/1929)
 * Message for leaving server notices room
   [\#1928](https://github.com/matrix-org/matrix-react-sdk/pull/1928)
 * More thorough check of IM URL validity.
   [\#1927](https://github.com/matrix-org/matrix-react-sdk/pull/1927)
 * Add usage data link to cookie bar
   [\#1926](https://github.com/matrix-org/matrix-react-sdk/pull/1926)
 * Change wording and appearance of Deactivate Account dialog
   [\#1925](https://github.com/matrix-org/matrix-react-sdk/pull/1925)
 * fix membership list ordering when presence is disabled.
   [\#1924](https://github.com/matrix-org/matrix-react-sdk/pull/1924)
 * Implement erasure option upon deactivation
   [\#1922](https://github.com/matrix-org/matrix-react-sdk/pull/1922)
 * Add cookie warning to widget warning (AppPermission)
   [\#1921](https://github.com/matrix-org/matrix-react-sdk/pull/1921)
 * Terms and Conditions dialog
   [\#1919](https://github.com/matrix-org/matrix-react-sdk/pull/1919)
 * improve privileged section users in room settings
   [\#1902](https://github.com/matrix-org/matrix-react-sdk/pull/1902)
 * Space between sentences in 'leave room' warning
   [\#1918](https://github.com/matrix-org/matrix-react-sdk/pull/1918)
 * Specify valid address types to "Start a chat" dialog
   [\#1908](https://github.com/matrix-org/matrix-react-sdk/pull/1908)
 * Implement opt-in analytics with cookie bar
   [\#1906](https://github.com/matrix-org/matrix-react-sdk/pull/1906)
 * Fix vector-im/riot-web#6523 Emoji rendering destroys paragraphs
   [\#1910](https://github.com/matrix-org/matrix-react-sdk/pull/1910)

Changes in [0.12.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.5) (2018-05-17)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4...v0.12.5)

 * Fix image size jumping regression
   [\#1909](https://github.com/matrix-org/matrix-react-sdk/pull/1909)

Changes in [0.12.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4) (2018-05-16)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4-rc.6...v0.12.4)

 * No changes from rc.5

Changes in [0.12.4-rc.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4-rc.6) (2018-05-15)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4-rc.5...v0.12.4-rc.6)

 * Wait for deletion of widgets as well addition
   [\#1907](https://github.com/matrix-org/matrix-react-sdk/pull/1907)

Changes in [0.12.4-rc.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4-rc.5) (2018-05-15)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4-rc.4...v0.12.4-rc.5)

 * Wait for echo from server when adding user widgets
   [\#1905](https://github.com/matrix-org/matrix-react-sdk/pull/1905)

Changes in [0.12.4-rc.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4-rc.4) (2018-05-14)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4-rc.3...v0.12.4-rc.4)

 * Update from Weblate.
   [\#1904](https://github.com/matrix-org/matrix-react-sdk/pull/1904)
 * Correctly identify sticker picker widgets
   [\#1894](https://github.com/matrix-org/matrix-react-sdk/pull/1894)
 * Quick fix for sticker picker position
   [\#1903](https://github.com/matrix-org/matrix-react-sdk/pull/1903)
 * Remove redundant logging (currently shown on every render when no sti…
   [\#1901](https://github.com/matrix-org/matrix-react-sdk/pull/1901)
 * Fix stickers briefly being 2x the size
   [\#1899](https://github.com/matrix-org/matrix-react-sdk/pull/1899)
 * Send required properties when making requests to widgets over postMessage
   [\#1891](https://github.com/matrix-org/matrix-react-sdk/pull/1891)
 * Fix room widget second load infini spinner
   [\#1897](https://github.com/matrix-org/matrix-react-sdk/pull/1897)
 * Update widget state when account data changes
   [\#1896](https://github.com/matrix-org/matrix-react-sdk/pull/1896)
 * Remove margins when in a ReplyThread to stop them taking so much space
   [\#1882](https://github.com/matrix-org/matrix-react-sdk/pull/1882)
 * Add setting to enable widget screenshots (if widgets declare support)
   [\#1892](https://github.com/matrix-org/matrix-react-sdk/pull/1892)
 * T3chguy/replies html tag
   [\#1889](https://github.com/matrix-org/matrix-react-sdk/pull/1889)
 * Instant Sticker Picker
   [\#1888](https://github.com/matrix-org/matrix-react-sdk/pull/1888)
 * Update widget 'widgetData' key to 'data' to match spec.
   [\#1887](https://github.com/matrix-org/matrix-react-sdk/pull/1887)
 * Fix 'state_key' field name.
   [\#1886](https://github.com/matrix-org/matrix-react-sdk/pull/1886)
 * Improve appearance of short-lived app loading spinner
   [\#1885](https://github.com/matrix-org/matrix-react-sdk/pull/1885)
 * Take feature_sticker_messagse out of labs
   [\#1883](https://github.com/matrix-org/matrix-react-sdk/pull/1883)
 * Fix issue incorrect positioning with widget loading indicator
   [\#1884](https://github.com/matrix-org/matrix-react-sdk/pull/1884)
 * Users should always be able to edit their user/non-room  widgets
   [\#1879](https://github.com/matrix-org/matrix-react-sdk/pull/1879)

Changes in [0.12.4-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4-rc.3) (2018-05-11)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4-rc.2...v0.12.4-rc.3)

 * Instant Sticker Picker :zap:
   [\#1888](https://github.com/matrix-org/matrix-react-sdk/pull/1888)

Changes in [0.12.4-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4-rc.2) (2018-05-09)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.4-rc.1...v0.12.4-rc.2)

 * Improve appearance of short-lived widget loading spinner
 * Make sticker picker fully-fledged feature
 * Fix incorrect positioning with widget loading indicator

Changes in [0.12.4-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.4-rc.1) (2018-05-09)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.3...v0.12.4-rc.1)

 * Update from Weblate.
   [\#1881](https://github.com/matrix-org/matrix-react-sdk/pull/1881)
 * Pin lolex at 2.3.2 to avoid bug causing tests to fail
   [\#1880](https://github.com/matrix-org/matrix-react-sdk/pull/1880)
 * Replies: un-break click-to-mention on SenderProfile for reply&preview
   [\#1878](https://github.com/matrix-org/matrix-react-sdk/pull/1878)
 * Add tests for RoomList
   [\#1877](https://github.com/matrix-org/matrix-react-sdk/pull/1877)
 * Fix crash when browser doesn't report page change measurement
   [\#1874](https://github.com/matrix-org/matrix-react-sdk/pull/1874)
 * fix thinko when changing from ClientPeg to context in static method (DUH)
   [\#1875](https://github.com/matrix-org/matrix-react-sdk/pull/1875)
 * Fix Replies :D
   [\#1873](https://github.com/matrix-org/matrix-react-sdk/pull/1873)
 * Update eslint-plugin-react
   [\#1871](https://github.com/matrix-org/matrix-react-sdk/pull/1871)
 * relax lint for jsx-curly-spacing and arrow-parens
   [\#1872](https://github.com/matrix-org/matrix-react-sdk/pull/1872)
 * Use develop js-sdk in jenkins build
   [\#1870](https://github.com/matrix-org/matrix-react-sdk/pull/1870)
 * Replies
   [\#1741](https://github.com/matrix-org/matrix-react-sdk/pull/1741)
 * Use the right js-sdk branch when testing
   [\#1869](https://github.com/matrix-org/matrix-react-sdk/pull/1869)
 * Prevent error responses wedging group request concurrency limit
   [\#1867](https://github.com/matrix-org/matrix-react-sdk/pull/1867)
 * Refresh group rooms and members when selecting a tag
   [\#1868](https://github.com/matrix-org/matrix-react-sdk/pull/1868)
 * Refactor GroupStores into one global GroupStore
   [\#1866](https://github.com/matrix-org/matrix-react-sdk/pull/1866)
 * Switch back to using blob URLs for rendering e2e attachments
   [\#1864](https://github.com/matrix-org/matrix-react-sdk/pull/1864)
 * Hide inline encryption icons except when hovering over a message
   [\#1845](https://github.com/matrix-org/matrix-react-sdk/pull/1845)
 *  UI fixes in SessionRestoreErrorDialog
   [\#1860](https://github.com/matrix-org/matrix-react-sdk/pull/1860)
 *  Fix UX issues with bug report dialog
   [\#1863](https://github.com/matrix-org/matrix-react-sdk/pull/1863)
 * fix ugly img errors and correctly render SVG thumbnails
   [\#1865](https://github.com/matrix-org/matrix-react-sdk/pull/1865)
 * Fix error handling on session restore
   [\#1859](https://github.com/matrix-org/matrix-react-sdk/pull/1859)
 * Add tests for GroupView
   [\#1862](https://github.com/matrix-org/matrix-react-sdk/pull/1862)
 * Update version of hoek
   [\#1861](https://github.com/matrix-org/matrix-react-sdk/pull/1861)
 *  Fix bug that caused crash when analytics HS/IS whitelists not specified
   [\#1858](https://github.com/matrix-org/matrix-react-sdk/pull/1858)
 * Fix Analytics to not import DEFAULTS, therefore avoiding NPE
   [\#1857](https://github.com/matrix-org/matrix-react-sdk/pull/1857)
 * Null check piwik config before using it
   [\#1856](https://github.com/matrix-org/matrix-react-sdk/pull/1856)
 * Track actual window location origin and hash
   [\#1853](https://github.com/matrix-org/matrix-react-sdk/pull/1853)
 * Replace document.origin with window.location.origin
   [\#1855](https://github.com/matrix-org/matrix-react-sdk/pull/1855)
 * Optionally hide widget popout button.
   [\#1854](https://github.com/matrix-org/matrix-react-sdk/pull/1854)
 * Add a button to 'pop out' widgets in to their own tab.
   [\#1851](https://github.com/matrix-org/matrix-react-sdk/pull/1851)

Changes in [0.12.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.3) (2018-04-30)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.3-rc.3...v0.12.3)

 * No changes since rc.3

Changes in [0.12.3-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.3-rc.3) (2018-04-26)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.3-rc.2...v0.12.3-rc.3)

 * Replace document.origin with window.location.origin
   [\#1855](https://github.com/matrix-org/matrix-react-sdk/pull/1855)

Changes in [0.12.3-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.3-rc.2) (2018-04-25)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.3-rc.1...v0.12.3-rc.2)

 * Fix npm packaging

Changes in [0.12.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.3-rc.1) (2018-04-25)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.2...v0.12.3-rc.1)

 * Update from Weblate.
   [\#1852](https://github.com/matrix-org/matrix-react-sdk/pull/1852)
 * Support origin lock in cross-origin renderer
   [\#1849](https://github.com/matrix-org/matrix-react-sdk/pull/1849)
 * s/contian/contain/g
   [\#1850](https://github.com/matrix-org/matrix-react-sdk/pull/1850)
 * Don't autocomplete users for single "@"
   [\#1848](https://github.com/matrix-org/matrix-react-sdk/pull/1848)
 * Update from Weblate.
   [\#1844](https://github.com/matrix-org/matrix-react-sdk/pull/1844)
 * Bind onImageError in constructor
   [\#1846](https://github.com/matrix-org/matrix-react-sdk/pull/1846)
 * Use mxid as sender name on set display name
   [\#1841](https://github.com/matrix-org/matrix-react-sdk/pull/1841)
 * Fix rageshake
   [\#1840](https://github.com/matrix-org/matrix-react-sdk/pull/1840)
 * Add UI for displaying room avatars full size
   [\#1843](https://github.com/matrix-org/matrix-react-sdk/pull/1843)
 * Update from Weblate.
   [\#1842](https://github.com/matrix-org/matrix-react-sdk/pull/1842)
 * move everything not explicitly riot (or status) branded into matrix-react-
   sdk
   [\#1836](https://github.com/matrix-org/matrix-react-sdk/pull/1836)
 * Null check node before we pass it to velocity
   [\#1838](https://github.com/matrix-org/matrix-react-sdk/pull/1838)
 * Remove presence management
   [\#1676](https://github.com/matrix-org/matrix-react-sdk/pull/1676)
 * Null check stylesheet href
   [\#1835](https://github.com/matrix-org/matrix-react-sdk/pull/1835)
 * TopUnreadMessagesBar a11y
   [\#1819](https://github.com/matrix-org/matrix-react-sdk/pull/1819)
 * Use correct 1-1 room avatar after users leave
   [\#593](https://github.com/matrix-org/matrix-react-sdk/pull/593)
 * Use GeminiScrollbarWrapper in Flair settings of UserSettings
   [\#1833](https://github.com/matrix-org/matrix-react-sdk/pull/1833)
 * Add 500ms delay to show `membershipBusy` for longer
   [\#1832](https://github.com/matrix-org/matrix-react-sdk/pull/1832)
 * Improve group join/leave feedback
   [\#1831](https://github.com/matrix-org/matrix-react-sdk/pull/1831)
 * Update from Weblate.
   [\#1830](https://github.com/matrix-org/matrix-react-sdk/pull/1830)
 * Bump source-map-loader version to avoid bug /w inline base64 maps
   [\#1829](https://github.com/matrix-org/matrix-react-sdk/pull/1829)
 * Make stickers/messages continuations of each other
   [\#1828](https://github.com/matrix-org/matrix-react-sdk/pull/1828)
 * Update to match is_openly_joinable API
   [\#1827](https://github.com/matrix-org/matrix-react-sdk/pull/1827)
 * Fix to prevent guests from seeing features
   [\#1826](https://github.com/matrix-org/matrix-react-sdk/pull/1826)
 * Fix broken ForgotPassword component
   [\#1825](https://github.com/matrix-org/matrix-react-sdk/pull/1825)
 * Fix warning "Unknown prop `wrappedRef` on <div> tag..."
   [\#1824](https://github.com/matrix-org/matrix-react-sdk/pull/1824)
 * Add radio button for setting group is_joinable
   [\#1817](https://github.com/matrix-org/matrix-react-sdk/pull/1817)
 * Fix widget grant / revoke permission binding
   [\#1823](https://github.com/matrix-org/matrix-react-sdk/pull/1823)
 * Sticker picker styling
   [\#1822](https://github.com/matrix-org/matrix-react-sdk/pull/1822)
 * Bi-directional widget postMessaging API (stickerpacks) [WIP]
   [\#1672](https://github.com/matrix-org/matrix-react-sdk/pull/1672)
 * Add null-guard to prevent RoomAvatar NPE when room is null
   [\#1821](https://github.com/matrix-org/matrix-react-sdk/pull/1821)
 * Don't notify for bad encrypted messages
   [\#1818](https://github.com/matrix-org/matrix-react-sdk/pull/1818)
 * Join this community button
   [\#1815](https://github.com/matrix-org/matrix-react-sdk/pull/1815)
 * Reword group setting delay
   [\#1816](https://github.com/matrix-org/matrix-react-sdk/pull/1816)
 * Track duration of page changes
   [\#1814](https://github.com/matrix-org/matrix-react-sdk/pull/1814)
 * Wrap GeminiScrollbar in a component, enabled forceGemini
   [\#1810](https://github.com/matrix-org/matrix-react-sdk/pull/1810)
 * Add display name to the read receipt view
   [\#1742](https://github.com/matrix-org/matrix-react-sdk/pull/1742)
 * Fix broken import preventing people tag
   [\#1811](https://github.com/matrix-org/matrix-react-sdk/pull/1811)
 * Add /devtools to Autocomplete and run gen-i18n
   [\#1778](https://github.com/matrix-org/matrix-react-sdk/pull/1778)
 * Fix PresenceLabel in MemberInfo
   [\#1809](https://github.com/matrix-org/matrix-react-sdk/pull/1809)
 * Fix room tile badge not disappearing when receiving a read receipt
   [\#1807](https://github.com/matrix-org/matrix-react-sdk/pull/1807)
 * Option to remove the presence feature by HS
   [\#1806](https://github.com/matrix-org/matrix-react-sdk/pull/1806)
 * Dialog a11y
   [\#1652](https://github.com/matrix-org/matrix-react-sdk/pull/1652)
 * Change wording of debug log submission
   [\#1740](https://github.com/matrix-org/matrix-react-sdk/pull/1740)
 * Fix TextualBody.js to remove NodeList.forEach()
   [\#1768](https://github.com/matrix-org/matrix-react-sdk/pull/1768)
 * Use undocumented piwik cmd to disable heartbeattimer
   [\#1770](https://github.com/matrix-org/matrix-react-sdk/pull/1770)
 * Enable autocompletion for non-English languages.
   [\#1800](https://github.com/matrix-org/matrix-react-sdk/pull/1800)

Changes in [0.12.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.2) (2018-04-12)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.1...v0.12.2)

 * Null check stylesheet href
  [\#1835](https://github.com/matrix-org/matrix-react-sdk/pull/1835)
 * Remove the presence management labs feature

Changes in [0.12.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.1) (2018-04-11)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0...v0.12.1)

 * Use correct js-sdk version

Changes in [0.12.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0) (2018-04-11)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.7...v0.12.0)

 * Further improve group joining/leaving feedback
  [\#1832](https://github.com/matrix-org/matrix-react-sdk/pull/1832)
 * Cosmetic changes to Communities button

Changes in [0.12.0-rc.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.7) (2018-04-10)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.6...v0.12.0-rc.7)

 * Reword group setting delay
  [\#1816](https://github.com/matrix-org/matrix-react-sdk/pull/1816)
 * Improve group joining/leaving feedback
  [\#1831](https://github.com/matrix-org/matrix-react-sdk/pull/1831)

Changes in [0.12.0-rc.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.6) (2018-04-09)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.5...v0.12.0-rc.6)

 * Fix group join button not appearing

Changes in [0.12.0-rc.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.5) (2018-04-09)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.4...v0.12.0-rc.5)

 * Added radio button to set group join policy
 * Fix to prevent guests from accessing lab features
 * Fix broken forgot password page
 * Fix crash when joining a room after peeking

Changes in [0.12.0-rc.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.4) (2018-03-22)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.3...v0.12.0-rc.4)

 * Fix broken import preventing people tag
   [\#1811](https://github.com/matrix-org/matrix-react-sdk/pull/1811)

Changes in [0.12.0-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.3) (2018-03-20)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.2...v0.12.0-rc.3)

 * Fix room tile badge not disappearing when receiving a read receipt
   [\#1807](https://github.com/matrix-org/matrix-react-sdk/pull/1807)

Changes in [0.12.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.2) (2018-03-19)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.12.0-rc.1...v0.12.0-rc.2)

 * Take TagPanel out of labs
   [\#1805](https://github.com/matrix-org/matrix-react-sdk/pull/1805)

Changes in [0.12.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.12.0-rc.1) (2018-03-19)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.4...v0.12.0-rc.1)

 * Remove the message on migrating crypto data
   [\#1803](https://github.com/matrix-org/matrix-react-sdk/pull/1803)
 * Update from Weblate.
   [\#1804](https://github.com/matrix-org/matrix-react-sdk/pull/1804)
 * Improve room list performance when receiving messages
   [\#1801](https://github.com/matrix-org/matrix-react-sdk/pull/1801)
 * Add change delay warning in GroupView settings
   [\#1802](https://github.com/matrix-org/matrix-react-sdk/pull/1802)
 * Only use `dangerouslySetInnerHTML` for HTML messages
   [\#1799](https://github.com/matrix-org/matrix-react-sdk/pull/1799)
 * Limit group requests to 3 at once
   [\#1798](https://github.com/matrix-org/matrix-react-sdk/pull/1798)
 * Show GroupMemberList after inviting a group member
   [\#1796](https://github.com/matrix-org/matrix-react-sdk/pull/1796)
 * Fix syntax fail
   [\#1794](https://github.com/matrix-org/matrix-react-sdk/pull/1794)
 * Use TintableSvg for TagPanel clear filter button
   [\#1793](https://github.com/matrix-org/matrix-react-sdk/pull/1793)
 * Fix missing space between "...is a" and user ID
   [\#1792](https://github.com/matrix-org/matrix-react-sdk/pull/1792)
 * E2E "fudge-button"
   [\#1791](https://github.com/matrix-org/matrix-react-sdk/pull/1791)
 * Remove spurious console.trace
   [\#1790](https://github.com/matrix-org/matrix-react-sdk/pull/1790)
 * Don't reset the presence timer on every dispatch
   [\#1789](https://github.com/matrix-org/matrix-react-sdk/pull/1789)
 * Potentially fix a memory leak in FlairStore
   [\#1788](https://github.com/matrix-org/matrix-react-sdk/pull/1788)
 * Implement transparent RoomTile for use in some places
   [\#1785](https://github.com/matrix-org/matrix-react-sdk/pull/1785)
 * Fix varying default group avatar colour for given group
   [\#1784](https://github.com/matrix-org/matrix-react-sdk/pull/1784)
 * Fix bug where avatar change not reflected in LLP
   [\#1783](https://github.com/matrix-org/matrix-react-sdk/pull/1783)
 * Workaround for atlassian/react-beautiful-dnd#273
   [\#1782](https://github.com/matrix-org/matrix-react-sdk/pull/1782)
 * Add setting to disable TagPanel
   [\#1781](https://github.com/matrix-org/matrix-react-sdk/pull/1781)
 * [DO NOT MERGE] Tests proven to fail
   [\#1780](https://github.com/matrix-org/matrix-react-sdk/pull/1780)
 * Fix room power level settings
   [\#1779](https://github.com/matrix-org/matrix-react-sdk/pull/1779)
 * fix shouldHideEvent saying an event is a leave/join when a profile ch…
   [\#1769](https://github.com/matrix-org/matrix-react-sdk/pull/1769)
 * Add "Did you know:..." microcopy to groups view
   [\#1777](https://github.com/matrix-org/matrix-react-sdk/pull/1777)
 * Give emptySubListTip a container for correct bg colour
   [\#1753](https://github.com/matrix-org/matrix-react-sdk/pull/1753)
 * Do proper null-checks on decypted events to fix NPEs
   [\#1776](https://github.com/matrix-org/matrix-react-sdk/pull/1776)
 * Reorder the RoomListStore lists on Event.decrypted
   [\#1775](https://github.com/matrix-org/matrix-react-sdk/pull/1775)
 * Fix bug where global "Never send to unverified..." is ignored
   [\#1772](https://github.com/matrix-org/matrix-react-sdk/pull/1772)
 * Fix bug that prevented tint updates
   [\#1767](https://github.com/matrix-org/matrix-react-sdk/pull/1767)
 * Fix group member spinner being out of flex order
   [\#1765](https://github.com/matrix-org/matrix-react-sdk/pull/1765)
 * Allow widget iframes to request camera and microphone permissions.
   [\#1766](https://github.com/matrix-org/matrix-react-sdk/pull/1766)
 * Change icon from "R" to "X"
   [\#1764](https://github.com/matrix-org/matrix-react-sdk/pull/1764)
 * Regenerate room lists on Room event
   [\#1762](https://github.com/matrix-org/matrix-react-sdk/pull/1762)
 *  Fix DMs being marked as with the current user ("me")
   [\#1761](https://github.com/matrix-org/matrix-react-sdk/pull/1761)
 * Make RoomListStore aware of Room.timeline events
   [\#1756](https://github.com/matrix-org/matrix-react-sdk/pull/1756)
 * improve origin check of ScalarMessaging postmessage API.
   [\#1760](https://github.com/matrix-org/matrix-react-sdk/pull/1760)
 * Implement global filter to deselect all tags
   [\#1759](https://github.com/matrix-org/matrix-react-sdk/pull/1759)
 * Don't show empty custom tags when filtering tags
   [\#1758](https://github.com/matrix-org/matrix-react-sdk/pull/1758)
 * Do not assume that tags have been removed
   [\#1757](https://github.com/matrix-org/matrix-react-sdk/pull/1757)
 * Change CSS class for message panel spinner
   [\#1747](https://github.com/matrix-org/matrix-react-sdk/pull/1747)
 * Remove RoomListStore listener
   [\#1752](https://github.com/matrix-org/matrix-react-sdk/pull/1752)
 * Implement GroupTile avatar dragging to TagPanel
   [\#1751](https://github.com/matrix-org/matrix-react-sdk/pull/1751)
 * Fix custom tags not being ordered manually
   [\#1750](https://github.com/matrix-org/matrix-react-sdk/pull/1750)
 * Store component state for editors
   [\#1746](https://github.com/matrix-org/matrix-react-sdk/pull/1746)
 * Give the login page its spinner back
   [\#1745](https://github.com/matrix-org/matrix-react-sdk/pull/1745)
 * Add context menu to TagTile
   [\#1743](https://github.com/matrix-org/matrix-react-sdk/pull/1743)
 * If a tag is unrecognised, assume manual ordering
   [\#1748](https://github.com/matrix-org/matrix-react-sdk/pull/1748)
 * Move RoomList state to RoomListStore
   [\#1719](https://github.com/matrix-org/matrix-react-sdk/pull/1719)
 * Move groups button to TagPanel
   [\#1744](https://github.com/matrix-org/matrix-react-sdk/pull/1744)
 * Add seconds to timestamp on hover
   [\#1738](https://github.com/matrix-org/matrix-react-sdk/pull/1738)
 * Do not truncate autocompleted users in composer
   [\#1739](https://github.com/matrix-org/matrix-react-sdk/pull/1739)
 * RoomView: guard against unmounting during peeking
   [\#1737](https://github.com/matrix-org/matrix-react-sdk/pull/1737)
 * Fix HS/IS URL reset when switching to Registration
   [\#1736](https://github.com/matrix-org/matrix-react-sdk/pull/1736)
 * Fix the reject/accept call buttons in canary (mk2)
   [\#1734](https://github.com/matrix-org/matrix-react-sdk/pull/1734)
 * Make ratelimitedfunc time from the function's end
   [\#1731](https://github.com/matrix-org/matrix-react-sdk/pull/1731)
 * Give dialogs a matrixClient context
   [\#1735](https://github.com/matrix-org/matrix-react-sdk/pull/1735)
 * Fix key bindings in address picker dialog
   [\#1732](https://github.com/matrix-org/matrix-react-sdk/pull/1732)
 * Try upgrading eslint-plugin-react
   [\#1712](https://github.com/matrix-org/matrix-react-sdk/pull/1712)
 * Fix display name change text
   [\#1730](https://github.com/matrix-org/matrix-react-sdk/pull/1730)
 * Persist contentState when sending SlashCommand via MessageComposerInput
   [\#1721](https://github.com/matrix-org/matrix-react-sdk/pull/1721)
 * This is actually MFileBody not MImageBody, change classname
   [\#1726](https://github.com/matrix-org/matrix-react-sdk/pull/1726)
 * Use invite_3pid prop of createRoom instead of manual invite after create
   [\#1717](https://github.com/matrix-org/matrix-react-sdk/pull/1717)
 * guard against m.room.aliases events with no keys (redaction?)
   [\#1729](https://github.com/matrix-org/matrix-react-sdk/pull/1729)
 * Fix not showing Invited section if all invites are 3PID
   [\#1718](https://github.com/matrix-org/matrix-react-sdk/pull/1718)
 * Fix Rich Replies on files
   [\#1720](https://github.com/matrix-org/matrix-react-sdk/pull/1720)
 * Update from Weblate.
   [\#1728](https://github.com/matrix-org/matrix-react-sdk/pull/1728)
 * Null guard against falsey (non-null) props.node, to make react happy
   [\#1724](https://github.com/matrix-org/matrix-react-sdk/pull/1724)
 * Use correct condition for getting account data after first sync
   [\#1722](https://github.com/matrix-org/matrix-react-sdk/pull/1722)
 * Fix order calculation logic when reordering a room
   [\#1725](https://github.com/matrix-org/matrix-react-sdk/pull/1725)
 * Linear Rich Quoting
   [\#1715](https://github.com/matrix-org/matrix-react-sdk/pull/1715)
 * Fix CreateGroupDialog issues
   [\#1714](https://github.com/matrix-org/matrix-react-sdk/pull/1714)
 * Show a warning if the user attempts to leave a room that is invite only
   [\#1713](https://github.com/matrix-org/matrix-react-sdk/pull/1713)
 * Swap RoomList to react-beautiful-dnd
   [\#1711](https://github.com/matrix-org/matrix-react-sdk/pull/1711)
 * don't pass back {} when we have no `org.matrix.room.color_scheme`
   [\#1710](https://github.com/matrix-org/matrix-react-sdk/pull/1710)
 * Don't paginate whilst decrypting events
   [\#1700](https://github.com/matrix-org/matrix-react-sdk/pull/1700)
 * Fall back for missing i18n plurals
   [\#1699](https://github.com/matrix-org/matrix-react-sdk/pull/1699)
 * Fix group store redundant requests
   [\#1709](https://github.com/matrix-org/matrix-react-sdk/pull/1709)
 * Ignore remote echos caused by this client
   [\#1708](https://github.com/matrix-org/matrix-react-sdk/pull/1708)
 * Replace TagPanel react-dnd with react-beautiful-dnd
   [\#1705](https://github.com/matrix-org/matrix-react-sdk/pull/1705)
 * Only set selected tags state when updating rooms
   [\#1704](https://github.com/matrix-org/matrix-react-sdk/pull/1704)
 * Add formatFullDateNoTime to DateUtils and stop passing 12/24h to DateSep
   [\#1702](https://github.com/matrix-org/matrix-react-sdk/pull/1702)
 * Fix autofocus on QuestionDialog
   [\#1698](https://github.com/matrix-org/matrix-react-sdk/pull/1698)
 * Iterative fixes on Rich Quoting
   [\#1697](https://github.com/matrix-org/matrix-react-sdk/pull/1697)
 * Fix missing negation
   [\#1696](https://github.com/matrix-org/matrix-react-sdk/pull/1696)
 * Add Analytics Info and add Piwik to SdkConfig.DEFAULTS
   [\#1625](https://github.com/matrix-org/matrix-react-sdk/pull/1625)
 * Attempt to re-register for a scalar token if ours is invalid
   [\#1668](https://github.com/matrix-org/matrix-react-sdk/pull/1668)
 * Normalise dialogs
   [\#1674](https://github.com/matrix-org/matrix-react-sdk/pull/1674)
 * Add 'send without verifying' to status bar
   [\#1695](https://github.com/matrix-org/matrix-react-sdk/pull/1695)
 * Implement Rich Quoting/Replies
   [\#1660](https://github.com/matrix-org/matrix-react-sdk/pull/1660)
 * Revert "MD-escape URLs/alises/user IDs prior to parsing markdown"
   [\#1694](https://github.com/matrix-org/matrix-react-sdk/pull/1694)
 * Cache isConfCallRoom
   [\#1693](https://github.com/matrix-org/matrix-react-sdk/pull/1693)
 * Improve performance of tag panel selection (when tags are selected)
   [\#1687](https://github.com/matrix-org/matrix-react-sdk/pull/1687)
 * Hide status bar on visible->hidden transition
   [\#1680](https://github.com/matrix-org/matrix-react-sdk/pull/1680)
 * [revived] Singularise unsent message prompt, if applicable
   [\#1692](https://github.com/matrix-org/matrix-react-sdk/pull/1692)
 * small refactor && warn on self-demotion
   [\#1683](https://github.com/matrix-org/matrix-react-sdk/pull/1683)
 * Remove use of deprecated React.PropTypes
   [\#1677](https://github.com/matrix-org/matrix-react-sdk/pull/1677)
 * only save RelatedGroupSettings if it was modified. Otherwise perms issue
   [\#1691](https://github.com/matrix-org/matrix-react-sdk/pull/1691)
 * Fix a couple more issues with granular settings
   [\#1675](https://github.com/matrix-org/matrix-react-sdk/pull/1675)
 * Allow argument to op slashcommand to be negative as PLs can be -ve
   [\#1673](https://github.com/matrix-org/matrix-react-sdk/pull/1673)
 * Update from Weblate.
   [\#1645](https://github.com/matrix-org/matrix-react-sdk/pull/1645)
 * make RoomDetailRow reusable for the Room Directory
   [\#1624](https://github.com/matrix-org/matrix-react-sdk/pull/1624)
 * Prefetch group data for all joined groups when RoomList mounts
   [\#1686](https://github.com/matrix-org/matrix-react-sdk/pull/1686)
 * Remove unused selectedRoom prop
   [\#1690](https://github.com/matrix-org/matrix-react-sdk/pull/1690)
 * Fix shift and shift-ctrl click in TagPanel
   [\#1684](https://github.com/matrix-org/matrix-react-sdk/pull/1684)
 * skip direct chats which either you or the target have left
   [\#1344](https://github.com/matrix-org/matrix-react-sdk/pull/1344)
 * Make scroll on paste in RTE compatible with https://github.com/vector-im
   /riot-web/pull/5900
   [\#1682](https://github.com/matrix-org/matrix-react-sdk/pull/1682)
 * Remove extra full stop
   [\#1685](https://github.com/matrix-org/matrix-react-sdk/pull/1685)
 * Dedupe requests to fetch group profile data
   [\#1666](https://github.com/matrix-org/matrix-react-sdk/pull/1666)
 * Get Group profile from TagTile instead of TagPanel
   [\#1667](https://github.com/matrix-org/matrix-react-sdk/pull/1667)
 *  Fix leaking of GroupStore listeners in RoomList
   [\#1664](https://github.com/matrix-org/matrix-react-sdk/pull/1664)
 * Add option to also output untranslated string
   [\#1658](https://github.com/matrix-org/matrix-react-sdk/pull/1658)
 * Give the current theme to widgets and the integration manager
   [\#1669](https://github.com/matrix-org/matrix-react-sdk/pull/1669)
 * Fixes #1953 Allow multiple file uploads using drag & drop for RoomView
   [\#1671](https://github.com/matrix-org/matrix-react-sdk/pull/1671)
 * Fix issue with preview of phone number on register and waiting for sms code
   confirmation code
   [\#1670](https://github.com/matrix-org/matrix-react-sdk/pull/1670)
 * Attempt to improve TagPanel performance
   [\#1647](https://github.com/matrix-org/matrix-react-sdk/pull/1647)
 * Fix one variant of a scroll jump that occurs when decrypting an m.text
   [\#1656](https://github.com/matrix-org/matrix-react-sdk/pull/1656)
 * Avoid NPEs by using ref method for collecting loggedInView in MatrixChat
   [\#1665](https://github.com/matrix-org/matrix-react-sdk/pull/1665)
 * DnD Ordered TagPanel
   [\#1653](https://github.com/matrix-org/matrix-react-sdk/pull/1653)
 * Update widget title on edit.
   [\#1663](https://github.com/matrix-org/matrix-react-sdk/pull/1663)
 * Set widget title
   [\#1661](https://github.com/matrix-org/matrix-react-sdk/pull/1661)
 * Display custom widget content titles
   [\#1650](https://github.com/matrix-org/matrix-react-sdk/pull/1650)
 * Add maximize / minimize apps drawer icons.
   [\#1649](https://github.com/matrix-org/matrix-react-sdk/pull/1649)
 * Warn when migrating e2e data to indexeddb
   [\#1654](https://github.com/matrix-org/matrix-react-sdk/pull/1654)
 * Don't Auto-show UnknownDeviceDialog
   [\#1600](https://github.com/matrix-org/matrix-react-sdk/pull/1600)
 * Remove logging.
   [\#1655](https://github.com/matrix-org/matrix-react-sdk/pull/1655)
 * Add messaging endpoint for room encryption status.
   [\#1648](https://github.com/matrix-org/matrix-react-sdk/pull/1648)
 * Add some missing translatable strings
   [\#1588](https://github.com/matrix-org/matrix-react-sdk/pull/1588)
 * Add widget -> riot postMessage API
   [\#1640](https://github.com/matrix-org/matrix-react-sdk/pull/1640)
 * Add some null checks
   [\#1646](https://github.com/matrix-org/matrix-react-sdk/pull/1646)
 * Implement shift-click and ctrl-click semantics for TP
   [\#1641](https://github.com/matrix-org/matrix-react-sdk/pull/1641)
 * Don't show group when clicking tag panel
   [\#1642](https://github.com/matrix-org/matrix-react-sdk/pull/1642)
 * Implement TagPanel (or LeftLeftPanel) for group filtering
   [\#1639](https://github.com/matrix-org/matrix-react-sdk/pull/1639)
 * Implement UI for using bulk device deletion API
   [\#1638](https://github.com/matrix-org/matrix-react-sdk/pull/1638)
 * Replace (IRC) with flair
   [\#1637](https://github.com/matrix-org/matrix-react-sdk/pull/1637)
 * Allow guests to view individual groups
   [\#1635](https://github.com/matrix-org/matrix-react-sdk/pull/1635)
 * Allow guest to see MyGroups, show ILAG when creating a group
   [\#1636](https://github.com/matrix-org/matrix-react-sdk/pull/1636)
 * Move group publication toggles to UserSettings
   [\#1634](https://github.com/matrix-org/matrix-react-sdk/pull/1634)
 * Pull the theme through the default process
   [\#1617](https://github.com/matrix-org/matrix-react-sdk/pull/1617)
 * Rebase ConfirmRedactDialog on QuestionDialog
   [\#1630](https://github.com/matrix-org/matrix-react-sdk/pull/1630)
 * Fix logging of missing substitution variables
   [\#1629](https://github.com/matrix-org/matrix-react-sdk/pull/1629)
 * Rename Related Groups to improve readability
   [\#1632](https://github.com/matrix-org/matrix-react-sdk/pull/1632)
 * Make PresenceLabel more easily translatable
   [\#1616](https://github.com/matrix-org/matrix-react-sdk/pull/1616)
 * Perform substitution on all parts, not just the last one
   [\#1618](https://github.com/matrix-org/matrix-react-sdk/pull/1618)
 * Send Access Token in Headers to help prevent it being spit out in errors
   [\#1552](https://github.com/matrix-org/matrix-react-sdk/pull/1552)
 * Add aria-labels to ActionButtons
   [\#1628](https://github.com/matrix-org/matrix-react-sdk/pull/1628)
 * MemberPresenceAvatar: fix null references
   [\#1620](https://github.com/matrix-org/matrix-react-sdk/pull/1620)
 * Disable presence controls if there's no presence
   [\#1623](https://github.com/matrix-org/matrix-react-sdk/pull/1623)
 * Fix GroupMemberList search for users without displayname
   [\#1627](https://github.com/matrix-org/matrix-react-sdk/pull/1627)
 * Remove redundant super class EventEmitter for FlairStore
   [\#1626](https://github.com/matrix-org/matrix-react-sdk/pull/1626)
 * Fix granular URL previews
   [\#1622](https://github.com/matrix-org/matrix-react-sdk/pull/1622)
 * Flairstore: Fix broken reference
   [\#1619](https://github.com/matrix-org/matrix-react-sdk/pull/1619)
 * Do something more sensible for sender profile name/aux opacity
   [\#1615](https://github.com/matrix-org/matrix-react-sdk/pull/1615)
 * Add eslint rule keyword-spacing
   [\#1614](https://github.com/matrix-org/matrix-react-sdk/pull/1614)
 * Fix various issues surrounding granular settings to date
   [\#1613](https://github.com/matrix-org/matrix-react-sdk/pull/1613)
 * differentiate between state events and message events
   [\#1612](https://github.com/matrix-org/matrix-react-sdk/pull/1612)
 * Refactor translations
   [\#1608](https://github.com/matrix-org/matrix-react-sdk/pull/1608)
 * Make TintableSvg links behave like normal image links
   [\#1611](https://github.com/matrix-org/matrix-react-sdk/pull/1611)
 * Fix linting errors.
   [\#1610](https://github.com/matrix-org/matrix-react-sdk/pull/1610)
 * Granular settings
   [\#1516](https://github.com/matrix-org/matrix-react-sdk/pull/1516)
 * Implement user-controlled presence
   [\#1482](https://github.com/matrix-org/matrix-react-sdk/pull/1482)
 * Edit widget icon styling
   [\#1609](https://github.com/matrix-org/matrix-react-sdk/pull/1609)
 * Attempt to improve textual power levels
   [\#1607](https://github.com/matrix-org/matrix-react-sdk/pull/1607)
 * Determine whether power level is custom once Roles have been determined
   [\#1606](https://github.com/matrix-org/matrix-react-sdk/pull/1606)
 * Status.im theme
   [\#1605](https://github.com/matrix-org/matrix-react-sdk/pull/1605)
 * Revert "Lowercase all usernames"
   [\#1604](https://github.com/matrix-org/matrix-react-sdk/pull/1604)

Changes in [0.11.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.4) (2018-02-09)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.3...v0.11.4)

 * Add isUrlPermitted function to sanity check URLs

Changes in [0.11.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.3) (2017-12-04)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.2...v0.11.3)

 * Bump js-sdk version to pull in fix for [setting room publicity in a group](https://github.com/matrix-org/matrix-js-sdk/commit/aa3201ebb0fff5af2fb733080aa65ed1f7213de6).

Changes in [0.11.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.2) (2017-11-28)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.1...v0.11.2)

 * Ignore unrecognised login flows
   [\#1633](https://github.com/matrix-org/matrix-react-sdk/pull/1633)

Changes in [0.11.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.1) (2017-11-17)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.0...v0.11.1)

 * Fix the force TURN option
   [\#1621](https://github.com/matrix-org/matrix-react-sdk/pull/1621)

Changes in [0.11.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.0) (2017-11-15)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.0-rc.3...v0.11.0)


Changes in [0.11.0-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.0-rc.3) (2017-11-14)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.0-rc.2...v0.11.0-rc.3)


Changes in [0.11.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.0-rc.2) (2017-11-10)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.11.0-rc.1...v0.11.0-rc.2)

 * Make groups a fully-fleged baked-in feature
   [\#1603](https://github.com/matrix-org/matrix-react-sdk/pull/1603)

Changes in [0.11.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.11.0-rc.1) (2017-11-10)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.7...v0.11.0-rc.1)

 * Improve widget rendering on prop updates
   [\#1548](https://github.com/matrix-org/matrix-react-sdk/pull/1548)
 * Display group member profile (avatar/displayname) in ConfirmUserActionDialog
   [\#1595](https://github.com/matrix-org/matrix-react-sdk/pull/1595)
 * Don't crash if there isn't a room notif rule
   [\#1602](https://github.com/matrix-org/matrix-react-sdk/pull/1602)
 * Show group name in flair tooltip if one is set
   [\#1596](https://github.com/matrix-org/matrix-react-sdk/pull/1596)
 * Convert group avatar URL to HTTP before handing to BaseAvatar
   [\#1597](https://github.com/matrix-org/matrix-react-sdk/pull/1597)
 * Add group features as starting points for ILAG
   [\#1601](https://github.com/matrix-org/matrix-react-sdk/pull/1601)
 * Modify the group room visibility API to reflect the js-sdk changes
   [\#1598](https://github.com/matrix-org/matrix-react-sdk/pull/1598)
 * Update from Weblate.
   [\#1599](https://github.com/matrix-org/matrix-react-sdk/pull/1599)
 * Revert "UnknownDeviceDialog: get devices from SDK"
   [\#1594](https://github.com/matrix-org/matrix-react-sdk/pull/1594)
 * Order users in the group member list with admins first
   [\#1591](https://github.com/matrix-org/matrix-react-sdk/pull/1591)
 * Fetch group members after accepting an invite
   [\#1592](https://github.com/matrix-org/matrix-react-sdk/pull/1592)
 * Improve address picker for rooms
   [\#1589](https://github.com/matrix-org/matrix-react-sdk/pull/1589)
 * Fix FlairStore getPublicisedGroupsCached to give the correct, existing
   promise
   [\#1590](https://github.com/matrix-org/matrix-react-sdk/pull/1590)
 * Use the getProfileInfo API for group inviter profile
   [\#1585](https://github.com/matrix-org/matrix-react-sdk/pull/1585)
 * Add checkbox to GroupAddressPicker for determining visibility of group rooms
   [\#1587](https://github.com/matrix-org/matrix-react-sdk/pull/1587)
 * Alter group member api
   [\#1581](https://github.com/matrix-org/matrix-react-sdk/pull/1581)
 * Improve group creation UX
   [\#1580](https://github.com/matrix-org/matrix-react-sdk/pull/1580)
 * Disable RoomDetailList in GroupView when editing
   [\#1583](https://github.com/matrix-org/matrix-react-sdk/pull/1583)
 * Default to no read pins if there is no applicable account data
   [\#1586](https://github.com/matrix-org/matrix-react-sdk/pull/1586)
 * UnknownDeviceDialog: get devices from SDK
   [\#1584](https://github.com/matrix-org/matrix-react-sdk/pull/1584)
 * Add a small indicator for when a new event is pinned
   [\#1486](https://github.com/matrix-org/matrix-react-sdk/pull/1486)
 * Implement tooltip for group rooms
   [\#1582](https://github.com/matrix-org/matrix-react-sdk/pull/1582)
 * Room notifs in autocomplete & composer
   [\#1577](https://github.com/matrix-org/matrix-react-sdk/pull/1577)
 * Ignore img tags in HTML if src is not specified
   [\#1579](https://github.com/matrix-org/matrix-react-sdk/pull/1579)
 * Indicate admins in the group member list with a sheriff badge
   [\#1578](https://github.com/matrix-org/matrix-react-sdk/pull/1578)
 * Remember whether widget drawer was hidden per-room
   [\#1533](https://github.com/matrix-org/matrix-react-sdk/pull/1533)
 * Throw an error when trying to create a group store with falsey groupId
   [\#1576](https://github.com/matrix-org/matrix-react-sdk/pull/1576)
 * Fixes React warning
   [\#1571](https://github.com/matrix-org/matrix-react-sdk/pull/1571)
 * Fix Flair not appearing due to missing this._usersInFlight
   [\#1575](https://github.com/matrix-org/matrix-react-sdk/pull/1575)
 * Use, if possible, a room's canonical or first alias when viewing the …
   [\#1574](https://github.com/matrix-org/matrix-react-sdk/pull/1574)
 * Add CSS classes to group ID input in CreateGroupDialog
   [\#1573](https://github.com/matrix-org/matrix-react-sdk/pull/1573)
 * Give autocomplete providers the room they're in
   [\#1568](https://github.com/matrix-org/matrix-react-sdk/pull/1568)
 * Fix multiple pills on one line
   [\#1572](https://github.com/matrix-org/matrix-react-sdk/pull/1572)
 * Fix group invites such that they look similar to room invites
   [\#1570](https://github.com/matrix-org/matrix-react-sdk/pull/1570)
 * Add a GeminiScrollbar to Your Communities
   [\#1569](https://github.com/matrix-org/matrix-react-sdk/pull/1569)
 * Fix multiple requests for publicised groups of given user
   [\#1567](https://github.com/matrix-org/matrix-react-sdk/pull/1567)
 * Add toggle to alter visibility of a room-group association
   [\#1566](https://github.com/matrix-org/matrix-react-sdk/pull/1566)
 * Pillify room notifs in the timeline
   [\#1564](https://github.com/matrix-org/matrix-react-sdk/pull/1564)
 *  Implement simple GroupRoomInfo
   [\#1563](https://github.com/matrix-org/matrix-react-sdk/pull/1563)
 * turn NPE on flair resolution errors into a logged error
   [\#1565](https://github.com/matrix-org/matrix-react-sdk/pull/1565)
 * Less translation in parts
   [\#1484](https://github.com/matrix-org/matrix-react-sdk/pull/1484)
 * Redact group IDs from analytics
   [\#1562](https://github.com/matrix-org/matrix-react-sdk/pull/1562)
 * Display whether the group summary/room list is loading
   [\#1560](https://github.com/matrix-org/matrix-react-sdk/pull/1560)
 * Change client-side validation of group IDs to match synapse
   [\#1558](https://github.com/matrix-org/matrix-react-sdk/pull/1558)
 * Prevent non-members from opening group settings
   [\#1559](https://github.com/matrix-org/matrix-react-sdk/pull/1559)
 * Alter UI for disinviting a group member
   [\#1556](https://github.com/matrix-org/matrix-react-sdk/pull/1556)
 * Only show admin tools to privileged users
   [\#1555](https://github.com/matrix-org/matrix-react-sdk/pull/1555)
 * Try lowercase username on login
   [\#1550](https://github.com/matrix-org/matrix-react-sdk/pull/1550)
 * Don't refresh page on password change prompt
   [\#1554](https://github.com/matrix-org/matrix-react-sdk/pull/1554)
 * Fix initial in GroupAvatar in GroupView
   [\#1553](https://github.com/matrix-org/matrix-react-sdk/pull/1553)
 * Use "crop" method to scale group avatars in MyGroups
   [\#1549](https://github.com/matrix-org/matrix-react-sdk/pull/1549)
 * Lowercase all usernames
   [\#1547](https://github.com/matrix-org/matrix-react-sdk/pull/1547)
 * Add sensible missing entry generator for MELS tests
   [\#1546](https://github.com/matrix-org/matrix-react-sdk/pull/1546)
 * Fix prompt to re-use chat room
   [\#1545](https://github.com/matrix-org/matrix-react-sdk/pull/1545)
 * Add unregiseterListener to GroupStore
   [\#1544](https://github.com/matrix-org/matrix-react-sdk/pull/1544)
 * Fix groups invited users err for non members
   [\#1543](https://github.com/matrix-org/matrix-react-sdk/pull/1543)
 * Add Mention button to MemberInfo
   [\#1532](https://github.com/matrix-org/matrix-react-sdk/pull/1532)
 * Only show group settings cog to members
   [\#1541](https://github.com/matrix-org/matrix-react-sdk/pull/1541)
 * Use correct icon for group room deletion and make themeable
   [\#1540](https://github.com/matrix-org/matrix-react-sdk/pull/1540)
 * Add invite button to MemberInfo if user has left or wasn't in room
   [\#1534](https://github.com/matrix-org/matrix-react-sdk/pull/1534)
 * Add option to mirror local video feed
   [\#1539](https://github.com/matrix-org/matrix-react-sdk/pull/1539)
 * Use the correct userId when displaying who redacted a message
   [\#1538](https://github.com/matrix-org/matrix-react-sdk/pull/1538)
 * Only show editing UI for aliases/related_groups for users /w power
   [\#1529](https://github.com/matrix-org/matrix-react-sdk/pull/1529)
 * Swap from `ui_opacity` to `panel_disabled`
   [\#1535](https://github.com/matrix-org/matrix-react-sdk/pull/1535)
 * Fix room address picker tiles default name
   [\#1536](https://github.com/matrix-org/matrix-react-sdk/pull/1536)
 * T3chguy/hide level change on 50
   [\#1531](https://github.com/matrix-org/matrix-react-sdk/pull/1531)
 * fix missing date sep caused by hidden event at start of day
   [\#1537](https://github.com/matrix-org/matrix-react-sdk/pull/1537)
 * Add a delete confirmation dialog for widgets
   [\#1520](https://github.com/matrix-org/matrix-react-sdk/pull/1520)
 * When dispatching view_[my_]group[s], reset RoomViewStore
   [\#1530](https://github.com/matrix-org/matrix-react-sdk/pull/1530)
 * Prevent editing of UI requiring user privilege if user unprivileged
   [\#1528](https://github.com/matrix-org/matrix-react-sdk/pull/1528)
 * Use the correct property of the API room objects
   [\#1526](https://github.com/matrix-org/matrix-react-sdk/pull/1526)
 * Don't include the |other in the translation value
   [\#1527](https://github.com/matrix-org/matrix-react-sdk/pull/1527)
 * Re-run gen-i18n after fixing https://github.com/matrix-org/matrix-react-
   sdk/pull/1521
   [\#1525](https://github.com/matrix-org/matrix-react-sdk/pull/1525)
 * Fix some react warnings in GroupMemberList
   [\#1522](https://github.com/matrix-org/matrix-react-sdk/pull/1522)
 * Fix bug with gen-i18n/js when adding new plurals
   [\#1521](https://github.com/matrix-org/matrix-react-sdk/pull/1521)
 * Make GroupStoreCache global for cross-package access
   [\#1524](https://github.com/matrix-org/matrix-react-sdk/pull/1524)
 * Add fields needed by RoomDetailList to groupRoomFromApiObject
   [\#1523](https://github.com/matrix-org/matrix-react-sdk/pull/1523)
 * Only show flair for groups with avatars set
   [\#1519](https://github.com/matrix-org/matrix-react-sdk/pull/1519)
 * Refresh group member lists after inviting users
   [\#1518](https://github.com/matrix-org/matrix-react-sdk/pull/1518)
 * Invalidate the user's public groups cache when changing group publicity
   [\#1517](https://github.com/matrix-org/matrix-react-sdk/pull/1517)
 * Make the gen-i18n script validate _t calls
   [\#1515](https://github.com/matrix-org/matrix-react-sdk/pull/1515)
 * Add placeholder to MyGroups page, adjust CSS classes
   [\#1514](https://github.com/matrix-org/matrix-react-sdk/pull/1514)
 * Rxl881/parallelshell
   [\#1338](https://github.com/matrix-org/matrix-react-sdk/pull/1338)
 * Run prunei18n
   [\#1513](https://github.com/matrix-org/matrix-react-sdk/pull/1513)
 * Update from Weblate.
   [\#1512](https://github.com/matrix-org/matrix-react-sdk/pull/1512)
 * Add script to prune unused translations
   [\#1502](https://github.com/matrix-org/matrix-react-sdk/pull/1502)
 * Fix creation of DM rooms
   [\#1510](https://github.com/matrix-org/matrix-react-sdk/pull/1510)
 * Group create dialog: only enter localpart
   [\#1507](https://github.com/matrix-org/matrix-react-sdk/pull/1507)
 * Improve MyGroups UI
   [\#1509](https://github.com/matrix-org/matrix-react-sdk/pull/1509)
 * Use object URLs to load Files in to images
   [\#1508](https://github.com/matrix-org/matrix-react-sdk/pull/1508)
 * Add clientside error for non-alphanumeric group ID
   [\#1506](https://github.com/matrix-org/matrix-react-sdk/pull/1506)
 * Fix invites to groups without names
   [\#1505](https://github.com/matrix-org/matrix-react-sdk/pull/1505)
 * Add warning when adding group rooms/users
   [\#1504](https://github.com/matrix-org/matrix-react-sdk/pull/1504)
 * More Groups->Communities
   [\#1503](https://github.com/matrix-org/matrix-react-sdk/pull/1503)
 * Groups -> Communities
   [\#1501](https://github.com/matrix-org/matrix-react-sdk/pull/1501)
 * Factor out Flair cache into FlairStore
   [\#1500](https://github.com/matrix-org/matrix-react-sdk/pull/1500)
 * Add i18n script to package.json
   [\#1499](https://github.com/matrix-org/matrix-react-sdk/pull/1499)
 * Make gen-i18n support 'HTML'
   [\#1498](https://github.com/matrix-org/matrix-react-sdk/pull/1498)
 * fix editing visuals on groupview header
   [\#1497](https://github.com/matrix-org/matrix-react-sdk/pull/1497)
 * Script to generate the translations base file
   [\#1493](https://github.com/matrix-org/matrix-react-sdk/pull/1493)
 * Update from Weblate.
   [\#1495](https://github.com/matrix-org/matrix-react-sdk/pull/1495)
 * Attempt to relate a group to a room when adding it
   [\#1494](https://github.com/matrix-org/matrix-react-sdk/pull/1494)
 * Shuffle GroupView UI
   [\#1490](https://github.com/matrix-org/matrix-react-sdk/pull/1490)
 * Fix bug preventing partial group profile
   [\#1491](https://github.com/matrix-org/matrix-react-sdk/pull/1491)
 * Don't show room IDs when picking rooms
   [\#1492](https://github.com/matrix-org/matrix-react-sdk/pull/1492)
 * Only show invited section if there are invited group members
   [\#1489](https://github.com/matrix-org/matrix-react-sdk/pull/1489)
 * Show "Invited" section in the user list
   [\#1488](https://github.com/matrix-org/matrix-react-sdk/pull/1488)
 * Refactor class names for an entity tile being hovered over
   [\#1487](https://github.com/matrix-org/matrix-react-sdk/pull/1487)
 * Modify GroupView UI
   [\#1475](https://github.com/matrix-org/matrix-react-sdk/pull/1475)
 * Message/event pinning
   [\#1439](https://github.com/matrix-org/matrix-react-sdk/pull/1439)
 * Remove duplicate declaration that breaks the build
   [\#1483](https://github.com/matrix-org/matrix-react-sdk/pull/1483)
 * Include magnet scheme in sanitize HTML params
   [\#1301](https://github.com/matrix-org/matrix-react-sdk/pull/1301)
 * Add a way to jump to a user's Read Receipt from MemberInfo
   [\#1454](https://github.com/matrix-org/matrix-react-sdk/pull/1454)
 * Use standard subsitution syntax in _tJsx
   [\#1462](https://github.com/matrix-org/matrix-react-sdk/pull/1462)
 * Don't suggest grey as a color scheme for a room
   [\#1442](https://github.com/matrix-org/matrix-react-sdk/pull/1442)
 * allow hiding of notification body for privacy reasons
   [\#1362](https://github.com/matrix-org/matrix-react-sdk/pull/1362)
 * Suggest to invite people when speaking in an empty room
   [\#1466](https://github.com/matrix-org/matrix-react-sdk/pull/1466)
 * Buttons to remove room/self avatar
   [\#1478](https://github.com/matrix-org/matrix-react-sdk/pull/1478)
 * T3chguy/fix memberlist
   [\#1480](https://github.com/matrix-org/matrix-react-sdk/pull/1480)
 * add option to disable BigEmoji
   [\#1481](https://github.com/matrix-org/matrix-react-sdk/pull/1481)

Changes in [0.10.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.7) (2017-10-16)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.7-rc.3...v0.10.7)

 * Update to latest js-sdk

Changes in [0.10.7-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.7-rc.3) (2017-10-13)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.7-rc.2...v0.10.7-rc.3)

 * Fix the enableLabs flag, again
   [\#1474](https://github.com/matrix-org/matrix-react-sdk/pull/1474)

Changes in [0.10.7-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.7-rc.2) (2017-10-13)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.7-rc.1...v0.10.7-rc.2)

 * Honour the (now legacy) enableLabs flag
   [\#1473](https://github.com/matrix-org/matrix-react-sdk/pull/1473)
 * Don't show labs features by default
   [\#1472](https://github.com/matrix-org/matrix-react-sdk/pull/1472)
 * Make features disabled by default
   [\#1470](https://github.com/matrix-org/matrix-react-sdk/pull/1470)

Changes in [0.10.7-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.7-rc.1) (2017-10-13)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.6...v0.10.7-rc.1)

 * Add warm fuzzy dialog for inviting users to a group
   [\#1459](https://github.com/matrix-org/matrix-react-sdk/pull/1459)
 * enable/disable features in config.json
   [\#1468](https://github.com/matrix-org/matrix-react-sdk/pull/1468)
 * Update from Weblate.
   [\#1469](https://github.com/matrix-org/matrix-react-sdk/pull/1469)
 * Don't send RR or RM when peeking at a room
   [\#1463](https://github.com/matrix-org/matrix-react-sdk/pull/1463)
 * Fix bug that inserted emoji when typing
   [\#1467](https://github.com/matrix-org/matrix-react-sdk/pull/1467)
 * Ignore VS16 char in RTE
   [\#1458](https://github.com/matrix-org/matrix-react-sdk/pull/1458)
 * Show failures when sending messages
   [\#1460](https://github.com/matrix-org/matrix-react-sdk/pull/1460)
 * Run eslint --fix
   [\#1461](https://github.com/matrix-org/matrix-react-sdk/pull/1461)
 * Show who banned the user on hover
   [\#1441](https://github.com/matrix-org/matrix-react-sdk/pull/1441)
 * Enhancements to room power level settings
   [\#1440](https://github.com/matrix-org/matrix-react-sdk/pull/1440)
 * Added TextInputWithCheckbox dialog
   [\#868](https://github.com/matrix-org/matrix-react-sdk/pull/868)
 * Make it clearer which HS you're logging into
   [\#1456](https://github.com/matrix-org/matrix-react-sdk/pull/1456)
 * Remove redundant stale onKeyDown
   [\#1451](https://github.com/matrix-org/matrix-react-sdk/pull/1451)
 * Only allow event state event handlers on state events
   [\#1453](https://github.com/matrix-org/matrix-react-sdk/pull/1453)
 * Modify the group store to include group rooms
   [\#1452](https://github.com/matrix-org/matrix-react-sdk/pull/1452)
 * Factor-out GroupStore and create GroupStoreCache
   [\#1449](https://github.com/matrix-org/matrix-react-sdk/pull/1449)
 * Put related groups UI behind groups labs flag
   [\#1448](https://github.com/matrix-org/matrix-react-sdk/pull/1448)
 * Restrict Flair in the timeline to related groups of the room
   [\#1447](https://github.com/matrix-org/matrix-react-sdk/pull/1447)
 * Implement UI for editing related groups of a room
   [\#1446](https://github.com/matrix-org/matrix-react-sdk/pull/1446)
 * Fix a couple of bugs with EditableItemList
   [\#1445](https://github.com/matrix-org/matrix-react-sdk/pull/1445)
 * Factor out EditableItemList from AliasSettings
   [\#1444](https://github.com/matrix-org/matrix-react-sdk/pull/1444)
 * Add dummy translation function to mark translatable strings
   [\#1421](https://github.com/matrix-org/matrix-react-sdk/pull/1421)
 * Implement button to remove a room from a group
   [\#1438](https://github.com/matrix-org/matrix-react-sdk/pull/1438)
 * Fix showing 3pid invites in member list
   [\#1443](https://github.com/matrix-org/matrix-react-sdk/pull/1443)
 * Add button to get to MyGroups (view_my_groups or path #/groups)
   [\#1435](https://github.com/matrix-org/matrix-react-sdk/pull/1435)
 * Add eslint rule to disallow spaces inside of curly braces
   [\#1436](https://github.com/matrix-org/matrix-react-sdk/pull/1436)
 * Fix ability to invite existing mx users
   [\#1437](https://github.com/matrix-org/matrix-react-sdk/pull/1437)
 * Construct address picker message using provided `validAddressTypes`
   [\#1434](https://github.com/matrix-org/matrix-react-sdk/pull/1434)
 * Fix GroupView summary rooms displaying without avatars
   [\#1433](https://github.com/matrix-org/matrix-react-sdk/pull/1433)
 * Implement adding rooms to a group (or group summary) by room ID
   [\#1432](https://github.com/matrix-org/matrix-react-sdk/pull/1432)
 * Give flair avatars a tooltip = the group ID
   [\#1431](https://github.com/matrix-org/matrix-react-sdk/pull/1431)
 * Fix ability to feature self in a group summary
   [\#1430](https://github.com/matrix-org/matrix-react-sdk/pull/1430)
 * Implement "Add room to group" feature
   [\#1429](https://github.com/matrix-org/matrix-react-sdk/pull/1429)
 * Fix group membership publicity
   [\#1428](https://github.com/matrix-org/matrix-react-sdk/pull/1428)
 * Add support for Jitsi screensharing in electron app
   [\#1355](https://github.com/matrix-org/matrix-react-sdk/pull/1355)
 * Delint and DRY TextForEvent
   [\#1424](https://github.com/matrix-org/matrix-react-sdk/pull/1424)
 * Bust the flair caches after 30mins
   [\#1427](https://github.com/matrix-org/matrix-react-sdk/pull/1427)
 * Show displayname / avatar in group member info
   [\#1426](https://github.com/matrix-org/matrix-react-sdk/pull/1426)
 * Create GroupSummaryStore for storing group summary stuff
   [\#1418](https://github.com/matrix-org/matrix-react-sdk/pull/1418)
 * Add status & toggle for publicity
   [\#1419](https://github.com/matrix-org/matrix-react-sdk/pull/1419)
 * MemberList: show 100 more on overflow tile click
   [\#1417](https://github.com/matrix-org/matrix-react-sdk/pull/1417)
 * Fix NPE in MemberList
   [\#1425](https://github.com/matrix-org/matrix-react-sdk/pull/1425)
 * Fix incorrect variable in string
   [\#1422](https://github.com/matrix-org/matrix-react-sdk/pull/1422)
 * apply i18n _t to string which has already been translated
   [\#1420](https://github.com/matrix-org/matrix-react-sdk/pull/1420)
 * Make the invite section a truncatedlist too
   [\#1416](https://github.com/matrix-org/matrix-react-sdk/pull/1416)
 * Implement removal function of features users/rooms
   [\#1415](https://github.com/matrix-org/matrix-react-sdk/pull/1415)
 * Allow TruncatedList to get children via a callback
   [\#1412](https://github.com/matrix-org/matrix-react-sdk/pull/1412)
 * Experimental: Lazy load user autocomplete entries
   [\#1413](https://github.com/matrix-org/matrix-react-sdk/pull/1413)
 * Show displayname & avatar url in group member list
   [\#1414](https://github.com/matrix-org/matrix-react-sdk/pull/1414)
 * De-lint TruncatedList
   [\#1411](https://github.com/matrix-org/matrix-react-sdk/pull/1411)
 * Remove unneeded strings
   [\#1409](https://github.com/matrix-org/matrix-react-sdk/pull/1409)
 * Clean on prerelease
   [\#1410](https://github.com/matrix-org/matrix-react-sdk/pull/1410)
 * Redesign membership section in GroupView
   [\#1408](https://github.com/matrix-org/matrix-react-sdk/pull/1408)
 * Implement adding rooms to the group summary
   [\#1406](https://github.com/matrix-org/matrix-react-sdk/pull/1406)
 * Honour the is_privileged flag in GroupView
   [\#1407](https://github.com/matrix-org/matrix-react-sdk/pull/1407)
 * Update when a group arrives
   [\#1405](https://github.com/matrix-org/matrix-react-sdk/pull/1405)
 * Implement `view_group` dispatch when clicking flair
   [\#1404](https://github.com/matrix-org/matrix-react-sdk/pull/1404)
 * GroupView: Add a User
   [\#1402](https://github.com/matrix-org/matrix-react-sdk/pull/1402)
 * Track action button click event
   [\#1403](https://github.com/matrix-org/matrix-react-sdk/pull/1403)
 * Separate sender profile into elements with classes
   [\#1401](https://github.com/matrix-org/matrix-react-sdk/pull/1401)
 * Fix ugly integration button, use hover to show error
   [\#1399](https://github.com/matrix-org/matrix-react-sdk/pull/1399)
 * Fix promise error in flair
   [\#1400](https://github.com/matrix-org/matrix-react-sdk/pull/1400)
 * Flair!
   [\#1351](https://github.com/matrix-org/matrix-react-sdk/pull/1351)
 * Group Membership UI
   [\#1328](https://github.com/matrix-org/matrix-react-sdk/pull/1328)

Changes in [0.10.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.6) (2017-09-21)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.5...v0.10.6)

 * New version of js-sdk with fixed build

Changes in [0.10.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.5) (2017-09-21)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.4...v0.10.5)

 * Fix build error (https://github.com/vector-im/riot-web/issues/5091)

Changes in [0.10.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.4) (2017-09-20)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.4-rc.1...v0.10.4)

 * No changes

Changes in [0.10.4-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.4-rc.1) (2017-09-19)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.3...v0.10.4-rc.1)

 * Fix RoomView stuck in 'accept invite' state
   [\#1396](https://github.com/matrix-org/matrix-react-sdk/pull/1396)
 * Only show the integ management button if user is joined
   [\#1398](https://github.com/matrix-org/matrix-react-sdk/pull/1398)
 * suppressOnHover for member entity tiles which have no onClick
   [\#1273](https://github.com/matrix-org/matrix-react-sdk/pull/1273)
 * add /devtools command
   [\#1268](https://github.com/matrix-org/matrix-react-sdk/pull/1268)
 * Fix broken Link
   [\#1359](https://github.com/matrix-org/matrix-react-sdk/pull/1359)
 * Show who redacted an event on hover
   [\#1387](https://github.com/matrix-org/matrix-react-sdk/pull/1387)
 * start MELS expanded if it contains a highlighted/permalinked event.
   [\#1388](https://github.com/matrix-org/matrix-react-sdk/pull/1388)
 * Add ignore user API support
   [\#1389](https://github.com/matrix-org/matrix-react-sdk/pull/1389)
 * Add option to disable Emoji suggestions
   [\#1392](https://github.com/matrix-org/matrix-react-sdk/pull/1392)
 * sanitize the i18n for fn:textForHistoryVisibilityEvent
   [\#1397](https://github.com/matrix-org/matrix-react-sdk/pull/1397)
 * Don't check for only-emoji if there were none
   [\#1394](https://github.com/matrix-org/matrix-react-sdk/pull/1394)
 * Fix emojification of symbol characters
   [\#1393](https://github.com/matrix-org/matrix-react-sdk/pull/1393)
 * Update from Weblate.
   [\#1395](https://github.com/matrix-org/matrix-react-sdk/pull/1395)
 * Make /join join again
   [\#1391](https://github.com/matrix-org/matrix-react-sdk/pull/1391)
 * Display spinner not room preview after room create
   [\#1390](https://github.com/matrix-org/matrix-react-sdk/pull/1390)
 * Fix the avatar / room name in room preview
   [\#1384](https://github.com/matrix-org/matrix-react-sdk/pull/1384)
 * Remove spurious cancel button
   [\#1381](https://github.com/matrix-org/matrix-react-sdk/pull/1381)
 * Fix starting a chat by email address
   [\#1386](https://github.com/matrix-org/matrix-react-sdk/pull/1386)
 * respond on copy code block
   [\#1363](https://github.com/matrix-org/matrix-react-sdk/pull/1363)
 * fix DateUtils inconsistency with 12/24h
   [\#1383](https://github.com/matrix-org/matrix-react-sdk/pull/1383)
 * allow sending sub,sup and whitelist them on receive
   [\#1382](https://github.com/matrix-org/matrix-react-sdk/pull/1382)
 * Update roomlist when an event is decrypted
   [\#1380](https://github.com/matrix-org/matrix-react-sdk/pull/1380)
 * Update from Weblate.
   [\#1379](https://github.com/matrix-org/matrix-react-sdk/pull/1379)
 * fix radio for theme selection
   [\#1368](https://github.com/matrix-org/matrix-react-sdk/pull/1368)
 * fix some more zh_Hans - remove entirely broken lines
   [\#1378](https://github.com/matrix-org/matrix-react-sdk/pull/1378)
 * fix placeholder causing app to break when using zh
   [\#1377](https://github.com/matrix-org/matrix-react-sdk/pull/1377)
 * Avoid re-rendering RoomList on room switch
   [\#1375](https://github.com/matrix-org/matrix-react-sdk/pull/1375)
 * Fix 'Failed to load timeline position' regression
   [\#1376](https://github.com/matrix-org/matrix-react-sdk/pull/1376)
 * Fast path for emojifying strings
   [\#1372](https://github.com/matrix-org/matrix-react-sdk/pull/1372)
 * Consolidate the code copy button
   [\#1374](https://github.com/matrix-org/matrix-react-sdk/pull/1374)
 * Only add the code copy button for HTML messages
   [\#1373](https://github.com/matrix-org/matrix-react-sdk/pull/1373)
 * Don't re-render matrixchat unnecessarily
   [\#1371](https://github.com/matrix-org/matrix-react-sdk/pull/1371)
 * Don't wait for setState to run onHaveRoom
   [\#1370](https://github.com/matrix-org/matrix-react-sdk/pull/1370)
 * Introduce a RoomScrollStateStore
   [\#1367](https://github.com/matrix-org/matrix-react-sdk/pull/1367)
 * Don't always paginate when mounting a ScrollPanel
   [\#1369](https://github.com/matrix-org/matrix-react-sdk/pull/1369)
 * Remove unused scrollStateMap from LoggedinView
   [\#1366](https://github.com/matrix-org/matrix-react-sdk/pull/1366)
 * Revert "Implement sticky date separators"
   [\#1365](https://github.com/matrix-org/matrix-react-sdk/pull/1365)
 * Remove unused string "changing room on a RoomView is not supported"
   [\#1361](https://github.com/matrix-org/matrix-react-sdk/pull/1361)
 * Remove unused translation code translations
   [\#1360](https://github.com/matrix-org/matrix-react-sdk/pull/1360)
 * Implement sticky date separators
   [\#1353](https://github.com/matrix-org/matrix-react-sdk/pull/1353)

Changes in [0.10.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.3) (2017-09-06)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.3-rc.2...v0.10.3)

 * No changes

Changes in [0.10.3-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.3-rc.2) (2017-09-05)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.3-rc.1...v0.10.3-rc.2)

 * Fix plurals in translations
   [\#1358](https://github.com/matrix-org/matrix-react-sdk/pull/1358)
 * Fix typo
   [\#1357](https://github.com/matrix-org/matrix-react-sdk/pull/1357)
 * Update from Weblate.
   [\#1356](https://github.com/matrix-org/matrix-react-sdk/pull/1356)

Changes in [0.10.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.3-rc.1) (2017-09-01)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.2...v0.10.3-rc.1)

 * Fix room change sometimes being very slow
   [\#1354](https://github.com/matrix-org/matrix-react-sdk/pull/1354)
 * apply shouldHideEvent fn to onRoomTimeline for RoomStatusBar
   [\#1346](https://github.com/matrix-org/matrix-react-sdk/pull/1346)
 * text4event widget modified, used to show widget added each time.
   [\#1345](https://github.com/matrix-org/matrix-react-sdk/pull/1345)
 * separate concepts of showing and managing RRs to fix regression
   [\#1352](https://github.com/matrix-org/matrix-react-sdk/pull/1352)
 * Make staging widgets work with live and vice versa.
   [\#1350](https://github.com/matrix-org/matrix-react-sdk/pull/1350)
 * Avoid breaking /sync with uncaught exceptions
   [\#1349](https://github.com/matrix-org/matrix-react-sdk/pull/1349)
 * we need to pass whether it is an invite RoomSubList explicitly (i18n)
   [\#1343](https://github.com/matrix-org/matrix-react-sdk/pull/1343)
 * Percent encoding isn't a valid thing within _t
   [\#1348](https://github.com/matrix-org/matrix-react-sdk/pull/1348)
 * Fix spurious notifications
   [\#1339](https://github.com/matrix-org/matrix-react-sdk/pull/1339)
 * Unbreak password reset with a non-default HS
   [\#1347](https://github.com/matrix-org/matrix-react-sdk/pull/1347)
 * Remove unnecessary 'load' on notif audio element
   [\#1341](https://github.com/matrix-org/matrix-react-sdk/pull/1341)
 * _tJsx returns a React Object, the sub fn must return a React Object
   [\#1340](https://github.com/matrix-org/matrix-react-sdk/pull/1340)
 * Fix deprecation warning about promise.defer()
   [\#1292](https://github.com/matrix-org/matrix-react-sdk/pull/1292)
 * Fix click to insert completion
   [\#1331](https://github.com/matrix-org/matrix-react-sdk/pull/1331)

Changes in [0.10.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.2) (2017-08-24)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.1...v0.10.2)

 * Force update on timelinepanel when event decrypted
   [\#1334](https://github.com/matrix-org/matrix-react-sdk/pull/1334)
 * Dispatch incoming_call synchronously
   [\#1337](https://github.com/matrix-org/matrix-react-sdk/pull/1337)
 * Fix React crying on machines without internet due to return undefined
   [\#1335](https://github.com/matrix-org/matrix-react-sdk/pull/1335)
 * Catch the promise rejection if scalar fails
   [\#1333](https://github.com/matrix-org/matrix-react-sdk/pull/1333)
 * Update from Weblate.
   [\#1329](https://github.com/matrix-org/matrix-react-sdk/pull/1329)

Changes in [0.10.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.1) (2017-08-23)
=====================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.1-rc.1...v0.10.1)

 * [No changes]

Changes in [0.10.1-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.10.1-rc.1) (2017-08-22)
===============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.10.0-rc.2...v0.10.1-rc.1)

 * Matthew/multiple widgets
   [\#1327](https://github.com/matrix-org/matrix-react-sdk/pull/1327)
 * Fix proptypes on UserPickerDialog
   [\#1326](https://github.com/matrix-org/matrix-react-sdk/pull/1326)
 * AppsDrawer: Remove unnecessary bind
   [\#1325](https://github.com/matrix-org/matrix-react-sdk/pull/1325)
 * Position add app widget link
   [\#1322](https://github.com/matrix-org/matrix-react-sdk/pull/1322)
 * Remove app tile beta tag.
   [\#1323](https://github.com/matrix-org/matrix-react-sdk/pull/1323)
 * Add missing translation.
   [\#1324](https://github.com/matrix-org/matrix-react-sdk/pull/1324)
 * Note that apps are not E2EE
   [\#1319](https://github.com/matrix-org/matrix-react-sdk/pull/1319)
 * Only render appTile body (including warnings) if drawer shown.
   [\#1321](https://github.com/matrix-org/matrix-react-sdk/pull/1321)
 * Timeline improvements
   [\#1320](https://github.com/matrix-org/matrix-react-sdk/pull/1320)
 * Add a space between widget name and "widget" in widget event tiles
   [\#1318](https://github.com/matrix-org/matrix-react-sdk/pull/1318)
 * Move manage integrations button from settings page to room header as a
   stand-alone component
   [\#1286](https://github.com/matrix-org/matrix-react-sdk/pull/1286)
 * Don't apply case logic to app names
   [\#1316](https://github.com/matrix-org/matrix-react-sdk/pull/1316)
 * Stop integ manager opening on every room switch
   [\#1315](https://github.com/matrix-org/matrix-react-sdk/pull/1315)
 * Add behaviour to toggle app draw on app tile header click
   [\#1313](https://github.com/matrix-org/matrix-react-sdk/pull/1313)
 * Change OOO so that MELS generation will continue over hidden events
   [\#1308](https://github.com/matrix-org/matrix-react-sdk/pull/1308)
 * Implement TextualEvent tiles for im.vector.modular.widgets
   [\#1312](https://github.com/matrix-org/matrix-react-sdk/pull/1312)
 * Don't show widget security warning to the person that added it to the room
   [\#1314](https://github.com/matrix-org/matrix-react-sdk/pull/1314)
 * remove unused strings introduced by string change
   [\#1311](https://github.com/matrix-org/matrix-react-sdk/pull/1311)
 * hotfix bad fn signature regression
   [\#1310](https://github.com/matrix-org/matrix-react-sdk/pull/1310)
 * Show a dialog if the maximum number of widgets allowed has been reached.
   [\#1291](https://github.com/matrix-org/matrix-react-sdk/pull/1291)
 * Fix Robot translation
   [\#1309](https://github.com/matrix-org/matrix-react-sdk/pull/1309)
 * Refactor ChatInviteDialog to be UserPickerDialog
   [\#1300](https://github.com/matrix-org/matrix-react-sdk/pull/1300)
 * Update Link to Translation status
   [\#1302](https://github.com/matrix-org/matrix-react-sdk/pull/1302)

Changes in [0.9.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.7) (2017-06-22)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.6...v0.9.7)

 * Fix ability to invite users with caps in their user IDs
   [\#1128](https://github.com/matrix-org/matrix-react-sdk/pull/1128)
 * Fix another race with first-sync
   [\#1131](https://github.com/matrix-org/matrix-react-sdk/pull/1131)
 * Make the indexeddb worker script work again
   [\#1132](https://github.com/matrix-org/matrix-react-sdk/pull/1132)
 * Use the web worker when clearing js-sdk stores
   [\#1133](https://github.com/matrix-org/matrix-react-sdk/pull/1133)

Changes in [0.9.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.6) (2017-06-20)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.5...v0.9.6)

 * Fix infinite spinner on email registration
   [\#1120](https://github.com/matrix-org/matrix-react-sdk/pull/1120)
 * Translate help promots in room list
   [\#1121](https://github.com/matrix-org/matrix-react-sdk/pull/1121)
 * Internationalise the drop targets
   [\#1122](https://github.com/matrix-org/matrix-react-sdk/pull/1122)
 * Fix another infinite spin on register
   [\#1124](https://github.com/matrix-org/matrix-react-sdk/pull/1124)


Changes in [0.9.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.5) (2017-06-19)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.5-rc.2...v0.9.5)

 * Don't peek when creating a room
   [\#1113](https://github.com/matrix-org/matrix-react-sdk/pull/1113)
 * More translations & translation fixes


Changes in [0.9.5-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.5-rc.2) (2017-06-16)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.5-rc.1...v0.9.5-rc.2)

 * Avoid getting stuck in a loop in CAS login
   [\#1109](https://github.com/matrix-org/matrix-react-sdk/pull/1109)
 * Update from Weblate.
   [\#1101](https://github.com/matrix-org/matrix-react-sdk/pull/1101)
 * Correctly inspect state when rejecting invite
   [\#1108](https://github.com/matrix-org/matrix-react-sdk/pull/1108)
 * Make sure to pass the roomAlias to the preview header if we have it
   [\#1107](https://github.com/matrix-org/matrix-react-sdk/pull/1107)
 * Make sure captcha disappears when container does
   [\#1106](https://github.com/matrix-org/matrix-react-sdk/pull/1106)
 * Fix URL previews
   [\#1105](https://github.com/matrix-org/matrix-react-sdk/pull/1105)

Changes in [0.9.5-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.5-rc.1) (2017-06-15)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.4...v0.9.5-rc.1)

 * Groundwork for tests including a teamserver login
   [\#1098](https://github.com/matrix-org/matrix-react-sdk/pull/1098)
 * Show a spinner when accepting an invite and waitingForRoom
   [\#1100](https://github.com/matrix-org/matrix-react-sdk/pull/1100)
 * Display a spinner until new room object after join success
   [\#1099](https://github.com/matrix-org/matrix-react-sdk/pull/1099)
 * Luke/attempt fix peeking regression
   [\#1097](https://github.com/matrix-org/matrix-react-sdk/pull/1097)
 * Show correct text in set email password dialog (2)
   [\#1096](https://github.com/matrix-org/matrix-react-sdk/pull/1096)
 * Don't create a guest login if user went to /login
   [\#1092](https://github.com/matrix-org/matrix-react-sdk/pull/1092)
 * Give password confirmation correct title, description
   [\#1095](https://github.com/matrix-org/matrix-react-sdk/pull/1095)
 * Make enter submit change password form
   [\#1094](https://github.com/matrix-org/matrix-react-sdk/pull/1094)
 * When not specified, remove roomAlias state in RoomViewStore
   [\#1093](https://github.com/matrix-org/matrix-react-sdk/pull/1093)
 * Update from Weblate.
   [\#1091](https://github.com/matrix-org/matrix-react-sdk/pull/1091)
 * Fixed pagination infinite loop caused by long messages
   [\#1045](https://github.com/matrix-org/matrix-react-sdk/pull/1045)
 * Clear persistent storage on login and logout
   [\#1085](https://github.com/matrix-org/matrix-react-sdk/pull/1085)
 * DM guessing: prefer oldest joined member
   [\#1087](https://github.com/matrix-org/matrix-react-sdk/pull/1087)
 * Ask for email address after setting password for the first time
   [\#1090](https://github.com/matrix-org/matrix-react-sdk/pull/1090)
 * i18n for setting password flow
   [\#1089](https://github.com/matrix-org/matrix-react-sdk/pull/1089)
 * remove mx_filterFlipColor from verified e2e icon so its not purple :/
   [\#1088](https://github.com/matrix-org/matrix-react-sdk/pull/1088)
 * width and height must be int otherwise synapse cries
   [\#1083](https://github.com/matrix-org/matrix-react-sdk/pull/1083)
 * remove RoomViewStore listener from MatrixChat on unmount
   [\#1084](https://github.com/matrix-org/matrix-react-sdk/pull/1084)
 * Add script to copy translations between files
   [\#1082](https://github.com/matrix-org/matrix-react-sdk/pull/1082)
 * Only process user_directory response if it's for the current query
   [\#1081](https://github.com/matrix-org/matrix-react-sdk/pull/1081)
 * Fix regressions with starting a 1-1.
   [\#1080](https://github.com/matrix-org/matrix-react-sdk/pull/1080)
 * allow forcing of TURN
   [\#1079](https://github.com/matrix-org/matrix-react-sdk/pull/1079)
 * Remove a bunch of dead code from react-sdk
   [\#1077](https://github.com/matrix-org/matrix-react-sdk/pull/1077)
 * Improve error logging/reporting in megolm import/export
   [\#1061](https://github.com/matrix-org/matrix-react-sdk/pull/1061)
 * Delinting
   [\#1064](https://github.com/matrix-org/matrix-react-sdk/pull/1064)
 * Show reason for a call hanging up unexpectedly.
   [\#1071](https://github.com/matrix-org/matrix-react-sdk/pull/1071)
 * Add reason for ban in room settings
   [\#1072](https://github.com/matrix-org/matrix-react-sdk/pull/1072)
 * adds mx_filterFlipColor so that the dark theme will invert this image
   [\#1070](https://github.com/matrix-org/matrix-react-sdk/pull/1070)

Changes in [0.9.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.4) (2017-06-14)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.3...v0.9.4)

 * Ask for email address after setting password for the first time
   [\#1090](https://github.com/matrix-org/matrix-react-sdk/pull/1090)
 * DM guessing: prefer oldest joined member
   [\#1087](https://github.com/matrix-org/matrix-react-sdk/pull/1087)
 * More translations

Changes in [0.9.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.3) (2017-06-12)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.3-rc.2...v0.9.3)

 * Add more translations & fix some existing ones

Changes in [0.9.3-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.3-rc.2) (2017-06-09)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.3-rc.1...v0.9.3-rc.2)

 * Fix flux dependency
 * Fix translations on conference call bar

Changes in [0.9.3-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.3-rc.1) (2017-06-09)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.2...v0.9.3-rc.1)

 * When ChatCreateOrReuseDialog is cancelled by a guest, go home
   [\#1069](https://github.com/matrix-org/matrix-react-sdk/pull/1069)
 * Update from Weblate.
   [\#1065](https://github.com/matrix-org/matrix-react-sdk/pull/1065)
 * Goto /home when forgetting the last room
   [\#1067](https://github.com/matrix-org/matrix-react-sdk/pull/1067)
 * Default to home page when settings is closed
   [\#1066](https://github.com/matrix-org/matrix-react-sdk/pull/1066)
 * Update from Weblate.
   [\#1063](https://github.com/matrix-org/matrix-react-sdk/pull/1063)
 * When joining, use a roomAlias if we have it
   [\#1062](https://github.com/matrix-org/matrix-react-sdk/pull/1062)
 * Control currently viewed event via RoomViewStore
   [\#1058](https://github.com/matrix-org/matrix-react-sdk/pull/1058)
 * Better error messages for login
   [\#1060](https://github.com/matrix-org/matrix-react-sdk/pull/1060)
 * Add remaining translations
   [\#1056](https://github.com/matrix-org/matrix-react-sdk/pull/1056)
 * Added button that copies code to clipboard
   [\#1040](https://github.com/matrix-org/matrix-react-sdk/pull/1040)
 * de-lint MegolmExportEncryption + test
   [\#1059](https://github.com/matrix-org/matrix-react-sdk/pull/1059)
 * Better RTL support
   [\#1021](https://github.com/matrix-org/matrix-react-sdk/pull/1021)
 * make mels emoji capable
   [\#1057](https://github.com/matrix-org/matrix-react-sdk/pull/1057)
 * Make travis check for lint on files which are clean to start with
   [\#1055](https://github.com/matrix-org/matrix-react-sdk/pull/1055)
 * Update from Weblate.
   [\#1053](https://github.com/matrix-org/matrix-react-sdk/pull/1053)
 * Add some logging around switching rooms
   [\#1054](https://github.com/matrix-org/matrix-react-sdk/pull/1054)
 * Update from Weblate.
   [\#1052](https://github.com/matrix-org/matrix-react-sdk/pull/1052)
 * Use user_directory endpoint to populate ChatInviteDialog
   [\#1050](https://github.com/matrix-org/matrix-react-sdk/pull/1050)
 * Various Analytics changes/fixes/improvements
   [\#1046](https://github.com/matrix-org/matrix-react-sdk/pull/1046)
 * Use an arrow function to allow `this`
   [\#1051](https://github.com/matrix-org/matrix-react-sdk/pull/1051)
 * New guest access
   [\#937](https://github.com/matrix-org/matrix-react-sdk/pull/937)
 * Translate src/components/structures
   [\#1048](https://github.com/matrix-org/matrix-react-sdk/pull/1048)
 * Cancel 'join room' action if 'log in' is clicked
   [\#1049](https://github.com/matrix-org/matrix-react-sdk/pull/1049)
 * fix copy and paste derp and rip out unused imports
   [\#1015](https://github.com/matrix-org/matrix-react-sdk/pull/1015)
 * Update from Weblate.
   [\#1042](https://github.com/matrix-org/matrix-react-sdk/pull/1042)
 * Reset 'first sync' flag / promise on log in
   [\#1041](https://github.com/matrix-org/matrix-react-sdk/pull/1041)
 * Remove DM-guessing code (again)
   [\#1036](https://github.com/matrix-org/matrix-react-sdk/pull/1036)
 * Cancel deferred actions
   [\#1039](https://github.com/matrix-org/matrix-react-sdk/pull/1039)
 * Merge develop, add i18n for SetMxIdDialog
   [\#1034](https://github.com/matrix-org/matrix-react-sdk/pull/1034)
 * Defer an intention for creating a room
   [\#1038](https://github.com/matrix-org/matrix-react-sdk/pull/1038)
 * Fix 'create room' button
   [\#1037](https://github.com/matrix-org/matrix-react-sdk/pull/1037)
 * Always show the spinner during the first sync
   [\#1033](https://github.com/matrix-org/matrix-react-sdk/pull/1033)
 * Only view welcome user if we are not looking at a room
   [\#1032](https://github.com/matrix-org/matrix-react-sdk/pull/1032)
 * Update from Weblate.
   [\#1030](https://github.com/matrix-org/matrix-react-sdk/pull/1030)
 * Keep deferred actions for view_user_settings and view_create_chat
   [\#1031](https://github.com/matrix-org/matrix-react-sdk/pull/1031)
 * Don't do a deferred start chat if user is welcome user
   [\#1029](https://github.com/matrix-org/matrix-react-sdk/pull/1029)
 * Introduce state `peekLoading` to avoid collision with `roomLoading`
   [\#1028](https://github.com/matrix-org/matrix-react-sdk/pull/1028)
 * Update from Weblate.
   [\#1016](https://github.com/matrix-org/matrix-react-sdk/pull/1016)
 * Fix accepting a 3pid invite
   [\#1013](https://github.com/matrix-org/matrix-react-sdk/pull/1013)
 * Propagate room join errors to the UI
   [\#1007](https://github.com/matrix-org/matrix-react-sdk/pull/1007)
 * Implement /user/@userid:domain?action=chat
   [\#1006](https://github.com/matrix-org/matrix-react-sdk/pull/1006)
 * Show People/Rooms emptySubListTip even when total rooms !== 0
   [\#967](https://github.com/matrix-org/matrix-react-sdk/pull/967)
 * Fix to show the correct room
   [\#995](https://github.com/matrix-org/matrix-react-sdk/pull/995)
 * Remove cachedPassword from localStorage on_logged_out
   [\#977](https://github.com/matrix-org/matrix-react-sdk/pull/977)
 * Add /start to show the setMxId above HomePage
   [\#964](https://github.com/matrix-org/matrix-react-sdk/pull/964)
 * Allow pressing Enter to submit setMxId
   [\#961](https://github.com/matrix-org/matrix-react-sdk/pull/961)
 * add login link to SetMxIdDialog
   [\#954](https://github.com/matrix-org/matrix-react-sdk/pull/954)
 * Block user settings with view_set_mxid
   [\#936](https://github.com/matrix-org/matrix-react-sdk/pull/936)
 * Show "Something went wrong!" when errcode undefined
   [\#935](https://github.com/matrix-org/matrix-react-sdk/pull/935)
 * Reset store state when logging out
   [\#930](https://github.com/matrix-org/matrix-react-sdk/pull/930)
 * Set the displayname to the mxid once PWLU
   [\#933](https://github.com/matrix-org/matrix-react-sdk/pull/933)
 * Fix view_next_room, view_previous_room and view_indexed_room
   [\#929](https://github.com/matrix-org/matrix-react-sdk/pull/929)
 * Use RVS to indicate "joining" when setting a mxid
   [\#928](https://github.com/matrix-org/matrix-react-sdk/pull/928)
 * Don't show notif nag bar if guest
   [\#932](https://github.com/matrix-org/matrix-react-sdk/pull/932)
 * Show "Password" instead of "New Password"
   [\#927](https://github.com/matrix-org/matrix-react-sdk/pull/927)
 * Remove warm-fuzzy after setting mxid
   [\#926](https://github.com/matrix-org/matrix-react-sdk/pull/926)
 * Allow teamServerConfig to be missing
   [\#925](https://github.com/matrix-org/matrix-react-sdk/pull/925)
 * Remove GuestWarningBar
   [\#923](https://github.com/matrix-org/matrix-react-sdk/pull/923)
 * Make left panel better for new users (mk III)
   [\#924](https://github.com/matrix-org/matrix-react-sdk/pull/924)
 * Implement default welcome page and allow custom URL /w config
   [\#922](https://github.com/matrix-org/matrix-react-sdk/pull/922)
 * Implement a store for RoomView
   [\#921](https://github.com/matrix-org/matrix-react-sdk/pull/921)
 * Add prop to toggle whether new password input is autoFocused
   [\#915](https://github.com/matrix-org/matrix-react-sdk/pull/915)
 * Implement warm-fuzzy success dialog for SetMxIdDialog
   [\#905](https://github.com/matrix-org/matrix-react-sdk/pull/905)
 * Write some tests for the RTS UI
   [\#893](https://github.com/matrix-org/matrix-react-sdk/pull/893)
 * Make confirmation optional on ChangePassword
   [\#890](https://github.com/matrix-org/matrix-react-sdk/pull/890)
 * Remove "Current Password" input if mx_pass exists
   [\#881](https://github.com/matrix-org/matrix-react-sdk/pull/881)
 * Replace NeedToRegisterDialog /w SetMxIdDialog
   [\#889](https://github.com/matrix-org/matrix-react-sdk/pull/889)
 * Invite the welcome user after registration if configured
   [\#882](https://github.com/matrix-org/matrix-react-sdk/pull/882)
 * Prevent ROUs from creating new chats/new rooms
   [\#879](https://github.com/matrix-org/matrix-react-sdk/pull/879)
 * Redesign mxID chooser, add availability checking
   [\#877](https://github.com/matrix-org/matrix-react-sdk/pull/877)
 * Show password nag bar when user is PWLU
   [\#864](https://github.com/matrix-org/matrix-react-sdk/pull/864)
 * fix typo
   [\#858](https://github.com/matrix-org/matrix-react-sdk/pull/858)
 * Initial implementation: SetDisplayName -> SetMxIdDialog
   [\#849](https://github.com/matrix-org/matrix-react-sdk/pull/849)

Changes in [0.9.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.2) (2017-06-06)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.1...v0.9.2)

 * Hotfix: Allow password reset when logged in
   [\#1044](https://github.com/matrix-org/matrix-react-sdk/pull/1044)

Changes in [0.9.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.1) (2017-06-02)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.0...v0.9.1)

 * Update from Weblate.
   [\#1012](https://github.com/matrix-org/matrix-react-sdk/pull/1012)
 * typo, missing import and mis-casing
   [\#1014](https://github.com/matrix-org/matrix-react-sdk/pull/1014)
 * Update from Weblate.
   [\#1010](https://github.com/matrix-org/matrix-react-sdk/pull/1010)

Changes in [0.9.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.0) (2017-06-02)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.0-rc.2...v0.9.0)

 * sync pt with pt_BR
   [\#1009](https://github.com/matrix-org/matrix-react-sdk/pull/1009)
 * Update from Weblate.
   [\#1008](https://github.com/matrix-org/matrix-react-sdk/pull/1008)
 * Update from Weblate.
   [\#1003](https://github.com/matrix-org/matrix-react-sdk/pull/1003)
 * allow hiding redactions, restoring old behaviour
   [\#1004](https://github.com/matrix-org/matrix-react-sdk/pull/1004)
 * Add missing translations
   [\#1005](https://github.com/matrix-org/matrix-react-sdk/pull/1005)

Changes in [0.9.0-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.0-rc.2) (2017-06-02)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.9.0-rc.1...v0.9.0-rc.2)

 * Update from Weblate.
   [\#1002](https://github.com/matrix-org/matrix-react-sdk/pull/1002)
 * webrtc config electron
   [\#850](https://github.com/matrix-org/matrix-react-sdk/pull/850)
 * enable useCompactLayout user setting an add a class when it's enabled
   [\#986](https://github.com/matrix-org/matrix-react-sdk/pull/986)
 * Update from Weblate.
   [\#987](https://github.com/matrix-org/matrix-react-sdk/pull/987)
 * Translation fixes for everything but src/components
   [\#990](https://github.com/matrix-org/matrix-react-sdk/pull/990)
 * Fix tests
   [\#1001](https://github.com/matrix-org/matrix-react-sdk/pull/1001)
 * Fix tests for PR #989
   [\#999](https://github.com/matrix-org/matrix-react-sdk/pull/999)
 * Revert "Revert "add labels to language picker""
   [\#1000](https://github.com/matrix-org/matrix-react-sdk/pull/1000)
 * maybe fixxy [Electron] external thing?
   [\#997](https://github.com/matrix-org/matrix-react-sdk/pull/997)
 * travisci: Don't run the riot-web tests if the react-sdk tests fail
   [\#992](https://github.com/matrix-org/matrix-react-sdk/pull/992)
 * Support 12hr time on DateSeparator
   [\#991](https://github.com/matrix-org/matrix-react-sdk/pull/991)
 * Revert "add labels to language picker"
   [\#994](https://github.com/matrix-org/matrix-react-sdk/pull/994)
 * Call MatrixClient.clearStores on logout
   [\#983](https://github.com/matrix-org/matrix-react-sdk/pull/983)
 * Matthew/room avatar event
   [\#988](https://github.com/matrix-org/matrix-react-sdk/pull/988)
 * add labels to language picker
   [\#989](https://github.com/matrix-org/matrix-react-sdk/pull/989)
 * Update from Weblate.
   [\#981](https://github.com/matrix-org/matrix-react-sdk/pull/981)

Changes in [0.9.0-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.9.0-rc.1) (2017-06-01)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.9...v0.9.0-rc.1)

 * Fix rare case where presence duration is undefined
   [\#982](https://github.com/matrix-org/matrix-react-sdk/pull/982)
 * add concept of platform handling loudNotifications (bings/pings/whatHaveYou)
   [\#985](https://github.com/matrix-org/matrix-react-sdk/pull/985)
 * Fixes to i18n code
   [\#984](https://github.com/matrix-org/matrix-react-sdk/pull/984)
 * Update from Weblate.
   [\#978](https://github.com/matrix-org/matrix-react-sdk/pull/978)
 * Add partial support for RTL languages
   [\#955](https://github.com/matrix-org/matrix-react-sdk/pull/955)
 * Added two strings to translate
   [\#975](https://github.com/matrix-org/matrix-react-sdk/pull/975)
 * Update from Weblate.
   [\#976](https://github.com/matrix-org/matrix-react-sdk/pull/976)
 * Update from Weblate.
   [\#974](https://github.com/matrix-org/matrix-react-sdk/pull/974)
 * Initial Electron Settings - for Auto Launch
   [\#920](https://github.com/matrix-org/matrix-react-sdk/pull/920)
 * Fix missing string in the room settings
   [\#973](https://github.com/matrix-org/matrix-react-sdk/pull/973)
 * fix error in i18n string
   [\#972](https://github.com/matrix-org/matrix-react-sdk/pull/972)
 * Update from Weblate.
   [\#970](https://github.com/matrix-org/matrix-react-sdk/pull/970)
 * Support 12hr time in full date
   [\#971](https://github.com/matrix-org/matrix-react-sdk/pull/971)
 * Add _tJsx()
   [\#968](https://github.com/matrix-org/matrix-react-sdk/pull/968)
 * Update from Weblate.
   [\#966](https://github.com/matrix-org/matrix-react-sdk/pull/966)
 * Remove space between time and AM/PM
   [\#969](https://github.com/matrix-org/matrix-react-sdk/pull/969)
 * Piwik Analytics
   [\#948](https://github.com/matrix-org/matrix-react-sdk/pull/948)
 * Update from Weblate.
   [\#965](https://github.com/matrix-org/matrix-react-sdk/pull/965)
 * Improve ChatInviteDialog perf by ditching fuse, using indexOf and
   lastActiveTs()
   [\#960](https://github.com/matrix-org/matrix-react-sdk/pull/960)
 * Say "X removed the room name" instead of showing nothing
   [\#958](https://github.com/matrix-org/matrix-react-sdk/pull/958)
 * roomview/roomheader fixes
   [\#959](https://github.com/matrix-org/matrix-react-sdk/pull/959)
 * Update from Weblate.
   [\#953](https://github.com/matrix-org/matrix-react-sdk/pull/953)
 * fix i18n in a situation where navigator.languages=[]
   [\#956](https://github.com/matrix-org/matrix-react-sdk/pull/956)
 * `t_` -> `_t` fix typo
   [\#957](https://github.com/matrix-org/matrix-react-sdk/pull/957)
 * Change redact -> remove for clarity
   [\#831](https://github.com/matrix-org/matrix-react-sdk/pull/831)
 * Update from Weblate.
   [\#950](https://github.com/matrix-org/matrix-react-sdk/pull/950)
 * fix mis-linting - missed it in code review :(
   [\#952](https://github.com/matrix-org/matrix-react-sdk/pull/952)
 * i18n fixes
   [\#951](https://github.com/matrix-org/matrix-react-sdk/pull/951)
 * Message Forwarding
   [\#812](https://github.com/matrix-org/matrix-react-sdk/pull/812)
 * don't focus_composer on window focus
   [\#944](https://github.com/matrix-org/matrix-react-sdk/pull/944)
 * Fix vector-im/riot-web#4042
   [\#947](https://github.com/matrix-org/matrix-react-sdk/pull/947)
 * import _t, drop two unused imports
   [\#946](https://github.com/matrix-org/matrix-react-sdk/pull/946)
 * Fix punctuation in TextForEvent to be i18n'd consistently
   [\#945](https://github.com/matrix-org/matrix-react-sdk/pull/945)
 * actually wire up alwaysShowTimestamps
   [\#940](https://github.com/matrix-org/matrix-react-sdk/pull/940)
 * Update from Weblate.
   [\#943](https://github.com/matrix-org/matrix-react-sdk/pull/943)
 * Update from Weblate.
   [\#942](https://github.com/matrix-org/matrix-react-sdk/pull/942)
 * Update from Weblate.
   [\#941](https://github.com/matrix-org/matrix-react-sdk/pull/941)
 * Update from Weblate.
   [\#938](https://github.com/matrix-org/matrix-react-sdk/pull/938)
 * Fix PM being AM
   [\#939](https://github.com/matrix-org/matrix-react-sdk/pull/939)
 * pass call state through dispatcher, for poor electron
   [\#918](https://github.com/matrix-org/matrix-react-sdk/pull/918)
 * Translations!
   [\#934](https://github.com/matrix-org/matrix-react-sdk/pull/934)
 * Remove suffix and prefix from login input username
   [\#906](https://github.com/matrix-org/matrix-react-sdk/pull/906)
 * Kierangould/12hourtimestamp
   [\#903](https://github.com/matrix-org/matrix-react-sdk/pull/903)
 * Don't include src in the test resolve root
   [\#931](https://github.com/matrix-org/matrix-react-sdk/pull/931)
 * Make the linked versions open a new tab, turt2live complained :P
   [\#910](https://github.com/matrix-org/matrix-react-sdk/pull/910)
 * Fix lint errors in SlashCommands
   [\#919](https://github.com/matrix-org/matrix-react-sdk/pull/919)
 * autoFocus input box
   [\#911](https://github.com/matrix-org/matrix-react-sdk/pull/911)
 * Make travis test against riot-web new-guest-access
   [\#917](https://github.com/matrix-org/matrix-react-sdk/pull/917)
 * Add right-branch logic to travis test script
   [\#916](https://github.com/matrix-org/matrix-react-sdk/pull/916)
 * Group e2e keys into blocks of 4 characters
   [\#914](https://github.com/matrix-org/matrix-react-sdk/pull/914)
 * Factor out DeviceVerifyDialog
   [\#913](https://github.com/matrix-org/matrix-react-sdk/pull/913)
 * Fix 'missing page_type' error
   [\#909](https://github.com/matrix-org/matrix-react-sdk/pull/909)
 * code style update
   [\#904](https://github.com/matrix-org/matrix-react-sdk/pull/904)

Changes in [0.8.9](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.9) (2017-05-22)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.9-rc.1...v0.8.9)

 * No changes


Changes in [0.8.9-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.9-rc.1) (2017-05-19)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.8...v0.8.9-rc.1)

 * Prevent an exception getting scroll node
   [\#902](https://github.com/matrix-org/matrix-react-sdk/pull/902)
 * Fix a few remaining snags with country dd
   [\#901](https://github.com/matrix-org/matrix-react-sdk/pull/901)
 * Add left_aligned class to CountryDropdown
   [\#900](https://github.com/matrix-org/matrix-react-sdk/pull/900)
 * Swap to new flag files (which are stored as GB.png)
   [\#899](https://github.com/matrix-org/matrix-react-sdk/pull/899)
 * Improve phone number country dropdown for registration and login (Act. 2,
   Return of the Prefix)
   [\#897](https://github.com/matrix-org/matrix-react-sdk/pull/897)
 * Support for pasting files into normal composer
   [\#892](https://github.com/matrix-org/matrix-react-sdk/pull/892)
 * tell guests they can't use filepanel until they register
   [\#887](https://github.com/matrix-org/matrix-react-sdk/pull/887)
 * Prevent reskindex -w from running when file names have not changed
   [\#888](https://github.com/matrix-org/matrix-react-sdk/pull/888)
 * I broke UserSettings for webpack-dev-server
   [\#884](https://github.com/matrix-org/matrix-react-sdk/pull/884)
 * various fixes to RoomHeader
   [\#880](https://github.com/matrix-org/matrix-react-sdk/pull/880)
 * remove /me whether or not it has a space after it
   [\#885](https://github.com/matrix-org/matrix-react-sdk/pull/885)
 * show error if we can't set a filter because no room
   [\#883](https://github.com/matrix-org/matrix-react-sdk/pull/883)
 * Fix RM not updating if RR event unpaginated
   [\#874](https://github.com/matrix-org/matrix-react-sdk/pull/874)
 * change roomsettings wording
   [\#878](https://github.com/matrix-org/matrix-react-sdk/pull/878)
 * make reskindex windows friendly
   [\#875](https://github.com/matrix-org/matrix-react-sdk/pull/875)
 * Fixes 2 issues with Dialog closing
   [\#867](https://github.com/matrix-org/matrix-react-sdk/pull/867)
 * Automatic Reskindex
   [\#871](https://github.com/matrix-org/matrix-react-sdk/pull/871)
 * Put room name in 'leave room' confirmation dialog
   [\#873](https://github.com/matrix-org/matrix-react-sdk/pull/873)
 * Fix this/self fail in LeftPanel
   [\#872](https://github.com/matrix-org/matrix-react-sdk/pull/872)
 * Don't show null URL previews
   [\#870](https://github.com/matrix-org/matrix-react-sdk/pull/870)
 * Fix keys for AddressSelector
   [\#869](https://github.com/matrix-org/matrix-react-sdk/pull/869)
 * Make left panel better for new users (mk II)
   [\#859](https://github.com/matrix-org/matrix-react-sdk/pull/859)
 * Explicitly save composer content onUnload
   [\#866](https://github.com/matrix-org/matrix-react-sdk/pull/866)
 * Warn on unload
   [\#851](https://github.com/matrix-org/matrix-react-sdk/pull/851)
 * Log deviceid at login
   [\#862](https://github.com/matrix-org/matrix-react-sdk/pull/862)
 * Guests can't send RR so no point trying
   [\#860](https://github.com/matrix-org/matrix-react-sdk/pull/860)
 * Remove babelcheck
   [\#861](https://github.com/matrix-org/matrix-react-sdk/pull/861)
 * T3chguy/settings versions improvements
   [\#857](https://github.com/matrix-org/matrix-react-sdk/pull/857)
 * Change max-len 90->120
   [\#852](https://github.com/matrix-org/matrix-react-sdk/pull/852)
 * Remove DM-guessing code
   [\#829](https://github.com/matrix-org/matrix-react-sdk/pull/829)
 * Fix jumping to an unread event when in MELS
   [\#855](https://github.com/matrix-org/matrix-react-sdk/pull/855)
 * Validate phone number on login
   [\#856](https://github.com/matrix-org/matrix-react-sdk/pull/856)
 * Failed to enable HTML5 Notifications Error Dialogs
   [\#827](https://github.com/matrix-org/matrix-react-sdk/pull/827)
 * Pin filesize ver to fix break upstream
   [\#854](https://github.com/matrix-org/matrix-react-sdk/pull/854)
 * Improve RoomDirectory Look & Feel
   [\#848](https://github.com/matrix-org/matrix-react-sdk/pull/848)
 * Only show jumpToReadMarker bar when RM !== RR
   [\#845](https://github.com/matrix-org/matrix-react-sdk/pull/845)
 * Allow MELS to have its own RM
   [\#846](https://github.com/matrix-org/matrix-react-sdk/pull/846)
 * Use document.onkeydown instead of onkeypress
   [\#844](https://github.com/matrix-org/matrix-react-sdk/pull/844)
 * (Room)?Avatar: Request 96x96 avatars on high DPI screens
   [\#808](https://github.com/matrix-org/matrix-react-sdk/pull/808)
 * Add mx_EventTile_emote class
   [\#842](https://github.com/matrix-org/matrix-react-sdk/pull/842)
 * Fix dialog reappearing after hitting Enter
   [\#841](https://github.com/matrix-org/matrix-react-sdk/pull/841)
 * Fix spinner that shows until the first sync
   [\#840](https://github.com/matrix-org/matrix-react-sdk/pull/840)
 * Show spinner until first sync has completed
   [\#839](https://github.com/matrix-org/matrix-react-sdk/pull/839)
 * Style fixes for LoggedInView
   [\#838](https://github.com/matrix-org/matrix-react-sdk/pull/838)
 * Fix specifying custom server for registration
   [\#834](https://github.com/matrix-org/matrix-react-sdk/pull/834)
 * Improve country dropdown UX and expose +prefix
   [\#833](https://github.com/matrix-org/matrix-react-sdk/pull/833)
 * Fix user settings store
   [\#836](https://github.com/matrix-org/matrix-react-sdk/pull/836)
 * show the room name in the UDE Dialog
   [\#832](https://github.com/matrix-org/matrix-react-sdk/pull/832)
 * summarise profile changes in MELS
   [\#826](https://github.com/matrix-org/matrix-react-sdk/pull/826)
 * Transform h1 and h2 tags to h3 tags
   [\#820](https://github.com/matrix-org/matrix-react-sdk/pull/820)
 * limit our keyboard shortcut modifiers correctly
   [\#825](https://github.com/matrix-org/matrix-react-sdk/pull/825)
 * Specify cross platform regexes and add olm to noParse
   [\#823](https://github.com/matrix-org/matrix-react-sdk/pull/823)
 * Remember element that was in focus before rendering dialog
   [\#822](https://github.com/matrix-org/matrix-react-sdk/pull/822)
 * move user settings outward and use built in read receipts disabling
   [\#824](https://github.com/matrix-org/matrix-react-sdk/pull/824)
 * File Download Consistency
   [\#802](https://github.com/matrix-org/matrix-react-sdk/pull/802)
 * Show Access Token under Advanced in Settings
   [\#806](https://github.com/matrix-org/matrix-react-sdk/pull/806)
 * Link tags/commit hashes in the UserSettings version section
   [\#810](https://github.com/matrix-org/matrix-react-sdk/pull/810)
 * On return to RoomView from auxPanel, send focus back to Composer
   [\#813](https://github.com/matrix-org/matrix-react-sdk/pull/813)
 * Change presence status labels to 'for' instead of 'ago'
   [\#817](https://github.com/matrix-org/matrix-react-sdk/pull/817)
 * Disable Scalar Integrations if urls passed to it are falsey
   [\#816](https://github.com/matrix-org/matrix-react-sdk/pull/816)
 * Add option to hide other people's read receipts.
   [\#818](https://github.com/matrix-org/matrix-react-sdk/pull/818)
 * Add option to not send typing notifications
   [\#819](https://github.com/matrix-org/matrix-react-sdk/pull/819)
 * Sync RM across instances of Riot
   [\#805](https://github.com/matrix-org/matrix-react-sdk/pull/805)
 * First iteration on improving login UI
   [\#811](https://github.com/matrix-org/matrix-react-sdk/pull/811)
 * focus on composer after jumping to bottom
   [\#809](https://github.com/matrix-org/matrix-react-sdk/pull/809)
 * Improve RoomList performance via side-stepping React
   [\#807](https://github.com/matrix-org/matrix-react-sdk/pull/807)
 * Don't show link preview when link is inside of a quote
   [\#762](https://github.com/matrix-org/matrix-react-sdk/pull/762)
 * Escape closes UserSettings
   [\#765](https://github.com/matrix-org/matrix-react-sdk/pull/765)
 * Implement user power-level changes in timeline
   [\#794](https://github.com/matrix-org/matrix-react-sdk/pull/794)

Changes in [0.8.8](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.8) (2017-04-25)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.8-rc.2...v0.8.8)

 * No changes


Changes in [0.8.8-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.8-rc.2) (2017-04-24)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.8-rc.1...v0.8.8-rc.2)

 * Fix bug where links to Riot would fail to open.


Changes in [0.8.8-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.8-rc.1) (2017-04-21)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.7...v0.8.8-rc.1)

 * Update js-sdk to fix registration without a captcha (https://github.com/vector-im/riot-web/issues/3621)


Changes in [0.8.7](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.7) (2017-04-12)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.7-rc.4...v0.8.7)

 * No changes

Changes in [0.8.7-rc.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.7-rc.4) (2017-04-11)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.7-rc.3...v0.8.7-rc.4)

 * Fix people section vanishing on 'clear cache'
   [\#799](https://github.com/matrix-org/matrix-react-sdk/pull/799)
 * Make the clear cache button work on desktop
   [\#798](https://github.com/matrix-org/matrix-react-sdk/pull/798)

Changes in [0.8.7-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.7-rc.3) (2017-04-10)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.7-rc.2...v0.8.7-rc.3)

 * Use matrix-js-sdk v0.7.6-rc.2


Changes in [0.8.7-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.7-rc.2) (2017-04-10)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.7-rc.1...v0.8.7-rc.2)

 * fix the warning shown to users about needing to export e2e keys
   [\#797](https://github.com/matrix-org/matrix-react-sdk/pull/797)

Changes in [0.8.7-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.7-rc.1) (2017-04-07)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.6...v0.8.7-rc.1)

 * Add support for using indexeddb in a webworker
   [\#792](https://github.com/matrix-org/matrix-react-sdk/pull/792)
 * Fix infinite pagination/glitches with pagination
   [\#795](https://github.com/matrix-org/matrix-react-sdk/pull/795)
 * Fix issue where teamTokenMap was ignored for guests
   [\#793](https://github.com/matrix-org/matrix-react-sdk/pull/793)
 * Click emote sender -> insert display name into composer
   [\#791](https://github.com/matrix-org/matrix-react-sdk/pull/791)
 * Fix scroll token selection logic
   [\#785](https://github.com/matrix-org/matrix-react-sdk/pull/785)
 * Replace sdkReady with firstSyncPromise, add mx_last_room_id
   [\#790](https://github.com/matrix-org/matrix-react-sdk/pull/790)
 * Change "Unread messages." to "Jump to first unread message."
   [\#789](https://github.com/matrix-org/matrix-react-sdk/pull/789)
 * Update for new IndexedDBStore interface
   [\#786](https://github.com/matrix-org/matrix-react-sdk/pull/786)
 * Add <ol start="..."> to allowed attributes list
   [\#787](https://github.com/matrix-org/matrix-react-sdk/pull/787)
 * Fix the onFinished for timeline pos dialog
   [\#784](https://github.com/matrix-org/matrix-react-sdk/pull/784)
 * Only join a room when enter is hit if the join button is shown
   [\#776](https://github.com/matrix-org/matrix-react-sdk/pull/776)
 * Remove non-functional session load error
   [\#783](https://github.com/matrix-org/matrix-react-sdk/pull/783)
 * Use Login & Register via component interface
   [\#782](https://github.com/matrix-org/matrix-react-sdk/pull/782)
 * Attempt to fix the flakyness seen with tests
   [\#781](https://github.com/matrix-org/matrix-react-sdk/pull/781)
 * Remove React warning
   [\#780](https://github.com/matrix-org/matrix-react-sdk/pull/780)
 * Only clear the local notification count if needed
   [\#779](https://github.com/matrix-org/matrix-react-sdk/pull/779)
 * Don't re-notify about messages on browser refresh
   [\#777](https://github.com/matrix-org/matrix-react-sdk/pull/777)
 * Improve zeroing of RoomList notification badges
   [\#775](https://github.com/matrix-org/matrix-react-sdk/pull/775)
 * Fix VOIP bar hidden on first render of RoomStatusBar
   [\#774](https://github.com/matrix-org/matrix-react-sdk/pull/774)
 * Correct confirm prompt for disinvite
   [\#772](https://github.com/matrix-org/matrix-react-sdk/pull/772)
 * Add state loggingIn to MatrixChat to fix flashing login
   [\#773](https://github.com/matrix-org/matrix-react-sdk/pull/773)
 * Fix bug where you can't invite a valid address
   [\#771](https://github.com/matrix-org/matrix-react-sdk/pull/771)
 * Fix people section DropTarget and refactor Rooms
   [\#761](https://github.com/matrix-org/matrix-react-sdk/pull/761)
 * Read Receipt offset
   [\#770](https://github.com/matrix-org/matrix-react-sdk/pull/770)
 * Support adding phone numbers in UserSettings
   [\#756](https://github.com/matrix-org/matrix-react-sdk/pull/756)
 * Prevent crash on login of no guest session
   [\#769](https://github.com/matrix-org/matrix-react-sdk/pull/769)
 * Add canResetTimeline callback and thread it through to TimelinePanel
   [\#768](https://github.com/matrix-org/matrix-react-sdk/pull/768)
 * Show spinner whilst processing recaptcha response
   [\#767](https://github.com/matrix-org/matrix-react-sdk/pull/767)
 * Login / registration with phone number, mark 2
   [\#750](https://github.com/matrix-org/matrix-react-sdk/pull/750)
 * Display threepids slightly prettier
   [\#758](https://github.com/matrix-org/matrix-react-sdk/pull/758)
 * Fix extraneous leading space in sent emotes
   [\#764](https://github.com/matrix-org/matrix-react-sdk/pull/764)
 * Add ConfirmRedactDialog component
   [\#763](https://github.com/matrix-org/matrix-react-sdk/pull/763)
 * Fix password UI auth test
   [\#760](https://github.com/matrix-org/matrix-react-sdk/pull/760)
 * Display timestamps and profiles for redacted events
   [\#759](https://github.com/matrix-org/matrix-react-sdk/pull/759)
 * Fix UDD for voip in e2e rooms
   [\#757](https://github.com/matrix-org/matrix-react-sdk/pull/757)
 * Add "Export E2E keys" option to logout dialog
   [\#755](https://github.com/matrix-org/matrix-react-sdk/pull/755)
 * Fix People section a bit
   [\#754](https://github.com/matrix-org/matrix-react-sdk/pull/754)
 * Do routing to /register _onLoadCompleted
   [\#753](https://github.com/matrix-org/matrix-react-sdk/pull/753)
 * Double UNPAGINATION_PADDING again
   [\#747](https://github.com/matrix-org/matrix-react-sdk/pull/747)
 * Add null check to start_login
   [\#751](https://github.com/matrix-org/matrix-react-sdk/pull/751)
 * Merge the two RoomTile context menus into one
   [\#746](https://github.com/matrix-org/matrix-react-sdk/pull/746)
 * Fix import for Lifecycle
   [\#748](https://github.com/matrix-org/matrix-react-sdk/pull/748)
 * Make UDD appear when UDE on uploading a file
   [\#745](https://github.com/matrix-org/matrix-react-sdk/pull/745)
 * Decide on which screen to show after login in one place
   [\#743](https://github.com/matrix-org/matrix-react-sdk/pull/743)
 * Add onClick to permalinks to route within Riot
   [\#744](https://github.com/matrix-org/matrix-react-sdk/pull/744)
 * Add support for pasting files into the text box
   [\#605](https://github.com/matrix-org/matrix-react-sdk/pull/605)
 * Show message redactions as black event tiles
   [\#739](https://github.com/matrix-org/matrix-react-sdk/pull/739)
 * Allow user to choose from existing DMs on new chat
   [\#736](https://github.com/matrix-org/matrix-react-sdk/pull/736)
 * Fix the team server registration
   [\#741](https://github.com/matrix-org/matrix-react-sdk/pull/741)
 * Clarify "No devices" message
   [\#740](https://github.com/matrix-org/matrix-react-sdk/pull/740)
 * Change timestamp permalinks to matrix.to
   [\#735](https://github.com/matrix-org/matrix-react-sdk/pull/735)
 * Fix resend bar and "send anyway" in UDD
   [\#734](https://github.com/matrix-org/matrix-react-sdk/pull/734)
 * Make COLOR_REGEX stricter
   [\#737](https://github.com/matrix-org/matrix-react-sdk/pull/737)
 * Port registration over to use InteractiveAuth
   [\#729](https://github.com/matrix-org/matrix-react-sdk/pull/729)
 * Test to see how fuse feels
   [\#732](https://github.com/matrix-org/matrix-react-sdk/pull/732)
 * Submit a new display name on blur of input field
   [\#733](https://github.com/matrix-org/matrix-react-sdk/pull/733)
 * Allow [bf]g colors for <font> style attrib
   [\#610](https://github.com/matrix-org/matrix-react-sdk/pull/610)
 * MELS: either expanded or summary, not both
   [\#683](https://github.com/matrix-org/matrix-react-sdk/pull/683)
 * Autoplay videos and GIFs if enabled by the user.
   [\#730](https://github.com/matrix-org/matrix-react-sdk/pull/730)
 * Warn users about using e2e for the first time
   [\#731](https://github.com/matrix-org/matrix-react-sdk/pull/731)
 * Show UDDialog on UDE during VoIP calls
   [\#721](https://github.com/matrix-org/matrix-react-sdk/pull/721)
 * Notify MatrixChat of teamToken after login
   [\#726](https://github.com/matrix-org/matrix-react-sdk/pull/726)
 * Fix a couple of issues with RRs
   [\#727](https://github.com/matrix-org/matrix-react-sdk/pull/727)
 * Do not push a dummy element with a scroll token for invisible events
   [\#718](https://github.com/matrix-org/matrix-react-sdk/pull/718)
 * MELS: check scroll on load + use mels-1,-2,... key
   [\#715](https://github.com/matrix-org/matrix-react-sdk/pull/715)
 * Fix message composer placeholders
   [\#723](https://github.com/matrix-org/matrix-react-sdk/pull/723)
 * Clarify non-e2e vs. e2e /w composers placeholder
   [\#720](https://github.com/matrix-org/matrix-react-sdk/pull/720)
 * Fix status bar expanded on tab-complete
   [\#722](https://github.com/matrix-org/matrix-react-sdk/pull/722)
 * add .editorconfig
   [\#713](https://github.com/matrix-org/matrix-react-sdk/pull/713)
 * Change the name of the database
   [\#719](https://github.com/matrix-org/matrix-react-sdk/pull/719)
 * Allow setting the default HS from the query parameter
   [\#716](https://github.com/matrix-org/matrix-react-sdk/pull/716)
 * first cut of improving UX for deleting devices.
   [\#717](https://github.com/matrix-org/matrix-react-sdk/pull/717)
 * Fix block quotes all being on a single line
   [\#711](https://github.com/matrix-org/matrix-react-sdk/pull/711)
 * Support reasons for kick / ban
   [\#710](https://github.com/matrix-org/matrix-react-sdk/pull/710)
 * Show when you've been kicked or banned
   [\#709](https://github.com/matrix-org/matrix-react-sdk/pull/709)
 * Add a 'Clear Cache' button
   [\#708](https://github.com/matrix-org/matrix-react-sdk/pull/708)
 * Update the room view on room name change
   [\#707](https://github.com/matrix-org/matrix-react-sdk/pull/707)
 * Add a button to un-ban users in RoomSettings
   [\#698](https://github.com/matrix-org/matrix-react-sdk/pull/698)
 * Use IndexedDBStore from the JS-SDK
   [\#687](https://github.com/matrix-org/matrix-react-sdk/pull/687)
 * Make UserSettings use the right teamToken
   [\#706](https://github.com/matrix-org/matrix-react-sdk/pull/706)
 * If the home page is somehow accessed, goto directory
   [\#705](https://github.com/matrix-org/matrix-react-sdk/pull/705)
 * Display avatar initials in typing notifications
   [\#699](https://github.com/matrix-org/matrix-react-sdk/pull/699)
 * fix eslint's no-invalid-this rule for class properties
   [\#703](https://github.com/matrix-org/matrix-react-sdk/pull/703)
 * If a referrer hasn't been specified, use empty string
   [\#701](https://github.com/matrix-org/matrix-react-sdk/pull/701)
 * Don't force-logout the user if reading localstorage fails
   [\#700](https://github.com/matrix-org/matrix-react-sdk/pull/700)
 * Convert some missed buttons to AccessibleButton
   [\#697](https://github.com/matrix-org/matrix-react-sdk/pull/697)
 * Make ban either ban or unban
   [\#696](https://github.com/matrix-org/matrix-react-sdk/pull/696)
 * Add confirmation dialog to kick/ban buttons
   [\#694](https://github.com/matrix-org/matrix-react-sdk/pull/694)
 * Fix typo with Scalar popup
   [\#695](https://github.com/matrix-org/matrix-react-sdk/pull/695)
 * Treat the literal team token string "undefined" as undefined
   [\#693](https://github.com/matrix-org/matrix-react-sdk/pull/693)
 * Store retrieved sid in the signupInstance of EmailIdentityStage
   [\#692](https://github.com/matrix-org/matrix-react-sdk/pull/692)
 * Split out InterActiveAuthDialog
   [\#691](https://github.com/matrix-org/matrix-react-sdk/pull/691)
 * View /home on registered /w team
   [\#689](https://github.com/matrix-org/matrix-react-sdk/pull/689)
 * Instead of sending userId, userEmail, send sid, client_secret
   [\#688](https://github.com/matrix-org/matrix-react-sdk/pull/688)
 * Enable branded URLs again by parsing the path client-side
   [\#686](https://github.com/matrix-org/matrix-react-sdk/pull/686)
 * Use new method of getting team icon
   [\#680](https://github.com/matrix-org/matrix-react-sdk/pull/680)
 * Persist query parameter team token across refreshes
   [\#685](https://github.com/matrix-org/matrix-react-sdk/pull/685)
 * Thread teamToken through to LeftPanel for "Home" button
   [\#684](https://github.com/matrix-org/matrix-react-sdk/pull/684)
 * Fix typing notif and status bar
   [\#682](https://github.com/matrix-org/matrix-react-sdk/pull/682)
 * Consider emails ending in matrix.org as a uni email
   [\#681](https://github.com/matrix-org/matrix-react-sdk/pull/681)
 * Set referrer qp in nextLink
   [\#679](https://github.com/matrix-org/matrix-react-sdk/pull/679)
 * Do not set team_token if not returned by RTS on login
   [\#678](https://github.com/matrix-org/matrix-react-sdk/pull/678)
 * Get team_token from the RTS on login
   [\#676](https://github.com/matrix-org/matrix-react-sdk/pull/676)
 * Quick and dirty support for custom welcome pages
   [\#550](https://github.com/matrix-org/matrix-react-sdk/pull/550)
 * RTS Welcome Pages
   [\#666](https://github.com/matrix-org/matrix-react-sdk/pull/666)
 * Logging to try to track down riot-web#3148
   [\#677](https://github.com/matrix-org/matrix-react-sdk/pull/677)

Changes in [0.8.6](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.6) (2017-02-04)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.6-rc.3...v0.8.6)

 * Update to matrix-js-sdk 0.7.5 (no changes from 0.7.5-rc.3)

Changes in [0.8.6-rc.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.6-rc.3) (2017-02-03)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.6-rc.2...v0.8.6-rc.3)

 * Update to matrix-js-sdk 0.7.5-rc.3
 * Fix deviceverifybuttons
   [5fd7410](https://github.com/matrix-org/matrix-react-sdk/commit/827b5a6811ac6b9d1f9a3002a94f9f6ac3f1d49c)


Changes in [0.8.6-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.6-rc.2) (2017-02-03)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.6-rc.1...v0.8.6-rc.2)

 * Update to new matrix-js-sdk to get support for new device change notifications interface


Changes in [0.8.6-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.6-rc.1) (2017-02-03)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.5...v0.8.6-rc.1)

 * Fix timeline & notifs panel spuriously being empty
   [\#675](https://github.com/matrix-org/matrix-react-sdk/pull/675)
 * UI for blacklisting unverified devices per-room & globally
   [\#636](https://github.com/matrix-org/matrix-react-sdk/pull/636)
 * Show better error message in statusbar after UnkDevDialog
   [\#674](https://github.com/matrix-org/matrix-react-sdk/pull/674)
 * Make default avatars clickable
   [\#673](https://github.com/matrix-org/matrix-react-sdk/pull/673)
 * Fix one read receipt randomly not appearing
   [\#672](https://github.com/matrix-org/matrix-react-sdk/pull/672)
 * very barebones support for warning users when rooms contain unknown devices
   [\#635](https://github.com/matrix-org/matrix-react-sdk/pull/635)
 * Fix expanding/unexapnding read receipts
   [\#671](https://github.com/matrix-org/matrix-react-sdk/pull/671)
 * show placeholder when timeline empty
   [\#670](https://github.com/matrix-org/matrix-react-sdk/pull/670)
 * Make read receipt's titles more explanatory
   [\#669](https://github.com/matrix-org/matrix-react-sdk/pull/669)
 * Fix spurious HTML tags being passed through literally
   [\#667](https://github.com/matrix-org/matrix-react-sdk/pull/667)
 * Reinstate max-len lint configs
   [\#665](https://github.com/matrix-org/matrix-react-sdk/pull/665)
 * Throw errors on !==200 status codes from RTS
   [\#662](https://github.com/matrix-org/matrix-react-sdk/pull/662)
 * Exempt lines which look like pure JSX from the maxlen line
   [\#664](https://github.com/matrix-org/matrix-react-sdk/pull/664)
 * Make tests pass on Chrome again
   [\#663](https://github.com/matrix-org/matrix-react-sdk/pull/663)
 * Add referral section to user settings
   [\#661](https://github.com/matrix-org/matrix-react-sdk/pull/661)
 * Two megolm export fixes:
   [\#660](https://github.com/matrix-org/matrix-react-sdk/pull/660)
 * GET /teams from RTS instead of config.json
   [\#658](https://github.com/matrix-org/matrix-react-sdk/pull/658)
 * Guard onStatusBarVisible/Hidden with this.unmounted
   [\#656](https://github.com/matrix-org/matrix-react-sdk/pull/656)
 * Fix cancel button on e2e import/export dialogs
   [\#654](https://github.com/matrix-org/matrix-react-sdk/pull/654)
 * Look up email addresses in ChatInviteDialog
   [\#653](https://github.com/matrix-org/matrix-react-sdk/pull/653)
 * Move BugReportDialog to riot-web
   [\#652](https://github.com/matrix-org/matrix-react-sdk/pull/652)
 * Fix dark theme styling of roomheader cancel button
   [\#651](https://github.com/matrix-org/matrix-react-sdk/pull/651)
 * Allow modals to stack up
   [\#649](https://github.com/matrix-org/matrix-react-sdk/pull/649)
 * Add bug report UI
   [\#642](https://github.com/matrix-org/matrix-react-sdk/pull/642)
 * Better feedback in invite dialog
   [\#625](https://github.com/matrix-org/matrix-react-sdk/pull/625)
 * Import and export for Megolm session data
   [\#647](https://github.com/matrix-org/matrix-react-sdk/pull/647)
 * Overhaul MELS to deal with causality, kicks, etc.
   [\#613](https://github.com/matrix-org/matrix-react-sdk/pull/613)
 * Re-add dispatcher as alt-up/down uses it
   [\#650](https://github.com/matrix-org/matrix-react-sdk/pull/650)
 * Create a common BaseDialog
   [\#645](https://github.com/matrix-org/matrix-react-sdk/pull/645)
 * Fix SetDisplayNameDialog
   [\#648](https://github.com/matrix-org/matrix-react-sdk/pull/648)
 * Sync typing indication with avatar typing indication
   [\#643](https://github.com/matrix-org/matrix-react-sdk/pull/643)
 * Warn users of E2E key loss when changing/resetting passwords or logging out
   [\#646](https://github.com/matrix-org/matrix-react-sdk/pull/646)
 * Better user interface for screen readers and keyboard navigation
   [\#616](https://github.com/matrix-org/matrix-react-sdk/pull/616)
 * Reduce log spam: Revert a16aeeef2a0f16efedf7e6616cdf3c2c8752a077
   [\#644](https://github.com/matrix-org/matrix-react-sdk/pull/644)
 * Expand timeline in situations when _getIndicator not null
   [\#641](https://github.com/matrix-org/matrix-react-sdk/pull/641)
 * Correctly get the path of the js-sdk .eslintrc.js
   [\#640](https://github.com/matrix-org/matrix-react-sdk/pull/640)
 * Add 'searching known users' to the user picker
   [\#621](https://github.com/matrix-org/matrix-react-sdk/pull/621)
 * Add mocha env for tests in eslint config
   [\#639](https://github.com/matrix-org/matrix-react-sdk/pull/639)
 * Fix typing avatars displaying "me"
   [\#637](https://github.com/matrix-org/matrix-react-sdk/pull/637)
 * Fix device verification from e2e info
   [\#638](https://github.com/matrix-org/matrix-react-sdk/pull/638)
 * Make user search do a bit better on word boundary
   [\#623](https://github.com/matrix-org/matrix-react-sdk/pull/623)
 * Use an eslint config based on the js-sdk
   [\#634](https://github.com/matrix-org/matrix-react-sdk/pull/634)
 * Fix error display in account deactivate dialog
   [\#633](https://github.com/matrix-org/matrix-react-sdk/pull/633)
 * Configure travis to test riot-web after building
   [\#629](https://github.com/matrix-org/matrix-react-sdk/pull/629)
 * Sanitize ChatInviteDialog
   [\#626](https://github.com/matrix-org/matrix-react-sdk/pull/626)
 * (hopefully) fix theming on Chrome
   [\#630](https://github.com/matrix-org/matrix-react-sdk/pull/630)
 * Megolm session import and export
   [\#617](https://github.com/matrix-org/matrix-react-sdk/pull/617)
 * Allow Modal to be used with async-loaded components
   [\#618](https://github.com/matrix-org/matrix-react-sdk/pull/618)
 * Fix escaping markdown by rendering plaintext
   [\#622](https://github.com/matrix-org/matrix-react-sdk/pull/622)
 * Implement auto-join rooms on registration
   [\#628](https://github.com/matrix-org/matrix-react-sdk/pull/628)
 * Matthew/fix theme npe
   [\#627](https://github.com/matrix-org/matrix-react-sdk/pull/627)
 * Implement theming via alternate stylesheets
   [\#624](https://github.com/matrix-org/matrix-react-sdk/pull/624)
 * Replace marked with commonmark
   [\#575](https://github.com/matrix-org/matrix-react-sdk/pull/575)
 * Fix vector-im/riot-web#2833 : Fail nicely when people try to register
   numeric user IDs
   [\#619](https://github.com/matrix-org/matrix-react-sdk/pull/619)
 * Show the error dialog when requests to PUT power levels fail
   [\#614](https://github.com/matrix-org/matrix-react-sdk/pull/614)

Changes in [0.8.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.5) (2017-01-16)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.5-rc.1...v0.8.5)

 * Pull in newer matrix-js-sdk for video calling fix

Changes in [0.8.5-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.5-rc.1) (2017-01-13)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.4...v0.8.5-rc.1)

 * Build the js-sdk in the CI script
   [\#612](https://github.com/matrix-org/matrix-react-sdk/pull/612)
 * Fix redacted member events being visible
   [\#609](https://github.com/matrix-org/matrix-react-sdk/pull/609)
 * Use `getStateKey` instead of `getSender`
   [\#611](https://github.com/matrix-org/matrix-react-sdk/pull/611)
 * Move screen sharing error check into platform
   [\#608](https://github.com/matrix-org/matrix-react-sdk/pull/608)
 * Fix 'create account' link in 'forgot password'
   [\#606](https://github.com/matrix-org/matrix-react-sdk/pull/606)
 * Let electron users complete captchas in a web browser
   [\#601](https://github.com/matrix-org/matrix-react-sdk/pull/601)
 * Add support for deleting threepids
   [\#597](https://github.com/matrix-org/matrix-react-sdk/pull/597)
 * Display msisdn threepids as 'Phone'
   [\#598](https://github.com/matrix-org/matrix-react-sdk/pull/598)

Changes in [0.8.4](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.4) (2016-12-24)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.3...v0.8.4)

 * Fix signup by working around the fact that reCapture doesn't work on electron
 * Fix windows shortcut link

Changes in [0.8.3](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.3) (2016-12-22)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.2...v0.8.3)

 * Revert performance fix for wantsDateSeperator which was causing date separators to
   be shown at the wrong time of day.
 * Unbranded error messages
   [\#599](https://github.com/matrix-org/matrix-react-sdk/pull/599)
 * Fix scroll jumping when a video is decrypted
   [\#594](https://github.com/matrix-org/matrix-react-sdk/pull/594)

Changes in [0.8.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.2) (2016-12-16)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.1...v0.8.2)

 * Improve the performance of MemberEventListSummary
   [\#590](https://github.com/matrix-org/matrix-react-sdk/pull/590)
 * Implement bulk invite rejections
   [\#592](https://github.com/matrix-org/matrix-react-sdk/pull/592)
 * Fix performance issues with wantsDateSeperator
   [\#591](https://github.com/matrix-org/matrix-react-sdk/pull/591)
 * Add read receipt times to the hovertip of read markers
   [\#586](https://github.com/matrix-org/matrix-react-sdk/pull/586)
 * Don't throw exception on stop if no DMRoomMap
   [\#589](https://github.com/matrix-org/matrix-react-sdk/pull/589)
 * Fix failing test
   [\#587](https://github.com/matrix-org/matrix-react-sdk/pull/587)

Changes in [0.8.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.1) (2016-12-09)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.1-rc.2...v0.8.1)

No changes

Changes in [0.8.1-rc.2](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.1-rc.2) (2016-12-06)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.1-rc.1...v0.8.1-rc.2)

 * Fix exception when clearing room dir search
   [\#585](https://github.com/matrix-org/matrix-react-sdk/pull/585)
 * Allow integration UI URLs with paths
   [\#583](https://github.com/matrix-org/matrix-react-sdk/pull/583)
 * Give the search box field a name
   [\#584](https://github.com/matrix-org/matrix-react-sdk/pull/584)
 * Pass the room object into displayNotification
   [\#582](https://github.com/matrix-org/matrix-react-sdk/pull/582)
 * Don't throw an exception entering settings page
   [\#581](https://github.com/matrix-org/matrix-react-sdk/pull/581)

Changes in [0.8.1-rc.1](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.1-rc.1) (2016-12-05)
=============================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.8.0...v0.8.1-rc.1)

 * Strip (IRC) when clicking on username
   [\#579](https://github.com/matrix-org/matrix-react-sdk/pull/579)
 * Fix scroll jump on image decryption
   [\#577](https://github.com/matrix-org/matrix-react-sdk/pull/577)
 * Make cut operations update the tab complete list
   [\#576](https://github.com/matrix-org/matrix-react-sdk/pull/576)
 * s/block/blacklist for e2e
   [\#574](https://github.com/matrix-org/matrix-react-sdk/pull/574)
 * Fix the download icon on attachments
   [\#573](https://github.com/matrix-org/matrix-react-sdk/pull/573)
 * Don't default the page_type to room directory
   [\#572](https://github.com/matrix-org/matrix-react-sdk/pull/572)
 * Fix crash on logging in
   [\#571](https://github.com/matrix-org/matrix-react-sdk/pull/571)
 * Reinstate missing sections from the UserSettings
   [\#569](https://github.com/matrix-org/matrix-react-sdk/pull/569)
 * Bump browser-encrypt-attachment to v0.2.0
   [\#568](https://github.com/matrix-org/matrix-react-sdk/pull/568)
 * Make the unpagination process less aggressive
   [\#567](https://github.com/matrix-org/matrix-react-sdk/pull/567)
 * Get rid of always-on labs settings
   [\#566](https://github.com/matrix-org/matrix-react-sdk/pull/566)
 * Fix 'Quote' for e2e messages
   [\#565](https://github.com/matrix-org/matrix-react-sdk/pull/565)

Changes in [0.8.0](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.8.0) (2016-11-19)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.7.5...v0.8.0)

 * Fix more membership change collapsing bugs
   [\#560](https://github.com/matrix-org/matrix-react-sdk/pull/560)
 * Show an open padlock for unencrypted rooms
   [\#557](https://github.com/matrix-org/matrix-react-sdk/pull/557)
 * Clean up MFileBody.presentableTextForFile
   [\#558](https://github.com/matrix-org/matrix-react-sdk/pull/558)
 * Update eventtiles when the events are decrypted
   [\#556](https://github.com/matrix-org/matrix-react-sdk/pull/556)
 * Update EventTile to use WithMatrixClient instead of MatrixClientPeg
   [\#552](https://github.com/matrix-org/matrix-react-sdk/pull/552)
 * Disable conference calling for encrypted rooms
   [\#549](https://github.com/matrix-org/matrix-react-sdk/pull/549)
 * Encrypt attachments in encrypted rooms
   [\#548](https://github.com/matrix-org/matrix-react-sdk/pull/548)
 * Fix MemberAvatar PropTypes & MemberEventListSummary key
   [\#547](https://github.com/matrix-org/matrix-react-sdk/pull/547)
 * Revert "Encrypt attachments in encrypted rooms,"
   [\#546](https://github.com/matrix-org/matrix-react-sdk/pull/546)
 * Fix the vector web version in UserSettings
   [\#542](https://github.com/matrix-org/matrix-react-sdk/pull/542)
 * Truncate consecutive member events
   [\#544](https://github.com/matrix-org/matrix-react-sdk/pull/544)
 * Encrypt attachments in encrypted rooms,
   [\#533](https://github.com/matrix-org/matrix-react-sdk/pull/533)
 * Fix the ctrl+e mute camera shortcut
   [\#545](https://github.com/matrix-org/matrix-react-sdk/pull/545)
 * Show the error that occured when trying to reach scalar
   [\#543](https://github.com/matrix-org/matrix-react-sdk/pull/543)
 * Don't do URL previews for matrix.to
   [\#541](https://github.com/matrix-org/matrix-react-sdk/pull/541)
 * Fix NPE in LoggedInView
   [\#540](https://github.com/matrix-org/matrix-react-sdk/pull/540)
 * Make room alias & user ID links matrix.to links
   [\#538](https://github.com/matrix-org/matrix-react-sdk/pull/538)
 * Make MemberInfo use the matrixclient from the context
   [\#537](https://github.com/matrix-org/matrix-react-sdk/pull/537)
 * Add the MatrixClient to the react context
   [\#536](https://github.com/matrix-org/matrix-react-sdk/pull/536)
 * Factor out LoggedInView from MatrixChat
   [\#535](https://github.com/matrix-org/matrix-react-sdk/pull/535)
 * Move 'new version' support into Platform
   [\#532](https://github.com/matrix-org/matrix-react-sdk/pull/532)
 * Move Notifications into Platform
   [\#534](https://github.com/matrix-org/matrix-react-sdk/pull/534)
 * Move platform-specific functionality into Platform
   [\#531](https://github.com/matrix-org/matrix-react-sdk/pull/531)

Changes in [0.7.5](https://github.com/matrix-org/matrix-react-sdk/releases/tag/v0.7.5) (2016-11-04)
===================================================================================================
[Full Changelog](https://github.com/matrix-org/matrix-react-sdk/compare/v0.7.5-rc.1...v0.7.5)

 * No changes

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
 * Add a fallback homeserver to log into
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
