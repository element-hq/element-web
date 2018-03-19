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
