/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "element-web-plugin-opendesk-nordeck",
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
            transform: {
                define: {
                    // Use production mode for the build as it is tested against production builds of Element Web,
                    // this is required for React JSX versions to be compatible.
                    "process.env.NODE_ENV": JSON.stringify("production"),
                },
            },
        },
        minify: false,
    },
    plugins: [
        react(),
        nodePolyfills({
            include: ["events"],
        }),
    ],
});
