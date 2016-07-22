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
var classNames = require('classnames');
var dis = require("../../../dispatcher");
var MatrixClientPeg = require('../../../MatrixClientPeg');
var sdk = require('../../../index');
var ContextualMenu = require('../../../ContextualMenu');
import {emojifyText} from '../../../HtmlUtils';

module.exports = React.createClass({
    displayName: 'RoomTile',

    propTypes: {
        // TODO: We should *optionally* support DND stuff and ideally be impl agnostic about it
        connectDragSource: React.PropTypes.func.isRequired,
        connectDropTarget: React.PropTypes.func.isRequired,
        isDragging: React.PropTypes.bool.isRequired,

        room: React.PropTypes.object.isRequired,
        collapsed: React.PropTypes.bool.isRequired,
        selected: React.PropTypes.bool.isRequired,
        unread: React.PropTypes.bool.isRequired,
        highlight: React.PropTypes.bool.isRequired,
        isInvite: React.PropTypes.bool.isRequired,
        roomSubList: React.PropTypes.object.isRequired,
        incomingCall: React.PropTypes.object,
    },

    getInitialState: function() {
        return({
            hover : false,
            badgeHover : false,
            menu: false,
        });
    },

    onClick: function() {
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.room.roomId
        });
    },

    onMouseEnter: function() {
        this.setState( { hover : true });
    },

    onMouseLeave: function() {
        this.setState( { hover : false });
    },

    badgeOnMouseEnter: function() {
        this.setState( { badgeHover : true } );
    },

    badgeOnMouseLeave: function() {
        this.setState( { badgeHover : false } );
    },

    onBadgeClicked: function(e) {
        var Label = sdk.getComponent('elements.Label');
        var elementRect = e.target.getBoundingClientRect();
        var x = elementRect.right;
        var y = elementRect.height + (elementRect.height / 2);
        var self = this;
        ContextualMenu.createMenu(Label, {
            left: x,
            top: y,
            onFinished: function() {
                self.setState({menu: false});
            }
        });
        this.setState({menu: true});
    },

    render: function() {
        var myUserId = MatrixClientPeg.get().credentials.userId;
        var me = this.props.room.currentState.members[myUserId];

        var notificationCount = this.props.room.getUnreadNotificationCount();
        // var highlightCount = this.props.room.getUnreadNotificationCount("highlight");

        var classes = classNames({
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.props.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_unreadNotify': notificationCount > 0,
            'mx_RoomTile_highlight': this.props.highlight,
            'mx_RoomTile_invited': (me && me.membership == 'invite'),
        });

        // XXX: We should never display raw room IDs, but sometimes the
        // room name js sdk gives is undefined (cannot repro this -- k)
        var name = this.props.room.name || this.props.room.roomId;

        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon
        var badge;
        var badgeContent;
        var badgeClasses;

        if (this.state.badgeHover) {
            badgeContent = "\u00B7\u00B7\u00B7";
        } else if (this.props.highlight || notificationCount > 0) {
            badgeContent = notificationCount ? notificationCount : '!';
        } else {
            badgeContent = '\u200B';
        }

        if (this.props.highlight || notificationCount > 0) {
            badgeClasses = "mx_RoomTile_badge";
        } else {
            badgeClasses = "mx_RoomTile_badge mx_RoomTile_badge_no_unread";
        }

        badge = <div className={ badgeClasses } onClick={this.onBadgeClicked} onMouseEnter={this.badgeOnMouseEnter} onMouseLeave={this.badgeOnMouseLeave}>{ badgeContent }</div>;

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

        var label;
        if (!this.props.collapsed) {
            var className = 'mx_RoomTile_name' + (this.props.isInvite ? ' mx_RoomTile_invite' : '');
            let nameHTML = emojifyText(name);
            if (this.props.selected) {
                name = <span dangerouslySetInnerHTML={nameHTML}></span>;
                label = <div onClick={this.onClick} className={ className }>{ name }</div>;
            } else {
                label = <div onClick={this.onClick} className={ className } dangerouslySetInnerHTML={nameHTML}></div>;
            }
        }
        else if (this.state.hover) {
            var RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            label = <RoomTooltip room={this.props.room}/>;
        }

        var incomingCallBox;
        if (this.props.incomingCall) {
            var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
            incomingCallBox = <IncomingCallBox incomingCall={ this.props.incomingCall }/>;
        }

        var RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        // These props are injected by React DnD,
        // as defined by your `collect` function above:
        var isDragging = this.props.isDragging;
        var connectDragSource = this.props.connectDragSource;
        var connectDropTarget = this.props.connectDropTarget;

        return connectDragSource(connectDropTarget(
            <div className={classes} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className="mx_RoomTile_avatar">
                    <RoomAvatar onClick={this.onClick} room={this.props.room} width={24} height={24} />
                </div>
                { label }
                { badge }
                { incomingCallBox }
            </div>
        ));
    }
});
