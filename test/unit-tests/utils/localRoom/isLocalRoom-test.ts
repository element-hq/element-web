/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../src/models/LocalRoom";
import { isLocalRoom } from "../../../../src/utils/localRoom/isLocalRoom";
import { createTestClient } from "../../../test-utils";

describe("isLocalRoom", () => {
    let room: Room;
    let localRoom: LocalRoom;

    beforeEach(() => {
        const client = createTestClient();
        room = new Room("!room:example.com", client, client.getUserId()!);
        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", client, client.getUserId()!);
    });

    it("should return false for a Room", () => {
        expect(isLocalRoom(room)).toBe(false);
    });

    it("should return false for a non-local room ID", () => {
        expect(isLocalRoom(room.roomId)).toBe(false);
    });

    it("should return true for LocalRoom", () => {
        expect(isLocalRoom(localRoom)).toBe(true);
    });

    it("should return true for local room ID", () => {
        expect(isLocalRoom(LOCAL_ROOM_ID_PREFIX + "test")).toBe(true);
    });
});
