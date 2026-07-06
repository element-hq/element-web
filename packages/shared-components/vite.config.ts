/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 *
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, esmExternalRequirePlugin, type Plugin } from "vite";
import dts from "unplugin-dts/vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssLayerOrder = "@layer compound-tokens, compound-web, shared-components, app-web;";
const sharedComponentsLayer = "shared-components";

const cssAssetFileName = "element-web-shared-components.css";

function layerCssAssets(): Plugin {
    return {
        name: "element-web-shared-components-css-layer",
        // Rename + layer-wrap the emitted CSS file. With multi-entry lib mode,
        // vite/rolldown derives CSS filenames from the unscoped package name (dropping
        // the `element-` prefix), so we rename on disk to keep the path stable for
        // consumers importing `@element-hq/web-shared-components/.../*.css`.
        writeBundle(options): void {
            const outDir = options.dir ?? resolve(__dirname, "dist");
            const expectedPath = resolve(outDir, cssAssetFileName);
            const renamedFromPath = resolve(outDir, "web-shared-components.css");

            if (existsSync(renamedFromPath)) {
                renameSync(renamedFromPath, expectedPath);
            }

            // No CSS emitted in this build (e.g. storybook's vite build doesn't produce
            // the library CSS bundle), or already renamed and layered on a prior pass.
            if (!existsSync(expectedPath)) return;

            const source = readFileSync(expectedPath, "utf-8");
            if (source.startsWith(cssLayerOrder)) return;
            writeFileSync(expectedPath, `${cssLayerOrder}\n@layer ${sharedComponentsLayer} {\n${source}\n}\n`);
        },
    };
}

export default defineConfig({
    build: {
        lib: {
            // Two entries: the main bundle and a standalone `numbers` utility that callers
            // running outside the browser DOM (e.g. AudioWorkletGlobalScope) can import without
            // pulling in the rest of the package — which transitively loads dnd-kit and
            // other window/document-dependent code.
            entry: {
                "element-web-shared-components": resolve(__dirname, "src/index.ts"),
                "numbers": resolve(__dirname, "src/core/utils/numbers.ts"),
            },
            name: "Element Web Shared Components",
            // Multi-entry mode needs both formats explicit; UMD doesn't support multi-entry
            // (single global), so we ship ES + CJS and use the `.umd.cjs` extension for CJS
            // to keep the existing package.json `require` paths working.
            formats: ["es", "cjs"],
            fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "umd.cjs"}`,
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
        react(),
        layerCssAssets(),
        dts({
            bundleTypes: true,
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.stories.{ts,tsx}"],
            copyDtsFiles: false,
        }),
    ],
});
