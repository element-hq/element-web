/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "./index";
import {
    checkDeviceIsConnectedKeyBackup,
    checkDeviceIsCrossSigned,
    createBot,
    verifySession,
} from "../../crypto/utils";

test.describe("Advanced section in Encryption tab", () => {
    let expectedBackupVersion: string;

    test.beforeEach(async ({ page, app, homeserver, credentials }) => {
        const res = await createBot(page, homeserver, credentials);
        expectedBackupVersion = res.expectedBackupVersion;
    });

    test("should show the encryption details", { tag: "@screenshot" }, async ({ page, app, util }) => {
        await verifySession(app, "new passphrase");
        await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        const deviceId = await page.evaluate(() => window.mxMatrixClientPeg.get().getDeviceId());
        await expect(section.getByText(deviceId)).toBeVisible();

        await expect(section).toMatchScreenshot("encryption-details.png", {
            mask: [section.getByTestId("deviceId"), section.getByTestId("sessionKey")],
        });
    });

    test("should show the import room keys dialog", async ({ page, app, util }) => {
        await verifySession(app, "new passphrase");
        await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        await section.getByRole("button", { name: "Import keys" }).click();
        await expect(page.getByRole("heading", { name: "Import room keys" })).toBeVisible();
    });

    test("should show the export room keys dialog", async ({ page, app, util }) => {
        await verifySession(app, "new passphrase");
        await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        await section.getByRole("button", { name: "Export keys" }).click();
        await expect(page.getByRole("heading", { name: "Export room keys" })).toBeVisible();
    });

    test("should reset the cryptographic identity", { tag: "@screenshot" }, async ({ page, app, util }) => {
        test.slow();

        await verifySession(app, "new passphrase");
        const tab = await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        await section.getByRole("button", { name: "Reset cryptographic identity" }).click();
        await expect(util.getEncryptionTabContent()).toMatchScreenshot("reset-cryptographic-identity.png");
        await tab.getByRole("button", { name: "Continue" }).click();

        await expect(section.getByRole("button", { name: "Reset cryptographic identity" })).toBeVisible();
        // After resetting the identity, the user should set up a new recovery key
        await expect(
            util.getEncryptionRecoverySection().getByRole("button", { name: "Set up recovery" }),
        ).toBeVisible();

        await checkDeviceIsCrossSigned(app);

        await app.closeDialog();
        // The key backup was enabled before resetting the identity
        // We create a new one after the reset
        await checkDeviceIsConnectedKeyBackup(page, `${parseInt(expectedBackupVersion) + 1}`, true);
    });
});
