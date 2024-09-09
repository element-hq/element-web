/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ISendEventResponse, MatrixClient, Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import {
    VoiceBroadcastInfoEventContent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    getChunkLength,
    VoiceBroadcastPlaybacksStore,
} from "..";
import { checkVoiceBroadcastPreConditions } from "./checkVoiceBroadcastPreConditions";

const startBroadcast = async (
    room: Room,
    client: MatrixClient,
    recordingsStore: VoiceBroadcastRecordingsStore,
): Promise<VoiceBroadcastRecording> => {
    const { promise, resolve, reject } = defer<VoiceBroadcastRecording>();

    const userId = client.getUserId();

    if (!userId) {
        reject("unable to start voice broadcast if current user is unknown");
        return promise;
    }

    let result: ISendEventResponse | null = null;

    const onRoomStateEvents = (): void => {
        if (!result) return;

        const voiceBroadcastEvent = room.currentState.getStateEvents(VoiceBroadcastInfoEventType, userId);

        if (voiceBroadcastEvent?.getId() === result.event_id) {
            room.off(RoomStateEvent.Events, onRoomStateEvents);
            const recording = new VoiceBroadcastRecording(voiceBroadcastEvent, client);
            recordingsStore.setCurrent(recording);
            recording.start();
            resolve(recording);
        }
    };

    room.on(RoomStateEvent.Events, onRoomStateEvents);

    // XXX Michael W: refactor to live event
    result = await client.sendStateEvent(
        room.roomId,
        VoiceBroadcastInfoEventType,
        {
            device_id: client.getDeviceId(),
            state: VoiceBroadcastInfoState.Started,
            chunk_length: getChunkLength(),
        } as VoiceBroadcastInfoEventContent,
        userId,
    );

    return promise;
};

/**
 * Starts a new Voice Broadcast Recording, if
 * - the user has the permissions to do so in the room
 * - the user is not already recording a voice broadcast
 * - there is no other broadcast being recorded in the room, yet
 * Sends a voice_broadcast_info state event and waits for the event to actually appear in the room state.
 */
export const startNewVoiceBroadcastRecording = async (
    room: Room,
    client: MatrixClient,
    playbacksStore: VoiceBroadcastPlaybacksStore,
    recordingsStore: VoiceBroadcastRecordingsStore,
): Promise<VoiceBroadcastRecording | null> => {
    if (!(await checkVoiceBroadcastPreConditions(room, client, recordingsStore))) {
        return null;
    }

    // pause and clear current playback (if any)
    playbacksStore.getCurrent()?.pause();
    playbacksStore.clearCurrent();

    return startBroadcast(room, client, recordingsStore);
};
