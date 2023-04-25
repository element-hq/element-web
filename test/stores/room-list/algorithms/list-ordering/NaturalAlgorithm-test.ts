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

import { Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { NaturalAlgorithm } from "../../../../../src/stores/room-list/algorithms/list-ordering/NaturalAlgorithm";
import { SortAlgorithm } from "../../../../../src/stores/room-list/algorithms/models";
import { DefaultTagID, RoomUpdateCause } from "../../../../../src/stores/room-list/models";
import { AlphabeticAlgorithm } from "../../../../../src/stores/room-list/algorithms/tag-sorting/AlphabeticAlgorithm";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";

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

                expect(shouldTriggerUpdate).toBe(true);
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
});
