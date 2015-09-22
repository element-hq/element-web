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

var MRoomMemberTileController = require('matrix-react-sdk/lib/controllers/molecules/MRoomMemberTile')

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var sdk = require('matrix-react-sdk')
var TextForEvent = require('matrix-react-sdk/lib/TextForEvent');

module.exports = React.createClass({
    displayName: 'MRoomMemberTile',
    mixins: [MRoomMemberTileController],

    getMemberEventText: function() {
        return TextForEvent.textForEvent(this.props.mxEvent);
    },

    render: function() {
        // XXX: for now, just cheekily borrow the css from message tile...
        var timestamp = this.props.last ? <MessageTimestamp ts={this.props.mxEvent.getTs()} /> : null;
        var text = this.getMemberEventText();
        if (!text) return <div/>;
        var MessageTimestamp = sdk.getComponent('atoms.MessageTimestamp');
        var MemberAvatar = sdk.getComponent('atoms.MemberAvatar');
        return (
            <div className="mx_MessageTile mx_MessageTile_notice">
                <div className="mx_MessageTile_avatar">
                    <MemberAvatar member={this.props.mxEvent.sender} />
                </div>            
                { timestamp }
                <span className="mx_SenderProfile"></span>
                <span className="mx_MessageTile_content">
                    { text }
                </span>
            </div>
        );
    },
});

