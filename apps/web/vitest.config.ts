/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
    resolve: {
        alias: [
            { find: "react-dom", replacement: path.resolve(__dirname, "./node_modules/react-dom") },
            {
                find: "jest-matrix-react",
                replacement: path.resolve(__dirname, "./test/test-utils/jest-matrix-react"),
            },
            // Stub out workers as they do not play well under test
            {
                find: /.*workers\/(.+)Factory/,
                replacement: path.resolve(__dirname, "./__mocks__/workerFactoryMock.js"),
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
