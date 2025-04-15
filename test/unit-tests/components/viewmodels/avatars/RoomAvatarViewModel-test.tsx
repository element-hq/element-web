/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { renderHook, waitFor, act } from "jest-matrix-react";
import {
    JoinRule,
    type MatrixClient,
    MatrixEvent,
    type Room,
    RoomMember,
    User,
    UserEvent,
} from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { useRoomAvatarViewModel } from "../../../../../src/components/viewmodels/avatars/RoomAvatarViewModel";
import { createTestClient, mkStubRoom } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { isPresenceEnabled } from "../../../../../src/utils/presence";
import { useDmMember } from "../../../../../src/components/views/avatars/WithPresenceIndicator";

jest.mock("../../../../../src/utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: jest.fn().mockReturnValue([]),
}));

jest.mock("../../../../../src/components/views/avatars/WithPresenceIndicator", () => ({
    useDmMember: jest.fn().mockReturnValue(null),
}));

jest.mock("../../../../../src/utils/presence", () => ({
    isPresenceEnabled: jest.fn().mockReturnValue(false),
}));

describe("RoomAvatarViewModel", () => {
    let matrixClient: MatrixClient;
    let room: Room;

    beforeEach(() => {
        matrixClient = createTestClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);

        DMRoomMap.makeShared(matrixClient);
        jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(null);
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

    describe("presence", () => {
        let user: User;

        beforeEach(() => {
            user = User.createUser("userId", matrixClient);
            const roomMember = new RoomMember(room.roomId, "userId");
            roomMember.user = user;
            mocked(useDmMember).mockReturnValue(roomMember);
            mocked(isPresenceEnabled).mockReturnValue(true);
        });

        it("should has presence set to null", () => {
            mocked(useDmMember).mockReturnValue(null);

            const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
            expect(vm.current.presence).toBe(null);
        });

        it("should has online presence", async () => {
            const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
            expect(vm.current.presence).toBe("offline");

            user.presence = "online";

            await act(() => user.emit(UserEvent.Presence, new MatrixEvent(), user));
            await waitFor(() => expect(vm.current.presence).toBe("online"));

            user.currentlyActive = true;
            user.presence = "offline";

            await act(() => user.emit(UserEvent.CurrentlyActive, new MatrixEvent(), user));
            await waitFor(() => expect(vm.current.presence).toBe("online"));
        });

        it("should has busy presence", async () => {
            user.presence = "busy";
            const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
            expect(vm.current.presence).toBe("busy");
        });

        it("should has offline presence", async () => {
            user.presence = "offline";
            const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
            expect(vm.current.presence).toBe("offline");
        });

        it("should has unavailable presence", async () => {
            user.presence = "unavailable";
            const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
            expect(vm.current.presence).toBe("unavailable");
        });

        it("should has hasDecoration to true", async () => {
            const { result: vm } = renderHook(() => useRoomAvatarViewModel(room));
            expect(vm.current.hasDecoration).toBe(true);
        });

        it("should recompute presence when room changed", async () => {
            user.presence = "busy";
            const { result: vm, rerender } = renderHook((props) => useRoomAvatarViewModel(props), {
                initialProps: room,
            });
            expect(vm.current.presence).toBe("busy");

            const otherRoom = mkStubRoom("roomId2", "roomName2", matrixClient);
            const otherMember = new RoomMember(otherRoom.roomId, "userId2");
            const otherUser = User.createUser("userId2", matrixClient);
            otherUser.presence = "online";
            otherMember.user = otherUser;
            mocked(useDmMember).mockReturnValue(otherMember);

            rerender(otherRoom);
            expect(vm.current.presence).toBe("online");
        });
    });
});
