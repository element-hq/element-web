/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import ReplyTile from "./ReplyTile";
import RoomContext, { type TimelineRenderingType } from "../../../contexts/RoomContext";
import AccessibleButton from "../elements/AccessibleButton";

function cancelQuoting(context: TimelineRenderingType): void {
    dis.dispatch({
        action: "reply_to_event",
        event: null,
        context,
    });
}

interface IProps {
    permalinkCreator?: RoomPermalinkCreator;
    replyToEvent?: MatrixEvent;
}

export default class ReplyPreview extends React.Component<IProps> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public render(): JSX.Element | null {
        if (!this.props.replyToEvent) return null;

        return (
            <div className="mx_ReplyPreview">
                <div className="mx_ReplyPreview_section">
                    <div className="mx_ReplyPreview_header">
                        <span>{_t("composer|replying_title")}</span>
                        <AccessibleButton
                            className="mx_ReplyPreview_header_cancel"
                            onClick={() => cancelQuoting(this.context.timelineRenderingType)}
                        />
                    </div>
                    <ReplyTile mxEvent={this.props.replyToEvent} permalinkCreator={this.props.permalinkCreator} />
                </div>
            </div>
        );
    }
}
