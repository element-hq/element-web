# Configuration

### 🦖 Deprecation notice

Configuration keys were previously a mix of camelCase and snake_case.
We standardised to snake_case but added compatibility for camelCase to all settings.
This backwards compatibility will be getting removed in a future release so please ensure you are using snake_case.

---

You can configure the app by copying `config.sample.json` to `config.json` or `config.$domain.json` and customising it.
Element will attempt to load first `config.$domain.json` and if it fails `config.json`. This mechanism allows different
configuration options depending on if you're hitting e.g. `app1.example.com` or `app2.example.com`. Configs are not mixed
in any way, it either entirely uses the domain config, or entirely uses `config.json`.

The possible configuration options are described here. If you run into issues, please visit
[#element-web:matrix.org](https://matrix.to/#/#element-web:matrix.org) on Matrix.

For a good example of a production-tuned config, see https://app.element.io/config.json

For an example of a development/beta-tuned config, see https://develop.element.io/config.json

After changing the config, the app will need to be reloaded. For web browsers this is a simple page refresh, however
for the desktop app the application will need to be exited fully (including via the task tray) and re-started.

## Homeserver configuration

In order for Element to even start you will need to tell it what homeserver to connect to _by default_. Users will be
able to use a different homeserver if they like, though this can be disabled with `"disable_custom_urls": true` in your
config.

One of the following options **must** be supplied:

1. `default_server_config`: The preferred method of setting the homeserver connection information. Simply copy/paste
   your [`/.well-known/matrix/client`](https://spec.matrix.org/latest/client-server-api/#getwell-knownmatrixclient)
   into this field. For example:
    ```json
    {
        "default_server_config": {
            "m.homeserver": {
                "base_url": "https://matrix-client.matrix.org"
            },
            "m.identity_server": {
                "base_url": "https://vector.im"
            }
        }
    }
    ```
2. `default_server_name`: A different method of connecting to the homeserver by looking up the connection information
   using `.well-known`. When using this option, simply use your server's domain name (the part at the end of user IDs):
   `"default_server_name": "matrix.org"`
3. <del>`default_hs_url` and (optionally) `default_is_url`</del>: A very deprecated method of defining the connection
   information. These are the same values seen as `base_url` in the `default_server_config` example, with `default_is_url`
   being optional.

If both `default_server_config` and `default_server_name` are used, Element will try to look up the connection
information using `.well-known`, and if that fails, take `default_server_config` as the homeserver connection
information.

## Labs flags

Labs flags are optional, typically beta or in-development, features that can be turned on or off. The full range of
labs flags and their development status are documented [here](./labs.md). If interested, the feature flag process is
documented [here](./feature-flags.md).

To force a labs flag on or off, use the following:

```json
{
    "features": {
        "feature_you_want_to_turn_on": true,
        "feature_you_want_to_keep_off": false
    }
}
```

If you'd like the user to be able to self-select which labs flags they can turn on, add `"show_labs_settings": true` to
your config. This will turn on the tab in user settings.

**Note**: Feature support varies release-by-release. Check the [labs flag documentation](./labs.md) frequently if enabling
the functionality.

## Default settings

Some settings additionally support being specified at the config level to affect the user experience of your Element Web
instance. As of writing those settings are not fully documented, however a few are:

1. `default_federate`: When `true` (default), rooms will be marked as "federatable" during creation. Typically this setting
   shouldn't be used as the federation capabilities of a room **cannot** be changed after the room is created.
2. `default_country_code`: An optional ISO 3166 alpha2 country code (eg: `GB`, the default) to use when showing phone number
   inputs.
3. `room_directory`: Optionally defines how the room directory component behaves. Currently only a single property, `servers`
   is supported to add additional servers to the dropdown. For example:
    ```json
    {
        "room_directory": {
            "servers": ["matrix.org", "example.org"]
        }
    }
    ```
4. `setting_defaults`: Optional configuration for settings which are not described by this document and support the `config`
   level. This list is incomplete. For example:
    ```json
    {
        "setting_defaults": {
            "MessageComposerInput.showStickersButton": false,
            "MessageComposerInput.showPollsButton": false
        }
    }
    ```
    These values will take priority over the hardcoded defaults for the settings. For a list of available settings, see
    [Settings.tsx](https://github.com/element-hq/element-web/blob/develop/src/settings/Settings.tsx).

## Customisation & branding

<!-- Author's note: https://english.stackexchange.com/questions/570116/alternative-ways-of-saying-white-labeled -->

Element supports some customisation of the user experience through various branding and theme options. While it doesn't support
complete re-branding/private labeling, a more personalised experience can be achieved for your users.

1. `default_theme`: Typically either `light` (the default) or `dark`, this is the optional name of the colour theme to use.
   If using custom themes, this can be a theme name from that as well.
2. `default_device_display_name`: Optional public name for devices created by login and registration, instead of the default
   templated string. Note that this option does not support templating, currently.
3. `brand`: Optional name for the app. Defaults to `Element`. This is used throughout the application in various strings/locations.
4. `permalink_prefix`: An optional URL pointing to an Element Web deployment. For example, `https://app.element.io`. This will
   change all permalinks (via the "Share" menus) to point at the Element Web deployment rather than `matrix.to`.
5. `desktop_builds`: Optional. Where the desktop builds for the application are, if available. This is explained in more detail
   down below.
6. `mobile_builds`: Optional. Like `desktop_builds`, except for the mobile apps. Also described in more detail down below.
7. `mobile_guide_toast`: When `true` (default), users accessing the Element Web instance from a mobile device will be prompted to
   download the app instead.
8. `update_base_url`: For the desktop app only, the URL where to acquire update packages. If specified, must be a path to a directory
   containing `macos` and `win32` directories, with the update packages within. Defaults to `https://packages.element.io/desktop/update/`
   in production.
9. `map_style_url`: Map tile server style URL for location sharing. e.g. `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY_GOES_HERE`
   This setting is ignored if your homeserver provides `/.well-known/matrix/client` in its well-known location, and the JSON file
   at that location has a key `m.tile_server` (or the unstable version `org.matrix.msc3488.tile_server`). In this case, the
   configuration found in the well-known location is used instead.
10. `welcome_user_id`: **DEPRECATED** An optional user ID to start a DM with after creating an account. Defaults to nothing (no DM created).
11. `custom_translations_url`: An optional URL to allow overriding of translatable strings. The JSON file must be in a format of
    `{"affected|translation|key": {"languageCode": "new string"}}`. See https://github.com/matrix-org/matrix-react-sdk/pull/7886 for details.
12. `branding`: Options for configuring various assets used within the app. Described in more detail down below.
13. `embedded_pages`: Further optional URLs for various assets used within the app. Described in more detail down below.
14. `disable_3pid_login`: When `false` (default), **enables** the options to log in with email address or phone number. Set to
    `true` to hide these options.
15. `disable_login_language_selector`: When `false` (default), **enables** the language selector on the login pages. Set to `true`
    to hide this dropdown.
16. `disable_guests`: When `false` (default), **enable** guest-related functionality (peeking/previewing rooms, etc) for unregistered
    users. Set to `true` to disable this functionality.
17. `user_notice`: Optional notice to show to the user, e.g. for sunsetting a deployment and pushing users to move in their own time.
    Takes a configuration object as below:
    1. `title`: Required. Title to show at the top of the notice.
    2. `description`: Required. The description to use for the notice.
    3. `show_once`: Optional. If true then the notice will only be shown once per device.
18. `help_url`: The URL to point users to for help with the app, defaults to `https://element.io/help`.
19. `help_encryption_url`: The URL to point users to for help with encryption, defaults to `https://element.io/help#encryption`.
20. `force_verification`: If true, users must verify new logins (eg. with another device / their recovery key)

### `desktop_builds` and `mobile_builds`

These two options describe the various availability for the application. When the app needs to promote an alternative download,
such as trying to get the user to use an Android app or the desktop app for encrypted search, the config options will be looked
at to see if the link should be to somewhere else.

Starting with `desktop_builds`, the following subproperties are available:

1. `available`: Required. When `true`, the desktop app can be downloaded from somewhere.
2. `logo`: Required. A URL to a logo (SVG), intended to be shown at 24x24 pixels.
3. `url`: Required. The download URL for the app. This is used as a hyperlink.
4. `url_macos`: Optional. Direct link to download macOS desktop app.
5. `url_win32`: Optional. Direct link to download Windows 32-bit desktop app.
6. `url_win64`: Optional. Direct link to download Windows 64-bit desktop app.
7. `url_linux`: Optional. Direct link to download Linux desktop app.

When `desktop_builds` is not specified at all, the app will assume desktop downloads are available from https://element.io

For `mobile_builds`, the following subproperties are available:

1. `ios`: The URL for where to download the iOS app, such as an App Store link. When explicitly `null`, the app will assume the
   iOS app cannot be downloaded. When not provided, the default Element app will be assumed available.
2. `android`: The same as `ios`, except for Android instead.
3. `fdroid`: The same as `android`, except for FDroid instead.

Together, these two options might look like the following in your config:

```json
{
    "desktop_builds": {
        "available": true,
        "logo": "https://example.org/assets/logo-small.svg",
        "url": "https://example.org/not_element/download"
    },
    "mobile_builds": {
        "ios": null,
        "android": "https://example.org/not_element/android",
        "fdroid": "https://example.org/not_element/fdroid"
    }
}
```

### `branding` and `embedded_pages`

These two options point at various URLs for changing different internal pages (like the welcome page) and logos within the
application.

Starting with `branding`, the following subproperties are available:

1. `welcome_background_url`: When a string, the URL for the full-page image background of the login, registration, and welcome
   pages. This property can additionally be an array to have the app choose an image at random from the selections.
2. `auth_header_logo_url`: A URL to the logo used on the login, registration, etc pages.
3. `auth_footer_links`: A list of links to add to the footer during login, registration, etc. Each entry must have a `text` and
   `url` property.

`embedded_pages` can be configured as such:

1. `welcome_url`: A URL to an HTML page to show as a welcome page (landing on `#/welcome`). When not specified, the default
   `welcome.html` that ships with Element will be used instead.
2. `home_url`: A URL to an HTML page to show within the app as the "home" page. When the app doesn't have a room/screen to
   show the user, it will use the home page instead. The home page is additionally accessible from the user menu. By default,
   no home page is set and therefore a hardcoded landing screen is used. More documentation and examples are [here](./custom-home.md).
3. `login_for_welcome`: When `true` (default `false`), the app will use the login form as a welcome page instead of the welcome
   page itself. This disables use of `welcome_url` and all welcome page functionality.

Together, the options might look like this in your config:

```json
{
    "branding": {
        "welcome_background_url": "https://example.org/assets/background.jpg",
        "auth_header_logo_url": "https://example.org/assets/logo.svg",
        "auth_footer_links": [
            { "text": "FAQ", "url": "https://example.org/faq" },
            { "text": "Donate", "url": "https://example.org/donate" }
        ]
    },
    "embedded_pages": {
        "welcome_url": "https://example.org/assets/welcome.html",
        "home_url": "https://example.org/assets/home.html"
    }
}
```

Note that `index.html` also has an og:image meta tag that is set to an image hosted on element.io. This is the image used if
links to your copy of Element appear in some websites like Facebook, and indeed Element itself. This has to be static in the HTML
and an absolute URL (and HTTP rather than HTTPS), so it's not possible for this to be an option in config.json. If you'd like to
change it, you can build Element, but run `RIOT_OG_IMAGE_URL="http://example.com/logo.png" yarn build`. Alternatively, you can edit
the `og:image` meta tag in `index.html` directly each time you download a new version of Element.

## SSO setup

When Element is deployed alongside a homeserver with SSO-only login, some options to ease the user experience might want to be set:

1. `logout_redirect_url`: Optional URL to redirect the user to after they have logged out. Some SSO systems support a page that the
   user can be sent to in order to log them out of that system too, making logout symmetric between Element and the SSO system.
2. `sso_redirect_options`: Options to define how to handle unauthenticated users. If the object contains `"immediate": true`, then
   all unauthenticated users will be automatically redirected to the SSO system to start their login. If instead you'd only like to
   have users which land on the welcome page to be redirected, use `"on_welcome_page": true`. Additionally, there is an option to
   redirect anyone landing on the login page, by using `"on_login_page": true`. As an example:
    ```json
    {
        "sso_redirect_options": {
            "immediate": false,
            "on_welcome_page": true,
            "on_login_page": true
        }
    }
    ```
    It is most common to use the `immediate` flag instead of `on_welcome_page`.

## Native OIDC

Native OIDC support is currently in labs and is subject to change.

Static OIDC Client IDs are preferred and can be specified under `oidc_static_clients` as a mapping from `issuer` to configuration object containing `client_id`.
Issuer must have a trailing forward slash. As an example:

```json
{
    "oidc_static_clients": {
        "https://auth.example.com/": {
            "client_id": "example-client-id"
        }
    }
}
```

If a matching static client is not found, the app will attempt to dynamically register a client using metadata specified under `oidc_metadata`.
The app has sane defaults for the metadata properties below but on stricter policy identity providers they may not pass muster, e.g. `contacts` may be required.
The following subproperties are available:

1. `client_uri`: This is the base URI for the OIDC client registration, typically `logo_uri`, `tos_uri`, and `policy_uri` must be either on the same domain or a subdomain of this URI.
2. `logo_uri`: Optional URI for the client logo.
3. `tos_uri`: Optional URI for the client's terms of service.
4. `policy_uri`: Optional URI for the client's privacy policy.
5. `contacts`: Optional list of contact emails for the client.

As an example:

```json
{
    "oidc_metadata": {
        "client_uri": "https://example.com",
        "logo_uri": "https://example.com/logo.png",
        "tos_uri": "https://example.com/tos",
        "policy_uri": "https://example.com/policy",
        "contacts": ["support@example.com"]
    }
}
```

## VoIP / Jitsi calls

Currently, Element uses Jitsi to offer conference calls in rooms, with an experimental Element Call implementation in the works.
A set of defaults are applied, pointing at our Jitsi and Element Call instances, to ensure conference calling works, however you
can point Element at your own if you prefer.

More information about the Jitsi setup can be found [here](./jitsi.md).

The VoIP and Jitsi options are:

1. `jitsi`: Optional configuration for how to start Jitsi conferences. Currently can only contain a single `preferred_domain`
   value which points at the domain of the Jitsi instance. Defaults to `meet.element.io`. This is _not_ used if the Jitsi widget
   was created by an integration manager, or if the homeserver provides Jitsi information in `/.well-known/matrix/client`. For
   example:
    ```json
    {
        "jitsi": {
            "preferred_domain": "meet.jit.si"
        }
    }
    ```
2. `jitsi_widget`: Optional configuration for the built-in Jitsi widget. Currently can only contain a single `skip_built_in_welcome_screen`
   value, denoting whether the "Join Conference" button should be shown. When `true` (default `false`), Jitsi calls will skip to
   the call instead of having a screen with a single button on it. This is most useful if the Jitsi instance being used already
   has a landing page for users to test audio and video before joining the call, otherwise users will automatically join the call.
   For example:
    ```json
    {
        "jitsi_widget": {
            "skip_built_in_welcome_screen": true
        }
    }
    ```
3. `voip`: Optional configuration for various VoIP features. Currently can only contain a single `obey_asserted_identity` value to
   send MSC3086-style asserted identity messages during VoIP calls in the room corresponding to the asserted identity. This _must_
   only be set in trusted environments. The option defaults to `false`. For example:
    ```json
    {
        "voip": {
            "obey_asserted_identity": false
        }
    }
    ```
4. `widget_build_url`: Optional URL to have Element make a request to when a user presses the voice/video call buttons in the app,
   if a call would normally be started by the action. The URL will be called with a `roomId` query parameter to identify the room
   being called in. The URL must respond with a JSON object similar to the following:
    ```json
    {
        "widget_id": "$arbitrary_string",
        "widget": {
            "creatorUserId": "@user:example.org",
            "id": "$the_same_widget_id",
            "type": "m.custom",
            "waitForIframeLoad": true,
            "name": "My Widget Name Here",
            "avatar_url": "mxc://example.org/abc123",
            "url": "https://example.org/widget.html",
            "data": {
                "title": "Subtitle goes here"
            }
        },
        "layout": {
            "container": "top",
            "index": 0,
            "width": 65,
            "height": 50
        }
    }
    ```
    The `widget` is the `content` of a normal widget state event. The `layout` is the layout specifier for the widget being created,
    as defined by the `io.element.widgets.layout` state event. By default this applies to all rooms, but the behaviour can be skipped for
    2-person rooms, causing Element to fall back to 1:1 VoIP, by setting the option `widget_build_url_ignore_dm` to `true`.
5. `audio_stream_url`: Optional URL to pass to Jitsi to enable live streaming. This option is considered experimental and may be removed
   at any time without notice.
6. `element_call`: Optional configuration for native group calls using Element Call, with the following subkeys:
    - `url`: The URL of the Element Call instance to use for native group calls. This option is considered experimental
      and may be removed at any time without notice. Defaults to `https://call.element.io`.
    - `use_exclusively`: A boolean specifying whether Element Call should be used exclusively as the only VoIP stack in
      the app, removing the ability to start legacy 1:1 calls or Jitsi calls. Defaults to `false`.
    - `participant_limit`: The maximum number of users who can join a call; if
      this number is exceeded, the user will not be able to join a given call.
    - `brand`: Optional name for the app. Defaults to `Element Call`. This is
      used throughout the application in various strings/locations.
    - `guest_spa_url`: Optional URL for an Element Call single-page app (SPA),
      for guest links. If this is set, Element Web will expose a "join" link
      for public video rooms, which can then be shared to non-matrix users.
      The target Element Call SPA is typically set up to use a homeserver that
      allows users to register without email ("passwordless guest users") and to
      federate.

## Bug reporting

If you run your own rageshake server to collect bug reports, the following options may be of interest:

1. `bug_report_endpoint_url`: URL for where to submit rageshake logs to. Rageshakes include feedback submissions and bug reports. When
   not present in the config, the app will disable all rageshake functionality. Set to `https://element.io/bugreports/submit` to submit
   rageshakes to us, or use your own rageshake server.
2. `uisi_autorageshake_app`: If a user has enabled the "automatically send debug logs on decryption errors" flag, this option will be sent
   alongside the rageshake so the rageshake server can filter them by app name. By default, this will be `element-auto-uisi`
   (in contrast to other rageshakes submitted by the app, which use `element-web`).
3. `existing_issues_url`: URL for where to find existing issues.
4. `new_issue_url`: URL for where to submit new issues.

If you would like to use [Sentry](https://sentry.io/) for rageshake data, add a `sentry` object to your config with the following values:

1. `dsn`: The Sentry [DSN](https://docs.sentry.io/product/sentry-basics/dsn-explainer/).
2. `environment`: Optional [environment](https://docs.sentry.io/product/sentry-basics/environments/) to pass to Sentry.

For example:

```json
{
    "sentry": {
        "dsn": "dsn-goes-here",
        "environment": "production"
    }
}
```

## Integration managers

Integration managers are embedded applications within Element to help the user configure bots, bridges, and widgets. An integration manager
is a separate piece of software not typically available with your homeserver. To disable integrations, set the options defined here to `null`.

1. `integrations_ui_url`: The UI URL for the integration manager.
2. `integrations_rest_url`: The REST interface URL for the integration manager.
3. `integrations_widgets_urls`: A list of URLs the integration manager uses to host widgets.

If you would like to use Scalar, the integration manager maintained by Element, the following options would apply:

```json
{
    "integrations_ui_url": "https://scalar.vector.im/",
    "integrations_rest_url": "https://scalar.vector.im/api",
    "integrations_widgets_urls": [
        "https://scalar.vector.im/_matrix/integrations/v1",
        "https://scalar.vector.im/api",
        "https://scalar-staging.vector.im/_matrix/integrations/v1",
        "https://scalar-staging.vector.im/api",
        "https://scalar-staging.riot.im/scalar/api"
    ]
}
```

For widgets in general (from an integration manager or not) there is also:

- `default_widget_container_height`

This controls the height that the top widget panel initially appears as and is the height in pixels, default 280.

## Administrative options

If you would like to include a custom message when someone is reporting an event, set the following Markdown-capable field:

```json
{
    "report_event": {
        "admin_message_md": "Please be sure to review our [terms of service](https://example.org/terms) before reporting a message."
    }
}
```

To add additional "terms and conditions" links throughout the app, use the following template:

```json
{
    "terms_and_conditions_links": [{ "text": "Code of conduct", "url": "https://example.org/code-of-conduct" }]
}
```

## Analytics

To configure [Posthog](https://posthog.com/), add the following under `posthog` in your config:

1. `api_host`: The hostname of the posthog server.
2. `project_api_key`: The API key from posthog.

When these configuration options are not present,
analytics are deemed impossible and the user won't be asked to opt in to the system.

There are additional root-level options which can be specified:

1. `analytics_owner`: the company name used in dialogs talking about analytics - this defaults to `brand`,
   and is useful when the provider of analytics is different from the provider of the Element instance.
2. `privacy_policy_url`: URL to the privacy policy including the analytics collection policy.

## Miscellaneous

Element supports other options which don't quite fit into other sections of this document.

To configure whether presence UI is shown for a given homeserver, set `enable_presence_by_hs_url`. It is recommended to
set this value to the following at a minimum:

```json
{
    "enable_presence_by_hs_url": {
        "https://matrix.org": false,
        "https://matrix-client.matrix.org": false
    }
}
```

## Identity servers

The identity server is used for inviting other users to a room via third party
identifiers like emails and phone numbers. It is not used to store your password
or account information.

As of Element 1.4.0, all identity server functions are optional and you are
prompted to agree to terms before data is sent to the identity server.

Element will check multiple sources when looking for an identity server to use in
the following order of preference:

1. The identity server set in the user's account data
    - For a new user, no value is present in their account data. It is only set
      if the user visits Settings and manually changes their identity server.
2. The identity server provided by the `.well-known` lookup that occurred at
   login
3. The identity server provided by the Riot config file

If none of these sources have an identity server set, then Element will prompt the
user to set an identity server first when attempting to use features that
require one.

Currently, the only two public identity servers are https://vector.im and
https://matrix.org, however in the future identity servers will be
decentralised.

## Desktop app configuration

See https://github.com/element-hq/element-desktop#user-specified-configjson

## UI Features

Parts of the UI can be disabled using UI features. These are settings which appear
under `setting_defaults` and can only be `true` (default) or `false`. When `false`,
parts of the UI relating to that feature will be disabled regardless of the user's
preferences.

Currently, the following UI feature flags are supported:

- `UIFeature.urlPreviews` - Whether URL previews are enabled across the entire application.
- `UIFeature.feedback` - Whether prompts to supply feedback are shown.
- `UIFeature.voip` - Whether or not VoIP is shown readily to the user. When disabled,
  Jitsi widgets will still work though they cannot easily be added.
- `UIFeature.widgets` - Whether or not widgets will be shown.
- `UIFeature.advancedSettings` - Whether or not sections titled "advanced" in room and
  user settings are shown to the user.
- `UIFeature.shareQrCode` - Whether or not the QR code on the share room/event dialog
  is shown.
- `UIFeature.shareSocial` - Whether or not the social icons on the share room/event dialog
  are shown.
- `UIFeature.identityServer` - Whether or not functionality requiring an identity server
  is shown. When disabled, the user will not be able to interact with the identity
  server (sharing email addresses, 3PID invites, etc).
- `UIFeature.thirdPartyId` - Whether or not UI relating to third party identifiers (3PIDs)
  is shown. Typically this is considered "contact information" on the homeserver, and is
  not directly related to the identity server.
- `UIFeature.registration` - Whether or not the registration page is accessible. Typically
  useful if accounts are managed externally.
- `UIFeature.passwordReset` - Whether or not the password reset page is accessible. Typically
  useful if accounts are managed externally.
- `UIFeature.deactivate` - Whether or not the deactivate account button is accessible. Typically
  useful if accounts are managed externally.
- `UIFeature.advancedEncryption` - Whether or not advanced encryption options are shown to the
  user.
- `UIFeature.roomHistorySettings` - Whether or not the room history settings are shown to the user.
  This should only be used if the room history visibility options are managed by the server.
- `UIFeature.TimelineEnableRelativeDates` - Display relative date separators (eg: 'Today', 'Yesterday') in the
  timeline for recent messages. When false day dates will be used.
- `UIFeature.BulkUnverifiedSessionsReminder` - Display popup reminders to verify or remove unverified sessions. Defaults
  to true.
- `UIFeature.locationSharing` - Whether or not location sharing menus will be shown.

## Undocumented / developer options

The following are undocumented or intended for developer use only.

1. `fallback_hs_url`
2. `sync_timeline_limit`
3. `dangerously_allow_unsafe_and_insecure_passwords`
4. `latex_maths_delims`: An optional setting to override the default delimiters used for maths parsing. See https://github.com/matrix-org/matrix-react-sdk/pull/5939 for details. Only used when `feature_latex_maths` is enabled.
5. `modules`: An optional list of modules to load. This is used for testing and development purposes only.
