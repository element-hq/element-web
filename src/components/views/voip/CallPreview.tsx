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
import { CallEvent, CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import {replaceableComponent} from "../../../utils/replaceableComponent";
import { Action } from '../../../dispatcher/actions';

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

    // Position of the CallPreview
    translationX: number;
    translationY: number;

    // True if the CallPreview is being dragged
    moving: boolean;
}

// Splits a list of calls into one 'primary' one and a list
// (which should be a single element) of other calls.
// The primary will be the one not on hold, or an arbitrary one
// if they're all on hold)
function getPrimarySecondaryCalls(calls: MatrixCall[]): [MatrixCall, MatrixCall[]] {
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
        console.log("Found more than 1 secondary call! Other calls will not be shown.");
    }

    return [primary, secondaries];
}

/**
 * CallPreview shows a small version of CallView hovering over the UI in 'picture-in-picture'
 * (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing.
 */
@replaceableComponent("views.voip.CallPreview")
export default class CallPreview extends React.Component<IProps, IState> {
    private roomStoreToken: any;
    private dispatcherRef: string;
    private settingsWatcherRef: string;

    constructor(props: IProps) {
        super(props);

        const roomId = RoomViewStore.getRoomId();

        const [primaryCall, secondaryCalls] = getPrimarySecondaryCalls(
            CallHandler.sharedInstance().getAllActiveCallsNotInRoom(roomId),
        );

        this.state = {
            roomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
            translationX: 0,
            translationY: 0,
            moving: false,
        };
    }

    private initX = 0;
    private initY = 0;
    private lastX = 0;
    private lastY = 0;

    public componentDidMount() {
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        document.addEventListener("mousemove", this.onMoving);
        document.addEventListener("mouseup", this.onEndMoving);
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
    }

    public componentWillUnmount() {
        MatrixClientPeg.get().removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        document.removeEventListener("mousemove", this.onMoving);
        document.removeEventListener("mouseup", this.onEndMoving);
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        dis.unregister(this.dispatcherRef);
        SettingsStore.unwatchSetting(this.settingsWatcherRef);
    }

    private onRoomViewStoreUpdate = (payload) => {
        if (RoomViewStore.getRoomId() === this.state.roomId) return;

        const roomId = RoomViewStore.getRoomId();
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCalls(
            CallHandler.sharedInstance().getAllActiveCallsNotInRoom(roomId),
        );

        this.setState({
            roomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            // listen for call state changes to prod the render method, which
            // may hide the global CallView if the call it is tracking is dead
            case Action.CallChangeRoom:
            case 'call_state': {
                const [primaryCall, secondaryCalls] = getPrimarySecondaryCalls(
                    CallHandler.sharedInstance().getAllActiveCallsNotInRoom(this.state.roomId),
                );

                this.setState({
                    primaryCall: primaryCall,
                    secondaryCall: secondaryCalls[0],
                });
                break;
            }
        }
    };

    private onCallRemoteHold = () => {
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCalls(
            CallHandler.sharedInstance().getAllActiveCallsNotInRoom(this.state.roomId),
        );

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    }

    private onStartMoving = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        this.setState({moving: true});

        this.initX = event.pageX - this.lastX;
        this.initY = event.pageY - this.lastY;
    }

    private onMoving = (event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!this.state.moving) return;

        this.lastX = event.pageX - this.initX;
        this.lastY = event.pageY - this.initY;

        this.setState({
            translationX: this.lastX,
            translationY: this.lastY,
        });
    }

    private onEndMoving = () => {
        this.setState({moving: false});
    }

    public render() {
        if (this.state.primaryCall) {
            const translatePixelsX = this.state.translationX + "px";
            const translatePixelsY = this.state.translationY + "px";
            const style = {
                transform: `translateX(${translatePixelsX})
                            translateY(${translatePixelsY})`,
            };

            return (
                <div className="mx_CallPreview" style={style}>
                    <CallView
                        call={this.state.primaryCall}
                        secondaryCall={this.state.secondaryCall}
                        pipMode={true}
                        dragCallbacks={{
                            onStartMoving: this.onStartMoving,
                            onMoving: this.onMoving,
                            onEndMoving: this.onEndMoving,
                        }}
                    />
                </div>
            );
        }

        return <PersistentApp />;
    }
}

