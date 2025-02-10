/*
Copyright 2024 New Vector Ltd.
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Page } from "@playwright/test";
import { expect, test } from "../../element-web-test";
import {
    autoJoin,
    completeCreateSecretStorageDialog,
    copyAndContinue,
    createSharedRoomWithUser,
    enableKeyBackup,
    verify,
} from "./utils";
import { type Bot } from "../../pages/bot";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { isDendrite } from "../../plugins/homeserver/dendrite";

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
    // Wait for Bob to get the invite
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

    // Even though Alice has seen Bob's join event, Bob may not have done so yet. Wait for the sync to arrive.
    await bob.awaitRoomMembership(roomId);

    return roomId;
};

test.describe("Cryptography", function () {
    test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");
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
            async function verifyKey(app: ElementAppPage, keyType: "master" | "self_signing" | "user_signing") {
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

                await completeCreateSecretStorageDialog(page);

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
        await page.getByPlaceholder("Recovery Key").fill(secretStorageKey);
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

    test(
        "creating a DM should work, being e2e-encrypted / user verification",
        { tag: "@screenshot" },
        async ({ page, app, bot: bob, user: aliceCredentials }) => {
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
            await page.getByLabel("Room info").nth(1).click();
            await expect(page.locator('.mx_RoomSummaryCard_badges [data-kind="green"]')).toContainText("Encrypted");

            // Take a snapshot of RoomSummaryCard with a verified E2EE icon
            await expect(page.locator(".mx_RightPanel")).toMatchScreenshot("RoomSummaryCard-with-verified-e2ee.png");
        },
    );

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
