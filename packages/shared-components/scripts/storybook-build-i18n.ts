/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Script to generate i18n files for Storybook build.
 */

import * as fs from "node:fs";
import { createHash } from "node:crypto";

// Base path for i18n strings
const I18N_BASE_PATH = "./src/i18n/strings/";
// Destination path for generated i18n files
const I18N_DEST = "storybook-static/i18n/";

// List of languages to include
const INCLUDE_LANGS = [...new Set([...fs.readdirSync(I18N_BASE_PATH)])]
    .filter((fn) => fn.endsWith(".json"))
    .map((f) => f.slice(0, -5));

// Check if dist exists
if (!fs.existsSync("dist")) {
    fs.mkdirSync("dist");
}
// Check if i18n exists
if (!fs.existsSync(I18N_DEST)) {
    fs.mkdirSync(I18N_DEST);
}

// Type mapping language codes to filenames
type LangFileMap = Record<string, string>;

/**
 * Prepare language files by creating hashed filenames and writing them to the destination.
 * @returns Mapping of language codes to filenames
 */
function prepareLangFiles(): LangFileMap {
    return INCLUDE_LANGS.reduce<Record<string, string>>((fileMap, lang) => {
        const [filename, json] = createHashFromFile(lang);
        fs.writeFileSync(`${I18N_DEST}${filename}`, json);
        fileMap[lang] = filename;
        return fileMap;
    }, {});
}

/**
 * Create a hash from the contents of the language file.
 * @param lang - Language code
 * @returns Tuple of filename and JSON content
 */
function createHashFromFile(lang: string): [filename: string, json: string] {
    const translationsPath = `${I18N_BASE_PATH}${lang}.json`;

    const json = fs.readFileSync(translationsPath).toString();
    const jsonBuffer = Buffer.from(json);
    const digest = createHash("sha256").update(jsonBuffer).digest("hex").slice(0, 7);
    const filename = `${lang}.${digest}.json`;

    return [filename, json];
}

/**
 * Generate the languages.json file mapping language codes to filenames.
 * @param langFileMap
 */
function genLangList(langFileMap: LangFileMap): void {
    const languages: Record<string, string> = {};
    INCLUDE_LANGS.forEach(function (lang) {
        const normalizedLanguage = lang.toLowerCase().replace("_", "-");
        const languageParts = normalizedLanguage.split("-");
        if (languageParts.length == 2 && languageParts[0] == languageParts[1]) {
            languages[languageParts[0]] = langFileMap[lang];
        } else {
            languages[normalizedLanguage] = langFileMap[lang];
        }
    });
    fs.writeFileSync(`${I18N_DEST}/languages.json`, JSON.stringify(languages, null, 4));
}

const langFileMap = prepareLangFiles();
genLangList(langFileMap);
