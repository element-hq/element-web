/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { isRoomVisible } from "../../../../src/stores/room-list-v3/isRoomVisible";
import { createTestClient, mkSpace } from "../../../test-utils";
import { LOCAL_ROOM_ID_PREFIX, LocalRoom } from "../../../../src/models/LocalRoom";

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
});
