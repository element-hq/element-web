/*
Copyright 2015, 2016 OpenMarket Ltd

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
var React = require('react');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var dis = require("../../../dispatcher");
var CallHandler = require("../../../CallHandler");
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'IncomingCallBox',

    propTypes: {
        incomingCall: React.PropTypes.object,
    },

    onAnswerClick: function() {
        dis.dispatch({
            action: 'answer',
            room_id: this.props.incomingCall.roomId
        });
    },

    onRejectClick: function() {
        dis.dispatch({
            action: 'hangup',
            room_id: this.props.incomingCall.roomId
        });
    },

    render: function() {
        var room = null;
        if (this.props.incomingCall) {
            room = MatrixClientPeg.get().getRoom(this.props.incomingCall.roomId);
        }

        var caller = room ? room.name : _t("unknown caller");

        let incomingCallText = null;
        if (this.props.incomingCall) {
            if (this.props.incomingCall.type === "voice") {
                incomingCallText = _t("Incoming voice call from %(name)s", {name: caller});
            }
            else if (this.props.incomingCall.type === "video") {
                incomingCallText = _t("Incoming video call from %(name)s", {name: caller});
            }
            else {
                incomingCallText = _t("Incoming call from %(name)s", {name: caller});
            }
        }

        return (
            <div className="mx_IncomingCallBox" id="incomingCallBox">
                <img className="mx_IncomingCallBox_chevron" src="img/chevron-left.png" width="9" height="16" />
                <div className="mx_IncomingCallBox_title">
                    {incomingCallText}
                </div>
                <div className="mx_IncomingCallBox_buttons">
                    <div className="mx_IncomingCallBox_buttons_cell">
                        <div className="mx_IncomingCallBox_buttons_decline" onClick={this.onRejectClick}>
                            {_t("Decline")}
                        </div>
                    </div>
                    <div className="mx_IncomingCallBox_buttons_cell">
                        <div className="mx_IncomingCallBox_buttons_accept" onClick={this.onAnswerClick}>
                            {_t("Accept")}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

