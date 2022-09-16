/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixWidgetType } from "matrix-widget-api";

import type { Room } from "matrix-js-sdk/src/models/room";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { mkEvent } from "./test-utils";
import { Call } from "../../src/models/Call";

export class MockedCall extends Call {
    private static EVENT_TYPE = "org.example.mocked_call";
    public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

    private constructor(room: Room, id: string) {
        super(
            {
                id,
                eventId: "$1:example.org",
                roomId: room.roomId,
                type: MatrixWidgetType.Custom,
                url: "https://example.org",
                name: "Group call",
                creatorUserId: "@alice:example.org",
            },
            room.client,
        );
    }

    public static get(room: Room): MockedCall | null {
        const [event] = room.currentState.getStateEvents(this.EVENT_TYPE);
        return event?.getContent().terminated ?? true ? null : new MockedCall(room, event.getStateKey()!);
    }

    public static create(room: Room, id: string) {
        // Update room state to let CallStore know that a call might now exist
        room.addLiveEvents([mkEvent({
            event: true,
            type: this.EVENT_TYPE,
            room: room.roomId,
            user: "@alice:example.org",
            content: { terminated: false },
            skey: id,
        })]);
    }

    public get participants(): Set<RoomMember> {
        return super.participants;
    }
    public set participants(value: Set<RoomMember>) {
        super.participants = value;
    }

    // No action needed for any of the following methods since this is just a mock
    protected getDevices(): string[] { return []; }
    protected async setDevices(): Promise<void> { }
    // Public to allow spying
    public async performConnection(): Promise<void> {}
    public async performDisconnection(): Promise<void> {}

    public destroy() {
        // Terminate the call for good measure
        this.room.addLiveEvents([mkEvent({
            event: true,
            type: MockedCall.EVENT_TYPE,
            room: this.room.roomId,
            user: "@alice:example.org",
            content: { terminated: true },
            skey: this.widget.id,
        })]);

        super.destroy();
    }
}

/**
 * Sets up the call store to use mocked calls.
 */
export const useMockedCalls = () => {
    Call.get = room => MockedCall.get(room);
};
