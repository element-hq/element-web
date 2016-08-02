#!/usr/bin/env node

// copy static files from node_modules to the vector directory
//

var fs = require('fs-extra');

function exists(f) {
    try {
        fs.statSync(f);
        return true;
    } catch(e) {
        return false;
    }
}

const olm = 'node_modules/olm/olm.js';
if (exists(olm)) {
    console.log("copy", olm, "-> vector");
    fs.copySync(olm, 'vector/olm.js');
}
