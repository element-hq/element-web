/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";
import { assertNoToasts, getToast, rejectToast } from "@element-hq/element-web-playwright-common/src/utils/toasts";

import { test, expect } from "../../element-web-test";
import { createBot, deleteCachedSecrets, disableKeyBackup, logIntoElement, logIntoElementAndVerify } from "./utils";
import { type Bot } from "../../pages/bot";

// Mask the background of the screenshot to avoid failing the test just because some
// other component has changed its rendering.
const screenshotOptions = {
    css: `
        .mx_ToastContainer {
            background-color: magenta !important;
        }
    `,
};

test.describe("Key storage out of sync toast", () => {
    let recoveryKey: GeneratedSecretStorageKey;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        const res = await createBot(page, homeserver, credentials);
        recoveryKey = res.recoveryKey;

        await logIntoElementAndVerify(page, credentials, recoveryKey.encodedPrivateKey);

        await deleteCachedSecrets(page);

        // We won't be prompted for crypto setup unless we have an e2e room, so make one
        await page
            .getByRole("navigation", { name: "Room list" })
            .getByRole("button", { name: "New conversation" })
            .click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await page.getByRole("textbox", { name: "Name" }).fill("Test room");
        await page.getByRole("button", { name: "Create room" }).click();
    });

    test("should prompt for recovery key if 'enter recovery key' pressed", { tag: "@screenshot" }, async ({ page }) => {
        await expect(page.getByRole("alert").filter({ hasText: "Your key storage is out of sync." })).toMatchScreenshot(
            "key-storage-out-of-sync-toast.png",
            screenshotOptions,
        );

        await page.getByRole("button", { name: "Enter recovery key" }).click();

        await page.getByRole("textbox", { name: "Recovery Key" }).fill(recoveryKey.encodedPrivateKey);
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(page.getByRole("button", { name: "Enter recovery key" })).not.toBeVisible();
    });

    test("should open settings to reset flow if 'forgot recovery key' pressed", async ({ page, app, credentials }) => {
        await expect(page.getByRole("button", { name: "Enter recovery key" })).toBeVisible();

        await page.getByRole("button", { name: "Forgot recovery key?" }).click();

        await expect(
            page.getByRole("heading", {
                name: "Forgot your recovery key? You’ll need to reset your digital identity.",
            }),
        ).toBeVisible();
    });
});

test.describe("'Turn on key storage' toast", () => {
    let botClient: Bot | undefined;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        // Set up all crypto stuff. Key storage defaults to on.

        const res = await createBot(page, homeserver, credentials);
        const recoveryKey = res.recoveryKey;
        botClient = res.botClient;

        await logIntoElementAndVerify(page, credentials, recoveryKey.encodedPrivateKey);

        // We won't be prompted for crypto setup unless we have an e2e room, so make one
        await page
            .getByRole("navigation", { name: "Room list" })
            .getByRole("button", { name: "New conversation" })
            .click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await page.getByRole("textbox", { name: "Name" }).fill("Test room");
        await page.getByRole("button", { name: "Create room" }).click();

        await rejectToast(page, "Notifications");
    });

    test("should not show toast if key storage is on", async ({ page }) => {
        // Given the default situation after signing in
        // Then no toast is shown (because key storage is on)
        await assertNoToasts(page);

        // When we reload
        await page.reload();

        // Give the toasts time to appear
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Then still no toast is shown
        await assertNoToasts(page);
    });

    test("should not show toast if key storage is off because we turned it off", async ({ app, page }) => {
        // Given the backup is disabled because we disabled it
        await disableKeyBackup(app);

        // Then no toast is shown
        await assertNoToasts(page);

        // When we reload
        await page.reload();

        // Give the toasts time to appear
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Then still no toast is shown
        await assertNoToasts(page);
    });

    test("should show toast if key storage is off but account data is missing", async ({ app, page }) => {
        // Given the backup is disabled but we didn't set account data saying that is expected
        await disableKeyBackup(app);
        await botClient.setAccountData("m.org.matrix.custom.backup_disabled", { disabled: false });

        // Wait for the account data setting to stick
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // When we enter the app
        await page.reload();

        // Then the toast is displayed
        let toast = await getToast(page, "Turn on key storage");

        // And when we click "Continue"
        await toast.getByRole("button", { name: "Continue" }).click();

        // Then we see the Encryption settings dialog with an option to turn on key storage
        await expect(page.getByRole("switch", { name: "Allow key storage" })).toBeVisible();

        // And when we close that
        await page.getByRole("button", { name: "Close dialog" }).click();

        // Then we see the toast again
        toast = await getToast(page, "Turn on key storage");

        // And when we click "Dismiss"
        await toast.getByRole("button", { name: "Dismiss" }).click();

        // Then we see the "are you sure?" dialog
        await expect(
            page.getByRole("heading", { name: "Are you sure you want to keep key storage turned off?" }),
        ).toBeVisible();

        // And when we close it by clicking away
        await page.getByTestId("dialog-background").click({ force: true, position: { x: 10, y: 10 } });

        // Then we see the toast again
        toast = await getToast(page, "Turn on key storage");

        // And when we click Dismiss and then "Go to Settings"
        await toast.getByRole("button", { name: "Dismiss" }).click();
        await page.getByRole("button", { name: "Go to Settings" }).click();

        // Then we see Encryption settings again
        await expect(page.getByRole("switch", { name: "Allow key storage" })).toBeVisible();

        // And when we close that, see the toast, click Dismiss, and Yes, Dismiss
        await page.getByRole("button", { name: "Close dialog" }).click();
        toast = await getToast(page, "Turn on key storage");
        await toast.getByRole("button", { name: "Dismiss" }).click();
        await page.getByRole("button", { name: "Yes, dismiss" }).click();

        // Then the toast is gone
        await assertNoToasts(page);
    });
});

test.describe("Verify this device toast", () => {
    test(
        "The toast is displayed if we are not verified",
        { tag: "@screenshot" },
        async ({ page, credentials, homeserver }) => {
            // Ensure the user already has a device, and an encrypted toom, so
            // we need to verify when we log in
            const { botClient } = await createBot(page, homeserver, credentials, true);
            await botClient.createRoom({
                initial_state: [
                    {
                        type: "m.room.encryption",
                        state_key: "",
                        content: { algorithm: "m.megolm.v1.aes-sha2" },
                    },
                ],
            });

            // Log in without verifying
            await logIntoElement(page, credentials);
            const authPage = page.locator(".mx_AuthPage");
            await authPage.getByRole("button", { name: "Skip verification for now" }).click();
            await authPage.getByRole("button", { name: "I'll verify later" }).click();
            await page.waitForSelector(".mx_MatrixChat");

            await expect(page.getByRole("heading", { name: "Verify this device" })).toBeVisible();

            await expect(page.locator(".mx_ToastContainer")).toMatchScreenshot(
                "verify-this-device.png",
                screenshotOptions,
            );
        },
    );
});
