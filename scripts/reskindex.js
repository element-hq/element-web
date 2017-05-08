#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var args = require('optimist').argv;
var chokidar = require('chokidar');

var componentIndex = path.join('src', 'component-index.js');
var componentsDir = path.join('src', 'components');
var componentGlob = '**/*.js';

function reskindex() {
    var header = args.h || args.header;
    var packageJson = JSON.parse(fs.readFileSync('./package.json'));

    var strm = fs.createWriteStream(componentIndex);

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
        strm.write(
            "module.exports.components = require('"+
            packageJson['matrix-react-parent']+
            "/lib/component-index').components;\n\n"
        );
    } else {
        strm.write("module.exports.components = {};\n");
    }

    var files = glob.sync(componentGlob, {cwd: componentsDir}).sort();
    for (var i = 0; i < files.length; ++i) {
        var file = files[i].replace('.js', '');

        var moduleName = (file.replace(/\//g, '.'));
        var importName = moduleName.replace(/\./g, "$");

        strm.write("import " + importName + " from './components/" + file + "';\n");
        strm.write(importName + " && (module.exports.components['"+moduleName+"'] = " + importName + ");");
        strm.write('\n');
        strm.uncork();
    }

    strm.end();
    console.log('Reskindex: completed');
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
