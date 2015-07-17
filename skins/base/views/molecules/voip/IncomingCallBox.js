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
var classNames = require('classnames');
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
        if (!this.state.incomingCallRoomId) {
            return (
                <div>
                    <audio ref="ringAudio" loop>
                        <source src="media/ring.ogg" type="audio/ogg" />
                        <source src="media/ring.mp3" type="audio/mpeg" />
                    </audio>
                </div>
            );
        }
        return (
            <div className="mx_IncomingCallBox">
                <audio ref="ringAudio" loop>
                    <source src="media/ring.ogg" type="audio/ogg" />
                    <source src="media/ring.mp3" type="audio/mpeg" />
                </audio>
                <div className="mx_IncomingCallBox_avatar">
                    <img src="img/voip.png" width="42" height="42"/>
                </div>
                <div className="mx_IncomingCallBox_title">
                    General Incoming Call
                </div>
                <div className="mx_IncomingCallBox_buttons">
                    <div className="mx_IncomingCallBox_buttons_decline"
                    onClick={this.onRejectClick}>
                        Decline
                    </div>
                    <div className="mx_IncomingCallBox_buttons_accept"
                    onClick={this.onAnswerClick}>
                        Accept
                    </div>
                </div>
            </div>
        );
    }
});
