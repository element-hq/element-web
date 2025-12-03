/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createContext, useContext } from "react";
import { type I18nApi } from "@element-hq/element-web-module-api";

export const I18nContext = createContext<I18nApi | null>(null);
I18nContext.displayName = "I18nContext";

/**
 * A hook to get the i18n API from the context. Will throw if no i18n context is found.
 * @throws If no i18n context is found
 * @returns The i18n API from the context
 */
export function useI18n(): I18nApi {
    const i18n = useContext(I18nContext);

    if (!i18n) {
        throw new Error("useI18n must be used within an I18nContext.Provider");
    }

    return i18n;
}
