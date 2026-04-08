/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { RoomListSectionHeaderViewModel } from "../../../src/viewmodels/room-list/RoomListSectionHeaderViewModel";
import { RoomNotificationState } from "../../../src/stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../src/stores/notifications/RoomNotificationStateStore";
import { NotificationStateEvents } from "../../../src/stores/notifications/NotificationState";
import { createTestClient, mkRoom } from "../../test-utils";

describe("RoomListSectionHeaderViewModel", () => {
    let onToggleExpanded: jest.Mock;
    let matrixClient: MatrixClient;

    beforeEach(() => {
        onToggleExpanded = jest.fn();
        matrixClient = createTestClient();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should initialize snapshot from props", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            onToggleExpanded,
        });

        const snapshot = vm.getSnapshot();
        expect(snapshot.id).toBe("m.favourite");
        expect(snapshot.title).toBe("Favourites");
        expect(snapshot.isExpanded).toBe(true);
    });

    it("should toggle expanded state on click", () => {
        const vm = new RoomListSectionHeaderViewModel({
            tag: "m.favourite",
            title: "Favourites",
            onToggleExpanded,
        });
        expect(vm.isExpanded).toBe(true);

        vm.onClick();
        expect(vm.isExpanded).toBe(false);
        expect(vm.getSnapshot().isExpanded).toBe(false);
        expect(onToggleExpanded).toHaveBeenCalledWith(false);

        vm.onClick();
        expect(vm.isExpanded).toBe(true);
        expect(vm.getSnapshot().isExpanded).toBe(true);
        expect(onToggleExpanded).toHaveBeenCalledWith(true);
    });

    describe("unread status", () => {
        let room: Room;
        let notificationState: RoomNotificationState;

        beforeEach(() => {
            room = mkRoom(matrixClient, "!room:server");
            notificationState = new RoomNotificationState(room, false);
            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockReturnValue(notificationState);
        });

        it("should set isUnread to false when no rooms have notifications", () => {
            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(vm.getSnapshot().isUnread).toBe(false);
        });

        it("should set isUnread to true when a room has notifications", () => {
            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);

            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(vm.getSnapshot().isUnread).toBe(true);
        });

        it("should subscribe to new rooms and unsubscribe from removed rooms", () => {
            const room2 = mkRoom(matrixClient, "!room2:server");
            const notificationState2 = new RoomNotificationState(room2, false);

            jest.spyOn(RoomNotificationStateStore.instance, "getRoomState")
                .mockReturnValueOnce(notificationState)
                .mockReturnValue(notificationState2);

            jest.spyOn(notificationState, "on");
            jest.spyOn(notificationState, "off");
            jest.spyOn(notificationState2, "on");

            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(notificationState.on).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));

            vm.setRooms([room2]);

            expect(notificationState.off).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));
            expect(notificationState2.on).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));

            // Calling setRooms again with the same room should not re-subscribe
            vm.setRooms([room2]);
            expect(notificationState2.on).toHaveBeenCalledTimes(1);
        });

        it("should update isUnread when a notification state update event fires", () => {
            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            expect(vm.getSnapshot().isUnread).toBe(false);

            jest.spyOn(notificationState, "hasAnyNotificationOrActivity", "get").mockReturnValue(true);
            notificationState.emit(NotificationStateEvents.Update);

            expect(vm.getSnapshot().isUnread).toBe(true);
        });

        it("should unsubscribe from all notification states on dispose", () => {
            jest.spyOn(notificationState, "off");

            const vm = new RoomListSectionHeaderViewModel({
                tag: "m.favourite",
                title: "Favourites",
                onToggleExpanded,
            });
            vm.setRooms([room]);

            vm.dispose();
            expect(notificationState.off).toHaveBeenCalledWith(NotificationStateEvents.Update, expect.any(Function));
        });
    });
});
