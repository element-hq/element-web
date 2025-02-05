/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "playwright-core";

import { expect, test } from "../../element-web-test";
import { selectHomeserver } from "../utils";
import { type Credentials, type HomeserverInstance } from "../../plugins/homeserver";
import { consentHomeserver } from "../../plugins/homeserver/synapse/consentHomeserver.ts";
import { isDendrite } from "../../plugins/homeserver/dendrite";

// This test requires fixed credentials for the device signing keys below to work
const username = "user1234";
const password = "p4s5W0rD";

// Pre-generated dummy signing keys to create an account that has signing keys set.
// Note the signatures are specific to the username and must be valid or the HS will reject the keys.
const DEVICE_SIGNING_KEYS_BODY = {
    master_key: {
        keys: {
            "ed25519:6qCouJsi2j7DzOmpxPTBALpvDTqa8p2mjrQR2P8wEbg": "6qCouJsi2j7DzOmpxPTBALpvDTqa8p2mjrQR2P8wEbg",
        },
        signatures: {
            "@user1234:localhost": {
                "ed25519:6qCouJsi2j7DzOmpxPTBALpvDTqa8p2mjrQR2P8wEbg":
                    "mvwqsYiGa2gPH6ueJsiJnceHMrZhf1pqIMGxkvKisN3ucz8sU7LwyzndbYaLkUKEDx1JuOKFfZ9Mb3mqc7PMBQ",
                "ed25519:SRHVWTNVBH":
                    "HVGmVIzsJe3d+Un/6S9tXPsU7YA8HjZPdxogVzdjEFIU8OjLyElccvjupow0rVWgkEqU8sO21LIHw9cWRZEmDw",
            },
        },
        usage: ["master"],
        user_id: "@user1234:localhost",
    },
    self_signing_key: {
        keys: {
            "ed25519:eqzRly4S1GvTA36v48hOKokHMtYBLm02zXRgPHue5/8": "eqzRly4S1GvTA36v48hOKokHMtYBLm02zXRgPHue5/8",
        },
        signatures: {
            "@user1234:localhost": {
                "ed25519:6qCouJsi2j7DzOmpxPTBALpvDTqa8p2mjrQR2P8wEbg":
                    "M2rt5xs+23egbVUwUcZuU7pMpn0chBNC5rpdyZGayfU3FDlx1DbopbakIcl5v4uOSGMbqUotyzkE6CchB+dgDw",
            },
        },
        usage: ["self_signing"],
        user_id: "@user1234:localhost",
    },
    user_signing_key: {
        keys: {
            "ed25519:h6C7sonjKSSa/VMvmpmFnwMA02H2rKIMSYZ2ddwgJn4": "h6C7sonjKSSa/VMvmpmFnwMA02H2rKIMSYZ2ddwgJn4",
        },
        signatures: {
            "@user1234:localhost": {
                "ed25519:6qCouJsi2j7DzOmpxPTBALpvDTqa8p2mjrQR2P8wEbg":
                    "5ZMJ7SG2qr76vU2nITKap88AxLZ/RZQmF/mBcAcVZ9Bknvos3WQp8qN9jKuiqOHCq/XpPORA6XBmiDIyPqTFAA",
            },
        },
        usage: ["user_signing"],
        user_id: "@user1234:localhost",
    },
    auth: {
        type: "m.login.password",
        identifier: { type: "m.id.user", user: "@user1234:localhost" },
        password: password,
    },
};

