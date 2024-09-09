/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, useState } from "react";

import {
    VoiceBroadcastControl,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingConnectionError,
    VoiceBroadcastRecordingState,
} from "../..";
import { useVoiceBroadcastRecording } from "../../hooks/useVoiceBroadcastRecording";
import { VoiceBroadcastHeader } from "../atoms/VoiceBroadcastHeader";
import { Icon as StopIcon } from "../../../../res/img/compound/stop-16.svg";
import { Icon as PauseIcon } from "../../../../res/img/compound/pause-12.svg";
import { Icon as RecordIcon } from "../../../../res/img/compound/record-10px.svg";
import { Icon as MicrophoneIcon } from "../../../../res/img/compound/mic-16px.svg";
import { _t } from "../../../languageHandler";
import { useAudioDeviceSelection } from "../../../hooks/useAudioDeviceSelection";
import { DevicesContextMenu } from "../../../components/views/audio_messages/DevicesContextMenu";
import AccessibleButton from "../../../components/views/elements/AccessibleButton";

interface VoiceBroadcastRecordingPipProps {
    recording: VoiceBroadcastRecording;
}

export const VoiceBroadcastRecordingPip: React.FC<VoiceBroadcastRecordingPipProps> = ({ recording }) => {
    const pipRef = useRef<HTMLDivElement | null>(null);
    const { live, timeLeft, recordingState, room, stopRecording, toggleRecording } =
        useVoiceBroadcastRecording(recording);
    const { currentDevice, devices, setDevice } = useAudioDeviceSelection();

    const onDeviceSelect = async (device: MediaDeviceInfo): Promise<void> => {
        setShowDeviceSelect(false);

        if (currentDevice?.deviceId === device.deviceId) {
            // device unchanged
            return;
        }

        setDevice(device);

        if (
            (
                [VoiceBroadcastInfoState.Paused, VoiceBroadcastInfoState.Stopped] as VoiceBroadcastRecordingState[]
            ).includes(recordingState)
        ) {
            // Nothing to do in these cases. Resume will use the selected device.
            return;
        }

        // pause and resume to switch the input device
        await recording.pause();
        await recording.resume();
    };

    const [showDeviceSelect, setShowDeviceSelect] = useState<boolean>(false);

    const toggleControl =
        recordingState === VoiceBroadcastInfoState.Paused ? (
            <VoiceBroadcastControl
                className="mx_VoiceBroadcastControl-recording"
                onClick={toggleRecording}
                icon={<RecordIcon className="mx_Icon mx_Icon_12" />}
                label={_t("voice_broadcast|resume")}
            />
        ) : (
            <VoiceBroadcastControl
                onClick={toggleRecording}
                icon={<PauseIcon className="mx_Icon mx_Icon_12" />}
                label={_t("voice_broadcast|pause")}
            />
        );

    const controls =
        recordingState === "connection_error" ? (
            <VoiceBroadcastRecordingConnectionError />
        ) : (
            <div className="mx_VoiceBroadcastBody_controls">
                {toggleControl}
                <AccessibleButton
                    onClick={(): void => setShowDeviceSelect(true)}
                    title={_t("voip|change_input_device")}
                >
                    <MicrophoneIcon className="mx_Icon mx_Icon_16 mx_Icon_alert" />
                </AccessibleButton>
                <VoiceBroadcastControl
                    icon={<StopIcon className="mx_Icon mx_Icon_16" />}
                    label="Stop Recording"
                    onClick={stopRecording}
                />
            </div>
        );

    return (
        <div className="mx_VoiceBroadcastBody mx_VoiceBroadcastBody--pip" ref={pipRef}>
            <VoiceBroadcastHeader linkToRoom={true} live={live ? "live" : "grey"} room={room} timeLeft={timeLeft} />
            <hr className="mx_VoiceBroadcastBody_divider" />
            {controls}
            {showDeviceSelect && (
                <DevicesContextMenu
                    containerRef={pipRef}
                    currentDevice={currentDevice}
                    devices={devices}
                    onDeviceSelect={onDeviceSelect}
                />
            )}
        </div>
    );
};
