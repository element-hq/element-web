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
});
