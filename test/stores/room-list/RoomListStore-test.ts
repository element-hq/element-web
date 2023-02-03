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

import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import SettingsStore from "../../../src/settings/SettingsStore";
import { ListAlgorithm, SortAlgorithm } from "../../../src/stores/room-list/algorithms/models";
import { OrderedDefaultTagIDs, RoomUpdateCause } from "../../../src/stores/room-list/models";
import RoomListStore, { RoomListStoreClass } from "../../../src/stores/room-list/RoomListStore";
import { stubClient, upsertRoomStateEvents } from "../../test-utils";

describe("RoomListStore", () => {
    const client = stubClient();
    const newRoomId = "!roomid:example.com";
    const roomNoPredecessorId = "!roomnopreid:example.com";
    const oldRoomId = "!oldroomid:example.com";
    const userId = "@user:example.com";
    const createWithPredecessor = new MatrixEvent({
        type: EventType.RoomCreate,
        sender: userId,
        room_id: newRoomId,
        content: {
            predecessor: { room_id: oldRoomId, event_id: "tombstone_event_id" },
        },
        event_id: "$create",
        state_key: "",
    });
    const createNoPredecessor = new MatrixEvent({
        type: EventType.RoomCreate,
        sender: userId,
        room_id: newRoomId,
        content: {},
        event_id: "$create",
        state_key: "",
    });
    const predecessor = new MatrixEvent({
        type: EventType.RoomPredecessor,
        sender: userId,
        room_id: newRoomId,
        content: {
            predecessor_room_id: oldRoomId,
            last_known_event_id: "tombstone_event_id",
        },
        event_id: "$pred",
        state_key: "",
    });
    const roomWithPredecessorEvent = new Room(newRoomId, client, userId, {});
    upsertRoomStateEvents(roomWithPredecessorEvent, [predecessor]);
    const roomWithCreatePredecessor = new Room(newRoomId, client, userId, {});
    upsertRoomStateEvents(roomWithCreatePredecessor, [createWithPredecessor]);
    const roomNoPredecessor = new Room(roomNoPredecessorId, client, userId, {});
    upsertRoomStateEvents(roomNoPredecessor, [createNoPredecessor]);
    const oldRoom = new Room(oldRoomId, client, userId, {});
    client.getRoom = jest.fn().mockImplementation((roomId) => {
        switch (roomId) {
            case newRoomId:
                return roomWithCreatePredecessor;
            case oldRoomId:
                return oldRoom;
            default:
                return null;
        }
    });

    beforeAll(async () => {
        await (RoomListStore.instance as RoomListStoreClass).makeReady(client);
    });

    it.each(OrderedDefaultTagIDs)("defaults to importance ordering for %s=", (tagId) => {
        expect(RoomListStore.instance.getTagSorting(tagId)).toBe(SortAlgorithm.Recent);
    });

    it.each(OrderedDefaultTagIDs)("defaults to activity ordering for %s=", (tagId) => {
        expect(RoomListStore.instance.getListOrder(tagId)).toBe(ListAlgorithm.Importance);
    });

    function createStore(): { store: RoomListStoreClass; handleRoomUpdate: jest.Mock<any, any> } {
        const fakeDispatcher = { register: jest.fn() } as unknown as MatrixDispatcher;
        const store = new RoomListStoreClass(fakeDispatcher);
        // @ts-ignore accessing private member to set client
        store.readyStore.matrixClient = client;
        const handleRoomUpdate = jest.fn();
        // @ts-ignore accessing private member to mock it
        store.algorithm.handleRoomUpdate = handleRoomUpdate;

        return { store, handleRoomUpdate };
    }

    it("Removes old room if it finds a predecessor in the create event", () => {
        // Given a store we can spy on
        const { store, handleRoomUpdate } = createStore();

        // When we tell it we joined a new room that has an old room as
        // predecessor in the create event
        const payload = {
            oldMembership: "invite",
            membership: "join",
            room: roomWithCreatePredecessor,
        };
        store.onDispatchMyMembership(payload);

        // Then the old room is removed
        expect(handleRoomUpdate).toHaveBeenCalledWith(oldRoom, RoomUpdateCause.RoomRemoved);

        // And the new room is added
        expect(handleRoomUpdate).toHaveBeenCalledWith(roomWithCreatePredecessor, RoomUpdateCause.NewRoom);
    });

    it("Does not remove old room if there is no predecessor in the create event", () => {
        // Given a store we can spy on
        const { store, handleRoomUpdate } = createStore();

        // When we tell it we joined a new room with no predecessor
        const payload = {
            oldMembership: "invite",
            membership: "join",
            room: roomNoPredecessor,
        };
        store.onDispatchMyMembership(payload);

        // Then the new room is added
        expect(handleRoomUpdate).toHaveBeenCalledWith(roomNoPredecessor, RoomUpdateCause.NewRoom);
        // And no other updates happen
        expect(handleRoomUpdate).toHaveBeenCalledTimes(1);
    });

    describe("When feature_dynamic_room_predecessors = true", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        afterEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReset();
        });

        it("Removes old room if it finds a predecessor in the m.predecessor event", () => {
            // Given a store we can spy on
            const { store, handleRoomUpdate } = createStore();

            // When we tell it we joined a new room that has an old room as
            // predecessor in the create event
            const payload = {
                oldMembership: "invite",
                membership: "join",
                room: roomWithPredecessorEvent,
            };
            store.onDispatchMyMembership(payload);

            // Then the old room is removed
            expect(handleRoomUpdate).toHaveBeenCalledWith(oldRoom, RoomUpdateCause.RoomRemoved);

            // And the new room is added
            expect(handleRoomUpdate).toHaveBeenCalledWith(roomWithPredecessorEvent, RoomUpdateCause.NewRoom);
        });
    });
});
