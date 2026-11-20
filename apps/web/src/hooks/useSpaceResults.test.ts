/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type HierarchyRoom, type MatrixClient, type Room, RoomType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { renderHook, waitFor } from "test-utils-rtl";
import { mkStubRoom, stubClient } from "test-utils";

import { useSpaceResults } from "./useSpaceResults";

const { hierarchy } = vi.hoisted(() => ({ hierarchy: { rooms: [] as HierarchyRoom[] } }));

// Loads every room in `hierarchy.rooms` in a single page
vi.mock("matrix-js-sdk/src/room-hierarchy", () => ({
    RoomHierarchy: class {
        public canLoadMore = true;
        public loading = false;
        public rooms?: HierarchyRoom[];
        public constructor(public readonly root: Room) {}
        public async load(): Promise<void> {
            this.canLoadMore = false;
            this.rooms = hierarchy.rooms;
        }
    },
}));

function mkHierarchyRoom(roomId: string, fields: Partial<HierarchyRoom>): HierarchyRoom {
    return {
        room_id: roomId,
        num_joined_members: 1,
        world_readable: false,
        guest_can_join: false,
        ...fields,
    } as HierarchyRoom;
}

describe("useSpaceResults", () => {
    let client: MatrixClient;
    let space: Room;

    beforeEach(() => {
        client = stubClient();
        // The stub client otherwise returns a joined room for any ID, which would hide every result
        vi.mocked(client.getRoom).mockReturnValue(null);
        space = mkStubRoom("!space:example.org", "Space", client);
    });

    function renderResultIds(query: string): () => string[] {
        const { result } = renderHook(() => useSpaceResults(space, query));
        return () => result.current[0].map((room) => room.room_id);
    }

    it("should list rooms containing the whole query before rooms containing only its words", async () => {
        hierarchy.rooms = [
            mkHierarchyRoom("!words:example.org", { name: "Updates for the Team" }),
            mkHierarchyRoom("!phrase:example.org", { name: "Team Updates" }),
            mkHierarchyRoom("!unrelated:example.org", { name: "Random" }),
        ];

        const resultIds = renderResultIds("team updates");
        await waitFor(() => expect(resultIds()).toEqual(["!phrase:example.org", "!words:example.org"]));
    });

    it("should leave out spaces and rooms the user has already joined", async () => {
        const joinedRoom = mkStubRoom("!joined:example.org", "Team Updates", client);
        vi.mocked(joinedRoom.getMyMembership).mockReturnValue(KnownMembership.Join);
        vi.mocked(client.getRoom).mockImplementation((roomId) => (roomId === joinedRoom.roomId ? joinedRoom : null));
        hierarchy.rooms = [
            mkHierarchyRoom("!joined:example.org", { name: "Team Updates" }),
            mkHierarchyRoom("!subspace:example.org", { name: "Team Updates", room_type: RoomType.Space }),
            mkHierarchyRoom("!room:example.org", { name: "Team Updates" }),
        ];

        const resultIds = renderResultIds("team updates");
        await waitFor(() => expect(resultIds()).toEqual(["!room:example.org"]));
    });

    it("should match room aliases ignoring case", async () => {
        hierarchy.rooms = [
            mkHierarchyRoom("!alias:example.org", { name: "Meetings", canonical_alias: "#Weekly-Sync:example.org" }),
        ];

        const resultIds = renderResultIds("#weekly-sync");
        await waitFor(() => expect(resultIds()).toEqual(["!alias:example.org"]));
    });
});
