Random notes from Matthew on the two possible approaches for warning users about unexpected
unverified devices popping up in their rooms....

Original idea...
================

Warn when an existing user adds an unknown device to a room.

Warn when a user joins the room with unverified or unknown devices.

Warn when you initial sync if the room has any unverified devices in it.
 ^ this is good enough if we're doing local storage.
 OR, better:
Warn when you initial sync if the room has any new undefined devices since you were last there.
 => This means persisting the rooms that devices are in, across initial syncs.


Updated idea...
===============

Warn when the user tries to send a message:
  - If the room has unverified devices which the user has not yet been told about in the context of this room
    ...or in the context of this user?  currently all verification is per-user, not per-room.
    ...this should be good enough.

  - so track whether we have warned the user or not about unverified devices - blocked, unverified, verified, unverified_warned.
    throw an error when trying to encrypt if there are pure unverified devices there
    app will have to search for the devices which are pure unverified to warn about them - have to do this from MembersList anyway?
      - or megolm could warn which devices are causing the problems.

Why do we wait to establish outbound sessions?  It just makes a horrible pause when we first try to send a message... but could otherwise unnecessarily consume resources?