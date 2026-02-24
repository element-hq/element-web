/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

const ROOM_NAME = "Test room";
const NAME = "Alice";

test.describe("NotificationPanel", () => {
    test.use({
        displayName: NAME,
        labsFlags: ["feature_notifications"],
    });

    test.beforeEach(async ({ app, user }) => {
        await app.client.createRoom({ name: ROOM_NAME });
    });

    test("should render empty state", { tag: "@screenshot" }, async ({ page, app }) => {
        await app.viewRoomByName(ROOM_NAME);

        await page.getByRole("button", { name: "Notifications" }).click();

        // Wait until the information about the empty state is rendered
        await expect(page.locator(".mx_EmptyState")).toBeVisible();

        // Take a snapshot of RightPanel
        await expect(page.locator(".mx_RightPanel")).toMatchScreenshot("empty.png");
    });
});
