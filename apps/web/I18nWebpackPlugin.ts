/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import webpack from "webpack";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import _ from "lodash";
import { type Translations } from "matrix-web-i18n";

interface Options {
    // Path to the strings for the application, will be used to deduce what languages are supported
    stringsPath: string;
    // Additional paths to strings which will be merged into the application's own strings for supported languages
    additionalStringsPaths?: string[];
}

async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

export class I18nWebpackPlugin {
    private readonly options: Options;

    public constructor(options: Options) {
        this.options = options;
    }

    public apply(compiler: webpack.Compiler): void {
        const { RawSource } = compiler.webpack.sources;

        compiler.hooks.thisCompilation.tap("I18nWebpackPlugin", (compilation) => {
            compilation.hooks.processAssets.tapPromise(
                {
                    name: "I18nWebpackPlugin",
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                },
                async () => {
                    const paths = [this.options.stringsPath, ...(this.options.additionalStringsPaths ?? [])].map((p) =>
                        path.resolve(compiler.context, p),
                    );

                    const logger = compilation.getLogger("I18nWebpackPlugin");

                    for (const p of paths) {
                        compilation.contextDependencies.add(p);

                        if (!(await exists(p))) {
                            compilation.errors.push(
                                new webpack.WebpackError(`I18nWebpackPlugin: strings path not found: ${p}`),
                            );
                            return;
                        }
                    }

                    const primaryPath = paths[0];
                    const includeLangs = [...new Set([...(await fs.readdir(primaryPath))])]
                        .filter((fn) => fn.endsWith(".json"))
                        .map((f) => f.slice(0, -5));

                    const langFileMap: Record<string, string> = {};

                    for (const lang of includeLangs) {
                        let translations: Translations = {};
                        for (const p of paths) {
                            const f = path.join(p, lang + ".json");

                            if (await exists(f)) {
                                try {
                                    const content = await fs.readFile(f, "utf-8");
                                    translations = _.merge(translations, JSON.parse(content));
                                    compilation.fileDependencies.add(f);
                                } catch (e) {
                                    compilation.errors.push(
                                        new webpack.WebpackError(
                                            `I18nWebpackPlugin: Failed to read or parse ${f}: ${e}`,
                                        ),
                                    );
                                }
                            }
                        }

                        const json = JSON.stringify(translations, null, 4);
                        const jsonBuffer = Buffer.from(json);
                        const digest = compiler.webpack.util
                            .createHash("xxhash64")
                            .update(jsonBuffer)
                            .digest("hex")
                            .slice(0, 7);
                        const filename = `${lang}.${digest}.json`;

                        compilation.emitAsset(`i18n/${filename}`, new RawSource(jsonBuffer));
                        langFileMap[lang] = filename;
                        logger.debug(`Generated language file: ${filename}`);
                    }

                    // Generate languages.json
                    const languages: Record<string, string> = {};
                    includeLangs.forEach((lang) => {
                        const normalizedLanguage = lang.toLowerCase().replace("_", "-");
                        const languageParts = normalizedLanguage.split("-");
                        if (languageParts.length == 2 && languageParts[0] == languageParts[1]) {
                            languages[languageParts[0]] = langFileMap[lang];
                        } else {
                            languages[normalizedLanguage] = langFileMap[lang];
                        }
                    });

                    compilation.emitAsset("i18n/languages.json", new RawSource(JSON.stringify(languages, null, 4)));
                    logger.info("Generated languages.json and language files");
                },
            );
        });
    }
}
