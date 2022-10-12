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

import { ISendEventResponse, MatrixClient, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";

import {
    VoiceBroadcastInfoEventContent,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
} from "..";

/**
 * Starts a new Voice Broadcast Recording.
 * Sends a voice_broadcast_info state event and waits for the event to actually appear in the room state.
 */
export const startNewVoiceBroadcastRecording = async (
    roomId: string,
    client: MatrixClient,
    recordingsStore: VoiceBroadcastRecordingsStore,
): Promise<VoiceBroadcastRecording> => {
    const room = client.getRoom(roomId);
    const { promise, resolve } = defer<VoiceBroadcastRecording>();
    let result: ISendEventResponse = null;

    const onRoomStateEvents = () => {
        if (!result) return;

        const voiceBroadcastEvent = room.currentState.getStateEvents(
            VoiceBroadcastInfoEventType,
            client.getUserId(),
        );

        if (voiceBroadcastEvent?.getId() === result.event_id) {
            room.off(RoomStateEvent.Events, onRoomStateEvents);
            const recording = new VoiceBroadcastRecording(
                voiceBroadcastEvent,
                client,
            );
            recordingsStore.setCurrent(recording);
            recording.start();
            resolve(recording);
        }
    };

    room.on(RoomStateEvent.Events, onRoomStateEvents);

    // XXX Michael W: refactor to live event
    result = await client.sendStateEvent(
        roomId,
        VoiceBroadcastInfoEventType,
        {
            device_id: client.getDeviceId(),
            state: VoiceBroadcastInfoState.Started,
            chunk_length: 300,
        } as VoiceBroadcastInfoEventContent,
        client.getUserId(),
    );

    return promise;
};
