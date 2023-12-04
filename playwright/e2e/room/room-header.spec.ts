/*
Copyright 2023 Suguru Hirahara

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { ElementAppPage } from "../../pages/ElementAppPage";

test.describe("Room Header", () => {
    test.use({
        displayName: "Sakura",
    });

    test.describe("with feature_notifications enabled", () => {
        test.beforeEach(async ({ app }) => {
            await app.labs.enableLabsFeature("feature_notifications");
        });

        test("should render default buttons properly", async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test Room" });
            await app.viewRoomByName("Test Room");

            const header = page.locator(".mx_LegacyRoomHeader");
            // Names (aria-label) of every button rendered on mx_LegacyRoomHeader by default
            const expectedButtonNames = [
                "Room options", // The room name button next to the room avatar, which renders dropdown menu on click
                "Voice call",
                "Video call",
                "Search",
                "Threads",
                "Notifications",
                "Room info",
            ];

            // Assert they are found and visible
            for (const name of expectedButtonNames) {
                await expect(header.getByRole("button", { name })).toBeVisible();
            }

            // Assert that just those seven buttons exist on mx_LegacyRoomHeader by default
            await expect(header.getByRole("button")).toHaveCount(7);

            await expect(header).toMatchScreenshot("room-header.png");
        });

        test("should render a very long room name without collapsing the buttons", async ({ page, app, user }) => {
            const LONG_ROOM_NAME =
                "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore " +
                "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
                "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " +
                "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui " +
                "officia deserunt mollit anim id est laborum.";

            await app.client.createRoom({ name: LONG_ROOM_NAME });
            await app.viewRoomByName(LONG_ROOM_NAME);

            const header = page.locator(".mx_LegacyRoomHeader");
            // Wait until the room name is set
            await expect(page.locator(".mx_LegacyRoomHeader_nametext").getByText(LONG_ROOM_NAME)).toBeVisible();

            // Assert the size of buttons on RoomHeader are specified and the buttons are not compressed
            // Note these assertions do not check the size of mx_LegacyRoomHeader_name button
            const buttons = page.locator(".mx_LegacyRoomHeader_button");
            await expect(buttons).toHaveCount(6);
            for (const button of await buttons.all()) {
                await expect(button).toBeVisible();
                await expect(button).toHaveCSS("height", "32px");
                await expect(button).toHaveCSS("width", "32px");
            }

            await expect(header).toMatchScreenshot("room-header-long-name.png");
        });

        test("should have buttons highlighted by being clicked", async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test Room" });
            await app.viewRoomByName("Test Room");

            const header = page.locator(".mx_LegacyRoomHeader");
            // Check these buttons
            const buttonsHighlighted = ["Threads", "Notifications", "Room info"];

            for (const name of buttonsHighlighted) {
                await header.getByRole("button", { name: name }).click(); // Highlight the button
            }

            await expect(header).toMatchScreenshot("room-header-highlighted.png");
        });
    });

    test.describe("with feature_pinning enabled", () => {
        test.beforeEach(async ({ app }) => {
            await app.labs.enableLabsFeature("feature_pinning");
        });

        test("should render the pin button for pinned messages card", async ({ page, app, user }) => {
            await app.client.createRoom({ name: "Test Room" });
            await app.viewRoomByName("Test Room");

            const composer = app.getComposer().locator("[contenteditable]");
            await composer.fill("Test message");
            await composer.press("Enter");

            const lastTile = page.locator(".mx_EventTile_last");
            await lastTile.hover();
            await lastTile.getByRole("button", { name: "Options" }).click();

            await page.getByRole("menuitem", { name: "Pin" }).click();

            await expect(
                page.locator(".mx_LegacyRoomHeader").getByRole("button", { name: "Pinned messages" }),
            ).toBeVisible();
        });
    });

    test.describe("with a video room", () => {
        test.beforeEach(async ({ app }) => {
            await app.labs.enableLabsFeature("feature_video_rooms");
        });

        const createVideoRoom = async (page: Page, app: ElementAppPage) => {
            await page.locator(".mx_LeftPanel_roomListContainer").getByRole("button", { name: "Add room" }).click();

            await page.getByRole("menuitem", { name: "New video room" }).click();

            await page.getByRole("textbox", { name: "Name" }).type("Test video room");

            await page.getByRole("button", { name: "Create video room" }).click();

            await app.viewRoomByName("Test video room");
        };

        test("should render buttons for room options, beta pill, invite, chat, and room info", async ({
            page,
            app,
            user,
        }) => {
            await app.labs.enableLabsFeature("feature_notifications");
            await createVideoRoom(page, app);

            const header = page.locator(".mx_LegacyRoomHeader");
            // Names (aria-label) of the buttons on the video room header
            const expectedButtonNames = [
                "Room options",
                "Video rooms are a beta feature Click for more info", // Beta pill
                "Invite",
                "Chat",
                "Room info",
            ];

            // Assert they are found and visible
            for (const name of expectedButtonNames) {
                await expect(header.getByRole("button", { name })).toBeVisible();
            }

            // Assert that there is not a button except those buttons
            await expect(header.getByRole("button")).toHaveCount(7);

            await expect(header).toMatchScreenshot("room-header-video-room.png");
        });

        test("should render a working chat button which opens the timeline on a right panel", async ({
            page,
            app,
            user,
        }) => {
            await createVideoRoom(page, app);

            await page.locator(".mx_LegacyRoomHeader").getByRole("button", { name: "Chat" }).click();

            // Assert that the video is rendered
            await expect(page.locator(".mx_CallView video")).toBeVisible();

            // Assert that GELS is visible
            await expect(
                page.locator(".mx_RightPanel .mx_TimelineCard").getByText("Sakura created and configured the room."),
            ).toBeVisible();
        });
    });

    test.describe("with a widget", () => {
        const ROOM_NAME = "Test Room with a widget";
        const WIDGET_ID = "fake-widget";
        const WIDGET_HTML = `
            <html lang="en">
                <head>
                    <title>Fake Widget</title>
                </head>
                <body>
                    Hello World
                </body>
            </html>
        `;

        test.beforeEach(async ({ page, app, user, webserver }) => {
            const widgetUrl = webserver.start(WIDGET_HTML);
            const roomId = await app.client.createRoom({ name: ROOM_NAME });

            // setup widget via state event
            await app.client.evaluate(
                async (matrixClient, { roomId, widgetUrl, id }) => {
                    await matrixClient.sendStateEvent(
                        roomId,
                        "im.vector.modular.widgets",
                        {
                            id,
                            creatorUserId: "somebody",
                            type: "widget",
                            name: "widget",
                            url: widgetUrl,
                        },
                        id,
                    );
                    await matrixClient.sendStateEvent(
                        roomId,
                        "io.element.widgets.layout",
                        {
                            widgets: {
                                [id]: {
                                    container: "top",
                                    index: 1,
                                    width: 100,
                                    height: 0,
                                },
                            },
                        },
                        "",
                    );
                },
                {
                    roomId,
                    widgetUrl,
                    id: WIDGET_ID,
                },
            );

            // open the room
            await app.viewRoomByName(ROOM_NAME);
        });

        test("should highlight the apps button", async ({ page, app, user }) => {
            // Assert that AppsDrawer is rendered
            await expect(page.locator(".mx_AppsDrawer")).toBeVisible();

            const header = page.locator(".mx_LegacyRoomHeader");
            // Assert that "Hide Widgets" button is rendered and aria-checked is set to true
            await expect(header.getByRole("button", { name: "Hide Widgets" })).toHaveAttribute("aria-checked", "true");

            await expect(header).toMatchScreenshot("room-header-with-apps-button-highlighted.png");
        });

        test("should support hiding a widget", async ({ page, app, user }) => {
            await expect(page.locator(".mx_AppsDrawer")).toBeVisible();

            const header = page.locator(".mx_LegacyRoomHeader");
            // Click the apps button to hide AppsDrawer
            await header.getByRole("button", { name: "Hide Widgets" }).click();

            // Assert that "Show widgets" button is rendered and aria-checked is set to false
            await expect(header.getByRole("button", { name: "Show Widgets" })).toHaveAttribute("aria-checked", "false");

            // Assert that AppsDrawer is not rendered
            await expect(page.locator(".mx_AppsDrawer")).not.toBeVisible();

            await expect(header).toMatchScreenshot("room-header-with-apps-button-not-highlighted.png");
        });
    });
});
