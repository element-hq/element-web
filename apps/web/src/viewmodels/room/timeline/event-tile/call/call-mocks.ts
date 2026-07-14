/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventEmitter } from "events";
import { type RoomMember, type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";

import { mkEvent, mkRoomMember } from "../../../../../../test/test-utils";
import { type ElementCall } from "../../../../../models/Call";
import type { CallStore } from "../../../../../stores/CallStore";
import type { CallMembership, MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";

export function getMockedRtcNotificationEvent(
    intent: string,
    senderTs: number,
    serverTs: number,
    sender: string = "@foo:m.org",
): MatrixEvent {
    const mockEvent = mkEvent({
        type: "org.matrix.msc4075.rtc.notification",
        user: sender,
        content: {
            "m.call.intent": intent,
            "sender_ts": senderTs,
        },
        ts: serverTs,
        event: true,
        room: "!my-room:m.org",
    });
    return mockEvent;
}

export function getMockedRtcDeclineEvent(rtcNotificationEvent: MatrixEvent, sender = "@foo:m.org"): MatrixEvent {
    const mockEvent = mkEvent({
        type: EventType.RTCDecline,
        user: sender,
        content: {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: rtcNotificationEvent.getId(),
            },
        },
        ts: 924285416000,
        event: true,
    });
    return mockEvent;
}

export function getMockedMember(roomId: string, userId: string, name: string): RoomMember {
    const member = mkRoomMember(roomId, userId);
    member.name = name;
    return member;
}

interface MockCallStoreType extends CallStore {
    withActiveCall(): this;
    isActiveCall: boolean;
    call: ElementCall | null;
}

export class MockedCallStore extends EventEmitter {
    public isActiveCall: boolean = false;

    public constructor(public call: ElementCall | null) {
        super();
    }

    public static create(call: ElementCall | null): MockCallStoreType {
        return new MockedCallStore(call) as unknown as MockCallStoreType;
    }

    public withActiveCall(): this {
        this.isActiveCall = true;
        return this;
    }

    public getCall(): ElementCall | null {
        return this.call;
    }

    public getActiveCall(): ElementCall | null {
        if (this.isActiveCall) return this.getCall();
        return null;
    }
}

interface MockCallType extends ElementCall {
    withOldestMembershipTs(ts: number): this;
    withParticipants(participants: RoomMember[]): this;
}

export class MockedCall extends EventEmitter {
    public participantMap = new Map<RoomMember, Set<string>>();
    public createdTs: number = Date.now();

    public static create(): MockCallType {
        return new MockedCall() as unknown as MockCallType;
    }

    public withOldestMembershipTs(ts: number): this {
        this.createdTs = ts;
        return this;
    }

    public withParticipants(participants: RoomMember[]): this {
        for (const participant of participants) {
            this.participantMap.set(participant, new Set());
        }
        return this;
    }

    public get participants(): Map<RoomMember, Set<string>> {
        return this.participantMap;
    }

    public get session(): MatrixRTCSession {
        return {
            getOldestMembership: (): CallMembership => {
                return {
                    createdTs: () => this.createdTs,
                } as CallMembership;
            },
        } as MatrixRTCSession;
    }
}
