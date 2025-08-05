/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Config, CONFIG_JSON } from "@element-hq/element-web-playwright-common";
import { type Browser, type Page } from "@playwright/test";
import { type StartedHomeserverContainer } from "@element-hq/element-web-playwright-common/lib/testcontainers/HomeserverContainer";

import { test, expect } from "../../element-web-test.ts";
import { logInAccountMas, registerAccountMas } from ".";
import { ElementAppPage } from "../../pages/ElementAppPage.ts";
import { masHomeserver } from "../../plugins/homeserver/synapse/masHomeserver.ts";

test.use(masHomeserver);
test.describe("OIDC Native", { tag: ["@no-firefox", "@no-webkit"] }, () => {
    test.slow(); // trace recording takes a while here

    test("can register the oauth2 client and an account", async ({
        context,
        page,
        homeserver,
        mailpitClient,
        mas,
    }, testInfo) => {
        await page.clock.install();

        const tokenUri = `${mas.baseUrl}/oauth2/token`;
        const tokenApiPromise = page.waitForRequest(
            (request) => request.url() === tokenUri && request.postDataJSON()["grant_type"] === "authorization_code",
        );

        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();

        const userId = `alice_${testInfo.testId}`;
        await registerAccountMas(page, mailpitClient, userId, `${userId}@email.com`, "Pa$sW0rD!");

        // Eventually, we should end up at the home screen.
        await expect(page).toHaveURL(/\/#\/home$/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: `Welcome ${userId}`, exact: true })).toBeVisible();
        await page.clock.runFor(20000); // run the timer so we see the token request

        const tokenApiRequest = await tokenApiPromise;
        expect(tokenApiRequest.postDataJSON()["grant_type"]).toBe("authorization_code");

        const deviceId = await page.evaluate<string>(() => window.localStorage.mx_device_id);

        const app = new ElementAppPage(page);
        await app.settings.openUserSettings("Account");
        const newPagePromise = context.waitForEvent("page");
        await page.getByRole("button", { name: "Manage account" }).click();
        await app.settings.closeDialog();

        // Assert MAS sees the session as OIDC Native
        const newPage = await newPagePromise;
        await newPage.getByText("Devices").click();
        await newPage.getByText(deviceId).click();
        await expect(newPage.getByText("Element", { exact: true })).toBeVisible();
        await expect(newPage.getByText("http://localhost:8080/")).toBeVisible();
        await expect(newPage).toHaveURL(/\/oauth2_session/);
        await newPage.close();

        // Assert logging out revokes both tokens
        const revokeUri = `${mas.baseUrl}/oauth2/revoke`;
        const revokeAccessTokenPromise = page.waitForRequest(
            (request) => request.url() === revokeUri && request.postDataJSON()["token_type_hint"] === "access_token",
        );
        const revokeRefreshTokenPromise = page.waitForRequest(
            (request) => request.url() === revokeUri && request.postDataJSON()["token_type_hint"] === "refresh_token",
        );
        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();
        await revokeAccessTokenPromise;
        await revokeRefreshTokenPromise;
    });

    test(
        "it should log out the user & wipe data when logging out via MAS",
        { tag: "@screenshot" },
        async ({ mas, page, mailpitClient, homeserver }, testInfo) => {
            // We use this over the `user` fixture to ensure we get an OIDC session rather than a compatibility one
            await page.goto("/#/login");
            await page.getByRole("button", { name: "Continue" }).click();

            const userId = `alice_${testInfo.testId}`;
            await registerAccountMas(page, mailpitClient, userId, `${userId}@email.com`, "Pa$sW0rD!");

            await expect(page.getByText("Welcome")).toBeVisible();
            await page.goto("about:blank");

            const result = await mas.manage("kill-sessions", userId);
            expect(result.output).toContain("Ended 1 active OAuth 2.0 session");

            await page.goto("http://localhost:8080");
            await expect(
                page.getByText("For security, this session has been signed out. Please sign in again."),
            ).toBeVisible();
            //await expect(page).toMatchScreenshot("token-expired.png", { includeDialogBackground: true });

            const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
            expect(localStorageKeys).toHaveLength(0);
        },
    );

    test("can log in to an existing MAS account", { tag: "@screenshot" }, async ({ page, mailpitClient }, testInfo) => {
        // Register an account with MAS
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();

        const userId = `alice_${testInfo.testId}`;
        await registerAccountMas(page, mailpitClient, userId, `${userId}@email.com`, "Pa$sW0rD!");
        await expect(page.getByText("Welcome")).toBeVisible();

        // Log out
        await page.getByRole("button", { name: "User menu" }).click();
        await expect(page.getByText(userId, { exact: true })).toBeVisible();

        // Allow the outstanding requests queue to settle before logging out
        await page.waitForTimeout(2000);
        await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
        await expect(page).toHaveURL(/\/#\/login$/);

        // Log in again
        await page.goto("/#/login");
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("button", { name: "Continue" }).click();

        // We should be in (we see an error because we have no recovery key).
        await expect(page.getByText("Unable to verify this device")).toBeVisible();
    });

    test.describe("with force_verification on", () => {
        test.use({
            config: {
                force_verification: true,
            },
        });

        test("verify dialog cannot be dismissed", { tag: "@screenshot" }, async ({ page, mailpitClient }, testInfo) => {
            // Register an account with MAS
            await page.goto("/#/login");
            await page.getByRole("button", { name: "Continue" }).click();

            const userId = `alice_${testInfo.testId}`;
            await registerAccountMas(page, mailpitClient, userId, `${userId}@email.com`, "Pa$sW0rD!");
            await expect(page.getByText("Welcome")).toBeVisible();

            // Log out
            await page.getByRole("button", { name: "User menu" }).click();
            await expect(page.getByText(userId, { exact: true })).toBeVisible();
            await page.waitForTimeout(2000);
            await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
            await expect(page).toHaveURL(/\/#\/login$/);

            // Log in again
            await page.goto("/#/login");
            await page.getByRole("button", { name: "Continue" }).click();
            await page.getByRole("button", { name: "Continue" }).click();

            // We should be being warned that we need to verify (but we can't)
            await expect(page.getByText("Unable to verify this device")).toBeVisible();

            // And there should be no way to close this prompt
            await expect(page.getByRole("button", { name: "Skip verification for now" })).not.toBeVisible();
        });

        test(
            "continues to show verification prompt after cancelling device verification",
            { tag: "@screenshot" },
            async ({ browser, config, homeserver, page, mailpitClient }, testInfo) => {
                // Register an account with MAS
                await page.goto("/#/login");
                await page.getByRole("button", { name: "Continue" }).click();

                const userId = `alice_${testInfo.testId}`;
                const password = "Pa$sW0rD!";
                await registerAccountMas(page, mailpitClient, userId, `${userId}@email.com`, password);
                await expect(page.getByText("Welcome")).toBeVisible();

                // Log in an additional account, and verify it.
                //
                // This means that when we log out and in again, we are offered
                // to verify using another device.
                const otherContext = await newContext(browser, config, homeserver);
                const otherDevicePage = await otherContext.newPage();
                await otherDevicePage.goto("/#/login");
                await otherDevicePage.getByRole("button", { name: "Continue" }).click();
                await logInAccountMas(otherDevicePage, userId, password);
                await verifyUsingOtherDevice(otherDevicePage, page);
                await otherDevicePage.close();

                // Log out
                await page.getByRole("button", { name: "User menu" }).click();
                await expect(page.getByText(userId, { exact: true })).toBeVisible();
                await page.waitForTimeout(2000);
                await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
                await expect(page).toHaveURL(/\/#\/login$/);

                // Log in again
                await page.goto("/#/login");
                await page.getByRole("button", { name: "Continue" }).click();
                await page.getByRole("button", { name: "Continue" }).click();

                // We should be in, and not able to dismiss the verify dialog
                await expect(page.getByText("Verify this device")).toBeVisible();
                await expect(page.getByRole("button", { name: "Skip verification for now" })).not.toBeVisible();

                // When we start verifying with another device
                await page.getByRole("button", { name: "Verify with another device" }).click();

                // And then cancel it
                await page.getByRole("button", { name: "Close dialog" }).click();

                // Then we should still be at the unskippable verify prompt
                await expect(page.getByText("Verify this device")).toBeVisible();
                await expect(page.getByRole("button", { name: "Skip verification for now" })).not.toBeVisible();
            },
        );
    });
});

/**
 * Perform interactive emoji verification for a new device.
 */
async function verifyUsingOtherDevice(deviceToVerifyPage: Page, alreadyVerifiedDevicePage: Page) {
    await deviceToVerifyPage.getByRole("button", { name: "Verify with another device" }).click();
    await alreadyVerifiedDevicePage.getByRole("button", { name: "Verify session" }).click();
    await alreadyVerifiedDevicePage.getByRole("button", { name: "Start" }).click();
    await alreadyVerifiedDevicePage.getByRole("button", { name: "They match" }).click();
    await deviceToVerifyPage.getByRole("button", { name: "They match" }).click();
    await alreadyVerifiedDevicePage.getByRole("button", { name: "Got it" }).click();
    await deviceToVerifyPage.getByRole("button", { name: "Got it" }).click();
}

/**
 * Create a new browser context which serves up the default config plus what you supplied, and sets m.homeserver to the
 * supplied homeserver's URL.
 */
async function newContext(browser: Browser, config: Partial<Partial<Config>>, homeserver: StartedHomeserverContainer) {
    const otherContext = await browser.newContext();
    await otherContext.route(`http://localhost:8080/config.json*`, async (route) => {
        const json = {
            ...CONFIG_JSON,
            ...config,
            default_server_config: {
                "m.homeserver": {
                    base_url: homeserver.baseUrl,
                },
            },
        };
        await route.fulfill({ json });
    });
    return otherContext;
}
