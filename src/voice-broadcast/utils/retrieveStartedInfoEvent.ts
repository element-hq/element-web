/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastInfoState } from "..";

export const retrieveStartedInfoEvent = async (
    event: MatrixEvent,
    client: MatrixClient,
): Promise<MatrixEvent | null> => {
    // started event passed as argument
    if (event.getContent()?.state === VoiceBroadcastInfoState.Started) return event;

    const relatedEventId = event.getRelation()?.event_id;

    // no related event
    if (!relatedEventId) return null;

    const roomId = event.getRoomId() || "";
    const relatedEventFromRoom = client.getRoom(roomId)?.findEventById(relatedEventId);

    // event found
    if (relatedEventFromRoom) return relatedEventFromRoom;

    try {
        const relatedEventData = await client.fetchRoomEvent(roomId, relatedEventId);
        return new MatrixEvent(relatedEventData);
    } catch (e) {}

    return null;
};
