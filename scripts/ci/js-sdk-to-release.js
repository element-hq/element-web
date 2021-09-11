#!/usr/bin/env node

const fsProm = require('fs/promises');

const PKGJSON = 'node_modules/matrix-js-sdk/package.json';

async function main() {
    const pkgJson = JSON.parse(await fsProm.readFile(PKGJSON, 'utf8'));
    for (const field of ['main', 'typings']) {
        if (pkgJson["matrix_lib_"+field] !== undefined) {
            pkgJson[field] = pkgJson["matrix_lib_"+field];
        }
    }
    await fsProm.writeFile(PKGJSON, JSON.stringify(pkgJson, null, 2));
}

main();
