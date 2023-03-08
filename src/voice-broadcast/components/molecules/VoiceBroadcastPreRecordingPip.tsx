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
                {_t("Go live")}
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
