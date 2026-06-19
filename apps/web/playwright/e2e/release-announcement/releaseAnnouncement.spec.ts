/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { rejectToast } from "@element-hq/element-web-playwright-common";

import { test } from "./";

test.describe("Release announcement", () => {
    test.use({
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({
                name: "Test room",
            });
            await app.viewRoomById(roomId);
            await use({ roomId });
        },
        labsFlags: ["feature_room_list_sections"],
    });

    test.beforeEach(async ({ page, app, user }) => {
        // The toasts are displayed above the search section
        await rejectToast(page, "Verify this device");
        await rejectToast(page, "Notifications");
    });

    // There is no release announcement currently live
    test(
        "should display the room list section release announcement",
        { tag: "@screenshot" },
        async ({ page, app, room, util }) => {
            const sectionName = "Introducing Sections";
            // The section release announcement should be displayed
            await util.assertReleaseAnnouncementIsVisible(sectionName);
            // Hide the section release announcement
            const dialog = util.getReleaseAnnouncement(sectionName);
            await dialog.getByRole("button", { name: "Ok" }).click();

            await util.assertReleaseAnnouncementIsNotVisible(sectionName);

            await page.reload();
            await util.assertReleaseAnnouncementIsNotVisible(sectionName);
        },
    );
});
