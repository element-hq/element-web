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

    _onToggle: function(ev) {
        switch (ev.target.value) {
            case "all":
                if (this.props.onFinished) {
                    this._save(false);
                    this.props.onFinished();
                }
                break;
            case "mute":
                if (this.props.onFinished) {
                    this._save(true);
                    this.props.onFinished();
                }
                break;
        }
    },

    render: function() {
        var cli = MatrixClientPeg.get();
        return (
            <div>
                <div className="mx_ContextualMenu_field" >
                    <input disabled={cli.isGuest()} type="radio" name="notification_state" value="all" onChange={this._onToggle} checked={!this.state.areNotifsMuted}/>
                    All notifications
                </div>
                <div className="mx_ContextualMenu_field" >
                    <input disabled={cli.isGuest()} type="radio" name="notification_state" value="mute" onChange={this._onToggle} checked={this.state.areNotifsMuted}/>
                    Mute
                </div>
            </div>
        );
    }
});
