/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "../../element-web-test";

const PREVIEW_URL_PATTERN = /.*\/_matrix\/(client\/v1\/media|media\/v3)\/preview_url.*/;

test.describe("Composer URL preview", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app }, use) => {
            const roomId = await app.client.createRoom({ name: "Test room" });
            await use({ roomId });
        },
    });

    for (const editor of ["cider", "rich text"]) {
        test.describe(`in ${editor}`, () => {
            test.use({
                labsFlags: editor === "rich_text" ? ["feature_wysiwyg_composer"] : [],
            });

            test("shows a preview when a URL is typed into the composer", async ({ page, app, room }) => {
                await page.route(PREVIEW_URL_PATTERN, (route) =>
                    route.fulfill({
                        json: {
                            "og:title": "Example Site",
                            "og:description": "A great description",
                            "og:site_name": "example.org",
                        },
                    }),
                );

                await page.goto(`#/room/${room.roomId}`);
                const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
                await composer.pressSequentially("https://example.org/");

                await expect(page.getByRole("link", { name: "Example Site" })).toBeVisible();
            });

            test("does not show a preview when the server returns a 404", async ({ page, app, room }) => {
                await page.route(PREVIEW_URL_PATTERN, (route) => route.fulfill({ status: 404 }));

                await page.goto(`#/room/${room.roomId}`);
                const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
                await composer.pressSequentially("https://example.org/");

                await expect(page.getByRole("button", { name: "Hide preview" })).not.toBeVisible();
            });

            test("shows the second URL's preview if the first has no valid preview", async ({ page, app, room }) => {
                await page.route(PREVIEW_URL_PATTERN, (route, request) => {
                    const url = new URL(request.url()).searchParams.get("url");
                    if (url === "https://example.org/") {
                        return route.fulfill({ status: 404 });
                    }
                    return route.fulfill({
                        json: {
                            "og:title": "Fallback Site",
                            "og:site_name": "fallback.example.org",
                        },
                    });
                });

                await page.goto(`#/room/${room.roomId}`);
                const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
                await composer.pressSequentially("https://example.org/ https://fallback.example.org/");

                await expect(page.getByRole("link", { name: "Fallback Site" })).toBeVisible();
            });
        });
    }
});
