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
    VoiceBroadcastHeader,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackState,
} from "../..";
import Spinner from "../../../components/views/elements/Spinner";
import { useVoiceBroadcastPlayback } from "../../hooks/useVoiceBroadcastPlayback";
import { Icon as PlayIcon } from "../../../../res/img/element-icons/play.svg";
import { Icon as PauseIcon } from "../../../../res/img/element-icons/pause.svg";
import { _t } from "../../../languageHandler";
import Clock from "../../../components/views/audio_messages/Clock";

interface VoiceBroadcastPlaybackBodyProps {
    playback: VoiceBroadcastPlayback;
}

export const VoiceBroadcastPlaybackBody: React.FC<VoiceBroadcastPlaybackBodyProps> = ({
    playback,
}) => {
    const {
        length,
        live,
        room,
        sender,
        toggle,
        playbackState,
    } = useVoiceBroadcastPlayback(playback);

    let control: React.ReactNode;

    if (playbackState === VoiceBroadcastPlaybackState.Buffering) {
        control = <Spinner />;
    } else {
        let controlIcon: React.FC<React.SVGProps<SVGSVGElement>>;
        let controlLabel: string;

        switch (playbackState) {
            case VoiceBroadcastPlaybackState.Stopped:
                controlIcon = PlayIcon;
                controlLabel = _t("play voice broadcast");
                break;
            case VoiceBroadcastPlaybackState.Paused:
                controlIcon = PlayIcon;
                controlLabel = _t("resume voice broadcast");
                break;
            case VoiceBroadcastPlaybackState.Playing:
                controlIcon = PauseIcon;
                controlLabel = _t("pause voice broadcast");
                break;
        }

        control = <VoiceBroadcastControl
            label={controlLabel}
            icon={controlIcon}
            onClick={toggle}
        />;
    }

    const lengthSeconds = Math.round(length / 1000);

    return (
        <div className="mx_VoiceBroadcastBody">
            <VoiceBroadcastHeader
                live={live}
                sender={sender}
                room={room}
                showBroadcast={true}
            />
            <div className="mx_VoiceBroadcastBody_controls">
                { control }
            </div>
            <div className="mx_VoiceBroadcastBody_timerow">
                <Clock seconds={lengthSeconds} />
            </div>
        </div>
    );
};
