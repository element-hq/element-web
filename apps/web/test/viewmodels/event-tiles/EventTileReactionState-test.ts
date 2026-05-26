/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent, type Relations, MsgType, RelationType } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../test-utils";
import {
    EVENT_TILE_REACTION_EVENT_TYPE,
    EVENT_TILE_REACTION_RELATION_TYPE,
    getEventTileReactionRelations,
    isEventTileReactionRelation,
    type GetRelationsForEvent,
} from "../../../src/viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";

const roomId = "!room:example.org";
const userId = "@alice:example.org";

function makeEvent(): MatrixEvent {
    return mkEvent({
        event: true,
        id: "$event",
        type: EventType.RoomMessage,
        room: roomId,
        user: userId,
        content: {
            msgtype: MsgType.Text,
            body: "Hello",
        },
    });
}

describe("EventTileReactionState", () => {
    it("gets annotation reaction relations when reactions are enabled", () => {
        const relations = {} as Relations;
        const getRelationsForEvent: jest.MockedFunction<GetRelationsForEvent> = jest.fn().mockReturnValue(relations);

        expect(
            getEventTileReactionRelations({
                mxEvent: makeEvent(),
                showReactions: true,
                getRelationsForEvent,
            }),
        ).toBe(relations);
        expect(getRelationsForEvent).toHaveBeenCalledWith(
            "$event",
            EVENT_TILE_REACTION_RELATION_TYPE,
            EVENT_TILE_REACTION_EVENT_TYPE,
        );
    });

    it("does not get relations when reactions are disabled", () => {
        const getRelationsForEvent: jest.MockedFunction<GetRelationsForEvent> = jest.fn();

        expect(
            getEventTileReactionRelations({
                mxEvent: makeEvent(),
                showReactions: false,
                getRelationsForEvent,
            }),
        ).toBeNull();
        expect(getRelationsForEvent).not.toHaveBeenCalled();
    });

    it("does not get relations without a relation lookup", () => {
        expect(
            getEventTileReactionRelations({
                mxEvent: makeEvent(),
                showReactions: true,
            }),
        ).toBeNull();
    });

    it("normalizes missing relations to null", () => {
        const getRelationsForEvent: jest.MockedFunction<GetRelationsForEvent> = jest.fn().mockReturnValue(undefined);

        expect(
            getEventTileReactionRelations({
                mxEvent: makeEvent(),
                showReactions: true,
                getRelationsForEvent,
            }),
        ).toBeNull();
    });

    it("matches reaction relation creation events", () => {
        expect(isEventTileReactionRelation(RelationType.Annotation, EventType.Reaction)).toBe(true);
    });

    it("does not match unrelated relation creation events", () => {
        expect(isEventTileReactionRelation(RelationType.Reference, EventType.RoomMessage)).toBe(false);
        expect(isEventTileReactionRelation(RelationType.Annotation, EventType.RoomMessage)).toBe(false);
    });
});
