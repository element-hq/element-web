/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook, waitFor } from "jest-matrix-react";
import { JoinRule, type MatrixClient, type Room, RoomMember, User } from "matrix-js-sdk/src/matrix";

import {
    AvatarBadgeDecoration,
    useRoomAvatarViewModel,
} from "../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel";
import { createTestClient, mkStubRoom } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import * as PresenceIndicatorModule from "../../../../../src/components/views/avatars/WithPresenceIndicator";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";

jest.mock("../../../../../src/utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: jest.fn().mockReturnValue([]),
}));

describe("RoomAvatarViewModel", () => {
    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        matrixClient = createTestClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);

        jest.spyOn(PresenceIndicatorModule, "useDmMember").mockReturnValue(null);
        jest.spyOn(PresenceIndicatorModule, "usePresence").mockReturnValue(null);
    });

    it("should have badgeDecoration set to LowPriority", () => {
        room.tags[DefaultTagID.LowPriority] = {};
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.LowPriority);
    });

    it("should have badgeDecoration set to VideoRoom", () => {
        jest.spyOn(room, "isCallRoom").mockReturnValue(true);
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.VideoRoom);
    });

    it("should have badgeDecoration set to PublicRoom", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.PublicRoom);
    });

    it("should set badgeDecoration based on priority", () => {
        // 1. Presence has the least priority
        const user = User.createUser("userId", matrixClient);
        const roomMember = new RoomMember(room.roomId, "userId");
        roomMember.user = user;
        jest.spyOn(PresenceIndicatorModule, "useDmMember").mockReturnValue(roomMember);
        jest.spyOn(PresenceIndicatorModule, "usePresence").mockReturnValue(PresenceIndicatorModule.Presence.Online);

        const { result: vm1 } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm1.current.badgeDecoration).toBe(AvatarBadgeDecoration.Presence);

        // 2. With presence and public room, presence takes precedence
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);
        // Render again, it's easier than mocking the event emitter.
        const { result: vm, rerender } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.PublicRoom);

        // 3. With presence, public-room and video room, video room takes precedence
        jest.spyOn(room, "isCallRoom").mockReturnValue(true);
        rerender(room);
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.VideoRoom);

        // 4. With presence, public room, video room and low priority, low priority takes precedence
        room.tags[DefaultTagID.LowPriority] = {};
        rerender(room);
        expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.LowPriority);
    });

    it("should recompute isPublic when room changed", async () => {
        const { result: vm, rerender } = renderHook((props) => useRoomAvatarViewModel(props), { initialProps: room });
        expect(vm.current.badgeDecoration).not.toBe(AvatarBadgeDecoration.PublicRoom);

        const publicRoom = mkStubRoom("roomId2", "roomName2", matrixClient);
        jest.spyOn(publicRoom, "getJoinRule").mockReturnValue(JoinRule.Public);
        rerender(publicRoom);

        await waitFor(() => expect(vm.current.badgeDecoration).toBe(AvatarBadgeDecoration.PublicRoom));
    });

    it("should return presence", async () => {
        const user = User.createUser("userId", matrixClient);
        const roomMember = new RoomMember(room.roomId, "userId");
        roomMember.user = user;
        jest.spyOn(PresenceIndicatorModule, "useDmMember").mockReturnValue(roomMember);
        jest.spyOn(PresenceIndicatorModule, "usePresence").mockReturnValue(PresenceIndicatorModule.Presence.Online);

        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.presence).toBe(PresenceIndicatorModule.Presence.Online);
    });
});
