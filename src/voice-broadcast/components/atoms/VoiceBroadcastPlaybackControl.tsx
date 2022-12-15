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

import { Icon as PlayIcon } from "../../../../res/img/element-icons/play.svg";
import { Icon as PauseIcon } from "../../../../res/img/element-icons/pause.svg";
import { _t } from "../../../languageHandler";
import { VoiceBroadcastControl, VoiceBroadcastPlaybackState } from "../..";

interface Props {
    onClick: () => void;
    state: VoiceBroadcastPlaybackState;
}

export const VoiceBroadcastPlaybackControl: React.FC<Props> = ({ onClick, state }) => {
    let controlIcon: React.FC<React.SVGProps<SVGSVGElement>>;
    let controlLabel: string;
    let className = "";

    switch (state) {
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

    return <VoiceBroadcastControl className={className} label={controlLabel} icon={controlIcon} onClick={onClick} />;
};
