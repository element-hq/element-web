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
var ReactDOM = require("react-dom");
var classNames = require('classnames');
var dis = require("../../../dispatcher");
var MatrixClientPeg = require('../../../MatrixClientPeg');
import DMRoomMap from '../../../utils/DMRoomMap';
var sdk = require('../../../index');
var ContextualMenu = require('../../structures/ContextualMenu');
var RoomNotifs = require('../../../RoomNotifs');
var FormattingUtils = require('../../../utils/FormattingUtils');

module.exports = React.createClass({
    displayName: 'RoomTile',

    propTypes: {
        connectDragSource: React.PropTypes.func,
        connectDropTarget: React.PropTypes.func,
        isDragging: React.PropTypes.bool,

        room: React.PropTypes.object.isRequired,
        collapsed: React.PropTypes.bool.isRequired,
        selected: React.PropTypes.bool.isRequired,
        unread: React.PropTypes.bool.isRequired,
        highlight: React.PropTypes.bool.isRequired,
        isInvite: React.PropTypes.bool.isRequired,
        incomingCall: React.PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            isDragging: false,
        };
    },

    getInitialState: function() {
        return({
            hover : false,
            badgeHover : false,
            notificationTagMenu: false,
            roomTagMenu: false,
            notifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
        });
    },

    _shouldShowNotifBadge: function() {
        const showBadgeInStates = [RoomNotifs.ALL_MESSAGES, RoomNotifs.ALL_MESSAGES_LOUD];
        return showBadgeInStates.indexOf(this.state.notifState) > -1;
    },

    _shouldShowMentionBadge: function() {
        return this.state.notifState != RoomNotifs.MUTE;
    },

    _isDirectMessageRoom: function(roomId) {
        var dmRooms = DMRoomMap.shared().getUserIdForRoomId(roomId);
        if (dmRooms) {
            return true;
        } else {
            return false;
        }
    },

    onAccountData: function(accountDataEvent) {
        if (accountDataEvent.getType() == 'm.push_rules') {
            this.setState({
                notifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            });
        }
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("accountData", this.onAccountData);
    },

    componentWillUnmount: function() {
        var cli = MatrixClientPeg.get();
        if (cli) {
            MatrixClientPeg.get().removeListener("accountData", this.onAccountData);
        }
    },

    onClick: function() {
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.room.roomId,
        });
    },

    onMouseEnter: function() {
        this.setState( { hover : true });
        this.badgeOnMouseEnter();
    },

    onMouseLeave: function() {
        this.setState( { hover : false });
        this.badgeOnMouseLeave();
    },

    badgeOnMouseEnter: function() {
        // Only allow non-guests to access the context menu
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

            var NotificationStateMenu = sdk.getComponent('context_menus.NotificationStateContextMenu');
            var elementRect = e.target.getBoundingClientRect();
            // The window X and Y offsets are to adjust position when zoomed in to page
            var x = elementRect.right + window.pageXOffset + 3;
            var y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset) - 53;
            var self = this;
            ContextualMenu.createMenu(NotificationStateMenu, {
                menuWidth: 188,
                menuHeight: 126,
                chevronOffset: 45,
                left: x,
                top: y,
                room: this.props.room,
                onFinished: function() {
                    self.setState({ notificationTagMenu: false });
                    self.props.refreshSubList();
                }
            });
            this.setState({ notificationTagMenu: true });
        }
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
    },

    onAvatarClicked: function(e) {
        // Only allow none guests to access the context menu
        if (!MatrixClientPeg.get().isGuest() && !this.props.collapsed) {

            // If the badge is clicked, then no longer show tooltip
            if (this.props.collapsed) {
                this.setState({ hover: false });
            }

            var RoomTagMenu = sdk.getComponent('context_menus.RoomTagContextMenu');
            var elementRect = e.target.getBoundingClientRect();
            // The window X and Y offsets are to adjust position when zoomed in to page
            var x = elementRect.right + window.pageXOffset + 3;
            var y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset) - 19;
            var self = this;
            ContextualMenu.createMenu(RoomTagMenu, {
                chevronOffset: 10,
                menuColour: "#FFFFFF",
                left: x,
                top: y,
                room: this.props.room,
                onFinished: function() {
                    self.setState({ roomTagMenu: false });
                }
            });
            this.setState({ roomTagMenu: true });
            // Prevent the RoomTile onClick event firing as well
            e.stopPropagation();
        }
    },

    render: function() {
        var myUserId = MatrixClientPeg.get().credentials.userId;
        var me = this.props.room.currentState.members[myUserId];

        var notificationCount = this.props.room.getUnreadNotificationCount();
        // var highlightCount = this.props.room.getUnreadNotificationCount("highlight");

        const notifBadges = notificationCount > 0 && this._shouldShowNotifBadge();
        const mentionBadges = this.props.highlight && this._shouldShowMentionBadge();
        const badges = notifBadges || mentionBadges;

        var classes = classNames({
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.props.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_unreadNotify': notifBadges,
            'mx_RoomTile_highlight': mentionBadges,
            'mx_RoomTile_invited': (me && me.membership == 'invite'),
            'mx_RoomTile_notificationTagMenu': this.state.notificationTagMenu,
            'mx_RoomTile_noBadges': !badges,
        });

        var avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });

        var avatarContainerClasses = classNames({
            'mx_RoomTile_avatar_container': true,
            'mx_RoomTile_avatar_roomTagMenu': this.state.roomTagMenu,
        })

        var badgeClasses = classNames({
            'mx_RoomTile_badge': true,
            'mx_RoomTile_badgeButton': this.state.badgeHover || this.state.notificationTagMenu,
        });

        // XXX: We should never display raw room IDs, but sometimes the
        // room name js sdk gives is undefined (cannot repro this -- k)
        var name = this.props.room.name || this.props.room.roomId;
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        var badge;
        var badgeContent;

        if (this.state.badgeHover || this.state.notificationTagMenu) {
            badgeContent = "\u00B7\u00B7\u00B7";
        } else if (badges) {
            var limitedCount = FormattingUtils.formatCount(notificationCount);
            badgeContent = notificationCount ? limitedCount : '!';
        } else {
            badgeContent = '\u200B';
        }

        badge = <div className={ badgeClasses } onClick={this.onBadgeClicked}>{ badgeContent }</div>;

        const EmojiText = sdk.getComponent('elements.EmojiText');
        var label;
        var tooltip;
        if (!this.props.collapsed) {
            var nameClasses = classNames({
                'mx_RoomTile_name': true,
                'mx_RoomTile_invite': this.props.isInvite,
                'mx_RoomTile_badgeShown': badges || this.state.badgeHover || this.state.notificationTagMenu,
            });

            if (this.props.selected) {
                let nameSelected = <EmojiText>{name}</EmojiText>;

                label = <div title={ name } className={ nameClasses }>{ nameSelected }</div>;
            } else {
                label = <EmojiText element="div" title={ name } className={ nameClasses }>{name}</EmojiText>;
            }
        } else if (this.state.hover) {
            var RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            tooltip = <RoomTooltip className="mx_RoomTile_tooltip" room={this.props.room} />;
        }

        //var incomingCallBox;
        //if (this.props.incomingCall) {
        //    var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
        //    incomingCallBox = <IncomingCallBox incomingCall={ this.props.incomingCall }/>;
        //}

        var RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        var directMessageIndicator;
        if (this._isDirectMessageRoom(this.props.room.roomId)) {
         directMessageIndicator = <img src="img/icon_person.svg" className="mx_RoomTile_dm" width="11" height="13" alt="dm"/>;
        }

        // These props are injected by React DnD,
        // as defined by your `collect` function above:
        var isDragging = this.props.isDragging;
        var connectDragSource = this.props.connectDragSource;
        var connectDropTarget = this.props.connectDropTarget;

        let ret = (
            <div className={classes} onClick={this.onClick} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <div className={avatarClasses}>
                    <div className="mx_RoomTile_avatar_menu" onClick={this.onAvatarClicked}>
                        <div className={avatarContainerClasses}>
                            <RoomAvatar room={this.props.room} width={24} height={24} />
                            {directMessageIndicator}
                        </div>
                    </div>
                </div>
                <div className="mx_RoomTile_nameContainer">
                    { label }
                    { badge }
                </div>
                {/* { incomingCallBox } */}
                { tooltip }
            </div>
        );

        if (connectDropTarget) ret = connectDropTarget(ret);
        if (connectDragSource) ret = connectDragSource(ret);

        return ret;
    }
});
