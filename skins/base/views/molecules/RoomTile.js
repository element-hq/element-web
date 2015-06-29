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

var RoomTileController = require("../../../../src/controllers/molecules/RoomTile");

var MatrixClientPeg = require("../../../../src/MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'RoomTile',
    mixins: [RoomTileController],
    render: function() {
        var myUserId = MatrixClientPeg.get().credentials.userId;
        var classes = classNames({
            'mx_RoomTile': true,
            'selected': this.props.selected,
            'unread': this.props.unread,
            'highlight': this.props.highlight,
            'invited': this.props.room.currentState.members[myUserId].membership == 'invite'
        });
        return (
            <div className={classes} onClick={this.onClick}>
                <div className="mx_RoomTile_name">{this.props.room.name}</div>
            </div>
        );
    }
});
