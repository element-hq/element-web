/*
Copyright 2017 MTRNord and Cooperative EITA
Copyright 2017 Vector Creations Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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
import React from 'react';

import SettingsStore from "./settings/SettingsStore";
import PlatformPeg from "./PlatformPeg";

// @ts-ignore - $webapp is a webpack resolve alias pointing to the output directory, see webpack config
import webpackLangJsonUrl from "$webapp/i18n/languages.json";
import { SettingLevel } from "./settings/SettingLevel";
import {retry} from "./utils/promise";

const i18nFolder = 'i18n/';

// Control whether to also return original, untranslated strings
// Useful for debugging and testing
const ANNOTATE_STRINGS = false;

// We use english strings as keys, some of which contain full stops
counterpart.setSeparator('|');
// Fall back to English
counterpart.setFallbackLocale('en');

interface ITranslatableError extends Error {
    translatedMessage: string;
}

/**
 * Helper function to create an error which has an English message
 * with a translatedMessage property for use by the consumer.
 * @param {string} message Message to translate.
 * @returns {Error} The constructed error.
 */
export function newTranslatableError(message: string) {
    const error = new Error(message) as ITranslatableError;
    error.translatedMessage = _t(message);
    return error;
}

// Function which only purpose is to mark that a string is translatable
// Does not actually do anything. It's helpful for automatic extraction of translatable strings
export function _td(s: string): string {
    return s;
}

// Wrapper for counterpart's translation function so that it handles nulls and undefineds properly
// Takes the same arguments as counterpart.translate()
function safeCounterpartTranslate(text: string, options?: object) {
    // Horrible hack to avoid https://github.com/vector-im/element-web/issues/4191
    // The interpolation library that counterpart uses does not support undefined/null
    // values and instead will throw an error. This is a problem since everywhere else
    // in JS land passing undefined/null will simply stringify instead, and when converting
    // valid ES6 template strings to i18n strings it's extremely easy to pass undefined/null
    // if there are no existing null guards. To avoid this making the app completely inoperable,
    // we'll check all the values for undefined/null and stringify them here.
    let count;

    if (options && typeof options === 'object') {
        count = options['count'];
        Object.keys(options).forEach((k) => {
            if (options[k] === undefined) {
                console.warn("safeCounterpartTranslate called with undefined interpolation name: " + k);
                options[k] = 'undefined';
            }
            if (options[k] === null) {
                console.warn("safeCounterpartTranslate called with null interpolation name: " + k);
                options[k] = 'null';
            }
        });
    }
    let translated = counterpart.translate(text, options);
    if (translated === undefined && count !== undefined) {
        // counterpart does not do fallback if no pluralisation exists
        // in the preferred language, so do it here
        translated = counterpart.translate(text, Object.assign({}, options, {locale: 'en'}));
    }
    return translated;
}

export interface IVariables {
    count?: number;
    [key: string]: number | string;
}

type Tags = Record<string, (sub: string) => React.ReactNode>;

