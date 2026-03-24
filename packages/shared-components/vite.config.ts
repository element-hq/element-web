/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 *
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import dts from "vite-plugin-dts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "Element Web Shared Components",
            // the proper extensions will be added
            fileName: "element-web-shared-components",
        },
        outDir: "dist",
        rolldownOptions: {
            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: [
                "@vector-im/compound-design-tokens",
                "@vector-im/compound-web",
                "react-virtuoso",
                "react-resizable-panels",
            ],
            plugins: [
                esmExternalRequirePlugin({
                    external: ["react", "react-dom"],
                }),
            ],
            output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    "react": "react",
                    "@vector-im/compound-design-tokens": "compoundDesignTokens",
                    "@vector-im/compound-web": "compoundWeb",
                    "react-virtuoso": "reactVirtuoso",
                },
            },
        },
    },
    plugins: [
        dts({
            rollupTypes: true,
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.{ts,tsx}"],
            copyDtsFiles: true,
        }),
    ],
});
