/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { Icon as LiveIcon } from "../../../../res/img/compound/live-16px.svg";
import { _t } from "../../../languageHandler";

export const VoiceBroadcastRoomSubtitle: React.FC = () => {
    return (
        <div className="mx_RoomTile_subtitle mx_RoomTile_subtitle--voice-broadcast">
            <LiveIcon className="mx_Icon mx_Icon_16" />
            {_t("voice_broadcast|live")}
        </div>
    );
};
