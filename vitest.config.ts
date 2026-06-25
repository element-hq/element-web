/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig, type ViteUserConfig } from "vitest/config";
import { type Reporter } from "vitest/node";
import { env } from "node:process";

const reporters: NonNullable<ViteUserConfig["test"]>["reporters"] = [["default"]];

const slowTestReporter: Reporter = {
    onTestRunEnd(testModules, unhandledErrors, reason) {
        const tests = testModules
            .flatMap((m) => Array.from(m.children.allTests()))
            .filter((test) => test.diagnostic()?.slow);
        tests.sort((x, y) => x.diagnostic()!.duration! - y.diagnostic()!.duration!);
        tests.reverse();

        if (tests.length > 0) {
            console.warn("Slowest 10 tests:");
        }
        for (const t of tests.slice(0, 10)) {
            console.warn(`${t.module.moduleId} > ${t.fullName}: ${t.diagnostic()?.duration.toFixed(0)}ms`);
        }
    },
};

// if we're running under GHA, enable the GHA & Sonar reporters
if (env["GITHUB_ACTIONS"] !== undefined) {
    reporters.push(["github-actions", { silent: false }]);

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push(slowTestReporter);
    }
}

export default defineConfig({
    oxc: {
        // Configure the ts loader to handle all the files we may throw at it
        include: /\.[cm]?tsx?$/,
    },
    test: {
        projects: [
            "{apps,modules,packages}/*/vitest.config.ts",
            // We run shared-components separately for now as vitest lacks support for nested projects
            // https://github.com/vitest-dev/vitest/issues/8544
            "!packages/shared-components",
        ],
        coverage: {
            provider: "v8",
            include: ["{apps,modules,packages}/*/src/**/*.{cts,ts,tsx}"],
            exclude: [
                // Exclude test files
                "**/*.{stories,test}.{ts,tsx}",
                // Exclude test utilities
                "**/src/test/**",
                // Exclude type definition files
                "**/*.d.ts",
            ],
            reporter: [["lcov"]],
        },
        reporters,
    },
});
