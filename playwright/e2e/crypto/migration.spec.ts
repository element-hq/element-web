/*
Copyright 2024 New Vector Ltd.
Copyright 2023, 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "path";
import { readFile } from "node:fs/promises";

import { expect, test } from "../../element-web-test";

test.describe("migration", { tag: "@no-webkit" }, function () {
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

    test("Should support migration from legacy crypto", async ({ context, user, page }, workerInfo) => {
        test.slow();

        // We should see a migration progress bar
        await page.getByText("Hang tight.").waitFor({ timeout: 60000 });

        // When the progress bar first loads, it should have a high max (one per megolm session to import), and
        // a relatively low value.
        const progressBar = page.getByRole("progressbar");
        const initialProgress = parseFloat(await progressBar.getAttribute("value"));
        const initialMax = parseFloat(await progressBar.getAttribute("max"));
        expect(initialMax).toBeGreaterThan(4000);
        expect(initialProgress).toBeGreaterThanOrEqual(0);
        expect(initialProgress).toBeLessThanOrEqual(500);

        // Later, the progress should pass 50%
        await expect
            .poll(
                async () => {
                    const progressBar = page.getByRole("progressbar");
                    return (
                        (parseFloat(await progressBar.getAttribute("value")) * 100.0) /
                        parseFloat(await progressBar.getAttribute("max"))
                    );
                },
                { timeout: 60000 },
            )
            .toBeGreaterThan(50);

        // Eventually, we should get a normal matrix chat
        await page.waitForSelector(".mx_MatrixChat", { timeout: 120000 });
    });
});
