# Matrix React Web App End-to-End tests

This repository contains tests for the matrix-react-sdk web app. The tests fire up a headless chrome and simulate user interaction (end-to-end). Note that end-to-end has little to do with the end-to-end encryption matrix supports, just that we test the full stack, going from user interaction to expected DOM in the browser.

## Current tests
 - test riot loads (check title)
 - signup with custom homeserver
 - join preexisting room

## Roadmap
- get rid of jest, as a test framework won't be helpful to have a continuous flow going from one use case to another (think: do login, create a room, invite a user, ...). a test framework usually assumes the tests are semi-indepedent.
- better error reporting (show console.log, XHR requests, partial DOM, screenshot) on error
- cleanup helper methods
- add more css id's/classes to riot web to make css selectors in test less brittle.
- avoid delay when waiting for location.hash to change
- more tests!
- setup installing & running riot and synapse as part of the tests.
   - Run 2 synapse instances to test federation use cases.
   - start synapse with clean config/database on every test run
- look into CI(Travis) integration
- create interactive mode, where window is opened, and browser is kept open until Ctrl^C, for easy test debugging.

## It's broken! How do I see what's happening in the browser?

Look for this line:
```
puppeteer.launch();
```
Now change it to:
```
puppeteer.launch({headless: false});
```

## How to run

### Setup
 - install synapse with `sh synapse/install.sh`, this fetches the master branch at the moment. If anything fails here, please refer to the synapse README to see if you're missing one of the prerequisites.
 - install riot with `sh riot/install.sh`, this fetches the master branch at the moment.
 - install dependencies with `npm install` (will download copy of chrome)
 - have riot-web running on `localhost:8080`
 - have a local synapse running at `localhost:8008`

### Run tests
 
Run tests with `sh run.sh`.

You should see the terminal split with on top the server output (both riot static server, and synapse), and on the bottom the tests running.

Developer Guide
===============

Please follow the standard Matrix contributor's guide:
https://github.com/matrix-org/synapse/tree/master/CONTRIBUTING.rst

Please follow the Matrix JS/React code style as per:
https://github.com/matrix-org/matrix-react-sdk/blob/master/code_style.md
