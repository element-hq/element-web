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
import { CallEvent, CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { EventSubscription } from 'fbemitter';
import { logger } from "matrix-js-sdk/src/logger";

import CallView from "./CallView";
import RoomViewStore from '../../../stores/RoomViewStore';
import CallHandler, { CallHandlerEvent } from '../../../CallHandler';
import PersistentApp from "../elements/PersistentApp";
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import PictureInPictureDragger from './PictureInPictureDragger';
import dis from '../../../dispatcher/dispatcher';
import { Action } from "../../../dispatcher/actions";
import { WidgetLayoutStore } from '../../../stores/widgets/WidgetLayoutStore';

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

    // The main call that we are displaying (ie. not including the call in the room being viewed, if any)
    primaryCall: MatrixCall;

    // Any other call we're displaying: only if the user is on two calls and not viewing either of the rooms
    // they belong to
    secondaryCall: MatrixCall;
}

// Splits a list of calls into one 'primary' one and a list
// (which should be a single element) of other calls.
// The primary will be the one not on hold, or an arbitrary one
// if they're all on hold)
function getPrimarySecondaryCallsForPip(roomId: string): [MatrixCall, MatrixCall[]] {
    const calls = CallHandler.instance.getAllActiveCallsForPip(roomId);

    let primary: MatrixCall = null;
    let secondaries: MatrixCall[] = [];

    for (const call of calls) {
        if (!SHOW_CALL_IN_STATES.includes(call.state)) continue;

        if (!call.isRemoteOnHold() && primary === null) {
            primary = call;
        } else {
            secondaries.push(call);
        }
    }

    if (primary === null && secondaries.length > 0) {
        primary = secondaries[0];
        secondaries = secondaries.slice(1);
    }

    if (secondaries.length > 1) {
        // We should never be in more than two calls so this shouldn't happen
        logger.log("Found more than 1 secondary call! Other calls will not be shown.");
    }

    return [primary, secondaries];
}

/**
 * CallPreview shows a small version of CallView hovering over the UI in 'picture-in-picture'
 * (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing.
 */
@replaceableComponent("views.voip.CallPreview")
export default class CallPreview extends React.Component<IProps, IState> {
    private roomStoreToken: EventSubscription;
    private dispatcherRef: string;
    private settingsWatcherRef: string;

    constructor(props: IProps) {
        super(props);

        const roomId = RoomViewStore.getRoomId();

        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(roomId);

        this.state = {
            roomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        };
    }

    public componentDidMount() {
        CallHandler.instance.addListener(CallHandlerEvent.CallChangeRoom, this.updateCalls);
        CallHandler.instance.addListener(CallHandlerEvent.CallState, this.updateCalls);
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        MatrixClientPeg.get().on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        const room = MatrixClientPeg.get()?.getRoom(this.state.roomId);
        if (room) {
            WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
    }

    public componentWillUnmount() {
        CallHandler.instance.removeListener(CallHandlerEvent.CallChangeRoom, this.updateCalls);
        CallHandler.instance.removeListener(CallHandlerEvent.CallState, this.updateCalls);
        MatrixClientPeg.get().removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        SettingsStore.unwatchSetting(this.settingsWatcherRef);
        const room = MatrixClientPeg.get().getRoom(this.state.roomId);
        if (room) {
            WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
    }

    private onRoomViewStoreUpdate = () => {
        const newRoomId = RoomViewStore.getRoomId();
        const oldRoomId = this.state.roomId;
        if (newRoomId === oldRoomId) return;
        // The WidgetLayoutStore observer always tracks the currently viewed Room,
        // so we don't end up with multiple observers and know what observer to remove on unmount
        const oldRoom = MatrixClientPeg.get()?.getRoom(oldRoomId);
        if (oldRoom) {
            WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(oldRoom), this.updateCalls);
        }
        const newRoom = MatrixClientPeg.get()?.getRoom(newRoomId);
        if (newRoom) {
            WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(newRoom), this.updateCalls);
        }
        if (!newRoomId) return;

        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(newRoomId);
        this.setState({
            roomId: newRoomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private updateCalls = (): void => {
        if (!this.state.roomId) return;
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(this.state.roomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onCallRemoteHold = () => {
        if (!this.state.roomId) return;
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(this.state.roomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onDoubleClick = (): void => {
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: this.state.primaryCall.roomId,
        });
    };

    public render() {
        const pipMode = true;
        if (this.state.primaryCall) {
            return (
                <PictureInPictureDragger
                    className="mx_CallPreview"
                    draggable={pipMode}
                    onDoubleClick={this.onDoubleClick}
                >
                    {
                        ({ onStartMoving, onResize }) =>
                            <CallView
                                onMouseDownOnHeader={onStartMoving}
                                call={this.state.primaryCall}
                                secondaryCall={this.state.secondaryCall}
                                pipMode={pipMode}
                                onResize={onResize}
                            />
                    }
                </PictureInPictureDragger>

            );
        }

        return <PersistentApp />;
    }
}
