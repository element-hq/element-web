/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";

test.describe("Landmark navigation tests", () => {
    test.use({
        displayName: "Alice",
    });

    test("without any rooms", async ({ page, homeserver, app, user }) => {
        /**
         * Without any rooms, there is no tile in the roomlist to be focused.
         * So the next landmark in the list should be focused instead.
         */

        // Pressing Control+F6 will first focus the space button
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();

        // Pressing Control+F6 again will focus room search
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_RoomSearch")).toBeFocused();

        // Pressing Control+F6 again will focus the message composer
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_HomePage")).toBeFocused();

        // Pressing Control+F6 again will bring focus back to the space button
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();

        // Now go back in the same order
        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_HomePage")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_RoomSearch")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();
    });

    test("with an open room", async ({ page, homeserver, app, user }) => {
        const bob = new Bot(page, homeserver, { displayName: "Bob" });
        await bob.prepareClient();

        // create dm with bob
        await app.client.evaluate(
            async (cli, { bob }) => {
                const bobRoom = await cli.createRoom({ is_direct: true });
                await cli.invite(bobRoom.room_id, bob);
            },
            {
                bob: bob.credentials.userId,
            },
        );

        await app.viewRoomByName("Bob");
        // confirm the room was loaded
        await expect(page.getByText("Bob joined the room")).toBeVisible();

        // Pressing Control+F6 will first focus the space button
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();

        // Pressing Control+F6 again will focus room search
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_RoomSearch")).toBeFocused();

        // Pressing Control+F6 again will focus the room tile in the room list
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_RoomTile_selected")).toBeFocused();

        // Pressing Control+F6 again will focus the message composer
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_BasicMessageComposer_input")).toBeFocused();

        // Pressing Control+F6 again will bring focus back to the space button
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();

        // Now go back in the same order
        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_BasicMessageComposer_input")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_RoomTile_selected")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_RoomSearch")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();
    });

    test("without an open room", async ({ page, homeserver, app, user }) => {
        const bob = new Bot(page, homeserver, { displayName: "Bob" });
        await bob.prepareClient();

        // create a dm with bob
        await app.client.evaluate(
            async (cli, { bob }) => {
                const bobRoom = await cli.createRoom({ is_direct: true });
                await cli.invite(bobRoom.room_id, bob);
            },
            {
                bob: bob.credentials.userId,
            },
        );

        await app.viewRoomByName("Bob");
        // confirm the room was loaded
        await expect(page.getByText("Bob joined the room")).toBeVisible();

        // Close the room
        page.goto("/#/home");

        // Pressing Control+F6 will first focus the space button
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();

        // Pressing Control+F6 again will focus room search
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_RoomSearch")).toBeFocused();

        // Pressing Control+F6 again will focus the room tile in the room list
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_RoomTile")).toBeFocused();

        // Pressing Control+F6 again will focus the home section
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_HomePage")).toBeFocused();

        // Pressing Control+F6 will bring focus back to the space button
        await page.keyboard.press("ControlOrMeta+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();

        // Now go back in same order
        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_HomePage")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_RoomTile")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_RoomSearch")).toBeFocused();

        await page.keyboard.press("ControlOrMeta+Shift+F6");
        await expect(page.locator(".mx_SpaceButton_active")).toBeFocused();
    });
});
