/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger } from "matrix-js-sdk/src/logger";
import { MapWithDefault } from "matrix-js-sdk/src/utils";
import _ from "lodash";
import { type TranslationStringsObject } from "@matrix-org/react-sdk-module-api";
import { KEY_SEPARATOR, registerTranslations } from "@element-hq/web-shared-components";

import SdkConfig from "../SdkConfig";
import { ModuleRunner } from "../modules/ModuleRunner";

let cachedCustomTranslations: TranslationStringsObject | undefined;
let cachedCustomTranslationsExpire = 0; // zero to trigger expiration right away

/**
 * Any custom modules with translations to load are parsed first, followed by an
 * optionally defined translations file in the config. If no customization is made,
 * or the file can't be parsed, no action will be taken.
 *
 * This function should be called *after* registering other translations data to
 * ensure it overrides strings properly.
 */
export async function registerCustomTranslations({
    testOnlyIgnoreCustomTranslationsCache = false,
}: {
    testOnlyIgnoreCustomTranslationsCache?: boolean;
} = {}): Promise<void> {
    const moduleTranslations = ModuleRunner.instance.allTranslations;
    doRegisterTranslations(moduleTranslations);

    const lookupUrl = SdkConfig.get().custom_translations_url;
    if (!lookupUrl) return; // easy - nothing to do

    try {
        let json: TranslationStringsObject | undefined;
        if (testOnlyIgnoreCustomTranslationsCache || Date.now() >= cachedCustomTranslationsExpire) {
            json = (await (await fetch(lookupUrl)).json()) as TranslationStringsObject;
            cachedCustomTranslations = json;

            // Set expiration to the future, but not too far. Just trying to avoid
            // repeated, successive, calls to the server rather than anything long-term.
            cachedCustomTranslationsExpire = Date.now() + 5 * 60 * 1000;
        } else {
            json = cachedCustomTranslations;
        }

        // If the (potentially cached) json is invalid, don't use it.
        if (!json) return;

        // Finally, register it.
        doRegisterTranslations(json);
    } catch (e) {
        // We consume all exceptions because it's considered non-fatal for custom
        // translations to break. Most failures will be during initial development
        // of the json file and not (hopefully) at runtime.
        logger.warn("Ignoring error while registering custom translations: ", e);

        // Like above: trigger a cache of the json to avoid successive calls.
        cachedCustomTranslationsExpire = Date.now() + 5 * 60 * 1000;
    }
}

function doRegisterTranslations(customTranslations: TranslationStringsObject): void {
    // We convert the operator-friendly version into something counterpart can consume.
    // Map: lang → Record: string → translation
    const langs: MapWithDefault<string, Record<string, string>> = new MapWithDefault(() => ({}));
    for (const [translationKey, translations] of Object.entries(customTranslations)) {
        for (const [lang, translation] of Object.entries(translations)) {
            _.set(langs.getOrCreate(lang), translationKey.split(KEY_SEPARATOR), translation);
        }
    }

    // Finally, tell counterpart about our translations
    for (const [lang, translations] of langs) {
        registerTranslations(lang, translations);
    }
}
