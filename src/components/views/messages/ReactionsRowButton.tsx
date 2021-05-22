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

import { _t } from '../../../languageHandler';
import { formatCommaSeparatedList } from '../../../utils/FormattingUtils';
import dis from "../../../dispatcher/dispatcher";
import { replaceableComponent } from "../../../utils/replaceableComponent";
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
}

interface IState {
    tooltipRendered: boolean;
    tooltipVisible: boolean;
}

@replaceableComponent("views.messages.ReactionsRowButton")
export default class ReactionsRowButton extends React.PureComponent<IProps, IState> {
    static contextType = MatrixClientContext;

    state = {
        tooltipRendered: false,
        tooltipVisible: false,
    };

    onClick = () => {
        const { mxEvent, myReactionEvent, content } = this.props;
        if (myReactionEvent) {
            this.context.redactEvent(
                mxEvent.getRoomId(),
                myReactionEvent.getId(),
            );
        } else {
            this.context.sendEvent(mxEvent.getRoomId(), "m.reaction", {
                "m.relates_to": {
                    "rel_type": "m.annotation",
                    "event_id": mxEvent.getId(),
                    "key": content,
                },
            });
            dis.dispatch({action: "message_sent"});
        }
    };

    onMouseOver = () => {
        this.setState({
            // To avoid littering the DOM with a tooltip for every reaction,
            // only render it on first use.
            tooltipRendered: true,
            tooltipVisible: true,
        });
    }

    onMouseLeave = () => {
        this.setState({
            tooltipVisible: false,
        });
    }

    render() {
        const { mxEvent, content, count, reactionEvents, myReactionEvent } = this.props;

        const classes = classNames({
            mx_ReactionsRowButton: true,
            mx_ReactionsRowButton_selected: !!myReactionEvent,
        });

        let tooltip;
        if (this.state.tooltipRendered) {
            tooltip = <ReactionsRowButtonTooltip
                mxEvent={this.props.mxEvent}
                content={content}
                reactionEvents={reactionEvents}
                visible={this.state.tooltipVisible}
            />;
        }

        const room = this.context.getRoom(mxEvent.getRoomId());
        let label;
        if (room) {
            const senders = [];
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender());
                const name = member ? member.name : reactionEvent.getSender();
                senders.push(name);
            }
            label = _t(
                "<reactors/><reactedWith> reacted with %(content)s</reactedWith>",
                {
                    content,
                },
                {
                    reactors: () => {
                        return formatCommaSeparatedList(senders, 6);
                    },
                    reactedWith: (sub) => {
                        if (!content) {
                            return null;
                        }
                        return sub;
                    },
                },
            );
        }
        const isPeeking = room.getMyMembership() !== "join";
        return <AccessibleButton
            className={classes}
            aria-label={label}
            onClick={this.onClick}
            disabled={isPeeking}
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
        </AccessibleButton>;
    }
}