export type TranslatedString = string | React.ReactNode;

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
export function _t(text: string, variables?: IVariables): string;
export function _t(text: string, variables: IVariables, tags: Tags): React.ReactNode;
export function _t(text: string, variables?: IVariables, tags?: Tags): TranslatedString {
    // Don't do substitutions in counterpart. We handle it ourselves so we can replace with React components
    // However, still pass the variables to counterpart so that it can choose the correct plural if count is given
    // It is enough to pass the count variable, but in the future counterpart might make use of other information too
    const args = Object.assign({ interpolate: false }, variables);

    // The translation returns text so there's no XSS vector here (no unsafe HTML, no code execution)
    const translated = safeCounterpartTranslate(text, args);

    const substituted = substitute(translated, variables, tags);

    // For development/testing purposes it is useful to also output the original string
    // Don't do that for release versions
    if (ANNOTATE_STRINGS) {
        if (typeof substituted === 'string') {
            return `@@${text}##${substituted}@@`;
        } else {
            return <span className='translated-string' data-orig-string={text}>{substituted}</span>;
        }
    } else {
        return substituted;
    }
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
export function substitute(text: string, variables?: IVariables): string;
export function substitute(text: string, variables: IVariables, tags: Tags): string;
export function substitute(text: string, variables?: IVariables, tags?: Tags): string | React.ReactNode {
    let result: React.ReactNode | string = text;

    if (variables !== undefined) {
        const regexpMapping: IVariables = {};
        for (const variable in variables) {
            regexpMapping[`%\\(${variable}\\)s`] = variables[variable];
        }
        result = replaceByRegexes(result as string, regexpMapping);
    }

    if (tags !== undefined) {
        const regexpMapping: Tags = {};
        for (const tag in tags) {
            regexpMapping[`(<${tag}>(.*?)<\\/${tag}>|<${tag}>|<${tag}\\s*\\/>)`] = tags[tag];
        }
        result = replaceByRegexes(result as string, regexpMapping);
    }

    return result;
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
export function replaceByRegexes(text: string, mapping: IVariables): string;
export function replaceByRegexes(text: string, mapping: Tags): React.ReactNode;
export function replaceByRegexes(text: string, mapping: IVariables | Tags): string | React.ReactNode {
    // We initially store our output as an array of strings and objects (e.g. React components).
    // This will then be converted to a string or a <span> at the end
    const output = [text];

    // If we insert any components we need to wrap the output in a span. React doesn't like just an array of components.
    let shouldWrapInSpan = false;

    for (const regexpString in mapping) {
        // TODO: Cache regexps
        const regexp = new RegExp(regexpString, "g");

        // Loop over what output we have so far and perform replacements
        // We look for matches: if we find one, we get three parts: everything before the match, the replaced part,
        // and everything after the match. Insert all three into the output. We need to do this because we can insert objects.
        // Otherwise there would be no need for the splitting and we could do simple replacement.
        let matchFoundSomewhere = false; // If we don't find a match anywhere we want to log it
        for (let outputIndex = 0; outputIndex < output.length; outputIndex++) {
            const inputText = output[outputIndex];
            if (typeof inputText !== 'string') { // We might have inserted objects earlier, don't try to replace them
                continue;
            }

            // process every match in the string
            // starting with the first
            let match = regexp.exec(inputText);

            if (!match) continue;
            matchFoundSomewhere = true;

            // The textual part before the first match
            const head = inputText.substr(0, match.index);

            const parts = [];
            // keep track of prevMatch
            let prevMatch;
            while (match) {
                // store prevMatch
                prevMatch = match;
                const capturedGroups = match.slice(2);

                let replaced;
                // If substitution is a function, call it
                if (mapping[regexpString] instanceof Function) {
                    replaced = (mapping as Tags)[regexpString].apply(null, capturedGroups);
                } else {
                    replaced = mapping[regexpString];
                }

                if (typeof replaced === 'object') {
                    shouldWrapInSpan = true;
                }

                // Here we also need to check that it actually is a string before comparing against one
                // The head and tail are always strings
                if (typeof replaced !== 'string' || replaced !== '') {
                    parts.push(replaced);
                }

                // try the next match
                match = regexp.exec(inputText);

                // add the text between prevMatch and this one
                // or the end of the string if prevMatch is the last match
                let tail;
                if (match) {
                    const startIndex = prevMatch.index + prevMatch[0].length;
                    tail = inputText.substr(startIndex, match.index - startIndex);
                } else {
                    tail = inputText.substr(prevMatch.index + prevMatch[0].length);
                }
                if (tail) {
                    parts.push(tail);
                }
            }

            // Insert in reverse order as splice does insert-before and this way we get the final order correct
            // remove the old element at the same time
            output.splice(outputIndex, 1, ...parts);

            if (head !== '') { // Don't push empty nodes, they are of no use
                output.splice(outputIndex, 0, head);
            }
        }
        if (!matchFoundSomewhere) { // The current regexp did not match anything in the input
            // Missing matches is entirely possible because you might choose to show some variables only in the case
            // of e.g. plurals. It's still a bit suspicious, and could be due to an error, so log it.
            // However, not showing count is so common that it's not worth logging. And other commonly unused variables
            // here, if there are any.
            if (regexpString !== '%\\(count\\)s') {
                console.log(`Could not find ${regexp} in ${text}`);
            }
        }
    }

    if (shouldWrapInSpan) {
        return React.createElement('span', null, ...output);
    } else {
        return output.join('');
    }
}

// Allow overriding the text displayed when no translation exists
// Currently only used in unit tests to avoid having to load
// the translations in element-web
export function setMissingEntryGenerator(f: (value: string) => void) {
    counterpart.setMissingEntryGenerator(f);
}

export function setLanguage(preferredLangs: string | string[]) {
    if (!Array.isArray(preferredLangs)) {
        preferredLangs = [preferredLangs];
    }

    const plaf = PlatformPeg.get();
    if (plaf) {
        plaf.setLanguage(preferredLangs);
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

        return getLanguageRetry(i18nFolder + availLangs[langToUse].fileName);
    }).then((langData) => {
        counterpart.registerTranslations(langToUse, langData);
        counterpart.setLocale(langToUse);
        SettingsStore.setValue("language", null, SettingLevel.DEVICE, langToUse);
        console.log("set language to " + langToUse);

        // Set 'en' as fallback language:
        if (langToUse !== "en") {
            return getLanguageRetry(i18nFolder + availLangs['en'].fileName);
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

export function getLanguageFromBrowser() {
    return getLanguagesFromBrowser()[0];
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
export function getNormalizedLanguageKeys(language: string) {
    const languageKeys: string[] = [];
    const normalizedLanguage = normalizeLanguageKey(language);
    const languageParts = normalizedLanguage.split('-');
    if (languageParts.length === 2 && languageParts[0] === languageParts[1]) {
        languageKeys.push(languageParts[0]);
    } else {
        languageKeys.push(normalizedLanguage);
        if (languageParts.length === 2) {
            languageKeys.push(languageParts[0]);
        }
    }
    return languageKeys;
}

/**
 * Returns a language string with underscores replaced with
 * hyphens, and lowercased.
 *
 * @param {string} language The language string to be normalized
 * @returns {string} The normalized language string
 */
export function normalizeLanguageKey(language: string) {
    return language.toLowerCase().replace("_", "-");
}

export function getCurrentLanguage() {
    return counterpart.getLocale();
}

/**
 * Given a list of language codes, pick the most appropriate one
 * given the current language (ie. getCurrentLanguage())
 * English is assumed to be a reasonable default.
 *
 * @param {string[]} langs List of language codes to pick from
 * @returns {string} The most appropriate language code from langs
 */
export function pickBestLanguage(langs: string[]): string {
    const currentLang = getCurrentLanguage();
    const normalisedLangs = langs.map(normalizeLanguageKey);

    {
        // Best is an exact match
        const currentLangIndex = normalisedLangs.indexOf(currentLang);
        if (currentLangIndex > -1) return langs[currentLangIndex];
    }

    {
        // Failing that, a different dialect of the same language
        const closeLangIndex = normalisedLangs.findIndex((l) => l.substr(0, 2) === currentLang.substr(0, 2));
        if (closeLangIndex > -1) return langs[closeLangIndex];
    }

    {
        // Neither of those? Try an english variant.
        const enIndex = normalisedLangs.findIndex((l) => l.startsWith('en'));
        if (enIndex > -1) return langs[enIndex];
    }

    // if nothing else, use the first
    return langs[0];
}

function getLangsJson(): Promise<object> {
    return new Promise((resolve, reject) => {
        let url;
        if (typeof(webpackLangJsonUrl) === 'string') { // in Jest this 'url' isn't a URL, so just fall through
            url = webpackLangJsonUrl;
        } else {
            url = i18nFolder + 'languages.json';
        }
        request(
            { method: "GET", url },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    reject(err);
                    return;
                }
                resolve(JSON.parse(body));
            },
        );
    });
}

function weblateToCounterpart(inTrs: object): object {
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

async function getLanguageRetry(langPath: string, num = 3): Promise<object> {
    return retry(() => getLanguage(langPath), num, e => {
        console.log("Failed to load i18n", langPath);
        console.error(e);
        return true; // always retry
    });
}

function getLanguage(langPath: string): Promise<object> {
    return new Promise((resolve, reject) => {
        request(
            { method: "GET", url: langPath },
            (err, response, body) => {
                if (err || response.status < 200 || response.status >= 300) {
                    reject(err);
                    return;
                }
                resolve(weblateToCounterpart(JSON.parse(body)));
            },
        );
    });
}
