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

import EventEmitter from "events";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

const IGNORED_EVENTS = [
    EventType.CallNegotiate,
    EventType.CallCandidates,
];

export enum TimelineCallEventStoreEvent {
    CallsChanged = "calls_changed"
}

export enum TimelineCallState {
    Invite = "invited",
    Answered = "answered",
    Ended = "ended",
    Rejected = "rejected",
    Unknown = "unknown"
}

const EVENT_TYPE_TO_TIMELINE_CALL_STATE = new Map([
    [EventType.CallInvite, TimelineCallState.Invite],
    [EventType.CallSelectAnswer, TimelineCallState.Answered],
    [EventType.CallHangup, TimelineCallState.Ended],
    [EventType.CallReject, TimelineCallState.Rejected],
]);

export interface TimelineCall {
    state: TimelineCallState;
    date: Date;
}

/**
 * This gathers call events and creates objects for them accordingly, these can then be retrieved by CallEvent
 */
export default class TimelineCallEventStore extends EventEmitter {
    private calls: Map<string, TimelineCall> = new Map();
    private static internalInstance: TimelineCallEventStore;

    public static get instance(): TimelineCallEventStore {
        if (!TimelineCallEventStore.internalInstance) {
            TimelineCallEventStore.internalInstance = new TimelineCallEventStore;
        }

        return TimelineCallEventStore.internalInstance;
    }

    public clear() {
        this.calls.clear();
    }

    public getInfoByCallId(callId: string): TimelineCall {
        return this.calls.get(callId);
    }

    private getCallState(type: EventType): TimelineCallState {
        return EVENT_TYPE_TO_TIMELINE_CALL_STATE.get(type);
    }

    public addEvent(event: MatrixEvent) {
        if (IGNORED_EVENTS.includes(event.getType())) return;

        const callId = event.getContent().call_id;
        const date = event.getDate();
        const state = this.getCallState(event.getType());


        if (date < this.calls.get(callId)?.date) return;
        if (!state) return;

        this.calls.set(callId, {
            state: state,
            date: date,
        });

        this.emit(TimelineCallEventStoreEvent.CallsChanged, this.calls)
    }
}
