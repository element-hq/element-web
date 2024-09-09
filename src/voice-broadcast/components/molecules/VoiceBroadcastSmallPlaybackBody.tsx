/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import {
    VoiceBroadcastHeader,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackControl,
    VoiceBroadcastPlaybackState,
} from "../..";
import AccessibleButton from "../../../components/views/elements/AccessibleButton";
import { useVoiceBroadcastPlayback } from "../../hooks/useVoiceBroadcastPlayback";
import { Icon as XIcon } from "../../../../res/img/compound/close-8px.svg";

interface VoiceBroadcastSmallPlaybackBodyProps {
    playback: VoiceBroadcastPlayback;
}

export const VoiceBroadcastSmallPlaybackBody: React.FC<VoiceBroadcastSmallPlaybackBodyProps> = ({ playback }) => {
    const { liveness, playbackState, room, sender, toggle } = useVoiceBroadcastPlayback(playback);
    return (
        <div className="mx_VoiceBroadcastBody mx_VoiceBroadcastBody--pip mx_VoiceBroadcastBody--small">
            <VoiceBroadcastHeader
                linkToRoom={true}
                live={liveness}
                liveBadgePosition="middle"
                microphoneLabel={sender?.name}
                room={room}
                showBuffering={playbackState === VoiceBroadcastPlaybackState.Buffering}
                bufferingPosition="title"
            />
            <VoiceBroadcastPlaybackControl state={playbackState} onClick={toggle} />
            <AccessibleButton onClick={() => playback.stop()}>
                <XIcon className="mx_Icon mx_Icon_8 mx_VoiceBroadcastBody__small-close" />
            </AccessibleButton>
        </div>
    );
};
