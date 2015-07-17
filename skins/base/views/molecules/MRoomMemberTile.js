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

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");
var ComponentBroker = require('../../../../src/ComponentBroker');
var MessageTimestamp = ComponentBroker.get('atoms/MessageTimestamp');

module.exports = React.createClass({
    displayName: 'MRoomMemberTile',
    mixins: [MRoomMemberTileController],

    getMemberEventText: function() {
        var ev = this.props.mxEvent;
        // XXX: SYJS-16
        var senderName = ev.sender ? ev.sender.name : "Someone";
        var targetName = ev.target ? ev.target.name : "Someone";
        var reason = ev.getContent().reason ? (
            " Reason: " + ev.getContent().reason
        ) : "";
        switch (ev.getContent().membership) {
            case 'invite':
                return senderName + " invited " + targetName + ".";
            case 'ban':
                return senderName + " banned " + targetName + "." + reason;
            case 'join':
                return targetName + " joined the room.";
            case 'leave':
                if (ev.getSender() === ev.getStateKey()) {
                    return targetName + " left the room.";
                }
                else if (ev.getPrevContent().membership === "ban") {
                    return senderName + " unbanned " + targetName + ".";
                }
                else if (ev.getPrevContent().membership === "join") {
                    return senderName + " kicked " + targetName + "." + reason;
                }
                else {
                    return targetName + " left the room.";
                }
        }
    },

    render: function() {
        // XXX: for now, just cheekily borrow the css from message tile...
        var timestamp = this.props.last ? <MessageTimestamp ts={this.props.mxEvent.getTs()} /> : null;

        return (
            <div className="mx_MessageTile">
                <div className="mx_MessageTile_avatar">
                    <img src={ this.props.mxEvent.target ? MatrixClientPeg.get().getAvatarUrlForMember(this.props.mxEvent.target, 40, 40, "crop") : null } width="40" height="40"/>
                </div>            
                { timestamp }
                <span className="mx_SenderProfile"></span>
                <span className="mx_MessageTile_content">
                    {this.getMemberEventText()}
                </span>
            </div>
        );
    },
});

