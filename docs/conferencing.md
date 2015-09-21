# VoIP Conferencing

This is a draft proposal for a naive voice/video conferencing implementation for
Matrix clients.  There are many possible conferencing architectures possible for
Matrix (Multipoint Conferencing Unit (MCU); Stream Forwarding Unit (SFU); Peer-
to-Peer mesh (P2P), etc; events shared in the group room; events shared 1:1;
possibly even out-of-band signalling).

This is a starting point for a naive MCU implementation which could provide one
possible Matrix-wide solution in  future, which retains backwards compatibility
with standard 1:1 calling.

 * A client chooses to initiate a conference for a given room by starting a
   voice or video call with a 'conference focus' user.  This is a virtual user
   (typically Application Service) which implements a conferencing bridge.  It
   isn't defined how the client discovers or selects this user.

 * The conference focus user MUST join the room in which the client has
   initiated the conference - this may require the client to invite the
   conference focus user to the room, depending on the room's `join_rules`. The
   conference focus user needs to be in the room to let the bridge eject users
   from the conference who have left the room in which it was initiated, and aid
   discovery of the conference by other users in the room.  The bridge
   identifies the room to join based on the user ID by which it was invited.
   The format of this identifier is implementation dependent for now.

 * If a client leaves the group chat room, they MUST be ejected from the
   conference. If a client leaves the 1:1 room with the conference focus user,
   they SHOULD be ejected from the conference.

 * For now, rooms can contain multiple conference focus users - it's left to
   user or client implementation to select which to converge on.  In future this
   could be mediated using a state event (e.g. `im.vector.call.mcu`), but we
   can't do that right now as by default normal users can't set arbitrary state
   events on a room.

 * To participate in the conference, other clients initiates a standard 1:1
   voice or video call to the conference focus user.

 * For best UX, clients SHOULD show the ongoing voice/video call in the UI
   context of the group room rather than 1:1 with the focus user.  If a client
   recognises a conference user present in the room, it MAY chose to highlight
   this in the UI (e.g. with a "conference ongoing" notification, to aid
   discovery).  Clients MAY hide the 1:1 room with the focus user (although in
   future this room could be used for floor control or other direct
   communication with the conference focus)

 * When all users have left the conference, the 'conference focus' user SHOULD
   leave the room.

 * If a conference focus user joins a room but does not receive a 1:1 voice or
   video call, it SHOULD time out after a period of time and leave the room.
