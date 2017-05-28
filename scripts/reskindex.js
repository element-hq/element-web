#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var args = require('optimist').argv;
var chokidar = require('chokidar');

var componentIndex = path.join('src', 'component-index.js');
var componentIndexTmp = componentIndex+".tmp";
var componentsDir = path.join('src', 'components');
var componentGlob = '**/*.js';
var prevFiles = [];

function reskindex() {
    var files = glob.sync(componentGlob, {cwd: componentsDir}).sort();
    if (!filesHaveChanged(files, prevFiles)) {
        return;
    }
    prevFiles = files;

    var header = args.h || args.header;
    var packageJson = JSON.parse(fs.readFileSync('./package.json'));

    var strm = fs.createWriteStream(componentIndexTmp);

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

    if (packageJson['matrix-react-parent']) {
        const parentIndex = packageJson['matrix-react-parent'] +
              '/lib/component-index';
        strm.write(
`let components = require('${parentIndex}').components;
if (!components) {
    throw new Error("'${parentIndex}' didn't export components");
}
`);
    } else {
        strm.write("let components = {};\n");
    }

    for (var i = 0; i < files.length; ++i) {
        var file = files[i].replace('.js', '');

        var moduleName = (file.replace(/\//g, '.'));
        var importName = moduleName.replace(/\./g, "$");

        strm.write("import " + importName + " from './components/" + file + "';\n");
        strm.write(importName + " && (components['"+moduleName+"'] = " + importName + ");");
        strm.write('\n');
        strm.uncork();
    }

    strm.write("export {components};\n");
    strm.end();
    fs.rename(componentIndexTmp, componentIndex, function(err) {
        if(err) {
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
    for (var i = 0; i < files.length; i++) {
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

var watchDebouncer = null;
chokidar.watch(path.join(componentsDir, componentGlob)).on('all', (event, path) => {
    if (path === componentIndex) return;
    if (watchDebouncer) clearTimeout(watchDebouncer);
    watchDebouncer = setTimeout(reskindex, 1000);
});
