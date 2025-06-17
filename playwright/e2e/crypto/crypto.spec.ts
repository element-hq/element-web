/*
Copyright 2024 New Vector Ltd.
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Page } from "@playwright/test";
import { expect, test } from "../../element-web-test";
import { autoJoin, createSharedRoomWithUser, enableKeyBackup, verify } from "./utils";
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
    await page.locator(".mx_LegacyRoomList").getByRole("button", { name: "Start chat" }).click();
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

    test("Setting up key backup by recovery key", async ({ page, app, user: aliceCredentials }) => {
        await app.client.bootstrapCrossSigning(aliceCredentials);

        await enableKeyBackup(app);

        // Wait for the cross signing keys to be uploaded
        // Waiting for "Change the recovery key" button ensure that all the secrets are uploaded and cached locally
        const encryptionTab = await app.settings.openUserSettings("Encryption");
        await expect(encryptionTab.getByRole("button", { name: "Change recovery key" })).toBeVisible();

        // Verify that the SSSS keys are in the account data stored in the server
        await verifyKey(app, "master");
        await verifyKey(app, "self_signing");
        await verifyKey(app, "user_signing");
    });

    test("Can reset cross-signing keys", async ({ page, app, user: aliceCredentials }) => {
        await app.client.bootstrapCrossSigning(aliceCredentials);
        await enableKeyBackup(app);

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

        // Find "the Reset cryptographic identity" button
        const encryptionTab = await app.settings.openUserSettings("Encryption");
        await encryptionTab.getByRole("button", { name: "Reset cryptographic identity" }).click();

        // Confirm
        await encryptionTab.getByRole("button", { name: "Continue" }).click();

        // Enter the password
        await page.getByPlaceholder("Password").fill(aliceCredentials.password);
        await page.getByRole("button", { name: "Continue" }).click();

        await expect(async () => {
            const masterKey2 = await fetchMasterKey();
            expect(masterKey1).not.toEqual(masterKey2);
        }).toPass();
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
