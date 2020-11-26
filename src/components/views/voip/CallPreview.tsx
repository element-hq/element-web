/*
Copyright 2017, 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import CallView from "./CallView";
import RoomViewStore from '../../../stores/RoomViewStore';
import CallHandler from '../../../CallHandler';
import dis from '../../../dispatcher/dispatcher';
import { ActionPayload } from '../../../dispatcher/payloads';
import PersistentApp from "../elements/PersistentApp";
import SettingsStore from "../../../settings/SettingsStore";
import { CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';

const SHOW_CALL_IN_STATES = [
    CallState.Connected,
    CallState.InviteSent,
    CallState.Connecting,
    CallState.CreateAnswer,
    CallState.CreateOffer,
    CallState.WaitLocalMedia,
];

interface IProps {
}

interface IState {
    roomId: string;
    activeCall: MatrixCall;
}

export default class CallPreview extends React.Component<IProps, IState> {
    private roomStoreToken: any;
    private dispatcherRef: string;
    private settingsWatcherRef: string;

    constructor(props: IProps) {
        super(props);

        this.state = {
            roomId: RoomViewStore.getRoomId(),
            activeCall: CallHandler.sharedInstance().getAnyActiveCall(),
        };
    }

    public componentDidMount() {
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount() {
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        dis.unregister(this.dispatcherRef);
        SettingsStore.unwatchSetting(this.settingsWatcherRef);
    }

    private onRoomViewStoreUpdate = (payload) => {
        if (RoomViewStore.getRoomId() === this.state.roomId) return;
        this.setState({
            roomId: RoomViewStore.getRoomId(),
        });
    };

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            // listen for call state changes to prod the render method, which
            // may hide the global CallView if the call it is tracking is dead
            case 'call_state':
                this.setState({
                    activeCall: CallHandler.sharedInstance().getAnyActiveCall(),
                });
                break;
        }
    };

    private onCallViewClick = () => {
        const call = CallHandler.sharedInstance().getAnyActiveCall();
        if (call) {
            dis.dispatch({
                action: 'view_room',
                room_id: call.roomId,
            });
        }
    };

    public render() {
        const callForRoom = CallHandler.sharedInstance().getCallForRoom(this.state.roomId);
        const showCall = (
            this.state.activeCall &&
            SHOW_CALL_IN_STATES.includes(this.state.activeCall.state) &&
            !callForRoom
        );

        if (showCall) {
            return (
                <CallView
                    onClick={this.onCallViewClick}
                    showHangup={true}
                />
            );
        }

        return <PersistentApp />;
    }
}

