/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MatrixEvent, RelationType, Room, MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { isRelatedToVoiceBroadcast, VoiceBroadcastInfoState } from "../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";

const mkRelatedEvent = (
    room: Room,
    relationType: RelationType,
    relatesTo: MatrixEvent | undefined,
    client: MatrixClient,
): MatrixEvent => {
    const event = mkEvent({
        event: true,
        type: EventType.RoomMessage,
        room: room.roomId,
        content: {
            "m.relates_to": {
                rel_type: relationType,
                event_id: relatesTo?.getId(),
            },
        },
        user: client.getSafeUserId(),
    });
    room.addLiveEvents([event]);
    return event;
};

describe("isRelatedToVoiceBroadcast", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let room: Room;
    let broadcastEvent: MatrixEvent;
    let nonBroadcastEvent: MatrixEvent;

    beforeAll(() => {
        client = stubClient();
        room = new Room(roomId, client, client.getSafeUserId());

        mocked(client.getRoom).mockImplementation((getRoomId: string): Room | null => {
            if (getRoomId === roomId) return room;
            return null;
        });

        broadcastEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getSafeUserId(),
            "ABC123",
        );
        nonBroadcastEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            content: {},
            user: client.getSafeUserId(),
        });

        room.addLiveEvents([broadcastEvent, nonBroadcastEvent]);
    });

    it("should return true if related (reference) to a broadcast event", () => {
        expect(
            isRelatedToVoiceBroadcast(mkRelatedEvent(room, RelationType.Reference, broadcastEvent, client), client),
        ).toBe(true);
    });

    it("should return false if related (reference) is undefeind", () => {
        expect(isRelatedToVoiceBroadcast(mkRelatedEvent(room, RelationType.Reference, undefined, client), client)).toBe(
            false,
        );
    });

    it("should return false if related (referenireplace) to a broadcast event", () => {
        expect(
            isRelatedToVoiceBroadcast(mkRelatedEvent(room, RelationType.Replace, broadcastEvent, client), client),
        ).toBe(false);
    });

    it("should return false if the event has no relation", () => {
        const noRelationEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: room.roomId,
            content: {},
            user: client.getSafeUserId(),
        });
        expect(isRelatedToVoiceBroadcast(noRelationEvent, client)).toBe(false);
    });

    it("should return false for an unknown room", () => {
        const otherRoom = new Room("!other:example.com", client, client.getSafeUserId());
        expect(
            isRelatedToVoiceBroadcast(
                mkRelatedEvent(otherRoom, RelationType.Reference, broadcastEvent, client),
                client,
            ),
        ).toBe(false);
    });
});
