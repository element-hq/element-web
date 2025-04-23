/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { useDmMember } from "../../components/views/avatars/WithPresenceIndicator.tsx";
import { LocalRoom } from "../../models/LocalRoom.ts";

/**
 * Determine a stable ID for generating hash colours. If the room
 * is a DM (or local room), then the other user's ID will be used.
 * @param oobData - out-of-band information about the room
 * @returns An ID string, or undefined if the room and oobData are undefined.
 */
export function useRoomIdName(room?: Room, oobData?: { roomId?: string }): string | undefined {
    const dmMember = useDmMember(room);
    if (dmMember) {
        // If the room is a DM, we use the other user's ID for the color hash
        // in order to match the room avatar with their avatar
        return dmMember.userId;
    } else if (room instanceof LocalRoom && room.targets.length === 1) {
        return room.targets[0].userId;
    } else if (room) {
        return room.roomId;
    } else {
        return oobData?.roomId;
    }
}
