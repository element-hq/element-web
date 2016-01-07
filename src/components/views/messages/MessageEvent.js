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

'use strict';

var React = require('react');
var sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'MessageEvent',

    statics: {
        needsSenderProfile: function() {
            return true;
        }
    },

    render: function() {
        var UnknownMessageTile = sdk.getComponent('messages.UnknownBody');

        var tileTypes = {
            'm.text': sdk.getComponent('messages.TextualBody'),
            'm.notice': sdk.getComponent('messages.TextualBody'),
            'm.emote': sdk.getComponent('messages.TextualBody'),
            'm.image': sdk.getComponent('messages.MImageBody'),
            'm.file': sdk.getComponent('messages.MFileBody'),
            'm.video': sdk.getComponent('messages.MVideoBody')
        };

        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var TileType = UnknownMessageTile;
        if (msgtype && tileTypes[msgtype]) {
            TileType = tileTypes[msgtype];
        }

        return <TileType mxEvent={this.props.mxEvent} highlights={this.props.highlights} 
                    onHighlightClick={this.props.onHighlightClick} />;
    },
});
