# Settings Reference

This document serves as developer documentation for using "Granular Settings". Granular Settings allow users to specify different values for a setting at particular levels of interest. For example, a user may say that in a particular room they want URL previews off, but in all other rooms they want them enabled. The `SettingsStore` helps mask away the complexity of dealing with the different levels and exposes easy to use getters and setters.


## Levels

Granular Settings rely on a series of known levels in order to use the correct value for the scenario. These levels, in order of prioirty, are:
* `device` - The current user's device
* `room-device` - The current user's device, but only when in a specific room
* `room-account` - The current user's account, but only when in a specific room
* `account` - The current user's account
* `room` - A specific room (setting for all members of the room)
* `config` - Values are defined by `config.json`
* `default` - The hardcoded default for the settings

Individual settings may control which levels are appropriate for them as part of the defaults. This is often to ensure that room administrators cannot force account-only settings upon participants.


## `SettingsStore` Usage

`SettingsStore` has various utility functions exposed to deal with common tasks, such as translations, getting and setting values, and permission to change settings.


### Getting the value of a setting

For most cases the easiest way to get a setting's value is through `SettingsStore.getValue("the_setting", "!curbf:matrix.org")`. The first argument is the setting name and the second argument is the room ID. The room ID should be included where possible, although it is optional. 

Getting values at particular levels is rare and generally only needed to display information about that level. To get a value at a particular level, use `SettingsStore.getValueAt("room", "the_setting", "!curbf:matrix.org")`. The first argument is the level to read the value at, and the remaining two arguments are just like `getValue()`. This will by default take into consideration any levels that are more generic, if this is undesired (such as when dealing with room-level settings) set the fourth argument (`isExplicit`) to `true`.

TODO: {Travis} explain `isExplicit` better (when exactly do you use it?)


### Checking to make sure a user can change a setting

Users often would like to change settings, however they also often need permission to do so. `SettingsStore` exposes simple permission checks to ensure the user is able to change particular settings, allowing the UI to react accordingly. To see if a user can modify a setting, use `SettingsStore.canSetValue("room", "the_setting", "!curbf:matrix.org")`. The first argument is the level to check at, and the other two arguments are just like getting values.

TODO: {Travis} Also describe how `isLevelSupported` works.


### Setting values for a setting

Setting values for a setting is as simple as calling `SettingsStore.setValue("the_setting", "!curbf:matrix.org", "room", "the_value")`. The first argument is the setting name and the second is the room ID. Much like getting values, the room ID is optional but should be supplied whenever possible. The third argument is the level to set the value at, and finally the last argument is the value to set. The value may be anything. If the value is set to `null` or `undefined`, the level will become "unset", requiring more generic levels to provide a value for the setting.


### Getting translated names for settings

TODO: {Travis}


## Features

Features (also known as "labs settings") are major components of the SDK which may be undergoing testing before being considered stable and part of the SDK. Features are special cased in Granular Settings to ensure that users do not accidentally get features enabled when they should not be.


### Adding new features

TODO: {Travis}


### Checking if a feature is enabled

TODO: {Travis}


### Making features enabled

TODO: {Travis}


### Forcing features to be enabled or disabled

TODO: {Travis}


## Adding new settings

TODO: {Travis}


## `SettingsFlag` Component Usage

TODO: {Travis}


## Maintainer Documentation

TODO: {Travis}


### Handlers

TODO: {Travis}


### Level order

TODO: {Travis}


### Algorithm

TODO: {Travis}


### Features

TODO: {Travis}
