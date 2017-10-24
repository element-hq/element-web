#!/usr/bin/env node

/*
Copyright 2017 New Vector Ltd

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

/**
 * Regenerates the translations en_EN file by walking the source tree and
 * parsing each file with flow-parser. Emits a JSON file with the
 * translatable strings mapped to themselves in the order they appeared
 * in the files and grouped by the file they appeared in.
 *
 * Usage: node scripts/gen-i18n.js
 */
const fs = require('fs');
const path = require('path');

const walk = require('walk');

const flowParser = require('flow-parser');
const estreeWalker = require('estree-walker');

const TRANSLATIONS_FUNCS = ['_t', '_td', '_tJsx'];

const INPUT_TRANSLATIONS_FILE = 'src/i18n/strings/en_EN.json';

// NB. The sync version of walk is broken for single files so we walk
// all of res rather than just res/home.html.
// https://git.daplie.com/Daplie/node-walk/merge_requests/1 fixes it,
// or if we get bored waiting for it to be merged, we could switch
// to a project that's actively maintained.
const SEARCH_PATHS = ['src', 'res'];

const FLOW_PARSER_OPTS = {
  esproposal_class_instance_fields: true,
  esproposal_class_static_fields: true,
  esproposal_decorators: true,
  esproposal_export_star_as: true,
  types: true,
};

function getObjectValue(obj, key) {
    for (const prop of obj.properties) {
        if (prop.key.type == 'Identifier' && prop.key.name == key) {
            return prop.value;
        }
    }
    return null;
}

function getTKey(arg) {
    if (arg.type == 'Literal') {
        return arg.value;
    } else if (arg.type == 'BinaryExpression' && arg.operator == '+') {
        return getTKey(arg.left) + getTKey(arg.right);
    } else if (arg.type == 'TemplateLiteral') {
        return arg.quasis.map((q) => {
            return q.value.raw;
        }).join('');
    }
    return null;
}

function getTranslationsJs(file) {
    const tree = flowParser.parse(fs.readFileSync(file, { encoding: 'utf8' }), FLOW_PARSER_OPTS);

    const trs = new Set();

    estreeWalker.walk(tree, {
        enter: function(node, parent) {
            if (
                node.type == 'CallExpression' &&
                TRANSLATIONS_FUNCS.includes(node.callee.name)
            ) {
                const tKey = getTKey(node.arguments[0]);
                // This happens whenever we call _t with non-literals (ie. whenever we've
                // had to use a _td to compensate) so is expected.
                if (tKey === null) return;

                let isPlural = false;
                if (node.arguments.length > 1 && node.arguments[1].type == 'ObjectExpression') {
                    const countVal = getObjectValue(node.arguments[1], 'count');
                    if (countVal) {
                        isPlural = true;
                    }
                }

                if (isPlural) {
                    trs.add(tKey + "|other");
                    const plurals = enPlurals[tKey];
                    if (plurals) {
                        for (const pluralType of Object.keys(plurals)) {
                            trs.add(tKey + "|" + pluralType);
                        }
                    }
                } else {
                    trs.add(tKey);
                }
            }
        }
    });

    return trs;
}

function getTranslationsOther(file) {
    const contents = fs.readFileSync(file, { encoding: 'utf8' });

    const trs = new Set();

    // Taken from riot-web src/components/structures/HomePage.js
    const translationsRegex = /_t\(['"]([\s\S]*?)['"]\)/mg;
    let matches;
    while (matches = translationsRegex.exec(contents)) {
        trs.add(matches[1]);
    }
    return trs;
}

// gather en_EN plural strings from the input translations file:
// the en_EN strings are all in the source with the exception of
// pluralised strings, which we need to pull in from elsewhere.
const inputTranslationsRaw = JSON.parse(fs.readFileSync(INPUT_TRANSLATIONS_FILE, { encoding: 'utf8' }));
const enPlurals = {};

for (const key of Object.keys(inputTranslationsRaw)) {
    const parts = key.split("|");
    if (parts.length > 1) {
        const plurals = enPlurals[parts[0]] || {};
        plurals[parts[1]] = inputTranslationsRaw[key];
        enPlurals[parts[0]] = plurals;
    }
}

const translatables = new Set();

const walkOpts = {
    listeners: {
        file: function(root, fileStats, next) {
            const fullPath = path.join(root, fileStats.name);

            let ltrs;
            if (fileStats.name.endsWith('.js')) {
                trs = getTranslationsJs(fullPath);
            } else if (fileStats.name.endsWith('.html')) {
                trs = getTranslationsOther(fullPath);
            } else {
                return;
            }
            console.log(`${fullPath} (${trs.size} strings)`);
            for (const tr of trs.values()) {
                translatables.add(tr);
            }
        },
    }
};

for (const path of SEARCH_PATHS) {
    if (fs.existsSync(path)) {
        walk.walkSync(path, walkOpts);
    }
}

const trObj = {};
for (const tr of translatables) {
    trObj[tr] = tr;
    if (tr.includes("|") && inputTranslationsRaw[tr]) {
        trObj[tr] = inputTranslationsRaw[tr];
    }
}

fs.writeFileSync(
    "src/i18n/strings/en_EN.json",
    JSON.stringify(trObj, translatables.values(), 4) + "\n"
);

