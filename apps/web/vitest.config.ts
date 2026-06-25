/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";
import { resolve } from "node:path";

export default defineProject({
    resolve: {
        alias: [
            { find: "test-utils-rtl", replacement: resolve(__dirname, "./test/test-utils/jest-matrix-react") },
            // Stub out workers as they do not play well under test
            {
                find: /.*workers\/(.+)Factory/,
                replacement: resolve(__dirname, "./__mocks__/workerFactoryMock.js"),
            },
            {
                find: /.*waveWorker\.min\.js$/,
                replacement: resolve(__dirname, "./__mocks__/empty.js"),
            },
            {
                find: /.*decoderWorker\.min\.js$/,
                replacement: resolve(__dirname, "./__mocks__/empty.js"),
            },
            {
                find: /.*decoderWorker\.min\.wasm$/,
                replacement: resolve(__dirname, "./__mocks__/empty.js"),
            },
            // Stub this out as we lack AudioWorkletProcessor in the test env
            {
                find: "./recorderWorkletFactory",
                replacement: resolve(__dirname, "./__mocks__/empty.js"),
            },
        ],
    },
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "node",
        pool: "threads",
        globals: false,
        setupFiles: ["src/test/setupTests.ts"],
    },
});
