/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { env, platform } from "node:process";
import { defineProject } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Tests that need a real browser rather than the happy-dom environment used by
// `vitest.config.ts` — currently those which rasterise to a <canvas> and assert
// on the pixels, which needs a real 2D context and real font metrics.

// Screenshot baselines only mean anything where the rendering is pinned: the
// generic `sans-serif` the badges use resolves to a different typeface on each
// OS, so a macOS baseline would never match CI. We therefore only commit linux
// baselines, and only assert against them when running somewhere that renders
// the same way — CI, or the pinned container that `playwright-screenshots`
// starts (it sets PW_TEST_CONNECT_WS_ENDPOINT). Everywhere else the screenshot
// assertions skip; the rest of the suite still runs.
const wsEndpoint = env["PW_TEST_CONNECT_WS_ENDPOINT"];
const canCompareScreenshots = Boolean(wsEndpoint || env["CI"]);
const browserPlatform = canCompareScreenshots ? "linux" : platform;

export default defineProject({
    test: {
        name: "web-browser",
        include: ["src/**/*.test.browser.{ts,tsx}"],
        provide: { canCompareScreenshots },
        browser: {
            enabled: true,
            headless: true,
            provider: playwright({
                contextOptions: {
                    reducedMotion: "reduce",
                    colorScheme: "light",
                    deviceScaleFactor: 1,
                },
                launchOptions: {
                    // Force consistent font rendering, as per packages/shared-components
                    args: ["--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text"],
                },
                connectOptions: wsEndpoint ? { wsEndpoint, exposeNetwork: "<loopback>" } : undefined,
            }),
            instances: [{ browser: "chromium" }],
            expect: {
                toMatchScreenshot: {
                    comparatorName: "pixelmatch",
                    comparatorOptions: {
                        // Enough to absorb sub-pixel antialiasing noise, but far less
                        // than a clipped or misplaced glyph moves.
                        allowedMismatchedPixelRatio: 0.02,
                    },
                    // Baselines are grouped by platform, and only the linux ones are
                    // committed — see apps/web/.gitignore.
                    resolveScreenshotPath: ({
                        root,
                        testFileDirectory,
                        screenshotDirectory,
                        testFileName,
                        arg,
                        ext,
                        browserName,
                    }) =>
                        `${root}/${testFileDirectory}/${screenshotDirectory}/${browserPlatform}/${testFileName}/${arg}-${browserName}${ext}`,
                },
            },
        },
    },
});
