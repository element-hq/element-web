/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Optional } from "matrix-events-sdk";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface ActiveRoomChangedPayload extends ActionPayload {
    action: Action.ActiveRoomChanged;

    oldRoomId: Optional<string>;
    newRoomId: Optional<string>;
}
