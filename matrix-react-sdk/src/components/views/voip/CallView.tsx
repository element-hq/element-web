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

import React, { FC, ReactNode, useState, useContext, useEffect, useMemo, useRef, useCallback } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { defer, IDeferred } from "matrix-js-sdk/src/utils";

import type { Room } from "matrix-js-sdk/src/models/room";
import type { ConnectionState } from "../../../models/Call";
import { Call, CallEvent, ElementCall, isConnected } from "../../../models/Call";
import {
    useCall,
    useConnectionState,
    useJoinCallButtonDisabledTooltip,
    useParticipatingMembers,
} from "../../../hooks/useCall";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import AppTile from "../elements/AppTile";
import { _t } from "../../../languageHandler";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import MediaDeviceHandler from "../../../MediaDeviceHandler";
import { CallStore } from "../../../stores/CallStore";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { aboveRightOf, ContextMenuButton, useContextMenu } from "../../structures/ContextMenu";
import { Alignment } from "../elements/Tooltip";
import { ButtonEvent } from "../elements/AccessibleButton";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import FacePile from "../elements/FacePile";
import MemberAvatar from "../avatars/MemberAvatar";

interface DeviceButtonProps {
    kind: string;
    devices: MediaDeviceInfo[];
    setDevice: (device: MediaDeviceInfo) => void;
    deviceListLabel: string;
    muted: boolean;
    disabled: boolean;
    toggle: () => void;
    unmutedTitle: string;
    mutedTitle: string;
}

