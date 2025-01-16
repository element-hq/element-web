/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ConditionKind, EventType, MatrixEvent, PushRuleActionName, Room, ClientEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { NaturalAlgorithm } from "../../../../../../src/stores/room-list/algorithms/list-ordering/NaturalAlgorithm";
import { SortAlgorithm } from "../../../../../../src/stores/room-list/algorithms/models";
import { DefaultTagID, RoomUpdateCause } from "../../../../../../src/stores/room-list/models";
import { AlphabeticAlgorithm } from "../../../../../../src/stores/room-list/algorithms/tag-sorting/AlphabeticAlgorithm";
import { RecentAlgorithm } from "../../../../../../src/stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { RoomNotificationStateStore } from "../../../../../../src/stores/notifications/RoomNotificationStateStore";
import * as RoomNotifs from "../../../../../../src/RoomNotifs";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";
import { DEFAULT_PUSH_RULES, makePushRule } from "../../../../../test-utils/pushRules";
import { NotificationLevel } from "../../../../../../src/stores/notifications/NotificationLevel";

describe("NaturalAlgorithm", () => {
    const userId = "@alice:server.org";
    const tagId = DefaultTagID.Favourite;

    const makeRoom = (id: string, name: string): Room => {
        const room = new Room(id, client, userId);
        room.name = name;
        return room;
    };

    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
    });
    const roomA = makeRoom("!aaa:server.org", "Alpha");
    const roomB = makeRoom("!bbb:server.org", "Bravo");
    const roomC = makeRoom("!ccc:server.org", "Charlie");
    const roomD = makeRoom("!ddd:server.org", "Delta");
    const roomE = makeRoom("!eee:server.org", "Echo");
    const roomX = makeRoom("!xxx:server.org", "Xylophone");

    const muteRoomARule = makePushRule(roomA.roomId, {
        actions: [PushRuleActionName.DontNotify],
        conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomA.roomId }],
    });
    const muteRoomDRule = makePushRule(roomD.roomId, {
        actions: [PushRuleActionName.DontNotify],
        conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomD.roomId }],
    });
    client.pushRules = {
        global: {
            ...DEFAULT_PUSH_RULES.global,
            override: [...DEFAULT_PUSH_RULES.global!.override!, muteRoomARule, muteRoomDRule],
        },
    };

    const setupAlgorithm = (sortAlgorithm: SortAlgorithm, rooms?: Room[]) => {
        const algorithm = new NaturalAlgorithm(tagId, sortAlgorithm);
        algorithm.setRooms(rooms || [roomA, roomB, roomC]);
        return algorithm;
    };

    describe("When sortAlgorithm is alphabetical", () => {
        const sortAlgorithm = SortAlgorithm.Alphabetic;

        beforeEach(async () => {
            jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();
        });

        it("orders rooms by alpha", () => {
            const algorithm = setupAlgorithm(sortAlgorithm);

            // sorted according to alpha
            expect(algorithm.orderedRooms).toEqual([roomA, roomB, roomC]);
        });

        describe("handleRoomUpdate", () => {
            it("removes a room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);
                jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.RoomRemoved);

                expect(shouldTriggerUpdate).toBe(true);
                expect(algorithm.orderedRooms).toEqual([roomB, roomC]);
            });

            it("warns when removing a room that is not indexed", () => {
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
                expect(algorithm.orderedRooms).toEqual([roomA, roomB, roomC, roomE]);
                // only sorted within category
                expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledWith(
                    [roomA, roomB, roomC, roomE],
                    tagId,
                );
            });

            it("adds a new muted room", () => {
                const algorithm = setupAlgorithm(sortAlgorithm, [roomA, roomB, roomE]);
                jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomD, RoomUpdateCause.NewRoom);

                expect(shouldTriggerUpdate).toBe(true);
                // muted room mixed in main category
                expect(algorithm.orderedRooms).toEqual([roomA, roomB, roomD, roomE]);
                // only sorted within category
                expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledTimes(1);
            });

            it("ignores a mute change update", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);
                jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.PossibleMuteChange);

                expect(shouldTriggerUpdate).toBe(false);
                expect(AlphabeticAlgorithm.prototype.sortRooms).not.toHaveBeenCalled();
            });

            it("throws for an unhandled update cause", () => {
                const algorithm = setupAlgorithm(sortAlgorithm);

                expect(() =>
                    algorithm.handleRoomUpdate(roomA, "something unexpected" as unknown as RoomUpdateCause),
                ).toThrow("Unsupported update cause: something unexpected");
            });

            describe("time and read receipt updates", () => {
                it("handles when a room is not indexed", () => {
                    const algorithm = setupAlgorithm(sortAlgorithm);

                    const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomX, RoomUpdateCause.Timeline);

                    // for better or worse natural alg sets this to true
                    expect(shouldTriggerUpdate).toBe(true);
                    expect(algorithm.orderedRooms).toEqual([roomA, roomB, roomC]);
                });

                it("re-sorts rooms when timeline updates", () => {
                    const algorithm = setupAlgorithm(sortAlgorithm);
                    jest.spyOn(AlphabeticAlgorithm.prototype, "sortRooms").mockClear();

                    const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomA, RoomUpdateCause.Timeline);

                    expect(shouldTriggerUpdate).toBe(true);
                    expect(algorithm.orderedRooms).toEqual([roomA, roomB, roomC]);
                    // only sorted within category
                    expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledTimes(1);
                    expect(AlphabeticAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomA, roomB, roomC], tagId);
                });
            });
        });
    });

    describe("When sortAlgorithm is recent", () => {
        const sortAlgorithm = SortAlgorithm.Recent;

        // mock recent algorithm sorting
        const fakeRecentOrder = [roomC, roomA, roomB, roomD, roomE];

        beforeEach(async () => {
            // destroy roomMap so we can start fresh
            // @ts-ignore private property
            RoomNotificationStateStore.instance.roomMap = new Map<Room, RoomNotificationState>();

            jest.spyOn(RecentAlgorithm.prototype, "sortRooms")
                .mockClear()
                .mockImplementation((rooms: Room[]) =>
                    fakeRecentOrder.filter((sortedRoom) => rooms.includes(sortedRoom)),
                );

            jest.spyOn(RoomNotifs, "determineUnreadState").mockReturnValue({
                symbol: null,
                count: 0,
                level: NotificationLevel.None,
            });
        });

        it("orders rooms by recent with muted rooms to the bottom", () => {
            const algorithm = setupAlgorithm(sortAlgorithm);

            // sorted according to recent
            expect(algorithm.orderedRooms).toEqual([roomC, roomB, roomA]);
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
                // inserted according to mute then recentness
                expect(algorithm.orderedRooms).toEqual([roomC, roomB, roomE, roomA]);
                // only sorted within category, muted roomA is not resorted
                expect(RecentAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomC, roomB, roomE], tagId);
            });

            it("does not re-sort on possible mute change when room did not change effective mutedness", () => {
                const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);
                jest.spyOn(RecentAlgorithm.prototype, "sortRooms").mockClear();

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.PossibleMuteChange);

                expect(shouldTriggerUpdate).toBe(false);
                expect(RecentAlgorithm.prototype.sortRooms).not.toHaveBeenCalled();
            });

            it("re-sorts on a mute change", () => {
                const algorithm = setupAlgorithm(sortAlgorithm, [roomC, roomB, roomE, roomD, roomA]);
                jest.spyOn(RecentAlgorithm.prototype, "sortRooms").mockClear();

                // mute roomE
                const muteRoomERule = makePushRule(roomE.roomId, {
                    actions: [PushRuleActionName.DontNotify],
                    conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomE.roomId }],
                });
                const pushRulesEvent = new MatrixEvent({ type: EventType.PushRules });
                client.pushRules!.global!.override!.push(muteRoomERule);
                client.emit(ClientEvent.AccountData, pushRulesEvent);

                const shouldTriggerUpdate = algorithm.handleRoomUpdate(roomE, RoomUpdateCause.PossibleMuteChange);

                expect(shouldTriggerUpdate).toBe(true);
                expect(algorithm.orderedRooms).toEqual([
                    // unmuted, sorted by recent
                    roomC,
                    roomB,
                    // muted, sorted by recent
                    roomA,
                    roomD,
                    roomE,
                ]);
                // only sorted muted category
                expect(RecentAlgorithm.prototype.sortRooms).toHaveBeenCalledTimes(1);
                expect(RecentAlgorithm.prototype.sortRooms).toHaveBeenCalledWith([roomA, roomD, roomE], tagId);
            });
        });
    });
});
