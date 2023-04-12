/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { env } from "process";

import type { Config } from "jest";

const config: Config = {
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/test/**/*-test.[jt]s?(x)"],
    globalSetup: "<rootDir>/test/globalSetup.js",
    setupFiles: ["jest-canvas-mock"],
    setupFilesAfterEnv: ["<rootDir>/test/setupTests.js"],
    moduleNameMapper: {
        "\\.(gif|png|ttf|woff2)$": "<rootDir>/__mocks__/imageMock.js",
        "\\.svg$": "<rootDir>/__mocks__/svg.js",
        "\\$webapp/i18n/languages.json": "<rootDir>/__mocks__/languages.json",
        "decoderWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "decoderWorker\\.min\\.wasm": "<rootDir>/__mocks__/empty.js",
        "waveWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "workers/(.+)\\.worker\\.ts": "<rootDir>/__mocks__/workerMock.js",
        "^!!raw-loader!.*": "jest-raw-loader",
        "RecorderWorklet": "<rootDir>/__mocks__/empty.js",
    },
    transformIgnorePatterns: ["/node_modules/(?!matrix-js-sdk).+$"],
    collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"],
    coverageReporters: ["text-summary", "lcov"],
    testResultsProcessor: "@casualbot/jest-sonar-reporter",
};

// if we're running under GHA, enable the GHA reporter
if (env["GITHUB_ACTIONS"] !== undefined) {
    const reporters: Config["reporters"] = [["github-actions", { silent: false }], "summary"];

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push("<rootDir>/test/slowReporter.js");
    }
    config.reporters = reporters;
}

export default config;
