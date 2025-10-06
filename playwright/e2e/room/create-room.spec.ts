/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SettingLevel } from "../../../src/settings/SettingLevel";
import { UIFeature } from "../../../src/settings/UIFeature";
import { test, expect } from "../../element-web-test";

const name = "Test room";
const topic = "A decently explanatory topic for a test room.";

test.describe("Create Room", () => {
    test.use({ displayName: "Jim" });

    test(
        "should create a public room with name, topic & address set",
        { tag: "@screenshot" },
        async ({ page, user, app, axe }) => {
            const dialog = await app.openCreateRoomDialog();
            // Fill name & topic
            await dialog.getByRole("textbox", { name: "Name" }).fill(name);
            await dialog.getByRole("textbox", { name: "Topic" }).fill(topic);
            // Change room to public
            await dialog.getByRole("button", { name: "Room visibility" }).click();
            await dialog.getByRole("option", { name: "Public room" }).click();
            // Fill room address
            await dialog.getByRole("textbox", { name: "Room address" }).fill("test-create-room-standard");

            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            // Snapshot it
            await expect(dialog).toMatchScreenshot("create-room.png");

            // Submit
            await dialog.getByRole("button", { name: "Create room" }).click();

            await expect(page).toHaveURL(new RegExp(`/#/room/#test-create-room-standard:${user.homeServer}`));
            const header = page.locator(".mx_RoomHeader");
            await expect(header).toContainText(name);
        },
    );

    test("should allow us to start a chat and show encryption state", async ({ page, user, app }) => {
        await page.getByRole("button", { name: "Add", exact: true }).click();
        await page.getByRole("menuitem", { name: "Start chat" }).click();

        await page.getByTestId("invite-dialog-input").fill(user.userId);

        await page.getByRole("button", { name: "Go" }).click();

        await expect(page.getByText("Encryption enabled")).toBeVisible();
        await expect(page.getByText("Send your first message to")).toBeVisible();

        const composer = page.getByRole("region", { name: "Message composer" });
        await expect(composer.getByRole("textbox", { name: "Send a message…" })).toBeVisible();
    });

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

    test.describe("Should hide public room option if not allowed", () => {
        test.use({
            config: {
                setting_defaults: {
                    [UIFeature.AllowCreatingPublicRooms]: false,
                },
            },
        });

        test("should disallow creating public rooms", { tag: "@screenshot" }, async ({ page, user, app, axe }) => {
            const dialog = await app.openCreateRoomDialog();
            // Fill name & topic
            await dialog.getByRole("textbox", { name: "Name" }).fill(name);
            await dialog.getByRole("textbox", { name: "Topic" }).fill(topic);

            axe.disableRules("color-contrast"); // XXX: Inheriting colour contrast issues from room view.
            await expect(axe).toHaveNoViolations();
            // Snapshot it
            await expect(dialog).toMatchScreenshot("create-room-no-public.png");

            // Submit
            await dialog.getByRole("button", { name: "Create room" }).click();

            await expect(page).toHaveURL(new RegExp(`/#/room/!.+`));
            const header = page.locator(".mx_RoomHeader");
            await expect(header).toContainText(name);
        });
    });
});
