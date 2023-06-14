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

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import {
    hasRoomLiveVoiceBroadcast,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPlaybackState,
    VoiceBroadcastRecordingsStore,
} from "..";

/**
 * When a live voice broadcast is in the room and
 * another voice broadcast is not currently being listened to or recorded
 * the live broadcast in the room is set as the current broadcast to listen to.
 * When there is no live broadcast in the room: clear current broadcast.
 *
 * @param {Room} room The room to check for a live voice broadcast
 * @param {MatrixClient} client
 * @param {VoiceBroadcastPlaybacksStore} voiceBroadcastPlaybacksStore
 * @param {VoiceBroadcastRecordingsStore} voiceBroadcastRecordingsStore
 */
export const doMaybeSetCurrentVoiceBroadcastPlayback = async (
    room: Room,
    client: MatrixClient,
    voiceBroadcastPlaybacksStore: VoiceBroadcastPlaybacksStore,
    voiceBroadcastRecordingsStore: VoiceBroadcastRecordingsStore,
): Promise<void> => {
    // do not disturb the current recording
    if (voiceBroadcastRecordingsStore.hasCurrent()) return;

    const currentPlayback = voiceBroadcastPlaybacksStore.getCurrent();

    if (currentPlayback && currentPlayback.getState() !== VoiceBroadcastPlaybackState.Stopped) {
        // do not disturb the current playback
        return;
    }

    const { infoEvent } = await hasRoomLiveVoiceBroadcast(client, room);

    if (infoEvent) {
        // live broadcast in the room + no recording + not listening yet: set the current broadcast
        const voiceBroadcastPlayback = voiceBroadcastPlaybacksStore.getByInfoEvent(infoEvent, client);
        voiceBroadcastPlaybacksStore.setCurrent(voiceBroadcastPlayback);
        return;
    }

    // no broadcast; not listening: clear current
    voiceBroadcastPlaybacksStore.clearCurrent();
};
