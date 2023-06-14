# Settings Reference

This document serves as developer documentation for using "Granular Settings". Granular Settings allow users to specify
different values for a setting at particular levels of interest. For example, a user may say that in a particular room
they want URL previews off, but in all other rooms they want them enabled. The `SettingsStore` helps mask the complexity
of dealing with the different levels and exposes easy to use getters and setters.

## Levels

Granular Settings rely on a series of known levels in order to use the correct value for the scenario. These levels, in
order of priority, are:

-   `device` - The current user's device
-   `room-device` - The current user's device, but only when in a specific room
-   `room-account` - The current user's account, but only when in a specific room
-   `account` - The current user's account
-   `room` - A specific room (setting for all members of the room)
-   `config` - Values are defined by the `setting_defaults` key (usually) in `config.json`
-   `default` - The hardcoded default for the settings

Individual settings may control which levels are appropriate for them as part of the defaults. This is often to ensure
that room administrators cannot force account-only settings upon participants.

## Settings

Settings are the different options a user may set or experience in the application. These are pre-defined in
`src/settings/Settings.tsx` under the `SETTINGS` constant, and match the `ISetting` interface as defined there.

Settings that support the config level can be set in the config file under the `setting_defaults` key (note that some
settings, like the "theme" setting, are special cased in the config file):

```json5
{
  ...
  "setting_defaults": {
    "settingName": true
  },
  ...
}
```

### Getting values for a setting

After importing `SettingsStore`, simply make a call to `SettingsStore.getValue`. The `roomId` parameter should always
be supplied where possible, even if the setting does not have a per-room level value. This is to ensure that the value
returned is best represented in the room, particularly if the setting ever gets a per-room level in the future.

In settings pages it is often desired to have the value at a particular level instead of getting the calculated value.
Call `SettingsStore.getValueAt` to get the value of a setting at a particular level, and optionally make it explicitly
at that level. By default `getValueAt` will traverse the tree starting at the provided level; making it explicit means
it will not go beyond the provided level. When using `getValueAt`, please be sure to use `SettingLevel` to represent the
target level.

### Setting values for a setting

Values are defined at particular levels and should be done in a safe manner. There are two checks to perform to ensure a
clean save: is the level supported and can the user actually set the value. In most cases, neither should be an issue
although there are circumstances where this changes. An example of a safe call is:

```javascript
const isSupported = SettingsStore.isLevelSupported(SettingLevel.ROOM);
if (isSupported) {
    const canSetValue = SettingsStore.canSetValue("mySetting", "!curbf:matrix.org", SettingLevel.ROOM);
    if (canSetValue) {
        SettingsStore.setValue("mySetting", "!curbf:matrix.org", SettingLevel.ROOM, newValue);
    }
}
```

These checks may also be performed in different areas of the application to avoid the verbose example above. For
instance, the component which allows changing the setting may be hidden conditionally on the above conditions.

##### `SettingsFlag` component

Where possible, the `SettingsFlag` component should be used to set simple "flip-a-bit" (true/false) settings. The
`SettingsFlag` also supports simple radio button options, such as the theme the user would like to use.

```TSX
<SettingsFlag name="theSettingId" level={SettingsLevel.ROOM} roomId="!curbf:matrix.org"
    label={_td("Your label here")} // optional, if falsey then the `SettingsStore` will be used
    onChange={function(newValue) { }} // optional, called after saving
    isExplicit={false} // this is passed along to `SettingsStore.getValueAt`, defaulting to false
    manualSave={false} // if true, saving is delayed. You will need to call .save() on this component

    // Options for radio buttons
    group="your-radio-group" // this enables radio button support
    value="yourValueHere" // the value for this particular option
/>
```

### Getting the display name for a setting

Simply call `SettingsStore.getDisplayName`. The appropriate display name will be returned and automatically translated
for you. If a display name cannot be found, it will return `null`.

## Features

Feature flags are just like regular settings with some underlying semantics for how they are meant to be used. Usually
a feature flag is used when a portion of the application is under development or not ready for full release yet, such
as new functionality or experimental ideas. In these cases, the feature name _should_ be named with the `feature_*`
convention and must be tagged with `isFeature: true` in the setting definition. By doing so, the feature will automatically
appear in the "labs" section of the user's settings.

Features can be controlled at the config level using the following structure:

```json
"features": {
  "feature_lazyloading": true
}
```

When `true`, the user will see the feature as enabled. Similarly, when `false` the user will see the feature as disabled.
The user will only be able to change/see these states if `show_labs_settings: true` is in the config.

### Determining if a feature is enabled

Call `SettingsStore.getValue()` as you would for any other setting.

### Enabling a feature

Call `SettingsStore.setValue("feature_name", null, SettingLevel.DEVICE, true)`.

### A note on UI features

UI features are a different concept to plain features. Instead of being representative of unstable or
unpredicatable behaviour, they are logical chunks of UI which can be disabled by deployments for ease
of understanding with users. They are simply represented as boring settings with a convention of being
named as `UIFeature.$location` where `$location` is a rough descriptor of what is toggled, such as
`URLPreviews` or `Communities`.

