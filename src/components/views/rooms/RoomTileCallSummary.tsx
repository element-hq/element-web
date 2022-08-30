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
import classNames from "classnames";

import type { Call } from "../../../models/Call";
import { _t, TranslatedString } from "../../../languageHandler";
import { useConnectionState, useParticipants } from "../../../hooks/useCall";
import { ConnectionState } from "../../../models/Call";

interface Props {
    call: Call;
}

export const RoomTileCallSummary: FC<Props> = ({ call }) => {
    const connectionState = useConnectionState(call);
    const participants = useParticipants(call);

    let text: TranslatedString;
    let active: boolean;

    switch (connectionState) {
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

    return <span className="mx_RoomTileCallSummary">
        <span
            className={classNames(
                "mx_RoomTileCallSummary_text",
                { "mx_RoomTileCallSummary_text_active": active },
            )}
        >
            { text }
        </span>
        { participants.size ? <>
            { " · " }
            <span
                className="mx_RoomTileCallSummary_participants"
                aria-label={_t("%(count)s participants", { count: participants.size })}
            >
                { participants.size }
            </span>
        </> : null }
    </span>;
};
