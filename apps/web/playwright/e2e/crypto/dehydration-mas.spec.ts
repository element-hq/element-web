/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import { expect, test } from "../../element-web-test.ts";
import { masHomeserver } from "../../plugins/homeserver/synapse/masHomeserver.ts";
import {
    autoJoin,
    createSharedEncryptedRoomWithUser,
    enableKeyBackup,
    logOutOfElement,
    verifyAfterLogin,
} from "./utils.ts";
import { registerAccountMas } from "../oidc";
import { Bot } from "../../pages/bot.ts";

test.use({
    ...masHomeserver,
    synapseConfig: {
        experimental_features: {
            msc3814_enabled: true,
        },
    },
});

test.describe("Device dehydration, on a MAS-enabled homeserver", () => {
    test("Can read messages sent while logged out", async ({ mailpitClient, homeserver, page, app }, testInfo) => {
        test.slow();
        const aliceUserId = `alice_${testInfo.testId}`;
        const alicePassword = "Pa$sW0rD!";

        const recoveryKey =
            await test.step("Alice registers and sets up recovery => a dehydrated device is created", async () => {
                await page.goto("/#/login");
                await page.getByRole("button", { name: "Continue" }).click();

                await registerAccountMas(page, mailpitClient, aliceUserId, `${aliceUserId}@email.com`, alicePassword);
                return await enableKeyBackup(app);
            });

        const [bob, testRoomId] = await test.step("Bob registers and joins a room with Alice", async () => {
            const bob = new Bot(page, homeserver, { displayName: "Bob" });
            await autoJoin(bob);

            // Create an encrypted room, and wait for Bob to join it.
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

        await test.step("Alice logs in again", async () => {
            await page.getByRole("link", { name: "Sign in" }).click();
            await page.getByRole("button", { name: "Continue" }).click();

            await expect(page.getByText("Continue to Element?")).toBeVisible();
            await page.getByRole("button", { name: "Continue" }).click();

            await verifyAfterLogin(page, recoveryKey);
            await app.viewRoomById(testRoomId);
        });

        await test.step("Alice can decrypt Bob's message", async () => {
            await expect(page.getByText("test encrypted 1")).toBeVisible();
        });
    });
});
