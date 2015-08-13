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
var ComponentBroker = require('../../../../../src/ComponentBroker');
var MCallHangupTileController = require("../../../../../src/controllers/molecules/voip/MCallHangupTile");
var MessageTimestamp = ComponentBroker.get('atoms/MessageTimestamp');

module.exports = React.createClass({
    displayName: 'MCallHangupTile',
    mixins: [MCallHangupTileController],

    getHangupText: function(event) {
        var senderName = event.sender ? event.sender.name : "Someone";
        return senderName + " ended the call.";
    },

    render: function() {
        // XXX: for now, just cheekily borrow the css from message tile...
        return (
            <div className="mx_MessageTile mx_MessageTile_notice">
                <div className="mx_MessageTile_avatar">
                    <MemberAvatar member={this.props.mxEvent.sender} />
                </div>            
                <MessageTimestamp ts={this.props.mxEvent.getTs()} />
                <span className="mx_SenderProfile"></span>
                <span className="mx_MessageTile_content">
                    {this.getHangupText(this.props.mxEvent)}
                </span>
            </div>
        );
    },
});

