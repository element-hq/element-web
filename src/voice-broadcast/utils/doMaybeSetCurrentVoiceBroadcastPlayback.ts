/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
