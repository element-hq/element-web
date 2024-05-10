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
import type { EmittedEvents, Preset } from "matrix-js-sdk/src/matrix";
import { expect, test } from "../../element-web-test";
import {
    copyAndContinue,
    createRoom,
    createSharedRoomWithUser,
    doTwoWaySasVerification,
    enableKeyBackup,
    logIntoElement,
    logOutOfElement,
    sendMessageInCurrentRoom,
    verifySession,
    waitForVerificationRequest,
} from "./utils";
import { Bot } from "../../pages/bot";
import { ElementAppPage } from "../../pages/ElementAppPage";
import { Client } from "../../pages/client";
import { isDendrite } from "../../plugins/homeserver/dendrite";

const openRoomInfo = async (page: Page) => {
    await page.getByRole("button", { name: "Room info" }).click();
    return page.locator(".mx_RightPanel");
};

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

/** configure the given MatrixClient to auto-accept any invites */
async function autoJoin(client: Client) {
    await client.evaluate((cli) => {
        cli.on(window.matrixcs.RoomMemberEvent.Membership, (event, member) => {
            if (member.membership === "invite" && member.userId === cli.getUserId()) {
                cli.joinRoom(member.roomId);
            }
        });
    });
}

const verify = async (page: Page, bob: Bot) => {
    const bobsVerificationRequestPromise = waitForVerificationRequest(bob);

    const roomInfo = await openRoomInfo(page);
    await roomInfo.getByRole("menuitem", { name: "People" }).click();
    await roomInfo.getByText("Bob").click();
    await roomInfo.getByRole("button", { name: "Verify" }).click();
    await roomInfo.getByRole("button", { name: "Start Verification" }).click();

    // this requires creating a DM, so can take a while. Give it a longer timeout.
    await roomInfo.getByRole("button", { name: "Verify by emoji" }).click({ timeout: 30000 });

    const request = await bobsVerificationRequestPromise;
    // the bot user races with the Element user to hit the "verify by emoji" button
    const verifier = await request.evaluateHandle((request) => request.startVerification("m.sas.v1"));
    await doTwoWaySasVerification(page, verifier);
    await roomInfo.getByRole("button", { name: "They match" }).click();
    await expect(roomInfo.getByText("You've successfully verified Bob!")).toBeVisible();
    await roomInfo.getByRole("button", { name: "Got it" }).click();
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
        await verify(page, bob);

        // Assert that verified icon is rendered
        await page.getByRole("button", { name: "Room members" }).click();
        await page.getByRole("button", { name: "Room information" }).click();
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
        await verify(page, bob);
    });

    test.describe("event shields", () => {
        let testRoomId: string;

        test.beforeEach(async ({ page, bot: bob, user: aliceCredentials, app }) => {
            await app.client.bootstrapCrossSigning(aliceCredentials);
            await autoJoin(bob);

            // create an encrypted room
            testRoomId = await createSharedRoomWithUser(app, bob.credentials.userId, {
                name: "TestRoom",
                initial_state: [
                    {
                        type: "m.room.encryption",
                        state_key: "",
                        content: {
                            algorithm: "m.megolm.v1.aes-sha2",
                        },
                    },
                ],
            });
        });

        test("should show the correct shield on e2e events", async ({
            page,
            app,
            bot: bob,
            homeserver,
            cryptoBackend,
        }) => {
            // Bob has a second, not cross-signed, device
            const bobSecondDevice = new Bot(page, homeserver, {
                bootstrapSecretStorage: false,
                bootstrapCrossSigning: false,
            });
            bobSecondDevice.setCredentials(
                await homeserver.loginUser(bob.credentials.userId, bob.credentials.password),
            );
            await bobSecondDevice.prepareClient();

            await bob.sendEvent(testRoomId, null, "m.room.encrypted", {
                algorithm: "m.megolm.v1.aes-sha2",
                ciphertext: "the bird is in the hand",
            });

            const last = page.locator(".mx_EventTile_last");
            await expect(last).toContainText("Unable to decrypt message");
            const lastE2eIcon = last.locator(".mx_EventTile_e2eIcon");
            await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_decryption_failure/);
            await lastE2eIcon.focus();
            await expect(page.getByRole("tooltip")).toContainText("This message could not be decrypted");

            /* Should show a red padlock for an unencrypted message in an e2e room */
            await bob.evaluate(
                (cli, testRoomId) =>
                    cli.http.authedRequest(
                        window.matrixcs.Method.Put,
                        `/rooms/${encodeURIComponent(testRoomId)}/send/m.room.message/test_txn_1`,
                        undefined,
                        {
                            msgtype: "m.text",
                            body: "test unencrypted",
                        },
                    ),
                testRoomId,
            );

            await expect(last).toContainText("test unencrypted");
            await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_warning/);
            await lastE2eIcon.focus();
            await expect(page.getByRole("tooltip")).toContainText("Not encrypted");

            /* Should show no padlock for an unverified user */
            // bob sends a valid event
            await bob.sendMessage(testRoomId, "test encrypted 1");

            // the message should appear, decrypted, with no warning, but also no "verified"
            const lastTile = page.locator(".mx_EventTile_last");
            const lastTileE2eIcon = lastTile.locator(".mx_EventTile_e2eIcon");
            await expect(lastTile).toContainText("test encrypted 1");
            // no e2e icon
            await expect(lastTileE2eIcon).not.toBeVisible();

            /* Now verify Bob */
            await verify(page, bob);

            /* Existing message should be updated when user is verified. */
            await expect(last).toContainText("test encrypted 1");
            // still no e2e icon
            await expect(last.locator(".mx_EventTile_e2eIcon")).not.toBeVisible();

            /* should show no padlock, and be verified, for a message from a verified device */
            await bob.sendMessage(testRoomId, "test encrypted 2");

            await expect(lastTile).toContainText("test encrypted 2");
            // no e2e icon
            await expect(lastTileE2eIcon).not.toBeVisible();

            /* should show red padlock for a message from an unverified device */
            await bobSecondDevice.sendMessage(testRoomId, "test encrypted from unverified");
            await expect(lastTile).toContainText("test encrypted from unverified");
            await expect(lastTileE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_warning/);
            await lastTileE2eIcon.focus();
            await expect(page.getByRole("tooltip")).toContainText("Encrypted by a device not verified by its owner.");

            /* Should show a grey padlock for a message from an unknown device */
            // bob deletes his second device
            await bobSecondDevice.evaluate((cli) => cli.logout(true));

            // wait for the logout to propagate. Workaround for https://github.com/vector-im/element-web/issues/26263 by repeatedly closing and reopening Bob's user info.
            async function awaitOneDevice(iterations = 1) {
                const rightPanel = page.locator(".mx_RightPanel");
                await rightPanel.getByRole("button", { name: "Room members" }).click();
                await rightPanel.getByText("Bob").click();
                const sessionCountText = await rightPanel
                    .locator(".mx_UserInfo_devices")
                    .getByText(" session", { exact: false })
                    .textContent();
                // cf https://github.com/vector-im/element-web/issues/26279: Element-R uses the wrong text here
                if (sessionCountText != "1 session" && sessionCountText != "1 verified session") {
                    if (iterations >= 10) {
                        throw new Error(`Bob still has ${sessionCountText} after 10 iterations`);
                    }
                    await awaitOneDevice(iterations + 1);
                }
            }

            await awaitOneDevice();

            // close and reopen the room, to get the shield to update.
            await app.viewRoomByName("Bob");
            await app.viewRoomByName("TestRoom");

            // some debate over whether this should have a red or a grey shield. Legacy crypto shows a grey shield,
            // Rust crypto a red one.
            await expect(last).toContainText("test encrypted from unverified");
            if (cryptoBackend === "rust") {
                await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_warning/);
            } else {
                await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_normal/);
            }
            await lastE2eIcon.focus();
            await expect(page.getByRole("tooltip")).toContainText("Encrypted by an unknown or deleted device.");
        });

        test("Should show a grey padlock for a key restored from backup", async ({
            page,
            app,
            bot: bob,
            homeserver,
            user: aliceCredentials,
        }) => {
            const securityKey = await enableKeyBackup(app);

            // bob sends a valid event
            await bob.sendMessage(testRoomId, "test encrypted 1");

            const lastTile = page.locator(".mx_EventTile_last");
            const lastTileE2eIcon = lastTile.locator(".mx_EventTile_e2eIcon");
            await expect(lastTile).toContainText("test encrypted 1");
            // no e2e icon
            await expect(lastTileE2eIcon).not.toBeVisible();

            // Workaround for https://github.com/element-hq/element-web/issues/27267. It can take up to 10 seconds for
            // the key to be backed up.
            await page.waitForTimeout(10000);

            /* log out, and back in */
            await logOutOfElement(page);
            await logIntoElement(page, homeserver, aliceCredentials, securityKey);

            /* go back to the test room and find Bob's message again */
            await app.viewRoomById(testRoomId);
            await expect(lastTile).toContainText("test encrypted 1");
            // The gray shield would be a mx_EventTile_e2eIcon_normal. The red shield would be a mx_EventTile_e2eIcon_warning.
            // No shield would have no div mx_EventTile_e2eIcon at all.
            await expect(lastTileE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_normal/);
            await lastTileE2eIcon.hover();
            // The key is coming from backup, so it is not anymore possible to establish if the claimed device
            // creator of this key is authentic. The tooltip should be "The authenticity of this encrypted message can't be guaranteed on this device."
            // It is not "Encrypted by an unknown or deleted device." even if the claimed device is actually deleted.
            await expect(page.getByRole("tooltip")).toContainText(
                "The authenticity of this encrypted message can't be guaranteed on this device.",
            );
        });

        test("should show the correct shield on edited e2e events", async ({ page, app, bot: bob, homeserver }) => {
            // bob has a second, not cross-signed, device
            const bobSecondDevice = new Bot(page, homeserver, {
                bootstrapSecretStorage: false,
                bootstrapCrossSigning: false,
            });
            bobSecondDevice.setCredentials(
                await homeserver.loginUser(bob.credentials.userId, bob.credentials.password),
            );
            await bobSecondDevice.prepareClient();

            // verify Bob
            await verify(page, bob);

            // bob sends a valid event
            const testEvent = await bob.sendMessage(testRoomId, "Hoo!");

            // the message should appear, decrypted, with no warning
            await expect(
                page.locator(".mx_EventTile", { hasText: "Hoo!" }).locator(".mx_EventTile_e2eIcon_warning"),
            ).not.toBeVisible();

            // bob sends an edit to the first message with his unverified device
            await bobSecondDevice.sendMessage(testRoomId, {
                "m.new_content": {
                    msgtype: "m.text",
                    body: "Haa!",
                },
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: testEvent.event_id,
                },
            });

            // the edit should have a warning
            await expect(
                page.locator(".mx_EventTile", { hasText: "Haa!" }).locator(".mx_EventTile_e2eIcon_warning"),
            ).toBeVisible();

            // a second edit from the verified device should be ok
            await bob.sendMessage(testRoomId, {
                "m.new_content": {
                    msgtype: "m.text",
                    body: "Hee!",
                },
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: testEvent.event_id,
                },
            });

            await expect(
                page.locator(".mx_EventTile", { hasText: "Hee!" }).locator(".mx_EventTile_e2eIcon_warning"),
            ).not.toBeVisible();
        });
    });

    test.describe("decryption failure messages", () => {
        test("should handle device-relative historical messages", async ({
            homeserver,
            page,
            app,
            credentials,
            user,
            cryptoBackend,
        }) => {
            test.skip(cryptoBackend === "legacy", "Not implemented for legacy crypto");
            test.setTimeout(60000);

            // Start with a logged-in session, without key backup, and send a message.
            await createRoom(page, "Test room", true);
            await sendMessageInCurrentRoom(page, "test test");

            // Log out, discarding the key for the sent message.
            await logOutOfElement(page, true);

            // Log in again, and see how the message looks.
            await logIntoElement(page, homeserver, credentials);
            await app.viewRoomByName("Test room");
            const lastTile = page.locator(".mx_EventTile").last();
            await expect(lastTile).toContainText("Historical messages are not available on this device");
            await expect(lastTile.locator(".mx_EventTile_e2eIcon_decryption_failure")).toBeVisible();

            // Now, we set up key backup, and then send another message.
            const secretStorageKey = await enableKeyBackup(app);
            await app.viewRoomByName("Test room");
            await sendMessageInCurrentRoom(page, "test2 test2");

            // Workaround for https://github.com/element-hq/element-web/issues/27267. It can take up to 10 seconds for
            // the key to be backed up.
            await page.waitForTimeout(10000);

            // Finally, log out again, and back in, skipping verification for now, and see what we see.
            await logOutOfElement(page);
            await logIntoElement(page, homeserver, credentials);
            await page.locator(".mx_AuthPage").getByRole("button", { name: "Skip verification for now" }).click();
            await page.locator(".mx_AuthPage").getByRole("button", { name: "I'll verify later" }).click();
            await app.viewRoomByName("Test room");

            // There should be two historical events in the timeline
            const tiles = await page.locator(".mx_EventTile").all();
            expect(tiles.length).toBeGreaterThanOrEqual(2);
            // look at the last two tiles only
            for (const tile of tiles.slice(-2)) {
                await expect(tile).toContainText("You need to verify this device for access to historical messages");
                await expect(tile.locator(".mx_EventTile_e2eIcon_decryption_failure")).toBeVisible();
            }

            // Now verify our device (setting up key backup), and check what happens
            await verifySession(app, secretStorageKey);
            const tilesAfterVerify = (await page.locator(".mx_EventTile").all()).slice(-2);

            // The first message still cannot be decrypted, because it was never backed up. It's now a regular UTD though.
            await expect(tilesAfterVerify[0]).toContainText("Unable to decrypt message");
            await expect(tilesAfterVerify[0].locator(".mx_EventTile_e2eIcon_decryption_failure")).toBeVisible();

            // The second message should now be decrypted, with a grey shield
            await expect(tilesAfterVerify[1]).toContainText("test2 test2");
            await expect(tilesAfterVerify[1].locator(".mx_EventTile_e2eIcon_normal")).toBeVisible();
        });

        test.describe("non-joined historical messages", () => {
            test.skip(isDendrite, "does not yet support membership on events");

            test("should display undecryptable non-joined historical messages with a different message", async ({
                homeserver,
                page,
                app,
                credentials: aliceCredentials,
                user: alice,
                cryptoBackend,
                bot: bob,
            }) => {
                test.skip(cryptoBackend === "legacy", "Not implemented for legacy crypto");

                // Bob creates an encrypted room and sends a message to it. He then invites Alice
                const roomId = await bob.evaluate(
                    async (client, { alice }) => {
                        const encryptionStatePromise = new Promise<void>((resolve) => {
                            client.on("RoomState.events" as EmittedEvents, (event, _state, _lastStateEvent) => {
                                if (event.getType() === "m.room.encryption") {
                                    resolve();
                                }
                            });
                        });

                        const { room_id: roomId } = await client.createRoom({
                            initial_state: [
                                {
                                    type: "m.room.encryption",
                                    content: {
                                        algorithm: "m.megolm.v1.aes-sha2",
                                    },
                                },
                            ],
                            name: "Test room",
                            preset: "private_chat" as Preset,
                        });

                        // wait for m.room.encryption event, so that when we send a
                        // message, it will be encrypted
                        await encryptionStatePromise;

                        await client.sendTextMessage(roomId, "This should be undecryptable");

                        await client.invite(roomId, alice.userId);

                        return roomId;
                    },
                    { alice },
                );

                // Alice accepts the invite
                await expect(
                    page.getByRole("group", { name: "Invites" }).locator(".mx_RoomSublist_tiles").getByRole("treeitem"),
                ).toHaveCount(1);
                await page.getByRole("treeitem", { name: "Test room" }).click();
                await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

                // Bob sends an encrypted event and an undecryptable event
                await bob.evaluate(
                    async (client, { roomId }) => {
                        await client.sendTextMessage(roomId, "This should be decryptable");
                        await client.sendEvent(
                            roomId,
                            "m.room.encrypted" as any,
                            {
                                algorithm: "m.megolm.v1.aes-sha2",
                                ciphertext: "this+message+will+be+undecryptable",
                                device_id: client.getDeviceId()!,
                                sender_key: (await client.getCrypto()!.getOwnDeviceKeys()).ed25519,
                                session_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                            } as any,
                        );
                    },
                    { roomId },
                );

                // We wait for the event tiles that we expect from the messages that
                // Bob sent, in sequence.
                await expect(
                    page.locator(`.mx_EventTile`).getByText("You don't have access to this message"),
                ).toBeVisible();
                await expect(page.locator(`.mx_EventTile`).getByText("This should be decryptable")).toBeVisible();
                await expect(page.locator(`.mx_EventTile`).getByText("Unable to decrypt message")).toBeVisible();

                // And then we ensure that they are where we expect them to be
                // Alice should see these event tiles:
                // - first message sent by Bob (undecryptable)
                // - Bob invited Alice
                // - Alice joined the room
                // - second message sent by Bob (decryptable)
                // - third message sent by Bob (undecryptable)
                const tiles = await page.locator(".mx_EventTile").all();
                expect(tiles.length).toBeGreaterThanOrEqual(5);

                // The first message from Bob was sent before Alice was in the room, so should
                // be different from the standard UTD message
                await expect(tiles[tiles.length - 5]).toContainText("You don't have access to this message");
                await expect(tiles[tiles.length - 5].locator(".mx_EventTile_e2eIcon_decryption_failure")).toBeVisible();

                // The second message from Bob should be decryptable
                await expect(tiles[tiles.length - 2]).toContainText("This should be decryptable");
                // this tile won't have an e2e icon since we got the key from the sender

                // The third message from Bob is undecryptable, but was sent while Alice was
                // in the room and is expected to be decryptable, so this should have the
                // standard UTD message
                await expect(tiles[tiles.length - 1]).toContainText("Unable to decrypt message");
                await expect(tiles[tiles.length - 1].locator(".mx_EventTile_e2eIcon_decryption_failure")).toBeVisible();
            });

            test("should be able to jump to a message sent before our last join event", async ({
                homeserver,
                page,
                app,
                credentials: aliceCredentials,
                user: alice,
                cryptoBackend,
                bot: bob,
            }) => {
                // The old pre-join UTD hiding code would hide events sent
                // before our latest join event, even if the event that we're
                // jumping to was decryptable.  We test that this no longer happens.

                test.skip(cryptoBackend === "legacy", "Not implemented for legacy crypto");

                // Bob:
                // - creates an encrypted room,
                // - invites Alice,
                // - sends a message to it,
                // - kicks Alice,
                // - sends a bunch more events
                // - invites Alice again
                // In this way, there will be an event that Alice can decrypt,
                // followed by a bunch of undecryptable events which Alice shouldn't
                // expect to be able to decrypt.  The old code would have hidden all
                // the events, even the decryptable event (which it wouldn't have
                // even tried to fetch, if it was far enough back).
                const { roomId, eventId } = await bob.evaluate(
                    async (client, { alice }) => {
                        const { room_id: roomId } = await client.createRoom({
                            initial_state: [
                                {
                                    type: "m.room.encryption",
                                    content: {
                                        algorithm: "m.megolm.v1.aes-sha2",
                                    },
                                },
                            ],
                            name: "Test room",
                            preset: "private_chat" as Preset,
                        });

                        // invite Alice
                        const inviteAlicePromise = new Promise<void>((resolve) => {
                            client.on("RoomMember.membership" as EmittedEvents, (_event, member, _oldMembership?) => {
                                if (member.userId === alice.userId && member.membership === "invite") {
                                    resolve();
                                }
                            });
                        });
                        await client.invite(roomId, alice.userId);
                        // wait for the invite to come back so that we encrypt to Alice
                        await inviteAlicePromise;

                        // send a message that Alice should be able to decrypt
                        const { event_id: eventId } = await client.sendTextMessage(
                            roomId,
                            "This should be decryptable",
                        );

                        // kick Alice
                        const kickAlicePromise = new Promise<void>((resolve) => {
                            client.on("RoomMember.membership" as EmittedEvents, (_event, member, _oldMembership?) => {
                                if (member.userId === alice.userId && member.membership === "leave") {
                                    resolve();
                                }
                            });
                        });
                        await client.kick(roomId, alice.userId);
                        await kickAlicePromise;

                        // send a bunch of messages that Alice won't be able to decrypt
                        for (let i = 0; i < 20; i++) {
                            await client.sendTextMessage(roomId, `${i}`);
                        }

                        // invite Alice again
                        await client.invite(roomId, alice.userId);

                        return { roomId, eventId };
                    },
                    { alice },
                );

                // Alice accepts the invite
                await expect(
                    page.getByRole("group", { name: "Invites" }).locator(".mx_RoomSublist_tiles").getByRole("treeitem"),
                ).toHaveCount(1);
                await page.getByRole("treeitem", { name: "Test room" }).click();
                await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

                // wait until we're joined and see the timeline
                await expect(page.locator(`.mx_EventTile`).getByText("Alice joined the room")).toBeVisible();

                // we should be able to jump to the decryptable message that Bob sent
                await page.goto(`#/room/${roomId}/${eventId}`);

                await expect(page.locator(`.mx_EventTile`).getByText("This should be decryptable")).toBeVisible();
            });
        });
    });
});
