/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

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
    const client = MatrixClientPeg.get();
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
