/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Locator } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";

const room1Name = "Room 1";
const room2Name = "Room 2";
const unknownRoomAlias = "#unknownroom:example.com";
const permalinkPrefix = "https://matrix.to/#/";

const getPill = (locator: Locator, label: string) => {
    return locator.locator(".mx_Pill_text", { hasText: new RegExp("^" + label + "$", "g") });
};

test.describe("permalinks", () => {
    test.use({
        displayName: "Alice",
    });

    test("shoud render permalinks as expected", { tag: "@screenshot" }, async ({ page, app, user, homeserver }) => {
        const bob = new Bot(page, homeserver, { displayName: "Bob" });
        const charlotte = new Bot(page, homeserver, { displayName: "Charlotte" });
        await bob.prepareClient();
        await charlotte.prepareClient();

        // We don't use a bot for danielle as we want a stable MXID.
        const danielleId = `@danielle:${user.homeServer}`;

        const room1Id = await app.client.createRoom({ name: room1Name });
        const room2Id = await app.client.createRoom({ name: room2Name });

        await app.viewRoomByName(room1Name);

        await app.client.inviteUser(room1Id, bob.credentials.userId);
        await app.client.inviteUser(room2Id, charlotte.credentials.userId);

        await app.client.sendMessage(room1Id, "At room mention: @room");

        await app.client.sendMessage(room1Id, `Permalink to Room 2: ${permalinkPrefix}${room2Id}`);
        await app.client.sendMessage(
            room1Id,
            `Permalink to an unknown room alias: ${permalinkPrefix}${unknownRoomAlias}`,
        );

        const event1Response = await bob.sendMessage(room1Id, "Hello");
        await app.client.sendMessage(
            room1Id,
            `Permalink to a message in the same room: ${permalinkPrefix}${room1Id}/${event1Response.event_id}`,
        );

        const event2Response = await charlotte.sendMessage(room2Id, "Hello");
        await app.client.sendMessage(
            room1Id,
            `Permalink to a message in another room: ${permalinkPrefix}${room2Id}/${event2Response.event_id}`,
        );

        await app.client.sendMessage(room1Id, `Permalink to an unknown message: ${permalinkPrefix}${room1Id}/$abc123`);

        await app.client.sendMessage(
            room1Id,
            `Permalink to a user in the room: ${permalinkPrefix}${bob.credentials.userId}`,
        );
        await app.client.sendMessage(
            room1Id,
            `Permalink to a user in another room: ${permalinkPrefix}${charlotte.credentials.userId}`,
        );
        await app.client.sendMessage(
            room1Id,
            `Permalink to a user with whom alice doesn't share a room: ${permalinkPrefix}${danielleId}`,
        );

        const timeline = page.locator(".mx_RoomView_timeline");
        getPill(timeline, "@room");

        getPill(timeline, room2Name);
        getPill(timeline, unknownRoomAlias);

        getPill(timeline, "Message from Bob");
        getPill(timeline, `Message in ${room2Name}`);
        getPill(timeline, "Message");

        getPill(timeline, "Bob");
        getPill(timeline, "Charlotte");
        // This is the permalink to Danielle's profile. It should only display the MXID
        // because the profile is unknown (not sharing any room with Danielle).
        getPill(timeline, danielleId);

        await expect(timeline).toMatchScreenshot("permalink-rendering.png", {
            mask: [
                // Exclude timestamps from the snapshot, for consistency.
                page.locator(".mx_MessageTimestamp"),
            ],
        });
    });
});