const DeviceButton: FC<DeviceButtonProps> = ({
    kind,
    devices,
    setDevice,
    deviceListLabel,
    muted,
    disabled,
    toggle,
    unmutedTitle,
    mutedTitle,
}) => {
    const [showMenu, buttonRef, openMenu, closeMenu] = useContextMenu();
    const selectDevice = useCallback(
        (device: MediaDeviceInfo) => {
            setDevice(device);
            closeMenu();
        },
        [setDevice, closeMenu],
    );

    let contextMenu: JSX.Element | null = null;
    if (showMenu) {
        const buttonRect = buttonRef.current!.getBoundingClientRect();
        contextMenu = (
            <IconizedContextMenu {...aboveRightOf(buttonRect, undefined, 10)} onFinished={closeMenu}>
                <IconizedContextMenuOptionList>
                    {devices.map((d) => (
                        <IconizedContextMenuOption key={d.deviceId} label={d.label} onClick={() => selectDevice(d)} />
                    ))}
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    if (!devices.length) return null;

    return (
        <div
            className={classNames("mx_CallView_deviceButtonWrapper", {
                mx_CallView_deviceButtonWrapper_muted: muted,
            })}
        >
            <AccessibleTooltipButton
                className={`mx_CallView_deviceButton mx_CallView_deviceButton_${kind}`}
                inputRef={buttonRef}
                title={muted ? mutedTitle : unmutedTitle}
                alignment={Alignment.Top}
                onClick={toggle}
                disabled={disabled}
            />
            {devices.length > 1 ? (
                <ContextMenuButton
                    className="mx_CallView_deviceListButton"
                    onClick={openMenu}
                    isExpanded={showMenu}
                    label={deviceListLabel}
                    disabled={disabled}
                />
            ) : null}
            {contextMenu}
        </div>
    );
};

const MAX_FACES = 8;

interface LobbyProps {
    room: Room;
    connect: () => Promise<void>;
    joinCallButtonDisabledTooltip?: string;
    children?: ReactNode;
}

export const Lobby: FC<LobbyProps> = ({ room, joinCallButtonDisabledTooltip, connect, children }) => {
    const [connecting, setConnecting] = useState(false);
    const me = useMemo(() => room.getMember(room.myUserId)!, [room]);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [videoInputId, setVideoInputId] = useState<string>(() => MediaDeviceHandler.getVideoInput());

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

    const [videoStream, audioInputs, videoInputs] = useAsyncMemo(
        async (): Promise<[MediaStream | null, MediaDeviceInfo[], MediaDeviceInfo[]]> => {
            let devices = await MediaDeviceHandler.getDevices();

            // We get the preview stream before requesting devices: this is because
            // we need (in some browsers) an active media stream in order to get
            // non-blank labels for the devices.
            let stream: MediaStream | null = null;
            try {
                if (devices!.audioinput.length > 0) {
                    // Holding just an audio stream will be enough to get us all device labels, so
                    // if video is muted, don't bother requesting video.
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: !videoMuted && devices!.videoinput.length > 0 && { deviceId: videoInputId },
                    });
                } else if (devices!.videoinput.length > 0) {
                    // We have to resort to a video stream, even if video is supposed to be muted.
                    stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: videoInputId } });
                }
            } catch (e) {
                logger.error(`Failed to get stream for device ${videoInputId}`, e);
            }

            // Refresh the devices now that we hold a stream
            if (stream !== null) devices = await MediaDeviceHandler.getDevices();

            // If video is muted, we don't actually want the stream, so we can get rid of it now.
            if (videoMuted) {
                stream?.getTracks().forEach((t) => t.stop());
                stream = null;
            }

            return [stream, devices?.audioinput ?? [], devices?.videoinput ?? []];
        },
        [videoInputId, videoMuted],
        [null, [], []],
    );

    const setAudioInput = useCallback((device: MediaDeviceInfo) => {
        MediaDeviceHandler.instance.setAudioInput(device.deviceId);
    }, []);
    const setVideoInput = useCallback((device: MediaDeviceInfo) => {
        MediaDeviceHandler.instance.setVideoInput(device.deviceId);
        setVideoInputId(device.deviceId);
    }, []);

    useEffect(() => {
        if (videoStream) {
            const videoElement = videoRef.current!;
            videoElement.srcObject = videoStream;
            videoElement.play();

            return () => {
                videoStream.getTracks().forEach((track) => track.stop());
                videoElement.srcObject = null;
            };
        }
    }, [videoStream]);

    const onConnectClick = useCallback(
        async (ev: ButtonEvent): Promise<void> => {
            ev.preventDefault();
            setConnecting(true);
            try {
                await connect();
            } catch (e) {
                logger.error(e);
                setConnecting(false);
            }
        },
        [connect, setConnecting],
    );

    return (
        <div className="mx_CallView_lobby">
            {children}
            <div className="mx_CallView_preview">
                <MemberAvatar key={me.userId} member={me} width={200} height={200} resizeMethod="scale" />
                <video
                    ref={videoRef}
                    style={{ visibility: videoMuted ? "hidden" : undefined }}
                    muted
                    playsInline
                    disablePictureInPicture
                />
                <div className="mx_CallView_controls">
                    <DeviceButton
                        kind="audio"
                        devices={audioInputs}
                        setDevice={setAudioInput}
                        deviceListLabel={_t("Audio devices")}
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
                        muted={videoMuted}
                        disabled={connecting}
                        toggle={toggleVideo}
                        unmutedTitle={_t("Turn off camera")}
                        mutedTitle={_t("Turn on camera")}
                    />
                </div>
            </div>
            <AccessibleTooltipButton
                className="mx_CallView_connectButton"
                kind="primary"
                disabled={connecting || joinCallButtonDisabledTooltip !== undefined}
                onClick={onConnectClick}
                label={_t("Join")}
                tooltip={connecting ? _t("Connecting") : joinCallButtonDisabledTooltip}
                alignment={Alignment.Bottom}
            />
        </div>
    );
};

interface StartCallViewProps {
    room: Room;
    resizing: boolean;
    call: Call | null;
    setStartingCall: (value: boolean) => void;
}

