/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        exclude: ["./e2e/**/*", "./node_modules/**/*"],
        reporters: ["default"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            reporter: [["lcov", { projectRoot: "../../" }], "text"],
        },
    },
});
