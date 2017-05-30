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
import q from 'q';
import sanitizeHtml from "sanitize-html";

import UserSettingsStore from './UserSettingsStore';

const i18nFolder = 'i18n/';

// We use english strings as keys, some of which contain full stops
counterpart.setSeparator('|');
// Fall back to English
counterpart.setFallbackLocale('en');

// The translation function. This is just a simple wrapper to counterpart,
// but exists mostly because we must use the same counterpart instance
// between modules (ie. here (react-sdk) and the app (riot-web), and if we
// just import counterpart and use it directly, we end up using a different
// instance.
export function _t(...args) {
    return counterpart.translate(...args);
}

/*
 * Translates stringified JSX into translated JSX. E.g
 *    _tJsx(
 *        "click <a href=''>here</a> now",
 *        /<a href=''>(.*?)<\/a>/,
 *        (sub) => { return <a href=''>{ sub }</a>; }
 *    );
 *
 * @param {string} jsxText The untranslated stringified JSX e.g "click <a href=''>here</a> now".
 * This will be translated by passing the string through to _t(...)
 *
 * @param {RegExp} pattern A regexp to match against the translated text.
 * The captured groups from the regexp will be fed to 'sub'.
 * Only the captured groups will be included in the output, the match itself is discarded.
 *
 * @param {Function} sub A function which will be called
 * with multiple args, each arg representing a captured group of the matching regexp.
 * This function must return a JSX node.
 *
 * @return A list of strings/JSX nodes.
 */
export function _tJsx(jsxText, pattern, sub) {
    if (!pattern instanceof RegExp) {
        throw new Error(`_tJsx: programmer error. expected RegExp for text: ${jsxText}`);
    }
    if (!sub instanceof Function) {
        throw new Error(`_tJsx: programmer error. expected Function for text: ${jsxText}`);
    }

    // tJsxText may be unsafe if malicious translators try to inject HTML.
    // Run this through sanitize-html and bail if the output isn't identical
    const tJsxText = _t(jsxText);
    const sanitized = sanitizeHtml(tJsxText);
    if (tJsxText !== sanitized) {
        throw new Error(`_tJsx: translator error. untrusted HTML supplied. '${tJsxText}' != '${sanitized}'`);
    }
    let match = tJsxText.match(pattern);
    if (!match) {
        throw new Error(`_tJsx: translator error. expected translation to match regexp: ${pattern}`);
    }
    let capturedGroups = match.slice(1);
    // Return the raw translation before the *match* followed by the return value of sub() followed
    // by the raw translation after the *match* (not captured group).
    return [
        tJsxText.substr(0, match.index),
        sub.apply(null, capturedGroups),
        tJsxText.substr(match.index + match[0].length),
    ];
}

// Allow overriding the text displayed when no translation exists
// Currently only use din unit tests to avoid having to load
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
            throw new Error("Unable to find an appropriate language");
        }

        return getLanguage(i18nFolder + availLangs[langToUse]);
    }).then((langData) => {
        counterpart.registerTranslations(langToUse, langData);
        counterpart.setLocale(langToUse);
        UserSettingsStore.setLocalSetting('language', langToUse);
        console.log("set language to " + langToUse);

        // Set 'en' as fallback language:
        if (langToUse != "en") {
            return getLanguage(i18nFolder + availLangs['en']);
        }
    }).then((langData) => {
        if (langData) counterpart.registerTranslations('en', langData);
    });
};

export function getAllLanguageKeysFromJson() {
    return getLangsJson().then((langs) => {
        return Object.keys(langs);
    });
}

export function getLanguagesFromBrowser() {
    if (navigator.languages && navigator.languages.length) return navigator.languages;
    if (navigator.language) return [navigator.language];
    return [navigator.userLanguage];
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
};

/**
 * Returns a language string with underscores replaced with
 * hyphens, and lowercased.
 */
export function normalizeLanguageKey(language) {
    return language.toLowerCase().replace("_","-");
};

export function getCurrentLanguage() {
    return counterpart.getLocale();
}

function getLangsJson() {
    const deferred = q.defer();

    request(
        { method: "GET", url: i18nFolder + 'languages.json' },
        (err, response, body) => {
            if (err || response.status < 200 || response.status >= 300) {
                deferred.reject({err: err, response: response});
                return;
            }
            deferred.resolve(JSON.parse(body));
        }
    );
    return deferred.promise;
}

function getLanguage(langPath) {
    const deferred = q.defer();

    let response_return = {};
    request(
        { method: "GET", url: langPath },
        (err, response, body) => {
            if (err || response.status < 200 || response.status >= 300) {
                deferred.reject({err: err, response: response});
                return;
            }

            deferred.resolve(JSON.parse(body));
        }
    );
    return deferred.promise;
}
