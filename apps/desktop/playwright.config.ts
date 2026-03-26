/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "@playwright/test";

const projects = [
    "macos",
    "win-x64",
    "win-ia32",
    "win-arm64",
    "linux-amd64-sqlcipher-system",
    "linux-amd64-sqlcipher-static",
    "linux-arm64-sqlcipher-system",
    "linux-arm64-sqlcipher-static",
];

export default defineConfig({
    // Allows the GitHub action to specify a project name (OS + arch) for the combined report to make sense
    // workaround for https://github.com/microsoft/playwright/issues/33521
    projects: process.env.CI
        ? projects.map((name) => ({
              name,
          }))
        : undefined,
    use: {
        viewport: { width: 1280, height: 720 },
        video: "retain-on-failure",
        trace: "on-first-retry",
    },
    testDir: "playwright/e2e",
    outputDir: "playwright/test-results",
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["blob"], ["github"]] : [["html", { outputFolder: "playwright/html-report" }]],
    snapshotDir: "playwright/snapshots",
    snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}-{platform}{ext}",
    timeout: 30 * 1000,
});
