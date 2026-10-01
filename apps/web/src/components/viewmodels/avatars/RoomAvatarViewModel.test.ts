/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    JoinRule,
    type MatrixClient,
    MatrixEvent,
    type Room,
    RoomEvent,
    RoomMember,
    User,
} from "matrix-js-sdk/src/matrix";
import { act } from "react";
import { renderHook, waitFor } from "test-utils-rtl";
import { createTestClient, mkStubRoom } from "test-utils";

import { AvatarBadgeDecoration, useRoomAvatarViewModel } from "./RoomAvatarViewModel";
import DMRoomMap from "../../../utils/DMRoomMap";
import * as PresenceIndicatorModule from "../../views/avatars/WithPresenceIndicator";
import { DefaultTagID } from "../../../stores/room-list-v3/skip-list/tag";

vi.mock("../../../utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: vi.fn().mockReturnValue([]),
}));

describe("RoomAvatarViewModel", () => {
    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        matrixClient = createTestClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);

        DMRoomMap.makeShared(matrixClient);
        vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(undefined);

        vi.spyOn(PresenceIndicatorModule, "useDmMember").mockReturnValue(null);
        vi.spyOn(PresenceIndicatorModule, "usePresence").mockReturnValue(null);
    });

    it("should have badgeDecoration set to LowPriority", () => {
        room.tags[DefaultTagID.LowPriority] = {};
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.LowPriority);
    });

    it("should have badgeDecoration set to VideoRoom", () => {
        vi.spyOn(room, "isCallRoom").mockReturnValue(true);
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.VideoRoom);
    });

    it("should have badgeDecoration set to PublicRoom", () => {
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.PublicRoom);
    });

    it("should set badgeDecoration based on priority", () => {
        // 1. Presence has the least priority
        const user = User.createUser("userId", matrixClient);
        const roomMember = new RoomMember(room.roomId, "userId");
        roomMember.user = user;
        vi.spyOn(PresenceIndicatorModule, "useDmMember").mockReturnValue(roomMember);
        vi.spyOn(PresenceIndicatorModule, "usePresence").mockReturnValue(PresenceIndicatorModule.Presence.Online);

        const { result: vm1 } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm1.current.badgeDecoration).toBe(AvatarBadgeDecoration.Presence);

        // 2. With presence and public room, presence takes precedence
        vi.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        // Render again, it's easier than mocking the event emitter.
        const { result: vm, rerender } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.PublicRoom);

        // 3. With presence, public-room and video room, video room takes precedence
        vi.spyOn(room, "isCallRoom").mockReturnValue(true);
        rerender(room);
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.VideoRoom);

        // 4. With presence, public room, video room and low priority, low priority takes precedence
        room.tags[DefaultTagID.LowPriority] = {};
        act(() => room.emit(RoomEvent.Tags, new MatrixEvent(), room));
        rerender(room);
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.LowPriority);
    });

    it("should recompute isPublic when room changed", async () => {
        const { result: vm, rerender } = renderHook((props) => useRoomAvatarViewModel(props), { initialProps: room });
        expect(vm.current.badgeDecoration).not.toBe(AvatarBadgeDecoration.PublicRoom);

        const publicRoom = mkStubRoom("roomId2", "roomName2", matrixClient);
        vi.spyOn(publicRoom, "getJoinRule").mockReturnValue(JoinRule.Public);
        rerender(publicRoom);

        await waitFor(() => expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.PublicRoom));
    });

    it("should return presence", async () => {
        const user = User.createUser("userId", matrixClient);
        const roomMember = new RoomMember(room.roomId, "userId");
        roomMember.user = user;
        vi.spyOn(PresenceIndicatorModule, "useDmMember").mockReturnValue(roomMember);
        vi.spyOn(PresenceIndicatorModule, "usePresence").mockReturnValue(PresenceIndicatorModule.Presence.Online);

        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.presence).toBe(PresenceIndicatorModule.Presence.Online);
    });
});
