/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorybookConfig } from "@storybook/react-vite";
import fs from "node:fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { mergeConfig } from "vite";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineStorybookVis } from "storybook-addon-vis/node";
import { trimCommonFolder } from "storybook-addon-vis/vitest-plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get a list of available languages so the language selector can display them at runtime
const languageFiles = fs.readdirSync(join(__dirname, "..", "src", "i18n", "strings")).map((f) => f.slice(0, -5));

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

function resolveVisualSnapshotRootDir({ ci, platform }: { ci: boolean; platform: string }): string {
    return `__vis__/${ci ? "linux" : platform}`;
}

function slugifySnapshotSegment(segment: string): string {
    return segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function resolveVisualSnapshotSubpath({ subpath }: { subpath: string }): string {
    const normalizedSubpath = trimCommonFolder(subpath.startsWith("./") ? subpath.slice(2) : subpath).replaceAll(
        "\\",
        "/",
    );
    const topLevelDirectory = normalizedSubpath.split("/", 1)[0] ?? "shared-components";
    const storyName = basename(normalizedSubpath, extname(normalizedSubpath)).replace(/\.stories$/, "");

    return `${slugifySnapshotSegment(topLevelDirectory)}/${storyName}`;
}

const config: StorybookConfig = {
    stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-docs",
        "@storybook/addon-designs",
        "@storybook/addon-a11y",
        "@storybook/addon-vitest",
        defineStorybookVis({
            visProjects: [
                {
                    snapshotRootDir: resolveVisualSnapshotRootDir,
                    snapshotSubpath: resolveVisualSnapshotSubpath,
                },
            ],
        }),
    ],
    framework: "@storybook/react-vite",
    core: {
        disableTelemetry: true,
    },
    typescript: {
        reactDocgen: "react-docgen-typescript",
        reactDocgenTypescriptOptions: {
            // The default exclude is ["**/**.stories.tsx"] which prevents
            // docgen from extracting snapshot field descriptions from wrapper
            // components defined in story files.
            exclude: [],
        },
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
                            } else if (req.url === "/usercontent/" || req.url === "/usercontent") {
                                // Mock usercontent endpoint used by encrypted download iframes.
                                res.end("This is where /usercontent/ is loaded.");
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
