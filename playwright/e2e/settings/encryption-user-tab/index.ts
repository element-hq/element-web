/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Page } from "@playwright/test";
import { GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";

import { ElementAppPage } from "../../../pages/ElementAppPage";
import { test as base, expect } from "../../../element-web-test";
export { expect };

/**
 * Set up for the encryption tab test
 */
export const test = base.extend<{
    util: Helpers;
}>({
    util: async ({ page, app, bot }, use) => {
        await use(new Helpers(page, app));
    },
});

class Helpers {
    constructor(
        private page: Page,
        private app: ElementAppPage,
    ) {}

    /**
     * Open the encryption tab
     */
    openEncryptionTab() {
        return this.app.settings.openUserSettings("Encryption");
    }

    /**
     * Go through the device verification flow using the recovery key.
     */
    async verifyDevice(recoveryKey: GeneratedSecretStorageKey) {
        // Select the security phrase
        await this.page.getByRole("button", { name: "Verify with Security Key or Phrase" }).click();
        await this.enterRecoveryKey(recoveryKey);
        await this.page.getByRole("button", { name: "Done" }).click();
    }

    /**
     * Fill the recovery key in the dialog
     * @param recoveryKey
     */
    async enterRecoveryKey(recoveryKey: GeneratedSecretStorageKey) {
        // Select to use recovery key
        await this.page.getByRole("button", { name: "use your Security Key" }).click();

        // Fill the recovery key
        const dialog = this.page.locator(".mx_Dialog");
        await dialog.getByRole("textbox").fill(recoveryKey.encodedPrivateKey);
        await dialog.getByRole("button", { name: "Continue" }).click();
    }

    /**
     * Get the encryption tab content
     */
    getEncryptionTabContent() {
        return this.page.getByTestId("encryptionTab");
    }

    /**
     * Set the default key id of the secret storage to `null`
     */
    async removeSecretStorageDefaultKeyId() {
        const client = await this.app.client.prepareClient();
        await client.evaluate(async (client) => {
            await client.secretStorage.setDefaultKeyId(null);
        });
    }

    /**
     * Get the security key from the clipboard and fill in the input field
     * Then click on the finish button
     * @param title - The title of the dialog
     * @param confirmButtonLabel - The label of the confirm button
     * @param screenshot
     */
    async confirmRecoveryKey(title: string, confirmButtonLabel: string, screenshot: `${string}.png`) {
        const dialog = this.getEncryptionTabContent();
        await expect(dialog.getByText(title, { exact: true })).toBeVisible();
        await expect(dialog).toMatchScreenshot(screenshot);

        const clipboardContent = await this.app.getClipboard();
        await dialog.getByRole("textbox").fill(clipboardContent);
        await dialog.getByRole("button", { name: confirmButtonLabel }).click();
        await expect(dialog).toMatchScreenshot("default-recovery.png");
    }
}
