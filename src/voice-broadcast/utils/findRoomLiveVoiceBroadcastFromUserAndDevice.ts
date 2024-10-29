/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "..";

export const findRoomLiveVoiceBroadcastFromUserAndDevice = (
    room: Room,
    userId: string,
    deviceId: string,
): MatrixEvent | null => {
    const stateEvent = room.currentState.getStateEvents(VoiceBroadcastInfoEventType, userId);

    // no broadcast from that user
    if (!stateEvent) return null;

    const content = stateEvent.getContent() || {};

    // stopped broadcast
    if (content.state === VoiceBroadcastInfoState.Stopped) return null;

    return content.device_id === deviceId ? stateEvent : null;
};
