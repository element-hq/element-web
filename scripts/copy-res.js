#!/usr/bin/env node

// copies the resources into the webapp directory.
//

// cpx includes globbed parts of the filename in the destination, but excludes
// common parents. Hence, "res/{a,b}/**": the output will be "dest/a/..." and
// "dest/b/...".
const COPY_LIST = [
    ["res/manifest.json", "webapp"],
    ["res/{media,vector-icons}/**", "webapp"],
    ["res/flags/*", "webapp/flags/"],
    ["src/skins/vector/{fonts,img}/**", "webapp"],
    ["node_modules/emojione/assets/svg/*", "webapp/emojione/svg/"],
    ["node_modules/emojione/assets/png/*", "webapp/emojione/png/"],
    ["./config.json", "webapp", { directwatch: 1 }],
    ["src/i18n/", "webapp/i18n/", { languages: 1 }],
    ["node_modules/matrix-react-sdk/src/i18n/strings/", "webapp/i18n/", { languages: 1 }],
];

const parseArgs = require('minimist');
const Cpx = require('cpx');
const chokidar = require('chokidar');
const fs = require('fs');
const rimraf = require('rimraf');

// cleanup language files before copying them.
//rimraf("webapp/", function () { console.log('cleanup language files'); });

//From http://stackoverflow.com/a/20525865/4929236
function generateFileArray(dir, files_) {
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files) {
        var name = files[i];
        if (name != 'basefile.json') {
            files_.push(name);
        }
    }
    return files_;
}

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

    if (opts.languages) {
        const sourceFiles = generateFileArray(source);
        let Sourcelanguages = {};
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        sourceFiles.forEach(file => {
            const fileContents = fs.readFileSync(source + file).toString();
            Sourcelanguages[file] = JSON.parse(fileContents);
        });
        sourceFiles.forEach(file => {
            if (!fs.existsSync(dest + file)) {
                let o = Object.assign({}, Sourcelanguages[file]);
                fs.writeFileSync(dest + file, JSON.stringify(o, null, 4));
            } else {
                const fileContents = fs.readFileSync(dest + file).toString();
                let o = Object.assign(JSON.parse(fileContents), Sourcelanguages[file]);
                fs.writeFileSync(dest + file, JSON.stringify(o, null, 4));
            }
        });

    } else {
        cpx = new Cpx.Cpx(source, dest);
    }

    if (verbose) {
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
        } else if (opts.languages) {
            if (verbose) {
                console.log('don\'t copy language file');
            }
            next(i + 1, err);
        } else {
            cpx.on('watch-ready', cb);
            cpx.on("watch-error", cb);
            cpx.watch();
        }
    } else if (opts.languages) {
        if (verbose) {
            console.log('don\'t copy language file');
        }
        next(i + 1, err);
    } else {
        cpx.copy(cb);
    }
}

// Generate Language List

const testFolder = 'src/i18n/';
let languages = {};
// Check if webapp exists
if (!fs.existsSync('webapp')) {
    fs.mkdirSync('webapp');
}
// Check if i18n exists
if (!fs.existsSync('webapp/i18n/')) {
    fs.mkdirSync('webapp/i18n/');
}

if (!fs.existsSync('webapp/i18n/languages.json')) {
    rimraf("webapp/i18n/languages.json", function() { console.log('cleanup languages.json file'); });
}

fs.readdir(testFolder, function(err, files) {
    if (err) {
        throw err;
    }
    files.forEach(function(file) {
        var normalizedLanguage = file.toLowerCase().replace("_", "-").split('.json')[0];
        var languageParts = normalizedLanguage.split('-');
        if (file != 'basefile.json') {
            if (languageParts.length == 2 && languageParts[0] == languageParts[1]) {
                languages[languageParts[0]] = file;
            } else {
                languages[normalizedLanguage] = file;
            }
        }
    });
    fs.writeFile('webapp/i18n/languages.json', JSON.stringify(languages, null, 4));
})

next(0);