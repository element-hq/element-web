#!/usr/bin/env node

// copies the resources into the webapp directory.
//

// Languages are listed manually so we can choose when to include
// a translation in the app (because having a translation with only
// 3 strings translated is just frustrating)
// This could readily be automated, but it's nice to explicitly
// control when we languages are available.
const INCLUDE_LANGS = [
    //'be' Omitted because no translations in react-sdk
    'en_EN',
    'da',
    'de_DE',
    'fr',
    'be',
    'pt',
    'pt_BR',
    'ru',
];

// cpx includes globbed parts of the filename in the destination, but excludes
// common parents. Hence, "res/{a,b}/**": the output will be "dest/a/..." and
// "dest/b/...".
const COPY_LIST = [
    ["res/manifest.json", "webapp"],
    ["res/home.html", "webapp"],
    ["res/{media,vector-icons}/**", "webapp"],
    ["res/flags/*", "webapp/flags/"],
    ["src/skins/vector/{fonts,img}/**", "webapp"],
    ["node_modules/emojione/assets/svg/*", "webapp/emojione/svg/"],
    ["node_modules/emojione/assets/png/*", "webapp/emojione/png/"],
    ["./config.json", "webapp", { directwatch: 1 }],
];

INCLUDE_LANGS.forEach(function(l) {
    COPY_LIST.push([
        l, "webapp/i18n/", { lang: 1 },
    ]);
});

const parseArgs = require('minimist');
const Cpx = require('cpx');
const chokidar = require('chokidar');
const fs = require('fs');
const rimraf = require('rimraf');

const argv = parseArgs(
    process.argv.slice(2), {}
);

var watch = argv.w;
var verbose = argv.v;

function errCheck(err) {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }
}

// Check if webapp exists
if (!fs.existsSync('webapp')) {
    fs.mkdirSync('webapp');
}
// Check if i18n exists
if (!fs.existsSync('webapp/i18n/')) {
    fs.mkdirSync('webapp/i18n/');
}

function next(i, err) {
    errCheck(err);

    if (i >= COPY_LIST.length) {
        return;
    }

    const ent = COPY_LIST[i];
    const source = ent[0];
    const dest = ent[1];
    const opts = ent[2] || {};
    let cpx = undefined;

    if (!opts.lang) {
        cpx = new Cpx.Cpx(source, dest);
    }

    if (verbose && cpx) {
        cpx.on("copy", (event) => {
            console.log(`Copied: ${event.srcPath} --> ${event.dstPath}`);
        });
        cpx.on("remove", (event) => {
            console.log(`Removed: ${event.path}`);
        });
    }

    const cb = (err) => { next(i + 1, err) };

    if (watch) {
        if (opts.directwatch) {
            // cpx -w creates a watcher for the parent of any files specified,
            // which in the case of config.json is '.', which inevitably takes
            // ages to crawl. So we create our own watcher on the files
            // instead.
            const copy = () => { cpx.copy(errCheck) };
            chokidar.watch(source)
                .on('add', copy)
                .on('change', copy)
                .on('ready', cb)
                .on('error', errCheck);
        } else if (opts.lang) {
            const reactSdkFile = 'node_modules/matrix-react-sdk/src/i18n/strings/' + source + '.json';
            const riotWebFile = 'src/i18n/strings/' + source + '.json';

            const translations = {};
            const makeLang = () => { genLangFile(source, dest) };
            [reactSdkFile, riotWebFile].forEach(function(f) {
                chokidar.watch(f)
                    .on('add', makeLang)
                    .on('change', makeLang)
                    //.on('ready', cb)  We'd have to do this when both files are ready
                    .on('error', errCheck);
            });
            next(i + 1, err);
        } else {
            cpx.on('watch-ready', cb);
            cpx.on("watch-error", cb);
            cpx.watch();
        }
    } else if (opts.lang) {
        genLangFile(source, dest);
        next(i + 1, err);
    } else {
        cpx.copy(cb);
    }
}

function genLangFile(lang, dest) {
    const reactSdkFile = 'node_modules/matrix-react-sdk/src/i18n/strings/' + lang + '.json';
    const riotWebFile = 'src/i18n/strings/' + lang + '.json';

    const translations = {};
    [reactSdkFile, riotWebFile].forEach(function(f) {
        if (fs.existsSync(f)) {
            Object.assign(
                translations,
                JSON.parse(fs.readFileSync(f).toString())
            );
        }
    });
    fs.writeFileSync(dest + lang + '.json', JSON.stringify(translations, null, 4));
    if (verbose) {
        console.log("Generated language file: " + lang);
    }
}

function genLangList() {
    const languages = {};
    INCLUDE_LANGS.forEach(function(lang) {
        const normalizedLanguage = lang.toLowerCase().replace("_", "-");
        const languageParts = normalizedLanguage.split('-');
        if (languageParts.length == 2 && languageParts[0] == languageParts[1]) {
            languages[languageParts[0]] = lang + '.json';
        } else {
            languages[normalizedLanguage] = lang + '.json';
        }
    });
    fs.writeFile('webapp/i18n/languages.json', JSON.stringify(languages, null, 4));
    if (verbose) {
        console.log("Generated language list");
    }
}

genLangList();
next(0);
