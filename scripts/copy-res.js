#!/usr/bin/env node

// copies the resources into the webapp directory.
//

// cpx includes globbed parts of the filename in the destination, but excludes
// common parents. Hence, "res/{a,b}/**": the output will be "dest/a/..." and
// "dest/b/...".
const COPY_LIST = [
    ["res/{media,vector-icons}/**", "webapp"],
    ["src/skins/vector/{fonts,img}/**", "webapp"],
    ["node_modules/emojione/assets/svg/*", "webapp/emojione/svg/"],
    ["node_modules/emojione/assets/png/*", "webapp/emojione/png/"],
    ["./config.json", "webapp", {directwatch: 1}],
    ["src/i18n/**", "webapp/i18n/"],
];

const parseArgs = require('minimist');
const Cpx = require('cpx');
const chokidar = require('chokidar');

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

    const cpx = new Cpx.Cpx(source, dest);

    if (verbose) {
        cpx.on("copy", (event) => {
            console.log(`Copied: ${event.srcPath} --> ${event.dstPath}`);
        });
        cpx.on("remove", (event) => {
            console.log(`Removed: ${event.path}`);
        });
    }

    const cb = (err) => {next(i+1, err)};

    if (watch) {
        if (opts.directwatch) {
            // cpx -w creates a watcher for the parent of any files specified,
            // which in the case of config.json is '.', which inevitably takes
            // ages to crawl. So we create our own watcher on the files
            // instead.
            const copy = () => {cpx.copy(errCheck)};
            chokidar.watch(source)
                .on('add', copy)
                .on('change', copy)
                .on('ready', cb)
                .on('error', errCheck);
        } else {
            cpx.on('watch-ready', cb);
            cpx.on("watch-error", cb);
            cpx.watch();
        }
    } else {
        cpx.copy(cb);
    }
}

next(0);

// Generate Language List

const testFolder = 'src/i18n/';
const fs = require('fs');
let languages = {};
fs.readdir(testFolder, (err, files) => {
  files.forEach(file => {
    if (file == 'pt_BR.json') {
      languages['pt_br'] = file;
    } else if (file.indexOf("-") > -1) {
      languages[file.split('-')[0]] = file;
    } else if (file.indexOf("_") > -1) {
      languages[file.split('_')[0]] = file;
    } else if (file == 'languages.json') {
      // Do Nothing
    } else {
      languages[file] = file;
    }
  });
  fs.writeFile('src/i18n/languages.json', JSON.stringify(languages, null, 4), 'utf8');
})
