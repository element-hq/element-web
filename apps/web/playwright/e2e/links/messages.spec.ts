/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { test, expect } from "../../element-web-test";

test.describe("Message links", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app, bot }, use) => {
            const roomId = await app.client.createRoom({ name: "Test room" });
            await use({ roomId });
        },
    });
    for (const link of ["https://example.org", "example.org", "ftp://example.org"]) {
        test(`should linkify a regular link '${link}'`, async ({ page, user, app, room }) => {
            await page.goto(`#/room/${room.roomId}`);
            // Needs to be unformatted so we test linkifing
            await app.client.sendMessage(room.roomId, `Check out ${link}`);
            const linkElement = page.locator(".mx_EventTile_last").getByRole("link", { name: link });
            await app.timeline.scrollToBottom();
            await expect(linkElement).toBeVisible();
        });
    }
    test("should linkify a User ID", async ({ page, user, app, room }) => {
        await page.goto(`#/room/${room.roomId}`);
        // Needs to be unformatted so we test linkifing
        await app.client.sendMessage(room.roomId, `Check out @bob:example.org`);
        const linkElement = page.locator(".mx_EventTile_last").getByRole("link", { name: "@bob:example.org" });
        await expect(linkElement).toHaveAttribute("href", `https://matrix.to/#/@bob:example.org`);
    });
    test("should linkify a Room alias", async ({ page, user, app, room }) => {
        await page.goto(`#/room/${room.roomId}`);
        // Needs to be unformatted so we test linkifing
        await app.client.sendMessage(room.roomId, "Check out #aroom:example.org");
        const linkElement = page.locator(".mx_EventTile_last").getByRole("link", { name: "#aroom:example.org" });
        await expect(linkElement).toHaveAttribute("href", "https://matrix.to/#/#aroom:example.org");
    });
    test("should linkify text inside a URL preview", { tag: "@screenshot" }, async ({ page, user, app, room, axe }) => {
        axe.disableRules("color-contrast");
        await page.route(/.*\/_matrix\/(client\/v1\/media|media\/v3)\/preview_url.*/, (route, request) => {
            const requestedPage = new URL(request.url()).searchParams.get("url");
            expect(requestedPage).toEqual("https://example.org/");
            return route.fulfill({
                json: {
                    "og:title": "A simple site",
                    "og:description": "And with a brief description containing https://example.org/another-link",
                },
            });
        });
        await page.goto(`#/room/${room.roomId}`);
        await app.client.sendMessage(room.roomId, "Check out https://example.org/");
        await expect(
            page.locator(".mx_EventTile_last").getByRole("link", { name: "https://example.org/another-link" }),
        ).toBeVisible();
    });
});
