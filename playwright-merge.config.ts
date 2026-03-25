/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "@playwright/test";

export default defineConfig({
    reporter: [
        ["html", { open: "never" }],
        ["./playwright/flaky-reporter.ts"],
        ["@element-hq/element-web-playwright-common/lib/stale-screenshot-reporter.js"],
    ],
});
