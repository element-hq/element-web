/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { importCSSSheet } from "@arcmantle/vite-plugin-import-css-sheet";
import baseConfig from "@element-hq/element-web-module-api/vite.base.ts";

export default mergeConfig(baseConfig, {
    build: {
        lib: {
            entry: fileURLToPath(import.meta.resolve("./src/index.tsx")),
            name: "element-web-module-restricted-guests",
            fileName: "index",
            formats: ["es"],
        },
    },
    resolve: {
        // The node polyfills plugin adds imports of its shims to bundled workspace packages such as shared-utils.
        // Those packages don't depend on the plugin, so resolve the shims from this module instead.
        alias: Object.fromEntries(
            ["buffer", "global", "process"].map((shim) => [
                `vite-plugin-node-polyfills/shims/${shim}`,
                fileURLToPath(import.meta.resolve(`vite-plugin-node-polyfills/shims/${shim}`)),
            ]),
        ),
    },
    plugins: [
        importCSSSheet(),
        react(),
        nodePolyfills({
            include: ["events"],
        }),
    ],
});
