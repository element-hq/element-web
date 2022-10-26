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
    VoiceBroadcastControl,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
} from "../..";
import { useVoiceBroadcastRecording } from "../../hooks/useVoiceBroadcastRecording";
import { VoiceBroadcastHeader } from "../atoms/VoiceBroadcastHeader";
import { Icon as StopIcon } from "../../../../res/img/element-icons/Stop.svg";
import { Icon as PauseIcon } from "../../../../res/img/element-icons/pause.svg";
import { Icon as RecordIcon } from "../../../../res/img/element-icons/Record.svg";
import { _t } from "../../../languageHandler";

interface VoiceBroadcastRecordingPipProps {
    recording: VoiceBroadcastRecording;
}

export const VoiceBroadcastRecordingPip: React.FC<VoiceBroadcastRecordingPipProps> = ({ recording }) => {
    const {
        live,
        recordingState,
        room,
        sender,
        stopRecording,
        toggleRecording,
    } = useVoiceBroadcastRecording(recording);

    const toggleControl = recordingState === VoiceBroadcastInfoState.Paused
        ? <VoiceBroadcastControl
            className="mx_VoiceBroadcastControl-recording"
            onClick={toggleRecording}
            icon={RecordIcon}
            label={_t("resume voice broadcast")}
        />
        : <VoiceBroadcastControl onClick={toggleRecording} icon={PauseIcon} label={_t("pause voice broadcast")} />;

    return <div
        className="mx_VoiceBroadcastBody mx_VoiceBroadcastBody--pip"
    >
        <VoiceBroadcastHeader
            live={live}
            sender={sender}
            room={room}
        />
        <hr className="mx_VoiceBroadcastBody_divider" />
        <div className="mx_VoiceBroadcastBody_controls">
            { toggleControl }
            <VoiceBroadcastControl
                icon={StopIcon}
                label="Stop Recording"
                onClick={stopRecording}
            />
        </div>
    </div>;
};
