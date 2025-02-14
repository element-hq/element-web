/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { DefaultTagID, type TagID } from "../models";

export function isSelf(event: MatrixEvent): boolean {
    const selfUserId = MatrixClientPeg.safeGet().getSafeUserId();
    if (event.getType() === "m.room.member") {
        return event.getStateKey() === selfUserId;
    }
    return event.getSender() === selfUserId;
}

export function shouldPrefixMessagesIn(roomId: string, tagId?: TagID): boolean {
    if (tagId !== DefaultTagID.DM) return true;

    // We don't prefix anything in 1:1s
    const room = MatrixClientPeg.safeGet().getRoom(roomId);
    if (!room) return true;
    return room.currentState.getJoinedMemberCount() !== 2;
}

export function getSenderName(event: MatrixEvent): string {
    return event.sender?.name ?? event.getSender() ?? "";
}
