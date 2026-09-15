/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { getSampleFilePath } from "../../sample-files";
import { SettingLevel } from "../../../src/settings/SettingLevel";

const PREVIEW_URL_PATTERN = /.*\/_matrix\/(client\/v1\/media|media\/v3)\/preview_url.*/;

/**
 * Serve homeserver URL previews.
 * @returns A function returning the number of preview requests made so far.
 */
async function mockHomeserverPreviews(page: Page): Promise<() => number> {
    let requestCount = 0;
    await page.route(PREVIEW_URL_PATTERN, (route) => {
        requestCount++;
        return route.fulfill({
            json: {
                "og:title": "Homeserver preview",
                "og:site_name": "example.org",
            },
        });
    });
    return () => requestCount;
}

test.describe("URL Preview API", () => {
    test.use({
        displayName: "Manny",
        config: {
            modules: ["/modules/url-preview-module.js"],
        },
        page: async ({ page }, use) => {
            await page.route("/modules/url-preview-module.js", async (route) => {
                await route.fulfill({ path: getSampleFilePath("url-preview-module.js") });
            });
            await use(page);
        },
        room: async ({ page, app, user }, use) => {
            const roomId = await app.client.createRoom({ name: "TestRoom" });
            await use({ roomId });
        },
    });

    test.describe("in the timeline", () => {
        test("should preview a URL handled by a module", async ({ page, room, app, user }) => {
            const previewRequestCount = await mockHomeserverPreviews(page);
            await app.viewRoomById(room.roomId);
            await app.client.sendMessage(room.roomId, "Look at https://module.example.org/page");

            const tile = page.locator(".mx_EventTile").last();
            await expect(tile.getByRole("link", { name: `Module preview from ${user.userId}` })).toBeVisible();
            // The module handled the URL, so the homeserver should not have been asked.
            expect(previewRequestCount()).toBe(0);
        });

        test("should pass the event being previewed to the handler", async ({ page, room, app, user }) => {
            await mockHomeserverPreviews(page);
            await app.viewRoomById(room.roomId);
            await app.client.sendMessage(room.roomId, "Look at https://module.example.org/page");

            const tile = page.locator(".mx_EventTile").last();
            await expect(tile.getByRole("link", { name: `Module preview from ${user.userId}` })).toBeVisible();
            await expect(tile.getByText(`Previewing m.room.message in ${room.roomId}`)).toBeVisible();
        });

        test("should fall back to the homeserver when no handler matches", async ({ page, room, app }) => {
            const previewRequestCount = await mockHomeserverPreviews(page);
            await app.viewRoomById(room.roomId);
            await app.client.sendMessage(room.roomId, "Look at https://unhandled.example.org/page");

            const tile = page.locator(".mx_EventTile").last();
            await expect(tile.getByRole("link", { name: "Homeserver preview" })).toBeVisible();
            expect(previewRequestCount()).toBeGreaterThan(0);
        });

        test("should fall back to the homeserver when the matching handler returns no preview", async ({
            page,
            room,
            app,
        }) => {
            await mockHomeserverPreviews(page);
            await app.viewRoomById(room.roomId);
            await app.client.sendMessage(room.roomId, "Look at https://decline.example.org/page");

            const tile = page.locator(".mx_EventTile").last();
            await expect(tile.getByRole("link", { name: "Homeserver preview" })).toBeVisible();
            // A later handler also matches this URL, but the first match wins whatever it returns.
            await expect(tile.getByText("Later handler should not be used")).not.toBeVisible();
        });

        test("should only use the first handler that matches", async ({ page, room, app, user }) => {
            await mockHomeserverPreviews(page);
            await app.viewRoomById(room.roomId);
            await app.client.sendMessage(room.roomId, "Look at https://module.example.org/page");

            const tile = page.locator(".mx_EventTile").last();
            await expect(tile.getByRole("link", { name: `Module preview from ${user.userId}` })).toBeVisible();
            await expect(tile.getByText("Later handler should not be used")).not.toBeVisible();
        });
    });

    test.describe("with bundled previews", () => {
        test.use({
            labsFlags: ["feature_msc4095_url_preview_bundle"],
        });

        test("should preview a bundled URL with the module handler", async ({ page, room, app, user }) => {
            const previewRequestCount = await mockHomeserverPreviews(page);
            await app.viewRoomById(room.roomId);
            await app.client.sendEvent(room.roomId, null, "m.room.message", {
                "msgtype": "m.text",
                "body": "Look at https://module.example.org/page",
                "com.beeper.linkpreviews": [
                    {
                        "matched_url": "https://module.example.org/page",
                        "og:title": "Bundled title",
                    },
                ],
            });

            const tile = page.locator(".mx_EventTile").last();
            // The module preview is used in preference to the bundled one, and is given the event.
            await expect(tile.getByRole("link", { name: `Module preview from ${user.userId}` })).toBeVisible();
            await expect(tile.getByText(`Previewing m.room.message in ${room.roomId}`)).toBeVisible();
            await expect(tile.getByText("Bundled title")).not.toBeVisible();
            expect(previewRequestCount()).toBe(0);
        });
    });

    test.describe("in the composer", () => {
        test("should preview a URL handled by a module, without an event", async ({ page, room, app, user }) => {
            const previewRequestCount = await mockHomeserverPreviews(page);
            // Composer URL previews are collapsed by default; expand so the preview renders.
            await app.settings.setValue("composerUrlPreviewCollapsed", null, SettingLevel.DEVICE, false);
            await app.viewRoomById(room.roomId);

            const composerRegion = page.getByRole("region", { name: "Message composer" });
            const composer = composerRegion.getByRole("textbox", { name: "Send an unencrypted message…" });
            await composer.pressSequentially("https://module.example.org/page");

            // Nothing has been sent yet, so the handler is called without an event.
            await expect(composerRegion.getByRole("link", { name: "Module preview without an event" })).toBeVisible();
            expect(previewRequestCount()).toBe(0);
        });
    });
});
