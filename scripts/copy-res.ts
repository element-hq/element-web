#!/usr/bin/env node

// copies the resources into the webapp directory.

import parseArgs from "minimist";
import * as chokidar from "chokidar";
import * as fs from "node:fs";
import _ from "lodash";
import { util } from "webpack";
import { Translations } from "matrix-web-i18n";

const I18N_BASE_PATH = "src/i18n/strings/";
const INCLUDE_LANGS = [...new Set([...fs.readdirSync(I18N_BASE_PATH)])]
    .filter((fn) => fn.endsWith(".json"))
    .map((f) => f.slice(0, -5));

const argv = parseArgs(process.argv.slice(2), {});

const watch = argv.w;
const verbose = argv.v;

function errCheck(err: unknown): void {
    if (err) {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

// Check if webapp exists
if (!fs.existsSync("webapp")) {
    fs.mkdirSync("webapp");
}
// Check if i18n exists
if (!fs.existsSync("webapp/i18n/")) {
    fs.mkdirSync("webapp/i18n/");
}

const logWatch = (path: string) => {
    if (verbose) {
        console.log(`Watching: ${path}`);
    }
};

function prepareLangFile(lang: string, dest: string): [filename: string, json: string] {
    const path = I18N_BASE_PATH + lang + ".json";

    let translations: Translations = {};
    [path].forEach(function (f) {
        if (fs.existsSync(f)) {
            try {
                translations = _.merge(translations, JSON.parse(fs.readFileSync(f).toString()));
            } catch (e) {
                console.error("Failed: " + f, e);
                throw e;
            }
        }
    });

    const json = JSON.stringify(translations, null, 4);
    const jsonBuffer = Buffer.from(json);
    const digest = util.createHash("xxhash64").update(jsonBuffer).digest("hex").slice(0, 7);
    const filename = `${lang}.${digest}.json`;

    return [filename, json];
}

function genLangFile(dest: string, filename: string, json: string) {
    fs.writeFileSync(dest + filename, json);
    if (verbose) {
        console.log("Generated language file: " + filename);
    }
}

function genLangList(langFileMap: Record<string, string>): void {
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
    fs.writeFile("webapp/i18n/languages.json", JSON.stringify(languages, null, 4), function (err) {
        if (err) {
            console.error("Copy Error occured: " + err.message);
            throw new Error("Failed to generate languages.json");
        }
    });
    if (verbose) {
        console.log("Generated languages.json");
    }
}

/*
 * watch the input files for a given language,
 * regenerate the file, adding its content-hashed filename to langFileMap
 * and regenerating languages.json with the new filename
 */
function watchLanguage(lang: string, dest: string, langFileMap: Record<string, string>): void {
    const path = I18N_BASE_PATH + lang + ".json";

    // XXX: Use a debounce because for some reason if we read the language
    // file immediately after the FS event is received, the file contents
    // appears empty. Possibly https://github.com/nodejs/node/issues/6112
    let makeLangDebouncer: ReturnType<typeof setTimeout>;
    const makeLang = (): void => {
        if (makeLangDebouncer) {
            clearTimeout(makeLangDebouncer);
        }
        makeLangDebouncer = setTimeout(() => {
            const [filename, json] = prepareLangFile(lang, dest);
            genLangFile(dest, filename, json);
            langFileMap[lang] = filename;
            genLangList(langFileMap);
        }, 500);
    };

    [path].forEach(function (f) {
        chokidar
            .watch(f, { ignoreInitial: true })
            .on("ready", () => {
                logWatch(f);
            })
            .on("add", makeLang)
            .on("change", makeLang)
            .on("error", errCheck);
    });
}

// language resources
const I18N_DEST = "webapp/i18n/";
const I18N_FILENAME_MAP = INCLUDE_LANGS.reduce<Record<string, string>>((m, l) => {
    const [filename, json] = prepareLangFile(l, I18N_DEST);
    if (!watch) {
        genLangFile(I18N_DEST, filename, json);
    }
    m[l] = filename;
    return m;
}, {});

if (watch) {
    INCLUDE_LANGS.forEach((l) => watchLanguage(l, I18N_DEST, I18N_FILENAME_MAP));
} else {
    genLangList(I18N_FILENAME_MAP);
}
