/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test } from "./index";
import { expect } from "../../element-web-test";

test.describe("Pinned messages", () => {
    test(
        "should show the empty state when there are no pinned messages",
        { tag: "@screenshot" },
        async ({ page, app, room1, util }) => {
            await util.goTo(room1);
            await util.openRoomInfo();
            await util.assertPinnedCountInRoomInfo(0);
            await util.openPinnedMessagesList();
            await util.assertEmptyPinnedMessagesList();
        },
    );

    test(
        "should pin one message and to have the pinned message badge in the timeline",
        { tag: "@screenshot" },
        async ({ page, app, room1, util }) => {
            await util.goTo(room1);
            await util.receiveMessages(room1, ["Msg1"]);
            await util.pinMessages(["Msg1"]);

            const tile = util.getEventTile("Msg1");
            await expect(tile).toMatchScreenshot("pinned-message-Msg1.png", {
                mask: [tile.locator(".mx_MessageTimestamp")],
                // Hide the jump to bottom button in the timeline to avoid flakiness
                css: `
                    .mx_JumpToBottomButton {
                        display: none !important;
                    }
                `,
            });
        },
    );

    test("should pin messages and show them in the room info panel", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);

        await util.pinMessages(["Msg1", "Msg2", "Msg4"]);
        await util.openRoomInfo();
        await util.assertPinnedCountInRoomInfo(3);
    });

    test("should pin messages and show them in the pinned message panel", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);

        // Pin the messages
        await util.pinMessages(["Msg1", "Msg2", "Msg4"]);
        await util.openRoomInfo();
        await util.openPinnedMessagesList();
        await util.assertPinnedMessagesList(["Msg1", "Msg2", "Msg4"]);
    });

    test("should unpin one message", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);
        await util.pinMessages(["Msg1", "Msg2", "Msg4"]);

        await util.openRoomInfo();
        await util.openPinnedMessagesList();
        await util.unpinMessageFromMessageList("Msg2");
        await util.assertPinnedMessagesList(["Msg1", "Msg4"]);
        await util.backPinnedMessagesList();
        await util.assertPinnedCountInRoomInfo(2);
    });

    test("should unpin all messages", { tag: "@screenshot" }, async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);
        await util.pinMessages(["Msg1", "Msg2", "Msg4"]);

        await util.openUnpinAllDialog();
        await expect(util.getUnpinAllDialog()).toMatchScreenshot("unpin-all-dialog.png");
        await util.confirmUnpinAllDialog();

        await util.assertEmptyPinnedMessagesList();
        await util.backPinnedMessagesList();
        await util.assertPinnedCountInRoomInfo(0);
    });

    test("should be able to pin and unpin from the quick actions", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);
        await util.pinMessagesFromQuickActions(["Msg1"]);
        await util.openRoomInfo();
        await util.assertPinnedCountInRoomInfo(1);

        await util.pinMessagesFromQuickActions(["Msg1"], true);
        await util.assertPinnedCountInRoomInfo(0);
    });

    test("should display one message in the banner", { tag: "@screenshot" }, async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1"]);
        await util.pinMessages(["Msg1"]);
        await util.assertMessageInBanner("Msg1");
        await expect(util.getBanner()).toMatchScreenshot("pinned-message-banner-1-Msg1.png");
    });

    test("should display 2 messages in the banner", { tag: "@screenshot" }, async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2"]);
        await util.pinMessages(["Msg1", "Msg2"]);

        await util.assertMessageInBanner("Msg2");
        await expect(util.getBanner()).toMatchScreenshot("pinned-message-banner-2-Msg2.png");

        await util.getBanner().click();
        await util.assertMessageInBanner("Msg1");
        await expect(util.getBanner()).toMatchScreenshot("pinned-message-banner-2-Msg1.png");

        await util.getBanner().click();
        await util.assertMessageInBanner("Msg2");
        await expect(util.getBanner()).toMatchScreenshot("pinned-message-banner-2-Msg2.png");
    });

    test("should display 4 messages in the banner", { tag: "@screenshot" }, async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);
        await util.pinMessages(["Msg1", "Msg2", "Msg3", "Msg4"]);

        for (const msg of ["Msg4", "Msg3", "Msg2", "Msg1"]) {
            await util.assertMessageInBanner(msg);
            await expect(util.getBanner()).toMatchScreenshot(`pinned-message-banner-4-${msg}.png`);
            await util.getBanner().click();
        }
    });

    test("should open the pinned messages list from the banner", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2"]);
        await util.pinMessages(["Msg1", "Msg2"]);

        await util.getViewAllButton().click();
        await util.assertPinnedMessagesList(["Msg1", "Msg2"]);

        await expect(util.getCloseListButton()).toBeVisible();
    });

    test("banner should listen to pinned message list", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2"]);
        await util.pinMessages(["Msg1", "Msg2"]);

        await expect(util.getViewAllButton()).toBeVisible();

        await util.openRoomInfo();
        await util.openPinnedMessagesList();
        await expect(util.getCloseListButton()).toBeVisible();
    });
});
