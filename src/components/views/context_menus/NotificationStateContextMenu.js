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
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');

module.exports = React.createClass({
    displayName: 'NotificationStateContextMenu',

    propTypes: {
        room: React.PropTypes.object.isRequired,
        /* callback called when the menu is dismissed */
        onFinished: React.PropTypes.func,
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

        return {
            areNotifsMuted: areNotifsMuted,
        };
    },

    _save: function( isMuted ) {
        const roomId = this.props.room.roomId;
        /*
        if (this.state.areNotifsMuted !== originalState.areNotifsMuted) {
            promises.push(MatrixClientPeg.get().setRoomMutePushRule(
                "global", roomId, this.state.areNotifsMuted
            ));
        }
        */
        var cli = MatrixClientPeg.get();
        this.setState({areNotifsMuted: isMuted});
        if (!cli.isGuest()) {
            cli.setRoomMutePushRule(
                "global", roomId, isMuted
            );
        }
    },

    _onClickAlertMe: function() {
        // Placeholder
    },

    _onClickAllNotifs: function() {
        this._save(false);
        if (this.props.onFinished) {
            this.props.onFinished();
        };
    },

    _onClickMentions: function() {
        // Placeholder
    },

    _onClickMute: function() {
        this._save(true);
        if (this.props.onFinished) {
            this.props.onFinished();
        };
    },

    render: function() {
        var cli = MatrixClientPeg.get();

        var alertMeClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldDisabled': true,
        });

        var allNotifsClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldSet': !this.state.areNotifsMuted,
        });

        var mentionsClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldDisabled': true,
        });

        var muteNotifsClasses = classNames({
            'mx_NotificationStateContextMenu_field': true,
            'mx_NotificationStateContextMenu_fieldSet': this.state.areNotifsMuted,
        });

        return (
            <div>
                <div className="mx_NotificationStateContextMenu_picker" >
                    <img src="img/notif-slider.svg" width="20" height="107" />
                </div>
                <div className={ alertMeClasses } onClick={this._onClickAlertMe} >
                    <img className="mx_NotificationStateContextMenu_icon" src="img/icon-context-mute-off-copy.svg" width="16" height="12" />
                    Alert me
                </div>
                <div className={ allNotifsClasses } onClick={this._onClickAllNotifs} >
                    <img className="mx_NotificationStateContextMenu_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_NotificationStateContextMenu_icon" src="img/icon-context-mute-off.svg" width="16" height="12" />
                    All notifications
                </div>
                <div className={ mentionsClasses } onClick={this._onClickMentions} >
                    <img className="mx_NotificationStateContextMenu_icon" src="img/icon-context-mute-mentions.svg" width="16" height="12" />
                    Mentions only
                </div>
                <div className={ muteNotifsClasses } onClick={this._onClickMute} >
                    <img className="mx_NotificationStateContextMenu_activeIcon" src="img/notif-active.svg" width="12" height="12" />
                    <img className="mx_NotificationStateContextMenu_icon" src="img/icon-context-mute.svg" width="16" height="12" />
                    Mute
                </div>
            </div>
        );
    }
});
