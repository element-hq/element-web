/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

var React = require('react');
var MatrixClientPeg = require("../../../../../src/MatrixClientPeg");
var IncomingCallBoxController = require(
    "../../../../../src/controllers/molecules/voip/IncomingCallBox"
);

module.exports = React.createClass({
    displayName: 'IncomingCallBox',
    mixins: [IncomingCallBoxController],

    getRingAudio: function() {
        return this.refs.ringAudio.getDOMNode();
    },

    render: function() {
        if (!this.state.incomingCall || !this.state.incomingCall.roomId) {
            return (
                <div>
                    <audio ref="ringAudio" loop>
                        <source src="media/ring.ogg" type="audio/ogg" />
                        <source src="media/ring.mp3" type="audio/mpeg" />
                    </audio>
                </div>
            );
        }
        var caller = MatrixClientPeg.get().getRoom(this.state.incomingCall.roomId).name;
        return (
            <div className="mx_IncomingCallBox">
                <img className="mx_IncomingCallBox_chevron" src="img/chevron-left.png" width="9" height="16" />
                <audio ref="ringAudio" loop>
                    <source src="media/ring.ogg" type="audio/ogg" />
                    <source src="media/ring.mp3" type="audio/mpeg" />
                </audio>
                <div className="mx_IncomingCallBox_title">
                    Incoming { this.state.incomingCall ? this.state.incomingCall.type : '' } call from { caller }
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
