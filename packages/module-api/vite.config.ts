/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type Plugin } from "vitest/config";
import dts from "unplugin-dts/vite";
import externalGlobals from "rollup-plugin-external-globals";
import baseConfig from "@element-hq/vite-common/vite.config";

import packageJson from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiTypesFileName = "element-web-module-api-alpha.d.ts";

function copyPackageTypesEntry(): Plugin {
    return {
        name: "element-web-module-api-types-entry",
        writeBundle(options): void {
            const outDir = options.dir ?? resolve(__dirname, "lib");
            const entryTypesPath = resolve(outDir, "index.d.ts");
            const packageTypesPath = resolve(outDir, apiTypesFileName);

            if (!existsSync(entryTypesPath)) return;

            const source = readFileSync(entryTypesPath, "utf-8");
            writeFileSync(
                packageTypesPath,
                source.replace("sourceMappingURL=index.d.ts.map", `sourceMappingURL=${apiTypesFileName}.map`),
            );

            const entryTypesMapPath = resolve(outDir, "index.d.ts.map");
            if (!existsSync(entryTypesMapPath)) return;

            const sourceMap = readFileSync(entryTypesMapPath, "utf-8");
            writeFileSync(
                `${packageTypesPath}.map`,
                sourceMap.replace('"file":"index.d.ts"', `"file":"${apiTypesFileName}"`),
            );
        },
    };
}

export default mergeConfig(
    baseConfig,
    defineConfig({
        build: {
            lib: {
                entry: resolve(__dirname, "src/index.ts"),
                name: "element-web-plugin-engine",
                fileName: "element-web-plugin-engine",
            },
            outDir: "lib",
            target: "esnext",
            sourcemap: true,
        },
        plugins: [
            dts(),
            copyPackageTypesEntry(),
            externalGlobals({
                // Reuse React from the host app
                react: "window.React",
            }),
        ],
        define: {
            // We cannot use `process.env.npm_package_version` as when building element-web with module-api set to `workspace`
            // this would contain the version of element-web rather than that of the module-api.
            __VERSION__: JSON.stringify(packageJson.version),
            // Use production mode for the build as it is tested against production builds of Element Web,
            // this is required for React JSX versions to be compatible.
            process: { env: { NODE_ENV: "production" } },
        },
    }),
    true,
);
