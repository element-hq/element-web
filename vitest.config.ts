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
        tests.sort((x, y) => x.diagnostic()!.duration - y.diagnostic()!.duration);
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

/**
 * Whether the error, or anything in its `cause` chain, is Vitest failing to deliver a console message because the
 * test file's worker was already shutting down. This is a race inside Vitest
 * (https://github.com/vitest-dev/vitest/issues/11153): every test passes, only the log line is lost.
 */
function isConsoleLogTeardownError(error: unknown): boolean {
    for (let current = error; current && typeof current === "object"; current = (current as Error).cause) {
        const { name, message } = current as Error;
        if (name === "EnvironmentTeardownError" && message?.includes('Closing rpc while "onUserConsoleLog"')) {
            return true;
        }
    }
    return false;
}

export default defineConfig({
    oxc: {
        // Configure the ts loader to handle all the files we may throw at it
        include: /\.[cm]?tsx?$/,
    },
    test: {
        projects: ["{apps,modules,packages}/*/vitest.config.ts"],
        coverage: {
            provider: "v8",
            include: ["{apps,modules,packages}/*/src/**/*.{cts,ts,tsx}"],
            exclude: [
                // Exclude test files
                "**/*.{stories,test}.{ts,tsx}",
                "**/*.test.browser.{ts,tsx}",
                // Exclude test utilities
                "**/src/test/**",
                // Exclude mocks
                "**/src/**/*-{mock,mocks}.{ts,tsx}",
                // Exclude type definition files
                "**/*.d.ts",
                // Exclude playwright-common as it is just test utilities
                "packages/playwright-common/**",
            ],
            reporter: [["lcov"]],
        },
        reporters,
        onUnhandledError(error) {
            if (isConsoleLogTeardownError(error)) {
                console.warn("Ignoring Vitest console teardown race:", error.message);
                return false;
            }
        },
    },
});
