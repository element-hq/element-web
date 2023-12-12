/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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
import { Filter } from "../../pages/Spotlight";

test.describe("Create Knock Room", () => {
    test.use({
        displayName: "Alice",
        labsFlags: ["feature_ask_to_join"],
    });

    test("should create a knock room", async ({ page, app, user }) => {
        const dialog = await app.openCreateRoomDialog();
        await dialog.getByRole("textbox", { name: "Name" }).fill("Cybersecurity");
        await dialog.getByRole("button", { name: "Room visibility" }).click();
        await dialog.getByRole("option", { name: "Ask to join" }).click();
        await dialog.getByRole("button", { name: "Create room" }).click();

        await expect(page.locator(".mx_LegacyRoomHeader").getByText("Cybersecurity")).toBeVisible();

        const urlHash = await page.evaluate(() => window.location.hash);
        const roomId = urlHash.replace("#/room/", "");

        // Room should have a knock join rule
        await waitForRoom(page, app.client, roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some((e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock");
        });
    });

    test("should create a room and change a join rule to knock", async ({ page, app, user }) => {
        const dialog = await app.openCreateRoomDialog();
        await dialog.getByRole("textbox", { name: "Name" }).fill("Cybersecurity");
        await dialog.getByRole("button", { name: "Create room" }).click();

        await expect(page.locator(".mx_LegacyRoomHeader").getByText("Cybersecurity")).toBeVisible();

        const urlHash = await page.evaluate(() => window.location.hash);
        const roomId = urlHash.replace("#/room/", "");

        await app.settings.openRoomSettings("Security & Privacy");

        const settingsGroup = page.getByRole("group", { name: "Access" });
        await expect(settingsGroup.getByRole("radio", { name: "Private (invite only)" })).toBeChecked();
        await settingsGroup.getByText("Ask to join").click();

        // Room should have a knock join rule
        await waitForRoom(page, app.client, roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some((e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock");
        });
    });

    test("should create a public knock room", async ({ page, app, user }) => {
        const dialog = await app.openCreateRoomDialog();
        await dialog.getByRole("textbox", { name: "Name" }).fill("Cybersecurity");
        await dialog.getByRole("button", { name: "Room visibility" }).click();
        await dialog.getByRole("option", { name: "Ask to join" }).click();
        await dialog.getByText("Make this room visible in the public room directory.").click();
        await dialog.getByRole("button", { name: "Create room" }).click();

        await expect(page.locator(".mx_LegacyRoomHeader").getByText("Cybersecurity")).toBeVisible();

        const urlHash = await page.evaluate(() => window.location.hash);
        const roomId = urlHash.replace("#/room/", "");

        // Room should have a knock join rule
        await waitForRoom(page, app.client, roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some((e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock");
        });

        const spotlightDialog = await app.openSpotlight();
        await spotlightDialog.filter(Filter.PublicRooms);
        await expect(spotlightDialog.results.nth(0)).toContainText("Cybersecurity");
    });
});
