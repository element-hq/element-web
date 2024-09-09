/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "@playwright/test";

const baseURL = process.env["BASE_URL"] ?? "http://localhost:8080";

export default defineConfig({
    use: {
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: "retain-on-failure",
        baseURL,
        permissions: ["clipboard-write", "clipboard-read", "microphone"],
        launchOptions: {
            args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--mute-audio"],
        },
        trace: "on-first-retry",
    },
    webServer: {
        command: process.env.CI ? "npx serve -p 8080 -L ../webapp" : "yarn --cwd ../element-web start",
        url: `${baseURL}/config.json`,
        reuseExistingServer: true,
    },
    testDir: "playwright/e2e",
    outputDir: "playwright/test-results",
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["blob"], ["github"]] : [["html", { outputFolder: "playwright/html-report" }]],
    snapshotDir: "playwright/snapshots",
    snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}-{platform}{ext}",
    forbidOnly: !!process.env.CI,
});
