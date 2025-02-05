/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { type LocalRoom } from "../../models/LocalRoom";

/**
 * Tests whether a room created based on a local room is ready.
 */
export function isRoomReady(client: MatrixClient, localRoom: LocalRoom): boolean {
    // not ready if no actual room id exists
    if (!localRoom.actualRoomId) return false;

    const room = client.getRoom(localRoom.actualRoomId);
    // not ready if the room does not exist
    if (!room) return false;

    // not ready if not all members joined/invited
    if (room.getInvitedAndJoinedMemberCount() !== 1 + localRoom.targets?.length) return false;

    const roomHistoryVisibilityEvents = room.currentState.getStateEvents(EventType.RoomHistoryVisibility);
    // not ready if the room history has not been configured
    if (roomHistoryVisibilityEvents.length === 0) return false;

    const roomEncryptionEvents = room.currentState.getStateEvents(EventType.RoomEncryption);
    // not ready if encryption has not been configured (applies only to encrypted rooms)
    if (localRoom.encrypted === true && roomEncryptionEvents.length === 0) return false;

    return true;
}
