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

import React, { FC } from "react";

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
            text = _t("Video");
            active = false;
            break;
        case ConnectionState.Connecting:
            text = _t("Joining…");
            active = true;
            break;
        case ConnectionState.Connected:
        case ConnectionState.Disconnecting:
            text = _t("Joined");
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
