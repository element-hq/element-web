# Matrix React Web App End-to-End tests

This repository contains tests for the matrix-react-sdk web app. The tests fire up a headless chrome and simulate user interaction (end-to-end). Note that end-to-end has little to do with the end-to-end encryption matrix supports, just that we test the full stack, going from user interaction to expected DOM in the browser.

## Setup

Run `./install.sh`. This will:
 - install synapse, fetches the master branch at the moment. If anything fails here, please refer to the synapse README to see if you're missing one of the prerequisites.
 - install riot, this fetches the master branch at the moment.
 - install dependencies (will download copy of chrome)

## Running the tests

Run tests with `./run.sh`.

### Debug tests locally.

`./run.sh` will run the tests against the riot copy present in `riot/riot-web` served by a static python http server. You can symlink your `riot-web` develop copy here but that doesn't work well with webpack recompiling. You can run the test runner directly and specify parameters to get more insight into a failure or run the tests against your local webpack server.

```
./synapse/stop.sh && \
./synapse/start.sh && \
node start.js <parameters>
```
It's important to always stop and start synapse before each run of the tests to clear the in-memory sqlite database it uses, as the tests assume a blank slate.

start.js accepts the following parameters that can help running the tests locally:

 - `--no-logs` dont show the excessive logging show by default (meant for CI), just where the test failed.
 - `--riot-url <url>` don't use the riot copy and static server provided by the tests, but use a running server like the webpack watch server to run the tests against. Make sure to have `welcomeUserId` disabled in your config as the tests assume there is no riot-bot currently.
 - `--slow-mo` run the tests a bit slower, so it's easier to follow along with `--windowed`.
 - `--windowed` run the tests in an actual browser window Try to limit interacting with the windows while the tests are running. Hovering over the window tends to fail the tests, dragging the title bar should be fine though.
 - `--dev-tools` open the devtools in the browser window, only applies if `--windowed` is set as well.

Developer Guide
===============

Please follow the standard Matrix contributor's guide:
https://github.com/matrix-org/synapse/tree/master/CONTRIBUTING.rst

Please follow the Matrix JS/React code style as per:
https://github.com/matrix-org/matrix-react-sdk/blob/master/code_style.md
