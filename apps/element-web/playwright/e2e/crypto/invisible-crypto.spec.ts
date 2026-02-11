/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "../../element-web-test";
import { autoJoin, createSecondBotDevice, createSharedRoomWithUser, verify } from "./utils";
import { bootstrapCrossSigningForClient } from "../../pages/client.ts";

/** Tests for the "invisible crypto" behaviour -- i.e., when the "exclude insecure devices" setting is enabled */
test.describe("Invisible cryptography", () => {
    test.slow();
    test.use({
        displayName: "Alice",
        botCreateOpts: { displayName: "Bob" },
        labsFlags: ["feature_exclude_insecure_devices"],
    });

    test("Messages fail to decrypt when sender is previously verified", async ({
        page,
        bot: bob,
        user: aliceCredentials,
        app,
        homeserver,
    }) => {
        await app.client.bootstrapCrossSigning(aliceCredentials);
        await autoJoin(bob);

        // create an encrypted room
        const testRoomId = await createSharedRoomWithUser(app, bob.credentials.userId, {
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

        // Verify Bob
        await verify(app, bob);

        // Bob logs in a new device and resets cross-signing
        const bobSecondDevice = await createSecondBotDevice(page, homeserver, bob);
        await bootstrapCrossSigningForClient(await bobSecondDevice.prepareClient(), bob.credentials, true);

        /* should show an error for a message from a previously verified device */
        await bobSecondDevice.sendMessage(testRoomId, "test encrypted from user that was previously verified");
        const lastTile = page.locator(".mx_EventTile_last");
        await expect(lastTile).toContainText("Sender's verified identity was reset");
    });
});
