/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect, test } from ".";
import { CommandOrControl } from "../../utils";
import { isDendrite } from "../../../plugins/homeserver/dendrite";

test.describe("Threads Activity Centre", { tag: "@no-firefox" }, () => {
    test.skip(
        isDendrite,
        "due to Dendrite lacking full threads support https://github.com/element-hq/dendrite/issues/3283",
    );

    test.use({
        displayName: "Alice",
        botCreateOpts: { displayName: "Other User" },
        labsFlags: ["threadsActivityCentre"],
    });

    test(
        "should have the button correctly aligned and displayed in the space panel when expanded",
        { tag: "@screenshot" },
        async ({ util }) => {
            // Open the space panel
            await util.expandSpacePanel();
            // The buttons in the space panel should be aligned when expanded
            await expect(util.getSpacePanel()).toMatchScreenshot("tac-button-expanded.png");
        },
    );

    test("should not show indicator when there is no thread", { tag: "@screenshot" }, async ({ room1, util }) => {
        // No indicator should be shown
        await util.assertNoTacIndicator();

        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1"]);

        // A message in the main timeline should not affect the indicator
        await util.assertNoTacIndicator();
    });

    test("should show a notification indicator when there is a message in a thread", async ({ room1, util, msg }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);

        // The indicator should be shown
        await util.assertNotificationTac();
    });

    test("should show a highlight indicator when there is a mention in a thread", async ({
        room1,
        util,
        msg,
        user,
    }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, [
            "Msg1",
            msg.threadedOff("Msg1", {
                "body": "User",
                "format": "org.matrix.custom.html",
                "formatted_body": `<a href="https://matrix.to/#/${user.userId}">User</a>`,
                "m.mentions": {
                    user_ids: [user.userId],
                },
            }),
        ]);

        // The indicator should be shown
        await util.assertHighlightIndicator();
    });

    test(
        "should show the rooms with unread threads",
        { tag: "@screenshot" },
        async ({ room1, room2, util, msg, user }) => {
            await util.goTo(room2);
            await util.populateThreads(room1, room2, msg, user);
            // The indicator should be shown
            await util.assertHighlightIndicator();

            // Verify that we have the expected rooms in the TAC
            await util.openTac();
            await util.assertRoomsInTac([
                { room: room2.name, notificationLevel: "highlight" },
                { room: room1.name, notificationLevel: "notification" },
            ]);

            // Verify that we don't have a visual regression
            await expect(util.getTacPanel()).toMatchScreenshot("tac-panel-mix-unread.png");
        },
    );

    test("should update with a thread is read", { tag: "@screenshot" }, async ({ room1, room2, util, msg, user }) => {
        await util.goTo(room2);
        await util.populateThreads(room1, room2, msg, user);

        // Click on the first room in TAC
        await util.openTac();
        await util.clickRoomInTac(room2.name);

        // Verify that the thread panel is opened after a click on the room in the TAC
        await util.assertThreadPanelIsOpened();

        // Open a thread and mark it as read
        // The room 2 doesn't have a mention anymore in its unread, so the highest notification level is notification
        await util.openThread("Msg1");
        await util.assertNotificationTac();
        await util.openTac();
        await util.assertRoomsInTac([
            { room: room1.name, notificationLevel: "notification" },
            { room: room2.name, notificationLevel: "notification" },
        ]);
        await expect(util.getTacPanel()).toMatchScreenshot("tac-panel-notification-unread.png");
    });

    test("should order by recency after notification level", async ({ room1, room2, util, msg, user }) => {
        await util.goTo(room2);
        await util.populateThreads(room1, room2, msg, user, false);

        await util.openTac();
        await util.assertRoomsInTac([
            { room: room1.name, notificationLevel: "notification" },
            { room: room2.name, notificationLevel: "notification" },
        ]);
    });

    test("should block the Spotlight to open when the TAC is opened", async ({ util, page }) => {
        const toggleSpotlight = () => page.keyboard.press(`${CommandOrControl}+k`);

        // Sanity check
        // Open and close the spotlight
        await toggleSpotlight();
        await expect(page.locator(".mx_SpotlightDialog")).toBeVisible();
        await toggleSpotlight();

        await util.openTac();
        // The spotlight should not be opened
        await toggleSpotlight();
        await expect(page.locator(".mx_SpotlightDialog")).not.toBeVisible();
    });

    test("should have the correct hover state", { tag: "@screenshot" }, async ({ util, page }) => {
        await util.hoverTacButton();
        await expect(util.getSpacePanel()).toMatchScreenshot("tac-hovered.png");

        // Expand the space panel, hover the button and take a screenshot
        await util.expandSpacePanel();
        await util.hoverTacButton();
        await expect(util.getSpacePanel()).toMatchScreenshot("tac-hovered-expanded.png");
    });

    test("should mark all threads as read", { tag: "@screenshot" }, async ({ room1, room2, util, msg, page }) => {
        await util.receiveMessages(room1, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);

        await util.assertNotificationTac();

        await util.openTac();
        await util.clickRoomInTac(room1.name);

        await util.clickMarkAllThreadsRead();

        await util.assertNoTacIndicator();
    });

    test("should focus the thread tab when clicking an item in the TAC", async ({ room1, room2, util, msg }) => {
        await util.receiveMessages(room1, ["Msg1", msg.threadedOff("Msg1", "Resp1")]);

        await util.openTac();
        await util.clickRoomInTac(room1.name);

        await util.assertThreadPanelIsOpened();
    });
});
