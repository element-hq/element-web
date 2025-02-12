/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { CallEvent, CallState, CallType, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { EventEmitter } from "events";

import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";

export enum LegacyCallEventGrouperEvent {
    StateChanged = "state_changed",
    SilencedChanged = "silenced_changed",
    LengthChanged = "length_changed",
}

const CONNECTING_STATES = [
    CallState.Connecting,
    CallState.WaitLocalMedia,
    CallState.CreateOffer,
    CallState.CreateAnswer,
];

const SUPPORTED_STATES = [CallState.Connected, CallState.Ringing, CallState.Ended];

const isCallEventType = (eventType: string): boolean =>
    eventType.startsWith("m.call.") || eventType.startsWith("org.matrix.call.");

export const isCallEvent = (event: MatrixEvent): boolean => isCallEventType(event.getType());

export function buildLegacyCallEventGroupers(
    callEventGroupers: Map<string, LegacyCallEventGrouper>,
    events?: MatrixEvent[],
): Map<string, LegacyCallEventGrouper> {
    const newCallEventGroupers = new Map();
    events?.forEach((ev) => {
        if (!isCallEvent(ev)) {
            return;
        }

        const callId = ev.getContent().call_id;
        if (!newCallEventGroupers.has(callId)) {
            if (callEventGroupers.has(callId)) {
                // reuse the LegacyCallEventGrouper object where possible
                newCallEventGroupers.set(callId, callEventGroupers.get(callId));
            } else {
                newCallEventGroupers.set(callId, new LegacyCallEventGrouper());
            }
        }
        newCallEventGroupers.get(callId).add(ev);
    });
    return newCallEventGroupers;
}

export default class LegacyCallEventGrouper extends EventEmitter {
    private events: Set<MatrixEvent> = new Set<MatrixEvent>();
    private call: MatrixCall | null = null;
    public state?: CallState;

    public constructor() {
        super();

        LegacyCallHandler.instance.addListener(LegacyCallHandlerEvent.CallsChanged, this.setCall);
        LegacyCallHandler.instance.addListener(
            LegacyCallHandlerEvent.SilencedCallsChanged,
            this.onSilencedCallsChanged,
        );
    }

    private get invite(): MatrixEvent | undefined {
        return [...this.events].find((event) => event.getType() === EventType.CallInvite);
    }

    private get hangup(): MatrixEvent | undefined {
        return [...this.events].find((event) => event.getType() === EventType.CallHangup);
    }

    private get reject(): MatrixEvent | undefined {
        return [...this.events].find((event) => event.getType() === EventType.CallReject);
    }

    private get selectAnswer(): MatrixEvent | undefined {
        return [...this.events].find((event) => event.getType() === EventType.CallSelectAnswer);
    }

    public get isVoice(): boolean | undefined {
        const invite = this.invite;
        if (!invite) return undefined;

        // FIXME: Find a better way to determine this from the event?
        if (invite.getContent()?.offer?.sdp?.indexOf("m=video") !== -1) return false;
        return true;
    }

    public get hangupReason(): string | null {
        return this.call?.hangupReason ?? this.hangup?.getContent()?.reason ?? null;
    }

    public get rejectParty(): string | undefined {
        return this.reject?.getSender();
    }

    public get gotRejected(): boolean {
        return Boolean(this.reject);
    }

    public get duration(): number | null {
        if (!this.hangup?.getDate() || !this.selectAnswer?.getDate()) return null;
        return this.hangup.getDate()!.getTime() - this.selectAnswer.getDate()!.getTime();
    }

    /**
     * Returns true if there are only events from the other side - we missed the call
     */
    public get callWasMissed(): boolean {
        return (
            this.state === CallState.Ended &&
            ![...this.events].some((event) => event.sender?.userId === MatrixClientPeg.safeGet().getUserId())
        );
    }

    private get callId(): string | undefined {
        return [...this.events][0]?.getContent()?.call_id;
    }

    private get roomId(): string | undefined {
        return [...this.events][0]?.getRoomId();
    }

    private onSilencedCallsChanged = (): void => {
        const newState = LegacyCallHandler.instance.isCallSilenced(this.callId);
        this.emit(LegacyCallEventGrouperEvent.SilencedChanged, newState);
    };

    private onLengthChanged = (length: number): void => {
        this.emit(LegacyCallEventGrouperEvent.LengthChanged, length);
    };

    public answerCall = (): void => {
        const roomId = this.roomId;
        if (!roomId) return;
        LegacyCallHandler.instance.answerCall(roomId);
    };

    public rejectCall = (): void => {
        const roomId = this.roomId;
        if (!roomId) return;
        LegacyCallHandler.instance.hangupOrReject(roomId, true);
    };

    public callBack = (): void => {
        const roomId = this.roomId;
        if (!roomId) return;
        LegacyCallHandler.instance.placeCall(roomId, this.isVoice ? CallType.Voice : CallType.Video);
    };

    public toggleSilenced = (): void => {
        const silenced = LegacyCallHandler.instance.isCallSilenced(this.callId);
        if (silenced) {
            LegacyCallHandler.instance.unSilenceCall(this.callId);
        } else {
            LegacyCallHandler.instance.silenceCall(this.callId);
        }
    };

    private setCallListeners(): void {
        if (!this.call) return;
        this.call.addListener(CallEvent.State, this.setState);
        this.call.addListener(CallEvent.LengthChanged, this.onLengthChanged);
    }

    private setState = (): void => {
        if (this.call && CONNECTING_STATES.includes(this.call.state)) {
            this.state = CallState.Connecting;
        } else if (this.call && SUPPORTED_STATES.includes(this.call.state)) {
            this.state = this.call.state;
        } else {
            if (this.reject) {
                this.state = CallState.Ended;
            } else if (this.hangup) {
                this.state = CallState.Ended;
            } else if (this.invite && this.call) {
                this.state = CallState.Connecting;
            }
        }
        this.emit(LegacyCallEventGrouperEvent.StateChanged, this.state);
    };

    private setCall = (): void => {
        const callId = this.callId;
        if (!callId || this.call) return;

        this.call = LegacyCallHandler.instance.getCallById(callId);
        this.setCallListeners();
        this.setState();
    };

    public add(event: MatrixEvent): void {
        if (this.events.has(event)) return; // nothing to do
        this.events.add(event);
        this.setCall();
    }
}
