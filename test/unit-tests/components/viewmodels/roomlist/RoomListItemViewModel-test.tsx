/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook } from "jest-matrix-react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { useRoomListItemViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListItemViewModel";
import { createTestClient, mkStubRoom, withClientContextRenderOptions } from "../../../../test-utils";
import {
    hasAccessToNotificationMenu,
    hasAccessToOptionsMenu,
} from "../../../../../src/components/viewmodels/roomlist/utils";
import { RoomNotificationState } from "../../../../../src/stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../../../src/stores/notifications/RoomNotificationStateStore";
import * as UseCallModule from "../../../../../src/hooks/useCall";

jest.mock("../../../../../src/components/viewmodels/roomlist/utils", () => ({
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(false),
    hasAccessToNotificationMenu: jest.fn().mockReturnValue(false),
}));

describe("RoomListItemViewModel", () => {
    let room: Room;

    beforeEach(() => {
        const matrixClient = createTestClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should dispatch view room action on openRoom", async () => {
        const { result: vm } = renderHook(
            () => useRoomListItemViewModel(room),
            withClientContextRenderOptions(room.client),
        );

        const fn = jest.spyOn(dispatcher, "dispatch");
        vm.current.openRoom();
        expect(fn).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: "RoomList",
            }),
        );
    });

    it("should show hover menu if user has access to options menu", async () => {
        mocked(hasAccessToOptionsMenu).mockReturnValue(true);
        const { result: vm } = renderHook(
            () => useRoomListItemViewModel(room),
            withClientContextRenderOptions(room.client),
        );
        expect(vm.current.showHoverMenu).toBe(true);
    });

    it("should show hover menu if user has access to notification menu", async () => {
        mocked(hasAccessToNotificationMenu).mockReturnValue(true);
        const { result: vm } = renderHook(
            () => useRoomListItemViewModel(room),
            withClientContextRenderOptions(room.client),
        );
        expect(vm.current.showHoverMenu).toBe(true);
    });

    it("should not show hover menu if user has an invitation notification", async () => {
        mocked(hasAccessToOptionsMenu).mockReturnValue(true);

        const notificationState = new RoomNotificationState(room, false);
        jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);
        jest.spyOn(notificationState, "invited", "get").mockReturnValue(false);

        const { result: vm } = renderHook(
            () => useRoomListItemViewModel(room),
            withClientContextRenderOptions(room.client),
        );
        expect(vm.current.showHoverMenu).toBe(true);
    });

    describe("notification", () => {
        let notificationState: RoomNotificationState;
        beforeEach(() => {
            notificationState = new RoomNotificationState(room, false);
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);
        });

        it("should show notification decoration if there is call has participant", () => {
            jest.spyOn(UseCallModule, "useParticipantCount").mockReturnValue(1);

            const { result: vm } = renderHook(
                () => useRoomListItemViewModel(room),
                withClientContextRenderOptions(room.client),
            );
            expect(vm.current.showNotificationDecoration).toBe(true);
        });

        it.each([
            {
                label: "hasAnyNotificationOrActivity",
                mock: () => jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true),
            },
            { label: "muted", mock: () => jest.spyOn(notificationState, "muted", "get").mockReturnValue(true) },
        ])("should show notification decoration if $label=true", ({ mock }) => {
            mock();
            const { result: vm } = renderHook(
                () => useRoomListItemViewModel(room),
                withClientContextRenderOptions(room.client),
            );
            expect(vm.current.showNotificationDecoration).toBe(true);
        });

        it("should be bold if there is a notification", () => {
            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);

            const { result: vm } = renderHook(
                () => useRoomListItemViewModel(room),
                withClientContextRenderOptions(room.client),
            );
            expect(vm.current.isBold).toBe(true);
        });

        it("should recompute notification state when room changes", () => {
            const newRoom = mkStubRoom("room2", "Room 2", room.client);
            const newNotificationState = new RoomNotificationState(newRoom, false);

            const { result, rerender } = renderHook((room) => useRoomListItemViewModel(room), {
                ...withClientContextRenderOptions(room.client),
                initialProps: room,
            });

            expect(result.current.showNotificationDecoration).toBe(false);

            jest.spyOn(newNotificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(newNotificationState);
            rerender(newRoom);

            expect(result.current.showNotificationDecoration).toBe(true);
        });
    });

    describe("a11yLabel", () => {
        let notificationState: RoomNotificationState;
        beforeEach(() => {
            notificationState = new RoomNotificationState(room, false);
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);
        });

        it.each([
            {
                label: "unsent message",
                mock: () => jest.spyOn(notificationState, "isUnsentMessage", "get").mockReturnValue(true),
                expected: "Open room roomName with an unsent message.",
            },
            {
                label: "invitation",
                mock: () => jest.spyOn(notificationState, "invited", "get").mockReturnValue(true),
                expected: "Open room roomName invitation.",
            },
            {
                label: "mention",
                mock: () => {
                    jest.spyOn(notificationState, "isMention", "get").mockReturnValue(true);
                    jest.spyOn(notificationState, "count", "get").mockReturnValue(3);
                },
                expected: "Open room roomName with 3 unread messages including mentions.",
            },
            {
                label: "unread",
                mock: () => {
                    jest.spyOn(notificationState, "hasUnreadCount", "get").mockReturnValue(true);
                    jest.spyOn(notificationState, "count", "get").mockReturnValue(3);
                },
                expected: "Open room roomName with 3 unread messages.",
            },
            {
                label: "default",
                expected: "Open room roomName",
            },
        ])("should return the $label label", ({ mock, expected }) => {
            mock?.();
            const { result: vm } = renderHook(
                () => useRoomListItemViewModel(room),
                withClientContextRenderOptions(room.client),
            );
            expect(vm.current.a11yLabel).toBe(expected);
        });
    });
});
