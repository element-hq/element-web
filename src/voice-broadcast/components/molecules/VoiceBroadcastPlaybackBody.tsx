/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactElement } from "react";
import classNames from "classnames";

import {
    VoiceBroadcastError,
    VoiceBroadcastHeader,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackControl,
    VoiceBroadcastPlaybackState,
} from "../..";
import { useVoiceBroadcastPlayback } from "../../hooks/useVoiceBroadcastPlayback";
import { Icon as Back30sIcon } from "../../../../res/img/compound/back-30s-24px.svg";
import { Icon as Forward30sIcon } from "../../../../res/img/compound/forward-30s-24px.svg";
import { _t } from "../../../languageHandler";
import Clock from "../../../components/views/audio_messages/Clock";
import SeekBar from "../../../components/views/audio_messages/SeekBar";
import { SeekButton } from "../atoms/SeekButton";

const SEEK_TIME = 30;

interface VoiceBroadcastPlaybackBodyProps {
    pip?: boolean;
    playback: VoiceBroadcastPlayback;
}

export const VoiceBroadcastPlaybackBody: React.FC<VoiceBroadcastPlaybackBodyProps> = ({ pip = false, playback }) => {
    const { times, liveness, playbackState, room, sender, toggle } = useVoiceBroadcastPlayback(playback);

    let seekBackwardButton: ReactElement | null = null;
    let seekForwardButton: ReactElement | null = null;

    if (playbackState !== VoiceBroadcastPlaybackState.Stopped) {
        const onSeekBackwardButtonClick = (): void => {
            playback.skipTo(Math.max(0, times.position - SEEK_TIME));
        };

        seekBackwardButton = (
            <SeekButton
                icon={Back30sIcon}
                label={_t("voice_broadcast|30s_backward")}
                onClick={onSeekBackwardButtonClick}
            />
        );

        const onSeekForwardButtonClick = (): void => {
            playback.skipTo(Math.min(times.duration, times.position + SEEK_TIME));
        };

        seekForwardButton = (
            <SeekButton
                icon={Forward30sIcon}
                label={_t("voice_broadcast|30s_forward")}
                onClick={onSeekForwardButtonClick}
            />
        );
    }

    const classes = classNames({
        mx_VoiceBroadcastBody: true,
        ["mx_VoiceBroadcastBody--pip"]: pip,
    });

    const content =
        playbackState === VoiceBroadcastPlaybackState.Error ? (
            <VoiceBroadcastError message={playback.errorMessage} />
        ) : (
            <>
                <div className="mx_VoiceBroadcastBody_controls">
                    {seekBackwardButton}
                    <VoiceBroadcastPlaybackControl state={playbackState} onClick={toggle} />
                    {seekForwardButton}
                </div>
                <SeekBar playback={playback} />
                <div className="mx_VoiceBroadcastBody_timerow">
                    <Clock seconds={times.position} />
                    <Clock seconds={-times.timeLeft} />
                </div>
            </>
        );

    return (
        <div className={classes}>
            <VoiceBroadcastHeader
                linkToRoom={pip}
                live={liveness}
                microphoneLabel={sender?.name}
                room={room}
                showBroadcast={playbackState !== VoiceBroadcastPlaybackState.Buffering}
                showBuffering={playbackState === VoiceBroadcastPlaybackState.Buffering}
            />
            {content}
        </div>
    );
};
