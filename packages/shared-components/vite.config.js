/*
 *
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 * /
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
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
        rollupOptions: {
            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: ["react", "react-dom", "@vector-im/compound-design-tokens", "@vector-im/compound-web"],
            output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    "react": "react",
                    "react-dom": "ReactDom",
                },
            },
        },
    },
    resolve: {
        alias: {
            // Alias used by i18n.tsx
            $webapp: resolve(__dirname, "..", "..", "webapp"),
        },
    },
    plugins: [
        dts({
            rollupTypes: true,
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.test.{ts,tsx}"],
            copyDtsFiles: true,
        }),
    ],
});
