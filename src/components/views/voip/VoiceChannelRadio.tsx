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

import React, { FC, useState, useContext } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import VoiceChannelStore, { VoiceChannelEvent } from "../../../stores/VoiceChannelStore";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

const _VoiceChannelRadio: FC<{ roomId: string }> = ({ roomId }) => {
    const cli = useContext(MatrixClientContext);
    const room = cli.getRoom(roomId);
    const store = VoiceChannelStore.instance;

    const [audioMuted, setAudioMuted] = useState<boolean>(store.audioMuted);
    const [videoMuted, setVideoMuted] = useState<boolean>(store.videoMuted);

    useEventEmitter(store, VoiceChannelEvent.MuteAudio, () => setAudioMuted(true));
    useEventEmitter(store, VoiceChannelEvent.UnmuteAudio, () => setAudioMuted(false));
    useEventEmitter(store, VoiceChannelEvent.MuteVideo, () => setVideoMuted(true));
    useEventEmitter(store, VoiceChannelEvent.UnmuteVideo, () => setVideoMuted(false));

    return <div className="mx_VoiceChannelRadio">
        <div className="mx_VoiceChannelRadio_statusBar">
            <DecoratedRoomAvatar room={room} avatarSize={36} />
            <div className="mx_VoiceChannelRadio_titleContainer">
                <div className="mx_VoiceChannelRadio_status">{ _t("Connected") }</div>
                <div className="mx_VoiceChannelRadio_name">{ room.name }</div>
            </div>
            <AccessibleTooltipButton
                className="mx_VoiceChannelRadio_disconnectButton"
                title={_t("Disconnect")}
                onClick={() => store.disconnect()}
            />
        </div>
        <div className="mx_VoiceChannelRadio_controlBar">
            <AccessibleButton
                className={classNames({
                    "mx_VoiceChannelRadio_videoButton": true,
                    "mx_VoiceChannelRadio_button_active": !videoMuted,
                })}
                onClick={() => videoMuted ? store.unmuteVideo() : store.muteVideo()}
            >
                { videoMuted ? _t("Video off") : _t("Video") }
            </AccessibleButton>
            <AccessibleButton
                className={classNames({
                    "mx_VoiceChannelRadio_audioButton": true,
                    "mx_VoiceChannelRadio_button_active": !audioMuted,
                })}
                onClick={() => audioMuted ? store.unmuteAudio() : store.muteAudio()}
            >
                { audioMuted ? _t("Mic off") : _t("Mic") }
            </AccessibleButton>
        </div>
    </div>;
};

const VoiceChannelRadio: FC<{}> = () => {
    const store = VoiceChannelStore.instance;

    const [activeChannel, setActiveChannel] = useState<string>(VoiceChannelStore.instance.roomId);
    useEventEmitter(store, VoiceChannelEvent.Connect, () =>
        setActiveChannel(VoiceChannelStore.instance.roomId),
    );
    useEventEmitter(store, VoiceChannelEvent.Disconnect, () =>
        setActiveChannel(null),
    );

    return activeChannel ? <_VoiceChannelRadio roomId={activeChannel} /> : null;
};

export default VoiceChannelRadio;
