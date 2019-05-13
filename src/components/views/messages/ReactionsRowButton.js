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

import MatrixClientPeg from '../../../MatrixClientPeg';

export default class ReactionsRowButton extends React.PureComponent {
    static propTypes = {
        // The event we're displaying reactions for
        mxEvent: PropTypes.object.isRequired,
        content: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
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
        }
    };

    render() {
        const { content, count, myReactionEvent } = this.props;

        const classes = classNames({
            mx_ReactionsRowButton: true,
            mx_ReactionsRowButton_selected: !!myReactionEvent,
        });

        return <span className={classes}
            onClick={this.onClick}
        >
            {content} {count}
        </span>;
    }
}
