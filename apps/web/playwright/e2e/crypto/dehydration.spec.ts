/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import {
    autoJoin,
    createBot,
    createSharedEncryptedRoomWithUser,
    enableKeyBackup,
    logIntoElement,
    logOutOfElement,
    verifyAfterLogin,
} from "./utils.ts";
import { type Client } from "../../pages/client.ts";
import { type ElementAppPage } from "../../pages/ElementAppPage.ts";
import { Bot } from "../../pages/bot.ts";

const NAME = "Alice";

test.use({
    displayName: NAME,
    synapseConfig: {
        experimental_features: {
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
        await app.closeDialog();

        // Set up recovery
        await enableKeyBackup(app);

        await expectDehydratedDeviceEnabled(app);

        // the dehydrated device gets created with the name "Dehydrated
        // device".  We want to make sure that it is not visible as a normal
        // device.
        const sessionsTab = await app.settings.openUserSettings("Sessions");
        await expect(sessionsTab.getByText("Dehydrated device")).not.toBeVisible();
    });

    test("'Get recovery key' creates dehydrated device", async ({ app, credentials, page }) => {
        await logIntoElement(page, credentials);
        await enableKeyBackup(app);
        await expectDehydratedDeviceEnabled(app);
    });

    test("Reset identity during login and back up your chats re-creates dehydrated device", async ({
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
            page.getByRole("heading", { name: "Are you sure you want to reset your digital identity?" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByPlaceholder("Password").fill(credentials.password);
        await page.getByRole("button", { name: "Continue" }).click();

        // And set up recovery
        await enableKeyBackup(app);

        // There should be a brand new dehydrated device
        await expectDehydratedDeviceEnabled(app);
    });

    test("'Reset cryptographic identity' removes dehydrated device", async ({ page, homeserver, app, credentials }) => {
        await logIntoElement(page, credentials);

        // Create a dehydrated device by setting up recovery (see "'Set up
        // recovery' creates dehydrated device" test above)
        await enableKeyBackup(app);
        await expectDehydratedDeviceEnabled(app);

        // After recovery is set up, we reset our cryptographic identity, which
        // should drop the dehydrated device.
        const settingsDialogLocator = await app.settings.openUserSettings("Encryption");
        await settingsDialogLocator.getByRole("button", { name: "Reset cryptographic identity" }).click();
        await settingsDialogLocator.getByRole("button", { name: "Continue" }).click();

        await expectDehydratedDeviceDisabled(app);
    });

    test("Can read messages sent while logged out", async ({ homeserver, credentials, page, app }) => {
        const recoveryKey =
            await test.step("Alice logs in and sets up recovery => a dehydrated device is created", async () => {
                // This test does a page reload to work around a bug, so we need to avoid the `pageWithCredentials` and `user`
                // fixtures poke credentials into localStorage via a pageload script. We therefore log in manually.
                await logIntoElement(page, credentials);

                // Logging in will have created a cross-signing identity for us. Now set up recovery, to create a dehydrated device.
                const recoveryKey = await enableKeyBackup(app);

                await expectDehydratedDeviceEnabled(app);
                return recoveryKey;
            });

        const [bob, testRoomId] = await test.step("Bob and Alice make a shared room", async () => {
            // As above, we need to avoid the `user` fixture: we therefore also need to avoid the `bot` fixture, which
            // depends on the `user` fixture. We just create the bot manually.
            const bob = new Bot(page, homeserver, { displayName: "Bob" });
            await autoJoin(bob);

            // create an encrypted room, and wait for Bob to join it.
            const testRoomId = await createSharedEncryptedRoomWithUser(app, bob.credentials.userId);

            // Even though Alice has seen Bob's join event, Bob may not have done so yet. Wait for the sync to arrive.
            await bob.awaitRoomMembership(testRoomId);
            return [bob, testRoomId];
        });

        await test.step("Alice logs out", async () => {
            await logOutOfElement(page);
        });

        await test.step("Bob sends a message", async () => {
            await bob.sendMessage(testRoomId, "test encrypted 1");
        });

        await test.step("Alice logs back in, and should be able to view Bob's message", async () => {
            // Reload to work around a Rust crypto bug where it can hold onto the indexeddb even after logout
            // https://github.com/element-hq/element-web/issues/25779
            await page.reload();

            await logIntoElement(page, credentials);
            await verifyAfterLogin(page, recoveryKey);
            await app.viewRoomById(testRoomId);
            await expect(page.getByText("test encrypted 1")).toBeVisible();
        });
    });
});

async function getDehydratedDeviceIds(client: Client): Promise<string[]> {
    return await client.evaluate(async (client) => {
        const userId = client.getUserId();
        const devices = await client.getCrypto().getUserDeviceInfo([userId]);
        return Array.from(devices.get(userId).values())
            .filter((d) => d.dehydrated)
            .map((d) => d.deviceId);
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
