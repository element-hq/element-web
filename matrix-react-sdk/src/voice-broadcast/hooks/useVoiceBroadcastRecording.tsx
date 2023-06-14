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
import React from "react";

import {
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingEvent,
    VoiceBroadcastRecordingState,
} from "..";
import QuestionDialog from "../../components/views/dialogs/QuestionDialog";
import { useTypedEventEmitterState } from "../../hooks/useEventEmitter";
import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import Modal from "../../Modal";

const showStopBroadcastingDialog = async (): Promise<boolean> => {
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("Stop live broadcasting?"),
        description: (
            <p>
                {_t(
                    "Are you sure you want to stop your live broadcast? " +
                        "This will end the broadcast and the full recording will be available in the room.",
                )}
            </p>
        ),
        button: _t("Yes, stop broadcast"),
    });
    const [confirmed] = await finished;
    return !!confirmed;
};

export const useVoiceBroadcastRecording = (
    recording: VoiceBroadcastRecording,
): {
    live: boolean;
    timeLeft: number;
    recordingState: VoiceBroadcastRecordingState;
    room: Room;
    sender: RoomMember | null;
    stopRecording(): void;
    toggleRecording(): void;
} => {
    const client = MatrixClientPeg.get();
    const roomId = recording.infoEvent.getRoomId();
    const room = client.getRoom(roomId);

    if (!room) {
        throw new Error("Unable to find voice broadcast room with Id: " + roomId);
    }

    const sender = recording.infoEvent.sender;

    if (!sender) {
        throw new Error(`Voice Broadcast sender not found (event ${recording.infoEvent.getId()})`);
    }

    const stopRecording = async (): Promise<void> => {
        const confirmed = await showStopBroadcastingDialog();

        if (confirmed) {
            await recording.stop();
        }
    };

    const recordingState = useTypedEventEmitterState(
        recording,
        VoiceBroadcastRecordingEvent.StateChanged,
        (state?: VoiceBroadcastRecordingState) => {
            return state ?? recording.getState();
        },
    );

    const timeLeft = useTypedEventEmitterState(
        recording,
        VoiceBroadcastRecordingEvent.TimeLeftChanged,
        (t?: number) => {
            return t ?? recording.getTimeLeft();
        },
    );

    const live = (
        [VoiceBroadcastInfoState.Started, VoiceBroadcastInfoState.Resumed] as VoiceBroadcastRecordingState[]
    ).includes(recordingState);

    return {
        live,
        timeLeft,
        recordingState,
        room,
        sender,
        stopRecording,
        toggleRecording: recording.toggle,
    };
};
