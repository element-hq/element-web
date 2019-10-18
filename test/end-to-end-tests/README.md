# Matrix React SDK End-to-End tests

This directory contains tests for matrix-react-sdk. The tests fire up a headless Chrome and simulate user interaction (end-to-end). Note that end-to-end has little to do with the end-to-end encryption Matrix supports, just that we test the full stack, going from user interaction to expected DOM in the browser.

## Setup

Run `./install.sh`. This will:
 - install Synapse, fetches the master branch at the moment. If anything fails here, please refer to the Synapse README to see if you're missing one of the prerequisites.
 - install Riot, this fetches the master branch at the moment.
 - install dependencies (will download copy of chrome)

## Running the tests

Run tests with `./run.sh`.

### Debug tests locally.

`./run.sh` will run the tests against the Riot copy present in `riot/riot-web` served by a static Python HTTP server. You can symlink your `riot-web` develop copy here but that doesn't work well with Webpack recompiling. You can run the test runner directly and specify parameters to get more insight into a failure or run the tests against your local Webpack server.

```
./synapse/stop.sh && \
./synapse/start.sh && \
node start.js <parameters>
```
It's important to always stop and start Synapse before each run of the tests to clear the in-memory SQLite database it uses, as the tests assume a blank slate.

start.js accepts these parameters (and more, see `node start.js --help`) that can help running the tests locally:

 - `--riot-url <url>` don't use the Riot copy and static server provided by the tests, but use a running server like the Webpack watch server to run the tests against. Make sure to have the following local config:
   - `welcomeUserId` disabled as the tests assume there is no riot-bot currently.
 - `--slow-mo` type at a human speed, useful with `--windowed`.
 - `--throttle-cpu <factor>` throttle cpu in the browser by the given factor. Useful to reproduce failures because of insufficient timeouts happening on the slower CI server.
 - `--windowed` run the tests in an actual browser window Try to limit interacting with the windows while the tests are running. Hovering over the window tends to fail the tests, dragging the title bar should be fine though.
 - `--dev-tools` open the devtools in the browser window, only applies if `--windowed` is set as well.

Developer Guide
===============

Please follow the standard Matrix contributor's guide:
https://github.com/matrix-org/synapse/tree/master/CONTRIBUTING.rst

Please follow the Matrix JS/React code style as per:
https://github.com/matrix-org/matrix-react-sdk/blob/master/code_style.md
