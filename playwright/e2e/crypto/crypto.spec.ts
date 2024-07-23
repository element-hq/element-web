/*
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { Page } from "@playwright/test";
import { expect, test } from "../../element-web-test";
import { autoJoin, copyAndContinue, createSharedRoomWithUser, enableKeyBackup, verify } from "./utils";
import { Bot } from "../../pages/bot";
import { ElementAppPage } from "../../pages/ElementAppPage";

const checkDMRoom = async (page: Page) => {
    const body = page.locator(".mx_RoomView_body");
    await expect(body.getByText("Alice created this DM.")).toBeVisible();
    await expect(body.getByText("Alice invited Bob")).toBeVisible({ timeout: 1000 });
    await expect(body.locator(".mx_cryptoEvent").getByText("Encryption enabled")).toBeVisible();
};

const startDMWithBob = async (page: Page, bob: Bot) => {
    await page.locator(".mx_RoomList").getByRole("button", { name: "Start chat" }).click();
    await page.getByTestId("invite-dialog-input").fill(bob.credentials.userId);
    await page.locator(".mx_InviteDialog_tile_nameStack_name").getByText("Bob").click();
    await expect(
        page.locator(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").getByText("Bob"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go" }).click();
};

const testMessages = async (page: Page, bob: Bot, bobRoomId: string) => {
    // check the invite message
    await expect(
        page.locator(".mx_EventTile", { hasText: "Hey!" }).locator(".mx_EventTile_e2eIcon_warning"),
    ).not.toBeVisible();

    // Bob sends a response
    await bob.sendMessage(bobRoomId, "Hoo!");
    await expect(
        page.locator(".mx_EventTile", { hasText: "Hoo!" }).locator(".mx_EventTile_e2eIcon_warning"),
    ).not.toBeVisible();
};

const bobJoin = async (page: Page, bob: Bot) => {
    await bob.evaluate(async (cli) => {
        const bobRooms = cli.getRooms();
        if (!bobRooms.length) {
            await new Promise<void>((resolve) => {
                const onMembership = (_event) => {
                    cli.off(window.matrixcs.RoomMemberEvent.Membership, onMembership);
                    resolve();
                };
                cli.on(window.matrixcs.RoomMemberEvent.Membership, onMembership);
            });
        }
    });
    const roomId = await bob.joinRoomByName("Alice");

    await expect(page.getByText("Bob joined the room")).toBeVisible();
    return roomId;
};

test.describe("Cryptography", function () {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "Bob",
            autoAcceptInvites: false,
        },
    });

    for (const isDeviceVerified of [true, false]) {
        test.describe(`setting up secure key backup should work isDeviceVerified=${isDeviceVerified}`, () => {
            /**
             * Verify that the `m.cross_signing.${keyType}` key is available on the account data on the server
             * @param keyType
             */
            async function verifyKey(app: ElementAppPage, keyType: string) {
                const accountData: { encrypted: Record<string, Record<string, string>> } = await app.client.evaluate(
                    (cli, keyType) => cli.getAccountDataFromServer(`m.cross_signing.${keyType}`),
                    keyType,
                );
                expect(accountData.encrypted).toBeDefined();
                const keys = Object.keys(accountData.encrypted);
                const key = accountData.encrypted[keys[0]];
                expect(key.ciphertext).toBeDefined();
                expect(key.iv).toBeDefined();
                expect(key.mac).toBeDefined();
            }

            test("by recovery code", async ({ page, app, user: aliceCredentials }) => {
                // Verified the device
                if (isDeviceVerified) {
                    await app.client.bootstrapCrossSigning(aliceCredentials);
                }

                await page.route("**/_matrix/client/v3/keys/signatures/upload", async (route) => {
                    // We delay this API otherwise the `Setting up keys` may happen too quickly and cause flakiness
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    await route.continue();
                });

                await app.settings.openUserSettings("Security & Privacy");
                await page.getByRole("button", { name: "Set up Secure Backup" }).click();

                const dialog = page.locator(".mx_Dialog");
                // Recovery key is selected by default
                await dialog.getByRole("button", { name: "Continue" }).click();
                await copyAndContinue(page);

                // When the device is verified, the `Setting up keys` step is skipped
                if (!isDeviceVerified) {
                    const uiaDialogTitle = page.locator(".mx_InteractiveAuthDialog .mx_Dialog_title");
                    await expect(uiaDialogTitle.getByText("Setting up keys")).toBeVisible();
                    await expect(uiaDialogTitle.getByText("Setting up keys")).not.toBeVisible();
                }

                await expect(dialog.getByText("Secure Backup successful")).toBeVisible();
                await dialog.getByRole("button", { name: "Done" }).click();
                await expect(dialog.getByText("Secure Backup successful")).not.toBeVisible();

                // Verify that the SSSS keys are in the account data stored in the server
                await verifyKey(app, "master");
                await verifyKey(app, "self_signing");
                await verifyKey(app, "user_signing");
            });

            test("by passphrase", async ({ page, app, user: aliceCredentials }) => {
                // Verified the device
                if (isDeviceVerified) {
                    await app.client.bootstrapCrossSigning(aliceCredentials);
                }

                await app.settings.openUserSettings("Security & Privacy");
                await page.getByRole("button", { name: "Set up Secure Backup" }).click();

                const dialog = page.locator(".mx_Dialog");
                // Select passphrase option
                await dialog.getByText("Enter a Security Phrase").click();
                await dialog.getByRole("button", { name: "Continue" }).click();

                // Fill passphrase input
                await dialog.locator("input").fill("new passphrase for setting up a secure key backup");
                await dialog.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();
                // Confirm passphrase
                await dialog.locator("input").fill("new passphrase for setting up a secure key backup");
                await dialog.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();

                await copyAndContinue(page);

                await expect(dialog.getByText("Secure Backup successful")).toBeVisible();
                await dialog.getByRole("button", { name: "Done" }).click();
                await expect(dialog.getByText("Secure Backup successful")).not.toBeVisible();

                // Verify that the SSSS keys are in the account data stored in the server
                await verifyKey(app, "master");
                await verifyKey(app, "self_signing");
                await verifyKey(app, "user_signing");
            });
        });
    }

    test("Can reset cross-signing keys", async ({ page, app, user: aliceCredentials }) => {
        const secretStorageKey = await enableKeyBackup(app);

        // Fetch the current cross-signing keys
        async function fetchMasterKey() {
            return await test.step("Fetch master key from server", async () => {
                const k = await app.client.evaluate(async (cli) => {
                    const userId = cli.getUserId();
                    const keys = await cli.downloadKeysForUsers([userId]);
                    return Object.values(keys.master_keys[userId].keys)[0];
                });
                console.log(`fetchMasterKey: ${k}`);
                return k;
            });
        }
        const masterKey1 = await fetchMasterKey();

        // Find the "reset cross signing" button, and click it
        await app.settings.openUserSettings("Security & Privacy");
        await page.locator("div.mx_CrossSigningPanel_buttonRow").getByRole("button", { name: "Reset" }).click();

        // Confirm
        await page.getByRole("button", { name: "Clear cross-signing keys" }).click();

        // Enter the 4S key
        await page.getByPlaceholder("Security Key").fill(secretStorageKey);
        await page.getByRole("button", { name: "Continue" }).click();

        // Enter the password
        await page.getByPlaceholder("Password").fill(aliceCredentials.password);
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(async () => {
            const masterKey2 = await fetchMasterKey();
            expect(masterKey1).not.toEqual(masterKey2);
        }).toPass();

        // The dialog should have gone away
        await expect(page.locator(".mx_Dialog")).toHaveCount(1);
    });

    test("creating a DM should work, being e2e-encrypted / user verification", async ({
        page,
        app,
        bot: bob,
        user: aliceCredentials,
    }) => {
        await app.client.bootstrapCrossSigning(aliceCredentials);
        await startDMWithBob(page, bob);
        // send first message
        await page.getByRole("textbox", { name: "Send a message…" }).fill("Hey!");
        await page.getByRole("textbox", { name: "Send a message…" }).press("Enter");
        await checkDMRoom(page);
        const bobRoomId = await bobJoin(page, bob);
        await testMessages(page, bob, bobRoomId);
        await verify(app, bob);

        // Assert that verified icon is rendered
        await page.getByTestId("base-card-back-button").click();
        await page.locator(".mx_RightPanelTabs").getByText("Info").click();
        await expect(page.locator('.mx_RoomSummaryCard_badges [data-kind="success"]')).toContainText("Encrypted");

        // Take a snapshot of RoomSummaryCard with a verified E2EE icon
        await expect(page.locator(".mx_RightPanel")).toMatchScreenshot("RoomSummaryCard-with-verified-e2ee.png");
    });

    test("should allow verification when there is no existing DM", async ({
        page,
        app,
        bot: bob,
        user: aliceCredentials,
    }) => {
        await app.client.bootstrapCrossSigning(aliceCredentials);
        await autoJoin(bob);

        // we need to have a room with the other user present, so we can open the verification panel
        await createSharedRoomWithUser(app, bob.credentials.userId);
        await verify(app, bob);
    });
});
