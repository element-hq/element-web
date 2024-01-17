/*
Copyright 2023-2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import path from "path";
import { readFile } from "node:fs/promises";

import { expect, test as base } from "../../element-web-test";

const test = base.extend({
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

test.describe("migration", function () {
    test.use({ displayName: "Alice" });

    test("Should support migration from legacy crypto", async ({ context, user, page }, workerInfo) => {
        test.skip(workerInfo.project.name === "Legacy Crypto", "This test only works with Rust crypto.");
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
