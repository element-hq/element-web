/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { RoomListCustomisations } from "../../../../src/customisations/RoomList";
import { isRoomVisible } from "../../../../src/stores/room-list-v3/isRoomVisible";
import { createTestClient, mkRoom, mkSpace } from "../../../test-utils";
import { LOCAL_ROOM_ID_PREFIX, LocalRoom } from "../../../../src/models/LocalRoom";

jest.mock("../../../../src/customisations/RoomList", () => ({
    RoomListCustomisations: {
        isRoomVisible: jest.fn(),
    },
}));

describe("isRoomVisible", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    it("should return false without room", () => {
        expect(isRoomVisible()).toBe(false);
    });

    it("should return false for a space room", () => {
        const room = mkSpace(matrixClient, "space-room");
        expect(isRoomVisible(room)).toBe(false);
    });

    it("should return false for a local room", () => {
        const room = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", createTestClient(), "@test:example.com");
        room.isSpaceRoom = () => false;

        expect(isRoomVisible(room)).toBe(false);
    });

    it("should return false if visibility customisation returns false", () => {
        mocked(RoomListCustomisations.isRoomVisible!).mockReturnValue(false);
        const room = mkRoom(matrixClient, "test-room");
        expect(isRoomVisible(room)).toBe(false);
        expect(RoomListCustomisations.isRoomVisible!).toHaveBeenCalledWith(room);
    });

    it("should return true if visibility customisation returns true", () => {
        mocked(RoomListCustomisations.isRoomVisible!).mockReturnValue(true);
        const room = mkRoom(matrixClient, "test-room");
        expect(isRoomVisible(room)).toBe(true);
        expect(RoomListCustomisations.isRoomVisible).toHaveBeenCalledWith(room);
    });
});
