/*
 Copyright 2017 Vector Creations Ltd
 Copyright 2017 Michael Telatynski

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
import MatrixClientPeg from '../../../MatrixClientPeg';
import dis from '../../../dispatcher';
import KeyCode from '../../../KeyCode';


module.exports = React.createClass({
    displayName: 'ForwardMessage',

    propTypes: {
        currentRoomId: React.PropTypes.string.isRequired,
        content: React.PropTypes.object.isRequired,

        onCancelClick: React.PropTypes.func.isRequired,
    },

    componentWillMount: function() {
        this._unmounted = false;

        dis.dispatch({action: 'hide_right_panel'});
        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 0.3,
        });
    },

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener('keydown', this._onKeyDown);
    },

    componentWillUnmount: function() {
        this._unmounted = true;

        dis.dispatch({action: 'restore_right_panel'});
        dis.dispatch({
            action: 'ui_opacity',
            sideOpacity: 1.0,
            middleOpacity: 1.0,
        });
        dis.unregister(this.dispatcherRef);
        document.removeEventListener('keydown', this._onKeyDown);
    },

    onAction: function(payload) {
        if (payload.action === 'view_room') {
            const Client = MatrixClientPeg.get();
            Client.sendMessage(payload.room_id, this.props.content).done(() => {
                dis.dispatch({action: 'message_sent'});
            }, (err) => {
                if (err.name === "UnknownDeviceError") {
                    dis.dispatch({
                        action: 'unknown_device_error',
                        err: err,
                        room: Client.getRoom(payload.room_id),
                    });
                }
                dis.dispatch({action: 'message_send_failed'});
            });
            if (this.props.currentRoomId === payload.room_id) this.props.onCancelClick();
        }
    },

    _onKeyDown: function(ev) {
        switch (ev.keyCode) {
            case KeyCode.ESCAPE:
                this.props.onCancelClick();
                break;
        }
    },

    render: function() {
        return (
            <div className="mx_ForwardMessage">

                <h1>Select a room to send the message to</h1>
                <h2>Use the left sidebar Room List to select forwarding target</h2>

            </div>
        );
    },
});
