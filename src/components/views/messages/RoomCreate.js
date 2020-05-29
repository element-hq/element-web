/*
Copyright 2018 New Vector Ltd
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
import createReactClass from 'create-react-class';

import dis from '../../../dispatcher/dispatcher';
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';

export default createReactClass({
    displayName: 'RoomCreate',

    propTypes: {
        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,
    },

    _onLinkClicked: function(e) {
        e.preventDefault();

        const predecessor = this.props.mxEvent.getContent()['predecessor'];

        dis.dispatch({
            action: 'view_room',
            event_id: predecessor['event_id'],
            highlighted: true,
            room_id: predecessor['room_id'],
        });
    },

    render: function() {
        const predecessor = this.props.mxEvent.getContent()['predecessor'];
        if (predecessor === undefined) {
            return <div />; // We should never have been instaniated in this case
        }
        const prevRoom = MatrixClientPeg.get().getRoom(predecessor['room_id']);
        const permalinkCreator = new RoomPermalinkCreator(prevRoom, predecessor['room_id']);
        permalinkCreator.load();
        const predecessorPermalink = permalinkCreator.forEvent(predecessor['event_id']);
        return <div className="mx_CreateEvent">
            <div className="mx_CreateEvent_image" />
            <div className="mx_CreateEvent_header">
                {_t("This room is a continuation of another conversation.")}
            </div>
            <a className="mx_CreateEvent_link"
                href={predecessorPermalink}
                onClick={this._onLinkClicked}
            >
                {_t("Click here to see older messages.")}
            </a>
        </div>;
    },
});
