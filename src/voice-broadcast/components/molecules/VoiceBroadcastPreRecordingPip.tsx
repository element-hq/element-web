/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useRef, useState } from "react";

import { VoiceBroadcastHeader } from "../..";
import AccessibleButton from "../../../components/views/elements/AccessibleButton";
import { VoiceBroadcastPreRecording } from "../../models/VoiceBroadcastPreRecording";
import { Icon as LiveIcon } from "../../../../res/img/compound/live-16px.svg";
import { _t } from "../../../languageHandler";
import { useAudioDeviceSelection } from "../../../hooks/useAudioDeviceSelection";
import { DevicesContextMenu } from "../../../components/views/audio_messages/DevicesContextMenu";

interface Props {
    voiceBroadcastPreRecording: VoiceBroadcastPreRecording;
}

interface State {
    showDeviceSelect: boolean;
    disableStartButton: boolean;
}

export const VoiceBroadcastPreRecordingPip: React.FC<Props> = ({ voiceBroadcastPreRecording }) => {
    const pipRef = useRef<HTMLDivElement | null>(null);
    const { currentDevice, currentDeviceLabel, devices, setDevice } = useAudioDeviceSelection();
    const [state, setState] = useState<State>({
        showDeviceSelect: false,
        disableStartButton: false,
    });

    const onDeviceSelect = (device: MediaDeviceInfo): void => {
        setState((state) => ({
            ...state,
            showDeviceSelect: false,
        }));
        setDevice(device);
    };

    const onStartBroadcastClick = (): void => {
        setState((state) => ({
            ...state,
            disableStartButton: true,
        }));

        voiceBroadcastPreRecording.start();
    };

    return (
        <div className="mx_VoiceBroadcastBody mx_VoiceBroadcastBody--pip" ref={pipRef}>
            <VoiceBroadcastHeader
                linkToRoom={true}
                onCloseClick={voiceBroadcastPreRecording.cancel}
                onMicrophoneLineClick={(): void => setState({ ...state, showDeviceSelect: true })}
                room={voiceBroadcastPreRecording.room}
                microphoneLabel={currentDeviceLabel}
                showClose={true}
            />
            <AccessibleButton
                className="mx_VoiceBroadcastBody_blockButton"
                kind="danger"
                onClick={onStartBroadcastClick}
                disabled={state.disableStartButton}
            >
                <LiveIcon className="mx_Icon mx_Icon_16" />
                {_t("voice_broadcast|go_live")}
            </AccessibleButton>
            {state.showDeviceSelect && (
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
