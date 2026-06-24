/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * This file is heavily imported and must be careful not to import anything which imports something else popular,
 * e.g. SettingsStore as this would cause import cycles.
 */

export {
    _t,
    _td,
    _tDom,
    type IVariables,
    type Tags,
    type TranslatedString,
    lookupString,
    sanitizeForTranslation,
    normalizeLanguageKey,
    getNormalizedLanguageKeys,
    getLocale as getCurrentLanguage,
} from "@element-hq/web-shared-components";

export * from "./UserFriendlyError";
