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

module.exports = React.createClass({
    displayName: 'IncomingCallBox',

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

        var room = this.props.incomingCall ? MatrixClientPeg.get().getRoom(this.props.incomingCall.roomId) : null;
        var caller = room ? room.name : "unknown";
        return (
            <div className="mx_IncomingCallBox" id="incomingCallBox">
                <img className="mx_IncomingCallBox_chevron" src="img/chevron-left.png" width="9" height="16" />
                <div className="mx_IncomingCallBox_title">
                    Incoming { this.props.incomingCall ? this.props.incomingCall.type : '' } call from { caller }
                </div>
                <div className="mx_IncomingCallBox_buttons">
                    <div className="mx_IncomingCallBox_buttons_cell">
                        <div className="mx_IncomingCallBox_buttons_decline" onClick={this.onRejectClick}>
                            Decline
                        </div>
                    </div>
                    <div className="mx_IncomingCallBox_buttons_cell">
                        <div className="mx_IncomingCallBox_buttons_accept" onClick={this.onAnswerClick}>
                            Accept
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

