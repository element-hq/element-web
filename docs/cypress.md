# Cypress in Element Web

## Scope of this Document
This doc is about our Cypress tests in Element Web and how we use Cypress to write tests.
It aims to cover:
 * How to run the tests yourself
 * How the tests work
 * How to write great Cypress tests
 * Visual testing

## Running the Tests
Our Cypress tests run automatically as part of our CI along with our other tests,
on every pull request and on every merge to develop & master.

However the Cypress tests are run, an element-web must be running on
http://localhost:8080 (this is configured in `cypress.json`) - this is what will
be tested. When running Cypress tests yourself, the standard `yarn start` from the
element-web project is fine: leave it running it a different terminal as you would
when developing.

The tests use Docker to launch Synapse instances to test against, so you'll also
need to have Docker installed and working in order to run the Cypress tests.

There are a few different ways to run the tests yourself. The simplest is to run:

```
yarn run test:cypress
```

This will run the Cypress tests once, non-interactively.

You can also run individual tests this way too, as you'd expect:

```
yarn run test:cypress --spec cypress/e2e/1-register/register.spec.ts
```

Cypress also has its own UI that you can use to run and debug the tests.
To launch it:

```
yarn run test:cypress:open
```

## How the Tests Work
Everything Cypress-related lives in the `cypress/` subdirectory of react-sdk
as is typical for Cypress tests. Likewise, tests live in `cypress/e2e`.

`cypress/plugins/synapsedocker` contains a Cypress plugin that starts instances
of Synapse in Docker containers. These synapses are what Element-web runs against
in the Cypress tests.

Synapse can be launched with different configurations in order to test element
in different configurations. `cypress/plugins/synapsedocker/templates` contains
template configuration files for each different configuration.

Each test suite can then launch whatever Synapse instances it needs it whatever
configurations.

Note that although tests should stop the Synapse instances after running and the
plugin also stop any remaining instances after all tests have run, it is possible
to be left with some stray containers if, for example, you terminate a test such
that the `after()` does not run and also exit Cypress uncleanly. All the containers
it starts are prefixed, so they are easy to recognise. They can be removed safely.

After each test run, logs from the Synapse instances are saved in `cypress/synapselogs`
with each instance in a separate directory named after its ID. These logs are removed
at the start of each test run.

## Writing Tests
Mostly this is the same advice as for writing any other Cypress test: the Cypress
docs are well worth a read if you're not already familiar with Cypress testing, eg.
https://docs.cypress.io/guides/references/best-practices .

### Getting a Synapse
The key difference is in starting Synapse instances.  Tests use this plugin via
`cy.startSynapse()` to provide a Synapse instance to log into:

```javascript
cy.startSynapse("consent").then(result => {
    synapse = result;
});
```

This returns an object with information about the Synapse instance, including what port
it was started on and the ID that needs to be passed to shut it down again. It also
returns the registration shared secret (`registrationSecret`) that can be used to
register users via the REST API. The Synapse has been ensured ready to go by awaiting
its internal health-check.

Synapse instances should be reasonably cheap to start (you may see the first one take a
while as it pulls the Docker image), so it's generally expected that tests will start a
Synapse instance for each test suite, i.e. in `before()`, and then tear it down in `after()`.

To later destroy your Synapse you should call `stopSynapse`, passing the SynapseInstance
object you received when starting it.
```javascript
cy.stopSynapse(synapse);
```

### Synapse Config Templates
When a Synapse instance is started, it's given a config generated from one of the config
templates in `cypress/plugins/synapsedocker/templates`. There are a couple of special files
in these templates:
 * `homeserver.yaml`:
   Template substitution happens in this file. Template variables are:
   * `REGISTRATION_SECRET`: The secret used to register users via the REST API.
   * `MACAROON_SECRET_KEY`: Generated each time for security
   * `FORM_SECRET`: Generated each time for security
   * `PUBLIC_BASEURL`: The localhost url + port combination the synapse is accessible at
 * `localhost.signing.key`: A signing key is auto-generated and saved to this file.
   Config templates should not contain a signing key and instead assume that one will exist
   in this file.

All other files in the template are copied recursively to `/data/`, so the file `foo.html`
in a template can be referenced in the config as `/data/foo.html`.

### Logging In
There exists a basic utility to start the app with a random user already logged in:
```javascript
cy.initTestUser(synapse, "Jeff");
```
It takes the SynapseInstance you received from `startSynapse` and a display name for your test user.
This custom command will register a random userId using the registrationSecret with a random password
and the given display name. The returned Chainable will contain details about the credentials for if
they are needed for User-Interactive Auth or similar but localStorage will already be seeded with them
and the app loaded (path `/`).

The internals of how this custom command run may be swapped out later,
but the signature can be maintained for simpler maintenance.

### Joining a Room
Many tests will also want to start with the client in a room, ready to send & receive messages. Best
way to do this may be to get an access token for the user and use this to create a room with the REST
API before logging the user in. You can make use of `cy.getBot(synapse)` and `cy.getClient()` to do this.

### Convenience APIs
We should probably end up with convenience APIs that wrap the synapse creation, logging in and room
creation that can be called to set up tests.

### Using matrix-js-sdk
Due to the way we run the Cypress tests in CI, at this time you can only use the matrix-js-sdk module
exposed on `window.matrixcs`. This has the limitation that it is only accessible with the app loaded.
This may be revisited in the future.

## Good Test Hygiene
This section mostly summarises general good Cypress testing practice, and should not be news to anyone
already familiar with Cypress.

1. Test a well-isolated unit of functionality. The more specific, the easier it will be to tell what's
   wrong when they fail.
1. Don't depend on state from other tests: any given test should be able to run in isolation.
1. Try to avoid driving the UI for anything other than the UI you're trying to test. e.g. if you're
   testing that the user can send a reaction to a message, it's best to send a message using a REST
   API, then react to it using the UI, rather than using the element-web UI to send the message.
1. Avoid explicit waits. `cy.get()` will implicitly wait for the specified element to appear and
   all assertions are retired until they either pass or time out, so you should never need to
   manually wait for an element.
    * For example, for asserting about editing an already-edited message, you can't wait for the
      'edited' element to appear as there was already one there, but you can assert that the body
      of the message is what is should be after the second edit and this assertion will pass once
      it becomes true. You can then assert that the 'edited' element is still in the DOM.
    * You can also wait for other things like network requests in the
      browser to complete (https://docs.cypress.io/guides/guides/network-requests#Waiting).
      Needing to wait for things can also be because of race conditions in the app itself, which ideally
      shouldn't be there!

This is a small selection - the Cypress best practices guide, linked above, has more good advice, and we
should generally try to adhere to them.

## Percy Visual Testing
We also support visual testing via Percy, this extracts the DOM from Cypress and renders it using custom renderers
for Safari, Firefox, Chrome & Edge, allowing us to spot visual regressions before they become release regressions.
Each `cy.percySnapshot()` call results in 8 screenshots (4 browsers, 2 sizes) this can quickly be exhausted and
so we only run Percy testing on `develop` and PRs which are labelled `X-Needs-Percy`.

To record a snapshot use `cy.percySnapshot()`, you may have to pass `percyCSS` into the 2nd argument to hide certain
elements which contain dynamic/generated data to avoid them cause false positives in the Percy screenshot diffs.

