[![Chat](https://img.shields.io/matrix/element-web:matrix.org?logo=matrix)](https://matrix.to/#/#element-web:matrix.org)
![Tests](https://github.com/element-hq/element-web/actions/workflows/tests.yaml/badge.svg)
![Static Analysis](https://github.com/element-hq/element-web/actions/workflows/static_analysis.yaml/badge.svg)
[![Localazy](https://img.shields.io/endpoint?url=https%3A%2F%2Fconnect.localazy.com%2Fstatus%2Felement-web%2Fdata%3Fcontent%3Dall%26title%3Dlocalazy%26logo%3Dtrue)](https://localazy.com/p/element-web)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=element-web&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=element-web)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=element-web&metric=coverage)](https://sonarcloud.io/summary/new_code?id=element-web)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=element-web&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=element-web)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=element-web&metric=bugs)](https://sonarcloud.io/summary/new_code?id=element-web)

# Element

Element (formerly known as Vector and Riot) is a Matrix web client built using the [Matrix
JS SDK](https://github.com/matrix-org/matrix-js-sdk).

# Supported Environments

Element has several tiers of support for different environments:

-   Supported
    -   Definition:
        -   Issues **actively triaged**, regressions **block** the release
    -   Last 2 major versions of Chrome, Firefox, and Edge on desktop OSes
    -   Last 2 versions of Safari
    -   Latest release of official Element Desktop app on desktop OSes
    -   Desktop OSes means macOS, Windows, and Linux versions for desktop devices
        that are actively supported by the OS vendor and receive security updates
-   Best effort
    -   Definition:
        -   Issues **accepted**, regressions **do not block** the release
        -   The wider Element Products(including Element Call and the Enterprise Server Suite) do still not officially support these browsers.
        -   The element web project and its contributors should keep the client functioning and gracefully degrade where other sibling features (E.g. Element Call) may not function.
    -   Last major release of Firefox ESR and Chrome/Edge Extended Stable
-   Community Supported
    -   Definition:
        -   Issues **accepted**, regressions **do not block** the release
        -   Community contributions are welcome to support these issues
    -   Mobile web for current stable version of Chrome, Firefox, and Safari on Android, iOS, and iPadOS
-   Not supported
    -   Definition: Issues only affecting unsupported environments are **closed**
    -   Everything else

The period of support for these tiers should last until the releases specified above, plus 1 app release cycle(2 weeks). In the case of Firefox ESR this is extended further to allow it land in Debian Stable.

For accessing Element on an Android or iOS device, we currently recommend the
native apps [element-android](https://github.com/element-hq/element-android)
and [element-ios](https://github.com/element-hq/element-ios).

# Getting Started

The easiest way to test Element is to just use the hosted copy at <https://app.element.io>.
The `develop` branch is continuously deployed to <https://develop.element.io>
for those who like living dangerously.

To host your own instance of Element see [Installing Element Web](docs/install.md).

To install Element as a desktop application, see [Running as a desktop app](#running-as-a-desktop-app) below.

# Important Security Notes

## Separate domains

We do not recommend running Element from the same domain name as your Matrix
homeserver. The reason is the risk of XSS (cross-site-scripting)
vulnerabilities that could occur if someone caused Element to load and render
malicious user generated content from a Matrix API which then had trusted
access to Element (or other apps) due to sharing the same domain.

We have put some coarse mitigations into place to try to protect against this
situation, but it's still not good practice to do it in the first place. See
<https://github.com/element-hq/element-web/issues/1977> for more details.

## Configuration best practices

Unless you have special requirements, you will want to add the following to
your web server configuration when hosting Element Web:

-   The `X-Frame-Options: SAMEORIGIN` header, to prevent Element Web from being
    framed and protect from [clickjacking][owasp-clickjacking].
-   The `frame-ancestors 'self'` directive to your `Content-Security-Policy`
    header, as the modern replacement for `X-Frame-Options` (though both should be
    included since not all browsers support it yet, see
    [this][owasp-clickjacking-csp]).
-   The `X-Content-Type-Options: nosniff` header, to [disable MIME
    sniffing][mime-sniffing].
-   The `X-XSS-Protection: 1; mode=block;` header, for basic XSS protection in
    legacy browsers.

[mime-sniffing]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#mime_sniffing
[owasp-clickjacking-csp]: https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html#content-security-policy-frame-ancestors-examples
[owasp-clickjacking]: https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html

If you are using nginx, this would look something like the following:

```
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "frame-ancestors 'self'";
```

For Apache, the configuration looks like:

```
Header set X-Frame-Options SAMEORIGIN
Header set X-Content-Type-Options nosniff
Header set X-XSS-Protection "1; mode=block"
Header set Content-Security-Policy "frame-ancestors 'self'"
```

Note: In case you are already setting a `Content-Security-Policy` header
elsewhere, you should modify it to include the `frame-ancestors` directive
instead of adding that last line.

# Building From Source

Element is a modular webapp built with modern ES6 and uses a Node.js build system.
Ensure you have the latest LTS version of Node.js installed.

Using `yarn` instead of `npm` is recommended. Please see the Yarn [install
guide](https://classic.yarnpkg.com/en/docs/install) if you do not have it already.

1. Install or update `node.js` so that your `node` is at least the current recommended LTS.
1. Install `yarn` if not present already.
1. Clone the repo: `git clone https://github.com/element-hq/element-web.git`.
1. Switch to the element-web directory: `cd element-web`.
1. Install the prerequisites: `yarn install`.
    - If you're using the `develop` branch, then it is recommended to set up a
      proper development environment (see [Setting up a dev
      environment](#setting-up-a-dev-environment) below). Alternatively, you
      can use <https://develop.element.io> - the continuous integration release of
      the develop branch.
1. Configure the app by copying `config.sample.json` to `config.json` and
   modifying it. See the [configuration docs](docs/config.md) for details.
1. `yarn dist` to build a tarball to deploy. Untaring this file will give
   a version-specific directory containing all the files that need to go on your
   web server.

Note that `yarn dist` is not supported on Windows, so Windows users can run `yarn build`,
which will build all the necessary files into the `webapp` directory. The version of Element
will not appear in Settings without using the dist script. You can then mount the
`webapp` directory on your web server to actually serve up the app, which is
entirely static content.

# Running as a Desktop app

Element can also be run as a desktop app, wrapped in Electron. You can download a
pre-built version from <https://element.io/get-started> or, if you prefer,
build it yourself.

To build it yourself, follow the instructions at <https://github.com/element-hq/element-desktop>.

Many thanks to @aviraldg for the initial work on the Electron integration.

The [configuration docs](docs/config.md#desktop-app-configuration) show how to override the desktop app's default settings if desired.

# config.json

Element supports a variety of settings to configure default servers, behaviour, themes, etc.
See the [configuration docs](docs/config.md) for more details.

# Labs Features

Some features of Element may be enabled by flags in the `Labs` section of the settings.
Some of these features are described in [labs.md](https://github.com/element-hq/element-web/blob/develop/docs/labs.md).

# Caching requirements

Element requires the following URLs not to be cached, when/if you are serving Element from your own webserver:

```
/config.*.json
/i18n
/home
/sites
/index.html
```

We also recommend that you force browsers to re-validate any cached copy of Element on page load by configuring your
webserver to return `Cache-Control: no-cache` for `/`. This ensures the browser will fetch a new version of Element on
the next page load after it's been deployed. Note that this is already configured for you in the nginx config of our
Dockerfile.

# Development

Before attempting to develop on Element you **must** read the [developer guide
for `matrix-react-sdk`](https://github.com/matrix-org/matrix-react-sdk#developer-guide), which
also defines the design, architecture and style for Element too.

Read the [Choosing an issue](docs/choosing-an-issue.md) page for some guidance
about where to start. Before starting work on a feature, it's best to ensure
your plan aligns well with our vision for Element. Please chat with the team in
[#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org) before
you start so we can ensure it's something we'd be willing to merge.

You should also familiarise yourself with the ["Here be Dragons" guide
](https://docs.google.com/document/d/12jYzvkidrp1h7liEuLIe6BMdU0NUjndUYI971O06ooM)
to the tame & not-so-tame dragons (gotchas) which exist in the codebase.

The idea of Element is to be a relatively lightweight "skin" of customisations on
top of the underlying `matrix-react-sdk`. `matrix-react-sdk` provides both the
higher and lower level React components useful for building Matrix communication
apps using React.

Please note that Element is intended to run correctly without access to the public
internet. So please don't depend on resources (JS libs, CSS, images, fonts)
hosted by external CDNs or servers but instead please package all dependencies
into Element itself.

# Setting up a dev environment

Much of the functionality in Element is actually in the `matrix-js-sdk` module.
It is possible to set these up in a way that makes it easy to track the `develop` branches
in git and to make local changes without having to manually rebuild each time.

First clone and build `matrix-js-sdk`:

```bash
git clone https://github.com/matrix-org/matrix-js-sdk.git
pushd matrix-js-sdk
yarn link
yarn install
popd
```

Clone the repo and switch to the `element-web` directory:

```bash
git clone https://github.com/element-hq/element-web.git
cd element-web
```

Configure the app by copying `config.sample.json` to `config.json` and
modifying it. See the [configuration docs](docs/config.md) for details.

Finally, build and start Element itself:

```bash
yarn link matrix-js-sdk
yarn install
yarn start
```

Wait a few seconds for the initial build to finish; you should see something like:

```
[element-js] <s> [webpack.Progress] 100%
[element-js]
[element-js] ℹ ｢wdm｣:    1840 modules
[element-js] ℹ ｢wdm｣: Compiled successfully.
```

Remember, the command will not terminate since it runs the web server
and rebuilds source files when they change. This development server also
disables caching, so do NOT use it in production.

Open <http://127.0.0.1:8080/> in your browser to see your newly built Element.

**Note**: The build script uses inotify by default on Linux to monitor directories
for changes. If the inotify limits are too low your build will fail silently or with
`Error: EMFILE: too many open files`. To avoid these issues, we recommend a watch limit
of at least `128M` and instance limit around `512`.

You may be interested in issues [#15750](https://github.com/element-hq/element-web/issues/15750) and
[#15774](https://github.com/element-hq/element-web/issues/15774) for further details.

To set a new inotify watch and instance limit, execute:

```
sudo sysctl fs.inotify.max_user_watches=131072
sudo sysctl fs.inotify.max_user_instances=512
sudo sysctl -p
```

If you wish, you can make the new limits permanent, by executing:

```
echo fs.inotify.max_user_watches=131072 | sudo tee -a /etc/sysctl.conf
echo fs.inotify.max_user_instances=512 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

When you make changes to `matrix-js-sdk` they should be automatically picked up by webpack and built.

If any of these steps error with, `file table overflow`, you are probably on a mac
which has a very low limit on max open files. Run `ulimit -Sn 1024` and try again.
You'll need to do this in each new terminal you open before building Element.

## Running the tests

There are a number of application-level tests in the `tests` directory; these
are designed to run with Jest and JSDOM. To run them

```
yarn test
```

### End-to-End tests

See [matrix-react-sdk](https://github.com/matrix-org/matrix-react-sdk/#end-to-end-tests) for how to run the end-to-end tests.

# Translations

To add a new translation, head to the [translating doc](docs/translating.md).

For a developer guide, see the [translating dev doc](docs/translating-dev.md).

# Triaging issues

Issues are triaged by community members and the Web App Team, following the [triage process](https://github.com/element-hq/element-meta/wiki/Triage-process).

We use [issue labels](https://github.com/element-hq/element-meta/wiki/Issue-labelling) to sort all incoming issues.
