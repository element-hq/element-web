/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "unplugin-dts/vite";
import externalGlobals from "rollup-plugin-external-globals";

import packageJson from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "element-web-plugin-engine",
            fileName: "element-web-plugin-engine",
        },
        outDir: "lib",
        target: "esnext",
        sourcemap: true,
    },
    plugins: [
        dts(),
        externalGlobals({
            // Reuse React from the host app
            react: "window.React",
        }),
    ],
    define: {
        // We cannot use `process.env.npm_package_version` as when building element-web with module-api set to `workspace`
        // this would contain the version of element-web rather than that of the module-api.
        __VERSION__: JSON.stringify(packageJson.version),
        // Use production mode for the build as it is tested against production builds of Element Web,
        // this is required for React JSX versions to be compatible.
        process: { env: { NODE_ENV: "production" } },
    },
    test: {
        coverage: {
            provider: "v8",
            include: ["src/**/*"],
            reporter: [["lcov", { projectRoot: "../../" }]],
        },
        reporters: [
            ["default", { summary: false }],
            [
                "vitest-sonar-reporter",
                {
                    outputFile: "coverage/sonar-report.xml",
                    onWritePath(path: string): string {
                        return `packages/element-web-module-api/${path}`;
                    },
                },
            ],
        ],
    },
});
