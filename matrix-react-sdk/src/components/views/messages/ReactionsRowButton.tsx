/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import { formatCommaSeparatedList } from "../../../utils/FormattingUtils";
import dis from "../../../dispatcher/dispatcher";
import ReactionsRowButtonTooltip from "./ReactionsRowButtonTooltip";
import AccessibleButton from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The reaction content / key / emoji
    content: string;
    // The count of votes for this key
    count: number;
    // A Set of Matrix reaction events for this key
    reactionEvents: Set<MatrixEvent>;
    // A possible Matrix event if the current user has voted for this type
    myReactionEvent?: MatrixEvent;
    // Whether to prevent quick-reactions by clicking on this reaction
    disabled?: boolean;
}

interface IState {
    tooltipRendered: boolean;
    tooltipVisible: boolean;
}

export default class ReactionsRowButton extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    public state = {
        tooltipRendered: false,
        tooltipVisible: false,
    };

    public onClick = (): void => {
        const { mxEvent, myReactionEvent, content } = this.props;
        if (myReactionEvent) {
            this.context.redactEvent(mxEvent.getRoomId()!, myReactionEvent.getId()!);
        } else {
            this.context.sendEvent(mxEvent.getRoomId()!, "m.reaction", {
                "m.relates_to": {
                    rel_type: "m.annotation",
                    event_id: mxEvent.getId(),
                    key: content,
                },
            });
            dis.dispatch({ action: "message_sent" });
        }
    };

    public onMouseOver = (): void => {
        this.setState({
            // To avoid littering the DOM with a tooltip for every reaction,
            // only render it on first use.
            tooltipRendered: true,
            tooltipVisible: true,
        });
    };

    public onMouseLeave = (): void => {
        this.setState({
            tooltipVisible: false,
        });
    };

    public render(): React.ReactNode {
        const { mxEvent, content, count, reactionEvents, myReactionEvent } = this.props;

        const classes = classNames({
            mx_ReactionsRowButton: true,
            mx_ReactionsRowButton_selected: !!myReactionEvent,
        });

        let tooltip: JSX.Element | undefined;
        if (this.state.tooltipRendered) {
            tooltip = (
                <ReactionsRowButtonTooltip
                    mxEvent={this.props.mxEvent}
                    content={content}
                    reactionEvents={reactionEvents}
                    visible={this.state.tooltipVisible}
                />
            );
        }

        const room = this.context.getRoom(mxEvent.getRoomId());
        let label: string | undefined;
        if (room) {
            const senders: string[] = [];
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                senders.push(member?.name || reactionEvent.getSender()!);
            }

            const reactors = formatCommaSeparatedList(senders, 6);
            if (content) {
                label = _t("%(reactors)s reacted with %(content)s", { reactors, content });
            } else {
                label = reactors;
            }
        }

        return (
            <AccessibleButton
                className={classes}
                aria-label={label}
                onClick={this.onClick}
                disabled={this.props.disabled}
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                <span className="mx_ReactionsRowButton_content" aria-hidden="true">
                    {content}
                </span>
                <span className="mx_ReactionsRowButton_count" aria-hidden="true">
                    {count}
                </span>
                {tooltip}
            </AccessibleButton>
        );
    }
}
