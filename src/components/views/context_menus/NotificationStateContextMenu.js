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

var q = require("q");
var React = require('react');
var classNames = require('classnames');
var RoomNotifs = require('matrix-react-sdk/lib/RoomNotifs');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'NotificationStateContextMenu',

    propTypes: {
        room: React.PropTypes.object.isRequired,
        /* callback called when the menu is dismissed */
        onFinished: React.PropTypes.func,
    },

    getInitialState() {
        return {
            roomNotifState: RoomNotifs.getRoomNotifsState(this.props.room.roomId),
        }
    },

    componentWillMount: function() {
        this._unmounted = false;
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _save: function(newState) {
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
        this._save(RoomNotifs.ALL_MESSAGES_LOUD);
    },

    _onClickAllNotifs: function() {
        this._save(RoomNotifs.ALL_MESSAGES);
    },

    _onClickMentions: function() {
        this._save(RoomNotifs.MENTIONS_ONLY);
    },

    _onClickMute: function() {
        this._save(RoomNotifs.MUTE);
    },

    render: function() {
        var alertMeClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldSet': this.state.roomNotifState == RoomNotifs.ALL_MESSAGES_LOUD,
        });

        var allNotifsClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldSet': this.state.roomNotifState == RoomNotifs.ALL_MESSAGES,
        });

        var mentionsClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldSet': this.state.roomNotifState == RoomNotifs.MENTIONS_ONLY,
        });

        var muteNotifsClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldSet': this.state.roomNotifState == RoomNotifs.MUTE,
        });

        return (
            <div>
                <div className="mx_NotificationStateContextMenu_picker" >
                    <img src="img/notif-slider.svg" width="20" height="107" />
                </div>
                <div className={ alertMeClasses } onClick={this._onClickAlertMe} >
                    <img className="mx_NotificationStateContextMenu_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_NotificationStateContextMenu_icon mx_filterFlipColor" src="img/icon-context-mute-off-copy.svg" width="16" height="12" />
                    All messages (loud)
                </div>
                <div className={ allNotifsClasses } onClick={this._onClickAllNotifs} >
                    <img className="mx_NotificationStateContextMenu_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_NotificationStateContextMenu_icon mx_filterFlipColor" src="img/icon-context-mute-off.svg" width="16" height="12" />
                    All messages
                </div>
                <div className={ mentionsClasses } onClick={this._onClickMentions} >
                    <img className="mx_NotificationStateContextMenu_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_NotificationStateContextMenu_icon mx_filterFlipColor" src="img/icon-context-mute-mentions.svg" width="16" height="12" />
                    Mentions only
                </div>
                <div className={ muteNotifsClasses } onClick={this._onClickMute} >
                    <img className="mx_NotificationStateContextMenu_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_NotificationStateContextMenu_icon mx_filterFlipColor" src="img/icon-context-mute.svg" width="16" height="12" />
                    Mute
                </div>
            </div>
        );
    }
});
