/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "./";

test.describe("Release announcement", () => {
    test.use({
        config: {
            features: {
                feature_release_announcement: true,
            },
        },
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({
                name: "Test room",
            });
            await app.viewRoomById(roomId);
            await use({ roomId });
        },
        labsFlags: ["feature_new_room_list"],
    });

    test(
        "should display the new room list release announcement",
        { tag: "@screenshot" },
        async ({ page, app, room, util }) => {
            // dismiss the toast so the announcement appears
            await page.getByRole("button", { name: "Dismiss" }).click();

            const name = "Chats has a new look!";

            // The release announcement should be displayed
            await util.assertReleaseAnnouncementIsVisible(name);
            // Hide the release announcement
            const dialog = util.getReleaseAnnouncement(name);
            await dialog.getByRole("button", { name: "Next" }).click();

            await util.assertReleaseAnnouncementIsNotVisible(name);

            await page.reload();
            await expect(page.getByRole("button", { name: "Room options" })).toBeVisible();
            // Check that once the release announcement has been marked as viewed, it does not appear again
            await util.assertReleaseAnnouncementIsNotVisible(name);
        },
    );
});
