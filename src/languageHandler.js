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
    if (navigator.languages) return navigator.languages;
    if (navigator.language) return [navigator.language]
    return [navigator.userLanguage];
};

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
