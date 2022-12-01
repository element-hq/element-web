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

import React, { ReactElement } from "react";
import classNames from "classnames";

import {
    VoiceBroadcastControl,
    VoiceBroadcastHeader,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackState,
} from "../..";
import { useVoiceBroadcastPlayback } from "../../hooks/useVoiceBroadcastPlayback";
import { Icon as PlayIcon } from "../../../../res/img/element-icons/play.svg";
import { Icon as PauseIcon } from "../../../../res/img/element-icons/pause.svg";
import { Icon as Back30sIcon } from "../../../../res/img/element-icons/Back30s.svg";
import { Icon as Forward30sIcon } from "../../../../res/img/element-icons/Forward30s.svg";
import { _t } from "../../../languageHandler";
import Clock from "../../../components/views/audio_messages/Clock";
import SeekBar from "../../../components/views/audio_messages/SeekBar";
import { SeekButton } from "../atoms/SeekButton";

const SEEK_TIME = 30;

interface VoiceBroadcastPlaybackBodyProps {
    pip?: boolean;
    playback: VoiceBroadcastPlayback;
}

export const VoiceBroadcastPlaybackBody: React.FC<VoiceBroadcastPlaybackBodyProps> = ({
    pip = false,
    playback,
}) => {
    const {
        duration,
        liveness,
        playbackState,
        position,
        room,
        sender,
        toggle,
    } = useVoiceBroadcastPlayback(playback);

    let controlIcon: React.FC<React.SVGProps<SVGSVGElement>>;
    let controlLabel: string;
    let className = "";

    switch (playbackState) {
        case VoiceBroadcastPlaybackState.Stopped:
            controlIcon = PlayIcon;
            className = "mx_VoiceBroadcastControl-play";
            controlLabel = _t("play voice broadcast");
            break;
        case VoiceBroadcastPlaybackState.Paused:
            controlIcon = PlayIcon;
            className = "mx_VoiceBroadcastControl-play";
            controlLabel = _t("resume voice broadcast");
            break;
        case VoiceBroadcastPlaybackState.Buffering:
        case VoiceBroadcastPlaybackState.Playing:
            controlIcon = PauseIcon;
            controlLabel = _t("pause voice broadcast");
            break;
    }

    const control = <VoiceBroadcastControl
        className={className}
        label={controlLabel}
        icon={controlIcon}
        onClick={toggle}
    />;

    let seekBackwardButton: ReactElement | null = null;
    let seekForwardButton: ReactElement | null = null;

    if (playbackState !== VoiceBroadcastPlaybackState.Stopped) {
        const onSeekBackwardButtonClick = () => {
            playback.skipTo(Math.max(0, position - SEEK_TIME));
        };

        seekBackwardButton = <SeekButton
            icon={Back30sIcon}
            label={_t("30s backward")}
            onClick={onSeekBackwardButtonClick}
        />;

        const onSeekForwardButtonClick = () => {
            playback.skipTo(Math.min(duration, position + SEEK_TIME));
        };

        seekForwardButton = <SeekButton
            icon={Forward30sIcon}
            label={_t("30s forward")}
            onClick={onSeekForwardButtonClick}
        />;
    }

    const classes = classNames({
        mx_VoiceBroadcastBody: true,
        ["mx_VoiceBroadcastBody--pip"]: pip,
    });

    return (
        <div className={classes}>
            <VoiceBroadcastHeader
                live={liveness}
                microphoneLabel={sender?.name}
                room={room}
                showBroadcast={playbackState !== VoiceBroadcastPlaybackState.Buffering}
                showBuffering={playbackState === VoiceBroadcastPlaybackState.Buffering}
            />
            <div className="mx_VoiceBroadcastBody_controls">
                { seekBackwardButton }
                { control }
                { seekForwardButton }
            </div>
            <div className="mx_VoiceBroadcastBody_timerow">
                <SeekBar playback={playback} />
                <Clock seconds={duration} />
            </div>
        </div>
    );
};
