/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {MatrixClientPeg} from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import { unicodeToShortcode } from '../../../HtmlUtils';
import { _t } from '../../../languageHandler';
import { formatCommaSeparatedList } from '../../../utils/FormattingUtils';

export default class ReactionsRowButtonTooltip extends React.PureComponent {
    static propTypes = {
        // The event we're displaying reactions for
        mxEvent: PropTypes.object.isRequired,
        // The reaction content / key / emoji
        content: PropTypes.string.isRequired,
        // A Set of Martix reaction events for this key
        reactionEvents: PropTypes.object.isRequired,
        visible: PropTypes.bool.isRequired,
    }

    render() {
        const Tooltip = sdk.getComponent('elements.Tooltip');
        const { content, reactionEvents, mxEvent, visible } = this.props;

        const room = MatrixClientPeg.get().getRoom(mxEvent.getRoomId());
        let tooltipLabel;
        if (room) {
            const senders = [];
            for (const reactionEvent of reactionEvents) {
                const member = room.getMember(reactionEvent.getSender());
                const name = member ? member.name : reactionEvent.getSender();
                senders.push(name);
            }
            const shortName = unicodeToShortcode(content);
            tooltipLabel = <div>{_t(
                "<reactors/><reactedWith>reacted with %(shortName)s</reactedWith>",
                {
                    shortName,
                },
                {
                    reactors: () => {
                        return <div className="mx_Tooltip_title">
                            {formatCommaSeparatedList(senders, 6)}
                        </div>;
                    },
                    reactedWith: (sub) => {
                        if (!shortName) {
                            return null;
                        }
                        return <div className="mx_Tooltip_sub">
                            {sub}
                        </div>;
                    },
                },
            )}</div>;
        }

        let tooltip;
        if (tooltipLabel) {
            tooltip = <Tooltip visible={visible} label={tooltipLabel} />;
        }

        return tooltip;
    }
}
