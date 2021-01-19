#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const util = require('util');
const args = require('minimist')(process.argv);
const chokidar = require('chokidar');

const componentIndex = path.join('src', 'component-index.js');
const componentIndexTmp = componentIndex+".tmp";
const componentsDir = path.join('src', 'components');
const componentJsGlob = '**/*.js';
const componentTsGlob = '**/*.tsx';
let prevFiles = [];

async function reskindex() {
    const jsFiles = glob.sync(componentJsGlob, {cwd: componentsDir}).sort();
    const tsFiles = glob.sync(componentTsGlob, {cwd: componentsDir}).sort();
    const files = [...tsFiles, ...jsFiles];
    if (!filesHaveChanged(files, prevFiles)) {
        return;
    }
    prevFiles = files;

    const header = args.h || args.header;

    const strm = fs.createWriteStream(componentIndexTmp);

    if (header) {
       strm.write(fs.readFileSync(header));
       strm.write('\n');
    }

    strm.write("/*\n");
    strm.write(" * THIS FILE IS AUTO-GENERATED\n");
    strm.write(" * You can edit it you like, but your changes will be overwritten,\n");
    strm.write(" * so you'd just be trying to swim upstream like a salmon.\n");
    strm.write(" * You are not a salmon.\n");
    strm.write(" */\n\n");
    strm.write("let components = {};\n");

    for (let i = 0; i < files.length; ++i) {
        const file = files[i].replace('.js', '').replace('.tsx', '');

        const moduleName = (file.replace(/\//g, '.'));
        const importName = moduleName.replace(/\./g, "$");

        strm.write("import " + importName + " from './components/" + file + "';\n");
        strm.write(importName + " && (components['"+moduleName+"'] = " + importName + ");");
        strm.write('\n');
        strm.uncork();
    }

    strm.write("export {components};\n");
    // Ensure the file has been fully written to disk before proceeding
    await util.promisify(strm.end);
    fs.rename(componentIndexTmp, componentIndex, function(err) {
        if (err) {
            console.error("Error moving new index into place: " + err);
        } else {
            console.log('Reskindex: completed');
        }
    });
}

// Expects both arrays of file names to be sorted
function filesHaveChanged(files, prevFiles) {
    if (files.length !== prevFiles.length) {
        return true;
    }
    // Check for name changes
    for (let i = 0; i < files.length; i++) {
        if (prevFiles[i] !== files[i]) {
            return true;
        }
    }
    return false;
}

// -w indicates watch mode where any FS events will trigger reskindex
if (!args.w) {
    reskindex();
    return;
}

let watchDebouncer = null;
chokidar.watch(path.join(componentsDir, componentJsGlob)).on('all', (event, path) => {
    if (path === componentIndex) return;
    if (watchDebouncer) clearTimeout(watchDebouncer);
    watchDebouncer = setTimeout(reskindex, 1000);
});
