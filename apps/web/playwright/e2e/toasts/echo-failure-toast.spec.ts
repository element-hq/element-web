/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { closeReleaseAnnouncementIfExists, rejectToast } from "@element-hq/element-web-playwright-common";

import { test, expect } from "../../element-web-test";
import { getRoomList } from "../left-panel/room-list-panel/utils";

test.describe("Server not responding toast", () => {
    test.use({
        displayName: "Alice",
    });

    test("lines the offline icon up with the text", async ({ page, app, user }) => {
        await rejectToast(page, "Verify this device");
        await rejectToast(page, "Notifications");
        await closeReleaseAnnouncementIfExists(page, "Introducing Sections");

        await app.client.createRoom({ name: "Test room" });
        const roomItem = getRoomList(page).getByRole("option", { name: "Open room Test room" });
        await expect(roomItem).toBeVisible();

        // Muting the room adds a push rule; failing that request shows the toast
        await page.route("**/_matrix/client/*/pushrules/global/override/**", (route) =>
            route.fulfill({ status: 500, json: { errcode: "M_UNKNOWN", error: "Internal server error" } }),
        );
        await roomItem.hover();
        await roomItem.getByRole("button", { name: "Notification options" }).click();
        await page.getByRole("menuitem", { name: "Mute room" }).click();

        const toast = page.getByRole("alert").filter({ hasText: "Your server isn't responding to some requests." });
        await expect(toast).toBeVisible();

        const icon = (await toast.locator("svg").boundingBox())!;
        const text = (await toast.getByText("Your server isn't responding to some").boundingBox())!;
        expect(Math.abs(icon.y + icon.height / 2 - (text.y + text.height / 2))).toBeLessThan(1);
    });
});
