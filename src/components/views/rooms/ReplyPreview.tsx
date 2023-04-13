/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import ReplyTile from "./ReplyTile";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
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

    public render(): JSX.Element | null {
        if (!this.props.replyToEvent) return null;

        return (
            <div className="mx_ReplyPreview">
                <div className="mx_ReplyPreview_section">
                    <div className="mx_ReplyPreview_header">
                        <span>{_t("Replying")}</span>
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
