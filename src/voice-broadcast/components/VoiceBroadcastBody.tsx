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

import React, { useState } from "react";

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastRecordingBody,
    VoiceBroadcastRecordingsStore,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
} from "..";
import { IBodyProps } from "../../components/views/messages/IBodyProps";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { useTypedEventEmitter } from "../../hooks/useEventEmitter";

export const VoiceBroadcastBody: React.FC<IBodyProps> = ({ mxEvent }) => {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(mxEvent.getRoomId());
    const recording = VoiceBroadcastRecordingsStore.instance().getByInfoEvent(mxEvent, client);
    const [recordingState, setRecordingState] = useState(recording.state);

    useTypedEventEmitter(
        recording,
        VoiceBroadcastRecordingEvent.StateChanged,
        (state: VoiceBroadcastInfoState, _recording: VoiceBroadcastRecording) => {
            setRecordingState(state);
        },
    );

    const stopVoiceBroadcast = () => {
        if (recordingState !== VoiceBroadcastInfoState.Started) return;
        recording.stop();
    };

    const senderId = mxEvent.getSender();
    const sender = mxEvent.sender;
    return <VoiceBroadcastRecordingBody
        onClick={stopVoiceBroadcast}
        live={recordingState === VoiceBroadcastInfoState.Started}
        member={sender}
        userId={senderId}
        title={`${sender?.name ?? senderId} • ${room.name}`}
    />;
};
