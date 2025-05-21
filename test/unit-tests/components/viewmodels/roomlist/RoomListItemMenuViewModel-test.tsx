/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { mkStubRoom, stubClient, withClientContextRenderOptions } from "../../../../test-utils";
import { useRoomListItemMenuViewModel } from "../../../../../src/components/viewmodels/roomlist/RoomListItemMenuViewModel";
import {
    hasAccessToNotificationMenu,
    hasAccessToOptionsMenu,
} from "../../../../../src/components/viewmodels/roomlist/utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";
import { useUnreadNotifications } from "../../../../../src/hooks/useUnreadNotifications";
import { NotificationLevel } from "../../../../../src/stores/notifications/NotificationLevel";
import { clearRoomNotification, setMarkedUnreadState } from "../../../../../src/utils/notifications";
import { tagRoom } from "../../../../../src/utils/room/tagRoom";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { useNotificationState } from "../../../../../src/hooks/useRoomNotificationState";
import { RoomNotifState } from "../../../../../src/RoomNotifs";

jest.mock("../../../../../src/components/viewmodels/roomlist/utils", () => ({
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(false),
    hasAccessToNotificationMenu: jest.fn().mockReturnValue(false),
}));

jest.mock("../../../../../src/hooks/useUnreadNotifications", () => ({
    useUnreadNotifications: jest.fn(),
}));

jest.mock("../../../../../src/hooks/useRoomNotificationState", () => ({
    useNotificationState: jest.fn(),
}));

jest.mock("../../../../../src/utils/notifications", () => ({
    clearRoomNotification: jest.fn(),
    setMarkedUnreadState: jest.fn(),
}));

jest.mock("../../../../../src/utils/room/tagRoom", () => ({
    tagRoom: jest.fn(),
}));

describe("RoomListItemMenuViewModel", () => {
    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        matrixClient = stubClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);

        mocked(useUnreadNotifications).mockReturnValue({ symbol: null, count: 0, level: NotificationLevel.None });
        mocked(useNotificationState).mockReturnValue([RoomNotifState.AllMessages, jest.fn()]);
        jest.spyOn(dispatcher, "dispatch");
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    function render() {
        return renderHook(() => useRoomListItemMenuViewModel(room), withClientContextRenderOptions(matrixClient));
    }

    it("default", () => {
        const { result } = render();
        expect(result.current.showMoreOptionsMenu).toBe(false);
        expect(result.current.canInvite).toBe(false);
        expect(result.current.isFavourite).toBe(false);
        expect(result.current.canCopyRoomLink).toBe(true);
        expect(result.current.canMarkAsRead).toBe(false);
        expect(result.current.canMarkAsUnread).toBe(true);
    });

    it("should has showMoreOptionsMenu to be true", () => {
        mocked(hasAccessToOptionsMenu).mockReturnValue(true);
        const { result } = render();
        expect(result.current.showMoreOptionsMenu).toBe(true);
    });

    it("should has showNotificationMenu to be true", () => {
        mocked(hasAccessToNotificationMenu).mockReturnValue(true);
        const { result } = render();
        expect(result.current.showNotificationMenu).toBe(true);
    });

    it("should be able to invite", () => {
        jest.spyOn(room, "canInvite").mockReturnValue(true);
        const { result } = render();
        expect(result.current.canInvite).toBe(true);
    });

    it("should be a favourite", () => {
        room.tags = { [DefaultTagID.Favourite]: { order: 0 } };
        const { result } = render();
        expect(result.current.isFavourite).toBe(true);
    });

    it("should not be able to copy the room link", () => {
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue("userId");
        const { result } = render();
        expect(result.current.canCopyRoomLink).toBe(false);
    });

    it("should be able to mark as read", () => {
        // Add a notification
        mocked(useUnreadNotifications).mockReturnValue({
            symbol: null,
            count: 1,
            level: NotificationLevel.Notification,
        });
        const { result } = render();
        expect(result.current.canMarkAsRead).toBe(true);
        expect(result.current.canMarkAsUnread).toBe(false);
    });

    it("should has isNotificationAllMessage to be true", () => {
        const { result } = render();
        expect(result.current.isNotificationAllMessage).toBe(true);
    });

    it("should has isNotificationAllMessageLoud to be true", () => {
        mocked(useNotificationState).mockReturnValue([RoomNotifState.AllMessagesLoud, jest.fn()]);
        const { result } = render();
        expect(result.current.isNotificationAllMessageLoud).toBe(true);
    });

    it("should has isNotificationMentionOnly to be true", () => {
        mocked(useNotificationState).mockReturnValue([RoomNotifState.MentionsOnly, jest.fn()]);
        const { result } = render();
        expect(result.current.isNotificationMentionOnly).toBe(true);
    });

    it("should has isNotificationMute to be true", () => {
        mocked(useNotificationState).mockReturnValue([RoomNotifState.Mute, jest.fn()]);
        const { result } = render();
        expect(result.current.isNotificationMute).toBe(true);
    });

    // Actions

    it("should mark as read", () => {
        const { result } = render();
        result.current.markAsRead(new Event("click"));
        expect(mocked(clearRoomNotification)).toHaveBeenCalledWith(room, matrixClient);
    });

    it("should mark as unread", () => {
        const { result } = render();
        result.current.markAsUnread(new Event("click"));
        expect(mocked(setMarkedUnreadState)).toHaveBeenCalledWith(room, matrixClient, true);
    });

    it("should tag a room as favourite", () => {
        const { result } = render();
        result.current.toggleFavorite(new Event("click"));
        expect(mocked(tagRoom)).toHaveBeenCalledWith(room, DefaultTagID.Favourite);
    });

    it("should tag a room as low priority", () => {
        const { result } = render();
        result.current.toggleLowPriority();
        expect(mocked(tagRoom)).toHaveBeenCalledWith(room, DefaultTagID.LowPriority);
    });

    it("should dispatch invite action", () => {
        const { result } = render();
        result.current.invite(new Event("click"));
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: "view_invite",
            roomId: room.roomId,
        });
    });

    it("should dispatch a copy room action", () => {
        const { result } = render();
        result.current.copyRoomLink(new Event("click"));
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: "copy_room",
            room_id: room.roomId,
        });
    });

    it("should dispatch forget room action", () => {
        // forget room is only available for archived rooms
        room.tags = { [DefaultTagID.Archived]: { order: 0 } };

        const { result } = render();
        result.current.leaveRoom(new Event("click"));
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: "forget_room",
            room_id: room.roomId,
        });
    });

    it("should dispatch leave room action", () => {
        const { result } = render();
        result.current.leaveRoom(new Event("click"));
        expect(dispatcher.dispatch).toHaveBeenCalledWith({
            action: "leave_room",
            room_id: room.roomId,
        });
    });

    it("should call setRoomNotifState", () => {
        const setRoomNotifState = jest.fn();
        mocked(useNotificationState).mockReturnValue([RoomNotifState.AllMessages, setRoomNotifState]);
        const { result } = render();
        result.current.setRoomNotifState(RoomNotifState.Mute);
        expect(setRoomNotifState).toHaveBeenCalledWith(RoomNotifState.Mute);
    });
});
