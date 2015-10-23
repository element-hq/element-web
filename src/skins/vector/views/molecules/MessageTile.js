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
var classNames = require("classnames");

var sdk = require('matrix-react-sdk')

var MessageTileController = require('matrix-react-sdk/lib/controllers/molecules/MessageTile')
var ContextualMenu = require('../../../../ContextualMenu');

module.exports = React.createClass({
    displayName: 'MessageTile',
    mixins: [MessageTileController],

    statics: {
        needsSenderProfile: function() {
            return true;
        }
    },

    render: function() {
        var UnknownMessageTile = sdk.getComponent('molecules.UnknownMessageTile');

        var tileTypes = {
            'm.text': sdk.getComponent('molecules.MTextTile'),
            'm.notice': sdk.getComponent('molecules.MNoticeTile'),
            'm.emote': sdk.getComponent('molecules.MEmoteTile'),
            'm.image': sdk.getComponent('molecules.MImageTile'),
            'm.file': sdk.getComponent('molecules.MFileTile')
        };

        var content = this.props.mxEvent.getContent();
        var msgtype = content.msgtype;
        var TileType = UnknownMessageTile;
        if (msgtype && tileTypes[msgtype]) {
            TileType = tileTypes[msgtype];
        }

        return <TileType mxEvent={this.props.mxEvent} />;
    },
});
