/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createNewInstance } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../element-web-test";
import { ElementAppPage } from "../../pages/ElementAppPage";
import { createRoom, sendMessageInCurrentRoom } from "./utils";

test.use({
    displayName: "Alice",
    labsFlags: ["feature_share_history_on_invite"],
});

/** Tests for MSC4268: encrypted history sharing */
test.describe("History sharing", function () {
    test(
        "We should share history when sending invites",
        { tag: "@screenshot" },
        async (
            { labsFlags, browser, page: alicePage, user: aliceCredentials, app: aliceElementApp, homeserver },
            testInfo,
        ) => {
            // In this test, Alice creates an encrypted room and sends an event;
            // we then invite Bob, and ensure Bob can see the content.

            await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);

            // Register a second user, and open it in a second instance of the app
            const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "Bob");
            const bobPage = await createNewInstance(browser, bobCredentials, {}, labsFlags);
            const bobElementApp = new ElementAppPage(bobPage);
            await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

            // Create the room and send a message
            await createRoom(alicePage, "TestRoom", true);
            await sendMessageInCurrentRoom(alicePage, "A message from Alice");

            // Send the invite to Bob
            await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

            // Bob accepts the invite
            await bobPage.getByRole("option", { name: "TestRoom" }).click();
            await bobPage.getByRole("button", { name: "Accept" }).click();

            // Bob should now be able to decrypt the event
            await expect(bobPage.getByText("A message from Alice")).toBeVisible();

            const mask = [bobPage.locator(".mx_MessageTimestamp")];
            await expect(bobPage.locator(".mx_RoomView_body")).toMatchScreenshot("shared-history-invite-accepted.png", {
                mask,
            });
        },
    );

    test("Messages sent when we believed the room history was unshared should not be visible", async ({
        labsFlags,
        browser,
        page: alicePage,
        user: aliceCredentials,
        app: aliceElementApp,
        homeserver,
    }, testInfo) => {
        test.setTimeout(60000);

        // In this test:
        //   1. Alice creates an encrypted room with Bob.
        //   2. She sets the history visibility to "shared", but Bob doesn't receive the memo
        //   3. Bob sends a message
        //   4. Alice invites Charlie
        //   5. Charlie can't see the message.

        await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);
        await createRoom(alicePage, "TestRoom", true);

        // Register a second user, and open it in a second instance of the app
        const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "Bob");
        const bobPage = await createNewInstance(browser, bobCredentials, {}, labsFlags);
        const bobElementApp = new ElementAppPage(bobPage);
        await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

        // ... and a third
        const charlieCredentials = await homeserver.registerUser(
            `user_${testInfo.testId}_charlie`,
            "password",
            "Charlie",
        );
        const charliePage = await createNewInstance(browser, charlieCredentials, {}, labsFlags);
        const charlieElementApp = new ElementAppPage(charliePage);
        await charlieElementApp.client.bootstrapCrossSigning(charlieCredentials);

        // Alice invites Bob, and Bob accepts
        const roomId = await aliceElementApp.getCurrentRoomIdFromUrl();
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);
        await bobPage.getByRole("option", { name: "TestRoom" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Bob sends a message with "shared" visibility
        await sendMessageInCurrentRoom(bobPage, "Message1: 'shared' visibility");
        await expect(alicePage.getByText("Message1")).toBeVisible();

        // Alice sets the history visibility to "joined"
        await aliceElementApp.client.sendStateEvent(roomId, "m.room.history_visibility", {
            history_visibility: "joined",
        });
        await expect(
            bobPage.getByText(
                "Alice made future room history visible to all room members, from the point they joined.",
            ),
        ).toBeVisible();

        // Bob stops syncing, and sends a message with "joined" visibility.
        // (Stopping syncing *before* sending the message means that the active sync will be flushed by sending the
        // message, so that Alice's change to the history viz below won't be seen by Bob.)
        await bobPage.route(`**/sync*`, (route) => route.fulfill({}));
        await sendMessageInCurrentRoom(bobPage, "Message2: 'joined' visibility");
        await expect(alicePage.getByText("Message2")).toBeVisible();

        // Alice changes the history viz, but Bob doesn't receive the memo
        await aliceElementApp.client.sendStateEvent(roomId, "m.room.history_visibility", {
            history_visibility: "shared",
        });
        await sendMessageInCurrentRoom(bobPage, "Message3: 'shared' visibility, but Bob thinks it is still 'joined'");

        // Alice now invites Charlie
        await aliceElementApp.inviteUserToCurrentRoom(charlieCredentials.userId);
        await charliePage.getByRole("option", { name: "TestRoom" }).click();
        await charliePage.getByRole("button", { name: "Accept" }).click();

        // Message1 should be visible
        // Message2 should be invisible
        // Message3 should be undecryptable
        await expect(charliePage.getByText("Message1")).toBeVisible();
        await expect(charliePage.getByText("You don't have access to this message")).toBeVisible();
    });
});
