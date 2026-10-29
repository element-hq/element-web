/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test, expect } from "../../element-desktop-test.js";

declare global {
    interface Window {
        electron: {
            x509: {
                getUserCertificate(): Promise<
                    { ok: true; data: { certificate: { subject: string } } } | { ok: false; error: unknown }
                >;
            };
        };
    }
}

const fixturesDir = fileURLToPath(import.meta.resolve("../../../src/__fixtures__/x509/"));

test.describe("X.509", () => {
    test.slow();

    test.use({
        extraArgs: async ({ tmpDir }, use) => {
            // Provision alice's certificate chain and point the app's config at it.
            const chainPath = path.join(tmpDir, "chain.pem");
            const chain = await Promise.all(
                ["alice.pem", "intermediate-ca.pem"].map((name) => fs.readFile(path.join(fixturesDir, name), "utf8")),
            );
            await fs.writeFile(chainPath, chain.join(""));

            const configPath = path.join(tmpDir, "config.json");
            const config = { x509: { library_path: "/nonexistent", certificate_path: chainPath } };
            await fs.writeFile(configPath, JSON.stringify(config));

            await use(["--config", configPath]);
        },
    });

    test("should return the user's certificate over IPC", async ({ page }) => {
        await page.locator("#matrixchat").waitFor();

        // Make sure we can serialise the result over IPC.
        const result = await page.evaluate(() => window.electron.x509.getUserCertificate());

        // Check that it contains the expected subject.
        expect(result).toMatchObject({
            ok: true,
            data: { certificate: { subject: expect.stringContaining("CN=alice") } },
        });
    });
});
