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

let enabledDictionary = null;
let checker = null;
let enabled = false;
// those languages I found in library. I didn't found method to get available languages,
// so we should keep those in sync or find better way
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
        if (enabledDictionary === null) {
            checker = () => true;
            resolve();
        } else {
            spellchecker.getDictionary(enabledDictionary, function(err, dict) {
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

const enable = async (dictionary) => {
    enabledDictionary = dictionary;
    await updateChecker();
    enabled = true;
};

const disable = () => {
    enabled = false;
    enabledDictionary = [];
    updateChecker();
};

module.exports = () => {
    ipcMain.on('spellcheck:disablelanguage', (event, arg) => {
        disable(arg);
    });
    ipcMain.on('spellcheck:test', (event, arg) => {
        if (checker) {
            event.returnValue = checker.spellCheck(arg);
        } else {
            event.returnValue = false;
        }
    });
    ipcMain.on('spellcheck:ismisspeled', (event, arg) => {
        if (enabled) {
            event.returnValue = checker.checkAndSuggest(arg).misspelled;
        }
    });
    return {
        getLanguages: () => {
            return dictionaries;
        },
        isMisspelled: (selection) => {
            return enabled ? checker.checkAndSuggest(selection) : null;
        },
        getCurrentLanguage: () => {
            return enabledDictionary;
        },
        setLanguage: async (lng) => {
            await enable(lng);
        },
        disable: () => {
            console.log('disable spell check');
            disable();
        },
    };
};
