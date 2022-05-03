# Cypress in Element Web

## Scope of this Document
This doc is about our Cypress tests in Element Web and how we use Cypress to write tests.
It aims to cover:
 * How to run the tests yourself
 * How the tests work
 * How to write great Cypress tests

## Running the Tests
Our Cypress tests run automatically as part of our CI along with our other tests,
on every pull request and on every merge to develop.

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
yarn run test:cypress cypress/integration/1-register/register.spec.ts
```

Cypress also has its own UI that you can use to run and debug the tests.
To launch it:

```
yarn run test:cypress:open
```

## How the Tests Work
Everything Cypress-related lives in the `cypress/` subdirectory of react-sdk
as is typical for Cypress tests. Likewise, tests live in `cypress/integration`.

`cypress/plugins/synapsedocker` contains a Cypress plugin that starts instances
of Synapse in Docker containers. These synapses are what Element-web runs against
in the Cypress tests.

Synapse can be launched with different configurations in order to test element
in different configurations. `cypress/plugins/synapsedocker/templates` contains
template configuration files for each different configuration.

Each test suite can then launch whatever Syanpse instances it needs it whatever
configurations.

Note that although tests should stop the Synapse instances after running and the
plugin also stop any remaining instances after all tests have run, it is possible
to be left with some stray containers if, for example, you terminate a test such
that the `after()` does not run and also exit Cypress uncleanly. All the containers
it starts are prefixed so they are easy to recognise. They can be removed safely.

After each test run, logs from the Syanpse instances are saved in `cypress/synapselogs`
with each instance in a separate directory named after it's ID. These logs are removed
at the start of each test run.

## Writing Tests
Mostly this is the same advice as for writing any other Cypress test: the Cypress
docs are well worth a read if you're not already familiar with Cypress testing, eg.
https://docs.cypress.io/guides/references/best-practices .

### Getting a Synapse
The key difference is in starting Synapse instances.  Tests use this plugin via
`cy.task()` to provide a Synapse instance to log into:

```
cy.task<SynapseInstance>("synapseStart", "consent").then(result => {
    synapseId = result.synapseId;
    synapsePort = result.port;
});
```

This returns an object with information about the Synapse instance, including what port
it was started on and the ID that needs to be passed to shut it down again. It also
returns the registration shared secret (`registrationSecret`) that can be used to
register users via the REST API.

Synapse instances should be reasonably cheap to start (you may see the first one take a
while as it pulls the Docker image), so it's generally expected that tests will start a
Synapse instance for each test suite, ie. in `before()`, and then tear it down in `after()`.

### Synapse Config Templates
When a Synapse instance is started, it's given a config generated from one of the config
templates in `cypress/plugins/synapsedocker/templates`. There are a couple of special files
in these templates:
 * `homeserver.yaml`:
   Template substitution happens in this file. Template variables are:
   * `REGISTRATION_SECRET`: The secret used to register users via the REST API.
   * `MACAROON_SECRET_KEY`: Generated each time for security
   * `FORM_SECRET`: Generated each time for security
 * `localhost.signing.key`: A signing key is auto-generated and saved to this file.
   Config templates should not contain a signing key and instead assume that one will exist
   in this file.

All other files in the template are copied recursively to `/data/`, so the file `foo.html`
in a template can be referenced in the config as `/data/foo.html`.

### Logging In
This doesn't quite exist yet. Most tests will just want to start with the client in a 'logged in'
state, so we should provide an easy way to start a test with element in this state. The
`registrationSecret` provided when starting a Synapse can be used to create a user (porting
the code from https://github.com/matrix-org/matrix-react-sdk/blob/develop/test/end-to-end-tests/src/rest/creator.ts#L49).
We'd then need to log in as this user. Ways of doing this would be:

1. Fill in the login form. This isn't ideal as it's effectively testing the login process in each
   test, and will just be slower.
1. Mint an access token using https://matrix-org.github.io/synapse/develop/admin_api/user_admin_api.html#login-as-a-user
   then inject this into element-web. This would probably be fastest, although also relies on correctly
   setting up localstorage
1. Mint a login token, inject the Homeserver URL into localstorage and then load element, passing the login
   token as a URL parameter. This is a supported way of logging in to element-web, but there's no API
   on Synapse to make such a token currently. It would be fairly easy to add a synapse-specific admin API
   to do so. We should write tests for token login (and the rest of SSO) at some point anyway though.

If we make this as a convenience API, it can easily be swapped out later: we could start with option 1
and then switch later.

### Joining a Room
Many tests will also want to start with the client in a room, ready to send & receive messages. Best
way to do this may be to get an access token for the user and use this to create a room with the REST
API before logging the user in.

### Convenience APIs
We should probably end up with convenience APIs that wrap the synapse creation, logging in and room
creation that can be called to set up tests.

## Good Test Hygiene
This section mostly summarises general good Cypress testing practice, and should not be news to anyone
already familiar with Cypress.

1. Test a well-isolated unit of functionality. The more specific, the easier it will be to tell what's
   wrong when they fail. 
1. Don't depend on state from other tests: any given test should be able to run in isolation.
1. Try to avoid driving the UI for anything other than the UI you're trying to test. eg. if you're
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
