# Feature flags

When developing new features for Riot, we use feature flags to give us more
flexibility and control over when and where those features are enabled.

For example, flags make the following things possible:

* Extended testing of a feature via labs on develop
* Enabling features when ready instead of the first moment the code is released
* Testing a feature with a specific set of users (by enabling only on a specific
  Riot instance)

The size of the feature controlled by a feature flag may vary widely: it could
be a large project like reactions or a smaller change to an existing algorithm.
A large project might use several feature flags if it's useful to control the
deployment of different portions independently.

Everyone involved in a feature (engineering, design, product, reviewers) should
think about its deployment plan up front as best as possible so we can have the
right feature flags in place from the start.

## Interaction with spec process

Historically, we have often used feature flags to guard client features that
depend on unstable spec features. Unfortunately, there was never clear agreement
about how long such a flag should live for, when it should be removed, etc.

Under the [new spec
process](https://github.com/matrix-org/matrix-doc/pull/2324), server-side
unstable features can be used by clients and enabled by default as long as
clients commit to doing the associated clean up work once a feature stabilises.

## Starting work on a feature

When starting work on a feature, we should create a matching feature flag:

* Add a new
  [setting](https://github.com/matrix-org/matrix-react-sdk/blob/develop/src/settings/Settings.js)
  of the form:
```js
    "feature_cats": {
        isFeature: true,
        displayName: _td("Adds cats everywhere"),
        supportedLevels: LEVELS_FEATURE,
        default: false,
    },
```
* Check whether the feature is enabled as appropriate:
```js
    SettingsStore.isFeatureEnabled("feature_cats")
```
* Add the feature to the [set of labs on develop](../riot.im/develop/config.json):
```json
    "features": {
        "feature_cats": "labs"
    },
```
* Document the feature in the [labs documentation](labs.md)

With these steps completed, the feature is disabled by default, but can be
enabled on develop by interested users for testing.

Different features may have different deployment plans for when to enable where. The
following lists a few common options.

## Enabling by default on develop

Set the feature to `enable` in the [develop config](../riot.im/develop/config.json):

```json
    "features": {
        "feature_cats": "enable"
    },
```

## Enabling by default on staging and app

Set the feature to `enable` in the [app config](../riot.im/app/config.json).

## Feature deployed successfully

Once we're confident that a feature is working well, we should remove the flag:

* Remove the [setting](https://github.com/matrix-org/matrix-react-sdk/blob/develop/src/settings/Settings.js)
* Remove all `isFeatureEnabled` lines that test for the feature's setting
* Remove the feature from the [labs documentation](labs.md)
* Remove feature state from [develop](../riot.im/develop/config.json) and
  [app](../riot.im/app/config.json) configs
* Celebrate! 🥳
