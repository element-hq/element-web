/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Preset, type Visibility } from "matrix-js-sdk/src/matrix";

import { test, expect } from "../../element-web-test";
import { doTwoWaySasVerification, awaitVerifier, waitForDevices } from "./utils";
import { type Client } from "../../pages/client";

test.describe("User verification", () => {
    // note that there are other tests that check user verification works in `crypto.spec.ts`.

    test.use({
        displayName: "Alice",
        botCreateOpts: { displayName: "Bob", autoAcceptInvites: true, userIdPrefix: "bob_" },
        room: async ({ page, app, bot: bob, user: aliceCredentials }, use) => {
            await app.client.bootstrapCrossSigning(aliceCredentials);

            // the other user creates a DM
            const dmRoomId = await createDMRoom(bob, aliceCredentials.userId);

            // accept the DM
            await app.viewRoomByName("Bob");
            await page.getByRole("button", { name: "Start chatting" }).click();
            await use({ roomId: dmRoomId });
        },
    });

    test("can receive a verification request when there is no existing DM", async ({
        app,
        page,
        bot: bob,
        user: aliceCredentials,
        toasts,
        room: { roomId: dmRoomId },
    }) => {
        await waitForDevices(app, bob.credentials.userId, 1);
        await expect(page.getByRole("button", { name: "Avatar" })).toBeVisible();
        const avatar = page.getByRole("button", { name: "Avatar" });
        await avatar.click();

        // once Alice has joined, Bob starts the verification
        const bobVerificationRequest = await bob.evaluateHandle(
            async (client, { dmRoomId, aliceCredentials }) => {
                const room = client.getRoom(dmRoomId);
                while (room.getMember(aliceCredentials.userId)?.membership !== "join") {
                    await new Promise((resolve) => {
                        room.once(window.matrixcs.RoomStateEvent.Members, resolve);
                    });
                }

                return client.getCrypto().requestVerificationDM(aliceCredentials.userId, dmRoomId);
            },
            { dmRoomId, aliceCredentials },
        );

        // there should also be a toast
        const toast = await toasts.getToast("Verification requested");
        // it should contain the details of the requesting user
        await expect(toast.getByText(`Bob (${bob.credentials.userId})`)).toBeVisible();
        // Accept
        await toast.getByRole("button", { name: "Verify User" }).click();

        // Wait for the QR code to be rendered. If we don't do this, then the QR code can be rendered just as
        // Playwright tries to click the "Verify by emoji" button, which seems to make it miss the button.
        // (richvdh: I thought Playwright was supposed to be resilient to such things, but empirically not.)
        await expect(page.getByAltText("QR Code")).toBeVisible();

        // request verification by emoji
        await page.locator("#mx_RightPanel").getByRole("button", { name: "Verify by emoji" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        const botVerifier = await awaitVerifier(bobVerificationRequest);
        // ... confirm ...
        void botVerifier.evaluate((verifier) => verifier.verify());
        // ... and then check the emoji match
        await doTwoWaySasVerification(page, botVerifier);

        await page.getByRole("button", { name: "They match" }).click();
        await expect(page.getByText("You've successfully verified Bob!")).toBeVisible();
        await page.getByRole("button", { name: "Got it" }).click();
    });

    test("can abort emoji verification when emoji mismatch", async ({
        app,
        page,
        bot: bob,
        user: aliceCredentials,
        toasts,
        room: { roomId: dmRoomId },
    }) => {
        await waitForDevices(app, bob.credentials.userId, 1);
        await expect(page.getByRole("button", { name: "Avatar" })).toBeVisible();
        const avatar = page.getByRole("button", { name: "Avatar" });
        await avatar.click();

        // once Alice has joined, Bob starts the verification
        const bobVerificationRequest = await bob.evaluateHandle(
            async (client, { dmRoomId, aliceCredentials }) => {
                const room = client.getRoom(dmRoomId);
                while (room.getMember(aliceCredentials.userId)?.membership !== "join") {
                    await new Promise((resolve) => {
                        room.once(window.matrixcs.RoomStateEvent.Members, resolve);
                    });
                }

                return client.getCrypto().requestVerificationDM(aliceCredentials.userId, dmRoomId);
            },
            { dmRoomId, aliceCredentials },
        );

        // Accept verification via toast
        const toast = await toasts.getToast("Verification requested");
        await toast.getByRole("button", { name: "Verify User" }).click();

        // Wait for the QR code to be rendered. If we don't do this, then the QR code can be rendered just as
        // Playwright tries to click the "Verify by emoji" button, which seems to make it miss the button.
        // (richvdh: I thought Playwright was supposed to be resilient to such things, but empirically not.)
        await expect(page.getByAltText("QR Code")).toBeVisible();

        // request verification by emoji
        await page.locator("#mx_RightPanel").getByRole("button", { name: "Verify by emoji" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        const botVerifier = await awaitVerifier(bobVerificationRequest);
        // ... and confirm. We expect the verification to fail; we catch the error on the DOM side
        // to stop playwright marking the evaluate as failing in the UI.
        const botVerification = botVerifier.evaluate((verifier) => verifier.verify().catch(() => {}));

        // ... and abort the verification
        await page.getByRole("button", { name: "They don't match" }).click();

        const dialog = page.locator(".mx_Dialog");
        await expect(dialog.getByText("Your messages are not secure")).toBeVisible();
        await dialog.getByRole("button", { name: "OK" }).click();
        await expect(dialog).not.toBeVisible();

        await botVerification;
    });
});

async function createDMRoom(client: Client, userId: string): Promise<string> {
    return client.createRoom({
        preset: "trusted_private_chat" as Preset,
        visibility: "private" as Visibility,
        invite: [userId],
        is_direct: true,
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
}
