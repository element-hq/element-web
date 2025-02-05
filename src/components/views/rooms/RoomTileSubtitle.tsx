/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type MessagePreview } from "../../../stores/room-list/MessagePreviewStore";
import { type Call } from "../../../models/Call";
import { RoomTileCallSummary } from "./RoomTileCallSummary";

interface Props {
    call: Call | null;
    messagePreview: MessagePreview | null;
    roomId: string;
    showMessagePreview: boolean;
}

const messagePreviewId = (roomId: string): string => `mx_RoomTile_messagePreview_${roomId}`;

export const RoomTileSubtitle: React.FC<Props> = ({ call, messagePreview, roomId, showMessagePreview }) => {
    if (call) {
        return (
            <div className="mx_RoomTile_subtitle">
                <RoomTileCallSummary call={call} />
            </div>
        );
    }

    if (showMessagePreview && messagePreview) {
        const className = classNames("mx_RoomTile_subtitle", {
            "mx_RoomTile_subtitle--thread-reply": messagePreview.isThreadReply,
        });

        const icon = messagePreview.isThreadReply ? <ThreadsIcon className="mx_Icon mx_Icon_12" /> : null;

        return (
            <div className={className} id={messagePreviewId(roomId)} title={messagePreview.text}>
                {icon}
                <span className="mx_RoomTile_subtitle_text">{messagePreview.text}</span>
            </div>
        );
    }

    return null;
};
