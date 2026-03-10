# Beta Features

A feature is marked as beta when it is nearly ready for production and the
team would like to gather wider feedback before turning it on by default.

Betas are visible to all users, [**including** users who have disabled labs settings
tab](./config.md)

**Be warned! Beta features are not considered stable and should not be relied upon!**

## Requirements

A beta feature MUST first become a labs feature before it can become a beta (see
[Labs](./labs.md)).

A beta feature MUST have an expected timeline to be upgraded to a stable feature. This timeline
should not exceed 3 months. If a feature persists in beta for longer and hasn't been explicitly
extended, the feature MAY be backed out to labs.

A beta feature MUST have a rollback path for users to opt-out. If a feature is irreversible or
could corrupt a user's session or account, it should not be in beta.

A beta feature SHOULD have analytics so that the team can understand how many users
are using it.

## Current Betas

This is the current set of betas enabled in Element Web.

### Video rooms (`feature_video_rooms`)

Enables support for creating and joining video rooms, which are persistent video
chats that users can jump in and out of.

### New notifications settings (`feature_notification_settings2`) [Beta]

Replaces the legacy notification settings with a new one to manage push rules.

**Warning** This feature has options which are not backwards compatible, disabling
it may have unintended consequences.
