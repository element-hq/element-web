/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixWidgetType } from "matrix-widget-api";

import type { GroupCall, Room, RoomMember, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mkEvent } from "./test-utils";
import { Call, type ConnectionState, ElementCall, JitsiCall } from "../../src/models/Call";
import { CallStore } from "../../src/stores/CallStore";

export class MockedCall extends Call {
    public static readonly EVENT_TYPE = "org.example.mocked_call";
    public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

    private constructor(
        room: Room,
        public readonly event: MatrixEvent,
    ) {
        super(
            {
                id: event.getStateKey()!,
                eventId: "$1:example.org",
                roomId: room.roomId,
                type: MatrixWidgetType.Custom,
                url: "https://example.org",
                name: "Group call",
                creatorUserId: "@alice:example.org",
                // waitForIframeLoad = false, makes the widget API wait for the 'contentLoaded' event.
                waitForIframeLoad: false,
            },
            room.client,
        );
        this.groupCall = { creationTs: this.event.getTs() } as unknown as GroupCall;
    }

    public static get(room: Room): MockedCall | null {
        const [event] = room.currentState.getStateEvents(this.EVENT_TYPE);
        return event === undefined || "m.terminated" in event.getContent() ? null : new MockedCall(room, event);
    }

    public static create(room: Room, id: string) {
        room.addLiveEvents(
            [
                mkEvent({
                    event: true,
                    type: this.EVENT_TYPE,
                    room: room.roomId,
                    user: "@alice:example.org",
                    content: { "m.type": "m.video", "m.intent": "m.prompt" },
                    skey: id,
                    ts: Date.now(),
                }),
            ],
            { addToState: true },
        );
        // @ts-ignore deliberately calling a private method
        // Let CallStore know that a call might now exist
        CallStore.instance.updateRoom(room);
    }

    public readonly groupCall: GroupCall;

    public get participants(): Map<RoomMember, Set<string>> {
        return super.participants;
    }
    public set participants(value: Map<RoomMember, Set<string>>) {
        super.participants = value;
    }

    public setConnectionState(value: ConnectionState): void {
        super.connectionState = value;
    }

    // No action needed for any of the following methods since this is just a mock
    public async clean(): Promise<void> {}
    // Public to allow spying
    public async performConnection(): Promise<void> {}
    public async performDisconnection(): Promise<void> {}

    public destroy() {
        // Terminate the call for good measure
        this.room.addLiveEvents(
            [
                mkEvent({
                    event: true,
                    type: MockedCall.EVENT_TYPE,
                    room: this.room.roomId,
                    user: "@alice:example.org",
                    content: { ...this.event.getContent(), "m.terminated": "Call ended" },
                    skey: this.widget.id,
                    ts: Date.now(),
                }),
            ],
            { addToState: true },
        );

        super.destroy();
    }
}

/**
 * Sets up the call store to use mocked calls.
 */
export const useMockedCalls = () => {
    Call.get = (room) => MockedCall.get(room);
    JitsiCall.create = async (room) => MockedCall.create(room, "1");
    ElementCall.create = (room) => MockedCall.create(room, "1");
};
