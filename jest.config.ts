/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { env } from "process";

import type { Config } from "jest";

const config: Config = {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/test/**/*-test.[jt]s?(x)"],
    globalSetup: "<rootDir>/test/globalSetup.ts",
    setupFiles: ["jest-canvas-mock", "web-streams-polyfill/polyfill"],
    setupFilesAfterEnv: ["<rootDir>/test/setupTests.ts"],
    moduleNameMapper: {
        "\\.(gif|png|ttf|woff2)$": "<rootDir>/__mocks__/imageMock.js",
        "\\.svg$": "<rootDir>/__mocks__/svg.js",
        "\\$webapp/i18n/languages.json": "<rootDir>/__mocks__/languages.json",
        "decoderWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "decoderWorker\\.min\\.wasm": "<rootDir>/__mocks__/empty.js",
        "waveWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "workers/(.+)Factory": "<rootDir>/__mocks__/workerFactoryMock.js",
        "^!!raw-loader!.*": "jest-raw-loader",
        "recorderWorkletFactory": "<rootDir>/__mocks__/empty.js",
    },
    transformIgnorePatterns: ["/node_modules/(?!matrix-js-sdk).+$"],
    collectCoverageFrom: [
        "<rootDir>/src/**/*.{js,ts,tsx}",
        // getSessionLock is piped into a different JS context via stringification, and the coverage functionality is
        // not available in that contest. So, turn off coverage instrumentation for it.
        "!<rootDir>/src/utils/SessionLock.ts",
    ],
    coverageReporters: ["text-summary", "lcov"],
    testResultsProcessor: "@casualbot/jest-sonar-reporter",
    prettierPath: null,
};

// if we're running under GHA, enable the GHA reporter
if (env["GITHUB_ACTIONS"] !== undefined) {
    const reporters: Config["reporters"] = [["github-actions", { silent: false }], "summary"];

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push("<rootDir>/test/slowReporter.cjs");
    }
    config.reporters = reporters;
}

export default config;
