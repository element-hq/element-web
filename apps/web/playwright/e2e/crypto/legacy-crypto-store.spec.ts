/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2023, 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, test } from "../../element-web-test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("legacy crypto store", { tag: "@no-webkit" }, function () {
    test.use({
        displayName: "Alice",

        // Replace the `user` fixture with one which populates the indexeddb data before starting the app.
        user: async ({ context, pageWithCredentials: page, credentials }, use) => {
            await page.route(`/test_indexeddb_cryptostore_dump/*`, async (route, request) => {
                const resourcePath = path.join(__dirname, new URL(request.url()).pathname);
                const body = await readFile(resourcePath, { encoding: "utf-8" });
                await route.fulfill({ body });
            });
            await page.goto("/test_indexeddb_cryptostore_dump/index.html");

            await use(credentials);
        },
    });

    test("Should explain that a session with an unmigrated legacy crypto store is too old", async ({
        context,
        user,
        page,
    }) => {
        await expect(page.getByRole("heading", { name: "This session cannot be used" })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole("button", { name: "Remove this device" })).toBeVisible();
    });
});
