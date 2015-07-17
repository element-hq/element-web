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
            'mx_RoomTile_selected': this.props.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_highlight': this.props.highlight,
            'mx_RoomTile_invited': this.props.room.currentState.members[myUserId].membership == 'invite'
        });
        var name = this.props.room.name.replace(":", ":\u200b");
        var badge;
        if (this.props.highlight) {
            badge = <img src="/img/badge.png" width="15" height="15" alt=""/>;
        }
        /*
        if (this.props.highlight) {
            badge = <div className="mx_RoomTile_badge">!</div>;
        }
        else if (this.props.unread) {
            badge = <div className="mx_RoomTile_badge">1</div>;
        }
        var nameCell;
        if (badge) {
            nameCell = <div className="mx_RoomTile_nameBadge"><div className="mx_RoomTile_name">{name}</div><div className="mx_RoomTile_badgeCell">{badge}</div></div>;
        }
        else {
            nameCell = <div className="mx_RoomTile_name">{name}</div>;
        }
        */
        return (
            <div className={classes} onClick={this.onClick}>
                <div className="mx_RoomTile_avatar"><img src={ MatrixClientPeg.get().getAvatarUrlForRoom(this.props.room, 40, 40, "crop") } width="40" height="40" alt=""/>{ badge }</div>
                <div className="mx_RoomTile_name">{name}</div>
            </div>
        );
    }
});
