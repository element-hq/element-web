# Restricted Guests Module

A pair of modules to allow guests to register with Element using the Module API.

Users get a link to an ask to join room, enter their name, and can participate in the room without any further registration.

These guest users

- have a real user account on the Homeserver.
- get a username with the (configurable) pattern @guest-<random-identifier>.
- have a display name that always includes the (configurable) suffix (Guest).
- are restricted in what they can do (can't create rooms or participate in direct messages on the homeserver).
- are only temporary and will be deactivated after a lifetime of (configurable) 24 hours.

This was initially created to allow non-organisation members to join NeoDateFix meeting rooms, even if they don't have a user account in the private and potentially non-federated homeserver.

See further documentation in the Synapse and Element Web module directories.
