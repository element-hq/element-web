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
import { Icon as LiveIcon } from "../../../../res/img/element-icons/live.svg";
import { _t } from "../../../languageHandler";
import IconizedContextMenu, {
    IconizedContextMenuOptionList,
    IconizedContextMenuRadio,
} from "../../../components/views/context_menus/IconizedContextMenu";
import { requestMediaPermissions } from "../../../utils/media/requestMediaPermissions";
import MediaDeviceHandler from "../../../MediaDeviceHandler";
import { toLeftOrRightOf } from "../../../components/structures/ContextMenu";

interface Props {
    voiceBroadcastPreRecording: VoiceBroadcastPreRecording;
}

interface State {
    devices: MediaDeviceInfo[];
    device: MediaDeviceInfo | null;
    showDeviceSelect: boolean;
}

export const VoiceBroadcastPreRecordingPip: React.FC<Props> = ({
    voiceBroadcastPreRecording,
}) => {
    const shouldRequestPermissionsRef = useRef<boolean>(true);
    const pipRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<State>({
        devices: [],
        device: null,
        showDeviceSelect: false,
    });

    if (shouldRequestPermissionsRef.current) {
        shouldRequestPermissionsRef.current = false;
        requestMediaPermissions(false).then((stream: MediaStream | undefined) => {
            MediaDeviceHandler.getDevices().then(({ audioinput }) => {
                MediaDeviceHandler.getDefaultDevice(audioinput);
                const deviceFromSettings = MediaDeviceHandler.getAudioInput();
                const device = audioinput.find((d) => {
                    return d.deviceId === deviceFromSettings;
                }) || audioinput[0];
                setState({
                    ...state,
                    devices: audioinput,
                    device,
                });
                stream?.getTracks().forEach(t => t.stop());
            });
        });
    }

    const onDeviceOptionClick = (device: MediaDeviceInfo) => {
        setState({
            ...state,
            device,
            showDeviceSelect: false,
        });
    };

    const onMicrophoneLineClick = () => {
        setState({
            ...state,
            showDeviceSelect: true,
        });
    };

    const deviceOptions = state.devices.map((d: MediaDeviceInfo) => {
        return <IconizedContextMenuRadio
            key={d.deviceId}
            active={d.deviceId === state.device?.deviceId}
            onClick={() => onDeviceOptionClick(d)}
            label={d.label}
        />;
    });

    const devicesMenu = state.showDeviceSelect && pipRef.current
        ? <IconizedContextMenu
            mountAsChild={false}
            onFinished={() => {}}
            {...toLeftOrRightOf(pipRef.current.getBoundingClientRect(), 0)}
        >
            <IconizedContextMenuOptionList>
                { deviceOptions }
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>
        : null;

    return <div
        className="mx_VoiceBroadcastBody mx_VoiceBroadcastBody--pip"
        ref={pipRef}
    >
        <VoiceBroadcastHeader
            onCloseClick={voiceBroadcastPreRecording.cancel}
            onMicrophoneLineClick={onMicrophoneLineClick}
            room={voiceBroadcastPreRecording.room}
            microphoneLabel={state.device?.label || _t('Default Device')}
            showClose={true}
        />
        <AccessibleButton
            className="mx_VoiceBroadcastBody_blockButton"
            kind="danger"
            onClick={voiceBroadcastPreRecording.start}
        >
            <LiveIcon className="mx_Icon mx_Icon_16" />
            { _t("Go live") }
        </AccessibleButton>
        { devicesMenu }
    </div>;
};
