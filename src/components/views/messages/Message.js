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
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'Message',

    statics: {
        needsSenderProfile: function() {
            return true;
        }
    },

    render: function() {
        var UnknownMessageTile = sdk.getComponent('messages.UnknownMessage');

        var tileTypes = {
            'm.text': sdk.getComponent('messages.MTextMessage'),
            'm.notice': sdk.getComponent('messages.MNoticeMessage'),
            'm.emote': sdk.getComponent('messages.MEmoteMessage'),
            'm.image': sdk.getComponent('messages.MImageMessage'),
            'm.file': sdk.getComponent('messages.MFileMessage'),
            'm.video': sdk.getComponent('messages.MVideoMessage')
        };

        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var TileType = UnknownMessageTile;
        if (msgtype && tileTypes[msgtype]) {
            TileType = tileTypes[msgtype];
        }

        return <TileType mxEvent={this.props.mxEvent} searchTerm={this.props.searchTerm} />;
    },
});
