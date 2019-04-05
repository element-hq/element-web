/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

import Promise from 'bluebird';
import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import { _t, _td } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import dis from '../../../dispatcher';
import DMRoomMap from '../../../utils/DMRoomMap';
import * as Rooms from '../../../Rooms';
import * as RoomNotifs from '../../../RoomNotifs';
import Modal from '../../../Modal';
import RoomListActions from '../../../actions/RoomListActions';

module.exports = React.createClass({
    displayName: 'RoomTileContextMenu',

    propTypes: {
        room: PropTypes.object.isRequired,
        /* callback called when the menu is dismissed */
        onFinished: PropTypes.func,
    },

    getInitialState() {
        const dmRoomMap = new DMRoomMap(MatrixClientPeg.get());
        return {
            roomNotifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            isFavourite: this.props.room.tags.hasOwnProperty("m.favourite"),
            isLowPriority: this.props.room.tags.hasOwnProperty("m.lowpriority"),
            isDirectMessage: Boolean(dmRoomMap.getUserIdForRoomId(this.props.room.roomId)),
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _toggleTag: function(tagNameOn, tagNameOff) {
        if (!MatrixClientPeg.get().isGuest()) {
            Promise.delay(500).then(() => {
                dis.dispatch(RoomListActions.tagRoom(
                    MatrixClientPeg.get(),
                    this.props.room,
                    tagNameOff, tagNameOn,
                    undefined, 0,
                ), true);

                this.props.onFinished();
            });
        }
    },

    _onClickFavourite: function() {
        // Tag room as 'Favourite'
        if (!this.state.isFavourite && this.state.isLowPriority) {
            this.setState({
                isFavourite: true,
                isLowPriority: false,
            });
            this._toggleTag("m.favourite", "m.lowpriority");
        } else if (this.state.isFavourite) {
            this.setState({isFavourite: false});
            this._toggleTag(null, "m.favourite");
        } else if (!this.state.isFavourite) {
            this.setState({isFavourite: true});
            this._toggleTag("m.favourite");
        }
    },

    _onClickLowPriority: function() {
        // Tag room as 'Low Priority'
        if (!this.state.isLowPriority && this.state.isFavourite) {
            this.setState({
                isFavourite: false,
                isLowPriority: true,
            });
            this._toggleTag("m.lowpriority", "m.favourite");
        } else if (this.state.isLowPriority) {
            this.setState({isLowPriority: false});
            this._toggleTag(null, "m.lowpriority");
        } else if (!this.state.isLowPriority) {
            this.setState({isLowPriority: true});
            this._toggleTag("m.lowpriority");
        }
    },

    _onClickDM: function() {
        if (MatrixClientPeg.get().isGuest()) return;

        const newIsDirectMessage = !this.state.isDirectMessage;
        this.setState({
            isDirectMessage: newIsDirectMessage,
        });

        Rooms.guessAndSetDMRoom(
            this.props.room, newIsDirectMessage,
        ).delay(500).finally(() => {
            // Close the context menu
            if (this.props.onFinished) {
                this.props.onFinished();
            }
        }, (err) => {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to set Direct Message status of room', '', ErrorDialog, {
                title: _t('Failed to set Direct Message status of room'),
                description: ((err && err.message) ? err.message : _t('Operation failed')),
            });
        });
    },

    _onClickLeave: function() {
        // Leave room
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.room.roomId,
        });

        // Close the context menu
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    _onClickReject: function() {
        dis.dispatch({
            action: 'reject_invite',
            room_id: this.props.room.roomId,
        });

        // Close the context menu
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    _onClickForget: function() {
        // FIXME: duplicated with RoomSettings (and dead code in RoomView)
        MatrixClientPeg.get().forget(this.props.room.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
        }, function(err) {
            const errCode = err.errcode || _td("unknown error code");
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to forget room', '', ErrorDialog, {
                title: _t('Failed to forget room %(errCode)s', {errCode: errCode}),
                description: ((err && err.message) ? err.message : _t('Operation failed')),
            });
        });

        // Close the context menu
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    _saveNotifState: function(newState) {
        if (MatrixClientPeg.get().isGuest()) return;

        const oldState = this.state.roomNotifState;
        const roomId = this.props.room.roomId;

        this.setState({
            roomNotifState: newState,
        });
        RoomNotifs.setRoomNotifsState(roomId, newState).done(() => {
            // delay slightly so that the user can see their state change
            // before closing the menu
            return Promise.delay(500).then(() => {
                if (this._unmounted) return;
                // Close the context menu
                if (this.props.onFinished) {
                    this.props.onFinished();
                }
            });
        }, (error) => {
            // TODO: some form of error notification to the user
            // to inform them that their state change failed.
            // For now we at least set the state back
            if (this._unmounted) return;
            this.setState({
                roomNotifState: oldState,
            });
        });
    },

    _onClickAlertMe: function() {
        this._saveNotifState(RoomNotifs.ALL_MESSAGES_LOUD);
    },

    _onClickAllNotifs: function() {
        this._saveNotifState(RoomNotifs.ALL_MESSAGES);
    },

    _onClickMentions: function() {
        this._saveNotifState(RoomNotifs.MENTIONS_ONLY);
    },

    _onClickMute: function() {
        this._saveNotifState(RoomNotifs.MUTE);
    },

    _renderNotifMenu: function() {
        const alertMeClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.ALL_MESSAGES_LOUD,
        });

        const allNotifsClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.ALL_MESSAGES,
        });

        const mentionsClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.MENTIONS_ONLY,
        });

        const muteNotifsClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.MUTE,
        });

        return (
            <div className="mx_RoomTileContextMenu">
                <div className="mx_RoomTileContextMenu_notif_picker" >
                    <img src={require("../../../../res/img/notif-slider.svg")} width="20" height="107" />
                </div>
                <div className={alertMeClasses} onClick={this._onClickAlertMe} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src={require("../../../../res/img/notif-active.svg")} width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src={require("../../../../res/img/icon-context-mute-off-copy.svg")} width="16" height="12" />
                    { _t('All messages (noisy)') }
                </div>
                <div className={allNotifsClasses} onClick={this._onClickAllNotifs} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src={require("../../../../res/img/notif-active.svg")} width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src={require("../../../../res/img/icon-context-mute-off.svg")} width="16" height="12" />
                    { _t('All messages') }
                </div>
                <div className={mentionsClasses} onClick={this._onClickMentions} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src={require("../../../../res/img/notif-active.svg")} width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src={require("../../../../res/img/icon-context-mute-mentions.svg")} width="16" height="12" />
                    { _t('Mentions only') }
                </div>
                <div className={muteNotifsClasses} onClick={this._onClickMute} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src={require("../../../../res/img/notif-active.svg")} width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src={require("../../../../res/img/icon-context-mute.svg")} width="16" height="12" />
                    { _t('Mute') }
                </div>
            </div>
        );
    },

    _onClickSettings: function() {
        dis.dispatch({
            action: 'open_room_settings',
            room_id: this.props.room.roomId,
        });
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    _renderSettingsMenu: function() {
        return (
            <div>
                <div className="mx_RoomTileContextMenu_tag_field" onClick={this._onClickSettings} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src={require("../../../../res/img/icons-settings-room.svg")} width="15" height="15" />
                    { _t('Settings') }
                </div>
            </div>
        );
    },

    _renderLeaveMenu: function(membership) {
        if (!membership) {
            return null;
        }

        let leaveClickHandler = null;
        let leaveText = null;

        switch (membership) {
            case "join":
                leaveClickHandler = this._onClickLeave;
                leaveText = _t('Leave');
                break;
            case "leave":
            case "ban":
                leaveClickHandler = this._onClickForget;
                leaveText = _t('Forget');
                break;
            case "invite":
                leaveClickHandler = this._onClickReject;
                leaveText = _t('Reject');
                break;
        }

        return (
            <div>
                <div className="mx_RoomTileContextMenu_leave" onClick={leaveClickHandler} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src={require("../../../../res/img/icon_context_delete.svg")} width="15" height="15" />
                    { leaveText }
                </div>
            </div>
        );
    },

    _renderRoomTagMenu: function() {
        const favouriteClasses = classNames({
            'mx_RoomTileContextMenu_tag_field': true,
            'mx_RoomTileContextMenu_tag_fieldSet': this.state.isFavourite,
            'mx_RoomTileContextMenu_tag_fieldDisabled': false,
        });

        const lowPriorityClasses = classNames({
            'mx_RoomTileContextMenu_tag_field': true,
            'mx_RoomTileContextMenu_tag_fieldSet': this.state.isLowPriority,
            'mx_RoomTileContextMenu_tag_fieldDisabled': false,
        });

        const dmClasses = classNames({
            'mx_RoomTileContextMenu_tag_field': true,
            'mx_RoomTileContextMenu_tag_fieldSet': this.state.isDirectMessage,
            'mx_RoomTileContextMenu_tag_fieldDisabled': false,
        });

        return (
            <div>
                <div className={favouriteClasses} onClick={this._onClickFavourite} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src={require("../../../../res/img/icon_context_fave.svg")} width="15" height="15" />
                    <img className="mx_RoomTileContextMenu_tag_icon_set" src={require("../../../../res/img/icon_context_fave_on.svg")} width="15" height="15" />
                    { _t('Favourite') }
                </div>
                <div className={lowPriorityClasses} onClick={this._onClickLowPriority} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src={require("../../../../res/img/icon_context_low.svg")} width="15" height="15" />
                    <img className="mx_RoomTileContextMenu_tag_icon_set" src={require("../../../../res/img/icon_context_low_on.svg")} width="15" height="15" />
                    { _t('Low Priority') }
                </div>
                <div className={dmClasses} onClick={this._onClickDM} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src={require("../../../../res/img/icon_context_person.svg")} width="15" height="15" />
                    <img className="mx_RoomTileContextMenu_tag_icon_set" src={require("../../../../res/img/icon_context_person_on.svg")} width="15" height="15" />
                    { _t('Direct Chat') }
                </div>
            </div>
        );
    },

    render: function() {
        const myMembership = this.props.room.getMyMembership();

        // Can't set notif level or tags on non-join rooms
        if (myMembership !== 'join') {
            return <div>
                { this._renderLeaveMenu(myMembership) }
                <hr className="mx_RoomTileContextMenu_separator" />
                { this._renderSettingsMenu() }
            </div>;
        }

        return (
            <div>
                { this._renderNotifMenu() }
                <hr className="mx_RoomTileContextMenu_separator" />
                { this._renderLeaveMenu(myMembership) }
                <hr className="mx_RoomTileContextMenu_separator" />
                { this._renderRoomTagMenu() }
                <hr className="mx_RoomTileContextMenu_separator" />
                { this._renderSettingsMenu() }
            </div>
        );
    },
});
