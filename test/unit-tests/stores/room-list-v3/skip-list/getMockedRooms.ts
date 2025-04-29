/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { mkMessage, mkStubRoom } from "../../../../test-utils";

export function getMockedRooms(client: MatrixClient, roomCount: number = 100): Room[] {
    const rooms: Room[] = [];
    for (let i = 0; i < roomCount; ++i) {
        const roomId = `!foo${i}:matrix.org`;
        const room = mkStubRoom(roomId, `Foo Room ${i}`, client);
        const event = mkMessage({ room: roomId, user: `@foo${i}:matrix.org`, ts: i + 1, event: true });
        room.timeline.push(event);
        rooms.push(room);
    }
    return rooms;
}
