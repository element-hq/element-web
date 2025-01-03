/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ActionPayload } from "../payloads";
import { Action } from "../actions";

export interface SwitchSpacePayload extends ActionPayload {
    action: Action.SwitchSpace;

    /**
     * The number of the space to switch to, 1-indexed, 0 is Home.
     */
    num: number;
}
