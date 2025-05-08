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
    });

    test(
        "should display the pinned messages release announcement",
        { tag: "@screenshot" },
        async ({ page, app, room, util }) => {
            await app.toggleRoomInfoPanel();

            const name = "All new pinned messages";

            // The release announcement should be displayed
            await util.assertReleaseAnnouncementIsVisible(name);
            // Hide the release announcement
            await util.markReleaseAnnouncementAsRead(name);
            await util.assertReleaseAnnouncementIsNotVisible(name);

            await page.reload();
            await app.toggleRoomInfoPanel();
            await expect(page.getByRole("menuitem", { name: "Pinned messages" })).toBeVisible();
            // Check that once the release announcement has been marked as viewed, it does not appear again
            await util.assertReleaseAnnouncementIsNotVisible(name);
        },
    );
});
