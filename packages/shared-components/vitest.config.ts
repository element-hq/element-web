/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/// <reference types="@vitest/browser-playwright" />

import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { storybookVis } from "storybook-addon-vis/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { InlineConfig } from "vite";
import { Reporter } from "vitest/reporters";
import { env } from "process";

const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const reporters: NonNullable<InlineConfig["test"]>["reporters"] = [["default"]];
const slowTestReporter: Reporter = {
    onTestRunEnd(testModules, unhandledErrors, reason) {
        const tests = testModules
            .flatMap((m) => Array.from(m.children.allTests()))
            .filter((test) => test.diagnostic()?.slow);
        tests.sort((x, y) => x.diagnostic()?.duration! - y.diagnostic()?.duration!);
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
    reporters.push([
        "github-actions",
        {
            silent: false,
        },
    ]);

    reporters.push([
        "vitest-sonar-reporter",
        {
            outputFile: "coverage/sonar-report.xml",
            onWritePath: (path) => `packages/shared-components/${path}`,
        },
    ]);

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push(slowTestReporter);
    }
}

export default defineConfig({
    css: {
        modules: {
            // Stabilise snapshots by stripping the hash component of the CSS module class name
            generateScopedName: (name) => name,
        },
    },
    test: {
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.stories.tsx"],
            reporter: [["lcov", { projectRoot: "../../" }]],
        },
        reporters,
        globals: false,
        pool: "threads",
        projects: [
            {
                extends: true,
                plugins: [
                    // The plugin will run tests for the stories defined in your Storybook config
                    // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
                    storybookTest({
                        configDir: path.join(dirname, ".storybook"),
                        storybookScript: "storybook --ci",
                    }),
                    storybookVis({}),
                ],
                test: {
                    name: "storybook",
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({ contextOptions: { reducedMotion: "reduce" } }),
                        instances: [{ browser: "chromium" }],
                    },
                    setupFiles: [".storybook/vitest.setup.ts"],
                },
            },
            {
                extends: true,
                plugins: [nodePolyfills({ include: ["util"], globals: { global: false } })],
                test: {
                    name: "unit",
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({}),
                        instances: [{ browser: "chromium" }],
                    },
                    setupFiles: ["src/test/setupTests.ts"],
                },
            },
        ],
    },
    optimizeDeps: {
        include: ["vite-plugin-node-polyfills/shims/buffer", "vite-plugin-node-polyfills/shims/process"],
    },
    resolve: {
        alias: {
            "@test-utils": path.resolve(__dirname, "./src/test/utils/index.tsx"),
        },
    },
});
