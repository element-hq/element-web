# Playwright in Element Web

## Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Running the Tests](#running-the-tests)
    - [Element Web E2E Tests](#element-web-e2e-tests)
    - [Shared Components Tests](#shared-components-tests)
    - [Projects](#projects)
- [How the Tests Work](#how-the-tests-work)
    - [Test Structure](#test-structure)
    - [Homeserver Setup](#homeserver-setup)
    - [Fixtures](#fixtures)
- [Writing Tests](#writing-tests)
    - [Getting a Homeserver](#getting-a-homeserver)
    - [Logging In](#logging-in)
    - [Joining a Room](#joining-a-room)
    - [Using matrix-js-sdk](#using-matrix-js-sdk)
    - [Best Practices](#best-practices)
- [Visual Testing](#visual-testing)
- [Test Tags](#test-tags)
- [Supported Container Runtimes](#supported-container-runtimes)

## Overview

Element Web contains two sets of Playwright tests:

1. **Element Web E2E Tests** (`playwright/e2e/`) - Full end-to-end tests of the Element Web application with real homeserver instances
2. **Shared Components Tests** (`packages/shared-components/`) - Visual regression tests for the shared component library using Storybook

Both test suites run automatically in CI on every pull request and on every merge to develop & master.

## Prerequisites

Before running Playwright tests, ensure you have the following set up:

### 1. Install Playwright Browsers and System Dependencies

Follow the Playwright installation instructions:

- **Browsers:** <https://playwright.dev/docs/browsers#install-browsers>
- **System dependencies:** <https://playwright.dev/docs/browsers#install-system-dependencies>

```sh
yarn playwright install --with-deps
```

### 2. Container Runtime

See [Supported Container Runtimes](#supported-container-runtimes) for details on supported container runtimes (Docker, Podman, Colima).

### 3. Element Web Server (for E2E tests)

Element Web E2E tests require an instance running on `http://localhost:8080` (configured in `playwright.config.ts`).

You can either:

- **Run manually:** `yarn start` in a separate terminal (not working for screenshot tests running in a docker environment).
- **Auto-start:** Playwright will start the webserver automatically if it's not already running

## Running the Tests

### Element Web E2E Tests

Our main Playwright tests run against a full Element Web instance with Synapse/Dendrite homeservers.

**Run all E2E tests:**

```sh
yarn run test:playwright
```

**Run a specific test file:**

```sh
yarn run test:playwright playwright/e2e/register/register.spec.ts
```

**Run tests interactively with Playwright UI:**

```sh
yarn run test:playwright:open
```

**Run screenshot tests only:**

> [!WARNING]
> This command run the playwright tests in a docker environment.

```sh
yarn run test:playwright:screenshots
```

For more information about visual testing, see [Visual Testing](playwright#visual-testing).

**Additional command line options:** <https://playwright.dev/docs/test-cli>

### Shared Components Tests

The shared-components package uses Playwright (via Storybook test runner) to validate component rendering across different states and configurations.

**Run Storybook tests:**

```sh
cd packages/shared-components
yarn test:storybook
```

**Run Storybook tests in CI mode:**

```sh
cd packages/shared-components
yarn test:storybook:ci
```

**Update Storybook screenshots:**

```sh
cd packages/shared-components
yarn test:storybook:update
```

This uses the same Docker-based screenshot rendering as Element Web to ensure consistency across platforms.

### Projects

By default, Playwright runs tests against all "Projects": Chrome, Firefox, "Safari" (Webkit), Dendrite and Picone.

- Chrome, Firefox, Safari run against Synapse
- Dendrite and Picone run against Chrome

Misc:

- **Pull Request CI:** Tests run only against Chrome
- **Merge Queue:** Tests run against all projects
- Some tests are excluded from certain browsers due to incompatibilities (see [Test Tags](#test-tags))

## How the Tests Work

### Test Structure

**Element Web tests** are located in the `playwright/` subdirectory:

- `playwright/e2e/` - E2E test files
- `playwright/testcontainers/` - Testcontainers for Synapse/Dendrite instances
- `playwright/snapshots/` - Visual regression test screenshots
- `playwright/pages/` - Page object models
- `playwright/plugins/` - Custom Playwright plugins

**Shared components tests** are located in `packages/shared-components/`:

- `packages/shared-components/playwright/snapshots/` - Storybook screenshot baselines
- `packages/shared-components/.storybook/` - Storybook configuration

The shared components use Storybook's test runner (powered by Playwright) to validate component rendering across different states and configurations.

### Homeserver Setup

Homeservers (Synapse or Dendrite) are launched by Playwright workers and reused for all tests matching the worker configuration.

**Configure Synapse options:**

```typescript
test.use({
    synapseConfig: {
        // Configuration options for the Synapse instance
    },
});
```

**Important notes:**

- Homeservers are reused between tests for efficiency
- Please use unique names for any rooms put into the room directory as they may be visible from other tests, the suggested approach is to use `testInfo.testId` within the name or lodash's uniqueId.
- We remove public rooms from the room directory between tests but deleting users doesn't have a homeserver agnostic solution.
- Homeserver logs are attached to Playwright test reports

### Fixtures

We heavily leverage [Playwright fixtures](https://playwright.dev/docs/test-fixtures) to provide:

- Homeserver instances (`homeserver`)
- Logged-in users (`user`)
- Bot users (`bot`)
- Application state (`app`)

See [Writing Tests](#writing-tests) for usage examples.

## Writing Tests

For general Playwright best practices, see:

- <https://playwright.dev/docs/best-practices>
- <https://playwright.dev/docs/test-assertions#auto-retrying-assertions> (recommended for avoiding flaky tests)

### Getting a Homeserver

Use the `homeserver` fixture to acquire a Homeserver instance:

```typescript
test("should do something", async ({ homeserver }) => {
    // homeserver is a ready-to-use Synapse/Dendrite instance
});
```

**The fixture provides:**

- Server port information
- Instance ID for shutdown
- Registration shared secret (`registrationSecret`) for registering users via REST API

Homeserver instances are:

- Reasonably cheap to start (first run may be slow while pulling Docker image)
- Automatically cleaned up by the fixture

### Logging In

Use the `user` fixture to get a logged-in user:

```typescript
test("should do something", async ({ user }) => {
    // user is logged in and ready to use
});
```

**Customize the user:**

```typescript
test.use({
    displayName: "Alice",
});

test("should do something", async ({ user }) => {
    // user is logged in as "Alice"
});
```

**What the fixture does:**

- Registers a random userId with the `registrationSecret`
- Generates a random password (or uses specified display name)
- Seeds localStorage with credentials
- Loads the app at path `/`
- Provides user details for User-Interactive Auth if needed

### Joining a Room

To start with a user in a room:

```typescript
test("should send a message", async ({ user, app, bot }) => {
    // Use the bot client to create a room
    const roomId = await bot.createRoom({
        name: "Test Room",
        invite: [user.userId],
    });

    // Accept the invite using the app client
    await app.client.joinRoom(roomId);

    // Now ready to test messaging
});
```

**Best practice:** Use the REST API (via `bot` or `app.client`) to set up room state rather than driving the UI.

### Using matrix-js-sdk

Due to CI constraints, use the matrix-js-sdk module exposed on `window.matrixcs`:

```typescript
const matrixcs = window.matrixcs;
```

**Limitation:** Only accessible when the app is loaded. This may be revisited in the future.

### Best Practices

For more guidance, see the [Playwright best practices guide](https://playwright.dev/docs/best-practices).

#### 1. Test from the User's Perspective

Work with roles, labels, and accessible elements rather than CSS selectors:

```typescript
// Good
await page.getByRole("button", { name: "Send" }).click();

// Avoid
await page.locator(".mx_MessageComposer_sendButton").click();
```

See <https://playwright.dev/docs/locators> for more guidance.

#### 2. Test Well-Isolated Functionality

- Focus on specific, well-defined units of functionality
- Easier to debug when tests fail
- More maintainable over time

#### 3. Maintain Test Independence

- Each test should run successfully in isolation
- Don't depend on state from other tests
- Clean up after your test if needed

#### 4. Minimize UI Driving for Setup

- Use REST APIs to set up test state when possible
- Only drive the UI for the functionality you're actually testing

**Example:**

```typescript
// Testing reactions - good approach
test("should react to a message", async ({ page, app, bot }) => {
    // Send message via API
    const eventId = await bot.sendMessage(roomId, "Hello");

    // Test the reaction UI
    await page.getByText("Hello").hover();
    await page.getByRole("button", { name: "React" }).click();
    await page.getByLabel("😀").click();

    // Verify reaction was sent
    await expect(page.getByLabel("😀 1")).toBeVisible();
});
```

#### 5. Avoid Explicit Waits

Playwright locators and assertions automatically wait and retry:

```typescript
// Good - implicit waiting
await expect(page.getByText("Message sent")).toBeVisible();

// Avoid - explicit waits
await page.waitForTimeout(1000);
```

**For dynamic content:**

```typescript
// Assert on the final state - Playwright will wait for it
await expect(page.getByRole("textbox")).toHaveValue("Edited message");
await expect(page.getByText("edited")).toBeVisible();
```

**When you do need to wait:**

```typescript
// Wait for network requests
await page.waitForResponse("**/messages");

// Wait for specific conditions
await page.waitForFunction(() => window.matrixcs !== undefined);
```

## Visual Testing

Playwright has built-in support for [visual comparison testing](https://playwright.dev/docs/test-snapshots).

**Screenshot location:** `playwright/snapshots/`

**Rendering environment:** Linux Docker (for consistency across environments)

### Test Tag for Screenshots

All screenshot tests must use the `@screenshot` tag:

```typescript
test("should render message list", { tag: "@screenshot" }, async ({ page }) => {
    await expect(page).toMatchScreenshot("message-list.png");
});
```

**Purpose of `@screenshot` tag:**

- Allows running only screenshot tests via `test:playwright:screenshots`
- Speeds up screenshot test runs and updates

### Taking Screenshots

Use the custom `toMatchScreenshot` assertion (not the native `toHaveScreenshot`):

```typescript
await expect(page).toMatchScreenshot("my-screenshot.png");
```

**Why a custom assertion?** We inject custom CSS to stabilize dynamic UI elements (e.g., BaseAvatar color selection based on Matrix ID hash).

### Masking Dynamic Content

Always mask dynamic content that changes between runs:

```typescript
await expect(page).toMatchScreenshot("chat.png", {
    mask: [page.locator(".mx_MessageTimestamp"), page.locator(".mx_BaseAvatar")],
});
```

Common elements to mask:

- Timestamps
- Avatars (when dynamic)
- Animated elements
- User-generated IDs

See [Playwright masking docs](https://playwright.dev/docs/test-snapshots#masking) for more details.

### Updating Screenshots

This command runs only tests tagged with `@screenshot` in the Docker environment.
When you need to update screenshot baselines (e.g., after intentional UI changes):

```sh
yarn run test:playwright:screenshots
```

**Important:** Always use this command to update screenshots rather than running tests locally with `--update-snapshots`.

**Why?** Screenshots must be rendered in a consistent Linux Docker environment because:

- Font rendering differs between operating systems (macOS, Windows, Linux)
- Subpixel rendering varies across systems
- Browser rendering engines have platform-specific differences

Using `test:playwright:screenshots` ensures screenshots are generated in the same Docker environment used in CI, preventing false failures due to rendering differences.

## Test Tags

Test tags categorize tests for efficient subset execution.

### Available Tags

- **`@mergequeue`**: Slow or flaky tests covering rarely-updated app areas
    - Not run on every PR commit
    - Run in the Merge Queue

- **`@screenshot`**: Tests using `toMatchScreenshot` for visual regression testing
    - See the [Visual Testing](#visual-testing) section for detailed usage

- **`@no-firefox`**: Tests unsupported in Firefox
    - Automatically skipped in Firefox project
    - Common reason: Service worker required (disabled in Playwright Firefox for routing)

- **`@no-webkit`**: Tests unsupported in Webkit
    - Automatically skipped in Webkit project
    - Common reasons: Service worker required, microphone functionality unavailable

### Running All Tests in a PR

Add the `X-Run-All-Tests` label to your pull request to run all tests, including `@mergequeue` tests.

## Supported Container Runtimes

We use [testcontainers](https://node.testcontainers.org/) to manage Synapse, Matrix Authentication Service, and other service instances.

**Supported runtimes:**

- Docker (default, recommended)
- Podman
- Colima
  See setup instructions: <https://node.testcontainers.org/supported-container-runtimes/>

### Platform-Specific Configuration

**Colima users:**

If using Colima, you may need to set the `TMPDIR` environment variable to allow bind mounting temporary directories:

```sh
export TMPDIR=/tmp/colima
# or
export TMPDIR=$HOME/tmp
```

**macOS users:**

Docker Desktop and Colima are both well-supported on macOS.

> [!CAUTION]
> Do not set `DOCKER_HOST` when running tests. Element Web uses [element-web-playwright-common](https://github.com/element-hq/element-modules/tree/main/packages/element-web-playwright-common), and setting `DOCKER_HOST` causes issues with testcontainers when running in the container VM.
