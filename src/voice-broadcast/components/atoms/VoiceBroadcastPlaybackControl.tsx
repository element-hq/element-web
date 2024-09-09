/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactElement } from "react";

import { Icon as PlayIcon } from "../../../../res/img/compound/play-16.svg";
import { Icon as PauseIcon } from "../../../../res/img/compound/pause-12.svg";
import { _t } from "../../../languageHandler";
import { VoiceBroadcastControl, VoiceBroadcastPlaybackState } from "../..";

interface Props {
    onClick: () => void;
    state: VoiceBroadcastPlaybackState;
}

export const VoiceBroadcastPlaybackControl: React.FC<Props> = ({ onClick, state }) => {
    let controlIcon: ReactElement | null = null;
    let controlLabel: string | null = null;
    let className = "";

    switch (state) {
        case VoiceBroadcastPlaybackState.Stopped:
            controlIcon = <PlayIcon className="mx_Icon mx_Icon_16" />;
            className = "mx_VoiceBroadcastControl-play";
            controlLabel = _t("voice_broadcast|play");
            break;
        case VoiceBroadcastPlaybackState.Paused:
            controlIcon = <PlayIcon className="mx_Icon mx_Icon_16" />;
            className = "mx_VoiceBroadcastControl-play";
            controlLabel = _t("voice_broadcast|resume");
            break;
        case VoiceBroadcastPlaybackState.Buffering:
        case VoiceBroadcastPlaybackState.Playing:
            controlIcon = <PauseIcon className="mx_Icon mx_Icon_12" />;
            controlLabel = _t("voice_broadcast|pause");
            break;
    }

    if (controlIcon && controlLabel) {
        return (
            <VoiceBroadcastControl className={className} label={controlLabel} icon={controlIcon} onClick={onClick} />
        );
    }

    return null;
};
