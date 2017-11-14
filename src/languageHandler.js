/*
Copyright 2017 MTRNord and Cooperative EITA
Copyright 2017 Vector Creations Ltd.

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

import request from 'browser-request';
import counterpart from 'counterpart';
import Promise from 'bluebird';
import React from 'react';

import UserSettingsStore from './UserSettingsStore';

const i18nFolder = 'i18n/';

// We use english strings as keys, some of which contain full stops
counterpart.setSeparator('|');
// Fall back to English
counterpart.setFallbackLocale('en');

// Function which only purpose is to mark that a string is translatable
// Does not actually do anything. It's helpful for automatic extraction of translatable strings
export function _td(s) {
    return s;
}

// Wrapper for counterpart's translation function so that it handles nulls and undefineds properly
// Takes the same arguments as counterpart.translate()
function safe_counterpart_translate(...args) {
    // Horrible hack to avoid https://github.com/vector-im/riot-web/issues/4191
    // The interpolation library that counterpart uses does not support undefined/null
    // values and instead will throw an error. This is a problem since everywhere else
    // in JS land passing undefined/null will simply stringify instead, and when converting
    // valid ES6 template strings to i18n strings it's extremely easy to pass undefined/null
    // if there are no existing null guards. To avoid this making the app completely inoperable,
    // we'll check all the values for undefined/null and stringify them here.
    if (args[1] && typeof args[1] === 'object') {
        Object.keys(args[1]).forEach((k) => {
            if (args[1][k] === undefined) {
                console.warn("safe_counterpart_translate called with undefined interpolation name: " + k);
                args[1][k] = 'undefined';
            }
            if (args[1][k] === null) {
                console.warn("safe_counterpart_translate called with null interpolation name: " + k);
                args[1][k] = 'null';
            }
        });
    }
    return counterpart.translate(...args);
}

/*
 * Translates text and optionally also replaces XML-ish elements in the text with e.g. React components
 * @param {string} text The untranslated text, e.g "click <a>here</a> now to %(foo)s".
 * @param {object} variables Variable substitutions, e.g { foo: 'bar' }
 * @param {object} tags Tag substitutions e.g. { 'a': (sub) => <a>{sub}</a> }
 *
 * In both variables and tags, the values to substitute with can be either simple strings, React components,
 * or functions that return the value to use in the substitution (e.g. return a React component). In case of
 * a tag replacement, the function receives as the argument the text inside the element corresponding to the tag.
 *
 * Use tag substitutions if you need to translate text between tags (e.g. "<a>Click here!</a>"), otherwise
 * you will end up with literal "<a>" in your output, rather than HTML. Note that you can also use variable
 * substitution to insert React components, but you can't use it to translate text between tags.
 *
 * @return a React <span> component if any non-strings were used in substitutions, otherwise a string
 */
export function _t(text, variables, tags) {
    // Don't do subsitutions in counterpart. We handle it ourselves so we can replace with React components
    // However, still pass the variables to counterpart so that it can choose the correct plural if count is given
    // It is enough to pass the count variable, but in the future counterpart might make use of other information too
    const args = Object.assign({ interpolate: false }, variables);

    // The translation returns text so there's no XSS vector here (no unsafe HTML, no code execution)
    const translated = safe_counterpart_translate(text, args);

    return substitute(translated, variables, tags);
}

/*
 * Similar to _t(), except only does substitutions, and no translation
 * @param {string} text The text, e.g "click <a>here</a> now to %(foo)s".
 * @param {object} variables Variable substitutions, e.g { foo: 'bar' }
 * @param {object} tags Tag substitutions e.g. { 'a': (sub) => <a>{sub}</a> }
 *
 * The values to substitute with can be either simple strings, or functions that return the value to use in
 * the substitution (e.g. return a React component). In case of a tag replacement, the function receives as
 * the argument the text inside the element corresponding to the tag.
 *
 * @return a React <span> component if any non-strings were used in substitutions, otherwise a string
 */
export function substitute(text, variables, tags) {
    const regexpMapping = {};

    if(variables !== undefined) {
        for (const variable in variables) {
            regexpMapping[`%\\(${variable}\\)s`] = variables[variable];
        }
    }

    if(tags !== undefined) {
        for (const tag in tags) {
            regexpMapping[`(<${tag}>(.*?)<\\/${tag}>|<${tag}>|<${tag}\\s*\\/>)`] = tags[tag];
        }
    }
    return replaceByRegexes(text, regexpMapping);
}

/*
 * Replace parts of a text using regular expressions
 * @param {string} text The text on which to perform substitutions
 * @param {object} mapping A mapping from regular expressions in string form to replacement string or a
 * function which will receive as the argument the capture groups defined in the regexp. E.g.
 * { 'Hello (.?) World': (sub) => sub.toUpperCase() }
 *
 * @return a React <span> component if any non-strings were used in substitutions, otherwise a string
 */
