/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api";
import { vi, beforeAll } from "vitest";
import fetchMock from "@fetch-mock/vitest";

import SdkConfig from "../../SdkConfig";
import { registerCustomTranslations } from "../custom";

beforeAll(() => {
    vi.stubEnv("NODE_ENV", "test");
});

export async function setupTranslationOverridesForTests(overrides: TranslationStringsObject) {
    const lookupUrl = "/translations.json";

    SdkConfig.add({
        custom_translations_url: lookupUrl,
    });
    fetchMock.get(lookupUrl, overrides, { name: "i18n-override" });
    await registerCustomTranslations({
        testOnlyIgnoreCustomTranslationsCache: true,
    });
}
