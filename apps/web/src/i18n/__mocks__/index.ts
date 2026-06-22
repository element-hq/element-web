/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/vitest";
import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api";

import { registerCustomTranslations } from "../settings";
import SdkConfig from "../../SdkConfig.ts";

export async function setupTranslationOverridesForTests(overrides: TranslationStringsObject) {
    const lookupUrl = "/translations.json";

    SdkConfig.add({
        custom_translations_url: lookupUrl,
    });
    fetchMock.get(lookupUrl, overrides);
    await registerCustomTranslations({
        testOnlyIgnoreCustomTranslationsCache: true,
    });
}
