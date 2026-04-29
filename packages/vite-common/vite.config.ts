/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig, type ViteUserConfig } from "vitest/config";
import { type Reporter } from "vitest/reporters";
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
    reporters.push([
        "vitest-sonar-reporter",
        {
            outputFile: "coverage/sonar-report.xml",
            onWritePath: (path): string => `${process.cwd()}/${path}`,
        },
    ]);

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push(slowTestReporter);
    }
}

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            reporter: [["lcov", { projectRoot: "../../" }]],
        },
        environment: "node",
        reporters,
        pool: "threads",
        globals: false,
        include: ["src/**/*.test.ts"],
    },
});
