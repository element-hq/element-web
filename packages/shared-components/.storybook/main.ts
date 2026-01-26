/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorybookConfig } from "@storybook/react-vite";
import fs from "node:fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { mergeConfig } from "vite";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get a list of available languages so the language selector can display them at runtime
const languageFiles = fs.readdirSync("src/i18n/strings").map((f) => f.slice(0, -5));

const languages: Record<string, string> = {};
for (const lang of languageFiles) {
    const normalizedLanguage = lang.toLowerCase().replace("_", "-");
    const languageParts = normalizedLanguage.split("-");
    if (languageParts.length === 2 && languageParts[0] === languageParts[1]) {
        languages[languageParts[0]] = `${lang}.json`;
    } else {
        languages[normalizedLanguage] = `${lang}.json`;
    }
}

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
    return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-docs",
        "@storybook/addon-designs",
        "@storybook/addon-a11y",
        "@storybook/addon-vitest",
        getAbsolutePath("storybook-addon-vis"),
    ],
    framework: "@storybook/react-vite",
    core: {
        disableTelemetry: true,
    },
    typescript: {
        reactDocgen: "react-docgen-typescript",
    },
    async viteFinal(config) {
        return mergeConfig(config, {
            plugins: [
                // Needed for counterpart to work
                nodePolyfills({ include: ["util"], globals: { global: false } }),
                {
                    name: "language-middleware",
                    configureServer(server) {
                        server.middlewares.use((req, res, next) => {
                            if (req.url === "/i18n/languages.json") {
                                // Dynamically generate a languages.json file based on what files are available
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify(languages));
                            } else if (req.url?.startsWith("/i18n/")) {
                                // Serve the individual language files, which annoyingly can't be a simple
                                // static dir because the directory structure in src doesn't match what
                                // the app requests.
                                const langFile = req.url.split("/").pop();
                                res.setHeader("Content-Type", "application/json");
                                fs.createReadStream(`src/i18n/strings/${langFile}`).pipe(res);
                            } else {
                                next();
                            }
                        });
                    },
                },
            ],
            server: {
                allowedHosts: ["localhost", ".docker.internal"],
            },
        });
    },
    refs: {
        "compound-web": {
            title: "Compound Web",
            url: "https://element-hq.github.io/compound-web/",
        },
    },
    env: (config) => ({
        ...config,
        STORYBOOK_LANGUAGES: JSON.stringify(Object.keys(languages)),
    }),
};
export default config;
