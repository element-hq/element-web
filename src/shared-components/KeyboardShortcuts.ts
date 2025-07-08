/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _td, type TranslationKey } from "./i18n";
import { Key } from "./Keyboard";

// Meta-key representing the digits [0-9] often found at the top of standard keyboard layouts
export const DIGITS = "digits";

export const ALTERNATE_KEY_NAME: Record<string, TranslationKey> = {
    [Key.PAGE_UP]: _td("keyboard|page_up"),
    [Key.PAGE_DOWN]: _td("keyboard|page_down"),
    [Key.ESCAPE]: _td("keyboard|escape"),
    [Key.ENTER]: _td("keyboard|enter"),
    [Key.SPACE]: _td("keyboard|space"),
    [Key.HOME]: _td("keyboard|home"),
    [Key.END]: _td("keyboard|end"),
    [Key.ALT]: _td("keyboard|alt"),
    [Key.CONTROL]: _td("keyboard|control"),
    [Key.SHIFT]: _td("keyboard|shift"),
    [DIGITS]: _td("keyboard|number"),
};
