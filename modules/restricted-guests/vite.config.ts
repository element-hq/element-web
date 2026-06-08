/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { importCSSSheet } from "@arcmantle/vite-plugin-import-css-sheet";
import baseConfig from "@element-hq/element-web-module-api/vite.base.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(baseConfig, {
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.tsx"),
            name: "element-web-module-restricted-guests",
            fileName: "index",
            formats: ["es"],
        },
    },
    plugins: [
        importCSSSheet(),
        react(),
        nodePolyfills({
            include: ["events"],
        }),
    ],
});
