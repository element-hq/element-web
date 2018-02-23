/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd

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

const React = require('react');
const ReactDOM = require("react-dom");
import PropTypes from 'prop-types';
const classNames = require('classnames');
const MatrixClientPeg = require('../../../MatrixClientPeg');
import DMRoomMap from '../../../utils/DMRoomMap';
const sdk = require('../../../index');
const ContextualMenu = require('../../structures/ContextualMenu');
const RoomNotifs = require('../../../RoomNotifs');
const FormattingUtils = require('../../../utils/FormattingUtils');
import AccessibleButton from '../elements/AccessibleButton';
import ActiveRoomObserver from '../../../ActiveRoomObserver';
import RoomViewStore from '../../../stores/RoomViewStore';

module.exports = React.createClass({
    displayName: 'RoomTile',

    propTypes: {
        onClick: PropTypes.func,

        room: PropTypes.object.isRequired,
        collapsed: PropTypes.bool.isRequired,
        unread: PropTypes.bool.isRequired,
        highlight: PropTypes.bool.isRequired,
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
            notifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            selected: this.props.room.roomId === RoomViewStore.getRoomId(),
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
        const dmRooms = DMRoomMap.shared().getUserIdForRoomId(roomId);
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

    _onActiveRoomChange: function() {
        this.setState({
            selected: this.props.room.roomId === RoomViewStore.getRoomId(),
        });
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on("accountData", this.onAccountData);
        ActiveRoomObserver.addListener(this.props.room.roomId, this._onActiveRoomChange);
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            MatrixClientPeg.get().removeListener("accountData", this.onAccountData);
        }
        ActiveRoomObserver.removeListener(this.props.room.roomId, this._onActiveRoomChange);
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

    onBadgeClicked: function(e) {
        // Only allow none guests to access the context menu
        if (!MatrixClientPeg.get().isGuest()) {
            // If the badge is clicked, then no longer show tooltip
            if (this.props.collapsed) {
                this.setState({ hover: false });
            }

            const RoomTileContextMenu = sdk.getComponent('context_menus.RoomTileContextMenu');
            const elementRect = e.target.getBoundingClientRect();

            // The window X and Y offsets are to adjust position when zoomed in to page
            const x = elementRect.right + window.pageXOffset + 3;
            const chevronOffset = 12;
            let y = (elementRect.top + (elementRect.height / 2) + window.pageYOffset);
            y = y - (chevronOffset + 8); // where 8 is half the height of the chevron

            const self = this;
            ContextualMenu.createMenu(RoomTileContextMenu, {
                chevronOffset: chevronOffset,
                left: x,
                top: y,
                room: this.props.room,
                onFinished: function() {
                    self.setState({ menuDisplayed: false });
                    self.props.refreshSubList();
                },
            });
            this.setState({ menuDisplayed: true });
        }
        // Prevent the RoomTile onClick event firing as well
        e.stopPropagation();
    },

    render: function() {
        const myUserId = MatrixClientPeg.get().credentials.userId;
        const me = this.props.room.currentState.members[myUserId];

        const notificationCount = this.props.room.getUnreadNotificationCount();
        // var highlightCount = this.props.room.getUnreadNotificationCount("highlight");

        const notifBadges = notificationCount > 0 && this._shouldShowNotifBadge();
        const mentionBadges = this.props.highlight && this._shouldShowMentionBadge();
        const badges = notifBadges || mentionBadges;

        const classes = classNames({
            'mx_RoomTile': true,
            'mx_RoomTile_selected': this.state.selected,
            'mx_RoomTile_unread': this.props.unread,
            'mx_RoomTile_unreadNotify': notifBadges,
            'mx_RoomTile_highlight': mentionBadges,
            'mx_RoomTile_invited': (me && me.membership == 'invite'),
            'mx_RoomTile_menuDisplayed': this.state.menuDisplayed,
            'mx_RoomTile_noBadges': !badges,
        });

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });

        const badgeClasses = classNames({
            'mx_RoomTile_badge': true,
            'mx_RoomTile_badgeButton': this.state.badgeHover || this.state.menuDisplayed,
        });

        // XXX: We should never display raw room IDs, but sometimes the
        // room name js sdk gives is undefined (cannot repro this -- k)
        let name = this.props.room.name || this.props.room.roomId;
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        let badge;
        let badgeContent;

        if (this.state.badgeHover || this.state.menuDisplayed) {
            badgeContent = "\u00B7\u00B7\u00B7";
        } else if (badges) {
            const limitedCount = FormattingUtils.formatCount(notificationCount);
            badgeContent = notificationCount ? limitedCount : '!';
        } else {
            badgeContent = '\u200B';
        }

        badge = <div className={badgeClasses} onClick={this.onBadgeClicked}>{ badgeContent }</div>;

        const EmojiText = sdk.getComponent('elements.EmojiText');
        let label;
        let tooltip;
        if (!this.props.collapsed) {
            const nameClasses = classNames({
                'mx_RoomTile_name': true,
                'mx_RoomTile_invite': this.props.isInvite,
                'mx_RoomTile_badgeShown': badges || this.state.badgeHover || this.state.menuDisplayed,
            });

            if (this.state.selected) {
                const nameSelected = <EmojiText>{ name }</EmojiText>;

                label = <div title={name} className={nameClasses} dir="auto">{ nameSelected }</div>;
            } else {
                label = <EmojiText element="div" title={name} className={nameClasses} dir="auto">{ name }</EmojiText>;
            }
        } else if (this.state.hover) {
            const RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            tooltip = <RoomTooltip className="mx_RoomTile_tooltip" room={this.props.room} dir="auto" />;
        }

        //var incomingCallBox;
        //if (this.props.incomingCall) {
        //    var IncomingCallBox = sdk.getComponent("voip.IncomingCallBox");
        //    incomingCallBox = <IncomingCallBox incomingCall={ this.props.incomingCall }/>;
        //}

        const RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        let directMessageIndicator;
        if (this._isDirectMessageRoom(this.props.room.roomId)) {
         directMessageIndicator = <img src="img/icon_person.svg" className="mx_RoomTile_dm" width="11" height="13" alt="dm" />;
        }

        return <AccessibleButton className={classes} tabIndex="0" onClick={this.onClick} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
            <div className={avatarClasses}>
                <div className="mx_RoomTile_avatar_container">
                    <RoomAvatar room={this.props.room} width={24} height={24} />
                    { directMessageIndicator }
                </div>
            </div>
            <div className="mx_RoomTile_nameContainer">
                { label }
                { badge }
            </div>
            { /* { incomingCallBox } */ }
            { tooltip }
        </AccessibleButton>;
    },
});
