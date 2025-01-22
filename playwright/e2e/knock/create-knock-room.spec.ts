/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { waitForRoom } from "../utils";
import { Filter } from "../../pages/Spotlight";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Create Knock Room", () => {
    test.skip(isDendrite, "Dendrite does not have support for knocking");
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

        await expect(page.locator(".mx_RoomHeader").getByText("Cybersecurity")).toBeVisible();

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

        await expect(page.locator(".mx_RoomHeader").getByText("Cybersecurity")).toBeVisible();

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

        await expect(page.locator(".mx_RoomHeader").getByText("Cybersecurity")).toBeVisible();

        const urlHash = await page.evaluate(() => window.location.hash);
        const roomId = urlHash.replace("#/room/", "");

        // Room should have a knock join rule
        await waitForRoom(page, app.client, roomId, (room) => {
            const events = room.getLiveTimeline().getEvents();
            return events.some((e) => e.getType() === "m.room.join_rules" && e.getContent().join_rule === "knock");
        });

        const spotlightDialog = await app.openSpotlight();
        await spotlightDialog.filter(Filter.PublicRooms);
        await spotlightDialog.search("Cyber");
        await expect(spotlightDialog.results.nth(0)).toContainText("Cybersecurity");
    });
});
