Riot
====

Riot (formerly known as Vector) is a Matrix web client built using the [Matrix React SDK](https://github.com/matrix-org/matrix-react-sdk).

Riot is officially supported on the web in modern versions of Chrome, Firefox, and Safari. Other browsers may work, however
official support is not provided. For accessing Riot on an Android or iOS device, check out [riot-android](https://github.com/vector-im/riot-android)
and [riot-ios](https://github.com/vector-im/riot-ios) - riot-web does not support mobile devices.

Getting Started
===============

The easiest way to test Riot is to just use the hosted copy at https://riot.im/app.
The `develop` branch is continuously deployed by Jenkins at https://riot.im/develop
for those who like living dangerously.

To host your own copy of Riot, the quickest bet is to use a pre-built
released version of Riot:

1. Download the latest version from https://github.com/vector-im/riot-web/releases
1. Untar the tarball on your web server
1. Move (or symlink) the `riot-x.x.x` directory to an appropriate name
1. If desired, copy `config.sample.json` to `config.json` and edit it
   as desired. See below for details.
1. Enter the URL into your browser and log into Riot!

Releases are signed using gpg and the OpenPGP standard, and can be checked against the public key located
at https://packages.riot.im/riot-release-key.asc.

Note that Chrome does not allow microphone or webcam access for sites served
over http (except localhost), so for working VoIP you will need to serve Riot
over https.

To install Riot as a desktop application, see [Running as a desktop
app](#running-as-a-desktop-app) below.

Important Security Note
=======================

We do not recommend running Riot from the same domain name as your Matrix
homeserver.  The reason is the risk of XSS (cross-site-scripting)
vulnerabilities that could occur if someone caused Riot to load and render
malicious user generated content from a Matrix API which then had trusted
access to Riot (or other apps) due to sharing the same domain.

We have put some coarse mitigations into place to try to protect against this
situation, but it's still not good practice to do it in the first place.  See
https://github.com/vector-im/riot-web/issues/1977 for more details.

The same applies for end-to-end encrypted content, but since this is decrypted
on the client, Riot needs a way to supply the decrypted content from a separate
origin to the one Riot is hosted on. This currently done with a 'cross origin
renderer' which is a small piece of javascript hosted on a different domain.
To avoid all Riot installs needing one of these to be set up, riot.im hosts
one on usercontent.riot.im which is used by default. See 'config.json' if you'd
like to host your own. https://github.com/vector-im/riot-web/issues/6173 tracks
progress on replacing this with something better.

Building From Source
====================

Riot is a modular webapp built with modern ES6 and uses a Node.js build system.
Ensure you have the latest LTS version of Node.js installed.

Using `yarn` instead of `npm` is recommended. Please see the Yarn [install
guide](https://yarnpkg.com/docs/install/) if you do not have it already.

1. Install or update `node.js` so that your `node` is at least v10.x.
1. Install `yarn` if not present already.
1. Clone the repo: `git clone https://github.com/vector-im/riot-web.git`.
1. Switch to the riot-web directory: `cd riot-web`.
1. Install the prerequisites: `yarn install`.
1. If you're using the `develop` branch then it is recommended to set up a proper
   development environment ("Setting up a dev environment" below) however one can
   install the develop versions of the dependencies instead:
   ```bash
   scripts/fetch-develop.deps.sh
   ```
   Whenever you git pull on `riot-web` you will also probably need to force an update
   to these dependencies - the simplest way is to re-run the script, but you can also
   manually update and rebuild them:
   ```bash
   cd matrix-js-sdk
   git pull
   yarn install # re-run to pull in any new dependencies
   cd ../matrix-react-sdk
   git pull
   yarn install
   ```
   Or just use https://riot.im/develop - the continuous integration release of the
   develop branch. (Note that we don't reference the develop versions in git directly
   due to https://github.com/npm/npm/issues/3055.)
1. Configure the app by copying `config.sample.json` to `config.json` and
   modifying it (see below for details).
1. `yarn dist` to build a tarball to deploy. Untaring this file will give
   a version-specific directory containing all the files that need to go on your
   web server.

Note that `yarn dist` is not supported on Windows, so Windows users can run `yarn build`,
which will build all the necessary files into the `webapp` directory. The version of Riot
will not appear in Settings without using the dist script. You can then mount the
`webapp` directory on your webserver to actually serve up the app, which is entirely static content.

config.json
===========

You can configure the app by copying `config.sample.json` to
`config.json` and customising it:

For a good example, see https://riot.im/develop/config.json.

1. `default_server_config` sets the default homeserver and identity server URL for
   Riot to use. The object is the same as returned by [https://<server_name>/.well-known/matrix/client](https://matrix.org/docs/spec/client_server/latest.html#get-well-known-matrix-client),
   with added support for a `server_name` under the `m.homeserver` section to display
   a custom homeserver name. Alternatively, the config can contain a `default_server_name`
   instead which is where Riot will go to get that same object - see the `.well-known`
   link above for more information. Note that the `default_server_name` is used to get
   a complete server configuration whereas the `server_name` in the `default_server_config`
   is for display purposes only.
   * *Note*: The URLs can also be individually specified as `default_hs_url` and 
     `default_is_url`, however these are deprecated. They are maintained for backwards
     compatibility with older configurations. `default_is_url` is respected only
     if `default_hs_url` is used.
   * The identity server is used for verifying third party identifiers like emails
     and phone numbers. It is not used to store your password or account information.
     If not provided, the identity server defaults to vector.im unless `disable_identity_server`
     is set to true in the config. Currently the only two public identity servers
     are https://matrix.org and https://vector.im, however in future identity servers
     will be decentralised.
   * Riot will fail to load if a mix of `default_server_config`, `default_server_name`, or
     `default_hs_url` is specified. When multiple sources are specified, it is unclear
     which should take priority and therefore the application cannot continue.
1. `features`: Lookup of optional features that may be `enable`d, `disable`d, or exposed to the user
   in the `labs` section of settings.  The available optional experimental features vary from
   release to release. Some of the available features are described in the Labs Feature section
   of this README.
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


Note that `index.html` also has an og:image meta tag that is set to an image
hosted on riot.im. This is the image used if links to your copy of Riot
appear in some websites like Facebook, and indeed Riot itself. This has to be
static in the HTML and an absolute URL (and HTTP rather than HTTPS), so it's
not possible for this to be an option in config.json. If you'd like to change
it, you can build Riot as above, but run
`RIOT_OG_IMAGE_URL="http://example.com/logo.png" yarn build`.
Alternatively, you can edit the `og:image` meta tag in `index.html` directly
each time you download a new version of Riot.

Running as a Desktop app
========================

Riot can also be run as a desktop app, wrapped in Electron. You can download a
pre-built version from https://riot.im/download/desktop/ or, if you prefer,
build it yourself.

To build it yourself, follow the instructions below.

1. Follow the instructions in 'Building From Source' above, but run
   `yarn build` instead of `yarn dist` (since we don't need the tarball).
2. Install Electron and run it:

   ```bash
   yarn electron
   ```

To build packages, use `electron-builder`. This is configured to output:
 * `dmg` + `zip` for macOS
 * `exe` + `nupkg` for Windows
 * `deb` for Linux
But this can be customised by editing the `build` section of package.json
as per https://github.com/electron-userland/electron-builder/wiki/Options

See https://github.com/electron-userland/electron-builder/wiki/Multi-Platform-Build
for dependencies required for building packages for various platforms.

The only platform that can build packages for all three platforms is macOS:
```bash
brew install mono
yarn install
yarn build:electron
```

For other packages, use `electron-builder` manually. For example, to build a
package for 64 bit Linux:

 1. Follow the instructions in 'Building From Source' above
 2. `node_modules/.bin/build -l --x64`

All Electron packages go into `electron_app/dist/`

Many thanks to @aviraldg for the initial work on the Electron integration.

Other options for running as a desktop app:
 * @asdf:matrix.org points out that you can use nativefier and it just works(tm)

```bash
yarn global add nativefier
nativefier https://riot.im/app/
```

Desktop app configuration
=========================

To run multiple instances of the desktop app for different accounts, you can launch the executable with the `--profile` argument followed by a unique identifier, e.g `riot-web --profile Work` for it to run a separate profile and not interfere with the default one.

Alternatively, a custom location for the profile data can be specified using the `--profile-dir` flag followed by the desired path.

To change the config.json for the desktop app, create a config file which will be used to override values in the config which ships in the package:
+ `%APPDATA%\$NAME\config.json` on Windows
+ `$XDG_CONFIG_HOME\$NAME\config.json` or `~/.config/$NAME/config.json` on Linux
+ `~Library/Application Support/$NAME/config.json` on macOS

In the paths above, `$NAME` is typically `Riot`, unless you use `--profile $PROFILE` in which case it becomes `Riot-$PROFILE`.

Running from Docker
===================

The Docker image can be used to serve riot-web as a web server. The easiest way to use 
it is to use the prebuilt image:
```bash
docker run -p 80:80 vectorim/riot-web
``` 

To supply your own custom `config.json`, map a volume to `/app/config.json`. For example, 
if your custom config was located at `/etc/riot-web/config.json` then your Docker command
would be:
```bash
docker run -p 80:80 -v /etc/riot-web/config.json:/app/config.json vectorim/riot-web
```

To build the image yourself:
```bash
git clone https://github.com/vector-im/riot-web.git riot-web
cd riot-web
git checkout master
docker build -t vectorim/riot-web .
```

If you're building a custom branch, or want to use the develop branch, check out the appropriate
riot-web branch and then run:
```bash
docker build -t vectorim/riot-web:develop \
    --build-arg USE_CUSTOM_SDKS=true \
    --build-arg REACT_SDK_REPO="https://github.com/matrix-org/matrix-react-sdk.git" \
    --build-arg REACT_SDK_BRANCH="develop" \
    --build-arg JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git" \
    --build-arg JS_SDK_BRANCH="develop" \
    .
```

Labs Features
=============

Some features of Riot may be enabled by flags in the `Labs` section of the settings.
Some of these features are described in [labs.md](https://github.com/vector-im/riot-web/blob/develop/docs/labs.md).

Development
===========

Before attempting to develop on Riot you **must** read the [developer guide
for `matrix-react-sdk`](https://github.com/matrix-org/matrix-react-sdk), which
also defines the design, architecture and style for Riot too.

You should also familiarise yourself with the ["Here be Dragons" guide
](https://docs.google.com/document/d/12jYzvkidrp1h7liEuLIe6BMdU0NUjndUYI971O06ooM)
to the tame & not-so-tame dragons (gotchas) which exist in the codebase.

The idea of Riot is to be a relatively lightweight "skin" of customisations on
top of the underlying `matrix-react-sdk`. `matrix-react-sdk` provides both the
higher and lower level React components useful for building Matrix communication
apps using React.

After creating a new component you must run `yarn reskindex` to regenerate
the `component-index.js` for the app (used in future for skinning).

Please note that Riot is intended to run correctly without access to the public
internet.  So please don't depend on resources (JS libs, CSS, images, fonts)
hosted by external CDNs or servers but instead please package all dependencies
into Riot itself.

Setting up a dev environment
============================

Much of the functionality in Riot is actually in the `matrix-react-sdk` and
`matrix-js-sdk` modules. It is possible to set these up in a way that makes it
easy to track the `develop` branches in git and to make local changes without
having to manually rebuild each time.

First clone and build `matrix-js-sdk`:

``` bash
git clone https://github.com/matrix-org/matrix-js-sdk.git
pushd matrix-js-sdk
git checkout develop
yarn link
yarn install
popd
```

Then similarly with `matrix-react-sdk`:

```bash
git clone https://github.com/matrix-org/matrix-react-sdk.git
pushd matrix-react-sdk
git checkout develop
yarn link
yarn link matrix-js-sdk
yarn install
popd
```

Finally, build and start Riot itself:

```bash
git clone https://github.com/vector-im/riot-web.git
cd riot-web
git checkout develop
yarn link matrix-js-sdk
yarn link matrix-react-sdk
yarn install
yarn start
```

Wait a few seconds for the initial build to finish; you should see something like:
```
Hash: b0af76309dd56d7275c8
Version: webpack 1.12.14
Time: 14533ms
         Asset     Size  Chunks             Chunk Names
     bundle.js   4.2 MB       0  [emitted]  main
    bundle.css  91.5 kB       0  [emitted]  main
 bundle.js.map  5.29 MB       0  [emitted]  main
bundle.css.map   116 kB       0  [emitted]  main
    + 1013 hidden modules
```
   Remember, the command will not terminate since it runs the web server
   and rebuilds source files when they change. This development server also
   disables caching, so do NOT use it in production.

Open http://127.0.0.1:8080/ in your browser to see your newly built Riot.

___

When you make changes to `matrix-react-sdk` or `matrix-js-sdk` they should be
automatically picked up by webpack and built.

If you add or remove any components from the Riot skin, you will need to rebuild
the skin's index by running, `yarn reskindex`.

If any of these steps error with, `file table overflow`, you are probably on a mac
which has a very low limit on max open files. Run `ulimit -Sn 1024` and try again.
You'll need to do this in each new terminal you open before building Riot.

Running the tests
-----------------

There are a number of application-level tests in the `tests` directory; these
are designed to run in a browser instance under the control of
[karma](https://karma-runner.github.io). To run them:

* Make sure you have Chrome installed (a recent version, like 59)
* Make sure you have `matrix-js-sdk` and `matrix-react-sdk` installed and
  built, as above
* `yarn test`

The above will run the tests under Chrome in a `headless` mode.

You can also tell karma to run the tests in a loop (every time the source
changes), in an instance of Chrome on your desktop, with `yarn
test-multi`. This also gives you the option of running the tests in 'debug'
mode, which is useful for stepping through the tests in the developer tools.

Translations
============

To add a new translation, head to the [translating doc](docs/translating.md).

For a developer guide, see the [translating dev doc](docs/translating-dev.md).

[<img src="https://translate.riot.im/widgets/riot-web/-/multi-auto.svg" alt="translationsstatus" width="340">](https://translate.riot.im/engage/riot-web/?utm_source=widget)

Triaging issues
===============

Issues will be triaged by the core team using the below set of tags.

Tags are meant to be used in combination - e.g.:
 * P1 critical bug == really urgent stuff that should be next in the bugfixing todo list
 * "release blocker" == stuff which is blocking us from cutting the next release.
 * P1 feature type:voip == what VoIP features should we be working on next?

priority: **compulsory**

* P1: top priority - i.e. pool of stuff which we should be working on next
* P2: still need to fix, but lower than P1
* P3: non-urgent
* P4: interesting idea - bluesky some day
* P5: recorded for posterity/to avoid duplicates. No intention to resolves right now.

bug or feature: **compulsory**

* bug
* feature

bug severity: **compulsory, if bug**

* critical - whole app doesn't work
* major - entire feature doesn't work
* minor - partially broken feature (but still usable)
* cosmetic - feature works functionally but UI/UX is broken

types
* type:* - refers to a particular part of the app; used to filter bugs
  on a given topic - e.g. VOIP, signup, timeline, etc.

additional categories (self-explanatory):

* release blocker
* ui/ux (think of this as cosmetic)
* network (specific to network conditions)
* platform specific
* accessibility
* maintenance
* performance
* i18n
* blocked - whether this issue currently can't be progressed due to outside factors

community engagement
* easy
* hacktoberfest
* bounty? - proposal to be included in a bounty programme
* bounty - included in Status Open Bounty
