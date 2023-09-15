#!/usr/bin/env node

// copies the resources into the webapp directory.

import parseArgs from "minimist";
import * as chokidar from "chokidar";
import * as fs from "node:fs";
import _ from "lodash";
import { Cpx } from "cpx";
import * as loaderUtils from "loader-utils";
import { Translations } from "matrix-web-i18n";

const REACT_I18N_BASE_PATH = "node_modules/matrix-react-sdk/src/i18n/strings/";
const I18N_BASE_PATH = "src/i18n/strings/";
const INCLUDE_LANGS = [...new Set([...fs.readdirSync(I18N_BASE_PATH), ...fs.readdirSync(REACT_I18N_BASE_PATH)])]
    .filter((fn) => fn.endsWith(".json"))
    .map((f) => f.slice(0, -5));

// cpx includes globbed parts of the filename in the destination, but excludes
// common parents. Hence, "res/{a,b}/**": the output will be "dest/a/..." and
// "dest/b/...".
const COPY_LIST: [
    sourceGlob: string,
    outputPath: string,
    opts?: {
        directwatch?: 1;
    },
][] = [
    ["res/apple-app-site-association", "webapp"],
    ["res/manifest.json", "webapp"],
    ["res/sw.js", "webapp"],
    ["res/welcome.html", "webapp"],
    ["res/welcome/**", "webapp/welcome"],
    ["res/themes/**", "webapp/themes"],
    ["res/vector-icons/**", "webapp/vector-icons"],
    ["res/decoder-ring/**", "webapp/decoder-ring"],
    ["node_modules/matrix-react-sdk/res/media/**", "webapp/media"],
    ["node_modules/@matrix-org/olm/olm_legacy.js", "webapp", { directwatch: 1 }],
    ["./config.json", "webapp", { directwatch: 1 }],
    ["contribute.json", "webapp"],
];
const argv = parseArgs(process.argv.slice(2), {});

const watch = argv.w;
const verbose = argv.v;

function errCheck(err?: Error): void {
    if (err) {
        console.error(err.message);
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

function next(i: number, err?: Error): void {
    errCheck(err);

    if (i >= COPY_LIST.length) {
        return;
    }

    const ent = COPY_LIST[i];
    const source = ent[0];
    const dest = ent[1];
    const opts = ent[2] || {};
    const cpx = new Cpx(source, dest);

    if (verbose) {
        cpx.on("copy", (event) => {
            console.log(`Copied: ${event.srcPath} --> ${event.dstPath}`);
        });
        cpx.on("remove", (event) => {
            console.log(`Removed: ${event.path}`);
        });
    }

    const cb = (err?: Error): void => {
        next(i + 1, err);
    };

    if (watch) {
        if (opts.directwatch) {
            // cpx -w creates a watcher for the parent of any files specified,
            // which in the case of config.json is '.', which inevitably takes
            // ages to crawl. So we create our own watcher on the files
            // instead.
            const copy = (): void => {
                cpx.copy(errCheck);
            };
            chokidar.watch(source).on("add", copy).on("change", copy).on("ready", cb).on("error", errCheck);
        } else {
            cpx.on("watch-ready", cb);
            cpx.on("watch-error", cb);
            cpx.watch();
        }
    } else {
        cpx.copy(cb);
    }
}

function genLangFile(lang: string, dest: string): string {
    const reactSdkFile = REACT_I18N_BASE_PATH + lang + ".json";
    const riotWebFile = I18N_BASE_PATH + lang + ".json";

    let translations: Translations = {};
    [reactSdkFile, riotWebFile].forEach(function (f) {
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
    const digest = loaderUtils.getHashDigest(jsonBuffer, null, "hex", 7);
    const filename = `${lang}.${digest}.json`;

    fs.writeFileSync(dest + filename, json);
    if (verbose) {
        console.log("Generated language file: " + filename);
    }

    return filename;
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
    const reactSdkFile = REACT_I18N_BASE_PATH + lang + ".json";
    const riotWebFile = I18N_BASE_PATH + lang + ".json";

    // XXX: Use a debounce because for some reason if we read the language
    // file immediately after the FS event is received, the file contents
    // appears empty. Possibly https://github.com/nodejs/node/issues/6112
    let makeLangDebouncer: ReturnType<typeof setTimeout>;
    const makeLang = (): void => {
        if (makeLangDebouncer) {
            clearTimeout(makeLangDebouncer);
        }
        makeLangDebouncer = setTimeout(() => {
            const filename = genLangFile(lang, dest);
            langFileMap[lang] = filename;
            genLangList(langFileMap);
        }, 500);
    };

    [reactSdkFile, riotWebFile].forEach(function (f) {
        chokidar.watch(f).on("add", makeLang).on("change", makeLang).on("error", errCheck);
    });
}

// language resources
const I18N_DEST = "webapp/i18n/";
const I18N_FILENAME_MAP = INCLUDE_LANGS.reduce<Record<string, string>>((m, l) => {
    const filename = genLangFile(l, I18N_DEST);
    m[l] = filename;
    return m;
}, {});
genLangList(I18N_FILENAME_MAP);

if (watch) {
    INCLUDE_LANGS.forEach((l) => watchLanguage(l, I18N_DEST, I18N_FILENAME_MAP));
}

// non-language resources
next(0);
