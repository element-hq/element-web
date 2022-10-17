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
    PlaybackControlButton,
    VoiceBroadcastHeader,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackState,
} from "../..";
import Spinner from "../../../components/views/elements/Spinner";
import { useVoiceBroadcastPlayback } from "../../hooks/useVoiceBroadcastPlayback";

interface VoiceBroadcastPlaybackBodyProps {
    playback: VoiceBroadcastPlayback;
}

export const VoiceBroadcastPlaybackBody: React.FC<VoiceBroadcastPlaybackBodyProps> = ({
    playback,
}) => {
    const {
        live,
        room,
        sender,
        toggle,
        playbackState,
    } = useVoiceBroadcastPlayback(playback);

    const control = playbackState === VoiceBroadcastPlaybackState.Buffering
        ? <Spinner />
        : <PlaybackControlButton onClick={toggle} state={playbackState} />;

    return (
        <div className="mx_VoiceBroadcastPlaybackBody">
            <VoiceBroadcastHeader
                live={live}
                sender={sender}
                room={room}
                showBroadcast={true}
            />
            <div className="mx_VoiceBroadcastPlaybackBody_controls">
                { control }
            </div>
        </div>
    );
};
