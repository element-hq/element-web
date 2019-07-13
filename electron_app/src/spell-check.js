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

const { ipcMain } = require('electron');
const spellchecker = require('simple-spellchecker');

let enabledDictionaries = [];
let checker = null;

// those languages I found in library. I didn't found method to get available language,
// so we should keep those in sync
const dictionaries = [
    'de-DE',
    'en-GB',
    'en-US',
    'en-ES',
    'es-MX',
    'fr-FR',
    'it-IT',
    'lt-LT',
    'nl-NL',
    'pl-PL',
    'pt-BR',
    'sv-SE',
];

const updateChecker = async () => {
    return new Promise((resolve, reject) => {
        if (enabledDictionaries.length === 0) {
            checker = () => true;
            resolve();
        }
        if (enabledDictionaries.length === 1) {
            spellchecker.getDictionary(enabledDictionaries[0], function(err, dict) {
                if (err) {
                    reject(err);
                } else {
                    checker = dict;
                    resolve();
                }
            });
        }
    });
};

const enable = async (...dictionaries) => {
    enabledDictionaries = dictionaries;
    await updateChecker();
    console.log('checker updated', enabledDictionaries);
    return enabledDictionaries.length > 0;
};

const disable = async (...dictionaries) => {
    enabledDictionaries = [];
    await updateChecker();
};

module.exports = () => {
    ipcMain.on('spellcheck:setlanguage', async (event, arg) => {
        console.log('enable language', arg);
        await enable(arg);
        event.sender.send('spellcheck:ready', { ready: true });
    });
    ipcMain.on('spellcheck:disablelanguage', (event, arg) => {
        disable(arg);
    });
    ipcMain.on('spellcheck:test', (event, arg) => {
        if (checker) {
            event.returnValue = checker.spellCheck(arg);
        } else {
            console.error('checker not ready, mocking');
            event.returnValue = false;
        }
    });
    ipcMain.on('spellcheck:ismisspeled', (event, arg) => {
        console.log('misspeled', arg, checker.isMisspelled(arg));
        event.returnValue = checker.isMisspelled(arg);
    });
    ipcMain.on('spellcheck:corrections', (event, arg) => {
        event.returnValue = checker.checkAndSuggest(arg);
    });
    return {
        getLanguages: () => {
            return dictionaries;
        },
        getCorrections: (selection) => {
            return checker.checkAndSuggest(selection);
        },
    };
};
