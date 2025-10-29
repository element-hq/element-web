/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";

import { setLanguage } from "../../src/utils/i18n";
import en from "../../../../src/i18n/strings/en_EN.json";

export function setupLanguageMock() {
    fetchMock
        .get("/i18n/languages.json", {
            en: "en_EN.json",
        })
        .get("end:en_EN.json", en);
}
setupLanguageMock();

setLanguage("en");
