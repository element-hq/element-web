/*
Copyright 2025 New Vector Ltd.
Copyright (C) 2025 Element Creations Ltd
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { readFile } from "node:fs/promises";
import { type Page } from "playwright-core";

import type { EventType, Preset } from "matrix-js-sdk/src/matrix";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { test, expect } from "../../element-web-test";
import type { Credentials } from "../../plugins/homeserver";
import { Bot } from "../../pages/bot";

// Load a copy of our fake Element Call app, and the latest widget API.
// The fake call app does *just* enough to convince Element Web that a call is ongoing
// and functions like PiP work. It does not actually do anything though, to limit the
// surface we test.
const widgetApi = readFile("node_modules/matrix-widget-api/dist/api.min.js", "utf-8");
const fakeCallClient = readFile("playwright/sample-files/fake-element-call.html", "utf-8");

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
        // Mock a widget page. We use a fake version of Element Call here.
        // We should match on things after .html as these widgets get a ton of extra params.
        await page.route(/\/widget.html.+/, async (route) => {
            await route.fulfill({
                status: 200,
                // Do enough to
                body: (await fakeCallClient).replace("widgetCodeHere", await widgetApi),
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
            await page
                .getByRole("navigation", { name: "Room list" })
                .getByRole("button", { name: "New conversation" })
                .click();
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

    test.describe("Switching rooms", () => {
        let charlie: Bot;
        test.use({
            room: async ({ page, app, user, homeserver, bot }, use) => {
                charlie = new Bot(page, homeserver, { displayName: "Charlie" });
                await charlie.prepareClient();
                const roomId = await app.client.createRoom({
                    name: "TestRoom",
                    invite: [bot.credentials.userId, charlie.credentials.userId],
                });
                await app.client.createRoom({
                    name: "OtherRoom",
                });
                await use({ roomId });
            },
        });

        async function openAndJoinCall(page: Page, existing = false) {
            if (existing) {
                await page.getByTestId("join-call-button").click();
            } else {
                await page.getByRole("button", { name: "Video call" }).click();
                await page.getByRole("menuitem", { name: "Element Call" }).click();
            }
            const iframe = page.locator("iframe");
            await expect(iframe).toBeVisible();
            const frameUrlStr = await page.locator("iframe").getAttribute("src");
            const callFrame = page.frame({ url: frameUrlStr });
            await callFrame.getByRole("button", { name: "Join Call" }).click();
            await expect(callFrame.getByText("In call", { exact: true })).toBeVisible();

            // Wait for Element Web to pickup the RTC session and update the room list entry.
            await expect(await page.getByTestId("notification-decoration")).toBeVisible();
        }

        test("should be able to switch rooms and have the call persist", async ({ page, user, room, app }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();

            await openAndJoinCall(page);
            await app.viewRoomByName("OtherRoom");

            // We should have a PiP container here.
            await expect(page.locator(".mx_AppTile_persistedWrapper")).toBeVisible();
        });

        test("should be able to start a call, close it via PiP, and start again in the same room", async ({
            page,
            user,
            room,
            app,
        }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();

            await openAndJoinCall(page);
            await app.viewRoomByName("OtherRoom");
            const pipContainer = page.locator(".mx_WidgetPip");

            // We should have a PiP container here.
            await expect(pipContainer).toBeVisible();

            // Leave the call.
            const overlay = page.locator(".mx_WidgetPip_overlay");
            await overlay.hover({ timeout: 2000 }); // Show the call footer.
            await overlay.getByRole("button", { name: "Leave", exact: true }).click();

            // PiP container goes.
            await expect(pipContainer).not.toBeVisible();

            // Wait for call to stop.
            await expect(await page.getByTestId("notification-decoration")).not.toBeVisible();
            await app.viewRoomById(room.roomId);
            await expect(await page.getByTestId("join-call-button")).not.toBeVisible();

            // Join the call again.
            await openAndJoinCall(page);
        });

        test("should be able to start a call, close it via PiP, and start again in a different room", async ({
            page,
            user,
            room,
            app,
        }) => {
            await app.viewRoomById(room.roomId);
            await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();

            await openAndJoinCall(page);
            await app.viewRoomByName("OtherRoom");
            const pipContainer = page.locator(".mx_WidgetPip");

            // We should have a PiP container here.
            await expect(pipContainer).toBeVisible();

            // Leave the call.
            const overlay = page.locator(".mx_WidgetPip_overlay");
            await overlay.hover({ timeout: 2000 }); // Show the call footer.
            await overlay.getByRole("button", { name: "Leave", exact: true }).click();

            // PiP container goes.
            await expect(pipContainer).not.toBeVisible();

            // Wait for call to stop.
            await expect(await page.getByTestId("notification-decoration")).not.toBeVisible();
            await expect(await page.getByTestId("join-call-button")).not.toBeVisible();

            // Join the call again, but from the other room.
            await openAndJoinCall(page);
        });

        // For https://github.com/element-hq/element-web/issues/30838
        test.fail(
            "should be able to join a call, leave via PiP, and rejoin the call",
            async ({ page, user, room, app, bot }) => {
                await app.viewRoomById(room.roomId);
                await expect(page.getByText("Bob and one other were invited and joined")).toBeVisible();
                await app.client.setPowerLevel(room.roomId, bot.credentials.userId, 50);

                await sendRTCState(bot, room.roomId);
                await openAndJoinCall(page, true);

                await app.viewRoomByName("OtherRoom");
                const pipContainer = page.locator(".mx_WidgetPip");

                // We should have a PiP container here.
                await expect(pipContainer).toBeVisible();

                // Leave the call.
                const overlay = page.locator(".mx_WidgetPip_overlay");
                await overlay.hover({ timeout: 2000 }); // Show the call footer.
                await overlay.getByRole("button", { name: "Leave", exact: true }).click();

                // PiP container goes.
                await expect(pipContainer).not.toBeVisible();

                // Rejoin the call
                await app.viewRoomById(room.roomId);
                await openAndJoinCall(page, true);
            },
        );
    });
});
