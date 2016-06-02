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
