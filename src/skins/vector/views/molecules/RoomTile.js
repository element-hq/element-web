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

var RoomTileController = require('matrix-react-sdk/lib/controllers/molecules/RoomTile')

var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

var sdk = require('matrix-react-sdk')

module.exports = React.createClass({
    displayName: 'RoomTile',
    mixins: [RoomTileController],

    getInitialState: function() {
        return( { hover : false });
    },

    onMouseEnter: function() {
        this.setState( { hover : true });
    },

    onMouseLeave: function() {
        this.setState( { hover : false });
    },

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
            badge = <div className="mx_RoomTile_badge"/>;
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

        var nameElement;
        if (!this.props.collapsed) {
            nameElement = <div className="mx_RoomTile_name">{name}</div>;
        }
        else if (this.state.hover) {
            nameElement = <div className="mx_RoomTile_tooltip">
                            <img className="mx_RoomTile_chevron" src="img/chevron-left.png" width="9" height="16"/>
                            { name }
                          </div>;
        }

        var RoomAvatar = sdk.getComponent('atoms.RoomAvatar');
        return (
            <div className={classes} onClick={this.onClick} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className="mx_RoomTile_avatar">
                    <RoomAvatar room={this.props.room} />
                    { badge }
                </div>
                { nameElement }
            </div>
        );
    }
});
