/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import dts from "unplugin-dts/vite";

export default defineConfig({
    build: {
        lib: {
            entry: fileURLToPath(import.meta.resolve("./src/index.ts")),
            name: "element-web-shared-utils",
            fileName: "element-web-shared-utils",
        },
        outDir: "lib",
        target: "esnext",
        sourcemap: true,
    },
    plugins: [
        dts({
            bundleTypes: {
                invokeOptions: {
                    localBuild: !!process.env.CI,
                    // oxlint-disable-next-line unicorn/prefer-module
                    typescriptCompilerFolder: path.resolve(require.resolve("@typescript/old"), "../.."),
                },
            },
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts"],
            copyDtsFiles: false,
        }),
    ],
    define: {
        // Use production mode for the build as it is tested against production builds of Element Web.
        process: { env: { NODE_ENV: "production" } },
    },
});