export function replaceByRegexes(text, mapping) {
    const output = [text];

    // If we insert any components we need to wrap the output in a span. React doesn't like just an array of components.
    let shouldWrapInSpan = false;

    for (const regexpString in mapping) {
        // TODO: Cache regexps
        const regexp = new RegExp(regexpString);

        // convert the last element in 'output' into 3 elements (pre-text, sub function, post-text).
        // Rinse and repeat for other patterns (using post-text).
        const inputText = output.pop();
        const match = inputText.match(regexp);
        if (!match) {
            output.push(inputText); // Push back input
            continue; // Missing matches is entirely possible, because translation might change things
        }
        const capturedGroups = match.slice(2);

        // Return the raw translation before the *match* followed by the return value of sub() followed
        // by the raw translation after the *match* (not captured group).

        const head = inputText.substr(0, match.index);
        if (head !== '') { // Don't push empty nodes, they are of no use
            output.push(head);
        }

        let replaced;
        // If substitution is a function, call it
        if(mapping[regexpString] instanceof Function) {
            replaced = mapping[regexpString].apply(null, capturedGroups);
        } else {
            replaced = mapping[regexpString];
        }

        // Here we also need to check that it actually is a string before comparing against one
        // The head and tail are always strings
        if (typeof replaced !== 'string' || replaced !== '') {
            output.push(replaced);
        }

        if(typeof replaced === 'object') {
            shouldWrapInSpan = true;
        }

        const tail = inputText.substr(match.index + match[0].length);
        if (tail !== '') {
            output.push(tail);
        }
    }

    if(shouldWrapInSpan) {
        return React.createElement('span', null, ...output);
    } else {
        return output.join('');
    }
}

// Allow overriding the text displayed when no translation exists
// Currently only used in unit tests to avoid having to load
// the translations in riot-web
export function setMissingEntryGenerator(f) {
    counterpart.setMissingEntryGenerator(f);
}

export function setLanguage(preferredLangs) {
    if (!Array.isArray(preferredLangs)) {
        preferredLangs = [preferredLangs];
    }

    let langToUse;
    let availLangs;
    return getLangsJson().then((result) => {
        availLangs = result;

        for (let i = 0; i < preferredLangs.length; ++i) {
            if (availLangs.hasOwnProperty(preferredLangs[i])) {
                langToUse = preferredLangs[i];
                break;
            }
        }
        if (!langToUse) {
            // Fallback to en_EN if none is found
            langToUse = 'en';
            console.error("Unable to find an appropriate language");
        }

        return getLanguage(i18nFolder + availLangs[langToUse].fileName);
    }).then((langData) => {
        counterpart.registerTranslations(langToUse, langData);
        counterpart.setLocale(langToUse);
        UserSettingsStore.setLocalSetting('language', langToUse);
        console.log("set language to " + langToUse);

        // Set 'en' as fallback language:
        if (langToUse != "en") {
            return getLanguage(i18nFolder + availLangs['en'].fileName);
        }
    }).then((langData) => {
        if (langData) counterpart.registerTranslations('en', langData);
    });
}

export function getAllLanguagesFromJson() {
    return getLangsJson().then((langsObject) => {
        const langs = [];
        for (const langKey in langsObject) {
            if (langsObject.hasOwnProperty(langKey)) {
                langs.push({
                    'value': langKey,
                    'label': langsObject[langKey].label,
                });
            }
        }
        return langs;
    });
}

export function getLanguagesFromBrowser() {
    if (navigator.languages && navigator.languages.length) return navigator.languages;
    if (navigator.language) return [navigator.language];
    return [navigator.userLanguage || "en"];
}

/**
 * Turns a language string, normalises it,
 * (see normalizeLanguageKey) into an array of language strings
 * with fallback to generic languages
 * (eg. 'pt-BR' => ['pt-br', 'pt'])
 *
 * @param {string} language The input language string
 * @return {string[]} List of normalised languages
 */
export function getNormalizedLanguageKeys(language) {
    const languageKeys = [];
    const normalizedLanguage = this.normalizeLanguageKey(language);
    const languageParts = normalizedLanguage.split('-');
    if (languageParts.length == 2 && languageParts[0] == languageParts[1]) {
        languageKeys.push(languageParts[0]);
    } else {
        languageKeys.push(normalizedLanguage);
        if (languageParts.length == 2) {
            languageKeys.push(languageParts[0]);
        }
    }
    return languageKeys;
}

/**
 * Returns a language string with underscores replaced with
 * hyphens, and lowercased.
 */
export function normalizeLanguageKey(language) {
    return language.toLowerCase().replace("_", "-");
}

export function getCurrentLanguage() {
    return counterpart.getLocale();
}

function getLangsJson() {
    return new Promise((resolve, reject) => {
        request(
            { method: "GET", url: i18nFolder + 'languages.json' },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    reject({err: err, response: response});
                    return;
                }
                resolve(JSON.parse(body));
            },
        );
    });
}

function weblateToCounterpart(inTrs) {
    const outTrs = {};

    for (const key of Object.keys(inTrs)) {
        const keyParts = key.split('|', 2);
        if (keyParts.length === 2) {
            let obj = outTrs[keyParts[0]];
            if (obj === undefined) {
                obj = {};
                outTrs[keyParts[0]] = obj;
            }
            obj[keyParts[1]] = inTrs[key];
        } else {
            outTrs[key] = inTrs[key];
        }
    }

    return outTrs;
}

function getLanguage(langPath) {
    return new Promise((resolve, reject) => {
        request(
            { method: "GET", url: langPath },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    reject({err: err, response: response});
                    return;
                }
                resolve(weblateToCounterpart(JSON.parse(body)));
            },
        );
    });
}
