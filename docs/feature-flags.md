# Feature flags

When developing new features for Element, we use feature flags to give us more
flexibility and control over when and where those features are enabled.

For example, flags make the following things possible:

- Extended testing of a feature via labs on develop
- Enabling features when ready instead of the first moment the code is released
- Testing a feature with a specific set of users (by enabling only on a specific
  Element instance)

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
   [setting](https://github.com/element-hq/element-web/blob/develop/src/settings/Settings.tsx)
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
SettingsStore.getValue("feature_cats");
```

3. Document the feature in the [labs documentation](https://github.com/element-hq/element-web/blob/develop/docs/labs.md)

With these steps completed, the feature is disabled by default, but can be
enabled on develop and nightly by interested users for testing.

Different features may have different deployment plans for when to enable where.
The following lists a few common options.

## Enabling by default on develop and nightly

Set the feature to `true` in the
[develop](https://github.com/element-hq/element-web/blob/develop/element.io/develop/config.json)
and
[nightly](https://github.com/element-hq/element-desktop/blob/develop/element.io/nightly/config.json)
configs:

```json
    "features": {
        "feature_cats": true
    },
```

## Enabling by default on staging, app, and release

Set the feature to `true` in the
[staging / app](https://github.com/element-hq/element-web/blob/develop/element.io/app/config.json)
and
[release](https://github.com/element-hq/element-desktop/blob/develop/element.io/release/config.json)
configs.

**Note:** The above will only enable the feature for https://app.element.io and official Element
Desktop builds. It will not be enabled for self-hosted installed, custom desktop builds, etc. To
cover these cases, change the setting's `default` in `Settings.tsx` to `true`.

## Feature deployed successfully

Once we're confident that a feature is working well, we should remove or convert the flag.

If the feature is meant to be turned off/on by the user:

1. Remove `isFeature` from the [setting](https://github.com/element-hq/element-web/blob/develop/src/settings/Settings.ts)
2. Change the `default` to `true` (if desired).
3. Remove the feature from the [labs documentation](https://github.com/element-hq/element-web/blob/develop/docs/labs.md)
4. Celebrate! 🥳

If the feature is meant to be forced on (non-configurable):

1. Remove the [setting](https://github.com/element-hq/element-web/blob/develop/src/settings/Settings.ts)
2. Remove all `getValue` lines that test for the feature.
3. Remove the feature from the [labs documentation](https://github.com/element-hq/element-web/blob/develop/docs/labs.md)
4. If applicable, remove the feature state from
   [develop](https://github.com/element-hq/element-web/blob/develop/element.io/develop/config.json),
   [nightly](https://github.com/element-hq/element-desktop/blob/develop/element.io/nightly/config.json),
   [staging / app](https://github.com/element-hq/element-web/blob/develop/element.io/app/config.json),
   and
   [release](https://github.com/element-hq/element-desktop/blob/develop/element.io/release/config.json)
   configs
5. Celebrate! 🥳
