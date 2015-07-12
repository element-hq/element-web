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

var MRoomMemberTileController = require("../../../../src/controllers/molecules/MRoomMemberTile");

var ComponentBroker = require('../../../../src/ComponentBroker');
var MessageTimestamp = ComponentBroker.get('atoms/MessageTimestamp');

module.exports = React.createClass({
    displayName: 'MRoomMemberTile',
    mixins: [MRoomMemberTileController],

    getMemberEventText: function() {
        var ev = this.props.mxEvent;
        // XXX: SYJS-16
        var senderName = ev.sender ? ev.sender.name : "Someone";
        switch (ev.getContent().membership) {
            case 'invite':
                return senderName + " invited " + ev.target.name + ".";
            case 'join':
                return senderName + " joined the room.";
            case 'leave':
                return senderName + " left the room.";
        }
    },

    render: function() {
        // XXX: for now, just cheekily borrow the css from message tile...
        return (
            <div className="mx_MessageTile">
                <MessageTimestamp ts={this.props.mxEvent.getTs()} />
                <span className="mx_SenderProfile"></span>
                <span className="mx_MessageTile_content">
                    {this.getMemberEventText()}
                </span>
            </div>
        );
    },
});

