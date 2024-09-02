/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test } from "./index";
import { expect } from "../../element-web-test";

test.describe("Pinned messages", () => {
    test.use({
        labsFlags: ["feature_pinning"],
    });

    test("should show the empty state when there are no pinned messages", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.openRoomInfo();
        await util.assertPinnedCountInRoomInfo(0);
        await util.openPinnedMessagesList();
        await util.assertEmptyPinnedMessagesList();
    });

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
        await expect(util.getRightPanel()).toMatchScreenshot(`pinned-messages-list-pin-3.png`);
    });

    test("should unpin one message", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1", "Msg2", "Msg3", "Msg4"]);
        await util.pinMessages(["Msg1", "Msg2", "Msg4"]);

        await util.openRoomInfo();
        await util.openPinnedMessagesList();
        await util.unpinMessageFromMessageList("Msg2");
        await util.assertPinnedMessagesList(["Msg1", "Msg4"]);
        await expect(util.getRightPanel()).toMatchScreenshot(`pinned-messages-list-unpin-2.png`);
        await util.backPinnedMessagesList();
        await util.assertPinnedCountInRoomInfo(2);
    });

    test("should unpin all messages", async ({ page, app, room1, util }) => {
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

    test("should display one message in the banner", async ({ page, app, room1, util }) => {
        await util.goTo(room1);
        await util.receiveMessages(room1, ["Msg1"]);
        await util.pinMessages(["Msg1"]);
        await util.assertMessageInBanner("Msg1");
        await expect(util.getBanner()).toMatchScreenshot("pinned-message-banner-1-Msg1.png");
    });

    test("should display 2 messages in the banner", async ({ page, app, room1, util }) => {
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

    test("should display 4 messages in the banner", async ({ page, app, room1, util }) => {
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
        await expect(util.getRightPanel()).toMatchScreenshot("pinned-message-banner-2.png");

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
