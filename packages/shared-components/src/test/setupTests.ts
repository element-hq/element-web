/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/vitest";
import { cleanup } from "@test-utils";
import { afterEach } from "vitest";

import { setLanguage } from "../../src/utils/i18n";
import en from "../i18n/strings/en_EN.json";

function setupLanguageMock(): void {
    fetchMock
        .get("end:/i18n/languages.json", {
            en: "en_EN.json",
        })
        .get("end:en_EN.json", en);
}
setupLanguageMock();
fetchMock.mockGlobal();

setLanguage("en");

afterEach(() => {
    cleanup();
});
