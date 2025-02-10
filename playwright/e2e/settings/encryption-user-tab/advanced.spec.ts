/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "./index";
import { checkDeviceIsCrossSigned } from "../../crypto/utils";
import { bootstrapCrossSigningForClient } from "../../../pages/client";

test.describe("Advanced section in Encryption tab", () => {
    test.beforeEach(async ({ page, app, homeserver, credentials, util }) => {
        const clientHandle = await app.client.prepareClient();
        // Reset cross signing in order to have a verified session
        await bootstrapCrossSigningForClient(clientHandle, credentials, true);
    });

    test("should show the encryption details", { tag: "@screenshot" }, async ({ page, app, util }) => {
        await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        const deviceId = await page.evaluate(() => window.mxMatrixClientPeg.get().getDeviceId());
        await expect(section.getByText(deviceId)).toBeVisible();

        await expect(section).toMatchScreenshot("encryption-details.png", {
            mask: [section.getByTestId("deviceId"), section.getByTestId("sessionKey")],
        });
    });

    test("should show the import room keys dialog", async ({ page, app, util }) => {
        await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        await section.getByRole("button", { name: "Import keys" }).click();
        await expect(page.getByRole("heading", { name: "Import room keys" })).toBeVisible();
    });

    test("should show the export room keys dialog", async ({ page, app, util }) => {
        await util.openEncryptionTab();
        const section = util.getEncryptionDetailsSection();

        await section.getByRole("button", { name: "Export keys" }).click();
        await expect(page.getByRole("heading", { name: "Export room keys" })).toBeVisible();
    });

    test(
        "should reset the cryptographic identity",
        { tag: "@screenshot" },
        async ({ page, app, credentials, util }) => {
            const tab = await util.openEncryptionTab();
            const section = util.getEncryptionDetailsSection();

            await section.getByRole("button", { name: "Reset cryptographic identity" }).click();
            await expect(util.getEncryptionTabContent()).toMatchScreenshot("reset-cryptographic-identity.png");
            await tab.getByRole("button", { name: "Continue" }).click();

            // Fill password dialog and validate
            const dialog = page.locator(".mx_InteractiveAuthDialog");
            await dialog.getByRole("textbox", { name: "Password" }).fill(credentials.password);
            await dialog.getByRole("button", { name: "Continue" }).click();

            await expect(section.getByRole("button", { name: "Reset cryptographic identity" })).toBeVisible();

            // After resetting the identity, the user should set up a new recovery key
            await expect(
                util.getEncryptionRecoverySection().getByRole("button", { name: "Set up recovery" }),
            ).toBeVisible();

            await checkDeviceIsCrossSigned(app);
        },
    );
});
