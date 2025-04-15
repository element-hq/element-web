/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig, devices } from "@playwright/test";

import { type WorkerOptions } from "./playwright/services";

const baseURL = process.env["BASE_URL"] ?? "http://localhost:8080";

const chromeProject = {
    ...devices["Desktop Chrome"],
    channel: "chromium",
    permissions: ["clipboard-write", "clipboard-read", "microphone"],
    launchOptions: {
        args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--mute-audio"],
    },
};

export default defineConfig<WorkerOptions>({
    projects: [
        {
            name: "Chrome",
            use: {
                ...chromeProject,
            },
        },
        {
            name: "Firefox",
            use: {
                ...devices["Desktop Firefox"],
                launchOptions: {
                    firefoxUserPrefs: {
                        "permissions.default.microphone": 1,
                    },
                },
                // This is needed to work around an issue between Playwright routes, Firefox, and Service workers
                // https://github.com/microsoft/playwright/issues/33561#issuecomment-2471642120
                serviceWorkers: "block",
            },
            ignoreSnapshots: true,
        },
        {
            name: "WebKit",
            use: {
                ...devices["Desktop Safari"],
                // Seemingly WebKit has the same issue as Firefox in Playwright routes not working
                // https://playwright.dev/docs/network#missing-network-events-and-service-workers
                serviceWorkers: "block",
            },
            ignoreSnapshots: true,
        },
        {
            name: "Dendrite",
            use: {
                ...chromeProject,
                homeserverType: "dendrite",
            },
            ignoreSnapshots: true,
        },
        {
            name: "Pinecone",
            use: {
                ...chromeProject,
                homeserverType: "pinecone",
            },
            ignoreSnapshots: true,
        },
    ],
    use: {
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: "retain-on-failure",
        baseURL,
        trace: "on-first-retry",
    },
    webServer: {
        command: process.env.CI ? "npx serve -p 8080 -L ./webapp" : "yarn start",
        url: `${baseURL}/config.json`,
        reuseExistingServer: true,
        timeout: (process.env.CI ? 30 : 120) * 1000,
        stdout: "pipe",
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
