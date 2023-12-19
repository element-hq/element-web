/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import type { EventType } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";

test.describe("Room Directory", () => {
    test.use({
        displayName: "Alice",
    });

    test("should switch between existing dm rooms without a loader", async ({ page, homeserver, app, user }) => {
        const bob = new Bot(page, homeserver, { displayName: "Bob" });
        await bob.prepareClient();
        const charlie = new Bot(page, homeserver, { displayName: "Charlie" });
        await charlie.prepareClient();

        // create dms with bob and charlie
        await app.client.evaluate(
            async (cli, { bob, charlie }) => {
                const bobRoom = await cli.createRoom({ is_direct: true });
                const charlieRoom = await cli.createRoom({ is_direct: true });
                await cli.invite(bobRoom.room_id, bob);
                await cli.invite(charlieRoom.room_id, charlie);
                await cli.setAccountData("m.direct" as EventType, {
                    [bob]: [bobRoom.room_id],
                    [charlie]: [charlieRoom.room_id],
                });
            },
            {
                bob: bob.credentials.userId,
                charlie: charlie.credentials.userId,
            },
        );

        await app.viewRoomByName("Bob");

        // short timeout because loader is only visible for short period
        // we want to make sure it is never displayed when switching these rooms
        await expect(page.locator(".mx_RoomPreviewBar_spinnerTitle")).not.toBeVisible({ timeout: 1 });
        // confirm the room was loaded
        await expect(page.getByText("Bob joined the room")).toBeVisible();

        await app.viewRoomByName("Charlie");
        await expect(page.locator(".mx_RoomPreviewBar_spinnerTitle")).not.toBeVisible({ timeout: 1 });
        // confirm the room was loaded
        await expect(page.getByText("Charlie joined the room")).toBeVisible();
    });

    test("should memorize the timeline position when switch Room A -> Room B -> Room A", async ({
        page,
        app,
        user,
    }) => {
        // Create the two rooms
        const roomAId = await app.client.createRoom({ name: "Room A" });
        const roomBId = await app.client.createRoom({ name: "Room B" });
        // Display Room A
        await app.viewRoomById(roomAId);

        // Send the first message and get the event ID
        const { event_id: eventId } = await app.client.sendMessage(roomAId, { body: "test0", msgtype: "m.text" });
        // Send 49 more messages
        for (let i = 1; i < 50; i++) {
            await app.client.sendMessage(roomAId, { body: `test${i}`, msgtype: "m.text" });
        }

        // Wait for all the messages to be displayed
        await expect(
            page.locator(".mx_EventTile_last .mx_MTextBody .mx_EventTile_body").getByText("test49"),
        ).toBeVisible();

        // Display the first message
        await page.goto(`/#/room/${roomAId}/${eventId}`);

        // Wait for the first message to be displayed
        await expect(page.locator(".mx_MTextBody .mx_EventTile_body").getByText("test0")).toBeInViewport();

        // Display Room B
        await app.viewRoomById(roomBId);
        // Display Room A
        await app.viewRoomById(roomAId);

        // The timeline should display the first message
        // The previous position before switching to Room B should be remembered
        await expect(page.locator(".mx_MTextBody .mx_EventTile_body").getByText("test0")).toBeInViewport();
    });
});
