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

// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14231

import React from 'react';

import CallView from "./CallView2";
import RoomViewStore from '../../../stores/RoomViewStore';
import CallHandler from '../../../CallHandler';
import dis from '../../../dispatcher/dispatcher';
import { ActionPayload } from '../../../dispatcher/payloads';
import PersistentApp from "../elements/PersistentApp";
import SettingsStore from "../../../settings/SettingsStore";

interface IProps {
    // A Conference Handler implementation
    // Must have a function signature:
    //  getConferenceCallForRoom(roomId: string): MatrixCall
    ConferenceHandler: any;
}

interface IState {
    roomId: string;
    activeCall: any;
    newRoomListActive: boolean;
}

export default class CallPreview extends React.Component<IProps, IState> {
    private roomStoreToken: any;
    private dispatcherRef: string;
    private settingsWatcherRef: string;

    constructor(props: IProps) {
        super(props);

        this.state = {
            roomId: RoomViewStore.getRoomId(),
            activeCall: CallHandler.getAnyActiveCall(),
            newRoomListActive: SettingsStore.getValue("feature_new_room_list"),
        };

        this.settingsWatcherRef = SettingsStore.watchSetting("feature_new_room_list", null, (name, roomId, level, valAtLevel, newVal) => this.setState({
            newRoomListActive: newVal,
        }));
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
                    activeCall: CallHandler.getAnyActiveCall(),
                });
                break;
        }
    };

    private onCallViewClick = () => {
        const call = CallHandler.getAnyActiveCall();
        if (call) {
            dis.dispatch({
                action: 'view_room',
                room_id: call.groupRoomId || call.roomId,
            });
        }
    };

    public render() {
        if (this.state.newRoomListActive) {
            const callForRoom = CallHandler.getCallForRoom(this.state.roomId);
            const showCall = (
                this.state.activeCall &&
                this.state.activeCall.call_state === 'connected' &&
                !callForRoom
            );

            if (showCall) {
                return (
                    <CallView
                        className="mx_CallPreview" onClick={this.onCallViewClick}
                        ConferenceHandler={this.props.ConferenceHandler}
                        showHangup={true}
                    />
                );
            }

            return <PersistentApp />;
        }

        return null;
    }
}

