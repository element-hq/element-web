# Configuration

You can configure the app by copying `config.sample.json` to `config.json` and customising it. The file is in JSON
format and can often result in syntax errors when editing it - visit [#element-web:matrix.org](https://matrix.to/#/#element-web:matrix.org)
on Matrix if you run into issues. The possible options are described here.

For a good example of a production-tuned config, see https://app.element.io/config.json

For an example of a development/beta-tuned config, see https://develop.element.io/config.json

After changing the config, the app will need to be reloaded. For web browsers this is a simple page refresh, however
for the desktop app the application will need to be exited fully (including via the task tray) and re-started.

## Homeserver configuration

In order for Element to even start you will need to tell it what homeserver to connect to *by default*. Users will be
able to use a different homeserver if they like, though this can be disabled with `"disable_custom_urls": false` in your
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
2. `default_server_name`: A deprecated method of connecting to the homeserver by looking up the connection information
   using `.well-known`. When using this option, simply use your server's domain name (the part at the end of user IDs):
   `"default_server_name": "matrix.org"`
3. `default_hs_url` and (optionally) `default_is_url`: A very deprecated method of defining the connection information.
   These are the same values seen as `base_url` in the `default_server_config` example, with `default_is_url` being
   optional.

If a combination of these three methods is used then Element will fail to load. This is because it is unclear which
should be considered "first".

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

If you'd like the user to be able to self-select which labs flags they can turn on, add `"show_labs_flags": true` to
your config. This will turn on the tab in user settings.

**Note**: Feature support varries release-by-release. Check the [labs flag documentation](./labs.md) frequently if enabling
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
   These values will take priority over the hardcoded defaults for the settings.

## Customisation & branding

<!-- Author's note: https://english.stackexchange.com/questions/570116/alternative-ways-of-saying-white-labeled -->

Element supports some customisation of the user experience through various branding and theme options. While it doesn't support
complete re-branding/private labeling, a more personalised experience can be achieved for your users.

1. `default_theme`: Typically either `"light"` (the default) or `"dark"`, this is the optional name of the colour theme to use.
   If using custom themes, this can be a theme name from that as well.
2. `default_device_display_name`: Optional public name for devices created by login and registration, instead of the default
   templated string. Note that this option does not support templating, currently.
3. `brand`: Optional name for the app. Defaults to `"Element"`. This is used throughout the application in various strings/locations.
4. `permalink_prefix`: An optional URL pointing to an Element Web deployment. For example, `"https://app.element.io"`. This will
   change all permalinks (via the "Share" menus) to point at the Element Web deployment rather than `matrix.to`.
5. `desktop_builds`: Optional. Where the desktop builds for the application are, if available. This is explained in more detail
   down below.
6. `mobile_builds`: Optional. Like `desktop_builds`, except for the mobile apps. Also described in more detail down below.
7. `mobile_guide_toast`: When `true` (default), users accessing the Element Web instance from a mobile device will be prompted to
   download the app instead.
8. `update_base_url`: For the desktop app only, the URL where to acquire update packages. If specified, must be a path to a directory
   containing `macos` and `win32` directories, with the update packages within. Defaults to `"https://packages.element.io/desktop/update/"`
   in production.
9. `map_style_url`: Map tile server style URL for location sharing. e.g. 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY_GOES_HERE'
   This setting is ignored if your homeserver provides `/.well-known/matrix/client` in its well-known location, and the JSON file
   at that location has a key `m.tile_server` (or the unstable version `org.matrix.msc3488.tile_server`). In this case, the
   configuration found in the well-known location is used instead.
10. `welcome_user_id`: An optional user ID to start a DM with after creating an account. Defaults to nothing (no DM created).
11. `custom_translations_url`: An optional URL to allow overriding of translatable strings. The JSON file must be in a format of
    `{"affected string": {"languageCode": "new string"}}`. See https://github.com/matrix-org/matrix-react-sdk/pull/7886 for details.
12. `branding`: Options for configuring various assets used within the app. Described in more detail down below.
13. `embedded_pages`: Further optional URLs for various assets used within the app. Described in more detail down below.
14. `disable_3pid_login`: When `false` (default), **enables** the options to log in with email address or phone number. Set to
    `true` to hide these options.
15. `disable_login_language_selector`: When `false` (default), **enables** the language selector on the login pages. Set to `true`
    to hide this dropdown.
16. `disable_guests`: When `false` (default), **enable** guest-related functionality (peeking/previewing rooms, etc) for unregistered
    users. Set to `true` to disable this functionality.

### `desktop_builds` and `mobile_builds`

These two options describe the various availability for the application. When the app needs to promote an alternative download,
such as trying to get the user to use an Android app or the desktop app for encrypted search, the config options will be looked
at to see if the link should be to somewhere else.

Starting with `desktop_builds`, the following subproperties are available:

1. `available`: Required. When `true`, the desktop app can be downloaded from somewhere.
2. `logo`: Required. A URL to a logo (SVG), intended to be shown at 24x24 pixels.
3. `url`: Required. The download URL for the app. This is used as a hyperlink.

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
   no home page is set and therefore a hardcoded landing screen is used.
3. `login_for_welcome`: When `true` (default `false`), the app will use the login form as a welcome page instead of the welcome
   page itself. This disables use of `welcome_url` and all welcome page functionality.

Together, the options might look like this in your config:

```json
{
   "branding": {
      "welcome_background_url": "https://example.org/assets/background.jpg",
      "auth_header_logo_url": "https://example.org/assets/logo.svg",
      "auth_footer_links": [
         {"text": "FAQ", "url": "https://example.org/faq"},
         {"text": "Donate", "url": "https://example.org/donate"},
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

TODO: @@TR Description of options for SSO-only deployments

## VoIP / Jitsi calls

TODO: @@TR

## Bug reporting

TODO: @@TR

## Integration managers

TODO: @@TR

## Administrative options

TODO: @@TR (report_event, terms_and_conditions_links)

## Analytics

TODO: @@TR

## Server hosting links

TODO: @@TR (EMS options)

## Miscellaneous

TODO: @@TR (latex_maths_delims, enable_presence_by_hs_url)

## Undocumented / developer options

The following are undocumented or intended for developer use only.

1. `fallback_hs_url`
2. `sync_timeline_limit`
3. `dangerously_allow_unsafe_and_insecure_passwords`

## TODO: @@TR: Copy sections below about identity servers and such

----------------------------------------

1. `default_server_config` sets the default homeserver and identity server URL for
   Element to use. The object is the same as returned by [https://<server_name>/.well-known/matrix/client](https://matrix.org/docs/spec/client_server/latest.html#get-well-known-matrix-client),
   with added support for a `server_name` under the `m.homeserver` section to display
   a custom homeserver name. Alternatively, the config can contain a `default_server_name`
   instead which is where Element will go to get that same object, although this option is
   deprecated - see the `.well-known` link above for more information on using this option.
   Note that the `default_server_name` is used to get a complete server configuration
   whereas the `server_name` in the `default_server_config` is for display purposes only.
   * *Note*: The URLs can also be individually specified as `default_hs_url` and
     `default_is_url`, however these are deprecated. They are maintained for backwards
     compatibility with older configurations. `default_is_url` is respected only
     if `default_hs_url` is used.
   * Element will fail to load if a mix of `default_server_config`, `default_server_name`, or
     `default_hs_url` is specified. When multiple sources are specified, it is unclear
     which should take priority and therefore the application cannot continue.
   * As of Element 1.4.0, identity servers are optional. See [Identity servers](#identity-servers) below.
1. `sso_redirect_options`: Optionally defines how Element will behave with a server which supports
   Single Sign On (SSO). By default, Element will do nothing special and simply show a button where
   needed for the user to click to navigate to the SSO system. This behaviour can be tuned with the
   config options below (as properties of the `sso_redirect_options` object). None of the options apply
   if Element thinks the user is already logged in, and similarly Element will assume the default server
   supports SSO if these redirect options are used.
   * `immediate`: When `true` (default `false`), Element will automatically redirect all unauthenticated
     users to the SSO system to log in regardless of how they reached the app. This overrides the use of
     other redirect options.
   * `on_welcome_page`: When `true` (default `false`), Element will automatically redirect all unauthenticated
     users to the SSO to log in if the user lands on the welcome page or no specific page. For example,
     https://app.element.io/#/welcome and https://app.element.io would redirect if set up to use this option.
     This can be useful to maintain guest experience until an account is needed.
1. `logout_redirect_url`: After Element has cleared the user's storage, the user will be redirected to this URL.
   Typically most useful in environments where the account users will be logging into is managed for them, such
   as in cases of some SSO deployments. For example: this page might log the user out of the SSO system too.
1. `features`: Lookup of optional features that may be force-enabled (`true`) or force-disabled (`false`).
   When features are not listed here, their defaults will be used, and users can turn them on/off if `showLabsSettings`
   allows them to. The available optional experimental features vary from release to release and are
   [documented](labs.md). The feature flag process is [documented](feature-flags.md) as well.
1. `showLabsSettings`: Shows the "labs" tab of user settings. Useful to allow users to turn on experimental features
   they might not otherwise have access to.
1. `brand`: String to pass to your homeserver when configuring email notifications, to let the
   homeserver know what email template to use when talking to you.
1. `branding`: Configures various branding and logo details, such as:
    1. `welcomeBackgroundUrl`: An image to use as a wallpaper outside the app
       during authentication flows. If an array is passed, an image is chosen randomly for each visit.
    1. `authHeaderLogoUrl`: An logo image that is shown in the header during
       authentication flows
    1. `authFooterLinks`: a list of links to show in the authentication page footer:
      `[{"text": "Link text", "url": "https://link.target"}, {"text": "Other link", ...}]`
1. `reportEvent`: Configures the dialog for reporting content to the homeserver
   admin.
    1. `adminMessageMD`: An extra message to show on the reporting dialog to
       mention homeserver-specific policies. Accepts Markdown.
1. `integrations_ui_url`: URL to the web interface for the integrations server. The integrations
   server is not Element and normally not your homeserver either. The integration server settings
   may be left blank to disable integrations.
1. `integrations_rest_url`: URL to the REST interface for the integrations server.
1. `integrations_widgets_urls`: list of URLs to the REST interface for the widget integrations server.
1. `bug_report_endpoint_url`: endpoint to send bug reports to (must be running a
   https://github.com/matrix-org/rageshake server). Bug reports are sent when a user clicks
   "Send Logs" within the application. Bug reports can be disabled/hidden by leaving the
   `bug_report_endpoint_url` out of your config file.
1. `uisi_autorageshake_app`: If users enable the Labs flag
   "Automatically send debug logs on decryption errors", rageshakes
   submitted by that feature can be given a custom app name so that
   the rageshake server can file them in a separate issue tracker.  If
   this field is absent from the config, the app name for decryption
   error rageshakes will be `"element-web"` just like for
   manually-submitted rageshakes.

   If `bug_report_endpoint_url` is set to Element's rageshake server,
   then this field should be set to `"element-auto-uisi"` as in
   `config.sample.json`. If `bug_report_endpoint_url` is left out,
   this field has no effect and can be left out as well.  If you are
   using your own rageshake server, set this field in accordance with
   your rageshake server configuration.
1. `roomDirectory`: config for the public room directory. This section is optional.
1. `roomDirectory.servers`: List of other homeservers' directories to include in the drop
   down list. Optional.
1. `default_theme`: name of theme to use by default (e.g. 'light')
1. `update_base_url` (electron app only): HTTPS URL to a web server to download
   updates from. This should be the path to the directory containing `macos`
   and `win32` (for update packages, not installer packages).
1. DEPRECATED: `piwik`: Analytics can be disabled by setting `piwik: false` or by leaving the piwik config
   option out of your config file. If you want to enable analytics, set `piwik` to be an object
   containing the following properties:
    1. `url`: The URL of the Piwik instance to use for collecting analytics
    1. `whitelistedHSUrls`: a list of HS URLs to not redact from the analytics
    1. `whitelistedISUrls`: a list of IS URLs to not redact from the analytics
    1. `siteId`: The Piwik Site ID to use when sending analytics to the Piwik server configured above
1. `welcomeUserId`: the user ID of a bot to invite whenever users register that can give them a tour
1. `embeddedPages`: Configures the pages displayed in portions of Element that
   embed static files, such as:
    1. `welcomeUrl`: Initial content shown on the outside of the app when not
       logged in. Defaults to `welcome.html` supplied with Element.
    1. `homeUrl`: Content shown on the inside of the app when a specific room is
       not selected. By default, no home page is configured. If one is set, a
       button to access it will be shown in the top left menu.
    1. `loginForWelcome`: Overrides `welcomeUrl` to make the welcome page be the
       same page as the login page when `true`. This effectively disables the
       welcome page.
1. `defaultCountryCode`: The ISO 3166 alpha2 country code to use when showing
   country selectors, like the phone number input on the registration page.
   Defaults to `GB` if the given code is unknown or not provided.
1. `settingDefaults`:  Defaults for settings that support the `config` level,
   as an object mapping setting name to value (note that the "theme" setting
   is special cased to the `default_theme` in the config file).
1. `disable_custom_urls`: disallow the user to change the
   default homeserver when signing up or logging in.
1. `permalinkPrefix`: Used to change the URL that Element generates permalinks with.
   By default, this is "https://matrix.to" to generate matrix.to (spec) permalinks.
   Set this to your Element instance URL if you run an unfederated server (eg:
   "https://element.example.org").
1. `jitsi`: Used to change the default conference options. Learn more about the
   Jitsi options at [jitsi.md](./jitsi.md).
    1. `preferredDomain`: The domain name of the preferred Jitsi instance. Defaults
       to `meet.element.io`. This is used whenever a user clicks on the voice/video
       call buttons - integration managers may use a different domain.
  This setting is ignored if your homeserver provides
  `/.well-known/matrix/client` in its well-known location, and the JSON file
  at that location has a key `m.vector.riot.jitsi`. In this case, the
  configuration found in the well-known location is used instead.
1. `jitsiWidget`: Options to change the built-in Jitsi widget behaviour. `jitsi` controls
   how the widget gets created, but not how it behaves.
    1. `skipBuiltInWelcomeScreen`: If you'd like to skip the default "Join Conference"
       behaviour, set this to `true`. This will cause the widget to assume that there's
       a Jitsi welcome screen set up and point the user towards that. Note that this can
       cause the camera/microphone to flicker as "in use" while Jitsi tests the devices.
1. `enable_presence_by_hs_url`: The property key should be the URL of the homeserver
    and its value defines whether to enable/disable the presence status display
    from that homeserver. If no options are configured, presence is shown for all
    homeservers.
1. `disable_guests`: Disables guest access tokens and auto-guest registrations.
    Defaults to false (guests are allowed).
1. `disable_login_language_selector`: Disables the login language selector. Defaults
    to false (language selector is shown).
1. `disable_3pid_login`: Disables 3rd party identity options on login and registration form
    Defaults to false (3rd party identity options are shown).
1. `default_federate`: Default option for room federation when creating a room
    Defaults to true (room federation enabled).
1. `desktopBuilds`: Used to alter promotional links to the desktop app. By default
   the builds are considered available and accessible from https://element.io. This
   config option is typically used in the context of encouraging encrypted message
   search capabilities (Seshat). All the options listed below are required if this
   option is specified.
   1. `available`: When false, the desktop app will not be promoted to the user.
   1. `logo`: An HTTP URL to the avatar for the desktop build. Should be 24x24, ideally
      an SVG.
   1. `url`: An HTTP URL for where to send the user to download the desktop build.
1. `mobileBuilds`: Used to alter promotional links to the mobile app. By default the
   builds are considered available and accessible from https://element.io. This config
   option is typically used in a context of encouraging the user to try the mobile app
   instead of a mobile/incompatible browser.
   1. `ios`: The URL to the iOS build. If `null`, it will be assumed to be not available.
       If not set, the default element.io builds will be used.
   1. `android`: The URL to the Android build. If `null`, it will be assumed to be not available.
       If not set, the default element.io builds will be used.
   1. `fdroid`: The URL to the FDroid build. If `null`, it will be assumed to be not available.
      If not set, the default element.io builds will be used.
1. `mobileGuideToast`: Whether to show a toast a startup which nudges users on
   iOS and Android towards the native mobile apps. The toast redirects to the
   mobile guide if they accept. Defaults to false.
1. `audioStreamUrl`: If supplied, show an option on Jitsi widgets to stream
   audio using Jitsi's live streaming feature. This option is experimental and
   may be removed at any time without notice.
1. `voip`: Behaviour related to calls
   1. `obeyAssertedIdentity`: If set, MSC3086 asserted identity messages sent
      on VoIP calls will cause the call to appear in the room corresponding to the
      asserted identity. This *must* only be set in trusted environments.
1. `posthog`: [Posthog](https://posthog.com/) integration config. If not set, Posthog analytics are disabled.
   1. `projectApiKey`: The Posthog project API key
   2. `apiHost`: The Posthog API host
1. `sentry`: [Sentry](https://sentry.io/) configuration for rageshake data being sent to sentry.
   1. `dsn`: the Sentry [DSN](https://docs.sentry.io/product/sentry-basics/dsn-explainer/)
   2. `environment`: (optional) The [Environment](https://docs.sentry.io/product/sentry-basics/environments/) to pass to sentry
1. `map_style_url`: Map tile server style URL for location sharing. e.g.
   'https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY_GOES_HERE'
  This setting is ignored if your homeserver provides
  `/.well-known/matrix/client` in its well-known location, and the JSON file
  at that location has a key `m.tile_server` (or the unstable version
  `org.matrix.msc3488.tile_server`). In this case, the configuration found in
  the well-known location is used instead.
1. `analyticsOwner`: The entity that analytics data is being sent to. Used in copy
   when explaining to the user where data is being sent. If not set, defaults to `brand`.
1. `defaultDeviceDisplayName`: The default device display name to use for new logins
   and registrations. If not set then a calculated version will be used.
1. `custom_translations_url`: An optional URL to allow overriding of translatable strings.
   The JSON file must be in a format of `{"affected string": {"languageCode": "new string"}}`.
   See https://github.com/matrix-org/matrix-react-sdk/pull/7886 for details.

Note that `index.html` also has an og:image meta tag that is set to an image
hosted on element.io. This is the image used if links to your copy of Element
appear in some websites like Facebook, and indeed Element itself. This has to be
static in the HTML and an absolute URL (and HTTP rather than HTTPS), so it's
not possible for this to be an option in config.json. If you'd like to change
it, you can build Element, but run
`RIOT_OG_IMAGE_URL="http://example.com/logo.png" yarn build`.
Alternatively, you can edit the `og:image` meta tag in `index.html` directly
each time you download a new version of Element.

Identity servers
================

The identity server is used for inviting other users to a room via third party
identifiers like emails and phone numbers. It is not used to store your password
or account information.

As of Element 1.4.0, all identity server functions are optional and you are
prompted to agree to terms before data is sent to the identity server.

Element will check multiple sources when looking for an identity server to use in
the following order of preference:

1. The identity server set in the user's account data
   * For a new user, no value is present in their account data. It is only set
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

Desktop app configuration
=========================

See https://github.com/vector-im/element-desktop#user-specified-configjson

UI Features
===========

Parts of the UI can be disabled using UI features. These are settings which appear
under `settingDefaults` and can only be `true` (default) or `false`. When `false`,
parts of the UI relating to that feature will be disabled regardless of the user's
preferences.

Currently, the following UI feature flags are supported:

* `UIFeature.urlPreviews` - Whether URL previews are enabled across the entire application.
* `UIFeature.feedback` - Whether prompts to supply feedback are shown.
* `UIFeature.voip` - Whether or not VoIP is shown readily to the user. When disabled,
  Jitsi widgets will still work though they cannot easily be added.
* `UIFeature.widgets` - Whether or not widgets will be shown.
* `UIFeature.flair` - Whether or not community flair is shown in rooms.
* `UIFeature.communities` - Whether or not to show any UI related to communities. Implicitly
  disables `UIFeature.flair` when disabled.
* `UIFeature.advancedSettings` - Whether or not sections titled "advanced" in room and
  user settings are shown to the user.
* `UIFeature.shareQrCode` - Whether or not the QR code on the share room/event dialog
  is shown.
* `UIFeature.shareSocial` - Whether or not the social icons on the share room/event dialog
  are shown.
* `UIFeature.identityServer` - Whether or not functionality requiring an identity server
  is shown. When disabled, the user will not be able to interact with the identity
  server (sharing email addresses, 3PID invites, etc).
* `UIFeature.thirdPartyId` - Whether or not UI relating to third party identifiers (3PIDs)
  is shown. Typically this is considered "contact information" on the homeserver, and is
  not directly related to the identity server.
* `UIFeature.registration` - Whether or not the registration page is accessible. Typically
  useful if accounts are managed externally.
* `UIFeature.passwordReset` - Whether or not the password reset page is accessible. Typically
  useful if accounts are managed externally.
* `UIFeature.deactivate` - Whether or not the deactivate account button is accessible. Typically
  useful if accounts are managed externally.
* `UIFeature.advancedEncryption` - Whether or not advanced encryption options are shown to the
  user.
* `UIFeature.roomHistorySettings` - Whether or not the room history settings are shown to the user.
  This should only be used if the room history visibility options are managed by the server.
* `UIFeature.TimelineEnableRelativeDates` - Display relative date separators (eg: 'Today', 'Yesterday') in the timeline for recent messages. When false day dates will be used.
