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

import React, { FC, useState, useMemo, useRef, useEffect, useCallback } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../../../languageHandler";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../MediaDeviceHandler";
import { useParticipants } from "../../../hooks/useCall";
import { CallStore } from "../../../stores/CallStore";
import { Call } from "../../../models/Call";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { aboveLeftOf, ContextMenuButton, useContextMenu } from "../../structures/ContextMenu";
import { Alignment } from "../elements/Tooltip";
import AccessibleButton from "../elements/AccessibleButton";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import FacePile from "../elements/FacePile";
import MemberAvatar from "../avatars/MemberAvatar";

interface DeviceButtonProps {
    kind: string;
    devices: MediaDeviceInfo[];
    setDevice: (device: MediaDeviceInfo) => void;
    deviceListLabel: string;
    fallbackDeviceLabel: (n: number) => string;
    muted: boolean;
    disabled: boolean;
    toggle: () => void;
    unmutedTitle: string;
    mutedTitle: string;
}

const DeviceButton: FC<DeviceButtonProps> = ({
    kind, devices, setDevice, deviceListLabel, fallbackDeviceLabel, muted, disabled, toggle, unmutedTitle, mutedTitle,
}) => {
    const [menuDisplayed, buttonRef, openMenu, closeMenu] = useContextMenu();
    let contextMenu;
    if (menuDisplayed) {
        const selectDevice = (device: MediaDeviceInfo) => {
            setDevice(device);
            closeMenu();
        };

        const buttonRect = buttonRef.current!.getBoundingClientRect();
        contextMenu = <IconizedContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu}>
            <IconizedContextMenuOptionList>
                { devices.map((d, index) =>
                    <IconizedContextMenuOption
                        key={d.deviceId}
                        label={d.label || fallbackDeviceLabel(index + 1)}
                        onClick={() => selectDevice(d)}
                    />,
                ) }
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    }

    if (!devices.length) return null;

    return <div
        className={classNames("mx_CallLobby_deviceButtonWrapper", {
            "mx_CallLobby_deviceButtonWrapper_muted": muted,
        })}
    >
        <AccessibleTooltipButton
            className={`mx_CallLobby_deviceButton mx_CallLobby_deviceButton_${kind}`}
            title={muted ? mutedTitle : unmutedTitle}
            alignment={Alignment.Top}
            onClick={toggle}
            disabled={disabled}
        />
        { devices.length > 1 ? (
            <ContextMenuButton
                className="mx_CallLobby_deviceListButton"
                inputRef={buttonRef}
                onClick={openMenu}
                isExpanded={menuDisplayed}
                label={deviceListLabel}
                disabled={disabled}
            />
        ) : null }
        { contextMenu }
    </div>;
};

const MAX_FACES = 8;

interface Props {
    room: Room;
    call: Call;
}

export const CallLobby: FC<Props> = ({ room, call }) => {
    const [connecting, setConnecting] = useState(false);
    const me = useMemo(() => room.getMember(room.myUserId)!, [room]);
    const participants = useParticipants(call);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [audioInputs, videoInputs] = useAsyncMemo(async () => {
        try {
            const devices = await MediaDeviceHandler.getDevices();
            return [devices[MediaDeviceKindEnum.AudioInput], devices[MediaDeviceKindEnum.VideoInput]];
        } catch (e) {
            logger.warn(`Failed to get media device list`, e);
            return [[], []];
        }
    }, [], [[], []]);

    const [videoInputId, setVideoInputId] = useState<string>(() => MediaDeviceHandler.getVideoInput());

    const setAudioInput = useCallback((device: MediaDeviceInfo) => {
        MediaDeviceHandler.instance.setAudioInput(device.deviceId);
    }, []);
    const setVideoInput = useCallback((device: MediaDeviceInfo) => {
        MediaDeviceHandler.instance.setVideoInput(device.deviceId);
        setVideoInputId(device.deviceId);
    }, []);

    const [audioMuted, setAudioMuted] = useState(() => MediaDeviceHandler.startWithAudioMuted);
    const [videoMuted, setVideoMuted] = useState(() => MediaDeviceHandler.startWithVideoMuted);

    const toggleAudio = useCallback(() => {
        MediaDeviceHandler.startWithAudioMuted = !audioMuted;
        setAudioMuted(!audioMuted);
    }, [audioMuted, setAudioMuted]);
    const toggleVideo = useCallback(() => {
        MediaDeviceHandler.startWithVideoMuted = !videoMuted;
        setVideoMuted(!videoMuted);
    }, [videoMuted, setVideoMuted]);

    const videoStream = useAsyncMemo(async () => {
        if (videoInputId && !videoMuted) {
            try {
                return await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: videoInputId },
                });
            } catch (e) {
                logger.error(`Failed to get stream for device ${videoInputId}`, e);
            }
        }
        return null;
    }, [videoInputId, videoMuted]);

    useEffect(() => {
        if (videoStream) {
            const videoElement = videoRef.current!;
            videoElement.srcObject = videoStream;
            videoElement.play();

            return () => {
                videoStream?.getTracks().forEach(track => track.stop());
                videoElement.srcObject = null;
            };
        }
    }, [videoStream]);

    const connect = useCallback(async () => {
        setConnecting(true);
        try {
            // Disconnect from any other active calls first, since we don't yet support holding
            await Promise.all([...CallStore.instance.activeCalls].map(call => call.disconnect()));
            await call.connect();
        } catch (e) {
            logger.error(e);
            setConnecting(false);
        }
    }, [call, setConnecting]);

    let facePile: JSX.Element | null = null;
    if (participants.size) {
        const shownMembers = [...participants].slice(0, MAX_FACES);
        const overflow = participants.size > shownMembers.length;

        facePile = <div className="mx_CallLobby_participants">
            { _t("%(count)s people joined", { count: participants.size }) }
            <FacePile members={shownMembers} faceSize={24} overflow={overflow} />
        </div>;
    }

    return <div className="mx_CallLobby">
        { facePile }
        <div className="mx_CallLobby_preview">
            <MemberAvatar key={me.userId} member={me} width={200} height={200} resizeMethod="scale" />
            <video
                ref={videoRef}
                style={{ visibility: videoMuted ? "hidden" : undefined }}
                muted
                playsInline
                disablePictureInPicture
            />
            <div className="mx_CallLobby_controls">
                <DeviceButton
                    kind="audio"
                    devices={audioInputs}
                    setDevice={setAudioInput}
                    deviceListLabel={_t("Audio devices")}
                    fallbackDeviceLabel={n => _t("Audio input %(n)s", { n })}
                    muted={audioMuted}
                    disabled={connecting}
                    toggle={toggleAudio}
                    unmutedTitle={_t("Mute microphone")}
                    mutedTitle={_t("Unmute microphone")}
                />
                <DeviceButton
                    kind="video"
                    devices={videoInputs}
                    setDevice={setVideoInput}
                    deviceListLabel={_t("Video devices")}
                    fallbackDeviceLabel={n => _t("Video input %(n)s", { n })}
                    muted={videoMuted}
                    disabled={connecting}
                    toggle={toggleVideo}
                    unmutedTitle={_t("Turn off camera")}
                    mutedTitle={_t("Turn on camera")}
                />
            </div>
        </div>
        <AccessibleButton
            className="mx_CallLobby_connectButton"
            kind="primary"
            disabled={connecting}
            onClick={connect}
        >
            { _t("Join") }
        </AccessibleButton>
    </div>;
};
