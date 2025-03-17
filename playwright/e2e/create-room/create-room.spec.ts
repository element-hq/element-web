/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Create Room", () => {
    test.use({ displayName: "Jim" });

    test("should allow us to create a public room with name, topic & address set", async ({ page, user, app }) => {
        const name = "Test room 1";
        const topic = "This room is dedicated to this test and this test only!";

        const dialog = await app.openCreateRoomDialog();
        // Fill name & topic
        await dialog.getByRole("textbox", { name: "Name" }).fill(name);
        await dialog.getByRole("textbox", { name: "Topic" }).fill(topic);
        // Change room to public
        await dialog.getByRole("button", { name: "Room visibility" }).click();
        await dialog.getByRole("option", { name: "Public room" }).click();
        // Fill room address
        await dialog.getByRole("textbox", { name: "Room address" }).fill("test-room-1");
        // Submit
        await dialog.getByRole("button", { name: "Create room" }).click();

        await expect(page).toHaveURL(new RegExp(`/#/room/#test-room-1:${user.homeServer}`));
        const header = page.locator(".mx_RoomHeader");
        await expect(header).toContainText(name);
    });
});
