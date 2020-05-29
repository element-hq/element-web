# Settings Reference

This document serves as developer documentation for using "Granular Settings". Granular Settings allow users to specify 
different values for a setting at particular levels of interest. For example, a user may say that in a particular room 
they want URL previews off, but in all other rooms they want them enabled. The `SettingsStore` helps mask the complexity 
of dealing with the different levels and exposes easy to use getters and setters.


## Levels

Granular Settings rely on a series of known levels in order to use the correct value for the scenario. These levels, in 
order of prioirty, are:
* `device` - The current user's device
* `room-device` - The current user's device, but only when in a specific room
* `room-account` - The current user's account, but only when in a specific room
* `account` - The current user's account
* `room` - A specific room (setting for all members of the room)
* `config` - Values are defined by the `settingDefaults` key (usually) in `config.json`
* `default` - The hardcoded default for the settings

Individual settings may control which levels are appropriate for them as part of the defaults. This is often to ensure 
that room administrators cannot force account-only settings upon participants.


## Settings

Settings are the different options a user may set or experience in the application. These are pre-defined in 
`src/settings/Settings.js` under the `SETTINGS` constant and have the following minimum requirements:
```
// The ID is used to reference the setting throughout the application. This must be unique.
"theSettingId": {
  // The levels this setting supports is required. In `src/settings/Settings.js` there are various pre-set arrays
  // for this option - they should be used where possible to avoid copy/pasting arrays across settings.
  supportedLevels: [...],

  // The default for this setting serves two purposes: It provides a value if the setting is not defined at other
  // levels, and it serves to demonstrate the expected type to other developers. The value isn't enforced, but it
  // should be respected throughout the code. The default may be any data type.
  default: false,

  // The display name has two notations: string and object. The object notation allows for different translatable
  // strings to be used for different levels, while the string notation represents the string for all levels.

  displayName: _td("Change something"), // effectively `displayName: { "default": _td("Change something") }`
  displayName: {
    "room": _td("Change something for participants of this room"),

    // Note: the default will be used if the level requested (such as `device`) does not have a string defined here.
    "default": _td("Change something"),
  }
}
```

Settings that support the config level can be set in the config file under the `settingDefaults` key (note that some settings, like the "theme" setting, are special cased in the config file):
```json
{
  ...
  "settingDefaults": {
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
```html
<SettingsFlag name="theSettingId"
              level={SettingsLevel.ROOM}
              roomId="!curbf:matrix.org"
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

Occasionally some parts of the application may be undergoing testing and are not quite production ready. These are 
commonly known to be behind a "labs flag". Features behind lab flags must go through the granular settings system, and 
look and act very much normal settings. The exception is that they must supply `isFeature: true` as part of the setting 
definition and should go through the helper functions on `SettingsStore`.

Although features have levels and a default value, the calculation of those options is blocked by the feature's state. 
A feature's state is determined from the `SdkConfig` and is a little complex. If `enableLabs` (a legacy flag) is `true` 
then the feature's state is `labs`, if it is `false`, the state is `disable`. If `enableLabs` is not set then the state 
is determined from the `features` config, such as in the following:
```json
"features": {
    "feature_lazyloading": "labs"
}
```
In this example, `feature_lazyloading` is in the `labs` state. It may also be in the `enable` or `disable` state with a 
similar approach. If the state is invalid, the feature is in the `disable` state. A feature's levels are only calculated 
if it is in the `labs` state, therefore the default only applies in that scenario. If the state is `enable`, the feature 
is always-on.

Once a feature flag has served its purpose, it is generally recommended to remove it and the associated feature flag 
checks. This would enable the feature implicitly as it is part of the application now.

### Determining if a feature is enabled

A simple call to `SettingsStore.isFeatureEnabled` will tell you if the feature is enabled. This will perform all the 
required calculations to determine if the feature is enabled based upon the configuration and user selection.

### Enabling a feature

Features can only be enabled if the feature is in the `labs` state, otherwise this is a no-op. To find the current set 
of features in the `labs` state, call `SettingsStore.getLabsFeatures`. To set the value, call 
`SettingsStore.setFeatureEnabled`. 


## Setting controllers

Settings may have environmental factors that affect their value or need additional code to be called when they are 
modified. A setting controller is able to override the calculated value for a setting and react to changes in that 
setting. Controllers are not a replacement for the level handlers and should only be used to ensure the environment is 
kept up to date with the setting where it is otherwise not possible. An example of this is the notification settings: 
they can only be considered enabled if the platform supports notifications, and enabling notifications requires 
additional steps to actually enable notifications.

For more information, see `src/settings/controllers/SettingController.js`.


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
            this.setState({color: newVal});
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

Handlers (`src/settings/handlers/SettingsHandler.js`) represent a single level and are responsible for getting and 
setting values at that level. Handlers also provide additional information to the `SettingsStore` such as if the level 
is supported or if the current user may set values at the level. The `SettingsStore` will use the handler to enforce 
checks and manipulate settings. Handlers are also responsible for dealing with migration patterns or legacy settings for 
their level (for example, a setting being renamed or using a different key from other settings in the underlying store). 
Handlers are provided to the `SettingsStore` via the `LEVEL_HANDLERS` constant. `SettingsStore` will optimize lookups by 
only considering handlers that are supported on the platform.

Local echo is achieved through `src/settings/handlers/LocalEchoWrapper.js` which acts as a wrapper around a given 
handler. This is automatically applied to all defined `LEVEL_HANDLERS` and proxies the calls to the wrapped handler 
where possible. The echo is achieved by a simple object cache stored within the class itself. The cache is invalidated 
immediately upon the proxied save call succeeding or failing.

Controllers are notified of changes by the `SettingsStore`, and are given the opportunity to override values after the 
`SettingsStore` has deemed the value calculated. Controllers are invoked as the last possible step in the code.

### Features

Features automatically get considered as `disabled` if they are not listed in the `SdkConfig` or `enableLabs` is 
false/not set. Features are always checked against the configuration before going through the level order as they have 
the option of being forced-on or forced-off for the application. This is done by the `features` section and looks 
something like this:
 
```
"features": {
  "feature_groups": "enable",
  "feature_pinning": "disable", // the default
  "feature_presence": "labs"
}
```

If `enableLabs` is true in the configuration, the default for features becomes `"labs"`.

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
 
