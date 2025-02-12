/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Suguru Hirahara

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { type ElementAppPage } from "../../pages/ElementAppPage";

test.describe("Room Header", () => {
    test.use({
        displayName: "Sakura",
    });

    test.describe("with feature_notifications enabled", () => {
        test.use({
            labsFlags: ["feature_notifications"],
        });
        test("should render default buttons properly", { tag: "@screenshot" }, async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test Room" });
            await app.viewRoomByName("Test Room");

            const header = page.locator(".mx_RoomHeader");

            // There's two room info button - the header itself and the i button
            const infoButtons = header.getByRole("button", { name: "Room info" });
            await expect(infoButtons).toHaveCount(2);
            await expect(infoButtons.first()).toBeVisible();
            await expect(infoButtons.last()).toBeVisible();

            // Memberlist button
            await expect(header.locator(".mx_FacePile")).toBeVisible();

            // There should be both a voice and a video call button
            // but they'll be disabled
            const callButtons = header.getByRole("button", { name: "There's no one here to call" });
            await expect(callButtons).toHaveCount(2);
            await expect(callButtons.first()).toBeVisible();
            await expect(callButtons.last()).toBeVisible();

            await expect(header.getByRole("button", { name: "Threads" })).toBeVisible();
            await expect(header.getByRole("button", { name: "Notifications" })).toBeVisible();

            // Assert that there are eight buttons in total
            await expect(header.getByRole("button")).toHaveCount(8);

            await expect(header).toMatchScreenshot("room-header.png");
        });

        test(
            "should render a very long room name without collapsing the buttons",
            { tag: "@screenshot" },
            async ({ page, app, user }) => {
                const LONG_ROOM_NAME =
                    "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore " +
                    "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
                    "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " +
                    "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui " +
                    "officia deserunt mollit anim id est laborum.";

                await app.client.createRoom({ name: LONG_ROOM_NAME });
                await app.viewRoomByName(LONG_ROOM_NAME);

                const header = page.locator(".mx_RoomHeader");
                // Wait until the room name is set
                await expect(page.locator(".mx_RoomHeader_heading").getByText(LONG_ROOM_NAME)).toBeVisible();

                // Assert the size of buttons on RoomHeader are specified and the buttons are not compressed
                // Note these assertions do not check the size of mx_LegacyRoomHeader_name button
                const buttons = header.getByRole("button").filter({
                    has: page.locator("svg"),
                });
                await expect(buttons).toHaveCount(5);

                for (const button of await buttons.all()) {
                    await expect(button).toBeVisible();
                    await expect(button).toHaveCSS("height", "32px");
                    await expect(button).toHaveCSS("width", "32px");
                }

                await expect(header).toMatchScreenshot("room-header-long-name.png");
            },
        );
    });

    test.describe("with a video room", () => {
        test.use({ labsFlags: ["feature_video_rooms"] });

        const createVideoRoom = async (page: Page, app: ElementAppPage) => {
            await page.locator(".mx_LeftPanel_roomListContainer").getByRole("button", { name: "Add room" }).click();

            await page.getByRole("menuitem", { name: "New video room" }).click();

            await page.getByRole("textbox", { name: "Name" }).type("Test video room");

            await page.getByRole("button", { name: "Create video room" }).click();

            await app.viewRoomByName("Test video room");
        };

        test.describe("and with feature_notifications enabled", () => {
            test.use({ labsFlags: ["feature_video_rooms", "feature_notifications"] });

            test(
                "should render buttons for chat, room info, threads and facepile",
                { tag: "@screenshot" },
                async ({ page, app, user }) => {
                    await createVideoRoom(page, app);

                    // Dismiss a toast that is otherwise in the way (it's the other
                    // side but there's no need to have it in the screenshot)
                    await page.getByRole("button", { name: "Later" }).click();

                    const header = page.locator(".mx_RoomHeader");

                    // There's two room info button - the header itself and the i button
                    const infoButtons = header.getByRole("button", { name: "Room info" });
                    await expect(infoButtons).toHaveCount(2);
                    await expect(infoButtons.first()).toBeVisible();
                    await expect(infoButtons.last()).toBeVisible();

                    // Facepile
                    await expect(header.locator(".mx_FacePile")).toBeVisible();

                    // Chat, Threads and Notification buttons
                    await expect(header.getByRole("button", { name: "Chat" })).toBeVisible();
                    await expect(header.getByRole("button", { name: "Threads" })).toBeVisible();
                    await expect(header.getByRole("button", { name: "Notifications" })).toBeVisible();

                    // Assert that there is not a button except those buttons
                    await expect(header.getByRole("button")).toHaveCount(7);

                    await expect(header).toMatchScreenshot("room-header-video-room.png");
                },
            );
        });

        test("should render a working chat button which opens the timeline on a right panel", async ({
            page,
            app,
            user,
        }) => {
            await createVideoRoom(page, app);

            await page.locator(".mx_RoomHeader").getByRole("button", { name: "Chat" }).click();

            // Assert that the call view is still visible
            await expect(page.locator(".mx_CallView")).toBeVisible();

            // Assert that GELS is visible
            await expect(
                page.locator(".mx_RightPanel .mx_TimelineCard").getByText("Sakura created and configured the room."),
            ).toBeVisible();
        });
    });
});
