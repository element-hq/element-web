/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type Action } from "../actions";
import { type ActionPayload } from "../payloads";

export interface AfterLeaveRoomPayload extends ActionPayload {
    action: Action.AfterLeaveRoom;
    // eslint-disable-next-line camelcase
    room_id?: Room["roomId"];
}
