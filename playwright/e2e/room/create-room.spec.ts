/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SettingLevel } from "../../../src/settings/SettingLevel";
import { test, expect } from "../../element-web-test";

const name = "Test room";
const topic = "A decently explanatory topic for a test room.";

test.describe("Create Room", () => {
    test.use({ displayName: "Jim" });

    test(
        "should create a public room with name, topic & address set",
        { tag: "@screenshot" },
        async ({ page, user, app }) => {
            const dialog = await app.openCreateRoomDialog();
            // Fill name & topic
            await dialog.getByRole("textbox", { name: "Name" }).fill(name);
            await dialog.getByRole("textbox", { name: "Topic" }).fill(topic);
            // Change room to public
            await dialog.getByRole("button", { name: "Room visibility" }).click();
            await dialog.getByRole("option", { name: "Public room" }).click();
            // Fill room address
            await dialog.getByRole("textbox", { name: "Room address" }).fill("test-create-room-standard");
            // Snapshot it
            await expect(dialog).toMatchScreenshot("create-room.png");

            // Submit
            await dialog.getByRole("button", { name: "Create room" }).click();

            await expect(page).toHaveURL(new RegExp(`/#/room/#test-create-room-standard:${user.homeServer}`));
            const header = page.locator(".mx_RoomHeader");
            await expect(header).toContainText(name);
        },
    );

    test("should create a video room", { tag: "@screenshot" }, async ({ page, user, app }) => {
        await app.settings.setValue("feature_video_rooms", null, SettingLevel.DEVICE, true);

        const dialog = await app.openCreateRoomDialog("New video room");
        // Fill name & topic
        await dialog.getByRole("textbox", { name: "Name" }).fill(name);
        await dialog.getByRole("textbox", { name: "Topic" }).fill(topic);
        // Change room to public
        await dialog.getByRole("button", { name: "Room visibility" }).click();
        await dialog.getByRole("option", { name: "Public room" }).click();
        // Fill room address
        await dialog.getByRole("textbox", { name: "Room address" }).fill("test-create-room-video");
        // Snapshot it
        await expect(dialog).toMatchScreenshot("create-video-room.png");

        // Submit
        await dialog.getByRole("button", { name: "Create video room" }).click();

        await expect(page).toHaveURL(new RegExp(`/#/room/#test-create-room-video:${user.homeServer}`));
        const header = page.locator(".mx_RoomHeader");
        await expect(header).toContainText(name);
    });
});
