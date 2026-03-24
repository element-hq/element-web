#!/usr/bin/env -S npx tsx

// copies resources into the lib directory.

import parseArgs from "minimist";
import * as chokidar from "chokidar";
import * as path from "node:path";
import * as fs from "node:fs";

const argv = parseArgs(process.argv.slice(2), {});

const watch = argv.w;
const verbose = argv.v;

function errCheck(err: unknown): void {
    if (err) {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    }
}

const I18N_BASE_PATH = "src/i18n/strings/";
const INCLUDE_LANGS = fs.readdirSync(I18N_BASE_PATH).filter((fn) => fn.endsWith(".json"));

// Ensure lib, lib/i18n and lib/i18n/strings all exist
fs.mkdirSync("lib/i18n/strings", { recursive: true });

type Translations = Record<string, Record<string, string> | string>;

function genLangFile(file: string, dest: string): void {
    const translations: Translations = {};
    [file].forEach(function (f) {
        if (fs.existsSync(f)) {
            try {
                Object.assign(translations, JSON.parse(fs.readFileSync(f).toString()));
            } catch (e) {
                console.error("Failed: " + f, e);
                throw e;
            }
        }
    });

    const json = JSON.stringify(translations, null, 4);
    const filename = path.basename(file);

    fs.writeFileSync(dest + filename, json);
    if (verbose) {
        console.log("Generated language file: " + filename);
    }
}

/*
 watch the input files for a given language,
 regenerate the file, and regenerating languages.json with the new filename
 */
function watchLanguage(file: string, dest: string): void {
    // XXX: Use a debounce because for some reason if we read the language
    // file immediately after the FS event is received, the file contents
    // appears empty. Possibly https://github.com/nodejs/node/issues/6112
    let makeLangDebouncer: NodeJS.Timeout | undefined;
    const makeLang = (): void => {
        if (makeLangDebouncer) {
            clearTimeout(makeLangDebouncer);
        }
        makeLangDebouncer = setTimeout(() => {
            genLangFile(file, dest);
        }, 500);
    };

    chokidar.watch(file).on("add", makeLang).on("change", makeLang).on("error", errCheck);
}

// language resources
const I18N_DEST = "lib/i18n/strings/";
INCLUDE_LANGS.forEach((file): void => {
    genLangFile(I18N_BASE_PATH + file, I18N_DEST);
}, {});

if (watch) {
    INCLUDE_LANGS.forEach((file) => watchLanguage(I18N_BASE_PATH + file, I18N_DEST));
}
