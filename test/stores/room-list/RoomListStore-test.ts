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

import {
    ConditionKind,
    EventType,
    IPushRule,
    MatrixEvent,
    PendingEventOrdering,
    PushRuleActionName,
    Room,
} from "matrix-js-sdk/src/matrix";

import defaultDispatcher, { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import SettingsStore, { CallbackFn } from "../../../src/settings/SettingsStore";
import { ListAlgorithm, SortAlgorithm } from "../../../src/stores/room-list/algorithms/models";
import { OrderedDefaultTagIDs, RoomUpdateCause } from "../../../src/stores/room-list/models";
import RoomListStore, { RoomListStoreClass } from "../../../src/stores/room-list/RoomListStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { flushPromises, stubClient, upsertRoomStateEvents } from "../../test-utils";
import { DEFAULT_PUSH_RULES, makePushRule } from "../../test-utils/pushRules";

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
    const roomNoPredecessor = new Room(roomNoPredecessorId, client, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    upsertRoomStateEvents(roomNoPredecessor, [createNoPredecessor]);
    const oldRoom = new Room(oldRoomId, client, userId, {});
    const normalRoom = new Room("!normal:server.org", client, userId);
    client.getRoom = jest.fn().mockImplementation((roomId) => {
        switch (roomId) {
            case newRoomId:
                return roomWithCreatePredecessor;
            case oldRoomId:
                return oldRoom;
            case normalRoom.roomId:
                return normalRoom;
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
        expect(RoomListStore.instance.getListOrder(tagId)).toBe(ListAlgorithm.Natural);
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

    it("Lists all rooms that the client says are visible", () => {
        // Given 3 rooms that are visible according to the client
        const room1 = new Room("!r1:e.com", client, userId, { pendingEventOrdering: PendingEventOrdering.Detached });
        const room2 = new Room("!r2:e.com", client, userId, { pendingEventOrdering: PendingEventOrdering.Detached });
        const room3 = new Room("!r3:e.com", client, userId, { pendingEventOrdering: PendingEventOrdering.Detached });
        room1.updateMyMembership("join");
        room2.updateMyMembership("join");
        room3.updateMyMembership("join");
        DMRoomMap.makeShared(client);
        const { store } = createStore();
        client.getVisibleRooms = jest.fn().mockReturnValue([room1, room2, room3]);

        // When we make the list of rooms
        store.regenerateAllLists({ trigger: false });

        // Then the list contains all 3
        expect(store.orderedLists).toMatchObject({
            "im.vector.fake.recent": [room1, room2, room3],
        });

        // We asked not to use MSC3946 when we asked the client for the visible rooms
        expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        expect(client.getVisibleRooms).toHaveBeenCalledTimes(1);
    });

    it("Watches the feature flag setting", () => {
        jest.spyOn(SettingsStore, "watchSetting").mockReturnValue("dyn_pred_ref");
        jest.spyOn(SettingsStore, "unwatchSetting");

        // When we create a store
        const { store } = createStore();

        // Then we watch the feature flag
        expect(SettingsStore.watchSetting).toHaveBeenCalledWith(
            "feature_dynamic_room_predecessors",
            null,
            expect.any(Function),
        );

        // And when we unmount it
        store.componentWillUnmount();

        // Then we unwatch it.
        expect(SettingsStore.unwatchSetting).toHaveBeenCalledWith("dyn_pred_ref");
    });

    it("Regenerates all lists when the feature flag is set", () => {
        // Given a store allowing us to spy on any use of SettingsStore
        let featureFlagValue = false;
        jest.spyOn(SettingsStore, "getValue").mockImplementation(() => featureFlagValue);

        let watchCallback: CallbackFn | undefined;
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation(
            (_settingName: string, _roomId: string | null, callbackFn: CallbackFn) => {
                watchCallback = callbackFn;
                return "dyn_pred_ref";
            },
        );
        jest.spyOn(SettingsStore, "unwatchSetting");

        const { store } = createStore();
        client.getVisibleRooms = jest.fn().mockReturnValue([]);
        // Sanity: no calculation has happened yet
        expect(client.getVisibleRooms).toHaveBeenCalledTimes(0);

        // When we calculate for the first time
        store.regenerateAllLists({ trigger: false });

        // Then we use the current feature flag value (false)
        expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        expect(client.getVisibleRooms).toHaveBeenCalledTimes(1);

        // But when we update the feature flag
        featureFlagValue = true;
        watchCallback!(
            "feature_dynamic_room_predecessors",
            "",
            SettingLevel.DEFAULT,
            featureFlagValue,
            featureFlagValue,
        );

        // Then we recalculate and passed the updated value (true)
        expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
        expect(client.getVisibleRooms).toHaveBeenCalledTimes(2);
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

        it("Passes the feature flag on to the client when asking for visible rooms", () => {
            // Given a store that we can ask for a room list
            DMRoomMap.makeShared(client);
            const { store } = createStore();
            client.getVisibleRooms = jest.fn().mockReturnValue([]);

            // When we make the list of rooms
            store.regenerateAllLists({ trigger: false });

            // We asked to use MSC3946 when we asked the client for the visible rooms
            expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
            expect(client.getVisibleRooms).toHaveBeenCalledTimes(1);
        });
    });

    describe("room updates", () => {
        const makeStore = async () => {
            const store = new RoomListStoreClass(defaultDispatcher);
            await store.start();
            return store;
        };

        describe("push rules updates", () => {
            const makePushRulesEvent = (overrideRules: IPushRule[] = []): MatrixEvent => {
                return new MatrixEvent({
                    type: EventType.PushRules,
                    content: {
                        global: {
                            ...DEFAULT_PUSH_RULES.global,
                            override: overrideRules,
                        },
                    },
                });
            };

            it("triggers a room update when room mutes have changed", async () => {
                const rule = makePushRule(normalRoom.roomId, {
                    actions: [PushRuleActionName.DontNotify],
                    conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: normalRoom.roomId }],
                });
                const event = makePushRulesEvent([rule]);
                const previousEvent = makePushRulesEvent();

                const store = await makeStore();
                // @ts-ignore private property alg
                const algorithmSpy = jest.spyOn(store.algorithm, "handleRoomUpdate").mockReturnValue(undefined);
                // @ts-ignore cheat and call protected fn
                store.onAction({ action: "MatrixActions.accountData", event, previousEvent });
                // flush setImmediate
                await flushPromises();

                expect(algorithmSpy).toHaveBeenCalledWith(normalRoom, RoomUpdateCause.PossibleMuteChange);
            });

            it("handles when a muted room is unknown by the room list", async () => {
                const rule = makePushRule(normalRoom.roomId, {
                    actions: [PushRuleActionName.DontNotify],
                    conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: normalRoom.roomId }],
                });
                const unknownRoomRule = makePushRule("!unknown:server.org", {
                    conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: "!unknown:server.org" }],
                });
                const event = makePushRulesEvent([unknownRoomRule, rule]);
                const previousEvent = makePushRulesEvent();

                const store = await makeStore();
                // @ts-ignore private property alg
                const algorithmSpy = jest.spyOn(store.algorithm, "handleRoomUpdate").mockReturnValue(undefined);

                // @ts-ignore cheat and call protected fn
                store.onAction({ action: "MatrixActions.accountData", event, previousEvent });
                // flush setImmediate
                await flushPromises();

                // only one call to update made for normalRoom
                expect(algorithmSpy).toHaveBeenCalledTimes(1);
                expect(algorithmSpy).toHaveBeenCalledWith(normalRoom, RoomUpdateCause.PossibleMuteChange);
            });
        });
    });
});
