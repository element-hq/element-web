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
});
