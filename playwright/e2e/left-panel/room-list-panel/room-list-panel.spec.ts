/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

import { test, expect } from "../../../element-web-test";

test.describe("Room list panel", () => {
    test.use({
        labsFlags: ["feature_new_room_list"],
    });

    /**
     * Get the room list view
     * @param page
     */
    function getRoomListView(page: Page) {
        return page.getByTestId("room-list-panel");
    }

    test.beforeEach(async ({ page, app, user }) => {
        // The notification toast is displayed above the search section
        await app.closeNotificationToast();
    });

    test("should render the room list panel", { tag: "@screenshot" }, async ({ page, app, user }) => {
        const roomListView = getRoomListView(page);
        await expect(roomListView).toMatchScreenshot("room-list-panel.png");
    });
});
