# Developer Guide

## Development

Read the [Choosing an issue](docs/choosing-an-issue.md) page for some guidance
about where to start. Before starting work on a feature, it's best to ensure
your plan aligns well with our vision for Element. Please chat with the team in
[#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org) before
you start so we can ensure it's something we'd be willing to merge.

You should also familiarise yourself with the ["Here be Dragons" guide
](https://docs.google.com/document/d/12jYzvkidrp1h7liEuLIe6BMdU0NUjndUYI971O06ooM)
to the tame & not-so-tame dragons (gotchas) which exist in the codebase.

Please note that Element is intended to run correctly without access to the public
internet. So please don't depend on resources (JS libs, CSS, images, fonts)
hosted by external CDNs or servers but instead please package all dependencies
into Element itself.

## Setting up a dev environment

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

## General github guidelines

1. **Pull requests must only be filed against the `develop` branch.**
2. Try to keep your pull requests concise. Split them up if necessary.
3. Ensure that you provide a description that explains the fix/feature and its intent.

## Adding new code

New code should be committed as follows:

- All new components: https://github.com/element-hq/element-web/tree/develop/src/components
- CSS: https://github.com/element-hq/element-web/tree/develop/res/css
- Theme specific CSS & resources: https://github.com/element-hq/element-web/tree/develop/res/themes
