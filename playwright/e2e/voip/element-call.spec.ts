/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventType, Preset } from "matrix-js-sdk/src/matrix";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { test, expect } from "../../element-web-test";
import type { Credentials } from "../../plugins/homeserver";

function assertCommonCallParameters(
    url: URLSearchParams,
    hash: URLSearchParams,
    user: Credentials,
    room: { roomId: string },
): void {
    expect(url.has("widgetId")).toEqual(true);
    expect(url.has("parentUrl")).toEqual(true);

    expect(hash.get("confineToRoom")).toEqual("true");
    expect(hash.get("returnToLobby")).toEqual("false");
    expect(hash.get("perParticipantE2EE")).toEqual("false");
    expect(hash.get("header")).toEqual("none");
    expect(hash.get("userId")).toEqual(user.userId);
    expect(hash.get("deviceId")).toEqual(user.deviceId);
    expect(hash.get("roomId")).toEqual(room.roomId);
    expect(hash.get("preload")).toEqual("false");
    expect(hash.has("rageshakeSubmitUrl")).toEqual(true);
}

test.describe("Element Call", () => {
    test.use({
        config: {
            element_call: {
                use_exclusively: true,
            },
        },
        botCreateOpts: {
            autoAcceptInvites: true,
            displayName: "Bob",
        },
    });

    test.beforeEach(async ({ page, user, app }) => {
        // Mock a widget page. It doesn't need to actually be Element Call.
        await page.route("/widget.html", async (route) => {
            await route.fulfill({
                status: 200,
                body: "<p> Hello world </p>",
            });
        });
        await app.settings.setValue(
            "Developer.elementCallUrl",
            null,
            SettingLevel.DEVICE,
            new URL("/widget.html#", page.url()).toString(),
        );
    });

    test.describe("Group Chat", () => {
        test.use({
            room: async ({ page, app, user, bot }, use) => {
                const roomId = await app.client.createRoom({ name: "TestRoom" });
                await use({ roomId });
            },
        });
        test("should be able to start a video call", async ({ page, user, room, app }) => {
            await app.viewRoomById(room.roomId);
            await page.getByRole("button", { name: "Video call" }).click();
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();

            // Ensure we set the correct parameters for ECall.
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("sendNotificationType")).toEqual("notification");
            expect(hash.get("intent")).toEqual("start_call");
            expect(hash.get("skipLobby")).toEqual(null);
        });

        test("should be able to skip lobby by holding down shift", async ({ page, user, bot, room, app }) => {
            await app.viewRoomById(room.roomId);
            await page.getByRole("button", { name: "Video call" }).click();
            await page.keyboard.down("Shift");
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            await page.keyboard.up("Shift");
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("sendNotificationType")).toEqual("notification");
            expect(hash.get("intent")).toEqual("start_call");
            expect(hash.get("skipLobby")).toEqual("true");
        });
    });

    test.describe("DMs", () => {
        test.use({
            room: async ({ page, app, user, bot }, use) => {
                const roomId = await app.client.createRoom({
                    name: "TestRoom",
                    preset: "trusted_private_chat" as Preset.TrustedPrivateChat,
                    invite: [bot.credentials.userId],
                });
                await app.client.setAccountData("m.direct" as EventType.Direct, {
                    [bot.credentials.userId]: [roomId],
                });
                await use({ roomId });
            },
        });

        test("should be able to start a video call", async ({ page, user, room, app }) => {
            await app.viewRoomById(room.roomId);
            await page.getByRole("button", { name: "Video call" }).click();
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("sendNotificationType")).toEqual("ring");
            expect(hash.get("intent")).toEqual("start_call_dm");
            expect(hash.get("skipLobby")).toEqual(null);
        });

        test("should be able to skip lobby by holding down shift", async ({ page, user, room, app }) => {
            await app.viewRoomById(room.roomId);
            await page.getByRole("button", { name: "Video call" }).click();
            await page.keyboard.down("Shift");
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            await page.keyboard.up("Shift");
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("sendNotificationType")).toEqual("ring");
            expect(hash.get("intent")).toEqual("start_call_dm");
            expect(hash.get("skipLobby")).toEqual("true");
        });
    });
});
