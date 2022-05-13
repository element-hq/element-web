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

import React, { FC, useState, useMemo, useRef, useEffect } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../../../languageHandler";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { useConnectedMembers } from "../../../utils/VideoChannelUtils";
import VideoChannelStore from "../../../stores/VideoChannelStore";
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

interface IDeviceButtonProps {
    kind: string;
    devices: MediaDeviceInfo[];
    setDevice: (device: MediaDeviceInfo) => void;
    deviceListLabel: string;
    active: boolean;
    disabled: boolean;
    toggle: () => void;
    activeTitle: string;
    inactiveTitle: string;
}

const DeviceButton: FC<IDeviceButtonProps> = ({
    kind, devices, setDevice, deviceListLabel, active, disabled, toggle, activeTitle, inactiveTitle,
}) => {
    // Depending on permissions, the browser might not let us know device labels,
    // in which case there's nothing helpful we can display
    const labelledDevices = useMemo(() => devices.filter(d => d.label.length), [devices]);

    const [menuDisplayed, buttonRef, openMenu, closeMenu] = useContextMenu();
    let contextMenu;
    if (menuDisplayed) {
        const selectDevice = (device: MediaDeviceInfo) => {
            setDevice(device);
            closeMenu();
        };

        const buttonRect = buttonRef.current.getBoundingClientRect();
        contextMenu = <IconizedContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu}>
            <IconizedContextMenuOptionList>
                { labelledDevices.map(d =>
                    <IconizedContextMenuOption
                        key={d.deviceId}
                        label={d.label}
                        onClick={() => selectDevice(d)}
                    />,
                ) }
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    }

    if (!devices.length) return null;

    return <div
        className={classNames({
            "mx_VideoLobby_deviceButtonWrapper": true,
            "mx_VideoLobby_deviceButtonWrapper_active": active,
        })}
    >
        <AccessibleTooltipButton
            className={`mx_VideoLobby_deviceButton mx_VideoLobby_deviceButton_${kind}`}
            title={active ? activeTitle : inactiveTitle}
            alignment={Alignment.Top}
            onClick={toggle}
            disabled={disabled}
        />
        { labelledDevices.length > 1 ? (
            <ContextMenuButton
                className="mx_VideoLobby_deviceListButton"
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

const VideoLobby: FC<{ room: Room }> = ({ room }) => {
    const store = VideoChannelStore.instance;
    const [connecting, setConnecting] = useState(false);
    const me = useMemo(() => room.getMember(room.myUserId), [room]);
    const connectedMembers = useConnectedMembers(room, false);
    const videoRef = useRef<HTMLVideoElement>();

    const devices = useAsyncMemo(async () => {
        try {
            return await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
            logger.warn(`Failed to get media device list: ${e}`);
            return [];
        }
    }, [], []);
    const audioDevices = useMemo(() => devices.filter(d => d.kind === "audioinput"), [devices]);
    const videoDevices = useMemo(() => devices.filter(d => d.kind === "videoinput"), [devices]);

    const [selectedAudioDevice, selectAudioDevice] = useState<MediaDeviceInfo>(null);
    const [selectedVideoDevice, selectVideoDevice] = useState<MediaDeviceInfo>(null);

    const audioDevice = selectedAudioDevice ?? audioDevices[0];
    const videoDevice = selectedVideoDevice ?? videoDevices[0];

    const [audioActive, setAudioActive] = useState(!store.audioMuted);
    const [videoActive, setVideoActive] = useState(!store.videoMuted);
    const toggleAudio = () => {
        store.audioMuted = audioActive;
        setAudioActive(!audioActive);
    };
    const toggleVideo = () => {
        store.videoMuted = videoActive;
        setVideoActive(!videoActive);
    };

    const videoStream = useAsyncMemo(async () => {
        if (videoDevice && videoActive) {
            try {
                return await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: videoDevice.deviceId },
                });
            } catch (e) {
                logger.error(`Failed to get stream for device ${videoDevice.deviceId}: ${e}`);
            }
        }
        return null;
    }, [videoDevice, videoActive]);

    useEffect(() => {
        if (videoStream) {
            const videoElement = videoRef.current;
            videoElement.srcObject = videoStream;
            videoElement.play();

            return () => {
                videoStream?.getTracks().forEach(track => track.stop());
                videoElement.srcObject = null;
            };
        }
    }, [videoStream]);

    const connect = async () => {
        setConnecting(true);
        try {
            await store.connect(
                room.roomId, audioActive ? audioDevice : null, videoActive ? videoDevice : null,
            );
        } catch (e) {
            logger.error(e);
            setConnecting(false);
        }
    };

    let facePile;
    if (connectedMembers.size) {
        const shownMembers = [...connectedMembers].slice(0, MAX_FACES);
        const overflow = connectedMembers.size > shownMembers.length;

        facePile = <div className="mx_VideoLobby_connectedMembers">
            { _t("%(count)s people joined", { count: connectedMembers.size }) }
            <FacePile members={shownMembers} faceSize={24} overflow={overflow} />
        </div>;
    }

    return <div className="mx_VideoLobby">
        { facePile }
        <div className="mx_VideoLobby_preview">
            <MemberAvatar key={me.userId} member={me} width={200} height={200} resizeMethod="scale" />
            <video
                ref={videoRef}
                style={{ visibility: videoActive ? null : "hidden" }}
                muted
                playsInline
                disablePictureInPicture
            />
            <div className="mx_VideoLobby_controls">
                <DeviceButton
                    kind="audio"
                    devices={audioDevices}
                    setDevice={selectAudioDevice}
                    deviceListLabel={_t("Audio devices")}
                    active={audioActive}
                    disabled={connecting}
                    toggle={toggleAudio}
                    activeTitle={_t("Mute microphone")}
                    inactiveTitle={_t("Unmute microphone")}
                />
                <DeviceButton
                    kind="video"
                    devices={videoDevices}
                    setDevice={selectVideoDevice}
                    deviceListLabel={_t("Video devices")}
                    active={videoActive}
                    disabled={connecting}
                    toggle={toggleVideo}
                    activeTitle={_t("Turn off camera")}
                    inactiveTitle={_t("Turn on camera")}
                />
            </div>
        </div>
        <AccessibleButton
            className="mx_VideoLobby_joinButton"
            kind="primary"
            disabled={connecting}
            onClick={connect}
        >
            { _t("Join") }
        </AccessibleButton>
    </div>;
};

export default VideoLobby;
