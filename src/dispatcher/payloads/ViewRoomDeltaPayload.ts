/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";

export interface ViewRoomDeltaPayload extends ActionPayload {
    action: Action.ViewRoomDelta;

    /**
     * The delta index of the room to view.
     */
    delta: number;

    /**
     * Optionally, whether or not to filter to unread (Bold/Grey/Red) rooms only. (Default: false)
     */
    unread?: boolean;
}
