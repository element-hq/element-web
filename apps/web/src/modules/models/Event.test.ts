/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";
import { MatrixEvent, type IEvent, type RoomMember } from "matrix-js-sdk/src/matrix";

import { getModuleMatrixEvent } from "./Event";

/**
 * Create a MatrixEvent, optionally with a sender resolved on it.
 * @param event Partial event JSON.
 * @param senderId The user ID to use for the resolved sender, or undefined for an unresolved sender.
 */
function mkEvent(event: Partial<IEvent>, senderId?: string): MatrixEvent {
    const mxEvent = new MatrixEvent(event);
    if (senderId) {
        mxEvent.sender = { userId: senderId } as RoomMember;
    }
    return mxEvent;
}

describe("getModuleMatrixEvent", () => {
    it("should convert a message event", () => {
        const mxEvent = mkEvent(
            {
                event_id: "$event:example.org",
                type: "m.room.message",
                room_id: "!room:example.org",
                sender: "@alice:example.org",
                origin_server_ts: 1234,
                content: { msgtype: "m.text", body: "hello" },
                unsigned: { age: 5 },
            },
            "@alice:example.org",
        );

        expect(getModuleMatrixEvent(mxEvent)).toEqual({
            content: { msgtype: "m.text", body: "hello" },
            eventId: "$event:example.org",
            originServerTs: 1234,
            roomId: "!room:example.org",
            sender: "@alice:example.org",
            stateKey: undefined,
            type: "m.room.message",
            unsigned: { age: 5 },
        });
    });

    it("should include the state key of a state event", () => {
        const mxEvent = mkEvent(
            {
                event_id: "$event:example.org",
                type: "m.room.member",
                room_id: "!room:example.org",
                sender: "@alice:example.org",
                state_key: "@bob:example.org",
                content: { membership: "join" },
            },
            "@alice:example.org",
        );

        expect(getModuleMatrixEvent(mxEvent)).toEqual(
            expect.objectContaining({
                stateKey: "@bob:example.org",
                type: "m.room.member",
            }),
        );
    });

    it("should return null if the event has no event ID", () => {
        const mxEvent = mkEvent(
            {
                type: "m.room.message",
                room_id: "!room:example.org",
                sender: "@alice:example.org",
                content: { msgtype: "m.text", body: "hello" },
            },
            "@alice:example.org",
        );

        expect(getModuleMatrixEvent(mxEvent)).toBeNull();
    });

    it("should return null if the event has no room ID", () => {
        const mxEvent = mkEvent(
            {
                event_id: "$event:example.org",
                type: "m.room.message",
                sender: "@alice:example.org",
                content: { msgtype: "m.text", body: "hello" },
            },
            "@alice:example.org",
        );

        expect(getModuleMatrixEvent(mxEvent)).toBeNull();
    });

    it("should return null if the event has no resolved sender", () => {
        const mxEvent = mkEvent({
            event_id: "$event:example.org",
            type: "m.room.message",
            room_id: "!room:example.org",
            sender: "@alice:example.org",
            content: { msgtype: "m.text", body: "hello" },
        });

        expect(getModuleMatrixEvent(mxEvent)).toBeNull();
    });
});
