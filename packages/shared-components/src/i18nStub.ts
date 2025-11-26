/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type Translations from "./i18n/strings/en_EN.json";
import { type TranslationKey as TranslationKeyType } from "matrix-web-i18n";
import { translateFn, humanizeTimeFn } from "matrix-web-i18n";
type TranslationKey = TranslationKeyType<typeof Translations>;

export const _t: translateFn<TranslationKey> = () => "";
export const humanizeTime: humanizeTimeFn = () => "";
