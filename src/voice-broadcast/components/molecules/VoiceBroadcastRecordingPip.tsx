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

import React from "react";

import {
    StopButton,
    VoiceBroadcastRecording,
} from "../..";
import { useVoiceBroadcastRecording } from "../../hooks/useVoiceBroadcastRecording";
import { VoiceBroadcastHeader } from "../atoms/VoiceBroadcastHeader";

interface VoiceBroadcastRecordingPipProps {
    recording: VoiceBroadcastRecording;
}

export const VoiceBroadcastRecordingPip: React.FC<VoiceBroadcastRecordingPipProps> = ({ recording }) => {
    const {
        live,
        sender,
        room,
        stopRecording,
    } = useVoiceBroadcastRecording(recording);

    return <div
        className="mx_VoiceBroadcastRecordingPip"
    >
        <VoiceBroadcastHeader
            live={live}
            sender={sender}
            room={room}
        />
        <hr className="mx_VoiceBroadcastRecordingPip_divider" />
        <div className="mx_VoiceBroadcastRecordingPip_controls">
            <StopButton onClick={stopRecording} />
        </div>
    </div>;
};
