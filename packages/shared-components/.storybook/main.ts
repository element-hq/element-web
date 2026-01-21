/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import fs from "node:fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { mergeConfig } from "vite";

// Get a list of available languages so the language selector can display them at runtime
const languages = fs.readdirSync("src/i18n/strings").map((f) => f.slice(0, -5));

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: ["@storybook/addon-docs", "@storybook/addon-designs", "@storybook/addon-a11y"],
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
                nodePolyfills({ include: ["util"] }),
                {
                    name: "language-middleware",
                    configureServer(server) {
                        server.middlewares.use((req, res, next) => {
                            if (req.url === "/i18n/languages.json") {
                                // Dynamically generate a languages.json file based on what files are available
                                const langJson: Record<string, string> = {};
                                for (const lang of languages) {
                                    const normalizedLanguage = lang.toLowerCase().replace("_", "-");
                                    const languageParts = normalizedLanguage.split("-");
                                    if (languageParts.length === 2 && languageParts[0] === languageParts[1]) {
                                        langJson[languageParts[0]] = `${lang}.json`;
                                    } else {
                                        langJson[normalizedLanguage] = `${lang}.json`;
                                    }
                                }

                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify(langJson));
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
        STORYBOOK_LANGUAGES: JSON.stringify(languages),
    }),
};
export default config;
