/*
Copyright 2015, 2016 OpenMarket Ltd
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
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';

export default createReactClass({
    displayName: 'IncomingCallBox',

    propTypes: {
        incomingCall: PropTypes.object,
    },

    onAnswerClick: function(e) {
        e.stopPropagation();
        dis.dispatch({
            action: 'answer',
            room_id: this.props.incomingCall.roomId,
        });
    },

    onRejectClick: function(e) {
        e.stopPropagation();
        dis.dispatch({
            action: 'hangup',
            room_id: this.props.incomingCall.roomId,
        });
    },

    render: function() {
        let room = null;
        if (this.props.incomingCall) {
            room = MatrixClientPeg.get().getRoom(this.props.incomingCall.roomId);
        }

        const caller = room ? room.name : _t("unknown caller");

        let incomingCallText = null;
        if (this.props.incomingCall) {
            if (this.props.incomingCall.type === "voice") {
                incomingCallText = _t("Incoming voice call from %(name)s", {name: caller});
            } else if (this.props.incomingCall.type === "video") {
                incomingCallText = _t("Incoming video call from %(name)s", {name: caller});
            } else {
                incomingCallText = _t("Incoming call from %(name)s", {name: caller});
            }
        }

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (
            <div className="mx_IncomingCallBox" id="incomingCallBox">
                <img className="mx_IncomingCallBox_chevron" src={require("../../../../res/img/chevron-left.png")} width="9" height="16" />
                <div className="mx_IncomingCallBox_title">
                    { incomingCallText }
                </div>
                <div className="mx_IncomingCallBox_buttons">
                    <div className="mx_IncomingCallBox_buttons_cell">
                        <AccessibleButton className="mx_IncomingCallBox_buttons_decline" onClick={this.onRejectClick}>
                            { _t("Decline") }
                        </AccessibleButton>
                    </div>
                    <div className="mx_IncomingCallBox_buttons_cell">
                        <AccessibleButton className="mx_IncomingCallBox_buttons_accept" onClick={this.onAnswerClick}>
                            { _t("Accept") }
                        </AccessibleButton>
                    </div>
                </div>
            </div>
        );
    },
});

