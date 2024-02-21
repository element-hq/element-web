# Playwright in Element Web

## Contents

-   How to run the tests
-   How the tests work
-   How to write great Playwright tests
-   Visual testing

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

The tests use Docker to launch Homeserver (Synapse or Dendrite) instances to test against, so you'll also
need to have Docker installed and working in order to run the Playwright tests.

There are a few different ways to run the tests yourself. The simplest is to run:

```shell
docker pull matrixdotorg/synapse:develop
yarn run test:playwright
```

This will run the Playwright tests once, non-interactively.

Note: you don't need to run the `docker pull` command every time, but you should
do it regularly to ensure you are running against an up-to-date Synapse.

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

### Running with Rust cryptography

`matrix-js-sdk` is currently in the
[process](https://github.com/vector-im/element-web/issues/21972) of being
updated to replace its end-to-end encryption implementation to use the [Matrix
Rust SDK](https://github.com/matrix-org/matrix-rust-sdk). This is not currently
enabled by default, but it is possible to have Playwright configure Element to use
the Rust crypto implementation by passing `--project="Rust Crypto"` or using
the top left options in open mode.

## How the Tests Work

Everything Playwright-related lives in the `playwright/` subdirectory of react-sdk
as is typical for Playwright tests. Likewise, tests live in `playwright/e2e`.

`playwright/plugins/homeservers` contains Playwright plugins that starts instances
of Synapse/Dendrite in Docker containers. These servers are what Element-web runs
against in the tests.

Synapse can be launched with different configurations in order to test element
in different configurations. `playwright/plugins/homeserver/synapse/templates`
contains template configuration files for each different configuration.

Each test suite can then launch whatever Synapse instances it needs in whatever
configurations.

Note that although tests should stop the Homeserver instances after running and the
plugin also stop any remaining instances after all tests have run, it is possible
to be left with some stray containers if, for example, you terminate a test such
that the `after()` does not run and also exit Playwright uncleanly. All the containers
it starts are prefixed, so they are easy to recognise. They can be removed safely.

After each test run, logs from the Synapse instances are saved in `playwright/logs/synapse`
with each instance in a separate directory named after its ID. These logs are removed
at the start of each test run.

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

### Synapse Config Templates

When a Synapse instance is started, it's given a config generated from one of the config
templates in `playwright/plugins/homeserver/synapse/templates`. There are a couple of special files
in these templates:

-   `homeserver.yaml`:
    Template substitution happens in this file. Template variables are:
    -   `REGISTRATION_SECRET`: The secret used to register users via the REST API.
    -   `MACAROON_SECRET_KEY`: Generated each time for security
    -   `FORM_SECRET`: Generated each time for security
    -   `PUBLIC_BASEURL`: The localhost url + port combination the synapse is accessible at
-   `localhost.signing.key`: A signing key is auto-generated and saved to this file.
    Config templates should not contain a signing key and instead assume that one will exist
    in this file.

All other files in the template are copied recursively to `/data/`, so the file `foo.html`
in a template can be referenced in the config as `/data/foo.html`.

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
