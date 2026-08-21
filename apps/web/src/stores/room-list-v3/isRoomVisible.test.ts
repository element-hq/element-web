/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { createTestClient, mkRoom, mkSpace } from "test-utils";

import { RoomListCustomisations } from "../../customisations/RoomList";
import { isRoomVisible } from "./isRoomVisible";
import { LOCAL_ROOM_ID_PREFIX, LocalRoom } from "../../models/LocalRoom";

vi.mock("../../customisations/RoomList", () => ({
    RoomListCustomisations: {
        isRoomVisible: vi.fn(),
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
        vi.mocked(RoomListCustomisations.isRoomVisible!).mockReturnValue(false);
        const room = mkRoom(matrixClient, "test-room");
        expect(isRoomVisible(room)).toBe(false);
        expect(RoomListCustomisations.isRoomVisible!).toHaveBeenCalledWith(room);
    });

    it("should return true if visibility customisation returns true", () => {
        vi.mocked(RoomListCustomisations.isRoomVisible!).mockReturnValue(true);
        const room = mkRoom(matrixClient, "test-room");
        expect(isRoomVisible(room)).toBe(true);
        expect(RoomListCustomisations.isRoomVisible).toHaveBeenCalledWith(room);
    });
});
