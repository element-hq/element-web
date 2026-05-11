/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 *
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, esmExternalRequirePlugin, type Plugin } from "vite";
import dts from "unplugin-dts/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssLayerOrder = "@layer compound-tokens, compound-web, shared-components, app-web;";
const sharedComponentsLayer = "shared-components";

function layerCssAssets(): Plugin {
    return {
        name: "element-web-shared-components-css-layer",
        writeBundle(_options, bundle): void {
            for (const asset of Object.values(bundle)) {
                if (asset.type !== "asset" || asset.fileName !== "element-web-shared-components.css") {
                    continue;
                }

                const cssPath = resolve(__dirname, "dist", asset.fileName);
                const source = readFileSync(cssPath, "utf-8");
                if (source.startsWith(cssLayerOrder)) {
                    continue;
                }

                writeFileSync(cssPath, `${cssLayerOrder}\n@layer ${sharedComponentsLayer} {\n${source}\n}\n`);
            }
        },
    };
}

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
                    "react-resizable-panels": "reactResizablePanels",
                },
            },
        },
    },
    plugins: [
        layerCssAssets(),
        dts({
            bundleTypes: true,
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.{ts,tsx}"],
            copyDtsFiles: false,
        }),
    ],
});
