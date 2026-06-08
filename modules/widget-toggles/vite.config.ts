/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { esmExternalRequirePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import externalGlobals from "rollup-plugin-external-globals";
import svgr from "vite-plugin-svgr";
import { importCSSSheet } from "@arcmantle/vite-plugin-import-css-sheet";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.tsx"),
            name: "element-web-module-widget-toggles",
            fileName: "index",
            formats: ["es"],
        },
        outDir: "lib",
        target: "esnext",
        sourcemap: true,
        rolldownOptions: {
            plugins: [
                esmExternalRequirePlugin({
                    external: ["react"],
                }),
            ],
            output: {
                globals: {
                    // Reuse React from the host app
                    react: "window.React",
                },
            },
        },
    },
    plugins: [
        importCSSSheet(),
        react(),
        svgr(),
        nodePolyfills({
            include: ["events"],
        }),
        externalGlobals({
            // Reuse React from the host app
            react: "window.React",
        }),
    ],
    define: {
        // Use production mode for the build as it is tested against production builds of Element Web,
        // this is required for React JSX versions to be compatible.
        "process.env.NODE_ENV": "'production'",
        "process": { env: { NODE_ENV: "production" } },
    },
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        exclude: ["./e2e/**/*", "./node_modules/**/*"],
        reporters: ["default"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            reporter: [["lcov", { projectRoot: "../../../" }], "text"],
        },
        browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
        },
        setupFiles: ["tests/setupTests.ts"],
    },
});
