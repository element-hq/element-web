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

1. Add a new
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
2. Check whether the feature is enabled as appropriate:
```js
    SettingsStore.isFeatureEnabled("feature_cats")
```
3. Add the feature to the set of labs on
   [develop](https://github.com/vector-im/riot-web/blob/develop/riot.im/develop/config.json)
   and [nightly](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/nightly/config.json):
```json
    "features": {
        "feature_cats": "labs"
    },
```
4. Document the feature in the [labs documentation](https://github.com/vector-im/riot-web/blob/develop/docs/labs.md)

With these steps completed, the feature is disabled by default, but can be
enabled on develop and nightly by interested users for testing.

Different features may have different deployment plans for when to enable where.
The following lists a few common options.

## Enabling by default on develop and nightly

Set the feature to `enable` in the
[develop](https://github.com/vector-im/riot-web/blob/develop/riot.im/develop/config.json)
and
[nightly](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/nightly/config.json)
configs:

```json
    "features": {
        "feature_cats": "enable"
    },
```

## Enabling by default on staging, app, and release

Set the feature to `enable` in the
[staging / app](https://github.com/vector-im/riot-web/blob/develop/riot.im/app/config.json)
and
[release](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/release/config.json)
configs.

**Warning:** While this does mean the feature is enabled by default for
https://riot.im and official Riot Desktop builds, it will not be enabled by
default for self-hosted installs, custom desktop builds, etc. To cover those
cases as well, the best options at the moment are converting to a regular
setting defaulted on or to remove the flag. Simply enabling the existing flag by
default in `Settings.js`
[does not work currently](https://github.com/vector-im/riot-web/issues/10360).

## Feature deployed successfully

Once we're confident that a feature is working well, we should remove the flag:

1. Remove the [setting](https://github.com/matrix-org/matrix-react-sdk/blob/develop/src/settings/Settings.js)
2. Remove all `isFeatureEnabled` lines that test for the feature's setting
3. Remove the feature from the [labs documentation](https://github.com/vector-im/riot-web/blob/develop/docs/labs.md)
4. Remove feature state from
   [develop](https://github.com/vector-im/riot-web/blob/develop/riot.im/develop/config.json),
   [nightly](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/nightly/config.json),
   [staging / app](https://github.com/vector-im/riot-web/blob/develop/riot.im/app/config.json),
   and
   [release](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/release/config.json)
   configs
5. Celebrate! 🥳

## Convert to a regular setting (optional)

Sometimes we decide a feature should always be user-controllable as a setting
even after it has been fully deployed. In that case, we would craft a new,
regular setting:

1. Remove the feature flag from
   [settings](https://github.com/matrix-org/matrix-react-sdk/blob/develop/src/settings/Settings.js)
   and add a regular setting with the appropriate levels for your feature
2. Replace the `isFeatureEnabled` lines with `getValue` or similar calls
   according to the [settings
   docs](https://github.com/matrix-org/matrix-react-sdk/blob/develop/docs/settings.md)
   (checking carefully, as we may want a different mix of code paths when the
   feature is always present but gated by a setting)
3. Remove the feature from the [labs documentation](https://github.com/vector-im/riot-web/blob/develop/docs/labs.md)
4. Remove feature state from
   [develop](https://github.com/vector-im/riot-web/blob/develop/riot.im/develop/config.json),
   [nightly](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/nightly/config.json),
   [staging / app](https://github.com/vector-im/riot-web/blob/develop/riot.im/app/config.json),
   and
   [release](https://github.com/vector-im/riot-desktop/blob/develop/riot.im/release/config.json)
   configs
