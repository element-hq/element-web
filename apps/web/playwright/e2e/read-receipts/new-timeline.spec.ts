/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test } from ".";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.skip(isDendrite, "due to Dendrite bug https://github.com/element-hq/dendrite/issues/2970");

    test.describe("in the new timeline", () => {
        test.use({ labsFlags: ["feature_new_timeline"] });

        test("Reading latest message makes the room read", async ({ roomAlpha: room1, roomBeta: room2, util }) => {
            // Given I have an unread message in a room short enough to fit on screen
            await util.goTo(room1);
            await util.assertRead(room2);
            await util.receiveMessages(room2, ["Msg1"]);
            await util.assertUnread(room2, 1);

            // When I open it
            await util.goTo(room2);

            // Then the room becomes read
            await util.assertRead(room2);
        });
    });
});
