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

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
    VoiceBroadcastRecordingsStore,
} from "..";
import { useTypedEventEmitter } from "../../hooks/useEventEmitter";
import { MatrixClientPeg } from "../../MatrixClientPeg";

export const useVoiceBroadcastRecording = (recording: VoiceBroadcastRecording) => {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(recording.infoEvent.getRoomId());
    const stopRecording = () => {
        recording.stop();
        VoiceBroadcastRecordingsStore.instance().clearCurrent();
    };

    const [live, setLive] = useState(recording.getState() === VoiceBroadcastInfoState.Started);
    useTypedEventEmitter(
        recording,
        VoiceBroadcastRecordingEvent.StateChanged,
        (state: VoiceBroadcastInfoState, _recording: VoiceBroadcastRecording) => {
            setLive(state === VoiceBroadcastInfoState.Started);
        },
    );

    return {
        live,
        room,
        sender: recording.infoEvent.sender,
        stopRecording,
    };
};
