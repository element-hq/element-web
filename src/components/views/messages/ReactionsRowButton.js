/*
Copyright 2019 New Vector Ltd

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

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import { formatCommaSeparatedList } from '../../../utils/FormattingUtils';
import dis from "../../../dispatcher/dispatcher";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import {unicodeToShortcode} from "../../../HtmlUtils";

export default class ReactionsRowButton extends React.PureComponent {
    static propTypes = {
        // The event we're displaying reactions for
        mxEvent: PropTypes.object.isRequired,
        // The reaction content / key / emoji
        content: PropTypes.string.isRequired,
        // The count of votes for this key
        count: PropTypes.number.isRequired,
        // A Set of Martix reaction events for this key
        reactionEvents: PropTypes.object.isRequired,
        // A possible Matrix event if the current user has voted for this type
        myReactionEvent: PropTypes.object,
    }

    onClick = (ev) => {
        const { mxEvent, myReactionEvent, content } = this.props;
        if (myReactionEvent) {
            MatrixClientPeg.get().redactEvent(
                mxEvent.getRoomId(),
                myReactionEvent.getId(),
            );
        } else {
            MatrixClientPeg.get().sendEvent(mxEvent.getRoomId(), "m.reaction", {
                "m.relates_to": {
                    "rel_type": "m.annotation",
                    "event_id": mxEvent.getId(),
                    "key": content,
                },
            });
            dis.dispatch({action: "message_sent"});
        }
    };

    render() {
        const { mxEvent, content, count, reactionEvents, myReactionEvent } = this.props;

        const classes = classNames({
            mx_ReactionsRowButton: true,
            mx_ReactionsRowButton_selected: !!myReactionEvent,
        });

        const room = MatrixClientPeg.get().getRoom(mxEvent.getRoomId());
        let label;
        let tooltip;
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

            const shortName = unicodeToShortcode(content);
            tooltip = <div>{_t(
                "<reactors/><reactedWith>reacted with %(shortName)s</reactedWith>",
                {
                    shortName,
                },
                {
                    reactors: () => {
                        return <div className="mx_ReactionsRowButtonTooltip_senders">
                            {formatCommaSeparatedList(senders, 6)}
                        </div>;
                    },
                    reactedWith: (sub) => {
                        if (!shortName) {
                            return null;
                        }
                        return <div className="mx_ReactionsRowButtonTooltip_reactedWith">
                            {sub}
                        </div>;
                    },
                },
            )}</div>;
        }

        return <AccessibleTooltipButton
            className={classes}
            onClick={this.onClick}
            title={label}
            tooltip={tooltip}
            tooltipClassName="mx_Tooltip_timeline"
        >
            <span className="mx_ReactionsRowButton_content" aria-hidden="true">
                {content}
            </span>
            <span className="mx_ReactionsRowButton_count" aria-hidden="true">
                {count}
            </span>
        </AccessibleTooltipButton>;
    }
}
