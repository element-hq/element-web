/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../models/LocalRoom";

export function isLocalRoom(roomOrID?: Room | string | null): boolean {
    if (typeof roomOrID === "string") {
        return roomOrID.startsWith(LOCAL_ROOM_ID_PREFIX);
    }
    return roomOrID instanceof LocalRoom;
}
