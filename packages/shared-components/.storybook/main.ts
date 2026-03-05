/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { StorybookConfig } from "@storybook/react-vite";
import fs from "node:fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { mergeConfig } from "vite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
                                const pngBytes = Buffer.from(
                                    "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=",
                                    "base64",
                                );
                                res.statusCode = 200;
                                res.setHeader("Content-Type", "image/png");
                                res.setHeader("Content-Length", String(pngBytes.length));
                                res.end(pngBytes);
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
