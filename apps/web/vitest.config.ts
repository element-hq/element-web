/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "node",
        pool: "threads",
        globals: false,
        setupFiles: ["src/test/setupTests.ts"],
    },
});
