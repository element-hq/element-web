/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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


import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { CallEvent, CallState, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import CallHandler from '../../CallHandler';
import { EventEmitter } from 'events';

export enum CallEventGrouperEvent {
    StateChanged = "state_changed",
}

const SUPPORTED_STATES = [
    CallState.Connected,
    CallState.Connecting,
    CallState.Ended,
    CallState.Ringing,
];

export default class CallEventGrouper extends EventEmitter {
    invite: MatrixEvent;
    call: MatrixCall;
    state: CallState;

    public answerCall = () => {
        this.call?.answer();
    }

    public rejectCall = () => {
        this.call?.reject();
    }

    public callBack = () => {

    }

    public isVoice(): boolean {
        const invite = this.invite;

        // FIXME: Find a better way to determine this from the event?
        let isVoice = true;
        if (
            invite.getContent().offer && invite.getContent().offer.sdp &&
            invite.getContent().offer.sdp.indexOf('m=video') !== -1
        ) {
            isVoice = false;
        }

        return isVoice;
    }

    public getState() {
        return this.state;
    }

    private setCallListeners() {
        this.call.addListener(CallEvent.State, this.setCallState);
    }

    private setCallState = () => {
        if (SUPPORTED_STATES.includes(this.call.state)) {
            this.state = this.call.state;
            this.emit(CallEventGrouperEvent.StateChanged, this.state);
        }
    }

    public add(event: MatrixEvent) {
        if (event.getType() === EventType.CallInvite) this.invite = event;
        if (event.getType() === EventType.CallHangup) this.state = CallState.Ended;

        if (this.call) return;
        const callId = event.getContent().call_id;
        this.call = CallHandler.sharedInstance().getCallById(callId);
        if (!this.call) return;
        this.setCallListeners();
        this.setCallState();
    }
}
