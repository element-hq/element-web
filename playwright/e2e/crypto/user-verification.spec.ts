/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { type Preset, type Visibility } from "matrix-js-sdk/src/matrix";

import { test, expect } from "../../element-web-test";
import { doTwoWaySasVerification, awaitVerifier } from "./utils";
import { Client } from "../../pages/client";

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
        page,
        bot: bob,
        user: aliceCredentials,
        toasts,
        room: { roomId: dmRoomId },
    }) => {
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

        // request verification by emoji
        await page.locator("#mx_RightPanel").getByRole("button", { name: "Verify by emoji" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        const botVerifier = await awaitVerifier(bobVerificationRequest);
        // ... confirm ...
        botVerifier.evaluate((verifier) => verifier.verify());
        // ... and then check the emoji match
        await doTwoWaySasVerification(page, botVerifier);

        await page.getByRole("button", { name: "They match" }).click();
        await expect(page.getByText("You've successfully verified Bob!")).toBeVisible();
        await page.getByRole("button", { name: "Got it" }).click();
    });

    test("can abort emoji verification when emoji mismatch", async ({
        page,
        bot: bob,
        user: aliceCredentials,
        toasts,
        room: { roomId: dmRoomId },
    }) => {
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

        // request verification by emoji
        await page.locator("#mx_RightPanel").getByRole("button", { name: "Verify by emoji" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        const botVerifier = await awaitVerifier(bobVerificationRequest);
        // ... confirm ...
        botVerifier.evaluate((verifier) => verifier.verify()).catch(() => {});
        // ... and abort the verification
        await page.getByRole("button", { name: "They don't match" }).click();

        const dialog = page.locator(".mx_Dialog");
        await expect(dialog.getByText("Your messages are not secure")).toBeVisible();
        await dialog.getByRole("button", { name: "OK" }).click();
        await expect(dialog).not.toBeVisible();
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
