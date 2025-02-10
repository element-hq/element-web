/*
Copyright 2024 New Vector Ltd.
Copyright 2022-2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator } from "@playwright/test";

import { expect, test } from "../../element-web-test";
import {
    autoJoin,
    createSecondBotDevice,
    createSharedRoomWithUser,
    enableKeyBackup,
    logIntoElement,
    logOutOfElement,
    verify,
} from "./utils";
import { bootstrapCrossSigningForClient } from "../../pages/client.ts";
import { type ElementAppPage } from "../../pages/ElementAppPage.ts";

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

            // create an encrypted room, and wait for Bob to join it.
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

            // Even though Alice has seen Bob's join event, Bob may not have done so yet. Wait for the sync to arrive.
            await bob.awaitRoomMembership(testRoomId);

            await app.client.network.setupRoute();
        });

        test("should show the correct shield on e2e events", async ({
            page,
            app,
            bot: bob,
            homeserver,
        }, workerInfo) => {
            // Bob has a second, not cross-signed, device
            const bobSecondDevice = await createSecondBotDevice(page, homeserver, bob);

            // Dismiss the toast nagging us to set up recovery otherwise it gets in the way of clicking the room list
            await page.getByRole("button", { name: "Not now" }).click();

            await bob.sendEvent(testRoomId, null, "m.room.encrypted", {
                algorithm: "m.megolm.v1.aes-sha2",
                ciphertext: "the bird is in the hand",
            });

            const last = page.locator(".mx_EventTile_last");
            await expect(last).toContainText("Unable to decrypt message");
            const lastE2eIcon = last.locator(".mx_EventTile_e2eIcon");
            await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_decryption_failure/);
            await lastE2eIcon.focus();
            await expect(await app.getTooltipForElement(lastE2eIcon)).toContainText(
                "This message could not be decrypted",
            );

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
            await expect(await app.getTooltipForElement(lastE2eIcon)).toContainText("Not encrypted");

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
            await expect(await app.getTooltipForElement(lastTileE2eIcon)).toContainText(
                "Encrypted by a device not verified by its owner.",
            );

            /* Should show a red padlock for a message from an unverified device.
             * Rust crypto remembers the verification state of the sending device, so it will know that the device was
             * unverified, even if it gets deleted. */
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
            await expect(await app.getTooltipForElement(lastE2eIcon)).toContainText(
                "Encrypted by a device not verified by its owner.",
            );
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
            await logIntoElement(page, aliceCredentials, securityKey);

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
            await expect(await app.getTooltipForElement(lastTileE2eIcon)).toContainText(
                "The authenticity of this encrypted message can't be guaranteed on this device.",
            );
        });

        test("should show the correct shield on edited e2e events", async ({ page, app, bot: bob, homeserver }) => {
            // bob has a second, not cross-signed, device
            const bobSecondDevice = await createSecondBotDevice(page, homeserver, bob);

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

        test("should show correct shields on events sent by devices which have since been deleted", async ({
            page,
            app,
            bot: bob,
            homeserver,
        }) => {
            // Workaround for https://github.com/element-hq/element-web/issues/28640:
            // make sure that Alice has seen Bob's identity before she goes offline. We do this by opening
            // his user info.
            await app.toggleRoomInfoPanel();
            const rightPanel = page.locator(".mx_RightPanel");
            await rightPanel.getByRole("menuitem", { name: "People" }).click();
            await rightPanel.getByRole("button", { name: bob.credentials!.userId }).click();
            await expect(rightPanel.locator(".mx_UserInfo_devices")).toContainText("1 session");

            // Our app is blocked from syncing while Bob sends his messages.
            await app.client.network.goOffline();

            // Bob sends a message from his verified device
            await bob.sendMessage(testRoomId, "test encrypted from verified");

            // And one from a second, not cross-signed, device
            const bobSecondDevice = await createSecondBotDevice(page, homeserver, bob);
            await bobSecondDevice.waitForNextSync(); // make sure the client knows the room is encrypted
            await bobSecondDevice.sendMessage(testRoomId, "test encrypted from unverified");

            // ... and then logs out both devices.
            await bob.evaluate((cli) => cli.logout(true));
            await bobSecondDevice.evaluate((cli) => cli.logout(true));

            // Let our app start syncing again
            await app.client.network.goOnline();

            // Wait for the messages to arrive. It can take quite a while for the sync to wake up.
            const last = page.locator(".mx_EventTile_last");
            await expect(last).toContainText("test encrypted from unverified", { timeout: 20000 });
            const lastE2eIcon = last.locator(".mx_EventTile_e2eIcon");
            await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_warning/);
            await lastE2eIcon.focus();
            await expect(await app.getTooltipForElement(lastE2eIcon)).toContainText(
                "Encrypted by a device not verified by its owner.",
            );

            const penultimate = page.locator(".mx_EventTile").filter({ hasText: "test encrypted from verified" });
            await assertNoE2EIcon(penultimate, app);
        });

        test("should show correct shields on events sent by users with changed identity", async ({
            page,
            app,
            bot: bob,
            homeserver,
        }) => {
            // Verify Bob
            await verify(app, bob);

            // Bob logs in a new device and resets cross-signing
            const bobSecondDevice = await createSecondBotDevice(page, homeserver, bob);
            await bootstrapCrossSigningForClient(await bobSecondDevice.prepareClient(), bob.credentials, true);

            /* should show an error for a message from a previously verified device */
            await bobSecondDevice.sendMessage(testRoomId, "test encrypted from user that was previously verified");
            const last = page.locator(".mx_EventTile_last");
            await expect(last).toContainText("test encrypted from user that was previously verified");
            const lastE2eIcon = last.locator(".mx_EventTile_e2eIcon");
            await expect(lastE2eIcon).toHaveClass(/mx_EventTile_e2eIcon_warning/);
            await lastE2eIcon.focus();
            await expect(await app.getTooltipForElement(lastE2eIcon)).toContainText(
                "Sender's verified identity has changed",
            );
        });
    });
});

/**
 * Check that the given message doesn't have an E2E warning icon.
 *
 * If it does, throw an error.
 */
async function assertNoE2EIcon(messageLocator: Locator, app: ElementAppPage) {
    // Make sure the message itself exists, before we check if it has any icons
    await messageLocator.waitFor();

    const e2eIcon = messageLocator.locator(".mx_EventTile_e2eIcon");
    if ((await e2eIcon.count()) > 0) {
        // uh-oh, there is an e2e icon. Let's find out what it's about so that we can throw a helpful error.
        await e2eIcon.focus();
        const tooltip = await app.getTooltipForElement(e2eIcon);
        throw new Error(`Found an unexpected e2eIcon with tooltip '${await tooltip.textContent()}'`);
    }
}
