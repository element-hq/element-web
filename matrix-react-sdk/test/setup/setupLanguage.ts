/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import fetchMock from "fetch-mock-jest";

import * as languageHandler from "../../src/languageHandler";
import en from "../../src/i18n/strings/en_EN.json";
import de from "../../src/i18n/strings/de_DE.json";

const lv = {
    "Save": "Saglabāt",
    "Uploading %(filename)s and %(count)s others|one": "Качване на %(filename)s и %(count)s друг",
};

// Fake languages.json containing references to en_EN, de_DE and lv
// en_EN.json
// de_DE.json
// lv.json - mock version with few translations, used to test fallback translation

type Translations = Record<string, Record<string, string> | string>;

function weblateToCounterpart(inTrs: Record<string, string>): Translations {
    const outTrs: Translations = {};

    for (const key of Object.keys(inTrs)) {
        const keyParts = key.split("|", 2);
        if (keyParts.length === 2) {
            let obj = outTrs[keyParts[0]];
            if (obj === undefined) {
                obj = outTrs[keyParts[0]] = {};
            } else if (typeof obj === "string") {
                // This is a transitional edge case if a string went from singular to pluralised and both still remain
                // in the translation json file. Use the singular translation as `other` and merge pluralisation atop.
                obj = outTrs[keyParts[0]] = {
                    other: inTrs[key],
                };
                console.warn("Found entry in i18n file in both singular and pluralised form", keyParts[0]);
            }
            obj[keyParts[1]] = inTrs[key];
        } else {
            outTrs[key] = inTrs[key];
        }
    }

    return outTrs;
}

fetchMock
    .get("/i18n/languages.json", {
        en: {
            fileName: "en_EN.json",
            label: "English",
        },
        de: {
            fileName: "de_DE.json",
            label: "German",
        },
        lv: {
            fileName: "lv.json",
            label: "Latvian",
        },
    })
    .get("end:en_EN.json", weblateToCounterpart(en))
    .get("end:de_DE.json", weblateToCounterpart(de))
    .get("end:lv.json", weblateToCounterpart(lv));

languageHandler.setLanguage("en");
languageHandler.setMissingEntryGenerator((key) => key.split("|", 2)[1]);
