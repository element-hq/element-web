/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import createReactClass from 'create-react-class';
import classNames from 'classnames';
import dis from '../../../dispatcher';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import DMRoomMap from '../../../utils/DMRoomMap';
import * as sdk from '../../../index';
import {ContextMenu, ContextMenuButton, toRightOf} from '../../structures/ContextMenu';
import * as RoomNotifs from '../../../RoomNotifs';
import * as FormattingUtils from '../../../utils/FormattingUtils';
import ActiveRoomObserver from '../../../ActiveRoomObserver';
import RoomViewStore from '../../../stores/RoomViewStore';
import SettingsStore from "../../../settings/SettingsStore";
import {_t} from "../../../languageHandler";

export default createReactClass({
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
            contextMenuPosition: null, // DOM bounding box, null if non-shown
            roomName: this.props.room.name,
            notifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            notificationCount: this.props.room.getUnreadNotificationCount(),
            selected: this.props.room.roomId === RoomViewStore.getRoomId(),
            statusMessage: this._getStatusMessage(),
        });
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
        if (!MatrixClientPeg.get()) return null; // We've probably been logged out

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

    componentDidMount: function() {
        const cli = MatrixClientPeg.get();
        cli.on("accountData", this.onAccountData);
        cli.on("Room.name", this.onRoomName);
        ActiveRoomObserver.addListener(this.props.room.roomId, this._onActiveRoomChange);
        this.dispatcherRef = dis.register(this.onAction);

        if (this._shouldShowStatusMessage()) {
            const statusUser = this._getStatusMessageUser();
            if (statusUser) {
                statusUser.on("User._unstable_statusMessage", this._onStatusMessageCommitted);
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

    _showContextMenu: function(boundingClientRect) {
        // Only allow non-guests to access the context menu
        if (MatrixClientPeg.get().isGuest()) return;

        const state = {
            contextMenuPosition: boundingClientRect,
        };

        // If the badge is clicked, then no longer show tooltip
        if (this.props.collapsed) {
            state.hover = false;
        }

        this.setState(state);
    },

    onContextMenuButtonClick: function(e) {
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
        e.preventDefault();

        this._showContextMenu(e.target.getBoundingClientRect());
    },

    onContextMenu: function(e) {
        // Prevent the native context menu
        e.preventDefault();

        this._showContextMenu({
            right: e.clientX,
            top: e.clientY,
            height: 0,
        });
    },

    closeMenu: function() {
        this.setState({
            contextMenuPosition: null,
        });
        this.props.refreshSubList();
    },

    render: function() {
        const isInvite = this.props.room.getMyMembership() === "invite";
        const notificationCount = this.props.notificationCount;
        // var highlightCount = this.props.room.getUnreadNotificationCount("highlight");

        const notifBadges = notificationCount > 0 && RoomNotifs.shouldShowNotifBadge(this.state.notifState);
        const mentionBadges = this.props.highlight && RoomNotifs.shouldShowMentionBadge(this.state.notifState);
        const badges = notifBadges || mentionBadges;

        let subtext = null;
        if (this._shouldShowStatusMessage()) {
            subtext = this.state.statusMessage;
        }

        const isMenuDisplayed = Boolean(this.state.contextMenuPosition);

        const classes = classNames({
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.state.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_unreadNotify': notifBadges,
            'mx_RoomTile_highlight': mentionBadges,
            'mx_RoomTile_invited': isInvite,
            'mx_RoomTile_menuDisplayed': isMenuDisplayed,
            'mx_RoomTile_noBadges': !badges,
            'mx_RoomTile_transparent': this.props.transparent,
            'mx_RoomTile_hasSubtext': subtext && !this.props.collapsed,
        });

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });

        const badgeClasses = classNames({
            'mx_RoomTile_badge': true,
            'mx_RoomTile_badgeButton': this.state.badgeHover || isMenuDisplayed,
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

        let label;
        let subtextLabel;
        let tooltip;
        if (!this.props.collapsed) {
            const nameClasses = classNames({
                'mx_RoomTile_name': true,
                'mx_RoomTile_invite': this.props.isInvite,
                'mx_RoomTile_badgeShown': badges || this.state.badgeHover || isMenuDisplayed,
            });

            subtextLabel = subtext ? <span className="mx_RoomTile_subtext">{ subtext }</span> : null;
            label = <div title={name} className={nameClasses} dir="auto">{ name }</div>;
        } else if (this.state.hover) {
            const Tooltip = sdk.getComponent("elements.Tooltip");
            tooltip = <Tooltip className="mx_RoomTile_tooltip" label={this.props.room.name} dir="auto" />;
        }

        //var incomingCallBox;
        //if (this.props.incomingCall) {
        //    var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
        //    incomingCallBox = <IncomingCallBox incomingCall={ this.props.incomingCall }/>;
        //}

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        let contextMenuButton;
        if (!MatrixClientPeg.get().isGuest()) {
            contextMenuButton = (
                <ContextMenuButton
                    className="mx_RoomTile_menuButton"
                    label={_t("Options")}
                    isExpanded={isMenuDisplayed}
                    onClick={this.onContextMenuButtonClick} />
            );
        }

        const RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        let ariaLabel = name;

        const dmUserId = DMRoomMap.shared().getUserIdForRoomId(this.props.room.roomId);

        let dmIndicator;
        let dmOnline;
        if (dmUserId) {
            dmIndicator = <img
                src={require("../../../../res/img/icon_person.svg")}
                className="mx_RoomTile_dm"
                width="11"
                height="13"
                alt="dm"
            />;

            const { room } = this.props;
            const member = room.getMember(dmUserId);
            if (member && member.membership === "join" && room.getJoinedMemberCount() === 2) {
                const UserOnlineDot = sdk.getComponent('rooms.UserOnlineDot');
                dmOnline = <UserOnlineDot userId={dmUserId} />;
            }
        }

        // The following labels are written in such a fashion to increase screen reader efficiency (speed).
        if (notifBadges && mentionBadges && !isInvite) {
            ariaLabel += " " + _t("%(count)s unread messages including mentions.", {
                count: notificationCount,
            });
        } else if (notifBadges) {
            ariaLabel += " " + _t("%(count)s unread messages.", { count: notificationCount });
        } else if (mentionBadges && !isInvite) {
            ariaLabel += " " + _t("Unread mentions.");
        } else if (this.props.unread) {
            ariaLabel += " " + _t("Unread messages.");
        }

        let contextMenu;
        if (isMenuDisplayed) {
            const RoomTileContextMenu = sdk.getComponent('context_menus.RoomTileContextMenu');
            contextMenu = (
                <ContextMenu {...toRightOf(this.state.contextMenuPosition)} onFinished={this.closeMenu}>
                    <RoomTileContextMenu room={this.props.room} onFinished={this.closeMenu} />
                </ContextMenu>
            );
        }

        return <React.Fragment>
            <AccessibleButton
                tabIndex="0"
                className={classes}
                onClick={this.onClick}
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
                onContextMenu={this.onContextMenu}
                aria-label={ariaLabel}
                aria-selected={this.state.selected}
                role="treeitem"
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
                    { dmOnline }
                    { contextMenuButton }
                    { badge }
                </div>
                { /* { incomingCallBox } */ }
                { tooltip }
            </AccessibleButton>

            { contextMenu }
        </React.Fragment>;
    },
});
