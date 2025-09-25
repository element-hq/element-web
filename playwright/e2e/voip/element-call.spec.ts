/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventType, Preset } from "matrix-js-sdk/src/matrix";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { test, expect } from "../../element-web-test";
import type { Credentials } from "../../plugins/homeserver";
import { Bot } from "../../pages/bot";

function assertCommonCallParameters(
    url: URLSearchParams,
    hash: URLSearchParams,
    user: Credentials,
    room: { roomId: string },
): void {
    expect(url.has("widgetId")).toEqual(true);
    expect(url.has("parentUrl")).toEqual(true);

    expect(hash.get("perParticipantE2EE")).toEqual("false");
    expect(hash.get("userId")).toEqual(user.userId);
    expect(hash.get("deviceId")).toEqual(user.deviceId);
    expect(hash.get("roomId")).toEqual(room.roomId);
    expect(hash.get("preload")).toEqual("false");
}

async function sendRTCState(bot: Bot, roomId: string, notification?: "ring" | "notification", intent?: string) {
    const resp = await bot.sendStateEvent(
        roomId,
        "org.matrix.msc3401.call.member",
        {
            "application": "m.call",
            "call_id": "",
            "m.call.intent": intent,
            "device_id": "OiDFxsZrjz",
            "expires": 180000000,
            "foci_preferred": [
                {
                    livekit_alias: roomId,
                    livekit_service_url: "https://example.org",
                    type: "livekit",
                },
            ],
            "focus_active": {
                focus_selection: "oldest_membership",
                type: "livekit",
            },
            "scope": "m.room",
        },
        `_@${bot.credentials.userId}_OiDFxsZrjz_m.call`,
    );
    if (!notification) {
        return;
    }
    await bot.sendEvent(roomId, null, "org.matrix.msc4075.rtc.notification", {
        "lifetime": 30000,
        "m.mentions": {
            room: true,
            user_ids: [],
        },
        "m.relates_to": {
            event_id: resp.event_id,
            rel_type: "org.matrix.msc4075.rtc.notification.parent",
        },
        "m.call.intent": intent,
        "notification_type": notification,
        "sender_ts": 1758611895996,
    });
}

