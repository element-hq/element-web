/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { DefaultTagID, type TagID } from "../../room-list-v3/skip-list/tag";
import { isEventSentByMe } from "../../../utils/stableIds";

export function isSelf(event: MatrixEvent): boolean {
    const client = MatrixClientPeg.safeGet();
    if (event.getType() === "m.room.member") {
        // State keys are stable IDs (MSC4428), which in a room with member keys are not
        // user IDs.
        const room = client.getRoom(event.getRoomId());
        return event.getStateKey() === (room?.getMyStableId() ?? client.getSafeUserId());
    }
    return isEventSentByMe(client, event);
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
