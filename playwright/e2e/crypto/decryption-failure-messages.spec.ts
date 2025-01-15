/*
Copyright 2024 New Vector Ltd.
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EmittedEvents, Preset } from "matrix-js-sdk/src/matrix";
import { expect, test } from "../../element-web-test";
import {
    createRoom,
    enableKeyBackup,
    logIntoElement,
    logOutOfElement,
    sendMessageInCurrentRoom,
    verifySession,
} from "./utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Cryptography", function () {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "Bob",
            autoAcceptInvites: false,
        },
    });

    test.describe("decryption failure messages", () => {
        test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");

        test("should handle device-relative historical messages", async ({
            homeserver,
            page,
            app,
            credentials,
            user,
        }) => {
            test.setTimeout(60000);

            // Start with a logged-in session, without key backup, and send a message.
            await createRoom(page, "Test room", true);
            await sendMessageInCurrentRoom(page, "test test");

            // Log out, discarding the key for the sent message.
            await logOutOfElement(page, true);

            // Log in again, and see how the message looks.
            await logIntoElement(page, credentials);
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
            await logIntoElement(page, credentials);
            await page.locator(".mx_AuthPage").getByRole("button", { name: "Skip verification for now" }).click();
            await page.locator(".mx_AuthPage").getByRole("button", { name: "I'll verify later" }).click();
            await app.viewRoomByName("Test room");

            // In this case, the call to cryptoApi.isEncryptionEnabledInRoom is taking a long time to resolve
            await page.waitForTimeout(1000);

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
                bot: bob,
            }) => {
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
                bot: bob,
            }) => {
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
