/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger } from "matrix-js-sdk/src/logger";

import { retry } from "../utils/promise";

const i18nFolder = "i18n/";

interface ICounterpartTranslation {
    [key: string]:
        | string
        | {
              [pluralisation: string]: string;
          };
}

/**
 * Fetch a language file with configurable retry behaviour
 * @param langPath the name of the language file within the i18n dir
 * @param num the number of times to retry
 */
export async function getLanguageRetry(langPath: string, num = 3): Promise<ICounterpartTranslation> {
    return retry(
        () => getLanguage(i18nFolder + langPath),
        num,
        (e) => {
            logger.log("Failed to load i18n", langPath);
            logger.error(e);
            return true; // always retry
        },
    );
}

async function getLanguage(langPath: string): Promise<ICounterpartTranslation> {
    const res = await fetch(langPath, { method: "GET" });

    if (!res.ok) {
        throw new Error(`Failed to load ${langPath}, got ${res.status}`);
    }

    return res.json();
}
