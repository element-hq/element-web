/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Room, RoomMember } from "matrix-js-sdk/src/matrix";

import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import {
    VoiceBroadcastLiveness,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
    VoiceBroadcastPlaybackTimes,
} from "..";

export const useVoiceBroadcastPlayback = (
    playback: VoiceBroadcastPlayback,
): {
    times: {
        duration: number;
        position: number;
        timeLeft: number;
    };
    sender: RoomMember | null;
    liveness: VoiceBroadcastLiveness;
    playbackState: VoiceBroadcastPlaybackState;
    toggle(): void;
    room: Room;
} => {
    const client = MatrixClientPeg.safeGet();
    const room = client.getRoom(playback.infoEvent.getRoomId());

    if (!room) {
        throw new Error(`Voice Broadcast room not found (event ${playback.infoEvent.getId()})`);
    }

    const sender = playback.infoEvent.sender;

    if (!sender) {
        throw new Error(`Voice Broadcast sender not found (event ${playback.infoEvent.getId()})`);
    }

    const playbackToggle = (): void => {
        playback.toggle();
    };

    const playbackState = useTypedEventEmitterState(
        playback,
        VoiceBroadcastPlaybackEvent.StateChanged,
        (state?: VoiceBroadcastPlaybackState) => {
            return state ?? playback.getState();
        },
    );

    const times = useTypedEventEmitterState(
        playback,
        VoiceBroadcastPlaybackEvent.TimesChanged,
        (t?: VoiceBroadcastPlaybackTimes) => {
            return (
                t ?? {
                    duration: playback.durationSeconds,
                    position: playback.timeSeconds,
                    timeLeft: playback.timeLeftSeconds,
                }
            );
        },
    );

    const liveness = useTypedEventEmitterState(
        playback,
        VoiceBroadcastPlaybackEvent.LivenessChanged,
        (l?: VoiceBroadcastLiveness) => {
            return l ?? playback.getLiveness();
        },
    );

    return {
        times,
        liveness: liveness,
        playbackState,
        room: room,
        sender,
        toggle: playbackToggle,
    };
};
