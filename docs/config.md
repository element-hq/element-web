Configuration
=============

You can configure the app by copying `config.sample.json` to
`config.json` and customising it:

For a good example, see https://riot.im/develop/config.json.

1. `default_server_config` sets the default homeserver and identity server URL for
   Riot to use. The object is the same as returned by [https://<server_name>/.well-known/matrix/client](https://matrix.org/docs/spec/client_server/latest.html#get-well-known-matrix-client),
   with added support for a `server_name` under the `m.homeserver` section to display
   a custom homeserver name. Alternatively, the config can contain a `default_server_name`
   instead which is where Riot will go to get that same object, although this option is
   deprecated - see the `.well-known` link above for more information on using this option.
   Note that the `default_server_name` is used to get a complete server configuration
   whereas the `server_name` in the `default_server_config` is for display purposes only.
   * *Note*: The URLs can also be individually specified as `default_hs_url` and
     `default_is_url`, however these are deprecated. They are maintained for backwards
     compatibility with older configurations. `default_is_url` is respected only
     if `default_hs_url` is used.
   * The identity server is used for verifying third party identifiers like emails
     and phone numbers. It is not used to store your password or account information.
     If not provided, the identity server defaults to vector.im. Currently the only
     two public identity servers are https://matrix.org and https://vector.im, however
     in future identity servers will be decentralised. In the future it will be possible
     to disable the identity server functionality.
   * Riot will fail to load if a mix of `default_server_config`, `default_server_name`, or
     `default_hs_url` is specified. When multiple sources are specified, it is unclear
     which should take priority and therefore the application cannot continue.
1. `features`: Lookup of optional features that may be `enable`d, `disable`d, or exposed to the user
   in the `labs` section of settings.  The available optional experimental features vary from
   release to release. The available features are described in [labs.md](labs.md).
1. `showLabsSettings`: Shows the "labs" tab of user settings even when no `features` are enabled
   or present. Useful for getting at settings which may be otherwise hidden.
1. `brand`: String to pass to your homeserver when configuring email notifications, to let the
   homeserver know what email template to use when talking to you.
1. `branding`: Configures various branding and logo details, such as:
    1. `welcomeBackgroundUrl`: An image to use as a wallpaper outside the app
       during authentication flows
    1. `authHeaderLogoUrl`: An logo image that is shown in the header during
       authentication flows
    1. `authFooterLinks`: a list of links to show in the authentication page footer:
      `[{"text": "Link text", "url": "https://link.target"}, {"text": "Other link", ...}]`
1. `integrations_ui_url`: URL to the web interface for the integrations server. The integrations
   server is not Riot and normally not your homeserver either. The integration server settings
   may be left blank to disable integrations.
1. `integrations_rest_url`: URL to the REST interface for the integrations server.
1. `integrations_widgets_urls`: list of URLs to the REST interface for the widget integrations server.
1. `bug_report_endpoint_url`: endpoint to send bug reports to (must be running a
   https://github.com/matrix-org/rageshake server). Bug reports are sent when a user clicks
   "Send Logs" within the application. Bug reports can be disabled by leaving the
   `bug_report_endpoint_url` out of your config file.
1. `roomDirectory`: config for the public room directory. This section is optional.
1. `roomDirectory.servers`: List of other homeservers' directories to include in the drop
   down list. Optional.
1. `default_theme`: name of theme to use by default (e.g. 'light')
1. `update_base_url` (electron app only): HTTPS URL to a web server to download
   updates from. This should be the path to the directory containing `macos`
   and `win32` (for update packages, not installer packages).
1. `cross_origin_renderer_url`: URL to a static HTML page hosting code to help display
   encrypted file attachments. This MUST be hosted on a completely separate domain to
   anything else since it is used to isolate the privileges of file attachments to this
   domain. Default: `https://usercontent.riot.im/v1.html`. This needs to contain v1.html from
   https://github.com/matrix-org/usercontent/blob/master/v1.html
1. `piwik`: Analytics can be disabled by setting `piwik: false` or by leaving the piwik config
   option out of your config file. If you want to enable analytics, set `piwik` to be an object
   containing the following properties:
    1. `url`: The URL of the Piwik instance to use for collecting analytics
    1. `whitelistedHSUrls`: a list of HS URLs to not redact from the analytics
    1. `whitelistedISUrls`: a list of IS URLs to not redact from the analytics
    1. `siteId`: The Piwik Site ID to use when sending analytics to the Piwik server configured above
1. `welcomeUserId`: the user ID of a bot to invite whenever users register that can give them a tour
1. `embeddedPages`: Configures the pages displayed in portions of Riot that
   embed static files, such as:
    1. `welcomeUrl`: Initial content shown on the outside of the app when not
       logged in. Defaults to `welcome.html` supplied with Riot.
    1. `homeUrl`: Content shown on the inside of the app when a specific room is
       not selected. By default, no home page is configured. If one is set, a
       button to access it will be shown in the top left menu.
1. `defaultCountryCode`: The ISO 3166 alpha2 country code to use when showing
   country selectors, like the phone number input on the registration page.
   Defaults to `GB` if the given code is unknown or not provided.
1. `settingDefaults`:  Defaults for settings that support the `config` level,
   as an object mapping setting name to value (note that the "theme" setting
   is special cased to the `default_theme` in the config file).
1. `disable_custom_urls`: disallow the user to change the
   default homeserver when signing up or logging in.
1. `permalinkPrefix`: Used to change the URL that Riot generates permalinks with.
   By default, this is "https://matrix.to" to generate matrix.to (spec) permalinks.
   Set this to your Riot instance URL if you run an unfederated server (eg: 
   "https://riot.example.org").

Note that `index.html` also has an og:image meta tag that is set to an image
hosted on riot.im. This is the image used if links to your copy of Riot
appear in some websites like Facebook, and indeed Riot itself. This has to be
static in the HTML and an absolute URL (and HTTP rather than HTTPS), so it's
not possible for this to be an option in config.json. If you'd like to change
it, you can build Riot, but run
`RIOT_OG_IMAGE_URL="http://example.com/logo.png" yarn build`.
Alternatively, you can edit the `og:image` meta tag in `index.html` directly
each time you download a new version of Riot.

Desktop app configuration
=========================

To run multiple instances of the desktop app for different accounts, you can
launch the executable with the `--profile` argument followed by a unique
identifier, e.g `riot-web --profile Work` for it to run a separate profile and
not interfere with the default one.

Alternatively, a custom location for the profile data can be specified using the
`--profile-dir` flag followed by the desired path.

+ `%APPDATA%\$NAME\config.json` on Windows
+ `$XDG_CONFIG_HOME\$NAME\config.json` or `~/.config/$NAME/config.json` on Linux
+ `~Library/Application Support/$NAME/config.json` on macOS

In the paths above, `$NAME` is typically `Riot`, unless you use `--profile
$PROFILE` in which case it becomes `Riot-$PROFILE`.
