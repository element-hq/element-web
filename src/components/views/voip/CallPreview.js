/*
Copyright 2017, 2018 New Vector Ltd
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
import RoomViewStore from '../../../stores/RoomViewStore';
import CallHandler from '../../../CallHandler';
import dis from '../../../dispatcher/dispatcher';
import * as sdk from '../../../index';

export default createReactClass({
    displayName: 'CallPreview',

    propTypes: {
        // A Conference Handler implementation
        // Must have a function signature:
        //  getConferenceCallForRoom(roomId: string): MatrixCall
        ConferenceHandler: PropTypes.object,
    },

    getInitialState: function() {
        return {
            roomId: RoomViewStore.getRoomId(),
            activeCall: CallHandler.getAnyActiveCall(),
        };
    },

    componentDidMount: function() {
        this._roomStoreToken = RoomViewStore.addListener(this._onRoomViewStoreUpdate);
        this.dispatcherRef = dis.register(this._onAction);
    },

    componentWillUnmount: function() {
        if (this._roomStoreToken) {
            this._roomStoreToken.remove();
        }
        dis.unregister(this.dispatcherRef);
    },

    _onRoomViewStoreUpdate: function(payload) {
        if (RoomViewStore.getRoomId() === this.state.roomId) return;
        this.setState({
            roomId: RoomViewStore.getRoomId(),
        });
    },

    _onAction: function(payload) {
        switch (payload.action) {
            // listen for call state changes to prod the render method, which
            // may hide the global CallView if the call it is tracking is dead
            case 'call_state':
                this.setState({
                    activeCall: CallHandler.getAnyActiveCall(),
                });
                break;
        }
    },

    _onCallViewClick: function() {
        const call = CallHandler.getAnyActiveCall();
        if (call) {
            dis.dispatch({
                action: 'view_room',
                room_id: call.groupRoomId || call.roomId,
            });
        }
    },

    render: function() {
        const callForRoom = CallHandler.getCallForRoom(this.state.roomId);
        const showCall = (this.state.activeCall && this.state.activeCall.call_state === 'connected' && !callForRoom);

        if (showCall) {
            const CallView = sdk.getComponent('voip.CallView');
            return (
                <CallView
                    className="mx_LeftPanel_callView" showVoice={true} onClick={this._onCallViewClick}
                    ConferenceHandler={this.props.ConferenceHandler}
                />
            );
        }
        const PersistentApp = sdk.getComponent('elements.PersistentApp');
        return <PersistentApp />;
    },
});