async function login(page: Page, homeserver: HomeserverInstance, credentials: Credentials) {
    await page.getByRole("link", { name: "Sign in" }).click();
    await selectHomeserver(page, homeserver.baseUrl);

    await page.getByRole("textbox", { name: "Username" }).fill(credentials.username);
    await page.getByPlaceholder("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();
}

// This test suite uses the same userId for all tests in the suite
// due to DEVICE_SIGNING_KEYS_BODY being specific to that userId,
// so we restart the Synapse container to make it forget everything.
test.use(consentHomeserver);
test.use({
    config: {
        // The only thing that we really *need* (otherwise Element refuses to load) is a default homeserver.
        // We point that to a guaranteed-invalid domain.
        default_server_config: {
            "m.homeserver": {
                base_url: "https://server.invalid",
            },
        },
    },
    context: async ({ context, homeserver }, use) => {
        // Restart the homeserver to wipe its in-memory db so we can reuse the same user ID without cross-signing prompts
        await homeserver.restart();
        await use(context);
    },
    credentials: async ({ context, homeserver }, use) => {
        const displayName = "Dave";
        const credentials = await homeserver.registerUser(username, password, displayName);
        console.log(`Registered test user @user:localhost with displayname ${displayName}`);

        await use({
            ...credentials,
            displayName,
        });

        // Restart the homeserver to wipe its in-memory db so we can reuse the same user ID without cross-signing prompts
        await homeserver.restart();
    },
});

test.describe("Login", () => {
    test.describe("Password login", () => {
        test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");

        test("Loads the welcome page by default; then logs in with an existing account and lands on the home screen", async ({
            credentials,
            page,
            homeserver,
            checkA11y,
        }) => {
            await page.goto("/");

            // Should give us the welcome page initially
            await expect(page.getByRole("heading", { name: "Welcome to Element!" })).toBeVisible();

            // Start the login process
            await page.getByRole("link", { name: "Sign in" }).click();

            // first pick the homeserver, as otherwise the user picker won't be visible
            await selectHomeserver(page, homeserver.baseUrl);

            await page.getByRole("button", { name: "Edit" }).click();

            // select the default server again
            await page.locator(".mx_StyledRadioButton").first().click();
            await page.getByRole("button", { name: "Continue", exact: true }).click();
            await expect(page.locator(".mx_ServerPickerDialog")).toHaveCount(0);
            await expect(page.locator(".mx_Spinner")).toHaveCount(0);
            // name of default server
            await expect(page.locator(".mx_ServerPicker_server")).toHaveText("server.invalid");

            // switch back to the custom homeserver
            await selectHomeserver(page, homeserver.baseUrl);

            await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible();
            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24688
            // cy.percySnapshot("Login");
            await checkA11y();

            await page.getByRole("textbox", { name: "Username" }).fill(credentials.username);
            await page.getByPlaceholder("Password").fill(credentials.password);
            await page.getByRole("button", { name: "Sign in" }).click();

            await expect(page).toHaveURL(/\/#\/home$/);
        });

        test("Follows the original link after login", async ({ page, homeserver, credentials }) => {
            await page.goto("/#/room/!room:id"); // should redirect to the welcome page
            await login(page, homeserver, credentials);

            await expect(page).toHaveURL(/\/#\/room\/!room:id$/);
            await expect(page.getByRole("button", { name: "Join the discussion" })).toBeVisible();
        });

        test.describe("verification after login", () => {
            test("Shows verification prompt after login if signing keys are set up, skippable by default", async ({
                page,
                homeserver,
                request,
                credentials,
            }) => {
                const res = await request.post(`${homeserver.baseUrl}/_matrix/client/v3/keys/device_signing/upload`, {
                    headers: { Authorization: `Bearer ${credentials.accessToken}` },
                    data: DEVICE_SIGNING_KEYS_BODY,
                });
                if (res.status() / 100 !== 2) {
                    console.log("Uploading dummy keys failed", await res.json());
                }
                expect(res.status() / 100).toEqual(2);

                await page.goto("/");
                await login(page, homeserver, credentials);

                await expect(page.getByRole("heading", { name: "Verify this device", level: 1 })).toBeVisible();

                await expect(page.getByRole("button", { name: "Skip verification for now" })).toBeVisible();
            });

            test.describe("with force_verification off", () => {
                test.use({
                    config: {
                        force_verification: false,
                    },
                });

                test("Shows skippable verification prompt after login if signing keys are set up", async ({
                    page,
                    homeserver,
                    request,
                    credentials,
                }) => {
                    const res = await request.post(
                        `${homeserver.baseUrl}/_matrix/client/v3/keys/device_signing/upload`,
                        {
                            headers: { Authorization: `Bearer ${credentials.accessToken}` },
                            data: DEVICE_SIGNING_KEYS_BODY,
                        },
                    );
                    if (res.status() / 100 !== 2) {
                        console.log("Uploading dummy keys failed", await res.json());
                    }
                    expect(res.status() / 100).toEqual(2);

                    await page.goto("/");
                    await login(page, homeserver, credentials);

                    await expect(page.getByRole("heading", { name: "Verify this device", level: 1 })).toBeVisible();

                    await expect(page.getByRole("button", { name: "Skip verification for now" })).toBeVisible();
                });
            });

            test.describe("with force_verification on", () => {
                test.use({
                    config: {
                        force_verification: true,
                    },
                });

                test("Shows unskippable verification prompt after login if signing keys are set up", async ({
                    page,
                    homeserver,
                    request,
                    credentials,
                }) => {
                    console.log(`uid ${credentials.userId} body`, DEVICE_SIGNING_KEYS_BODY);
                    const res = await request.post(
                        `${homeserver.baseUrl}/_matrix/client/v3/keys/device_signing/upload`,
                        {
                            headers: { Authorization: `Bearer ${credentials.accessToken}` },
                            data: DEVICE_SIGNING_KEYS_BODY,
                        },
                    );
                    if (res.status() / 100 !== 2) {
                        console.log("Uploading dummy keys failed", await res.json());
                    }
                    expect(res.status() / 100).toEqual(2);

                    await page.goto("/");
                    await login(page, homeserver, credentials);

                    const h1 = page.getByRole("heading", { name: "Verify this device", level: 1 });
                    await expect(h1).toBeVisible();

                    await expect(h1.locator(".mx_CompleteSecurity_skip")).toHaveCount(0);
                });
            });
        });
    });

    test.describe("logout", () => {
        test("should go to login page on logout", async ({ page, user }) => {
            await page.getByRole("button", { name: "User menu" }).click();
            await expect(page.getByText(user.displayName, { exact: true })).toBeVisible();

            // Allow the outstanding requests queue to settle before logging out
            await page.waitForTimeout(2000);

            await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
            await expect(page).toHaveURL(/\/#\/login$/);
        });
    });
});
