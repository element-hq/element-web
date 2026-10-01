/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, type Mocked, type MockedClass } from "vitest";
import { TestSDKContext } from "test-utils";

import { MultiRoomViewStore } from "./MultiRoomViewStore";
import { RoomViewStore } from "./RoomViewStore";
import { Action } from "../dispatcher/actions";
import type { MatrixDispatcher } from "../dispatcher/dispatcher";

vi.mock("./RoomViewStore");

describe("MultiRoomViewStore", () => {
    let multiRoomViewStore: MultiRoomViewStore;
    let mockDispatcher: MatrixDispatcher;
    let mockSdkContext: TestSDKContext;
    let mockRoomViewStore: Mocked<RoomViewStore>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock dispatcher
        mockDispatcher = {
            dispatch: vi.fn(),
            register: vi.fn(),
            unregister: vi.fn(),
        } as unknown as MatrixDispatcher;

        // Create mock SDK context
        mockSdkContext = new TestSDKContext();

        // Create mock RoomViewStore instance
        mockRoomViewStore = {
            viewRoom: vi.fn(),
            dispose: vi.fn(),
        } as any;

        (RoomViewStore as MockedClass<typeof RoomViewStore>).mockImplementation(function () {
            return mockRoomViewStore as any;
        });

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

            vi.clearAllMocks();

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
            vi.clearAllMocks();
            (RoomViewStore as MockedClass<typeof RoomViewStore>).mockImplementation(function () {
                return mockRoomViewStore as any;
            });

            multiRoomViewStore.getRoomViewStoreForRoom(roomId);
            expect(RoomViewStore).toHaveBeenCalledWith(mockDispatcher, mockSdkContext, roomId);
        });
    });
});
