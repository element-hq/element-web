/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface UpdateFontSizeDeltaPayload extends ActionPayload {
    action: Action.UpdateFontSizeDelta;

    /**
     * The delta is added to the current font size.
     * The delta should be between {@link FontWatcher.MIN_DELTA} and {@link FontWatcher.MAX_DELTA}.
     */
    delta: number;
}
