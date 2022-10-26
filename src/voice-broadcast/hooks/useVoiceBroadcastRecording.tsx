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
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
} from "..";
import QuestionDialog from "../../components/views/dialogs/QuestionDialog";
import { useTypedEventEmitter } from "../../hooks/useEventEmitter";
import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import Modal from "../../Modal";

const showStopBroadcastingDialog = async (): Promise<boolean> => {
    const { finished } = Modal.createDialog(
        QuestionDialog,
        {
            title: _t("Stop live broadcasting?"),
            description: (
                <p>
                    { _t("Are you sure you want to stop your live broadcast?"
                        + "This will end the broadcast and the full recording will be available in the room.") }
                </p>
            ),
            button: _t("Yes, stop broadcast"),
        },
    );
    const [confirmed] = await finished;
    return confirmed;
};

export const useVoiceBroadcastRecording = (recording: VoiceBroadcastRecording) => {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(recording.infoEvent.getRoomId());
    const stopRecording = async () => {
        const confirmed = await showStopBroadcastingDialog();

        if (confirmed) {
            await recording.stop();
        }
    };

    const [recordingState, setRecordingState] = useState(recording.getState());
    useTypedEventEmitter(
        recording,
        VoiceBroadcastRecordingEvent.StateChanged,
        (state: VoiceBroadcastInfoState, _recording: VoiceBroadcastRecording) => {
            setRecordingState(state);
        },
    );

    const live = [
        VoiceBroadcastInfoState.Started,
        VoiceBroadcastInfoState.Paused,
        VoiceBroadcastInfoState.Resumed,
    ].includes(recordingState);

    return {
        live,
        recordingState,
        room,
        sender: recording.infoEvent.sender,
        stopRecording,
        toggleRecording: recording.toggle,
    };
};
