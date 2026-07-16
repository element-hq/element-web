/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defineProject } from "vitest/config";

export default defineProject({
    resolve: {
        alias: [
            { find: "test-utils-rtl", replacement: import.meta.resolve("./test/test-utils/vitest-matrix-react") },
            { find: "test-utils", replacement: import.meta.resolve("./test/test-utils") },
            // Stub out workers as they do not play well under test
            {
                find: /.*workers\/(.+)Factory/,
                replacement: import.meta.resolve("./__mocks__/workerFactoryMock.js"),
            },
            {
                find: /.*waveWorker\.min\.js$/,
                replacement: import.meta.resolve("./__mocks__/empty.js"),
            },
            {
                find: /.*decoderWorker\.min\.js$/,
                replacement: import.meta.resolve("./__mocks__/empty.js"),
            },
            {
                find: /.*decoderWorker\.min\.wasm$/,
                replacement: import.meta.resolve("./__mocks__/empty.js"),
            },
            // Stub this out as we lack AudioWorkletProcessor in the test env
            {
                find: "./recorderWorkletFactory",
                replacement: import.meta.resolve("./__mocks__/empty.js"),
            },
            // Stub out legacy modules so we don't need to build them first
            {
                find: "../modules.js",
                replacement: import.meta.resolve("./__mocks__/empty.js"),
            },
        ],
    },
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "node",
        pool: "threads",
        globals: false,
        setupFiles: ["src/test/setupTests.ts"],
        environmentOptions: {
            happyDOM: {
                url: "http://localhost/",
            },
        },
    },
});
