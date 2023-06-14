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
