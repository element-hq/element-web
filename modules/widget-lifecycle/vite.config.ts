/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "element-web-module-widget-lifecycle",
            fileName: "index",
            formats: ["es"],
        },
        outDir: "lib",
        target: "esnext",
        sourcemap: true,
        minify: false,
    },
    test: {
        include: ["tests/**/*.test.ts"],
        exclude: ["./e2e/**/*", "./node_modules/**/*"],
        reporters: ["default"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            reporter: [["lcov", { projectRoot: "../../../" }], "text"],
        },
    },
});
