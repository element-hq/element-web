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
import { CallEvent, CallState, CallType, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import CallHandler from '../../CallHandler';
import { EventEmitter } from 'events';
import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";

export enum CallEventGrouperEvent {
    StateChanged = "state_changed",
}

const SUPPORTED_STATES = [
    CallState.Connected,
    CallState.Connecting,
    CallState.Ended,
    CallState.Ringing,
];

export enum CustomCallState {
    Missed = "missed",
}

export default class CallEventGrouper extends EventEmitter {
    events: Array<MatrixEvent> = [];
    call: MatrixCall;
    state: CallState | CustomCallState;

    private get invite(): MatrixEvent {
        return this.events.find((event) => event.getType() === EventType.CallInvite);
    }

    public answerCall = () => {
        this.call?.answer();
    }

    public rejectCall = () => {
        this.call?.reject();
    }

    public callBack = () => {
        defaultDispatcher.dispatch({
            action: 'place_call',
            type: this.isVoice ? CallType.Voice : CallType.Video,
            room_id: this.events[0]?.getRoomId(),
        });
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

    public getState(): CallState | CustomCallState {
        return this.state;
    }

    private setCallListeners() {
        if (!this.call) return;
        this.call.addListener(CallEvent.State, this.setCallState);
    }

    private setCallState = () => {
        if (SUPPORTED_STATES.includes(this.call?.state)) {
            this.state = this.call.state;
        } else {
            const lastEvent = this.events[this.events.length - 1];
            const lastEventType = lastEvent.getType();

            if (lastEventType === EventType.CallHangup) this.state = CallState.Ended;
            else if (lastEventType === EventType.CallReject) this.state = CallState.Ended;
            else if (lastEventType === EventType.CallInvite && this.call) this.state = CallState.Connecting;
            else if (this.invite?.sender?.userId !== MatrixClientPeg.get().getUserId()) {
                this.state = CustomCallState.Missed;
            }
        }
        this.emit(CallEventGrouperEvent.StateChanged, this.state);
    }

    public add(event: MatrixEvent) {
        const callId = event.getContent().call_id;
        this.events.push(event);
        if (!this.call) {
            this.call = CallHandler.sharedInstance().getCallById(callId);
            this.setCallListeners();
        }
        this.setCallState();
    }
}
