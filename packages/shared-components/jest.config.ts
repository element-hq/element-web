/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { env } from "process";

import type { Config } from "jest";

const config: Config = {
    testEnvironment: "jsdom",
    testEnvironmentOptions: {
        url: "http://localhost/",
    },
    testMatch: ["<rootDir>/src/**/*.test.[tj]s?(x)"],
    setupFilesAfterEnv: ["<rootDir>/src/test/setupTests.ts"],
    moduleNameMapper: {
        // Support CSS module
        "\\.(module.css)$": "identity-obj-proxy",
        "\\.(css|scss|pcss)$": "<rootDir>/__mocks__/cssMock.js",
        "\\.(gif|png|ttf|woff2)$": "<rootDir>/__mocks__/imageMock.js",
        "\\.svg$": "<rootDir>/__mocks__/svg.js",
        "\\$webapp/i18n/languages.json": "<rootDir>/../../__mocks__/languages.json",
        "^react$": "<rootDir>/node_modules/react",
        "^react-dom$": "<rootDir>/node_modules/react-dom",
        "waveWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "context-filter-polyfill": "<rootDir>/__mocks__/empty.js",
        "workers/(.+)Factory": "<rootDir>/__mocks__/workerFactoryMock.js",
    },
    transformIgnorePatterns: [
        "/node_modules/(?!(mime|matrix-js-sdk|uuid|p-retry|is-network-error|react-merge-refs|@storybook|storybook)).+$",
    ],
    collectCoverageFrom: [
        "<rootDir>/src/**/*.{js,ts,tsx}",
        "<rootDir>/packages/**/*.{js,ts,tsx}",
        // Coverage chokes on type definition files
        "!<rootDir>/src/**/*.d.ts",
    ],
    coverageReporters: ["text-summary", "lcov"],
    testResultsProcessor: "@casualbot/jest-sonar-reporter",
    prettierPath: null,
    moduleDirectories: ["node_modules", "./src/test/utils"],
};

// if we're running under GHA, enable the GHA reporter
if (env["GITHUB_ACTIONS"] !== undefined) {
    const reporters: Config["reporters"] = [["github-actions", { silent: false }], "summary"];

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push("<rootDir>/../../test/slowReporter.cjs");
    }
    config.reporters = reporters;
}

export default config;
