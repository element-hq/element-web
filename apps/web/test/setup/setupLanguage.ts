/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/jest";
import { ModuleLoader } from "@element-hq/element-web-module-api";
import { merge } from "lodash";

import * as languageHandler from "../../src/languageHandler";
import enElementWeb from "../../src/i18n/strings/en_EN.json";
import deElementWeb from "../../src/i18n/strings/de_DE.json";
// Cheat and import relatively here as these aren't exported by the module (should they be?)
// eslint-disable-next-line no-restricted-imports
import enSharedComponents from "../../../../packages/shared-components/src/i18n/strings/en_EN.json";
// eslint-disable-next-line no-restricted-imports
import deSharedComponents from "../../../../packages/shared-components/src/i18n/strings/de_DE.json";
import { ModuleApi } from "../../src/modules/Api";

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
    // Pull the translations from shared components too as they have
    // the strings for things like `humanizeTime` which do appear in
    // snapshots (needs 'merge' which does a deep-merge rather than just
    // replacing top-level keys).
    const enTranslations = merge(enElementWeb, enSharedComponents);
    const deTranslations = merge(deElementWeb, deSharedComponents);

    fetchMock.mockGlobal();
    fetchMock
        .get(
            "end:/i18n/languages.json",
            {
                en: "en_EN.json",
                de: "de_DE.json",
                lv: "lv.json",
            },
            { name: "languages" },
        )
        .get("end:en_EN.json", enTranslations)
        .get("end:de_DE.json", deTranslations)
        .get("end:lv.json", lv);
}
beforeEach(setupLanguageMock);
afterEach(() => fetchMock.callHistory.flush());

// Initialise the fetchMock before the test starts so the languageHandler.setLanguage call below can function
setupLanguageMock();
languageHandler.setLanguage("en");
languageHandler.setMissingEntryGenerator((key) => key.split("|", 2)[1]);

// Set up the module API (so the i18n API exists)
const moduleLoader = new ModuleLoader(ModuleApi.instance);
window.mxModuleLoader = moduleLoader;
