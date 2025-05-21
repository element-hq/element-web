/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook } from "jest-matrix-react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { waitFor } from "@testing-library/dom";

import { SdkContextClass } from "../../../../../src/contexts/SDKContext";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import { useRoomListNavigation } from "../../../../../src/components/viewmodels/roomlist/useRoomListNavigation";
import { Action } from "../../../../../src/dispatcher/actions";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { RoomNotificationStateStore } from "../../../../../src/stores/notifications/RoomNotificationStateStore";
import { type RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";

describe("useRoomListNavigation", () => {
    let rooms: Room[];

    beforeEach(() => {
        const matrixClient = stubClient();
        rooms = [
            mkStubRoom("room1", "Room 1", matrixClient),
            mkStubRoom("room2", "Room 2", matrixClient),
            mkStubRoom("room3", "Room 3", matrixClient),
        ];

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);
        jest.spyOn(dispatcher, "dispatch");
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should navigate to the next room based on delta", async () => {
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("room1");

        renderHook(() => useRoomListNavigation(rooms));
        dispatcher.dispatch({
            action: Action.ViewRoomDelta,
            delta: 1,
            unread: false,
        });

        await waitFor(() =>
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "room2",
                show_room_tile: true,
                metricsTrigger: "WebKeyboardShortcut",
                metricsViaKeyboard: true,
            }),
        );
    });

    it("should navigate to the previous room based on delta", async () => {
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("room2");

        renderHook(() => useRoomListNavigation(rooms));
        dispatcher.dispatch({
            action: Action.ViewRoomDelta,
            delta: -1,
            unread: false,
        });

        await waitFor(() =>
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "room1",
                show_room_tile: true,
                metricsTrigger: "WebKeyboardShortcut",
                metricsViaKeyboard: true,
            }),
        );
    });

    it("should wrap around to the first room when navigating past the last room", async () => {
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("room3");

        renderHook(() => useRoomListNavigation(rooms));
        dispatcher.dispatch({
            action: Action.ViewRoomDelta,
            delta: 1,
            unread: false,
        });

        await waitFor(() =>
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "room1",
                show_room_tile: true,
                metricsTrigger: "WebKeyboardShortcut",
                metricsViaKeyboard: true,
            }),
        );
    });

    it("should wrap around to the last room when navigating before the first room", async () => {
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("room1");

        renderHook(() => useRoomListNavigation(rooms));
        dispatcher.dispatch({
            action: Action.ViewRoomDelta,
            delta: -1,
            unread: false,
        });

        await waitFor(() =>
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "room3",
                show_room_tile: true,
                metricsTrigger: "WebKeyboardShortcut",
                metricsViaKeyboard: true,
            }),
        );
    });

    it("should filter rooms to only unread when unread=true", async () => {
        jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("room1");
        jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation(
            (room) =>
                ({
                    isUnread: room.roomId !== "room1",
                }) as RoomNotificationState,
        );

        renderHook(() => useRoomListNavigation(rooms));

        dispatcher.dispatch({
            action: Action.ViewRoomDelta,
            delta: 1,
            unread: true,
        });

        await waitFor(() =>
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "room2",
                show_room_tile: true,
                metricsTrigger: "WebKeyboardShortcut",
                metricsViaKeyboard: true,
            }),
        );
    });
});
