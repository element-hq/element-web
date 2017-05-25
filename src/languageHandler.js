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

export function setLanguage(languages) {
    request(i18nFolder + 'languages.json', function(err, response, body) {
        function getLanguage(langPath, langCode, callback) {
            let response_return = {};
            let resp_raw = {};
            request(
                { method: "GET", url: langPath },
                (err, response, body) => {
                    if (err || response.status < 200 || response.status >= 300) {
                        if (response) {
                            if (response.status == 404 || (response.status == 0 && body == '')) {
                                resp_raw = {};
                            }
                        }
                        const resp = {err: err, response: resp_raw};
                        err = resp['err'];
                        const response_cb = resp['response'];
                        callback(err, response_cb, langCode);
                        return;
                    }

                    response_return = JSON.parse(body);
                    callback(null, response_return, langCode);
                    return;
                }
            );
            return;
        }

        function registerTranslations(err, langJson, langCode){
            if (err !== null) {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: counterpart.translate('Error changing language'),
                    description: counterpart.translate('Riot was unable to find the correct Data for the selected Language.'),
                    button: counterpart.translate("OK"),
                });
                return;
            } else {
                counterpart.registerTranslations(langCode, langJson);
            }
        }

        let languageFiles = {};
        if(err){
            console.error(err);
            return;
        } else {
            if (body) {
                languageFiles = JSON.parse(body);
            } else {
                languageFiles = JSON.parse('{"en": "en_EN.json"}');
            }
        }


        const isValidFirstLanguage = (languageFiles.hasOwnProperty(languages[0]));
        var validLanguageKey = "";
        if ((isValidFirstLanguage) || (languages.length==2 && languageFiles.hasOwnProperty(languages[1]))) {
            validLanguageKey = (isValidFirstLanguage) ? languages[0] : languages[1];
            getLanguage(i18nFolder + languageFiles[validLanguageKey], validLanguageKey, registerTranslations);
            counterpart.setLocale(validLanguageKey);
            UserSettingsStore.setLocalSetting('language', validLanguageKey);
            console.log("set language to "+validLanguageKey);
        } else {
            console.log("didnt find any language file");
        }

        //Set 'en' as fallback language:
        if (validLanguageKey!="en") {
            getLanguage(i18nFolder + languageFiles['en'], 'en', registerTranslations);
        }
        counterpart.setFallbackLocale('en');
    });
};

export function getAllLanguageKeysFromJson() {
    let deferred = q.defer();

    request(
        { method: "GET", url: i18nFolder + 'languages.json' },
        (err, response, body) => {
            if (err || response.status < 200 || response.status >= 300) {
                if (response) {
                    if (response.status == 404 || (response.status == 0 && body == '')) {
                        deferred.resolve({});
                    }
                }
                deferred.reject({err: err, response: response});
                return;
            }
            var languages = JSON.parse(body);
            // If no language is found, fallback to 'en':
            if (!languages) {
                languages = [{"en": "en_EN.json"}];
            }
            const languageKeys = Object.keys(languages);
            deferred.resolve(languageKeys);
        }
    );
    return deferred.promise;
}

export function getLanguageFromBrowser() {
    return navigator.languages[0] || navigator.language || navigator.userLanguage;
};

export function getNormalizedLanguageKeys(language) {
    if (!language) {
        return;
    }
    const languageKeys = [];
    const normalizedLanguage = this.normalizeLanguageKey(language);
    const languageParts = normalizedLanguage.split('-');
    if (languageParts.length==2 && languageParts[0]==languageParts[1]) {
        languageKeys.push(languageParts[0]);
    } else {
        languageKeys.push(normalizedLanguage);
        if (languageParts.length==2) {
            languageKeys.push(languageParts[0]);
        }
    }
    return languageKeys;
};

export function normalizeLanguageKey(language) {
    return language.toLowerCase().replace("_","-");
};
