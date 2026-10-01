/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface UpdateSystemFontPayload extends ActionPayload {
    action: Action.UpdateSystemFont;

    /**
     * Specify whether to use the bundled emoji font or the system font
     */
    useBundledEmojiFont: boolean;

    /**
     * Specify whether to use a system font or the stylesheet font
     */
    useSystemFont: boolean;

    /**
     * The system font to use
     */
    font: string;
}
