/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type Room } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../../../src/settings/SettingsStore";
import { FILTER_CHANGED } from "../../../../../src/stores/room-list/filters/IFilterCondition";
import { SpaceFilterCondition } from "../../../../../src/stores/room-list/filters/SpaceFilterCondition";
import { MetaSpace, type SpaceKey } from "../../../../../src/stores/spaces";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";

jest.mock("../../../../../src/settings/SettingsStore");
jest.mock("../../../../../src/stores/spaces/SpaceStore", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const EventEmitter = require("events");
    class MockSpaceStore extends EventEmitter {
        isRoomInSpace = jest.fn();
        getSpaceFilteredUserIds = jest.fn().mockReturnValue(new Set<string>([]));
        getSpaceFilteredRoomIds = jest.fn().mockReturnValue(new Set<string>([]));
    }
    return { instance: new MockSpaceStore() };
});

const SettingsStoreMock = mocked(SettingsStore);
const SpaceStoreInstanceMock = mocked(SpaceStore.instance);

jest.useFakeTimers();

describe("SpaceFilterCondition", () => {
    const space1 = "!space1:server";
    const space2 = "!space2:server";
    const room1Id = "!r1:server";
    const room2Id = "!r2:server";
    const room3Id = "!r3:server";
    const user1Id = "@u1:server";
    const user2Id = "@u2:server";
    const user3Id = "@u3:server";
    const makeMockGetValue =
        (settings: Record<string, any> = {}) =>
        (settingName: string, space: SpaceKey) =>
            settings[settingName]?.[space] || false;

    beforeEach(() => {
        jest.resetAllMocks();
        SettingsStoreMock.getValue.mockClear().mockImplementation(makeMockGetValue());
        SpaceStoreInstanceMock.getSpaceFilteredUserIds.mockReturnValue(new Set([]));
        SpaceStoreInstanceMock.isRoomInSpace.mockReturnValue(true);
    });

    const initFilter = (space: SpaceKey): SpaceFilterCondition => {
        const filter = new SpaceFilterCondition();
        filter.updateSpace(space);
        jest.runOnlyPendingTimers();
        return filter;
    };

    describe("isVisible", () => {
        const room1 = { roomId: room1Id } as unknown as Room;
        it("calls isRoomInSpace correctly", () => {
            const filter = initFilter(space1);

            expect(filter.isVisible(room1)).toEqual(true);
            expect(SpaceStoreInstanceMock.isRoomInSpace).toHaveBeenCalledWith(space1, room1Id);
        });
    });

    describe("onStoreUpdate", () => {
        it("emits filter changed event when updateSpace is called even without changes", async () => {
            const filter = new SpaceFilterCondition();
            const emitSpy = jest.spyOn(filter, "emit");
            filter.updateSpace(space1);
            jest.runOnlyPendingTimers();
            expect(emitSpy).toHaveBeenCalledWith(FILTER_CHANGED);
        });

        describe("showPeopleInSpace setting", () => {
            it("emits filter changed event when setting changes", async () => {
                // init filter with setting true for space1
                SettingsStoreMock.getValue.mockImplementation(
                    makeMockGetValue({
                        ["Spaces.showPeopleInSpace"]: { [space1]: true },
                    }),
                );
                const filter = initFilter(space1);
                const emitSpy = jest.spyOn(filter, "emit");

                SettingsStoreMock.getValue.mockClear().mockImplementation(
                    makeMockGetValue({
                        ["Spaces.showPeopleInSpace"]: { [space1]: false },
                    }),
                );

                SpaceStoreInstanceMock.emit(space1);
                jest.runOnlyPendingTimers();
                expect(emitSpy).toHaveBeenCalledWith(FILTER_CHANGED);
            });

            it("emits filter changed event when setting is false and space changes to a meta space", async () => {
                // init filter with setting true for space1
                SettingsStoreMock.getValue.mockImplementation(
                    makeMockGetValue({
                        ["Spaces.showPeopleInSpace"]: { [space1]: false },
                    }),
                );
                const filter = initFilter(space1);
                const emitSpy = jest.spyOn(filter, "emit");

                filter.updateSpace(MetaSpace.Home);
                jest.runOnlyPendingTimers();
                expect(emitSpy).toHaveBeenCalledWith(FILTER_CHANGED);
            });
        });

        it("does not emit filter changed event on store update when nothing changed", async () => {
            const filter = initFilter(space1);
            const emitSpy = jest.spyOn(filter, "emit");
            SpaceStoreInstanceMock.emit(space1);
            jest.runOnlyPendingTimers();
            expect(emitSpy).not.toHaveBeenCalledWith(FILTER_CHANGED);
        });

        it("removes listener when updateSpace is called", async () => {
            const filter = initFilter(space1);
            filter.updateSpace(space2);
            jest.runOnlyPendingTimers();
            const emitSpy = jest.spyOn(filter, "emit");

            // update mock so filter would emit change if it was listening to space1
            SpaceStoreInstanceMock.getSpaceFilteredRoomIds.mockReturnValue(new Set([room1Id]));
            SpaceStoreInstanceMock.emit(space1);
            jest.runOnlyPendingTimers();
            // no filter changed event
            expect(emitSpy).not.toHaveBeenCalledWith(FILTER_CHANGED);
        });

        it("removes listener when destroy is called", async () => {
            const filter = initFilter(space1);
            filter.destroy();
            jest.runOnlyPendingTimers();
            const emitSpy = jest.spyOn(filter, "emit");

            // update mock so filter would emit change if it was listening to space1
            SpaceStoreInstanceMock.getSpaceFilteredRoomIds.mockReturnValue(new Set([room1Id]));
            SpaceStoreInstanceMock.emit(space1);
            jest.runOnlyPendingTimers();
            // no filter changed event
            expect(emitSpy).not.toHaveBeenCalledWith(FILTER_CHANGED);
        });

        describe("when directChildRoomIds change", () => {
            beforeEach(() => {
                SpaceStoreInstanceMock.getSpaceFilteredRoomIds.mockReturnValue(new Set([room1Id, room2Id]));
            });
            const filterChangedCases = [
                ["room added", [room1Id, room2Id, room3Id]],
                ["room removed", [room1Id]],
                ["room swapped", [room1Id, room3Id]], // same number of rooms with changes
            ];

            it.each(filterChangedCases)("%s", (_d, rooms) => {
                const filter = initFilter(space1);
                const emitSpy = jest.spyOn(filter, "emit");

                SpaceStoreInstanceMock.getSpaceFilteredRoomIds.mockReturnValue(new Set(rooms));
                SpaceStoreInstanceMock.emit(space1);
                jest.runOnlyPendingTimers();
                expect(emitSpy).toHaveBeenCalledWith(FILTER_CHANGED);
            });
        });

        describe("when user ids change", () => {
            beforeEach(() => {
                SpaceStoreInstanceMock.getSpaceFilteredUserIds.mockReturnValue(new Set([user1Id, user2Id]));
            });
            const filterChangedCases = [
                ["user added", [user1Id, user2Id, user3Id]],
                ["user removed", [user1Id]],
                ["user swapped", [user1Id, user3Id]], // same number of rooms with changes
            ];

            it.each(filterChangedCases)("%s", (_d, rooms) => {
                const filter = initFilter(space1);
                const emitSpy = jest.spyOn(filter, "emit");

                SpaceStoreInstanceMock.getSpaceFilteredUserIds.mockReturnValue(new Set(rooms));
                SpaceStoreInstanceMock.emit(space1);
                jest.runOnlyPendingTimers();
                expect(emitSpy).toHaveBeenCalledWith(FILTER_CHANGED);
            });
        });
    });
});
