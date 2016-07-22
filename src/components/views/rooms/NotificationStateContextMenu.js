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

    onAllClick: function() {
        if (this.props.onFinished) {
            this.setState({areNotifsMuted: false});
            this._save(false);
            this.props.onFinished();
        }
    },

    onMuteClick: function() {
        if (this.props.onFinished) {
            this.setState({areNotifsMuted: true});
            this._save(true);
            this.props.onFinished();
        }
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
        MatrixClientPeg.get().setRoomMutePushRule(
            "global", roomId, isMuted
        );
    },

    _onToggle: function(keyName, checkedValue, uncheckedValue, ev) {
        console.log("Checkbox toggle: %s %s", keyName, ev.target.checked);
        var state = {};
        state[keyName] = ev.target.checked ? checkedValue : uncheckedValue;
        this.setState(state);
    },

    render: function() {
        var cli = MatrixClientPeg.get();
        return (
            <div>
                {/*
                <div className="mx_ContextualMenu_field">
                    <input type="checkbox" disabled={ cli.isGuest() }
                           onChange={this._onToggle.bind(this, "areNotifsMuted", true, false)}
                           defaultChecked={this.state.areNotifsMuted}/>
                    Mute notifications for this room
                </div>
                */}
                <div className="mx_ContextualMenu_field" onClick={ this.onAllClick }>
                    All notifications - { this.state.areNotifsMuted ? "OFF" : "ON" }
                </div>
                <div className="mx_ContextualMenu_field" onClick={ this.onMuteClick }>
                    Mute - { this.state.areNotifsMuted ? "ON" : "OFF" }
                </div>
            </div>
        );
    }
});
