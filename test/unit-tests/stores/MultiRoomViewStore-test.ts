/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MultiRoomViewStore } from "../../../src/stores/MultiRoomViewStore";
import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import { Action } from "../../../src/dispatcher/actions";
import type { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { TestSdkContext } from "../TestSdkContext";

jest.mock("../../../src/stores/RoomViewStore");

describe("MultiRoomViewStore", () => {
    let multiRoomViewStore: MultiRoomViewStore;
    let mockDispatcher: MatrixDispatcher;
    let mockSdkContext: TestSdkContext;
    let mockRoomViewStore: jest.Mocked<RoomViewStore>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock dispatcher
        mockDispatcher = {
            dispatch: jest.fn(),
            register: jest.fn(),
            unregister: jest.fn(),
        } as unknown as MatrixDispatcher;

        // Create mock SDK context
        mockSdkContext = new TestSdkContext();

        // Create mock RoomViewStore instance
        mockRoomViewStore = {
            viewRoom: jest.fn(),
            dispose: jest.fn(),
        } as any;

        (RoomViewStore as jest.MockedClass<typeof RoomViewStore>).mockImplementation(() => mockRoomViewStore as any);

        // Create the MultiRoomViewStore instance
        multiRoomViewStore = new MultiRoomViewStore(mockDispatcher, mockSdkContext);
    });

    describe("getRoomViewStoreForRoom", () => {
        it("should create a new RoomViewStore for a room that doesn't exist in cache", () => {
            const roomId = "!room1:example.com";

            const result = multiRoomViewStore.getRoomViewStoreForRoom(roomId);

            expect(RoomViewStore).toHaveBeenCalledWith(mockDispatcher, mockSdkContext, roomId);
            expect(mockRoomViewStore.viewRoom).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: roomId,
                metricsTrigger: undefined,
            });
            expect(result).toBe(mockRoomViewStore);
        });

        it("should return existing RoomViewStore for a room that exists in cache", () => {
            const roomId = "!room1:example.com";

            // First call creates the store
            const firstResult = multiRoomViewStore.getRoomViewStoreForRoom(roomId);

            jest.clearAllMocks();

            // Should return the same store
            const secondResult = multiRoomViewStore.getRoomViewStoreForRoom(roomId);

            expect(RoomViewStore).not.toHaveBeenCalled();
            expect(mockRoomViewStore.viewRoom).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: roomId,
                metricsTrigger: undefined,
            });
            expect(secondResult).toBe(firstResult);
            expect(secondResult).toBe(mockRoomViewStore);
        });
    });

    describe("removeRoomViewStore", () => {
        it("should remove an existing RoomViewStore from cache", () => {
            const roomId = "!room1:example.com";

            multiRoomViewStore.getRoomViewStoreForRoom(roomId);
            multiRoomViewStore.removeRoomViewStore(roomId);

            // New store should be created now
            jest.clearAllMocks();
            (RoomViewStore as jest.MockedClass<typeof RoomViewStore>).mockImplementation(
                () => mockRoomViewStore as any,
            );

            multiRoomViewStore.getRoomViewStoreForRoom(roomId);
            expect(RoomViewStore).toHaveBeenCalledWith(mockDispatcher, mockSdkContext, roomId);
        });
    });
});
