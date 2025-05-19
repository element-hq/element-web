/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as fs from "node:fs";
import { type EventType, type MsgType, type RoomJoinRulesEventContent } from "matrix-js-sdk/src/types";

import { test, expect } from "../../element-web-test";

const MEDIA_FILE = fs.readFileSync("playwright/sample-files/riot.png");

test.describe("Media preview settings", () => {
    test.use({
        displayName: "Alan",
        botCreateOpts: {
            displayName: "Bob",
        },
        room: async ({ app, page, homeserver, bot, user }, use) => {
            const mxc = (await bot.uploadContent(MEDIA_FILE, { name: "image.png", type: "image/png" })).content_uri;
            const roomId = await bot.createRoom({
                name: "Test room",
                invite: [user.userId],
                initial_state: [{ type: "m.room.avatar", content: { url: mxc }, state_key: "" }],
            });
            await bot.sendEvent(roomId, null, "m.room.message" as EventType, {
                msgtype: "m.image" as MsgType,
                body: "image.png",
                url: mxc,
            });

            await use({ roomId });
        },
    });

    test("should be able to hide avatars of inviters", { tag: "@screenshot" }, async ({ page, app, room, user }) => {
        let settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Hide avatars of room and inviter").click();
        await app.closeDialog();
        await app.viewRoomById(room.roomId);
        await expect(
            page.getByRole("complementary").filter({ hasText: "Do you want to join Test room" }),
        ).toMatchScreenshot("invite-no-avatar.png", {
            // Hide the mxid, which is not stable.
            css: `
                .mx_RoomPreviewBar_inviter_mxid {
                    display: none !important;
                }
            `,
        });
        await expect(
            page.getByRole("tree", { name: "Rooms" }).getByRole("treeitem", { name: "Test room" }),
        ).toMatchScreenshot("invite-room-tree-no-avatar.png");

        // And then go back to being visible
        settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Hide avatars of room and inviter").click();
        await app.closeDialog();
        await page.goto("#/home");
        await app.viewRoomById(room.roomId);
        await expect(
            page.getByRole("complementary").filter({ hasText: "Do you want to join Test room" }),
        ).toMatchScreenshot("invite-with-avatar.png", {
            // Hide the mxid, which is not stable.
            css: `
                .mx_RoomPreviewBar_inviter_mxid {
                    display: none !important;
                }
            `,
        });
        await expect(
            page.getByRole("tree", { name: "Rooms" }).getByRole("treeitem", { name: "Test room" }),
        ).toMatchScreenshot("invite-room-tree-with-avatar.png");
    });

    test("should be able to hide media in rooms globally", async ({ page, app, room, user }) => {
        const settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Show media in timeline").getByRole("radio", { name: "Always hide" }).click();
        await app.closeDialog();
        await app.viewRoomById(room.roomId);
        await page.getByRole("button", { name: "Accept" }).click();
        await expect(page.getByText("Show image")).toBeVisible();
    });
    test("should be able to hide media in non-private rooms globally", async ({ page, app, room, user, bot }) => {
        await bot.sendStateEvent(room.roomId, "m.room.join_rules", {
            join_rule: "public",
        });
        const settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Show media in timeline").getByLabel("In private rooms").click();
        await app.closeDialog();
        await app.viewRoomById(room.roomId);
        await page.getByRole("button", { name: "Accept" }).click();
        await expect(page.getByText("Show image")).toBeVisible();
        for (const joinRule of ["invite", "knock", "restricted"] as RoomJoinRulesEventContent["join_rule"][]) {
            await bot.sendStateEvent(room.roomId, "m.room.join_rules", {
                join_rule: joinRule,
            } satisfies RoomJoinRulesEventContent);
            await expect(page.getByText("Show image")).not.toBeVisible();
        }
    });
    test("should be able to show media in rooms globally", async ({ page, app, room, user }) => {
        const settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Show media in timeline").getByRole("radio", { name: "Always show" }).click();
        await app.closeDialog();
        await app.viewRoomById(room.roomId);
        await page.getByRole("button", { name: "Accept" }).click();
        await expect(page.getByText("Show image")).not.toBeVisible();
    });
    test("should be able to hide media in an individual room", async ({ page, app, room, user }) => {
        const settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Show media in timeline").getByRole("radio", { name: "Always show" }).click();
        await app.closeDialog();

        await app.viewRoomById(room.roomId);
        await page.getByRole("button", { name: "Accept" }).click();

        const roomSettings = await app.settings.openRoomSettings("General");
        await roomSettings.getByLabel("Show media in timeline").getByRole("radio", { name: "Always hide" }).click();
        await app.closeDialog();

        await expect(page.getByText("Show image")).toBeVisible();
    });
    test("should be able to show media in an individual room", async ({ page, app, room, user }) => {
        const settings = await app.settings.openUserSettings("Preferences");
        await settings.getByLabel("Show media in timeline").getByRole("radio", { name: "Always hide" }).click();
        await app.closeDialog();

        await app.viewRoomById(room.roomId);
        await page.getByRole("button", { name: "Accept" }).click();

        const roomSettings = await app.settings.openRoomSettings("General");
        await roomSettings.getByLabel("Show media in timeline").getByRole("radio", { name: "Always show" }).click();
        await app.closeDialog();

        await expect(page.getByText("Show image")).not.toBeVisible();
    });
});
