/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "@playwright/test";

export default defineConfig({
    // Playwright only supports merging using a single testDir, specifying web here
    // means that some parts of the report for Desktop will be incorrect, but this is minor.
    // https://github.com/microsoft/playwright/issues/39855
    testDir: "apps/web/playwright/e2e",
    reporter: [
        ["html", { open: "never" }],
        ["./packages/playwright-common/src/flaky-reporter.ts"],
        ["./packages/playwright-common/src/stale-screenshot-reporter.ts"],
    ],
});
