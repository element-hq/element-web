/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import { TextDecoder, TextEncoder } from "node:util";

import { setLanguage } from "../../src/utils/i18n";
import en from "../../../../src/i18n/strings/en_EN.json";

// polyfilling TextEncoder as it is not available on JSDOM
// view https://github.com/facebook/jest/issues/9983
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

export function setupLanguageMock(): void {
    fetchMock
        .get("/i18n/languages.json", {
            en: "en_EN.json",
        })
        .get("end:en_EN.json", en);
}
setupLanguageMock();

setLanguage("en");
