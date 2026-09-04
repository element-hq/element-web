/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Base vite config for building Element modules
 */

import { defineConfig } from "vite";

export default defineConfig({
    build: {
        outDir: "lib",
        target: "esnext",
        sourcemap: true,
        rolldownOptions: {
            plugins: [],
            output: {
                globals: {},
            },
        },
    },
    plugins: [],
    define: {
        // Use production mode for the build as it is tested against production builds of Element Web
        "process.env.NODE_ENV": "'production'",
        "process": { env: { NODE_ENV: "production" } },
    },
});
