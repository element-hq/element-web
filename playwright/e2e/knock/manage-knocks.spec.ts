/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { waitForRoom } from "../utils";

test.describe("Manage Knocks", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_ask_to_join"],
        botCreateOpts: {
            displayName: "Bob",
        },
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({
                name: "Cybersecurity",
                initial_state: [
                    {
                        type: "m.room.join_rules",
                        content: {
                            join_rule: "knock",
                        },
                        state_key: "",
                    },
                ],
            });
            await app.viewRoomById(roomId);
            await use({ roomId });
        },
    });

    test("should approve knock using bar", async ({ page, bot, room }) => {
        await bot.knockRoom(room.roomId);

        const roomKnocksBar = page.locator(".mx_RoomKnocksBar");
        await expect(roomKnocksBar.getByRole("heading", { name: "Asking to join" })).toBeVisible();
        await expect(roomKnocksBar.getByText(/^Bob/)).toBeVisible();
        await roomKnocksBar.getByRole("button", { name: "Approve" }).click();

        await expect(roomKnocksBar).not.toBeVisible();

        await expect(page.getByText("Alice invited Bob")).toBeVisible();
    });

    test("should deny knock using bar", async ({ page, app, bot, room }) => {
        bot.knockRoom(room.roomId);

        const roomKnocksBar = page.locator(".mx_RoomKnocksBar");
        await expect(roomKnocksBar.getByRole("heading", { name: "Asking to join" })).toBeVisible();
        await expect(roomKnocksBar.getByText(/^Bob/)).toBeVisible();
        await roomKnocksBar.getByRole("button", { name: "Deny" }).click();

        await expect(roomKnocksBar).not.toBeVisible();

        // Should receive Bob's "m.room.member" with "leave" membership when access is denied
        await waitForRoom(page, app.client, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "leave" &&
                    e.getContent()?.displayname === "Bob",
            );
        });
    });

    test("should approve knock using people tab", async ({ page, app, bot, room }) => {
        await bot.knockRoom(room.roomId, { reason: "Hello, can I join?" });

        await app.settings.openRoomSettings("People");

        const settingsGroup = page.getByRole("group", { name: "Asking to join" });
        await expect(settingsGroup.getByText(/^Bob/)).toBeVisible();
        await expect(settingsGroup.getByText("Hello, can I join?")).toBeVisible();
        await settingsGroup.getByRole("button", { name: "Approve" }).click();
        await expect(settingsGroup.getByText(/^Bob/)).not.toBeVisible();

        await expect(page.getByText("Alice invited Bob")).toBeVisible();
    });

    test("should deny knock using people tab", async ({ page, app, bot, room }) => {
        await bot.knockRoom(room.roomId, { reason: "Hello, can I join?" });

        await app.settings.openRoomSettings("People");

        const settingsGroup = page.getByRole("group", { name: "Asking to join" });
        await expect(settingsGroup.getByText(/^Bob/)).toBeVisible();
        await expect(settingsGroup.getByText("Hello, can I join?")).toBeVisible();
        await settingsGroup.getByRole("button", { name: "Deny" }).click();
        await expect(settingsGroup.getByText(/^Bob/)).not.toBeVisible();

        // Should receive Bob's "m.room.member" with "leave" membership when access is denied
        await waitForRoom(page, app.client, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "leave" &&
                    e.getContent()?.displayname === "Bob",
            );
        });
    });
});
