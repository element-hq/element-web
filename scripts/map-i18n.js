#!/usr/bin/env node

/*
Copyright 2018 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/*
 * Looks through all the translation files and maps matches of fromRegex
 * in both key and value of the i18n translation to toStr where i18nKeyRegex
 * matches. Simplifies changing from text to react replacements.
 * e.g:
 * node scripts\map-i18n.js "%\(targetName\)s accepted the invitation for %\(displayName\)s\." "%\(targetName\)s" "<target>"
 */

const fs = require('fs');
const path = require('path');

const I18NDIR = 'src/i18n/strings';

if (process.argv.length !== 5) {
    console.error("Required exactly 3 arguments");
    console.info("Usage: <i18n_key> <fromStr> <toStr>");
    return;
}

const [, , i18nKey, fromStr, toStr] = process.argv;
const i18nKeyRegex = new RegExp(i18nKey, 'i');
const fromRegex = new RegExp(fromStr, 'i');

console.info(`Replacing instances of "${fromRegex}" with "${toStr}" in keys and values where key matches "${i18nKey}"`);

for (const filename of fs.readdirSync(I18NDIR)) {
    if (!filename.endsWith('.json')) continue;

    let numChanged = 0;

    const trs = JSON.parse(fs.readFileSync(path.join(I18NDIR, filename)));
    for (const tr of Object.keys(trs)) {
        if (i18nKeyRegex.test(tr) && (fromRegex.test(tr) || fromRegex.test(tr))) {
            const v = trs[tr];
            delete trs[tr];

            trs[tr.replace(fromRegex, toStr)] = v.replace(fromRegex, toStr);
            numChanged++;
        }
    }

    if (numChanged > 0) {
        console.log(`${filename}: transformed ${numChanged} translations`);
        // XXX: This is totally relying on the impl serialising the JSON object in the
        // same order as they were parsed from the file. JSON.stringify() has a specific argument
        // that can be used to control the order, but JSON.parse() lacks any kind of equivalent.
        // Empirically this does maintain the order on my system, so I'm going to leave it like
        // this for now.
        fs.writeFileSync(path.join(I18NDIR, filename), JSON.stringify(trs, undefined, 4) + "\n");
    }
}
