/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
