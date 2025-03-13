/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";

import * as languageHandler from "../../src/languageHandler";
import en from "../../src/i18n/strings/en_EN.json";
import de from "../../src/i18n/strings/de_DE.json";

const lv = {
    Save: "Saglabāt",
    room: {
        upload: {
            uploading_multiple_file: {
                one: "Качване на %(filename)s и %(count)s друг",
            },
        },
    },
};

// Fake languages.json containing references to en_EN, de_DE and lv
// en_EN.json
// de_DE.json
// lv.json - mock version with few translations, used to test fallback translation

export function setupLanguageMock() {
    fetchMock
        .get("/i18n/languages.json", {
            en: "en_EN.json",
            de: "de_DE.json",
            lv: "lv.json",
        })
        .get("end:en_EN.json", en)
        .get("end:de_DE.json", de)
        .get("end:lv.json", lv);
}
setupLanguageMock();

languageHandler.setLanguage("en");
languageHandler.setMissingEntryGenerator((key) => key.split("|", 2)[1]);
