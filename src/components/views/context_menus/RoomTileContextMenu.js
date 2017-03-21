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

import q from 'q';
import React from 'react';
import classNames from 'classnames';
import sdk from 'matrix-react-sdk';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';
import dis from 'matrix-react-sdk/lib/dispatcher';
import DMRoomMap from 'matrix-react-sdk/lib/utils/DMRoomMap';
import * as Rooms from 'matrix-react-sdk/lib/Rooms';
import * as RoomNotifs from 'matrix-react-sdk/lib/RoomNotifs';
import Modal from 'matrix-react-sdk/lib/Modal';

module.exports = React.createClass({
    displayName: 'RoomTileContextMenu',

    propTypes: {
        room: React.PropTypes.object.isRequired,
        /* callback called when the menu is dismissed */
        onFinished: React.PropTypes.func,
    },

    getInitialState() {
        const dmRoomMap = new DMRoomMap(MatrixClientPeg.get());
        return {
            roomNotifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
            isFavourite: this.props.room.tags.hasOwnProperty("m.favourite"),
            isLowPriority: this.props.room.tags.hasOwnProperty("m.lowpriority"),
            isDirectMessage: Boolean(dmRoomMap.getUserIdForRoomId(this.props.room.roomId)),
        }
    },

    componentWillMount: function() {
        this._unmounted = false;
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _toggleTag: function(tagNameOn, tagNameOff) {
        var self = this;
        const roomId = this.props.room.roomId;
        var cli = MatrixClientPeg.get();
        if (!cli.isGuest()) {
            q.delay(500).then(function() {
                if (tagNameOff !== null && tagNameOff !== undefined) {
                    cli.deleteRoomTag(roomId, tagNameOff).finally(function() {
                        // Close the context menu
                        if (self.props.onFinished) {
                            self.props.onFinished();
                        };
                    }).fail(function(err) {
                        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                        Modal.createDialog(ErrorDialog, {
                            title: "Failed to remove tag " + tagNameOff + " from room",
                            description: err.toString()
                        });
                    });
                }

                if (tagNameOn !== null && tagNameOn !== undefined) {
                    // If the tag ordering meta data is required, it is added by
                    // the RoomSubList when it sorts its rooms
                    cli.setRoomTag(roomId, tagNameOn, {}).finally(function() {
                        // Close the context menu
                        if (self.props.onFinished) {
                            self.props.onFinished();
                        };
                    }).fail(function(err) {
                        var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                        Modal.createDialog(ErrorDialog, {
                            title: "Failed to add tag " + tagNameOn + " to room",
                            description: err.toString()
                        });
                    });
                }
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
        const newIsDirectMessage = !this.state.isDirectMessage;
        this.setState({
            isDirectMessage: newIsDirectMessage,
        });

        if (MatrixClientPeg.get().isGuest()) return;

        let newTarget;
        if (newIsDirectMessage) {
            const guessedTarget = Rooms.guessDMRoomTarget(
                this.props.room,
                this.props.room.getMember(MatrixClientPeg.get().credentials.userId),
            );
            newTarget = guessedTarget.userId;
        } else {
            newTarget = null;
        }

        // give some time for the user to see the icon change first, since
        // this will hide the context menu once it completes
        q.delay(500).done(() => {
            return Rooms.setDMRoom(this.props.room.roomId, newTarget).finally(() => {
                // Close the context menu
                if (this.props.onFinished) {
                    this.props.onFinished();
                };
            }, (err) => {
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failed to set Direct Message status of room",
                    description: err.toString()
                });
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
        };
    },

    _onClickReject: function() {
        dis.dispatch({
            action: 'reject_invite',
            room_id: this.props.room.roomId,
        });

        // Close the context menu
        if (this.props.onFinished) {
            this.props.onFinished();
        };
    },

    _onClickForget: function() {
        // FIXME: duplicated with RoomSettings (and dead code in RoomView)
        MatrixClientPeg.get().forget(this.props.room.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
        }, function(err) {
            var errCode = err.errcode || "unknown error code";
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Error",
                description: `Failed to forget room (${errCode})`
            });
        });

        // Close the context menu
        if (this.props.onFinished) {
            this.props.onFinished();
        };
    },

    _saveNotifState: function(newState) {
        const oldState = this.state.roomNotifState;
        const roomId = this.props.room.roomId;
        var cli = MatrixClientPeg.get();

        if (cli.isGuest()) return;

        this.setState({
            roomNotifState: newState,
        });
        RoomNotifs.setRoomNotifsState(this.props.room.roomId, newState).done(() => {
            // delay slightly so that the user can see their state change
            // before closing the menu
            return q.delay(500).then(() => {
                if (this._unmounted) return;
                // Close the context menu
                if (this.props.onFinished) {
                    this.props.onFinished();
                };
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
        var alertMeClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.ALL_MESSAGES_LOUD,
        });

        var allNotifsClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.ALL_MESSAGES,
        });

        var mentionsClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.MENTIONS_ONLY,
        });

        var muteNotifsClasses = classNames({
            'mx_RoomTileContextMenu_notif_field': true,
            'mx_RoomTileContextMenu_notif_fieldSet': this.state.roomNotifState == RoomNotifs.MUTE,
        });

        return (
            <div>
                <div className="mx_RoomTileContextMenu_notif_picker" >
                    <img src="img/notif-slider.svg" width="20" height="107" />
                </div>
                <div className={ alertMeClasses } onClick={this._onClickAlertMe} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src="img/icon-context-mute-off-copy.svg" width="16" height="12" />
                    All messages (loud)
                </div>
                <div className={ allNotifsClasses } onClick={this._onClickAllNotifs} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src="img/icon-context-mute-off.svg" width="16" height="12" />
                    All messages
                </div>
                <div className={ mentionsClasses } onClick={this._onClickMentions} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src="img/icon-context-mute-mentions.svg" width="16" height="12" />
                    Mentions only
                </div>
                <div className={ muteNotifsClasses } onClick={this._onClickMute} >
                    <img className="mx_RoomTileContextMenu_notif_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_RoomTileContextMenu_notif_icon mx_filterFlipColor" src="img/icon-context-mute.svg" width="16" height="12" />
                    Mute
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
                leaveText = "Leave";
                break;
            case "leave":
            case "ban":
                leaveClickHandler = this._onClickForget;
                leaveText = "Forget";
                break;
            case "invite":
                leaveClickHandler = this._onClickReject;
                leaveText = "Reject";
                break;
        }

        return (
            <div>
                <div className="mx_RoomTileContextMenu_leave" onClick={ leaveClickHandler } >
                    <img className="mx_RoomTileContextMenu_tag_icon" src="img/icon_context_delete.svg" width="15" height="15" />
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
                <div className={ favouriteClasses } onClick={this._onClickFavourite} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src="img/icon_context_fave.svg" width="15" height="15" />
                    <img className="mx_RoomTileContextMenu_tag_icon_set" src="img/icon_context_fave_on.svg" width="15" height="15" />
                    Favourite
                </div>
                <div className={ lowPriorityClasses } onClick={this._onClickLowPriority} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src="img/icon_context_low.svg" width="15" height="15" />
                    <img className="mx_RoomTileContextMenu_tag_icon_set" src="img/icon_context_low_on.svg" width="15" height="15" />
                    Low Priority
                </div>
                <div className={ dmClasses } onClick={this._onClickDM} >
                    <img className="mx_RoomTileContextMenu_tag_icon" src="img/icon_context_person.svg" width="15" height="15" />
                    <img className="mx_RoomTileContextMenu_tag_icon_set" src="img/icon_context_person_on.svg" width="15" height="15" />
                    Direct Chat
                </div>
            </div>
        );
    },

    render: function() {
        const myMember = this.props.room.getMember(
            MatrixClientPeg.get().credentials.userId
        );

        // Can't set notif level or tags on non-join rooms
        if (myMember.membership !== 'join') {
            return this._renderLeaveMenu(myMember.membership);
        }

        return (
            <div>
                { this._renderNotifMenu() }
                <hr className="mx_RoomTileContextMenu_separator" />
                { this._renderLeaveMenu(myMember.membership) }
                <hr className="mx_RoomTileContextMenu_separator" />
                { this._renderRoomTagMenu() }
            </div>
        );
    }
});
