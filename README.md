Element
=======

Element (formerly known as Vector and Riot) is a Matrix web client built using the [Matrix
React SDK](https://github.com/matrix-org/matrix-react-sdk).

Supported Environments
======================

Element has several tiers of support for different environments:

* Supported
  * Definition: Issues **actively triaged**, regressions **block** the release
  * Last 2 major versions of Chrome, Firefox, Safari, and Edge on desktop OSes
  * Latest release of official Element Desktop app on desktop OSes
  * Desktop OSes means macOS, Windows, and Linux versions for desktop devices
    that are actively supported by the OS vendor and receive security updates
* Experimental
  * Definition: Issues **accepted**, regressions **do not block** the release
  * Element as an installed PWA via current stable version of Chrome, Firefox, and Safari
  * Mobile web for current stable version of Chrome, Firefox, and Safari on Android, iOS, and iPadOS
* Not supported
  * Definition: Issues only affecting unsupported environments are **closed**
  * Everything else

For accessing Element on an Android or iOS device, we currently recommend the
native apps [element-android](https://github.com/vector-im/element-android)
and [element-ios](https://github.com/vector-im/element-ios).

Getting Started
===============

The easiest way to test Element is to just use the hosted copy at https://app.element.io.
The `develop` branch is continuously deployed to https://develop.element.io
for those who like living dangerously.

To host your own copy of Element, the quickest bet is to use a pre-built
released version of Element:

1. Download the latest version from https://github.com/vector-im/element-web/releases
1. Untar the tarball on your web server
1. Move (or symlink) the `element-x.x.x` directory to an appropriate name
1. Configure the correct caching headers in your webserver (see below)
1. If desired, copy `config.sample.json` to `config.json` and edit it
   as desired. See the [configuration docs](docs/config.md) for details.
1. Enter the URL into your browser and log into Element!

Releases are signed using gpg and the OpenPGP standard, and can be checked against the public key located
at https://packages.riot.im/element-release-key.asc.

Note that for the security of your chats will need to serve Element
over HTTPS. Major browsers also do not allow you to use VoIP/video
chats over HTTP, as WebRTC is only usable over HTTPS.
There are some exceptions like when using localhost, which is
considered a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts)
and thus allowed.

To install Element as a desktop application, see [Running as a desktop
app](#running-as-a-desktop-app) below.

Important Security Notes
========================

Separate domains
----------------

We do not recommend running Element from the same domain name as your Matrix
homeserver.  The reason is the risk of XSS (cross-site-scripting)
vulnerabilities that could occur if someone caused Element to load and render
malicious user generated content from a Matrix API which then had trusted
access to Element (or other apps) due to sharing the same domain.

We have put some coarse mitigations into place to try to protect against this
situation, but it's still not good practice to do it in the first place.  See
https://github.com/vector-im/element-web/issues/1977 for more details.

Configuration best practices
----------------------------

Unless you have special requirements, you will want to add the following to
your web server configuration when hosting Element Web:

- The `X-Frame-Options: SAMEORIGIN` header, to prevent Element Web from being
  framed and protect from [clickjacking][owasp-clickjacking].
- The `frame-ancestors 'none'` directive to your `Content-Security-Policy`
  header, as the modern replacement for `X-Frame-Options` (though both should be
  included since not all browsers support it yet, see
  [this][owasp-clickjacking-csp]).
- The `X-Content-Type-Options: nosniff` header, to [disable MIME
  sniffing][mime-sniffing].
- The `X-XSS-Protection: 1; mode=block;` header, for basic XSS protection in
  legacy browsers.

[mime-sniffing]:
<https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#mime_sniffing>

[owasp-clickjacking-csp]:
<https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html#content-security-policy-frame-ancestors-examples>

[owasp-clickjacking]:
<https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html>

If you are using nginx, this would look something like the following:

```
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "frame-ancestors 'none'";
```

Note: In case you are already setting a `Content-Security-Policy` header
elsewhere, you should modify it to include the `frame-ancestors` directive
instead of adding that last line.

Building From Source
====================

Element is a modular webapp built with modern ES6 and uses a Node.js build system.
Ensure you have the latest LTS version of Node.js installed.

Using `yarn` instead of `npm` is recommended. Please see the Yarn [install
guide](https://classic.yarnpkg.com/en/docs/install) if you do not have it already.

1. Install or update `node.js` so that your `node` is at least v10.x.
1. Install `yarn` if not present already.
1. Clone the repo: `git clone https://github.com/vector-im/element-web.git`.
1. Switch to the element-web directory: `cd element-web`.
1. Install the prerequisites: `yarn install`.
   *  If you're using the `develop` branch, then it is recommended to set up a
      proper development environment (see [Setting up a dev
      environment](#setting-up-a-dev-environment) below). Alternatively, you
      can use https://develop.element.io - the continuous integration release of
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

Running as a Desktop app
========================

Element can also be run as a desktop app, wrapped in Electron. You can download a
pre-built version from https://element.io/get-started or, if you prefer,
build it yourself.

To build it yourself, follow the instructions at https://github.com/vector-im/element-desktop.

Many thanks to @aviraldg for the initial work on the Electron integration.

Other options for running as a desktop app:
 * @asdf:matrix.org points out that you can use nativefier and it just works(tm)

```bash
yarn global add nativefier
nativefier https://app.element.io/
```

The [configuration docs](docs/config.md#desktop-app-configuration) show how to
override the desktop app's default settings if desired.

Running from Docker
===================

The Docker image can be used to serve element-web as a web server. The easiest way to use
it is to use the prebuilt image:
```bash
docker run -p 80:80 vectorim/element-web
```

To supply your own custom `config.json`, map a volume to `/app/config.json`. For example,
if your custom config was located at `/etc/element-web/config.json` then your Docker command
would be:
```bash
docker run -p 80:80 -v /etc/element-web/config.json:/app/config.json vectorim/element-web
```

To build the image yourself:
```bash
git clone https://github.com/vector-im/element-web.git element-web
cd element-web
git checkout master
docker build .
```

If you're building a custom branch, or want to use the develop branch, check out the appropriate
element-web branch and then run:
```bash
docker build -t \
    --build-arg USE_CUSTOM_SDKS=true \
    --build-arg REACT_SDK_REPO="https://github.com/matrix-org/matrix-react-sdk.git" \
    --build-arg REACT_SDK_BRANCH="develop" \
    --build-arg JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git" \
    --build-arg JS_SDK_BRANCH="develop" \
    .
```

Running in Kubernetes
=====================

The provided element-web docker image can also be run from within a Kubernetes cluster.
See the [Kubernetes example](docs/kubernetes.md) for more details.

config.json
===========

Element supports a variety of settings to configure default servers, behaviour, themes, etc.
See the [configuration docs](docs/config.md) for more details.

Labs Features
=============

Some features of Element may be enabled by flags in the `Labs` section of the settings.
Some of these features are described in [labs.md](https://github.com/vector-im/element-web/blob/develop/docs/labs.md).

Caching requirements
====================

Element requires the following URLs not to be cached, when/if you are serving Element from your own webserver:
```
/config.*.json
/i18n
/home
/sites
/index.html
```

Development
===========

Before attempting to develop on Element you **must** read the [developer guide
for `matrix-react-sdk`](https://github.com/matrix-org/matrix-react-sdk#developer-guide), which
also defines the design, architecture and style for Element too.

Before starting work on a feature, it's best to ensure your plan aligns well
with our vision for Element. Please chat with the team in
[#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org) before you
start so we can ensure it's something we'd be willing to merge.

You should also familiarise yourself with the ["Here be Dragons" guide
](https://docs.google.com/document/d/12jYzvkidrp1h7liEuLIe6BMdU0NUjndUYI971O06ooM)
to the tame & not-so-tame dragons (gotchas) which exist in the codebase.

The idea of Element is to be a relatively lightweight "skin" of customisations on
top of the underlying `matrix-react-sdk`. `matrix-react-sdk` provides both the
higher and lower level React components useful for building Matrix communication
apps using React.

After creating a new component you must run `yarn reskindex` to regenerate
the `component-index.js` for the app (used in future for skinning).

Please note that Element is intended to run correctly without access to the public
internet.  So please don't depend on resources (JS libs, CSS, images, fonts)
hosted by external CDNs or servers but instead please package all dependencies
into Element itself.

Setting up a dev environment
============================

Much of the functionality in Element is actually in the `matrix-react-sdk` and
`matrix-js-sdk` modules. It is possible to set these up in a way that makes it
easy to track the `develop` branches in git and to make local changes without
having to manually rebuild each time.

First clone and build `matrix-js-sdk`:

``` bash
git clone https://github.com/matrix-org/matrix-js-sdk.git
pushd matrix-js-sdk
yarn link
yarn install
popd
```

Then similarly with `matrix-react-sdk`:

```bash
git clone https://github.com/matrix-org/matrix-react-sdk.git
pushd matrix-react-sdk
yarn link
yarn link matrix-js-sdk
yarn install
popd
```

Finally, build and start Element itself:

```bash
git clone https://github.com/vector-im/element-web.git
cd element-web
yarn link matrix-js-sdk
yarn link matrix-react-sdk
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

Configure the app by copying `config.sample.json` to `config.json` and
modifying it. See the [configuration docs](docs/config.md) for details.

Open http://127.0.0.1:8080/ in your browser to see your newly built Element.

**Note**: The build script uses inotify by default on Linux to monitor directories
for changes. If the inotify limits are too low your build will fail silently or with
`Error: EMFILE: too many open files`. To avoid these issues, we recommend a watch limit
of at least `128M` and instance limit around `512`.

You may be interested in issues [#15750](https://github.com/vector-im/element-web/issues/15750) and
[#15774](https://github.com/vector-im/element-web/issues/15774) for further details.

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

___

When you make changes to `matrix-react-sdk` or `matrix-js-sdk` they should be
automatically picked up by webpack and built.

If you add or remove any components from the Element skin, you will need to rebuild
the skin's index by running, `yarn reskindex`.

If any of these steps error with, `file table overflow`, you are probably on a mac
which has a very low limit on max open files. Run `ulimit -Sn 1024` and try again.
You'll need to do this in each new terminal you open before building Element.

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

### End-to-End tests

See [matrix-react-sdk](https://github.com/matrix-org/matrix-react-sdk/#end-to-end-tests) how to run the end-to-end tests.

Translations
============

To add a new translation, head to the [translating doc](docs/translating.md).

For a developer guide, see the [translating dev doc](docs/translating-dev.md).

[<img src="https://translate.element.io/widgets/element-web/-/multi-auto.svg" alt="translationsstatus" width="340">](https://translate.element.io/engage/element-web/?utm_source=widget)

Triaging issues
===============

We strive to completely cover all applicable issues with these core labels:

1. __Type__ — Every issue is assigned a type:
   - __[T-Defect](https://github.com/vector-im/element-web/labels/T-Defect):__
     Bugs, crashes, hangs, vulnerabilities, or other reported problems
   - __[T-Enhancement](https://github.com/vector-im/element-web/labels/T-Enhancement):__
     New features, changes in functionality, performance boosts, user-facing
     improvements
   - __[T-Task](https://github.com/vector-im/element-web/labels/T-Task):__
     Refactoring, enabling or disabling functionality, other engineering tasks
   - __[T-Other](https://github.com/vector-im/element-web/labels/T-Other):__
     Questions, user support, anything else

2. __Severity__ — All issues labeled `T-Defect` are also assigned a severity:
   * __[S-Critical](https://github.com/vector-im/element-web/labels/S-Critical):__
     Prevents work, causes data loss, affects many users, and/or has no
     workaround
   * __[S-Major](https://github.com/vector-im/element-web/labels/S-Major):__
     Severely degrades major functionality or product features, with no
     satisfactory workaround
   * __[S-Minor](https://github.com/vector-im/element-web/labels/S-Minor):__
     Impairs non-critical functionality, or suitable workarounds exist
   * __[S-Tolerable](https://github.com/vector-im/element-web/labels/S-Tolerable):__
     Purely cosmetic or low / no impact to users

3. __Priority__ — All issues which are not `T-Other` are assigned a priority:
   * __[P1](https://github.com/vector-im/element-web/labels/P1):__ Next
   * __[P2](https://github.com/vector-im/element-web/labels/P2):__ Later
   * __[P3](https://github.com/vector-im/element-web/labels/P3):__ Eventually
   * __[P4](https://github.com/vector-im/element-web/labels/P4):__ Interesting —
     Not yet scheduled, will accept patches
   * __[P5](https://github.com/vector-im/element-web/labels/P5):__ Dubious —
     Will not schedule, would consider patches

4. __Area__ — Most issues are assigned one or several "areas" using one of the
   many `A-` prefixed labels, e.g. `A-Composer` or `A-Spaces`. Each area label
   maps to a group of features or portion of the UI surface in the app.

### Other common labels

We have a handful of other labels which are added on an as-needed basis, and not expected to be exhaustive:

* __Exceptions__ — Special flags for issues and pull requests:
  * __[X-Needs-Info](https://github.com/vector-im/element-web/labels/X-Needs-Info):__
    This issue is blocked pending further information from the reporter
  * __[X-Regression](https://github.com/vector-im/element-web/labels/X-Regression):__
    Denotes things breaking which previously worked
  * __[X-Release-Blocker](https://github.com/vector-im/element-web/labels/X-Release-Blocker):__
    Issues which must be resolved before making a release

* __[Easy](https://github.com/vector-im/element-web/labels/Easy)__ / __[Help
  Wanted](https://github.com/vector-im/element-web/labels/Help%20Wanted)__ —
  Well-defined issues which are suitable for folks new to the codebase

* __[A11y](https://github.com/vector-im/element-web/labels/A11y)__ /
  __[Meta](https://github.com/vector-im/element-web/labels/Meta)__ /
  __[I18n](https://github.com/vector-im/element-web/labels/I18n)__ /
  __[Privacy](https://github.com/vector-im/element-web/labels/Privacy)__ /
  __[Security](https://github.com/vector-im/element-web/labels/Security)__ —
  Issues which fall under these conceptual themes (which apply to many software
  projects and are not specific to Element)

* __[Sponsored](https://github.com/vector-im/element-web/labels/Sponsored)__ —
  Used internally by Element to denote issues with external funding

### Ad hoc labels (`Z-`)

We have reserved the `Z-` prefix for ad hoc labels.

Any member of the core team is welcome to create labels beginning with `Z-` for
any purpose, such as tracking personal areas of interest or providing a common
way to label cross-repo initiatives. The prefix avoids interference with the
project's main labels.
