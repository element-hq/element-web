/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import dts from "unplugin-dts/vite";

import packageJson from "./package.json" with { type: "json" };

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
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts"],
            copyDtsFiles: false,
        }),
    ],
    define: {
        // We cannot use `process.env.npm_package_version` as when building element-web with module-api set to `workspace`
        // this would contain the version of element-web rather than that of the module-api.
        __VERSION__: JSON.stringify(packageJson.version),
        // Use production mode for the build as it is tested against production builds of Element Web.
        process: { env: { NODE_ENV: "production" } },
    },
});
