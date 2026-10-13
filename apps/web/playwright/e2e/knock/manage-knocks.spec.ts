/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "playwright-core";

import { test, expect } from "../../element-web-test";
import { waitForRoom } from "../utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

/**
 * Wait for the membership summary to settle on the given text, then expand it so that the
 * individual events can be asserted. The summary text is only rendered while the summary is
 * collapsed, so waiting for it means the group has stopped growing.
 */
async function expandMembershipSummary(page: Page, summaryText: string): Promise<void> {
    const summary = page.locator(".mx_GenericEventListSummary", { hasText: summaryText });
    await expect(summary).toBeVisible();
    await summary.getByRole("button", { name: "Expand" }).click();
}

test.describe("Manage Knocks", () => {
    test.skip(isDendrite, "Dendrite does not have support for knocking");
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

        // Bob accepts the invite automatically, so the knock, invite and join collapse into a
        // membership summary; expand it to reveal the individual events.
        await expandMembershipSummary(page, "Bob requested to join, was granted access, and joined");
        await expect(page.getByText("Bob is requesting to join")).toBeVisible();
        await expect(page.getByText("Alice granted access to Bob")).toBeVisible();
    });

    test("should deny knock using bar", async ({ page, app, bot, room }) => {
        await bot.knockRoom(room.roomId);

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

        // The knock and its denial are only two events, so they are shown individually rather
        // than collapsed into a membership summary.
        await expect(page.getByText("Alice rejected the request to join from Bob")).toBeVisible();
    });

    test("should approve knock using people tab", async ({ page, app, bot, room }) => {
        await bot.knockRoom(room.roomId, { reason: "Hello, can I join?" });

        await app.settings.openRoomSettings("People");

        const settingsGroup = page.getByRole("group", { name: "Asking to join" });
        await expect(settingsGroup.getByText(/^Bob/)).toBeVisible();
        await expect(settingsGroup.getByText("Hello, can I join?")).toBeVisible();
        await settingsGroup.getByRole("button", { name: "Approve" }).click();
        await expect(settingsGroup.getByText(/^Bob/)).not.toBeVisible();
        await app.settings.closeDialog();

        // Bob accepts the invite automatically, so the knock, invite and join collapse into a
        // membership summary; expand it to reveal the individual events.
        await expandMembershipSummary(page, "Bob requested to join, was granted access, and joined");
        await expect(page.getByText("Bob is requesting to join: Hello, can I join?")).toBeVisible();
        await expect(page.getByText("Alice granted access to Bob")).toBeVisible();
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
        await app.settings.closeDialog();

        // The knock and its denial are only two events, so they are shown individually rather
        // than collapsed into a membership summary.
        await expect(page.getByText("Alice rejected the request to join from Bob")).toBeVisible();
    });
});