test.describe("Element Call", () => {
    test.use({
        config: {
            element_call: {
                use_exclusively: false,
            },
            features: {
                feature_group_calls: true,
            },
        },
        displayName: "Alice",
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
        let charlie: Bot;
        test.use({
            room: async ({ page, app, user, homeserver, bot }, use) => {
                charlie = new Bot(page, homeserver, { displayName: "Charlie" });
                await charlie.prepareClient();
                const roomId = await app.client.createRoom({
                    name: "TestRoom",
                    invite: [bot.credentials.userId, charlie.credentials.userId],
                });
                await use({ roomId });
            },
        });
        test("should be able to start a video call", async ({ page, user, room, app }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();

            await page.getByRole("button", { name: "Video call" }).click();
            await page.getByRole("menuitem", { name: "Element Call" }).click();

            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            // Ensure we set the correct parameters for ECall.
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("intent")).toEqual("start_call");
            expect(hash.get("skipLobby")).toEqual(null);
        });

        test("should NOT be able to start a voice call", async ({ page, user, room, app }) => {
            // Voice calls do not exist in group rooms
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();
            await expect(page.getByRole("button", { name: "Voice call" })).not.toBeVisible();
        });

        test("should be able to skip lobby by holding down shift", async ({ page, user, bot, room, app }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();

            await page.getByRole("button", { name: "Video call" }).click();
            await page.keyboard.down("Shift");
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            await page.keyboard.up("Shift");

            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("intent")).toEqual("start_call");
            expect(hash.get("skipLobby")).toEqual("true");
        });

        test("should be able to join a call in progress", async ({ page, user, bot, room, app }) => {
            await app.viewRoomById(room.roomId);
            // Allow bob to create a call
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();
            await app.client.setPowerLevel(room.roomId, bot.credentials.userId, 50);
            // Fake a start of a call
            await sendRTCState(bot, room.roomId);
            const button = page.getByTestId("join-call-button");
            await expect(button).toBeInViewport({ timeout: 5000 });
            // And test joining
            await button.click();
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);

            expect(hash.get("intent")).toEqual("join_existing");
            expect(hash.get("skipLobby")).toEqual(null);
        });

        [true, false].forEach((skipLobbyToggle) => {
            test(
                `should be able to join a call via incoming video call toast (skipLobby=${skipLobbyToggle})`,
                { tag: ["@screenshot"] },
                async ({ page, user, bot, room, app }) => {
                    await app.viewRoomById(room.roomId);
                    // Allow bob to create a call
                    await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();
                    await app.client.setPowerLevel(room.roomId, bot.credentials.userId, 50);
                    // Fake a start of a call
                    await sendRTCState(bot, room.roomId, "notification", "video");
                    const toast = page.locator(".mx_Toast_toast");
                    const button = toast.getByRole("button", { name: "Join" });

                    if (skipLobbyToggle) {
                        await toast.getByRole("switch").check();
                        await expect(toast).toMatchScreenshot(`incoming-call-group-video-toast-checked.png`);
                    } else {
                        await toast.getByRole("switch").uncheck();
                        await expect(toast).toMatchScreenshot(`incoming-call-group-video-toast-unchecked.png`);
                    }

                    // And test joining
                    await button.click();
                    const frameUrlStr = await page.locator("iframe").getAttribute("src");
                    await expect(frameUrlStr).toBeDefined();
                    const url = new URL(frameUrlStr);
                    const hash = new URLSearchParams(url.hash.slice(1));
                    assertCommonCallParameters(url.searchParams, hash, user, room);

                    expect(hash.get("intent")).toEqual("join_existing");
                    expect(hash.get("skipLobby")).toEqual(skipLobbyToggle.toString());
                },
            );
        });

        test(
            `should be able to join a call via incoming voice call toast`,
            { tag: ["@screenshot"] },
            async ({ page, user, bot, room, app }) => {
                await app.viewRoomById(room.roomId);
                // Allow bob to create a call
                await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();
                await app.client.setPowerLevel(room.roomId, bot.credentials.userId, 50);
                // Fake a start of a call
                await sendRTCState(bot, room.roomId, "notification", "audio");
                const toast = page.locator(".mx_Toast_toast");
                const button = toast.getByRole("button", { name: "Join" });

                await expect(toast).toMatchScreenshot(`incoming-call-group-voice-toast.png`);

                // And test joining
                await button.click();
                const frameUrlStr = await page.locator("iframe").getAttribute("src");
                await expect(frameUrlStr).toBeDefined();
                const url = new URL(frameUrlStr);
                const hash = new URLSearchParams(url.hash.slice(1));
                assertCommonCallParameters(url.searchParams, hash, user, room);

                expect(hash.get("intent")).toEqual("join_existing");
                expect(hash.get("skipLobby")).toEqual("true");
            },
        );
    });

    test.describe("DMs", () => {
        test.use({
            room: async ({ page, app, user, bot }, use) => {
                const roomId = await app.client.createRoom({
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
            await expect(page.getByText("Bob joined the room")).toBeVisible();

            await page.getByRole("button", { name: "Video call" }).click();
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            const frameUrlStr = await page.locator("iframe").getAttribute("src");

            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("intent")).toEqual("start_call_dm");
            expect(hash.get("skipLobby")).toEqual(null);
        });

        test("should be able to skip lobby by holding down shift", async ({ page, user, room, app }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob joined the room")).toBeVisible();

            await page.getByRole("button", { name: "Video call" }).click();
            await page.keyboard.down("Shift");
            await page.getByRole("menuitem", { name: "Element Call" }).click();
            await page.keyboard.up("Shift");
            const frameUrlStr = await page.locator("iframe").getAttribute("src");

            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);
            expect(hash.get("intent")).toEqual("start_call_dm");
            expect(hash.get("skipLobby")).toEqual("true");
        });

        test("should be able to join a call in progress", async ({ page, user, bot, room, app }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob joined the room")).toBeVisible();
            // Fake a start of a call
            await sendRTCState(bot, room.roomId);
            const button = page.getByTestId("join-call-button");
            await expect(button).toBeInViewport({ timeout: 5000 });
            // And test joining
            await button.click();
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, room);

            expect(hash.get("intent")).toEqual("join_existing_dm");
            expect(hash.get("skipLobby")).toEqual(null);
        });

        [true, false].forEach((skipLobbyToggle) => {
            test(
                `should be able to join a call via incoming call toast (skipLobby=${skipLobbyToggle})`,
                { tag: ["@screenshot"] },
                async ({ page, user, bot, room, app }) => {
                    await app.viewRoomById(room.roomId);
                    await expect(page.getByText("Bob joined the room")).toBeVisible();
                    // Fake a start of a call
                    await sendRTCState(bot, room.roomId, "ring", "video");
                    const toast = page.locator(".mx_Toast_toast");
                    const button = toast.getByRole("button", { name: "Accept" });
                    if (skipLobbyToggle) {
                        await toast.getByRole("switch").check();
                    } else {
                        await toast.getByRole("switch").uncheck();
                    }
                    await expect(toast).toMatchScreenshot(
                        `incoming-call-dm-video-toast-${skipLobbyToggle ? "checked" : "unchecked"}.png`,
                        {
                            // Hide UserId
                            css: `
                            .mx_IncomingCallToast_AvatarWithDetails span:nth-child(2) {
                                opacity: 0;
                            }
                        `,
                        },
                    );

                    // And test joining
                    await button.click();
                    const frameUrlStr = await page.locator("iframe").getAttribute("src");
                    await expect(frameUrlStr).toBeDefined();
                    const url = new URL(frameUrlStr);
                    const hash = new URLSearchParams(url.hash.slice(1));
                    assertCommonCallParameters(url.searchParams, hash, user, room);

                    expect(hash.get("intent")).toEqual("join_existing_dm");
                    expect(hash.get("skipLobby")).toEqual(skipLobbyToggle.toString());
                },
            );
        });

        test(
            `should be able to join a call via incoming voice call toast`,
            { tag: ["@screenshot"] },
            async ({ page, user, bot, room, app }) => {
                await app.viewRoomById(room.roomId);
                await expect(page.getByText("Bob joined the room")).toBeVisible();
                // Fake a start of a call
                await sendRTCState(bot, room.roomId, "ring", "audio");
                const toast = page.locator(".mx_Toast_toast");
                const button = toast.getByRole("button", { name: "Accept" });

                await expect(toast).toMatchScreenshot(`incoming-call-dm-voice-toast.png`, {
                    // Hide UserId
                    css: `
                        .mx_IncomingCallToast_AvatarWithDetails span:nth-child(2) {
                            opacity: 0;
                        }
                    `,
                });

                // And test joining
                await button.click();
                const frameUrlStr = await page.locator("iframe").getAttribute("src");
                await expect(frameUrlStr).toBeDefined();
                const url = new URL(frameUrlStr);
                const hash = new URLSearchParams(url.hash.slice(1));
                assertCommonCallParameters(url.searchParams, hash, user, room);

                expect(hash.get("intent")).toEqual("join_existing_dm_voice");
                expect(hash.get("skipLobby")).toEqual("true");
            },
        );
    });

    test.describe("Video Rooms", () => {
        test.use({
            config: {
                features: {
                    feature_video_rooms: true,
                    feature_element_call_video_rooms: true,
                },
            },
        });
        test("should be able to create and join a video room", async ({ page, user }) => {
            await page.getByRole("navigation", { name: "Room list" }).getByRole("button", { name: "Add" }).click();
            await page.getByRole("menuitem", { name: "New video room" }).click();
            await page.getByRole("textbox", { name: "Name" }).fill("Test room");
            await page.getByRole("button", { name: "Create video room" }).click();
            await expect(page).toHaveURL(new RegExp(`/#/room/`));
            const roomId = new URL(page.url()).hash.slice("#/room/".length);

            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            await expect(frameUrlStr).toBeDefined();
            // Ensure we set the correct parameters for ECall.
            const url = new URL(frameUrlStr);
            const hash = new URLSearchParams(url.hash.slice(1));
            assertCommonCallParameters(url.searchParams, hash, user, { roomId });
            expect(hash.get("intent")).toEqual("join_existing");
            expect(hash.get("skipLobby")).toEqual("false");
            expect(hash.get("returnToLobby")).toEqual("true");
        });
    });
});
