/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Base vite config for building Element modules
 */

import { defineConfig, esmExternalRequirePlugin } from "vite";
import externalGlobals from "rollup-plugin-external-globals";

export default defineConfig({
    build: {
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
});
