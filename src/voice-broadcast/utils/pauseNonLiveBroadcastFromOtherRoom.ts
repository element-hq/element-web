/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastPlaybacksStore } from "..";

export const pauseNonLiveBroadcastFromOtherRoom = (
    room: Room,
    voiceBroadcastPlaybacksStore: VoiceBroadcastPlaybacksStore,
): void => {
    const playingBroadcast = voiceBroadcastPlaybacksStore.getCurrent();

    if (
        !playingBroadcast ||
        playingBroadcast?.getLiveness() === "live" ||
        playingBroadcast?.infoEvent.getRoomId() === room.roomId
    ) {
        return;
    }

    voiceBroadcastPlaybacksStore.clearCurrent();
    playingBroadcast.pause();
};
