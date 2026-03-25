/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-desktop-test.js";

declare global {
    interface ElectronPlatform {
        getEventIndexingManager():
            | {
                  supportsEventIndexing(): Promise<boolean>;
              }
            | undefined;
        getPickleKey(userId: string, deviceId: string): Promise<string | null>;
        createPickleKey(userId: string, deviceId: string): Promise<string | null>;
    }

    interface Window {
        mxPlatformPeg: {
            get(): ElectronPlatform;
        };
    }
}

test.describe("App launch", () => {
    test.slow();

    test.beforeEach(async ({ page }) => {
        await page.locator("#matrixchat").waitFor();
        await page.locator(".mx_Welcome").waitFor();
    });

    test("should launch and render the welcome view successfully", async ({ page }) => {
        await expect(page).toHaveURL("vector://vector/webapp/#/welcome");
        await expect(page).toHaveScreenshot();
    });

    test("should launch and render the welcome view successfully and support seshat", async ({ page }) => {
        await expect(
            page.evaluate<boolean>(async () => {
                return window.mxPlatformPeg.get().getEventIndexingManager()?.supportsEventIndexing();
            }),
        ).resolves.toBeTruthy();
    });

    test.describe("safeStorage", () => {
        const userId = "@user:server";
        const deviceId = "ABCDEF";

        test("should be supported", async ({ page }) => {
            await expect(
                page.evaluate(
                    ([userId, deviceId]) => window.mxPlatformPeg.get().createPickleKey(userId, deviceId),
                    [userId, deviceId],
                ),
            ).resolves.not.toBeNull();
        });
    });

    test.describe("--no-update", () => {
        test.use({
            extraArgs: ["--no-update"],
        });

        // XXX: this test works fine locally but in CI the app start races with the test plumbing up the stdout/stderr pipes
        // which means the logs are missed, disabling for now.
        test.skip("should respect option", async ({ page, stdout }) => {
            expect(stdout.data.toString()).toContain("Auto update disabled via command line flag");
        });
    });
});