const StartCallView: FC<StartCallViewProps> = ({ room, resizing, call, setStartingCall }) => {
    const cli = useContext(MatrixClientContext);

    // Since connection has to be split across two different callbacks, we
    // create a promise to communicate the results back to the caller
    const connectDeferredRef = useRef<IDeferred<void>>();
    if (connectDeferredRef.current === undefined) {
        connectDeferredRef.current = defer();
    }
    const connectDeferred = connectDeferredRef.current!;

    // Since the call might be null, we have to track connection state by hand.
    // The alternative would be to split this component in two depending on
    // whether we've received the call, so we could use the useConnectionState
    // hook, but then React would remount the lobby when the call arrives.
    const [connected, setConnected] = useState(() => call !== null && isConnected(call.connectionState));
    useEffect(() => {
        if (call !== null) {
            const onConnectionState = (state: ConnectionState): void => setConnected(isConnected(state));
            call.on(CallEvent.ConnectionState, onConnectionState);
            return () => {
                call.off(CallEvent.ConnectionState, onConnectionState);
            };
        }
    }, [call]);

    const connect = useCallback(async (): Promise<void> => {
        setStartingCall(true);
        await ElementCall.create(room);
        await connectDeferred.promise;
    }, [room, setStartingCall, connectDeferred]);

    useEffect(() => {
        (async (): Promise<void> => {
            // If the call was successfully started, connect automatically
            if (call !== null) {
                try {
                    // Disconnect from any other active calls first, since we don't yet support holding
                    await Promise.all([...CallStore.instance.activeCalls].map((call) => call.disconnect()));
                    await call.connect();
                    connectDeferred.resolve();
                } catch (e) {
                    connectDeferred.reject(e);
                }
            }
        })();
    }, [call, connectDeferred]);

    return (
        <div className="mx_CallView">
            {connected ? null : <Lobby room={room} connect={connect} />}
            {call !== null && (
                <AppTile
                    app={call.widget}
                    room={room}
                    userId={cli.credentials.userId!}
                    creatorUserId={call.widget.creatorUserId}
                    waitForIframeLoad={call.widget.waitForIframeLoad}
                    showMenubar={false}
                    pointerEvents={resizing ? "none" : undefined}
                />
            )}
        </div>
    );
};

interface JoinCallViewProps {
    room: Room;
    resizing: boolean;
    call: Call;
}

const JoinCallView: FC<JoinCallViewProps> = ({ room, resizing, call }) => {
    const cli = useContext(MatrixClientContext);
    const connected = isConnected(useConnectionState(call));
    const members = useParticipatingMembers(call);
    const joinCallButtonDisabledTooltip = useJoinCallButtonDisabledTooltip(call);

    const connect = useCallback(async (): Promise<void> => {
        // Disconnect from any other active calls first, since we don't yet support holding
        await Promise.all([...CallStore.instance.activeCalls].map((call) => call.disconnect()));
        await call.connect();
    }, [call]);

    // We'll take this opportunity to tidy up our room state
    useEffect(() => {
        call.clean();
    }, [call]);

    let lobby: JSX.Element | null = null;
    if (!connected) {
        let facePile: JSX.Element | null = null;
        if (members.length) {
            const shownMembers = members.slice(0, MAX_FACES);
            const overflow = members.length > shownMembers.length;

            facePile = (
                <div className="mx_CallView_participants">
                    {_t("%(count)s people joined", { count: members.length })}
                    <FacePile members={shownMembers} faceSize={24} overflow={overflow} />
                </div>
            );
        }

        lobby = (
            <Lobby
                room={room}
                connect={connect}
                joinCallButtonDisabledTooltip={joinCallButtonDisabledTooltip ?? undefined}
            >
                {facePile}
            </Lobby>
        );
    }

    return (
        <div className="mx_CallView">
            {lobby}
            {/* We render the widget even if we're disconnected, so it stays loaded */}
            <AppTile
                app={call.widget}
                room={room}
                userId={cli.credentials.userId!}
                creatorUserId={call.widget.creatorUserId}
                waitForIframeLoad={call.widget.waitForIframeLoad}
                showMenubar={false}
                pointerEvents={resizing ? "none" : undefined}
            />
        </div>
    );
};

interface CallViewProps {
    room: Room;
    resizing: boolean;
    /**
     * If true, the view will be blank until a call appears. Otherwise, the join
     * button will create a call if there isn't already one.
     */
    waitForCall: boolean;
}

export const CallView: FC<CallViewProps> = ({ room, resizing, waitForCall }) => {
    const call = useCall(room.roomId);
    const [startingCall, setStartingCall] = useState(false);

    if (call === null || startingCall) {
        if (waitForCall) return null;
        return <StartCallView room={room} resizing={resizing} call={call} setStartingCall={setStartingCall} />;
    } else {
        return <JoinCallView room={room} resizing={resizing} call={call} />;
    }
};
