/* Copyright 2023 The Matrix.org Foundation C.I.C.

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

import type { Config } from "jest";
import { env } from "process";

const config: Config = {
    testEnvironment: "node",
    testMatch: ["<rootDir>/spec/**/*.spec.{js,ts}"],
    setupFilesAfterEnv: ["<rootDir>/spec/setupTests.ts"],
    collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts}"],
    coverageReporters: ["text-summary", "lcov"],
    testResultsProcessor: "@casualbot/jest-sonar-reporter",

    // Always print out a summary if there are any failing tests. Normally
    // a summary is only printed if there are more than 20 test *suites*.
    reporters: [["default", { summaryThreshold: 0 }]],
};

// if we're running under GHA, enable the GHA reporter
if (env["GITHUB_ACTIONS"] !== undefined) {
    const reporters: Config["reporters"] = [
        ["github-actions", { silent: false }],
        // as above: always show a summary if there were any failing tests.
        ["summary", { summaryThreshold: 0 }],
    ];

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        reporters.push("<rootDir>/spec/slowReporter.js");
    }
    config.reporters = reporters;
}

export default config;
