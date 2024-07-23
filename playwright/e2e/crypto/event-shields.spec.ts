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

import { expect, test } from "../../element-web-test";
import { autoJoin, createSharedRoomWithUser, enableKeyBackup, logIntoElement, logOutOfElement, verify } from "./utils";
import { Bot } from "../../pages/bot";

test.describe("Cryptography", function () {
    test.use({
        displayName: "Alice",
        botCreateOpts: {
            displayName: "Bob",
            autoAcceptInvites: false,
        },
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

        test("should show the correct shield on e2e events", async ({ page, app, bot: bob, homeserver }) => {
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
            await verify(app, bob);

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
                await rightPanel.getByTestId("base-card-back-button").click();
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

            await expect(last).toContainText("test encrypted from unverified");
            await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_warning/);
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
            test.slow();
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
            // Reload to work around a Rust crypto bug where it can hold onto the indexeddb even after logout
            // https://github.com/element-hq/element-web/issues/25779
            await page.addInitScript(() => {
                // When we reload, the initScript created by the `user`/`pageWithCredentials` fixtures
                // will re-inject the original credentials into localStorage, which we don't want.
                // To work around, we add a second initScript which will clear localStorage again.
                window.localStorage.clear();
            });
            await page.reload();
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
            await verify(app, bob);

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
});
