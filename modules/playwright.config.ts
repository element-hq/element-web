/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig, devices, type Project } from "@playwright/test";
import fs, { globSync } from "node:fs";
import path from "node:path";

import type { Options } from "./playwright/element-web-test";

const chromeProject = {
    ...devices["Desktop Chrome"],
    channel: "chromium",
    permissions: ["clipboard-write", "clipboard-read", "microphone"],
    launchOptions: {
        args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--mute-audio"],
    },
    connectOptions: process.env.PW_TEST_CONNECT_WS_ENDPOINT
        ? {
              wsEndpoint: process.env.PW_TEST_CONNECT_WS_ENDPOINT,
              exposeNetwork: "<loopback>",
          }
        : undefined,
};

/**
We assume that all modules will have the following directory structure:
<repo_root>
└── modules/
    └── my-module/
        └── element-web/
            ├── e2e/
            │   ├── test-1.spec.ts
            │   └── test-2.spec.ts
            └── package.json

The following code maps each such module (my-module in the example above) to a separate
playwright project.
 */
const projects: Project<Options>[] = [];

// Get all the directories that hold playwright tests
const moduleTestDirectories = globSync("modules/*/element-web/e2e", {});

// Process each directory
for (const testDirectory of moduleTestDirectories) {
    // Based on the directory structure, the parent directory of the test directory holds package.json.
    const moduleDirectory = path.join(testDirectory, "..");

    // Get module name from package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(moduleDirectory, "package.json"), "utf-8"));
    const MODULE_PREFIX = "@element-hq/element-web-module-";
    const name = packageJson.name.startsWith(MODULE_PREFIX)
        ? packageJson.name.slice(MODULE_PREFIX.length)
        : packageJson.name;

    // Create playwright project
    projects.push({
        name,
        use: {
            ...chromeProject,
            moduleDir: moduleDirectory,
        },
        testDir: testDirectory,
        snapshotDir: `${testDirectory}/snapshots`,
        outputDir: `${testDirectory}/_results`,
    });
}

const baseURL = process.env["BASE_URL"] ?? "http://localhost:8080";

export default defineConfig<Options>({
    projects,
    use: {
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        video: "retain-on-failure",
        baseURL,
        trace: "on-first-retry",
    },
    webServer: {
        command: process.env.WEBAPP_PATH
            ? `npx serve -p 8080 -L ${process.env.WEBAPP_PATH}`
            : "docker run --rm -p 8080:80 ghcr.io/element-hq/element-web:develop",
        url: `${baseURL}/config.json`,
        reuseExistingServer: true,
        timeout: (process.env.CI ? 30 : 120) * 1000,
    },
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI
        ? [
              ["list"],
              ["html"],
              ["github"],
              ["@element-hq/element-web-playwright-common/lib/stale-screenshot-reporter.js"],
          ]
        : [["list"], ["html", { outputFolder: "playwright-html-report" }]],
    // When running the browser in docker, set the platform to `linux` as that is the platform where the browser is running
    snapshotPathTemplate: `{snapshotDir}/{testFilePath}/{arg}-${process.env.PW_TEST_CONNECT_WS_ENDPOINT ? "linux" : "{platform}"}{ext}`,
    forbidOnly: !!process.env.CI,
});
