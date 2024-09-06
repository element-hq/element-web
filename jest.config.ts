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
    testEnvironmentOptions: {
        url: "http://localhost/",
    },
    testMatch: ["<rootDir>/test/**/*-test.[tj]s?(x)"],
    setupFiles: ["jest-canvas-mock"],
    setupFilesAfterEnv: ["<rootDir>/node_modules/matrix-react-sdk/test/setupTests.ts"],
    moduleNameMapper: {
        "\\.(css|scss|pcss)$": "<rootDir>/__mocks__/cssMock.js",
        "\\.(gif|png|ttf|woff2)$": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/imageMock.js",
        "\\.svg$": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/svg.js",
        "\\$webapp/i18n/languages.json": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/languages.json",
        "^react$": "<rootDir>/node_modules/react",
        "^react-dom$": "<rootDir>/node_modules/react-dom",
        "^matrix-js-sdk$": "<rootDir>/node_modules/matrix-js-sdk/src",
        "^matrix-react-sdk$": "<rootDir>/node_modules/matrix-react-sdk/src",
        "decoderWorker\\.min\\.js": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/empty.js",
        "decoderWorker\\.min\\.wasm": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/empty.js",
        "waveWorker\\.min\\.js": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/empty.js",
        "context-filter-polyfill": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/empty.js",
        "FontManager.ts": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/FontManager.js",
        "workers/(.+)Factory": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/workerFactoryMock.js",
        "^!!raw-loader!.*": "jest-raw-loader",
        "recorderWorkletFactory": "<rootDir>/node_modules/matrix-react-sdk/__mocks__/empty.js",
        "^fetch-mock$": "<rootDir>/node_modules/fetch-mock",
    },
    transformIgnorePatterns: ["/node_modules/(?!matrix-js-sdk).+$", "/node_modules/(?!matrix-react-sdk).+$"],
    coverageReporters: ["text-summary", "lcov"],
    testResultsProcessor: "@casualbot/jest-sonar-reporter",
};

// if we're running under GHA, enable the GHA reporter
if (env["GITHUB_ACTIONS"] !== undefined) {
    config.reporters = [["github-actions", { silent: false }], "summary"];
}

export default config;
