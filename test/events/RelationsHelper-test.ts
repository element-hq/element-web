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
import {
    EventTimelineSet,
    EventType,
    MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    RelationType,
    Room,
} from "matrix-js-sdk/src/matrix";
import { Relations } from "matrix-js-sdk/src/models/relations";
import { RelationsContainer } from "matrix-js-sdk/src/models/relations-container";

import { RelationsHelper, RelationsHelperEvent } from "../../src/events/RelationsHelper";
import { mkEvent, mkStubRoom, stubClient } from "../test-utils";

describe("RelationsHelper", () => {
    const roomId = "!room:example.com";
    let event: MatrixEvent;
    let relatedEvent1: MatrixEvent;
    let relatedEvent2: MatrixEvent;
    let room: Room;
    let client: MatrixClient;
    let relationsHelper: RelationsHelper;
    let onAdd: (event: MatrixEvent) => void;
    let timelineSet: EventTimelineSet;
    let relationsContainer: RelationsContainer;
    let relations: Relations;
    let relationsOnAdd: (event: MatrixEvent) => void;

    beforeEach(() => {
        client = stubClient();
        room = mkStubRoom(roomId, "test room", client);
        mocked(client.getRoom).mockImplementation((getRoomId: string) => {
            if (getRoomId === roomId) {
                return room;
            }
        });
        event = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getUserId(),
            content: {},
        });
        relatedEvent1 = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getUserId(),
            content: {},
        });
        relatedEvent2 = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: client.getUserId(),
            content: {},
        });
        onAdd = jest.fn();
        // TODO Michael W: create test utils, remove casts
        relationsContainer = {
            getChildEventsForEvent: jest.fn(),
        } as unknown as RelationsContainer;
        relations = {
            getRelations: jest.fn(),
            on: jest.fn().mockImplementation((type, l) => relationsOnAdd = l),
        } as unknown as Relations;
        timelineSet = {
            relations: relationsContainer,
        } as unknown as EventTimelineSet;
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

        describe("and relations are created and a new event appears", () => {
            beforeEach(() => {
                mocked(room.getUnfilteredTimelineSet).mockReturnValue(timelineSet);
                mocked(relationsContainer.getChildEventsForEvent).mockReturnValue(relations);
                mocked(relations.getRelations).mockReturnValue([relatedEvent1]);
                event.emit(MatrixEventEvent.RelationsCreated, RelationType.Reference, EventType.RoomMessage);
                relationsOnAdd(relatedEvent2);
            });

            it("should emit the new event", () => {
                expect(onAdd).toHaveBeenCalledWith(relatedEvent2);
            });
        });
    });

    describe("when there is an event with relations", () => {
        beforeEach(() => {
            mocked(room.getUnfilteredTimelineSet).mockReturnValue(timelineSet);
            mocked(relationsContainer.getChildEventsForEvent).mockReturnValue(relations);
            mocked(relations.getRelations).mockReturnValue([relatedEvent1]);
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
                relationsOnAdd(relatedEvent2);
            });

            it("should emit the new event", () => {
                expect(onAdd).toHaveBeenCalledWith(relatedEvent2);
            });
        });
    });
});
