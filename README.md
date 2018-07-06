# Matrix React Web App End-to-End tests

This repository contains tests for the matrix-react-sdk web app. The tests fire up a headless chrome and simulate user interaction (end-to-end). Note that end-to-end has little to do with the end-to-end encryption matrix supports, just that we test the full stack, going from user interaction to expected DOM in the browser.

## Current tests
 - test riot loads (check title)
 - signup with custom homeserver

## Roadmap
- get rid of jest, as a test framework won't be helpful to have a continuous flow going from one use case to another (think: do login, create a room, invite a user, ...). a test framework usually assumes the tests are semi-indepedent.
- better error reporting (show console.log, XHR requests, partial DOM, screenshot) on error
- cleanup helper methods
- add more css id's/classes to riot web to make css selectors in test less brittle.
- avoid delay when waiting for location.hash to change
- more tests!
- setup installing & running riot and synapse as part of the tests 
- look into CI(Travis) integration

## How to run

### Setup

 - install dependencies with `npm install`
 - have riot-web running on `localhost:8080`
 - have a local synapse running at `localhost:8008`

### Run tests
 - run tests with `./node_modules/jest/bin/jest.js`
