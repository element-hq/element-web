/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";

import { test, expect } from "../../element-web-test";
import { createBot, deleteCachedSecrets, logIntoElement } from "./utils";

test.describe("Key storage out of sync toast", () => {
    let recoveryKey: GeneratedSecretStorageKey;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        const res = await createBot(page, homeserver, credentials);
        recoveryKey = res.recoveryKey;

        await logIntoElement(page, credentials, recoveryKey.encodedPrivateKey);

        await deleteCachedSecrets(page);

        // We won't be prompted for crypto setup unless we have an e2e room, so make one
        await page.getByRole("button", { name: "Add room" }).click();
        await page.getByRole("menuitem", { name: "New room" }).click();
        await page.getByRole("textbox", { name: "Name" }).fill("Test room");
        await page.getByRole("button", { name: "Create room" }).click();
    });

    test("should prompt for recovery key if 'enter recovery key' pressed", { tag: "@screenshot" }, async ({ page }) => {
        // We need to wait for there to be two toasts as the wait below won't work in isolation:
        // playwright only evaluates the 'first()' call initially, not subsequent times it checks, so
        // it would always be checking the same toast, even if another one is now the first.
        await expect(page.getByRole("alert")).toHaveCount(2);
        await expect(page.getByRole("alert").first()).toMatchScreenshot("key-storage-out-of-sync-toast.png");

        await page.getByRole("button", { name: "Enter recovery key" }).click();

        await page.getByRole("textbox", { name: "Recovery Key" }).fill(recoveryKey.encodedPrivateKey);
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(page.getByRole("button", { name: "Enter recovery key" })).not.toBeVisible();
    });

    test("should open settings to reset flow if 'forgot recovery key' pressed", async ({ page, app, credentials }) => {
        await expect(page.getByRole("button", { name: "Enter recovery key" })).toBeVisible();

        await page.getByRole("button", { name: "Forgot recovery key?" }).click();

        await expect(
            page.getByRole("heading", { name: "Forgot your recovery key? You’ll need to reset your identity." }),
        ).toBeVisible();
    });
});
