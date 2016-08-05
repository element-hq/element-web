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
var ContextualMenu = require('../../structures/ContextualMenu');
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
        var areNotifsMuted = false;
        var cli = MatrixClientPeg.get();
        if (!cli.isGuest()) {
            var roomPushRule = cli.getRoomPushRule("global", this.props.room.roomId);
            if (roomPushRule) {
                if (0 <= roomPushRule.actions.indexOf("dont_notify")) {
                    areNotifsMuted = true;
                }
            }
        }

        return({
            hover : false,
            badgeHover : false,
            menu: false,
            areNotifsMuted: areNotifsMuted,
        });
    },

    onAction: function(payload) {
        switch (payload.action) {
            case 'notification_change':
                // Is the notification about this room?
                if (payload.roomId === this.props.room.roomId) {
                    this.setState( { areNotifsMuted : payload.areNotifsMuted });
                }
                break;
        }
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onClick: function() {
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.room.roomId,
        });
    },

    onMouseEnter: function() {
        this.setState( { hover : true });
    },

    onMouseLeave: function() {
        this.setState( { hover : false });
    },

    badgeOnMouseEnter: function() {
        // Only allow none guests to access the context menu
        // and only change it if it needs to change
        if (!MatrixClientPeg.get().isGuest() && !this.state.badgeHover) {
            this.setState( { badgeHover : true } );
        }
    },

    badgeOnMouseLeave: function() {
        this.setState( { badgeHover : false } );
    },

    onBadgeClicked: function(e) {
        // Only allow none guests to access the context menu
        if (!MatrixClientPeg.get().isGuest()) {

            // If the badge is clicked, then no longer show tooltip
            if (this.props.collapsed) {
                this.setState({ hover: false });
            }

            var Menu = sdk.getComponent('context_menus.NotificationStateContextMenu');
            var elementRect = e.target.getBoundingClientRect();
            // The window X and Y offsets are to adjust position when zoomed in to page
            var x = elementRect.right + window.pageXOffset + 3;
            var y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset) - 53;
            var self = this;
            ContextualMenu.createMenu(Menu, {
                menuWidth: 188,
                menuHeight: 126,
                chevronOffset: 45,
                left: x,
                top: y,
                room: this.props.room,
                onFinished: function() {
                    self.setState({ menu: false });
                }
            });
            this.setState({ menu: true });
        }
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
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
            'mx_RoomTile_unreadNotify': notificationCount > 0 && !this.state.areNotifsMuted,
            'mx_RoomTile_highlight': this.props.highlight,
            'mx_RoomTile_invited': (me && me.membership == 'invite'),
            'mx_RoomTile_menu': this.state.menu,
            'mx_RoomTile_noBadges': !(this.props.highlight || (notificationCount > 0 && !this.state.areNotifsMuted))
        });

        var avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });

        var badgeClasses = classNames({
            'mx_RoomTile_badge': true,
            'mx_RoomTile_badgeButton': this.state.badgeHover || this.state.menu,
        });

        // XXX: We should never display raw room IDs, but sometimes the
        // room name js sdk gives is undefined (cannot repro this -- k)
        var name = this.props.room.name || this.props.room.roomId;
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        var badge;
        var badgeContent;

        if (this.state.badgeHover || this.state.menu) {
            badgeContent = "\u00B7\u00B7\u00B7";
        } else if (this.props.highlight || (notificationCount > 0 && !this.state.areNotifsMuted)) {
            var limitedCount = (notificationCount > 99) ? '99+' : notificationCount;
            badgeContent = notificationCount ? limitedCount : '!';
        } else {
            badgeContent = '\u200B';
        }

        badge = <div className={ badgeClasses } onClick={this.onBadgeClicked} onMouseEnter={this.badgeOnMouseEnter} onMouseLeave={this.badgeOnMouseLeave}>{ badgeContent }</div>;

        var label;
        var tooltip;
        if (!this.props.collapsed) {
            var nameClasses = classNames({
                'mx_RoomTile_name': true,
                'mx_RoomTile_invite': this.props.isInvite,
                'mx_RoomTile_badgeShown': this.props.highlight || (notificationCount > 0 && !this.state.areNotifsMuted) || this.state.badgeHover || this.state.menu,
            });

            let nameHTML = emojifyText(name);
            if (this.props.selected) {
                let nameSelected = <span dangerouslySetInnerHTML={nameHTML}></span>;

                label = <div title={ name } className={ nameClasses }>{ nameSelected }</div>;
            } else {
                label = <div title={ name } className={ nameClasses } dangerouslySetInnerHTML={nameHTML}></div>;
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
            <div className={classes} onClick={this.onClick} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className={avatarClasses}>
                    <RoomAvatar room={this.props.room} width={24} height={24} />
                </div>
                <div className="mx_RoomTile_nameContainer">
                    { label }
                    { badge }
                </div>
                { incomingCallBox }
                { tooltip }
            </div>
        ));
    }
});
