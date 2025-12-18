/*
Copyright 2025 Element Creations Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Room Status Bar", () => {
    test.use({
        displayName: "Jim",
        room: async ({ app, user }, use) => {
            const roomId = await app.client.createRoom({
                name: "A room",
            });
            await app.closeNotificationToast();
            await app.viewRoomById(roomId);
            await use({ roomId });
        },
    });

    test("should show an error when sync stops", { tag: "@screenshot" }, async ({ page, user, app, room, axe }) => {
        await page.route("**/_matrix/client/*/sync*", async (route, req) => {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                body: '{"error": "Test fail", "errcode": "M_UNKNOWN"}',
            });
        });
        await app.client.sendMessage(room.roomId, "forcing sync to run");
        const banner = page.getByRole("region", { name: "Room status bar" });
        await expect(banner).toBeVisible({ timeout: 15000 });
        await expect(banner).toMatchScreenshot("connectivity_lost.png");
    });
    test("should NOT an error when a resource limit is hit", async ({ page, user, app, room, axe, toasts }) => {
        await app.viewRoomById(room.roomId);
        await page.route("**/_matrix/client/*/sync*", async (route, req) => {
            await route.fulfill({
                status: 400,
                contentType: "application/json",
                body: JSON.stringify({
                    error: "Test fail",
                    errcode: "M_RESOURCE_LIMIT_EXCEEDED",
                    limit_type: "monthly_active_user",
                    admin_contact: "https://example.org",
                }),
            });
        });
        await app.client.sendMessage(room.roomId, "forcing sync to run");
        // Wait for the MAU warning toast to appear so we know this status bar would have appeared.
        await toasts.getToast("Warning", 15000);
        await expect(page.getByRole("region", { name: "Room status bar" })).not.toBeVisible();
    });
    test(
        "should show an error when the user needs to consent",
        { tag: "@screenshot" },
        async ({ page, user, app, room, axe }) => {
            await app.viewRoomById(room.roomId);
            await page.route("**/_matrix/client/**/send**", async (route) => {
                await route.fulfill({
                    status: 400,
                    contentType: "application/json",
                    body: JSON.stringify({
                        error: "Test fail",
                        errcode: "M_CONSENT_NOT_GIVEN",
                        consent_uri: "https://example.org",
                    }),
                });
            });
            const composer = app.getComposerField();
            await composer.fill("Hello!");
            await composer.press("Enter");
            await page
                .getByRole("dialog", { name: "Terms and Conditions" })
                .getByRole("button", { name: "Dismiss" })
                .click();
            const banner = page.getByRole("region", { name: "Room status bar" });
            await expect(banner).toBeVisible({ timeout: 15000 });
            await expect(banner).toMatchScreenshot("consent.png");
        },
    );
    test.describe("Message fails to send", () => {
        test.beforeEach(async ({ page, user, app, room, axe }) => {
            await app.viewRoomById(room.roomId);
            await page.route("**/_matrix/client/**/send**", async (route) => {
                await route.fulfill({
                    status: 400,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "Test fail", errcode: "M_UNKNOWN" }),
                });
            });
            const composer = app.getComposerField();
            await composer.fill("Hello!");
            await composer.press("Enter");
            const banner = page.getByRole("region", { name: "Room status bar" });
            await expect(banner).toBeVisible();
        });
        test(
            "should show an error when a message fails to send",
            { tag: "@screenshot" },
            async ({ page, user, app, room, axe }) => {
                const banner = page.getByRole("region", { name: "Room status bar" });
                await expect(banner).toMatchScreenshot("message_failed.png");
            },
        );
        test("should be able to 'Delete all' messages", async ({ page, user, app, room, axe }) => {
            const banner = page.getByRole("region", { name: "Room status bar" });
            await banner.getByRole("button", { name: "Delete all" }).click();
            await expect(banner).not.toBeVisible();
        });
        test("should be able to 'Retry all' messages", async ({ page, user, app, room, axe }) => {
            const banner = page.getByRole("region", { name: "Room status bar" });
            page.unroute("**/_matrix/client/**/send**");
            await banner.getByRole("button", { name: "Retry all" }).click();
            await expect(banner).not.toBeVisible();
        });
    });
});
