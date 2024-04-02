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
import { EventType, MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";

import { mediaFromMxc } from "../../../customisations/Media";
import { _t } from "../../../languageHandler";
import { formatList } from "../../../utils/FormattingUtils";
import dis from "../../../dispatcher/dispatcher";
import ReactionsRowButtonTooltip from "./ReactionsRowButtonTooltip";
import AccessibleButton from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { REACTION_SHORTCODE_KEY } from "./ReactionsRow";

export interface IProps {
    // The event we're displaying reactions for
    mxEvent: MatrixEvent;
    // The reaction content / key / emoji
    content: string;
    // The count of votes for this key
    count: number;
    // A list of Matrix reaction events for this key
    reactionEvents: MatrixEvent[];
    // A possible Matrix event if the current user has voted for this type
    myReactionEvent?: MatrixEvent;
    // Whether to prevent quick-reactions by clicking on this reaction
    disabled?: boolean;
    // Whether to render custom image reactions
    customReactionImagesEnabled?: boolean;
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
            this.context.sendEvent(mxEvent.getRoomId()!, EventType.Reaction, {
                "m.relates_to": {
                    rel_type: RelationType.Annotation,
                    event_id: mxEvent.getId()!,
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
                    customReactionImagesEnabled={this.props.customReactionImagesEnabled}
                />
            );
        }

        const room = this.context.getRoom(mxEvent.getRoomId());
        let label: string | undefined;
        let customReactionName: string | undefined;
        if (room) {
            const senders: string[] = [];
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender()!);
                senders.push(member?.name || reactionEvent.getSender()!);
                customReactionName =
                    (this.props.customReactionImagesEnabled &&
                        REACTION_SHORTCODE_KEY.findIn(reactionEvent.getContent())) ||
                    undefined;
            }

            const reactors = formatList(senders, 6);
            if (content) {
                label = _t("timeline|reactions|label", {
                    reactors,
                    content: customReactionName || content,
                });
            } else {
                label = reactors;
            }
        }

        let reactionContent = (
            <span className="mx_ReactionsRowButton_content" aria-hidden="true">
                {content}
            </span>
        );
        if (this.props.customReactionImagesEnabled && content.startsWith("mxc://")) {
            const imageSrc = mediaFromMxc(content).srcHttp;
            if (imageSrc) {
                reactionContent = (
                    <img
                        className="mx_ReactionsRowButton_content"
                        alt={customReactionName || _t("timeline|reactions|custom_reaction_fallback_label")}
                        src={imageSrc}
                        width="16"
                        height="16"
                    />
                );
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
                {reactionContent}
                <span className="mx_ReactionsRowButton_count" aria-hidden="true">
                    {count}
                </span>
                {tooltip}
            </AccessibleButton>
        );
    }
}
