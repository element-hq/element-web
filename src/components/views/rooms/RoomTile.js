/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

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


import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import dis from '../../../dispatcher';
import MatrixClientPeg from '../../../MatrixClientPeg';
import DMRoomMap from '../../../utils/DMRoomMap';
import sdk from '../../../index';
import {createMenu} from '../../structures/ContextualMenu';
import * as RoomNotifs from '../../../RoomNotifs';
import * as FormattingUtils from '../../../utils/FormattingUtils';
import AccessibleButton from '../elements/AccessibleButton';
import ActiveRoomObserver from '../../../ActiveRoomObserver';
import RoomViewStore from '../../../stores/RoomViewStore';
import SettingsStore from "../../../settings/SettingsStore";

module.exports = React.createClass({
    displayName: 'RoomTile',

    propTypes: {
        onClick: PropTypes.func,

        room: PropTypes.object.isRequired,
        collapsed: PropTypes.bool.isRequired,
        unread: PropTypes.bool.isRequired,
        highlight: PropTypes.bool.isRequired,
        // If true, apply mx_RoomTile_transparent class
        transparent: PropTypes.bool,
        isInvite: PropTypes.bool.isRequired,
        incomingCall: PropTypes.object,
    },

    getDefaultProps: function() {
        return {
            isDragging: false,
        };
    },

    getInitialState: function() {
        return ({
            hover: false,
            badgeHover: false,
            menuDisplayed: false,
            roomName: this.props.room.name,
            notifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            notificationCount: this.props.room.getUnreadNotificationCount(),
            selected: this.props.room.roomId === RoomViewStore.getRoomId(),
            statusMessage: this._getStatusMessage(),
        });
    },

    _shouldShowNotifBadge: function() {
        const showBadgeInStates = [RoomNotifs.ALL_MESSAGES, RoomNotifs.ALL_MESSAGES_LOUD];
        return showBadgeInStates.indexOf(this.state.notifState) > -1;
    },

    _shouldShowMentionBadge: function() {
        return this.state.notifState !== RoomNotifs.MUTE;
    },

    _isDirectMessageRoom: function(roomId) {
        const dmRooms = DMRoomMap.shared().getUserIdForRoomId(roomId);
        return Boolean(dmRooms);
    },

    _shouldShowStatusMessage() {
        if (!SettingsStore.isFeatureEnabled("feature_custom_status")) {
            return false;
        }
        const isInvite = this.props.room.getMyMembership() === "invite";
        const isJoined = this.props.room.getMyMembership() === "join";
        const looksLikeDm = this.props.room.getInvitedAndJoinedMemberCount() === 2;
        return !isInvite && isJoined && looksLikeDm;
    },

    _getStatusMessageUser() {
        const selfId = MatrixClientPeg.get().getUserId();
        const otherMember = this.props.room.currentState.getMembersExcept([selfId])[0];
        if (!otherMember) {
            return null;
        }
        return otherMember.user;
    },

    _getStatusMessage() {
        const statusUser = this._getStatusMessageUser();
        if (!statusUser) {
            return "";
        }
        return statusUser._unstable_statusMessage;
    },

    onRoomName: function(room) {
        if (room !== this.props.room) return;
        this.setState({
            roomName: this.props.room.name,
        });
    },

    onAccountData: function(accountDataEvent) {
        if (accountDataEvent.getType() === 'm.push_rules') {
            this.setState({
                notifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            });
        }
    },

    onAction: function(payload) {
        switch (payload.action) {
            // XXX: slight hack in order to zero the notification count when a room
            // is read. Ideally this state would be given to this via props (as we
            // do with `unread`). This is still better than forceUpdating the entire
            // RoomList when a room is read.
            case 'on_room_read':
                if (payload.roomId !== this.props.room.roomId) break;
                this.setState({
                    notificationCount: this.props.room.getUnreadNotificationCount(),
                });
                break;
            // RoomTiles are one of the few components that may show custom status and
            // also remain on screen while in Settings toggling the feature.  This ensures
            // you can clearly see the status hide and show when toggling the feature.
            case 'feature_custom_status_changed':
                this.forceUpdate();
                break;
        }
    },

    _onActiveRoomChange: function() {
        this.setState({
            selected: this.props.room.roomId === RoomViewStore.getRoomId(),
        });
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("accountData", this.onAccountData);
        MatrixClientPeg.get().on("Room.name", this.onRoomName);
        ActiveRoomObserver.addListener(this.props.room.roomId, this._onActiveRoomChange);
        this.dispatcherRef = dis.register(this.onAction);

        if (this._shouldShowStatusMessage()) {
            const statusUser = this._getStatusMessageUser();
            if (statusUser) {
                statusUser.on(
                    "User._unstable_statusMessage",
                    this._onStatusMessageCommitted,
                );
            }
        }
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            MatrixClientPeg.get().removeListener("accountData", this.onAccountData);
            MatrixClientPeg.get().removeListener("Room.name", this.onRoomName);
        }
        ActiveRoomObserver.removeListener(this.props.room.roomId, this._onActiveRoomChange);
        dis.unregister(this.dispatcherRef);

        if (this._shouldShowStatusMessage()) {
            const statusUser = this._getStatusMessageUser();
            if (statusUser) {
                statusUser.removeListener(
                    "User._unstable_statusMessage",
                    this._onStatusMessageCommitted,
                );
            }
        }
    },

    componentWillReceiveProps: function(props) {
        // XXX: This could be a lot better - this makes the assumption that
        // the notification count may have changed when the properties of
        // the room tile change.
        this.setState({
            notificationCount: this.props.room.getUnreadNotificationCount(),
        });
    },

    // Do a simple shallow comparison of props and state to avoid unnecessary
    // renders. The assumption made here is that only state and props are used
    // in rendering this component and children.
    //
    // RoomList is frequently made to forceUpdate, so this decreases number of
    // RoomTile renderings.
    shouldComponentUpdate: function(newProps, newState) {
        if (Object.keys(newProps).some((k) => newProps[k] !== this.props[k])) {
            return true;
        }
        if (Object.keys(newState).some((k) => newState[k] !== this.state[k])) {
            return true;
        }
        return false;
    },

    _onStatusMessageCommitted() {
        // The status message `User` object has observed a message change.
        this.setState({
            statusMessage: this._getStatusMessage(),
        });
    },

    onClick: function(ev) {
        if (this.props.onClick) {
            this.props.onClick(this.props.room.roomId, ev);
        }
    },

    onMouseEnter: function() {
        this.setState( { hover: true });
        this.badgeOnMouseEnter();
    },

    onMouseLeave: function() {
        this.setState( { hover: false });
        this.badgeOnMouseLeave();
    },

    _showContextMenu: function(x, y, chevronOffset) {
        const RoomTileContextMenu = sdk.getComponent('context_menus.RoomTileContextMenu');

        createMenu(RoomTileContextMenu, {
            chevronOffset,
            left: x,
            top: y,
            room: this.props.room,
            onFinished: () => {
                this.setState({ menuDisplayed: false });
                this.props.refreshSubList();
            },
        });
        this.setState({ menuDisplayed: true });
    },

    onContextMenu: function(e) {
        // Prevent the RoomTile onClick event firing as well
        e.preventDefault();
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        const chevronOffset = 12;
        this._showContextMenu(e.clientX, e.clientY - (chevronOffset + 8), chevronOffset);
    },

    badgeOnMouseEnter: function() {
        // Only allow non-guests to access the context menu
        // and only change it if it needs to change
        if (!MatrixClientPeg.get().isGuest() && !this.state.badgeHover) {
            this.setState( { badgeHover: true } );
        }
    },

    badgeOnMouseLeave: function() {
        this.setState( { badgeHover: false } );
    },

    onOpenMenu: function(e) {
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        // If the badge is clicked, then no longer show tooltip
        if (this.props.collapsed) {
            this.setState({ hover: false });
        }

        const elementRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = elementRect.right + window.pageXOffset + 3;
        const chevronOffset = 12;
        let y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset);
        y = y - (chevronOffset + 8); // where 8 is half the height of the chevron

        this._showContextMenu(x, y, chevronOffset);
    },

    render: function() {
        const isInvite = this.props.room.getMyMembership() === "invite";
        const notificationCount = this.props.notificationCount;
        // var highlightCount = this.props.room.getUnreadNotificationCount("highlight");

        const notifBadges = notificationCount > 0 && this._shouldShowNotifBadge();
        const mentionBadges = this.props.highlight && this._shouldShowMentionBadge();
        const badges = notifBadges || mentionBadges;

        let subtext = null;
        if (this._shouldShowStatusMessage()) {
            subtext = this.state.statusMessage;
        }

        const classes = classNames({
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.state.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_unreadNotify': notifBadges,
            'mx_RoomTile_highlight': mentionBadges,
            'mx_RoomTile_invited': isInvite,
            'mx_RoomTile_menuDisplayed': this.state.menuDisplayed,
            'mx_RoomTile_noBadges': !badges,
            'mx_RoomTile_transparent': this.props.transparent,
            'mx_RoomTile_hasSubtext': subtext && !this.props.collapsed,
        });

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });

        const badgeClasses = classNames({
            'mx_RoomTile_badge': true,
            'mx_RoomTile_badgeButton': this.state.badgeHover || this.state.menuDisplayed,
        });

        let name = this.state.roomName;
        if (name == undefined || name == null) name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon


        let badge;
        if (badges) {
            const limitedCount = FormattingUtils.formatCount(notificationCount);
            const badgeContent = notificationCount ? limitedCount : '!';
            badge = <div className={badgeClasses}>{ badgeContent }</div>;
        }

        const EmojiText = sdk.getComponent('elements.EmojiText');
        let label;
        let subtextLabel;
        let tooltip;
        if (!this.props.collapsed) {
            const nameClasses = classNames({
                'mx_RoomTile_name': true,
                'mx_RoomTile_invite': this.props.isInvite,
                'mx_RoomTile_badgeShown': badges || this.state.badgeHover || this.state.menuDisplayed,
            });

            subtextLabel = subtext ? <span className="mx_RoomTile_subtext">{ subtext }</span> : null;

            if (this.state.selected) {
                const nameSelected = <EmojiText>{ name }</EmojiText>;

                label = <div title={name} className={nameClasses} dir="auto">{ nameSelected }</div>;
            } else {
                label = <EmojiText element="div" title={name} className={nameClasses} dir="auto">{ name }</EmojiText>;
            }
        } else if (this.state.hover) {
            const Tooltip = sdk.getComponent("elements.Tooltip");
            tooltip = <Tooltip className="mx_RoomTile_tooltip" label={this.props.room.name} dir="auto" />;
        }

        //var incomingCallBox;
        //if (this.props.incomingCall) {
        //    var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
        //    incomingCallBox = <IncomingCallBox incomingCall={ this.props.incomingCall }/>;
        //}

        let contextMenuButton;
        if (!MatrixClientPeg.get().isGuest()) {
            contextMenuButton = <AccessibleButton className="mx_RoomTile_menuButton" onClick={this.onOpenMenu} />;
        }

        const RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        let dmIndicator;
        if (this._isDirectMessageRoom(this.props.room.roomId)) {
            dmIndicator = <img
                src={require("../../../../res/img/icon_person.svg")}
                className="mx_RoomTile_dm"
                width="11"
                height="13"
                alt="dm"
            />;
        }

        return <AccessibleButton tabIndex="0"
                                 className={classes}
                                 onClick={this.onClick}
                                 onMouseEnter={this.onMouseEnter}
                                 onMouseLeave={this.onMouseLeave}
                                 onContextMenu={this.onContextMenu}
        >
            <div className={avatarClasses}>
                <div className="mx_RoomTile_avatar_container">
                    <RoomAvatar room={this.props.room} width={24} height={24} />
                    { dmIndicator }
                </div>
            </div>
            <div className="mx_RoomTile_nameContainer">
                <div className="mx_RoomTile_labelContainer">
                    { label }
                    { subtextLabel }
                </div>
                { contextMenuButton }
                { badge }
            </div>
            { /* { incomingCallBox } */ }
            { tooltip }
        </AccessibleButton>;
    },
});
