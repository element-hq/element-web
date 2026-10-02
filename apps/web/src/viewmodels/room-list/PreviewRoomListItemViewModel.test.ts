/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, afterEach } from "vitest";

import dispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { PreviewRoomListItemViewModel } from "./PreviewRoomListItemViewModel";
import { PreviewRoomAvatarData } from "./PreviewRoomAvatarData";

describe("PreviewRoomListItemViewModel", () => {
    const props = { roomId: "!room:example.org", name: "Room", avatarUrl: "mxc://example.org/avatar" };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("builds a snapshot from the room data with the menus hidden", () => {
        const vm = new PreviewRoomListItemViewModel(props);

        expect(vm.roomId).toBe(props.roomId);
        expect(vm.getSnapshot()).toMatchObject({
            id: props.roomId,
            name: props.name,
            room: { ...props, roomType: undefined },
            isBold: false,
            notification: { hasAnyNotificationOrActivity: false, count: 0 },
            showMoreOptionsMenu: false,
            showNotificationMenu: false,
            isFavourite: false,
            isLowPriority: false,
            isDm: false,
            canChangeSection: false,
        });
        // The avatar renderer tells the preview data apart from a Room by its class
        expect(vm.getSnapshot().room).toBeInstanceOf(PreviewRoomAvatarData);
    });

    it("opens the room", () => {
        const dispatchSpy = vi.spyOn(dispatcher, "dispatch");
        const vm = new PreviewRoomListItemViewModel(props);

        vm.onOpenRoom();

        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: props.roomId,
            metricsTrigger: "RoomList",
        });
    });

    it("does nothing for the actions of the hidden menus", () => {
        const dispatchSpy = vi.spyOn(dispatcher, "dispatch");
        const vm = new PreviewRoomListItemViewModel(props);
        const snapshot = vm.getSnapshot();

        vm.onMarkAsRead();
        vm.onMarkAsUnread();
        vm.onToggleFavorite();
        vm.onToggleLowPriority();
        vm.onInvite();
        vm.onCopyRoomLink();
        vm.onLeaveRoom();
        vm.onSetRoomNotifState();
        vm.onCreateSection();
        vm.onToggleSection();
        vm.onRemoveFromSection();

        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toBe(snapshot);
    });
});
