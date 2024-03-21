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

import { mocked } from "jest-mock";
import { EventType, MatrixClient, MatrixEvent, MatrixEventEvent, RelationType, Room } from "matrix-js-sdk/src/matrix";

import { RelationsHelper, RelationsHelperEvent } from "../../src/events/RelationsHelper";
import { mkEvent, stubClient } from "../test-utils";

describe("RelationsHelper", () => {
    const roomId = "!room:example.com";
    let event: MatrixEvent;
    let relatedEvent1: MatrixEvent;
    let relatedEvent2: MatrixEvent;
    let relatedEvent3: MatrixEvent;
    let room: Room;
    let client: MatrixClient;
    let relationsHelper: RelationsHelper;
    let onAdd: (event: MatrixEvent) => void;

    beforeEach(() => {
        client = stubClient();
        mocked(client.relations).mockClear();
        room = new Room(roomId, client, client.getSafeUserId());
        mocked(client.getRoom).mockImplementation((getRoomId?: string): Room | null => {
            if (getRoomId === roomId) return room;
            return null;
        });
        event = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getSafeUserId(),
            content: {},
        });
        relatedEvent1 = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getSafeUserId(),
            content: {
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: event.getId(),
                },
            },
        });
        relatedEvent2 = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getSafeUserId(),
            content: {
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: event.getId(),
                },
            },
        });
        relatedEvent3 = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getSafeUserId(),
            content: {
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: event.getId(),
                },
            },
        });
        onAdd = jest.fn();
    });

    afterEach(() => {
        relationsHelper?.destroy();
    });

    describe("when there is an event without ID", () => {
        it("should raise an error", () => {
            jest.spyOn(event, "getId").mockReturnValue(undefined);

            expect(() => {
                new RelationsHelper(event, RelationType.Reference, EventType.RoomMessage, client);
            }).toThrow("unable to create RelationsHelper: missing event ID");
        });
    });

    describe("when there is an event without room ID", () => {
        it("should raise an error", () => {
            jest.spyOn(event, "getRoomId").mockReturnValue(undefined);

            expect(() => {
                new RelationsHelper(event, RelationType.Reference, EventType.RoomMessage, client);
            }).toThrow("unable to create RelationsHelper: missing room ID");
        });
    });

    describe("when there is an event without relations", () => {
        beforeEach(() => {
            relationsHelper = new RelationsHelper(event, RelationType.Reference, EventType.RoomMessage, client);
            relationsHelper.on(RelationsHelperEvent.Add, onAdd);
        });

        describe("emitCurrent", () => {
            beforeEach(() => {
                relationsHelper.emitCurrent();
            });

            it("should not emit any event", () => {
                expect(onAdd).not.toHaveBeenCalled();
            });
        });

        describe("and a new event appears", () => {
            beforeEach(() => {
                room.relations.aggregateChildEvent(relatedEvent2);
                event.emit(MatrixEventEvent.RelationsCreated, RelationType.Reference, EventType.RoomMessage);
            });

            it("should emit the new event", () => {
                expect(onAdd).toHaveBeenCalledWith(relatedEvent2);
            });
        });
    });

    describe("when there is an event with two pages server side relations", () => {
        beforeEach(() => {
            mocked(client.relations)
                .mockResolvedValueOnce({
                    events: [relatedEvent1, relatedEvent2],
                    nextBatch: "next",
                })
                .mockResolvedValueOnce({
                    events: [relatedEvent3],
                    nextBatch: null,
                });
            relationsHelper = new RelationsHelper(event, RelationType.Reference, EventType.RoomMessage, client);
            relationsHelper.on(RelationsHelperEvent.Add, onAdd);
        });

        describe("emitFetchCurrent", () => {
            beforeEach(async () => {
                await relationsHelper.emitFetchCurrent();
            });

            it("should emit the server side events", () => {
                expect(onAdd).toHaveBeenCalledWith(relatedEvent1);
                expect(onAdd).toHaveBeenCalledWith(relatedEvent2);
                expect(onAdd).toHaveBeenCalledWith(relatedEvent3);
            });
        });
    });

    describe("when there is an event with relations", () => {
        beforeEach(() => {
            room.relations.aggregateChildEvent(relatedEvent1);
            relationsHelper = new RelationsHelper(event, RelationType.Reference, EventType.RoomMessage, client);
            relationsHelper.on(RelationsHelperEvent.Add, onAdd);
        });

        describe("emitCurrent", () => {
            beforeEach(() => {
                relationsHelper.emitCurrent();
            });

            it("should emit the related event", () => {
                expect(onAdd).toHaveBeenCalledWith(relatedEvent1);
            });
        });

        describe("and a new event appears", () => {
            beforeEach(() => {
                room.relations.aggregateChildEvent(relatedEvent2);
                event.emit(MatrixEventEvent.RelationsCreated, RelationType.Reference, EventType.RoomMessage);
            });

            it("should emit the new event", () => {
                expect(onAdd).toHaveBeenCalledWith(relatedEvent2);
            });
        });
    });
});
