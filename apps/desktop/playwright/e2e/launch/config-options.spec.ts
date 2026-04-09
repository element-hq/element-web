/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { test, expect } from "../../element-desktop-test.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

test.describe("App config options", () => {
    test.describe("Should load custom config via env", () => {
        test.slow();
        test.use({
            extraEnv: {
                ELEMENT_DESKTOP_CONFIG_JSON: resolve(__dirname, "../..", "fixtures/custom-config.json"),
            },
        });
        test("should launch and use configured homeserver", async ({ page }) => {
            await page.locator("#matrixchat").waitFor();
            await page.locator(".mx_Welcome").waitFor();
            await expect(page).toHaveURL("vector://vector/webapp/#/welcome");
            await page.getByText("Sign in").click();
            await page.getByText("matrix.example.org", { exact: true }).waitFor();
        });
    });
    test.describe("Should load custom config via argument", () => {
        test.slow();
        test.use({
            extraArgs: ["--config", resolve(__dirname, "../..", "fixtures/custom-config.json")],
        });
        test("should launch and use configured homeserver", async ({ page }) => {
            await page.locator("#matrixchat").waitFor();
            await page.locator(".mx_Welcome").waitFor();
            await expect(page).toHaveURL("vector://vector/webapp/#/welcome");
            await page.getByText("Sign in").click();
            await page.getByText("matrix.example.org", { exact: true }).waitFor();
        });
    });
});
