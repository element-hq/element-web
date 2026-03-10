/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "vitest/config";
import { env } from "node:process";

const isGHA = env["GITHUB_ACTIONS"] !== undefined;

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        exclude: ["./e2e/**/*", "./node_modules/**/*"],
        reporters: isGHA
            ? ["default", ["vitest-sonar-reporter", { outputFile: "coverage/sonar-report.xml" }]]
            : ["default"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            reporter: [["lcov", { projectRoot: "../../../" }], "text"],
        },
    },
});
