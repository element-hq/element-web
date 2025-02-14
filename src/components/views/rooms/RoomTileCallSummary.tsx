/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC } from "react";

import type { Call } from "../../../models/Call";
import { _t } from "../../../languageHandler";
import { useConnectionState, useParticipantCount } from "../../../hooks/useCall";
import { ConnectionState } from "../../../models/Call";
import { LiveContentSummary, LiveContentType } from "./LiveContentSummary";

interface Props {
    call: Call;
}

export const RoomTileCallSummary: FC<Props> = ({ call }) => {
    let text: string;
    let active: boolean;

    switch (useConnectionState(call)) {
        case ConnectionState.Disconnected:
            text = _t("common|video");
            active = false;
            break;
        case ConnectionState.WidgetLoading:
            text = _t("common|loading");
            active = false;
            break;
        case ConnectionState.Lobby:
            text = _t("common|lobby");
            active = false;
            break;
        case ConnectionState.Connecting:
            text = _t("room|joining");
            active = true;
            break;
        case ConnectionState.Connected:
        case ConnectionState.Disconnecting:
            text = _t("common|joined");
            active = true;
            break;
    }

    return (
        <LiveContentSummary
            type={LiveContentType.Video}
            text={text}
            active={active}
            participantCount={useParticipantCount(call)}
        />
    );
};
