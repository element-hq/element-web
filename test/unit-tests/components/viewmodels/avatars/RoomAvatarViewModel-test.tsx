/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook, waitFor } from "jest-matrix-react";
import { JoinRule, type MatrixClient, type Room, RoomMember, User } from "matrix-js-sdk/src/matrix";

import { useRoomAvatarViewModel } from "../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel";
import { createTestClient, mkStubRoom } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import * as PresenceIndicatorModule from "../../../../../src/components/views/avatars/WithPresenceIndicator";

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

    it("should has hasDecoration to false", async () => {
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.hasDecoration).toBe(false);
    });

    it("should has isVideoRoom set to true", () => {
        jest.spyOn(room, "isCallRoom").mockReturnValue(true);
        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.isVideoRoom).toBe(true);
        expect(vm.current.hasDecoration).toBe(true);
    });

    it("should has isPublic set to true", () => {
        jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Public);

        const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
        expect(vm.current.isPublic).toBe(true);
        expect(vm.current.hasDecoration).toBe(true);
    });

    it("should recompute isPublic when room changed", async () => {
        const { result: vm, rerender } = renderHook((props) => useRoomAvatarViewModel(props), { initialProps: room });
        expect(vm.current.isPublic).toBe(false);

        const publicRoom = mkStubRoom("roomId2", "roomName2", matrixClient);
        jest.spyOn(publicRoom, "getJoinRule").mockReturnValue(JoinRule.Public);
        rerender(publicRoom);

        await waitFor(() => expect(vm.current.isPublic).toBe(true));
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
