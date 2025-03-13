# Playwright in Element Web

## Contents

- How to run the tests
- How the tests work
- How to write great Playwright tests
- Visual testing

## Running the Tests

Our Playwright tests run automatically as part of our CI along with our other tests,
on every pull request and on every merge to develop & master.

You may need to follow instructions to set up your development environment for running
Playwright by following <https://playwright.dev/docs/browsers#install-browsers> and
<https://playwright.dev/docs/browsers#install-system-dependencies>.

However the Playwright tests are run, an element-web instance must be running on
http://localhost:8080 (this is configured in `playwright.config.ts`) - this is what will
be tested. When running Playwright tests yourself, the standard `yarn start` from the
element-web project is fine: leave it running it a different terminal as you would
when developing. Alternatively if you followed the development set up from element-web then
Playwright will be capable of running the webserver on its own if it isn't already running.

The tests use [testcontainers](https://node.testcontainers.org/) to launch Homeserver (Synapse or Dendrite)
instances to test against, so you'll also need to one of the
[supported container runtimes](#supporter-container-runtimes)
installed and working in order to run the Playwright tests.

There are a few different ways to run the tests yourself. The simplest is to run:

```shell
yarn run test:playwright
```

This will run the Playwright tests once, non-interactively.

You can also run individual tests this way too, as you'd expect:

```shell
yarn run test:playwright --spec playwright/e2e/register/register.spec.ts
```

Playwright also has its own UI that you can use to run and debug the tests.
To launch it:

```shell
yarn run test:playwright:open --headed --debug
```

See more command line options at <https://playwright.dev/docs/test-cli>.

## Projects

By default, Playwright will run all "Projects", this means tests will run against Chrome, Firefox and "Safari" (Webkit).
We only run tests against Chrome in pull request CI, but all projects in the merge queue.
Some tests are excluded from running on certain browsers due to incompatibilities in the test harness.

## How the Tests Work

Everything Playwright-related lives in the `playwright/` subdirectory
as is typical for Playwright tests. Likewise, tests live in `playwright/e2e`.

`playwright/testcontainers` contains the testcontainers which start instances
of Synapse/Dendrite. These servers are what Element-web runs against in the tests.

Synapse can be launched with different configurations in order to test element
in different configurations. You can specify `synapseConfig` as such:

```typescript
test.use({
    synapseConfig: {
        // The config options to pass to the Synapse instance
    },
});
```

The appropriate homeserver will be launched by the Playwright worker and reused for all tests which match the worker configuration.
Due to homeservers being reused between tests, please use unique names for any rooms put into the room directory as
they may be visible from other tests, the suggested approach is to use `testInfo.testId` within the name or lodash's uniqueId.
We remove public rooms from the room directory between tests but deleting users doesn't have a homeserver agnostic solution.
The logs from testcontainers will be attached to any reports output from Playwright.

## Writing Tests

Mostly this is the same advice as for writing any other Playwright test: the Playwright
docs are well worth a read if you're not already familiar with Playwright testing, eg.
https://playwright.dev/docs/best-practices. To avoid your tests being flaky it is also
recommended to use [auto-retrying assertions](https://playwright.dev/docs/test-assertions#auto-retrying-assertions).

### Getting a Synapse

We heavily leverage the magic of [Playwright fixtures](https://playwright.dev/docs/test-fixtures).
To acquire a homeserver within a test just add the `homeserver` fixture to the test:

```typescript
test("should do something", async ({ homeserver }) => {
    // homeserver is a Synapse/Dendrite instance
});
```

This returns an object with information about the Homeserver instance, including what port
it was started on and the ID that needs to be passed to shut it down again. It also
returns the registration shared secret (`registrationSecret`) that can be used to
register users via the REST API. The Homeserver has been ensured ready to go by awaiting
its internal health-check.

Homeserver instances should be reasonably cheap to start (you may see the first one take a
while as it pulls the Docker image).
You do not need to explicitly clean up the instance as it will be cleaned up by the fixture.

### Logging In

We again heavily leverage the magic of [Playwright fixtures](https://playwright.dev/docs/test-fixtures).
To acquire a logged-in user within a test just add the `user` fixture to the test:

```typescript
test("should do something", async ({ user }) => {
    // user is a logged in user
});
```

You can specify a display name for the user via `test.use` `displayName`,
otherwise a random one will be generated.
This will register a random userId using the registrationSecret with a random password
and the given display name. The user fixture will contain details about the credentials for if
they are needed for User-Interactive Auth or similar but localStorage will already be seeded with them
and the app loaded (path `/`).

### Joining a Room

Many tests will also want to start with the client in a room, ready to send & receive messages. Best
way to do this may be to get an access token for the user and use this to create a room with the REST
API before logging the user in.
You can make use of the bot fixture and the `client` field on the app fixture to do this.

### Try to write tests from the users' perspective

Like for instance a user will not look for a button by querying a CSS selector.
Instead, you should work with roles / labels etc, see https://playwright.dev/docs/locators.

### Using matrix-js-sdk

Due to the way we run the Playwright tests in CI, at this time you can only use the matrix-js-sdk module
exposed on `window.matrixcs`. This has the limitation that it is only accessible with the app loaded.
This may be revisited in the future.

## Good Test Hygiene

This section mostly summarises general good Playwright testing practice, and should not be news to anyone
already familiar with Playwright.

1. Test a well-isolated unit of functionality. The more specific, the easier it will be to tell what's
   wrong when they fail.
1. Don't depend on state from other tests: any given test should be able to run in isolation.
1. Try to avoid driving the UI for anything other than the UI you're trying to test. e.g. if you're
   testing that the user can send a reaction to a message, it's best to send a message using a REST
   API, then react to it using the UI, rather than using the element-web UI to send the message.
1. Avoid explicit waits. Playwright locators & assertions will implicitly wait for the specified
   element to appear and all assertions are retried until they either pass or time out, so you should
   never need to manually wait for an element.
    - For example, for asserting about editing an already-edited message, you can't wait for the
      'edited' element to appear as there was already one there, but you can assert that the body
      of the message is what is should be after the second edit and this assertion will pass once
      it becomes true. You can then assert that the 'edited' element is still in the DOM.
    - You can also wait for other things like network requests in the
      browser to complete (https://playwright.dev/docs/api/class-page#page-wait-for-response).
      Needing to wait for things can also be because of race conditions in the app itself, which ideally
      shouldn't be there!

This is a small selection - the Playwright best practices guide, linked above, has more good advice, and we
should generally try to adhere to them.

## Screenshot testing

When we previously used Cypress we also dabbled with Percy, and whilst powerful it did not
lend itself well to being executed on all PRs without needing to budget it substantially.

Playwright has built-in support for [visual comparison testing](https://playwright.dev/docs/test-snapshots).
Screenshots are saved in `playwright/snapshots` and are rendered in a Linux Docker environment for stability.

One must be careful to exclude any dynamic content from the screenshot, such as timestamps, avatars, etc,
via the `mask` option. See the [Playwright docs](https://playwright.dev/docs/test-snapshots#masking).

Some UI elements render differently between test runs, such as BaseAvatar when
there is no avatar set, choosing a colour from the theme palette based on the
hash of the user/room's Matrix ID. To avoid this creating flaky tests we inject
some custom CSS, for this to happen we use the custom assertion `toMatchScreenshot`
instead of the native `toHaveScreenshot`.

If you are running Linux and are unfortunate that the screenshots are not rendering identically,
you may wish to specify `--ignore-snapshots` and rely on Docker to render them for you.

## Test Tags

We use test tags to categorise tests for running subsets more efficiently.

- `@mergequeue`: Tests that are slow or flaky and cover areas of the app we update seldom, should not be run on every PR commit but will be run in the Merge Queue.
- `@screenshot`: Tests that use `toMatchScreenshot` to speed up a run of `test:playwright:screenshots`. A test with this tag must not also have the `@mergequeue` tag as this would cause false positives in the stale screenshot detection.
- `@no-$project`: Tests which are unsupported in $Project. These tests will be skipped when running in $Project.

Anything testing Matrix media will need to have `@no-firefox` and `@no-webkit` as those rely on the service worker which
has to be disabled in Playwright on Firefox & Webkit to retain routing functionality.
Anything testing VoIP/microphone will need to have `@no-webkit` as fake microphone functionality is not available
there at this time.

If you wish to run all tests in a PR, you can give it the label `X-Run-All-Tests`.

## Supporter container runtimes

We use testcontainers to spin up various instances of Synapse, Matrix Authentication Service, and more.
It supports Docker out of the box but also has support for Podman, Colima, Rancher, you just need to follow some instructions to achieve it:
https://node.testcontainers.org/supported-container-runtimes/

If you are running under Colima, you may need to set the environment variable `TMPDIR` to `/tmp/colima` or a path
within `$HOME` to allow bind mounting temporary directories into the Docker containers.
