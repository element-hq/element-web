#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var glob = require('glob');

var args = require('optimist').argv;

var header = args.h || args.header;

if (args._.length == 0) {
    console.log("No skin given");
    process.exit(1);
}

var skin = args._[0];

try {
    fs.accessSync(path.join('src', 'skins', skin), fs.F_OK);
} catch (e) {
    console.log("Skin "+skin+" not found");
    process.exit(1);
}

try {
    fs.accessSync(path.join('src', 'skins', skin, 'views'), fs.F_OK);
} catch (e) {
    console.log("Skin "+skin+" has no views directory");
    process.exit(1);
}

var skindex = path.join('src', 'skins', skin, 'skindex.js');
var viewsDir = path.join('src', 'skins', skin, 'views');

var strm = fs.createWriteStream(skindex);

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

strm.write("var sdk = require('matrix-react-sdk');\n\n");

var tree = {
    atoms: {},
    molecules: {},
    organisms: {},
    templates: {},
    pages: {}
};

var files = glob.sync('**/*.js', {cwd: viewsDir});
for (var i = 0; i < files.length; ++i) {
    var file = files[i].replace('.js', '');
    var module = (file.replace(/\//g, '.'));

    // create objects for submodules
    // NB. that we do not support creating additional
    // top level modules. Perhaps we should?
    var subtree = tree;
    var restOfPath = module.split('.').slice(0, -1);
    var currentPath = restOfPath[0];
    restOfPath = restOfPath.slice(1);
    while (restOfPath.length) {
        currentPath += '.'+restOfPath[0];
        if (subtree[restOfPath[0]] == undefined) {
            strm.write('sdk.'+currentPath+' = {};\n');
            strm.uncork();
        }
        subtree[restOfPath[0]] = {};
        restOfPath = restOfPath.slice(1);
    }

    strm.write('sdk.'+module+" = require('./views/"+file+"');\n");
    strm.uncork();
}
strm.end();

