# Beta features

Beta features are features that are not ready for production yet but the team
wants more people to try the features and give feedback on them.

Before a feature gets into its beta phase, it is often a labs feature (see
[Labs](https://github.com/vector-im/element-web/blob/develop/docs/labs.md)).

**Be warned! Beta features may not be completely finalised or stable!**

## Threaded Messaging (`feature_thread`)

Threading allows users to branch out a new conversation from the main timeline
of a room. This is particularly useful in high traffic rooms where multiple
conversations can happen in parallel or when a single discussion might stretch
over a very long period of time.

Threads can be access by clicking their summary below the root event on the room
timeline. Users can find a comprehensive list of threads by click the icon on
the room header button.

This feature might work in degraded mode if the homeserver a user is connected
to does not advertise support for the unstable feature `org.matrix.msc3440` when
calling the `/versions` API endpoint.

## Video rooms (`feature_video_rooms`)

Enables support for creating and joining video rooms, which are persistent video
chats that users can jump in and out of.
