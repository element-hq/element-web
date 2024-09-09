/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import {
    checkVoiceBroadcastPreConditions,
    VoiceBroadcastPlaybacksStore,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingStore,
    VoiceBroadcastRecordingsStore,
} from "..";

export const setUpVoiceBroadcastPreRecording = async (
    room: Room,
    client: MatrixClient,
    playbacksStore: VoiceBroadcastPlaybacksStore,
    recordingsStore: VoiceBroadcastRecordingsStore,
    preRecordingStore: VoiceBroadcastPreRecordingStore,
): Promise<VoiceBroadcastPreRecording | null> => {
    if (!(await checkVoiceBroadcastPreConditions(room, client, recordingsStore))) {
        return null;
    }

    const userId = client.getUserId();
    if (!userId) return null;

    const sender = room.getMember(userId);
    if (!sender) return null;

    // pause and clear current playback (if any)
    playbacksStore.getCurrent()?.pause();
    playbacksStore.clearCurrent();

    const preRecording = new VoiceBroadcastPreRecording(room, sender, client, playbacksStore, recordingsStore);
    preRecordingStore.setCurrent(preRecording);
    return preRecording;
};
