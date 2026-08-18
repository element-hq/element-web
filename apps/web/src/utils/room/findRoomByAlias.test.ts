/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";
import { Room } from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter, mockClientMethodsUser, mkRoomCanonicalAliasEvent } from "test-utils";

import { findRoomByAlias } from "./findRoomByAlias";

describe("findRoomByAlias()", () => {
    const userId = "@alice:server.org";
    const alias = "#room:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRooms: vi.fn(),
        getVisibleRooms: vi.fn(),
    });

    const mkRoomWithAlias = (roomId: string, canonical: boolean): Room => {
        const room = new Room(roomId, client, userId);
        room.currentState.setStateEvents([mkRoomCanonicalAliasEvent(userId, roomId, canonical ? alias : "")]);
        if (!canonical) vi.spyOn(room, "getAltAliases").mockReturnValue([alias]);
        return room;
    };

    it("returns the room the alias points at", () => {
        const room = mkRoomWithAlias("!room:server.org", true);
        client.getVisibleRooms.mockReturnValue([room]);
        expect(findRoomByAlias(client, alias)).toBe(room);
    });

    it("matches an alternative alias too", () => {
        const room = mkRoomWithAlias("!room:server.org", false);
        client.getVisibleRooms.mockReturnValue([room]);
        expect(findRoomByAlias(client, alias)).toBe(room);
    });

    it("prefers the upgraded room over the predecessor which still carries the alias", () => {
        const oldRoom = mkRoomWithAlias("!old:server.org", true);
        const newRoom = mkRoomWithAlias("!new:server.org", true);
        client.getRooms.mockReturnValue([oldRoom, newRoom]);
        client.getVisibleRooms.mockReturnValue([newRoom]);
        expect(findRoomByAlias(client, alias)).toBe(newRoom);
    });

    it("returns null when no room carries the alias", () => {
        client.getVisibleRooms.mockReturnValue([mkRoomWithAlias("!room:server.org", true)]);
        expect(findRoomByAlias(client, "#other:server.org")).toBeNull();
    });
});
