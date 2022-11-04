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

import { useState } from "react";

import { useTypedEventEmitter } from "../../hooks/useEventEmitter";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import {
    VoiceBroadcastInfoState,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackEvent,
    VoiceBroadcastPlaybackState,
} from "..";

export const useVoiceBroadcastPlayback = (playback: VoiceBroadcastPlayback) => {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(playback.infoEvent.getRoomId());
    const playbackToggle = () => {
        playback.toggle();
    };

    const [playbackState, setPlaybackState] = useState(playback.getState());
    useTypedEventEmitter(
        playback,
        VoiceBroadcastPlaybackEvent.StateChanged,
        (state: VoiceBroadcastPlaybackState, _playback: VoiceBroadcastPlayback) => {
            setPlaybackState(state);
        },
    );

    const [playbackInfoState, setPlaybackInfoState] = useState(playback.getInfoState());
    useTypedEventEmitter(
        playback,
        VoiceBroadcastPlaybackEvent.InfoStateChanged,
        setPlaybackInfoState,
    );

    const [duration, setDuration] = useState(playback.durationSeconds);
    useTypedEventEmitter(
        playback,
        VoiceBroadcastPlaybackEvent.LengthChanged,
        d => setDuration(d / 1000),
    );

    return {
        duration,
        live: playbackInfoState !== VoiceBroadcastInfoState.Stopped,
        room: room,
        sender: playback.infoEvent.sender,
        toggle: playbackToggle,
        playbackState,
    };
};
