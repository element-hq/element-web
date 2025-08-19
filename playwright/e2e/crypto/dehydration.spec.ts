/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { createBot, logIntoElement } from "./utils.ts";
import { type Client } from "../../pages/client.ts";
import { type ElementAppPage } from "../../pages/ElementAppPage.ts";

const NAME = "Alice";

test.use({
    displayName: NAME,
    synapseConfig: {
        experimental_features: {
            msc2697_enabled: false,
            msc3814_enabled: true,
        },
    },
});

test.describe("Dehydration", () => {
    test.skip(isDendrite, "does not yet support dehydration v2");

    test("Verify device and reset creates dehydrated device", async ({ page, user, credentials, app }, workerInfo) => {
        // Verify the device by resetting the identity key, and then set up recovery (which will create SSSS, and dehydrated device)

        const securityTab = await app.settings.openUserSettings("Security & Privacy");
        await expect(securityTab.getByText("Offline device enabled")).not.toBeVisible();

        await app.closeDialog();

        // Reset the identity key
        const settings = await app.settings.openUserSettings("Encryption");
        await settings.getByRole("button", { name: "Verify this device" }).click();
        await page.getByRole("button", { name: "Can't confirm?" }).click();
        await page.getByRole("button", { name: "Continue" }).click();

        // Set up recovery
        await page.getByRole("button", { name: "Set up recovery" }).click();
        await page.getByRole("button", { name: "Continue" }).click();
        const recoveryKey = await page.getByTestId("recoveryKey").innerText();
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByRole("textbox").fill(recoveryKey);
        await page.getByRole("button", { name: "Finish set up" }).click();
        await page.getByRole("button", { name: "Close" }).click();

        await expectDehydratedDeviceEnabled(app);

        // the dehydrated device gets created with the name "Dehydrated
        // device".  We want to make sure that it is not visible as a normal
        // device.
        const sessionsTab = await app.settings.openUserSettings("Sessions");
        await expect(sessionsTab.getByText("Dehydrated device")).not.toBeVisible();
    });

    test("'Set up recovery' creates dehydrated device", async ({ app, credentials, page }) => {
        await logIntoElement(page, credentials);

        const settingsDialogLocator = await app.settings.openUserSettings("Encryption");
        await settingsDialogLocator.getByRole("button", { name: "Set up recovery" }).click();

        // First it displays an informative panel about the recovery key
        await expect(settingsDialogLocator.getByRole("heading", { name: "Set up recovery" })).toBeVisible();
        await settingsDialogLocator.getByRole("button", { name: "Continue" }).click();

        // Next, it displays the new recovery key. We click on the copy button.
        await expect(settingsDialogLocator.getByText("Save your recovery key somewhere safe")).toBeVisible();
        await settingsDialogLocator.getByRole("button", { name: "Copy" }).click();
        const recoveryKey = await app.getClipboard();
        await settingsDialogLocator.getByRole("button", { name: "Continue" }).click();

        await expect(
            settingsDialogLocator.getByText("Enter your recovery key to confirm", { exact: true }),
        ).toBeVisible();
        await settingsDialogLocator.getByRole("textbox").fill(recoveryKey);
        await settingsDialogLocator.getByRole("button", { name: "Finish set up" }).click();

        await app.settings.closeDialog();

        await expectDehydratedDeviceEnabled(app);
    });

    test("Reset identity during login and set up recovery re-creates dehydrated device", async ({
        page,
        homeserver,
        app,
        credentials,
    }) => {
        // Set up cross-signing and recovery
        const { botClient } = await createBot(page, homeserver, credentials);
        // ... and dehydration
        await botClient.evaluate(async (client) => await client.getCrypto().startDehydration());

        const initialDehydratedDeviceIds = await getDehydratedDeviceIds(botClient);
        expect(initialDehydratedDeviceIds.length).toBe(1);

        await botClient.evaluate(async (client) => client.stopClient());

        // Log in our client
        await logIntoElement(page, credentials);

        // Oh no, we forgot our recovery key - reset our identity
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Can't confirm" }).click();
        await expect(
            page.getByRole("heading", { name: "Are you sure you want to reset your identity?" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByPlaceholder("Password").fill(credentials.password);
        await page.getByRole("button", { name: "Continue" }).click();

        // And set up recovery
        const settings = await app.settings.openUserSettings("Encryption");
        await settings.getByRole("button", { name: "Set up recovery" }).click();
        await settings.getByRole("button", { name: "Continue" }).click();
        const recoveryKey = await settings.getByTestId("recoveryKey").innerText();
        await settings.getByRole("button", { name: "Continue" }).click();
        await settings.getByRole("textbox").fill(recoveryKey);
        await settings.getByRole("button", { name: "Finish set up" }).click();

        // There should be a brand new dehydrated device
        await expectDehydratedDeviceEnabled(app);
    });

    test("'Reset cryptographic identity' removes dehydrated device", async ({ page, homeserver, app, credentials }) => {
        await logIntoElement(page, credentials);

        // Create a dehydrated device by setting up recovery (see "'Set up
        // recovery' creates dehydrated device" test above)
        const settingsDialogLocator = await app.settings.openUserSettings("Encryption");
        await settingsDialogLocator.getByRole("button", { name: "Set up recovery" }).click();

        // First it displays an informative panel about the recovery key
        await expect(settingsDialogLocator.getByRole("heading", { name: "Set up recovery" })).toBeVisible();
        await settingsDialogLocator.getByRole("button", { name: "Continue" }).click();

        // Next, it displays the new recovery key. We click on the copy button.
        await expect(settingsDialogLocator.getByText("Save your recovery key somewhere safe")).toBeVisible();
        await settingsDialogLocator.getByRole("button", { name: "Copy" }).click();
        const recoveryKey = await app.getClipboard();
        await settingsDialogLocator.getByRole("button", { name: "Continue" }).click();

        await expect(
            settingsDialogLocator.getByText("Enter your recovery key to confirm", { exact: true }),
        ).toBeVisible();
        await settingsDialogLocator.getByRole("textbox").fill(recoveryKey);
        await settingsDialogLocator.getByRole("button", { name: "Finish set up" }).click();

        await expectDehydratedDeviceEnabled(app);

        // After recovery is set up, we reset our cryptographic identity, which
        // should drop the dehydrated device.
        await settingsDialogLocator.getByRole("button", { name: "Reset cryptographic identity" }).click();
        await settingsDialogLocator.getByRole("button", { name: "Continue" }).click();

        await expectDehydratedDeviceDisabled(app);
    });
});

async function getDehydratedDeviceIds(client: Client): Promise<string[]> {
    return await client.evaluate(async (client) => {
        const userId = client.getUserId();
        const devices = await client.getCrypto().getUserDeviceInfo([userId]);
        return Array.from(
            devices
                .get(userId)
                .values()
                .filter((d) => d.dehydrated)
                .map((d) => d.deviceId),
        );
    });
}

/** Wait for our user to have a dehydrated device */
async function expectDehydratedDeviceEnabled(app: ElementAppPage): Promise<void> {
    // It might be nice to do this via the UI, but currently this info is not exposed via the UI.
    //
    // Note we might have to wait for the device list to be refreshed, so we wrap in `expect.poll`.
    await expect
        .poll(async () => {
            const dehydratedDeviceIds = await getDehydratedDeviceIds(app.client);
            return dehydratedDeviceIds.length;
        })
        .toEqual(1);
}

/** Wait for our user to not have a dehydrated device */
async function expectDehydratedDeviceDisabled(app: ElementAppPage): Promise<void> {
    // It might be nice to do this via the UI, but currently this info is not exposed via the UI.
    //
    // Note we might have to wait for the device list to be refreshed, so we wrap in `expect.poll`.
    await expect
        .poll(async () => {
            const dehydratedDeviceIds = await getDehydratedDeviceIds(app.client);
            return dehydratedDeviceIds.length;
        })
        .toEqual(0);
}
