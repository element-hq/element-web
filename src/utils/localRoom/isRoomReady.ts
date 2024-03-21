/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { EventType, MatrixClient } from "matrix-js-sdk/src/matrix";

import { LocalRoom } from "../../models/LocalRoom";

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
