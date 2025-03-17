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
import { createTestClient, mkStubRoom } from "../../../../test-utils";
import { hasAccessToOptionsMenu } from "../../../../../src/components/viewmodels/roomlist/utils";

jest.mock("../../../../../src/components/viewmodels/roomlist/utils", () => ({
    hasAccessToOptionsMenu: jest.fn().mockReturnValue(false),
}));

describe("RoomListItemViewModel", () => {
    let room: Room;

    beforeEach(() => {
        const matrixClient = createTestClient();
        room = mkStubRoom("roomId", "roomName", matrixClient);
    });

    it("should dispatch view room action on openRoom", async () => {
        const { result: vm } = renderHook(() => useRoomListItemViewModel(room));

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
        const { result: vm } = renderHook(() => useRoomListItemViewModel(room));
        expect(vm.current.showHoverMenu).toBe(true);
    });
});
