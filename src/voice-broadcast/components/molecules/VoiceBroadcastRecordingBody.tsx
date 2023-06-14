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
    useVoiceBroadcastRecording,
    VoiceBroadcastHeader,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingConnectionError,
} from "../..";

interface VoiceBroadcastRecordingBodyProps {
    recording: VoiceBroadcastRecording;
}

export const VoiceBroadcastRecordingBody: React.FC<VoiceBroadcastRecordingBodyProps> = ({ recording }) => {
    const { live, room, sender, recordingState } = useVoiceBroadcastRecording(recording);

    return (
        <div className="mx_VoiceBroadcastBody">
            <VoiceBroadcastHeader live={live ? "live" : "grey"} microphoneLabel={sender?.name} room={room} />
            {recordingState === "connection_error" && <VoiceBroadcastRecordingConnectionError />}
        </div>
    );
};
