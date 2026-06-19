/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { env } from "node:process";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Config } from "jest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: Config = {
    testEnvironment: "jest-fixed-jsdom",
    testEnvironmentOptions: {
        url: "http://localhost/",
        // This is needed to be able to load dual CJS/ESM WASM packages e.g. rust crypto & matrix-wywiwyg
        customExportConditions: ["browser", "node"],
    },
    transform: {
        "\\.[jt]sx?$": "babel-jest",
    },
    testMatch: ["<rootDir>/test/**/*-test.[tj]s?(x)"],
    globalSetup: "<rootDir>/test/globalSetup.ts",
    setupFiles: ["jest-canvas-mock", "web-streams-polyfill/polyfill"],
    setupFilesAfterEnv: ["<rootDir>/test/setupTests.ts"],
    moduleNameMapper: {
        // Support CSS module
        "\\.(module.css)$": "identity-obj-proxy",
        "\\.(css|scss|pcss)(\\?raw)?$": "<rootDir>/__mocks__/cssMock.js",
        "\\.(gif|png|ttf|woff2)$": "<rootDir>/__mocks__/imageMock.js",
        "\\.svg$": "<rootDir>/__mocks__/svg.js",
        "^matrix-js-sdk(.*)$": "<rootDir>/node_modules/matrix-js-sdk$1",
        "^react$": "<rootDir>/node_modules/react",
        "^react-dom$": "<rootDir>/node_modules/react-dom",
        "decoderWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "decoderWorker\\.min\\.wasm": "<rootDir>/__mocks__/empty.js",
        "waveWorker\\.min\\.js": "<rootDir>/__mocks__/empty.js",
        "context-filter-polyfill": "<rootDir>/__mocks__/empty.js",
        "workers/(.+)Factory": "<rootDir>/__mocks__/workerFactoryMock-jest.js",
        ".*\\?raw": "jest-raw-loader",
        "recorderWorkletFactory": "<rootDir>/__mocks__/empty.js",
        "@vector-im/compound-web": "<rootDir>/node_modules/@vector-im/compound-web",
        "^vitest$": "<rootDir>/__mocks__/empty.js",
        "jest-mock-vitest-adapter": "<rootDir>/test/setup/adapter.ts",
        "test-utils-rtl": "<rootDir>/test/test-utils/jest-matrix-react.tsx",
    },
    transformIgnorePatterns: [
        `${path.join(__dirname, "../..")}/node_modules/.pnpm/(?!(mime|uuid|p-retry|is-network-error|react-merge-refs|is-ip|ip-regex|super-regex|function-timeout|time-span|convert-hrtime|clone-regexp|is-regexp|matrix-web-i18n|await-lock|@element-hq/web-shared-components|react-virtuoso|lodash|domutils|domhandler|domelementtype|dom-serializer|entities)).+$`,
    ],
    collectCoverageFrom: [
        "<rootDir>/src/**/*.{js,ts,tsx}",
        // getSessionLock is piped into a different JS context via stringification, and the coverage functionality is
        // not available in that contest. So, turn off coverage instrumentation for it.
        "!<rootDir>/src/utils/SessionLock.ts",
        // Coverage chokes on type definition files
        "!<rootDir>/src/**/*.d.ts",
        // Ignore vitest tests
        "!<rootDir>/src/**/*.test.{ts,tsx}",
        "!<rootDir>/src/test/**",
    ],
    coverageReporters: ["text-summary", ["lcov", { projectRoot: "../../" }]],
    prettierPath: null,
    moduleDirectories: ["node_modules", "test/test-utils"],
    workerIdleMemoryLimit: "512MB",
};

// if we're running under GHA, enable relevant reporters
if (env["GITHUB_ACTIONS"] !== undefined) {
    config.reporters ??= [];
    config.reporters.push(["github-actions", { silent: false }]);
    config.reporters.push("summary");

    // if we're running against the develop branch, also enable the slow test reporter
    if (env["GITHUB_REF"] == "refs/heads/develop") {
        config.reporters.push("<rootDir>/test/slowReporter.cjs");
    }
}

export default config;