UI features also tend to have their own setting controller (see below) to manipulate settings which might
be affected by the UI feature being disabled. For example, if URL previews are disabled as a UI feature
then the URL preview options will use the `UIFeatureController` to ensure they remain disabled while the
UI feature is disabled.

## Setting controllers

Settings may have environmental factors that affect their value or need additional code to be called when they are
modified. A setting controller is able to override the calculated value for a setting and react to changes in that
setting. Controllers are not a replacement for the level handlers and should only be used to ensure the environment is
kept up to date with the setting where it is otherwise not possible. An example of this is the notification settings:
they can only be considered enabled if the platform supports notifications, and enabling notifications requires
additional steps to actually enable notifications.

For more information, see `src/settings/controllers/SettingController.ts`.

## Local echo

`SettingsStore` will perform local echo on all settings to ensure that immediately getting values does not cause a
split-brain scenario. As mentioned in the "Setting values for a setting" section, the appropriate checks should be done
to ensure that the user is allowed to set the value. The local echo system assumes that the user has permission and that
the request will go through successfully. The local echo only takes effect until the request to save a setting has
completed (either successfully or otherwise).

```javascript
SettingsStore.setValue(...).then(() => {
  // The value has actually been stored at this point.
});
SettingsStore.getValue(...); // this will return the value set in `setValue` above.
```

## Watching for changes

Most use cases do not need to set up a watcher because they are able to react to changes as they are made, or the
changes which are made are not significant enough for it to matter. Watchers are intended to be used in scenarios where
it is important to react to changes made by other logged in devices. Typically, this would be done within the component
itself, however the component should not be aware of the intricacies of setting inversion or remapping to particular
data structures. Instead, a generic watcher interface is provided on `SettingsStore` to watch (and subsequently unwatch)
for changes in a setting.

An example of a watcher in action would be:

```javascript
class MyComponent extends React.Component {
    settingWatcherRef = null;

    componentWillMount() {
        const callback = (settingName, roomId, level, newValAtLevel, newVal) => {
            this.setState({ color: newVal });
        };
        this.settingWatcherRef = SettingsStore.watchSetting("roomColor", "!example:matrix.org", callback);
    }

    componentWillUnmount() {
        SettingsStore.unwatchSetting(this.settingWatcherRef);
    }
}
```

# Maintainers Reference

The granular settings system has a few complex parts to power it. This section is to document how the `SettingsStore` is
supposed to work.

### General information

The `SettingsStore` uses the hardcoded `LEVEL_ORDER` constant to ensure that it is using the correct override procedure.
The array is checked from left to right, simulating the behaviour of overriding values from the higher levels. Each
level should be defined in this array, including `default`.

Handlers (`src/settings/handlers/SettingsHandler.ts`) represent a single level and are responsible for getting and
setting values at that level. Handlers also provide additional information to the `SettingsStore` such as if the level
is supported or if the current user may set values at the level. The `SettingsStore` will use the handler to enforce
checks and manipulate settings. Handlers are also responsible for dealing with migration patterns or legacy settings for
their level (for example, a setting being renamed or using a different key from other settings in the underlying store).
Handlers are provided to the `SettingsStore` via the `LEVEL_HANDLERS` constant. `SettingsStore` will optimize lookups by
only considering handlers that are supported on the platform.

Local echo is achieved through `src/settings/handlers/LocalEchoWrapper.ts` which acts as a wrapper around a given
handler. This is automatically applied to all defined `LEVEL_HANDLERS` and proxies the calls to the wrapped handler
where possible. The echo is achieved by a simple object cache stored within the class itself. The cache is invalidated
immediately upon the proxied save call succeeding or failing.

Controllers are notified of changes by the `SettingsStore`, and are given the opportunity to override values after the
`SettingsStore` has deemed the value calculated. Controllers are invoked as the last possible step in the code.

### Features

See above for feature reference.

### Watchers

Watchers can appear complicated under the hood: there is a central `WatchManager` which handles the actual invocation
of callbacks, and callbacks are managed by the SettingsStore by redirecting the caller's callback to a dedicated
callback. This is done so that the caller can reuse the same function as their callback without worrying about whether
or not it'll unsubscribe all watchers.

Setting changes are emitted into the default `WatchManager`, which calculates the new value for the setting. Ideally,
we'd also try and suppress updates which don't have a consequence on this value, however there's not an easy way to do
this. Instead, we just dispatch an update for all changes and leave it up to the consumer to deduplicate.

In practice, handlers which rely on remote changes (account data, room events, etc) will always attach a listener to the
`MatrixClient`. They then watch for changes to events they care about and send off appropriate updates to the
generalized `WatchManager` - a class specifically designed to deduplicate the logic of managing watchers. The handlers
which are localized to the local client (device) generally just trigger the `WatchManager` when they manipulate the
setting themselves as there's nothing to really 'watch'.
