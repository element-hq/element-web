/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import classNames from "classnames";

import { MessagePreview } from "../../../stores/room-list/MessagePreviewStore";
import { Call } from "../../../models/Call";
import { RoomTileCallSummary } from "./RoomTileCallSummary";
import { VoiceBroadcastRoomSubtitle } from "../../../voice-broadcast";
import { Icon as ThreadIcon } from "../../../../res/img/compound/thread-16px.svg";

interface Props {
    call: Call | null;
    hasLiveVoiceBroadcast: boolean;
    messagePreview: MessagePreview | null;
    roomId: string;
    showMessagePreview: boolean;
}

const messagePreviewId = (roomId: string): string => `mx_RoomTile_messagePreview_${roomId}`;

export const RoomTileSubtitle: React.FC<Props> = ({
    call,
    hasLiveVoiceBroadcast,
    messagePreview,
    roomId,
    showMessagePreview,
}) => {
    if (call) {
        return (
            <div className="mx_RoomTile_subtitle">
                <RoomTileCallSummary call={call} />
            </div>
        );
    }

    if (hasLiveVoiceBroadcast) {
        return <VoiceBroadcastRoomSubtitle />;
    }

    if (showMessagePreview && messagePreview) {
        const className = classNames("mx_RoomTile_subtitle", {
            "mx_RoomTile_subtitle--thread-reply": messagePreview.isThreadReply,
        });

        const icon = messagePreview.isThreadReply ? <ThreadIcon className="mx_Icon mx_Icon_16" /> : null;

        return (
            <div className={className} id={messagePreviewId(roomId)} title={messagePreview.text}>
                {icon}
                <span className="mx_RoomTile_subtitle_text">{messagePreview.text}</span>
            </div>
        );
    }

    return null;
};
