/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger } from "matrix-js-sdk/src/logger";
import { getLangsJson, registerTranslations, setLocale } from "@element-hq/web-shared-components";

import SettingsStore from "../settings/SettingsStore";
import PlatformPeg from "../PlatformPeg";
import { SettingLevel } from "../settings/SettingLevel";
import { getLanguageRetry } from "./languages";
import { registerCustomTranslations } from "./custom";

export const DEFAULT_LANGUAGE = "zh-hans";
const DEFAULT_LANGUAGE_MIGRATION_KEY = "mx_default_language_zh_hans_v2";
const LEGACY_DEFAULT_LANGUAGES = new Set(["en", "en_EN"]);

const shouldMigrateLegacyDefaultLanguage = (language: string): boolean => {
    try {
        return (
            LEGACY_DEFAULT_LANGUAGES.has(language) && localStorage.getItem(DEFAULT_LANGUAGE_MIGRATION_KEY) !== "true"
        );
    } catch {
        return false;
    }
};

export const markDefaultLanguageMigrated = (): void => {
    try {
        localStorage.setItem(DEFAULT_LANGUAGE_MIGRATION_KEY, "true");
    } catch {
        // The selected language remains usable when persistent storage is unavailable.
    }
};

export function getUserLanguage(): string {
    const language = SettingsStore.getValue("language", null, /*excludeDefault:*/ true);
    if (typeof language === "string" && language !== "" && !shouldMigrateLegacyDefaultLanguage(language)) {
        return language;
    }

    return DEFAULT_LANGUAGE;
}

export async function setLanguage(...preferredLangs: string[]): Promise<void> {
    PlatformPeg.get()?.setLanguage(preferredLangs);

    const availableLanguages = await getLangsJson();
    let chosenLanguage = preferredLangs.find((lang) => availableLanguages.hasOwnProperty(lang));
    if (!chosenLanguage) {
        // Fallback to en_EN if none is found
        chosenLanguage = "en";
        logger.error("Unable to find an appropriate language, preferred: ", preferredLangs);
    }

    const languageData = await getLanguageRetry(availableLanguages[chosenLanguage]);

    registerTranslations(chosenLanguage, languageData);
    setLocale(chosenLanguage);

    await SettingsStore.setValue("language", null, SettingLevel.DEVICE, chosenLanguage);
    // Adds a lot of noise to test runs, so disable logging there.
    if (process.env.NODE_ENV !== "test") {
        logger.log("set language to " + chosenLanguage);
    }

    // Set 'en' as fallback language:
    if (chosenLanguage !== "en") {
        const fallbackLanguageData = await getLanguageRetry(availableLanguages["en"]);
        registerTranslations("en", fallbackLanguageData);
    }

    await registerCustomTranslations();
}
