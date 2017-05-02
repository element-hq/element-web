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
    ["src/i18n/", "webapp/i18n/", {languages: 1}],
    ["node_modules/matrix-react-sdk/src/i18n/strings/", "webapp/i18n/", {languages: 1}],
    ["node_modules/matrix-react-sdk/src/i18n/global/", "webapp/i18n/", {languages: 1}],
];

const parseArgs = require('minimist');
const Cpx = require('cpx');
const chokidar = require('chokidar');
const fs = require('fs');

//From http://stackoverflow.com/a/20525865/4929236
function generateFileArray(dir, files_) {
  files_ = files_ || [];
  var files = fs.readdirSync(dir);
  for (var i in files){
    if (files[i] !== "languages.json") {
      var name = files[i];
      files_.push(name);
    };
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
      if (!fs.existsSync(dest)){
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
        } else if (opts.languages) {
          if (verbose) {
            console.log('don\'t copy language file');
          }
          next(i+1, err);
        } else {
            cpx.on('watch-ready', cb);
            cpx.on("watch-error", cb);
            cpx.watch();
        }
    } else if (!opts.languages) {
      cpx.copy(cb);
    }
}

next(0);

// Generate Language List

const testFolder = 'src/i18n/';
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
  fs.writeFile('webapp/i18n/languages.json', JSON.stringify(languages, null, 4), 'utf8');
})
