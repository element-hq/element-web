/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { ConditionKind, MatrixEvent, PushRuleActionName, Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { RoomNotificationStateStore } from "../../../../../src/stores/notifications/RoomNotificationStateStore";
import { ImportanceAlgorithm } from "../../../../../src/stores/room-list/algorithms/list-ordering/ImportanceAlgorithm";
import { SortAlgorithm } from "../../../../../src/stores/room-list/algorithms/models";
import * as RoomNotifs from "../../../../../src/RoomNotifs";
import { DefaultTagID, RoomUpdateCause } from "../../../../../src/stores/room-list/models";
import { NotificationColor } from "../../../../../src/stores/notifications/NotificationColor";
import { AlphabeticAlgorithm } from "../../../../../src/stores/room-list/algorithms/tag-sorting/AlphabeticAlgorithm";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";
import { RecentAlgorithm } from "../../../../../src/stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { DEFAULT_PUSH_RULES, makePushRule } from "../../../../test-utils/pushRules";

describe("ImportanceAlgorithm", () => {
    const userId = "@alice:server.org";
    const tagId = DefaultTagID.Favourite;

    const makeRoom = (id: string, name: string, order?: number): Room => {
        const room = new Room(id, client, userId);
        room.name = name;
        const tagEvent = new MatrixEvent({
            type: "m.tag",
            content: {
                tags: {
                    [tagId]: {
                        order,
                    },
                },
            },
        });
        room.addTags(tagEvent);
        return room;
    };

    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
    });
    const roomA = makeRoom("!aaa:server.org", "Alpha", 2);
    const roomB = makeRoom("!bbb:server.org", "Bravo", 5);
    const roomC = makeRoom("!ccc:server.org", "Charlie", 1);
    const roomD = makeRoom("!ddd:server.org", "Delta", 4);
    const roomE = makeRoom("!eee:server.org", "Echo", 3);
    const roomX = makeRoom("!xxx:server.org", "Xylophone", 99);

    const muteRoomARule = makePushRule(roomA.roomId, {
        actions: [PushRuleActionName.DontNotify],
        conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomA.roomId }],
    });
    const muteRoomBRule = makePushRule(roomB.roomId, {
        actions: [PushRuleActionName.DontNotify],
        conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomB.roomId }],
    });
    client.pushRules = {
        global: {
            ...DEFAULT_PUSH_RULES.global,
            override: [...DEFAULT_PUSH_RULES.global.override!, muteRoomARule, muteRoomBRule],
        },
    };

    const unreadStates: Record<string, ReturnType<(typeof RoomNotifs)["determineUnreadState"]>> = {
        red: { symbol: null, count: 1, color: NotificationColor.Red },
        grey: { symbol: null, count: 1, color: NotificationColor.Grey },
        none: { symbol: null, count: 0, color: NotificationColor.None },
    };

    beforeEach(() => {
        jest.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
            symbol: null,
            count: 0,
            color: NotificationColor.None,
        });
    });

    const setupAlgorithm = (sortAlgorithm: SortAlgorithm, rooms?: Room[]) => {
        const algorithm = new ImportanceAlgorithm(tagId, sortAlgorithm);
        algorithm.setRooms(rooms || [roomA, roomB, roomC]);
        return algorithm;
    };

    describe("When sortAlgorithm is manual", () => {
        const sortAlgorithm = SortAlgorithm.Manual;
        it("orders rooms by tag order without categorizing", () => {
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState");
            const algorithm = setupAlgorithm(sortAlgorithm);

            // didn't check notif state
            expect(RoomNotificationStateStore.instance.getRoomState).not.toHaveBeenCalled();
            // sorted according to room tag order
            expect(algorithm.orderedRooms).toEqual([roomC, roomA, roomB]);
        });

        describe("handleRoomUpdate", () => {
            // XXX: This doesn't work because manual ordered rooms dont get categoryindices
            // possibly related https://github.com/vector-im/element-web/issues/25099
            it.skip("removes a room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.RoomRemoved);

                expect(shouldTriggerUpdate).toBe(true);
                expect(algorithm.orderedRooms).toEqual([roomC, roomB]);
            });

            // XXX: This doesn't work because manual ordered rooms dont get categoryindices
            it.skip("adds a new room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomD, RoomUpdateCause.NewRoom);

                expect(shouldTriggerUpdate).toBe(true);
                expect(algorithm.orderedRooms).toEqual([roomC, roomB, roomD, roomE]);
            });

            it("does nothing and returns false for a timeline update", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                const beforeRooms = algorithm.orderedRooms;
                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.Timeline);

                expect(shouldTriggerUpdate).toBe(false);
                // strict equal
                expect(algorithm.orderedRooms).toBe(beforeRooms);
            });

            it("does nothing and returns false for a read receipt update", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                const beforeRooms = algorithm.orderedRooms;
                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.ReadReceipt);

                expect(shouldTriggerUpdate).toBe(false);
                // strict equal
                expect(algorithm.orderedRooms).toBe(beforeRooms);
            });

            it("throws for an unhandle update cause", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                expect(() =>
                    algorithm.handleRoomUpdate(roomA, "something unexpected" as unknown as RoomUpdateCause),
                ).toThrow("Unsupported update cause: something unexpected");
            });
        });
    });

    describe("When sortAlgorithm is alphabetical", () => {
        const sortAlgorithm = SortAlgorithm.Alphabetic;

        beforeEach(async () => {
            // destroy roomMap so we can start fresh
            // @ts-ignore private property
            RoomNotificationStateStore.instance.roomMap = new Map<Room, RoomNotificationState>();

            jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();
            jest.spyOn(RoomNotifs, "determineUnreadState")
                .mockClear()
                .mockImplementation((room) => {
                    switch (room) {
                        // b and e have red notifs
                        case roomB:
                        case roomE:
                            return unreadStates.red;
                        // c is grey
                        case roomC:
                            return unreadStates.grey;
                        default:
                            return unreadStates.none;
                    }
                });
        });

        it("orders rooms by alpha when they have the same notif state", () => {
            jest.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
                symbol: null,
                count: 0,
                color: NotificationColor.None,
            });
            const algorithm = setupAlgorithm(sortAlgorithm);

            // sorted according to alpha
            expect(algorithm.orderedRooms).toEqual([roomA, roomB, roomC]);
        });

        it("orders rooms by notification state then alpha", () => {
            const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);

            expect(algorithm.orderedRooms).toEqual([
                // alpha within red
                roomB,
                roomE,
                // grey
                roomC,
                // alpha within none
                roomA,
                roomD,
            ]);
        });

        describe("handleRoomUpdate", () => {
            it("removes a room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);
                jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.RoomRemoved);

                expect(shouldTriggerUpdate).toBe(true);
                expect(algorithm.orderedRooms).toEqual([roomB, roomC]);
                // no re-sorting on a remove
                expect(AlphabeticAlgorithm.prototype.sortRooms).not.toHaveBeenCalled();
            });

            it("warns and returns without change when removing a room that is not indexed", () => {
                jest.spyOn(logger, "warn").mockReturnValue(undefined);
                const algorithm = setupAlgorithm(sortAlgorithm);

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomD, RoomUpdateCause.RoomRemoved);

                expect(shouldTriggerUpdate).toBe(false);
                expect(logger.warn).toHaveBeenCalledWith(`Tried to remove unknown room from ${tagId}: ${roomD.roomId}`);
            });

            it("adds a new room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);
                jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.NewRoom);

                expect(shouldTriggerUpdate).toBe(true);
                // inserted according to notif state
                expect(algorithm.orderedRooms).toEqual([roomB, roomE, roomC, roomA]);
                // only sorted within category
                expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomB, roomE], tagId);
            });

            it("throws for an unhandled update cause", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                expect(() =>
                    algorithm.handleRoomUpdate(roomA, "something unexpected" as unknown as RoomUpdateCause),
                ).toThrow("Unsupported update cause: something unexpected");
            });

            it("ignores a mute change", () => {
                // muted rooms are not pushed to the bottom when sort is alpha
                const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);
                jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.PossibleMuteChange);

                expect(shouldTriggerUpdate).toBe(false);
                // no sorting
                expect(AlphabeticAlgorithm.prototype.sortRooms).not.toHaveBeenCalled();
            });

            describe("time and read receipt updates", () => {
                it("throws for when a room is not indexed", () => {
                    const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);

                    expect(() => algorithm.handleRoomUpdate(roomX, RoomUpdateCause.Timeline)).toThrow(
                        `Room ${roomX.roomId} has no index in ${tagId}`,
                    );
                });

                it("re-sorts category when updated room has not changed category", () => {
                    const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);
                    jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                    const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.Timeline);

                    expect(shouldTriggerUpdate).toBe(true);
                    expect(algorithm.orderedRooms).toEqual([roomB, roomE, roomC, roomA, roomD]);
                    // only sorted within category
                    expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledTimes(1);
                    expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomB, roomE], tagId);
                });

                it("re-sorts category when updated room has changed category", () => {
                    const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);
                    jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                    // change roomE to unreadState.none
                    jest.spyOn(RoomNotifs, "determineUnreadState").mockImplementation((room) => {
                        switch (room) {
                            // b and e have red notifs
                            case roomB:
                                return unreadStates.red;
                            // c is grey
                            case roomC:
                                return unreadStates.grey;
                            case roomE:
                            default:
                                return unreadStates.none;
                        }
                    });
                    // @ts-ignore don't bother mocking rest of emit properties
                    roomE.emit(RoomEvent.Timeline, new MatrixEvent({ type: "whatever", room_id: roomE.roomId }));

                    const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.Timeline);

                    expect(shouldTriggerUpdate).toBe(true);
                    expect(algorithm.orderedRooms).toEqual([roomB, roomC, roomA, roomD, roomE]);

                    // only sorted within roomE's new category
                    expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledTimes(1);
                    expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomA, roomD, roomE], tagId);
                });
            });
        });
    });

    describe("When sortAlgorithm is recent", () => {
        const sortAlgorithm = SortAlgorithm.Recent;

        // mock recent algorithm sorting
        const fakeRecentOrder = [roomC, roomB, roomE, roomD, roomA];

        beforeEach(async () => {
            // destroy roomMap so we can start fresh
            // @ts-ignore private property
            RoomNotificationStateStore.instance.roomMap = new Map<Room, RoomNotificationState>();

            jest.spyOn(RecentAlgorithm.prototype, "sortRooms")
                .mockClear()
                .mockImplementation((rooms: Room[]) =>
                    fakeRecentOrder.filter((sortedRoom) => rooms.includes(sortedRoom)),
                );
            jest.spyOn(RoomNotifs, "determineUnreadState")
                .mockClear()
                .mockImplementation((room) => {
                    switch (room) {
                        // b, c and e have red notifs
                        case roomB:
                        case roomE:
                        case roomC:
                            return unreadStates.red;
                        default:
                            return unreadStates.none;
                    }
                });
        });

        it("orders rooms by recent when they have the same notif state", () => {
            jest.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
                symbol: null,
                count: 0,
                color: NotificationColor.None,
            });
            const algorithm = setupAlgorithm(sortAlgorithm);

            // sorted according to recent
            expect(algorithm.orderedRooms).toEqual([roomC, roomB, roomA]);
        });

        it("orders rooms by notification state then recent", () => {
            const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);

            expect(algorithm.orderedRooms).toEqual([
                // recent within red
                roomC,
                roomE,
                // recent within none
                roomD,
                // muted
                roomB,
                roomA,
            ]);
        });

        describe("handleRoomUpdate", () => {
            it("removes a room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);
                jest.spyOn(RecentAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.RoomRemoved);

                expect(shouldTriggerUpdate).toBe(true);
                expect(algorithm.orderedRooms).toEqual([roomC, roomB]);
                // no re-sorting on a remove
                expect(RecentAlgorithm.prototype.sortRooms).not.toHaveBeenCalled();
            });

            it("warns and returns without change when removing a room that is not indexed", () => {
                jest.spyOn(logger, "warn").mockReturnValue(undefined);
                const algorithm = setupAlgorithm(sortAlgorithm);

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomD, RoomUpdateCause.RoomRemoved);

                expect(shouldTriggerUpdate).toBe(false);
                expect(logger.warn).toHaveBeenCalledWith(`Tried to remove unknown room from ${tagId}: ${roomD.roomId}`);
            });

            it("adds a new room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);
                jest.spyOn(RecentAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.NewRoom);

                expect(shouldTriggerUpdate).toBe(true);
                // inserted according to notif state and mute
                expect(algorithm.orderedRooms).toEqual([roomC, roomE, roomB, roomA]);
                // only sorted within category
                expect(RecentAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomE, roomC], tagId);
            });

            it("re-sorts on a mute change", () => {
                const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);
                jest.spyOn(RecentAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.PossibleMuteChange);

                expect(shouldTriggerUpdate).toBe(true);
                expect(RecentAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomC, roomE], tagId);
            });
        });
    });
});
