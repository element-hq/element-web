/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface AfterForgetRoomPayload extends ActionPayload {
    action: Action.AfterForgetRoom;
    room: Room;
}
