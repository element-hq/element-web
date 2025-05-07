/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import dis from "../../dispatcher/dispatcher";

/**
 * Invite to a room and prompts guests to registers
 * @param room
 */
export function inviteToRoom(room: Room): void {
    if (room.client.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return;
    }

    // open the room inviter
    dis.dispatch({
        action: "view_invite",
        roomId: room.roomId,
    });
}
