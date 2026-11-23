/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";

import { test, expect } from ".";
import { createBot } from "../../crypto/utils";

test.use({
    synapseConfig: {
        experimental_features: {
            msc3814_enabled: true,
        },
    },
});

test.describe("Encryption tab with dehydration enabled", () => {
    test.use({ displayName: "Alice" });

    test.describe("when encryption is set up", () => {
        let recoveryKey: GeneratedSecretStorageKey;

        test.beforeEach(async ({ page, homeserver, credentials }) => {
            // The bot bootstraps cross-signing, creates a key backup and sets up a recovery key
            const botCredentials = { ...credentials };
            // @ts-expect-error
            delete botCredentials.accessToken; // use a new login for the bot
            const res = await createBot(page, homeserver, botCredentials);
            recoveryKey = res.recoveryKey;
        });

        test("should show 'Offline device' section, and 'Active'", { tag: "@screenshot" }, async ({ util }) => {
            const dialog = await util.openEncryptionTab();
            const content = util.getEncryptionTabContent();

            // (Given our device is verified)
            await dialog.getByRole("button", { name: "Verify this device" }).click();
            await util.verifyDevice(recoveryKey);

            // Then we can see the Offline device section and it says 'Active'
            await content
                .getByRole("heading", { name: "Offline device\nActive", exact: true })
                .scrollIntoViewIfNeeded();

            await expect(content).toMatchScreenshot("offline-device-active.png", {
                mask: [content.getByTestId("deviceId"), content.getByTestId("sessionKey")],
            });
        });

        test(
            "should show 'Offline device' section with no 'Active' if dehydrated device doesn't exist",
            { tag: "@screenshot" },
            async ({ app, util }) => {
                const dialog = await util.openEncryptionTab();

                // (And our device is verified)
                await dialog.getByRole("button", { name: "Verify this device" }).click();
                await util.verifyDevice(recoveryKey);

                // Sanity: we have a dehydrated device
                const content = util.getEncryptionTabContent();
                await content
                    .getByRole("heading", { name: "Offline device\nActive", exact: true })
                    .scrollIntoViewIfNeeded();

                // Delete the dehydrated device
                await app.client.evaluate(async (cli) => {
                    const crypto = cli.getCrypto()!;

                    // @ts-ignore using a private property of crypto
                    crypto.dehydratedDeviceManager.delete();
                });

                // Refresh by closing and re-opening Settings
                await dialog.getByRole("button", { name: "Close" }).click();
                await util.openEncryptionTab();
                const content2 = util.getEncryptionTabContent();

                // Then we can see the Offline device section but it does not say "Active"
                await content2.getByRole("heading", { name: "Offline device", exact: true }).scrollIntoViewIfNeeded();

                await expect(content2).toMatchScreenshot("offline-device-inactive.png", {
                    mask: [content.getByTestId("deviceId"), content.getByTestId("sessionKey")],
                });
            },
        );
    });
});
