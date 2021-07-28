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

import React, { createRef } from 'react';

import CallView from "./CallView";
import RoomViewStore from '../../../stores/RoomViewStore';
import CallHandler, { CallHandlerEvent } from '../../../CallHandler';
import dis from '../../../dispatcher/dispatcher';
import { ActionPayload } from '../../../dispatcher/payloads';
import PersistentApp from "../elements/PersistentApp";
import SettingsStore from "../../../settings/SettingsStore";
import { CallEvent, CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import UIStore from '../../../stores/UIStore';
import { lerp } from '../../../utils/AnimationUtils';
import { MarkedExecution } from '../../../utils/MarkedExecution';
import { EventSubscription } from 'fbemitter';

const PIP_VIEW_WIDTH = 336;
const PIP_VIEW_HEIGHT = 232;

const MOVING_AMT = 0.2;
const SNAPPING_AMT = 0.05;

const PADDING = {
    top: 58,
    bottom: 58,
    left: 76,
    right: 8,
};

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
    private roomStoreToken: EventSubscription;
    private dispatcherRef: string;
    private settingsWatcherRef: string;
    private callViewWrapper = createRef<HTMLDivElement>();
    private initX = 0;
    private initY = 0;
    private desiredTranslationX = UIStore.instance.windowWidth - PADDING.right - PIP_VIEW_WIDTH;
    private desiredTranslationY = UIStore.instance.windowHeight - PADDING.bottom - PIP_VIEW_WIDTH;
    private moving = false;
    private scheduledUpdate = new MarkedExecution(
        () => this.animationCallback(),
        () => requestAnimationFrame(() => this.scheduledUpdate.trigger()),
    );

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
            translationX: UIStore.instance.windowWidth - PADDING.right - PIP_VIEW_WIDTH,
            translationY: UIStore.instance.windowHeight - PADDING.bottom - PIP_VIEW_WIDTH,
        };
    }

    public componentDidMount() {
        CallHandler.sharedInstance().addListener(CallHandlerEvent.CallChangeRoom, this.updateCalls);
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        document.addEventListener("mousemove", this.onMoving);
        document.addEventListener("mouseup", this.onEndMoving);
        window.addEventListener("resize", this.onResize);
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
    }

    public componentWillUnmount() {
        CallHandler.sharedInstance().removeListener(CallHandlerEvent.CallChangeRoom, this.updateCalls);
        MatrixClientPeg.get().removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        document.removeEventListener("mousemove", this.onMoving);
        document.removeEventListener("mouseup", this.onEndMoving);
        window.removeEventListener("resize", this.onResize);
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        dis.unregister(this.dispatcherRef);
        SettingsStore.unwatchSetting(this.settingsWatcherRef);
    }

    private onResize = (): void => {
        this.snap(false);
    };

    private animationCallback = () => {
        // If the PiP isn't being dragged and there is only a tiny difference in
        // the desiredTranslation and translation, quit the animationCallback
        // loop. If that is the case, it means the PiP has snapped into its
        // position and there is nothing to do. Not doing this would cause an
        // infinite loop
        if (
            !this.moving &&
            Math.abs(this.state.translationX - this.desiredTranslationX) <= 1 &&
            Math.abs(this.state.translationY - this.desiredTranslationY) <= 1
        ) return;

        const amt = this.moving ? MOVING_AMT : SNAPPING_AMT;
        this.setState({
            translationX: lerp(this.state.translationX, this.desiredTranslationX, amt),
            translationY: lerp(this.state.translationY, this.desiredTranslationY, amt),
        });
        this.scheduledUpdate.mark();
    };

    private setTranslation(inTranslationX: number, inTranslationY: number) {
        const width = this.callViewWrapper.current?.clientWidth || PIP_VIEW_WIDTH;
        const height = this.callViewWrapper.current?.clientHeight || PIP_VIEW_HEIGHT;

        // Avoid overflow on the x axis
        if (inTranslationX + width >= UIStore.instance.windowWidth) {
            this.desiredTranslationX = UIStore.instance.windowWidth - width;
        } else if (inTranslationX <= 0) {
            this.desiredTranslationX = 0;
        } else {
            this.desiredTranslationX = inTranslationX;
        }

        // Avoid overflow on the y axis
        if (inTranslationY + height >= UIStore.instance.windowHeight) {
            this.desiredTranslationY = UIStore.instance.windowHeight - height;
        } else if (inTranslationY <= 0) {
            this.desiredTranslationY = 0;
        } else {
            this.desiredTranslationY = inTranslationY;
        }
    }

    private snap(animate?: boolean): void {
        const translationX = this.desiredTranslationX;
        const translationY = this.desiredTranslationY;
        // We subtract the PiP size from the window size in order to calculate
        // the position to snap to from the PiP center and not its top-left
        // corner
        const windowWidth = (
            UIStore.instance.windowWidth -
            (this.callViewWrapper.current?.clientWidth || PIP_VIEW_WIDTH)
        );
        const windowHeight = (
            UIStore.instance.windowHeight -
            (this.callViewWrapper.current?.clientHeight || PIP_VIEW_HEIGHT)
        );

        if (translationX >= windowWidth / 2 && translationY >= windowHeight / 2) {
            this.desiredTranslationX = windowWidth - PADDING.right;
            this.desiredTranslationY = windowHeight - PADDING.bottom;
        } else if (translationX >= windowWidth / 2 && translationY <= windowHeight / 2) {
            this.desiredTranslationX = windowWidth - PADDING.right;
            this.desiredTranslationY = PADDING.top;
        } else if (translationX <= windowWidth / 2 && translationY >= windowHeight / 2) {
            this.desiredTranslationX = PADDING.left;
            this.desiredTranslationY = windowHeight - PADDING.bottom;
        } else {
            this.desiredTranslationX = PADDING.left;
            this.desiredTranslationY = PADDING.top;
        }

        if (animate) {
            // We start animating here because we want the PiP to move when we're
            // resizing the window
            this.scheduledUpdate.mark();
        } else {
            this.setState({
                translationX: this.desiredTranslationX,
                translationY: this.desiredTranslationY,
            });
        }
    }

    private onRoomViewStoreUpdate = () => {
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
            case 'call_state': {
                this.updateCalls();
                break;
            }
        }
    };

    private updateCalls = () => {
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCalls(
            CallHandler.sharedInstance().getAllActiveCallsNotInRoom(this.state.roomId),
        );

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onCallRemoteHold = () => {
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCalls(
            CallHandler.sharedInstance().getAllActiveCallsNotInRoom(this.state.roomId),
        );

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onStartMoving = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        this.moving = true;
        this.initX = event.pageX - this.desiredTranslationX;
        this.initY = event.pageY - this.desiredTranslationY;
        this.scheduledUpdate.mark();
    };

    private onMoving = (event: React.MouseEvent | MouseEvent) => {
        if (!this.moving) return;

        event.preventDefault();
        event.stopPropagation();

        this.setTranslation(event.pageX - this.initX, event.pageY - this.initY);
    };

    private onEndMoving = () => {
        this.moving = false;
        this.snap(true);
    };

    public render() {
        if (this.state.primaryCall) {
            const translatePixelsX = this.state.translationX + "px";
            const translatePixelsY = this.state.translationY + "px";
            const style = {
                transform: `translateX(${translatePixelsX})
                            translateY(${translatePixelsY})`,
            };

            return (
                <div
                    className="mx_CallPreview"
                    style={style}
                    ref={this.callViewWrapper}
                >
                    <CallView
                        call={this.state.primaryCall}
                        secondaryCall={this.state.secondaryCall}
                        pipMode={true}
                        onMouseDownOnHeader={this.onStartMoving}
                        onResize={this.onResize}
                    />
                </div>
            );
        }

        return <PersistentApp />;
    }
}

