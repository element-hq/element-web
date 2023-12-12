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

import type { Visibility } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";
import { waitForRoom } from "../utils";
import { Filter } from "../../pages/Spotlight";

test.describe("Knock Into Room", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_ask_to_join"],
        botCreateOpts: {
            displayName: "Bob",
        },
        room: async ({ bot }, use) => {
            const roomId = await bot.createRoom({
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
            await use({ roomId });
        },
    });

    test("should knock into the room then knock is approved and user joins the room then user is kicked and joins again", async ({
        page,
        app,
        user,
        bot,
        room,
    }) => {
        await app.viewRoomById(room.roomId);

        const roomPreviewBar = page.locator(".mx_RoomPreviewBar");
        await roomPreviewBar.getByRole("button", { name: "Join the discussion" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join?" })).toBeVisible();
        await expect(roomPreviewBar.getByRole("textbox")).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();

        await expect(roomPreviewBar.getByRole("heading", { name: "Request to join sent" })).toBeVisible();

        // Knocked room should appear in Rooms
        await expect(
            page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        // bot waits for knock request from Alice
        await waitForRoom(page, bot, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "knock" &&
                    e.getContent()?.displayname === "Alice",
            );
        });

        // bot invites Alice
        await bot.inviteUser(room.roomId, user.userId);

        await expect(
            page.getByRole("group", { name: "Invites" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

        await expect(
            page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        await expect(page.getByText("Alice joined the room")).toBeVisible();

        // bot kicks Alice
        await bot.kick(room.roomId, user.userId);

        await roomPreviewBar.getByRole("button", { name: "Re-join" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join Cybersecurity?" })).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();

        // bot waits for knock request from Alice
        await waitForRoom(page, bot, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "knock" &&
                    e.getContent()?.displayname === "Alice",
            );
        });

        // bot invites Alice
        await bot.inviteUser(room.roomId, user.userId);

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

        await expect(page.getByText("Alice was invited, joined, was removed, was invited, and joined")).toBeVisible();
    });

    test("should knock into the room then knock is approved and user joins the room then user is banned/unbanned and joins again", async ({
        page,
        app,
        user,
        bot,
        room,
    }) => {
        await app.viewRoomById(room.roomId);

        const roomPreviewBar = page.locator(".mx_RoomPreviewBar");
        await roomPreviewBar.getByRole("button", { name: "Join the discussion" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join?" })).toBeVisible();
        await expect(roomPreviewBar.getByRole("textbox")).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Request to join sent" })).toBeVisible();

        // Knocked room should appear in Rooms
        await expect(
            page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        // bot waits for knock request from Alice
        await waitForRoom(page, bot, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "knock" &&
                    e.getContent()?.displayname === "Alice",
            );
        });

        // bot invites Alice
        await bot.inviteUser(room.roomId, user.userId);

        await expect(
            page.getByRole("group", { name: "Invites" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

        await expect(
            page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        await expect(page.getByText("Alice joined the room")).toBeVisible();

        // bot bans Alice
        await bot.ban(room.roomId, user.userId);

        await expect(
            page.locator(".mx_RoomPreviewBar").getByText("You were banned from Cybersecurity by Bob"),
        ).toBeVisible();

        // bot unbans Alice
        await bot.unban(room.roomId, user.userId);

        await roomPreviewBar.getByRole("button", { name: "Re-join" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join Cybersecurity?" })).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();

        // bot waits for knock request from Alice
        await waitForRoom(page, bot, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "knock" &&
                    e.getContent()?.displayname === "Alice",
            );
        });

        // bot invites Alice
        await bot.inviteUser(room.roomId, user.userId);

        // Alice have to accept invitation in order to join the room.
        // It will be not needed when homeserver implements auto accept knock requests.
        await page.locator(".mx_RoomView").getByRole("button", { name: "Accept" }).click();

        await expect(
            page.getByText("Alice was invited, joined, was banned, was unbanned, was invited, and joined"),
        ).toBeVisible();
    });

    test("should knock into the room and knock is cancelled by user himself", async ({ page, app, bot, room }) => {
        await app.viewRoomById(room.roomId);

        const roomPreviewBar = page.locator(".mx_RoomPreviewBar");
        await roomPreviewBar.getByRole("button", { name: "Join the discussion" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join?" })).toBeVisible();
        await expect(roomPreviewBar.getByRole("textbox")).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Request to join sent" })).toBeVisible();

        // Knocked room should appear in Rooms
        page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity" });

        await roomPreviewBar.getByRole("button", { name: "Cancel request" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join Cybersecurity?" })).toBeVisible();
        await expect(roomPreviewBar.getByRole("button", { name: "Request access" })).toBeVisible();

        await expect(
            page.getByRole("group", { name: "Historical" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();
    });

    test("should knock into the room then knock is cancelled by another user and room is forgotten", async ({
        page,
        app,
        user,
        bot,
        room,
    }) => {
        await app.viewRoomById(room.roomId);

        const roomPreviewBar = page.locator(".mx_RoomPreviewBar");
        await roomPreviewBar.getByRole("button", { name: "Join the discussion" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join?" })).toBeVisible();
        await expect(roomPreviewBar.getByRole("textbox")).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Request to join sent" })).toBeVisible();

        // Knocked room should appear in Rooms
        await expect(
            page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity" }),
        ).toBeVisible();

        // bot waits for knock request from Alice
        await waitForRoom(page, bot, room.roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some(
                (e) =>
                    e.getType() === "m.room.member" &&
                    e.getContent()?.membership === "knock" &&
                    e.getContent()?.displayname === "Alice",
            );
        });

        // bot kicks Alice
        await bot.kick(room.roomId, user.userId);

        // Room should stay in Rooms and have red badge when knock is denied
        await expect(
            page.getByRole("group", { name: "Rooms" }).getByRole("treeitem", { name: "Cybersecurity", exact: true }),
        ).not.toBeVisible();
        await expect(
            page
                .getByRole("group", { name: "Rooms" })
                .getByRole("treeitem", { name: "Cybersecurity 1 unread mention." }),
        ).toBeVisible();

        await expect(roomPreviewBar.getByRole("heading", { name: "You have been denied access" })).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Forget this room" }).click();

        // Room should disappear from the list completely when forgotten
        // Should be enabled when issue is fixed: https://github.com/vector-im/element-web/issues/26195
        // await expect(page.getByRole("treeitem", { name: /Cybersecurity/ })).not.toBeVisible();
    });

    test("should knock into the public knock room via spotlight", async ({ page, app, bot, room }) => {
        await bot.setRoomDirectoryVisibility(room.roomId, "public" as Visibility);

        const spotlightDialog = await app.openSpotlight();
        await spotlightDialog.filter(Filter.PublicRooms);
        await expect(spotlightDialog.results.nth(0)).toContainText("Cybersecurity");
        await spotlightDialog.results.nth(0).click();

        const roomPreviewBar = page.locator(".mx_RoomPreviewBar");
        await expect(roomPreviewBar.getByRole("heading", { name: "Ask to join?" })).toBeVisible();
        await expect(roomPreviewBar.getByRole("textbox")).toBeVisible();
        await roomPreviewBar.getByRole("button", { name: "Request access" }).click();
        await expect(roomPreviewBar.getByRole("heading", { name: "Request to join sent" })).toBeVisible();
    });
});
