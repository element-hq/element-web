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
import { Room } from "matrix-js-sdk/src/models/room";

import { _t, TranslatedString } from "../../../languageHandler";
import {
    ConnectionState,
    useConnectionState,
    useConnectedMembers,
    useJitsiParticipants,
} from "../../../utils/VideoChannelUtils";

interface IProps {
    room: Room;
}

const VideoRoomSummary: FC<IProps> = ({ room }) => {
    const connectionState = useConnectionState(room);
    const videoMembers = useConnectedMembers(room, connectionState === ConnectionState.Connected);
    const jitsiParticipants = useJitsiParticipants(room);

    let indicator: TranslatedString;
    let active: boolean;
    let participantCount: number;

    switch (connectionState) {
        case ConnectionState.Disconnected:
            indicator = _t("Video");
            active = false;
            participantCount = videoMembers.size;
            break;
        case ConnectionState.Connecting:
            indicator = _t("Joining…");
            active = true;
            participantCount = videoMembers.size;
            break;
        case ConnectionState.Connected:
            indicator = _t("Joined");
            active = true;
            participantCount = jitsiParticipants.length;
            break;
    }

    return <span className="mx_VideoRoomSummary">
        <span
            className={classNames(
                "mx_VideoRoomSummary_indicator",
                { "mx_VideoRoomSummary_indicator_active": active },
            )}
        >
            { indicator }
        </span>
        { participantCount ? <>
            { " · " }
            <span
                className="mx_VideoRoomSummary_participants"
                aria-label={_t("%(count)s participants", { count: participantCount })}
            >
                { participantCount }
            </span>
        </> : null }
    </span>;
};

export default VideoRoomSummary;
