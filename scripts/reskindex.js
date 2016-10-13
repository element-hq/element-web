#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var glob = require('glob');

var args = require('optimist').argv;

var header = args.h || args.header;

var componentsDir = path.join('src', 'components');

var componentIndex = path.join('src', 'component-index.js');

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
strm.write(" *\n");
strm.write(" * To update it, run:\n");
strm.write(" *    ./reskindex.js -h header\n");
strm.write(" */\n\n");

if (packageJson['matrix-react-parent']) {
    strm.write("module.exports.components = require('"+packageJson['matrix-react-parent']+"/lib/component-index').components;\n\n");
} else {
    strm.write("module.exports.components = {};\n");
}

var files = glob.sync('**/*.js', {cwd: componentsDir}).sort();
for (var i = 0; i < files.length; ++i) {
    var file = files[i].replace('.js', '');

    var moduleName = (file.replace(/\//g, '.'));
    var importName = moduleName.replace(/\./g, "$");

    strm.write("import " + importName + " from './components/" + file + "';\n");
    strm.write("module.exports.components['"+moduleName+"'] = " + importName + ";");
    strm.write('\n');
    strm.uncork();
}

strm.end();
