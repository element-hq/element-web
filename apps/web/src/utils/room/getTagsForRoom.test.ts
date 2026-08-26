/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { JoinRule, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { createTestClient, mkRoom } from "test-utils";

import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import { getTagsForRoom } from "./getTagsForRoom";
import DMRoomMap from "../DMRoomMap";

describe("getTagsForRoom", () => {
    let client: MatrixClient;
    let rooms: Room[];

    beforeEach(() => {
        client = createTestClient();
        rooms = [];

        const dmRoomMap = {
            getUserIdForRoomId: vi.fn().mockReturnValue(undefined),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);
    });

    function makeRoom(roomId: string): Room {
        mkRoom(client, roomId, rooms);
        vi.mocked(client).getRoom.mockImplementation((id) => rooms.find((r) => r.roomId === id) ?? null);
        vi.mocked(client).getRooms.mockImplementation(() => rooms);
        return client.getRoom(roomId)!;
    }

    it("should return [Invite] for a room where the user is invited", () => {
        const room = makeRoom("!invited:server");
        vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Invite);

        const tags = getTagsForRoom(room);
        expect(tags).toEqual([DefaultTagID.Invite]);
    });

    it.each([KnownMembership.Leave, KnownMembership.Ban])(
        "should return [Archived] for a room where the user has %s",
        (membership) => {
            const room = makeRoom(`!${membership.toLowerCase()}:server`);
            vi.mocked(room.getMyMembership).mockReturnValue(membership);

            const tags = getTagsForRoom(room);
            expect(tags).toEqual([DefaultTagID.Archived]);
        },
    );

    describe("joined rooms", () => {
        describe("with no user-defined tags and not a DM", () => {
            it("should return [Untagged] when the room has no tags and is not a DM", () => {
                const room = makeRoom("!plain:server");
                vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
                (room as any).tags = {};

                const tags = getTagsForRoom(room);
                expect(tags).toEqual([DefaultTagID.Untagged]);
            });
        });

        it("should return [DM] when the room is a DM", () => {
            const room = makeRoom("!dm:server");
            vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
            (room as any).tags = {};

            vi.mocked(DMRoomMap.shared().getUserIdForRoomId).mockReturnValue("@alice:server");

            const tags = getTagsForRoom(room);
            expect(tags).toContain(DefaultTagID.DM);
            expect(tags).not.toContain(DefaultTagID.Untagged);
        });

        describe("rooms with user-defined tags", () => {
            it("should return the user-defined tags", () => {
                const room = makeRoom("!tagged:server");
                vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
                (room as any).tags = { "m.favourite": {}, "u.alice": {} };

                const tags = getTagsForRoom(room);
                expect(tags).toContain("m.favourite");
                expect(tags).toContain("u.alice");
                expect(tags).not.toContain(DefaultTagID.Untagged);
            });

            it("should not check DM status when user-defined tags are already present", () => {
                const room = makeRoom("!tagged-dm:server");
                vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
                (room as any).tags = { "m.lowpriority": {} };

                // Even if the room is a DM, user-defined tags take priority
                vi.mocked(DMRoomMap.shared().getUserIdForRoomId).mockReturnValue("@alice:server");

                const tags = getTagsForRoom(room);
                expect(tags).toContain("m.lowpriority");
                expect(tags).not.toContain(DefaultTagID.DM);
            });
        });
    });

    describe("conference (call) rooms", () => {
        it.each([JoinRule.Public, JoinRule.Knock])(
            "should include Conference tag for a call room with %s join rule",
            (joinRule) => {
                const room = makeRoom(`!call:${joinRule}:server`);
                vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
                vi.mocked(room.isCallRoom).mockReturnValue(true);
                vi.mocked(room.getJoinRule).mockReturnValue(joinRule);

                const tags = getTagsForRoom(room);
                expect(tags).toContain(DefaultTagID.Conference);
            },
        );

        it.each([JoinRule.Invite, JoinRule.Private])(
            "should not include Conference tag for a call room with %s join rule",
            (joinRule) => {
                const room = makeRoom(`!call:${joinRule}:server`);
                vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
                vi.mocked(room.isCallRoom).mockReturnValue(true);
                vi.mocked(room.getJoinRule).mockReturnValue(joinRule);

                const tags = getTagsForRoom(room);
                expect(tags).not.toContain(DefaultTagID.Conference);
            },
        );

        it("should include Conference alongside Untagged for a public call room with no other tags", () => {
            const room = makeRoom("!callPublicPlain:server");
            vi.mocked(room.getMyMembership).mockReturnValue(KnownMembership.Join);
            (room as any).tags = {};
            vi.mocked(room.isCallRoom).mockReturnValue(true);
            vi.mocked(room.getJoinRule).mockReturnValue(JoinRule.Public);

            const tags = getTagsForRoom(room);
            // Conference is added to the tag list before the Untagged fallback check,
            // so tags.length is already 1 — Untagged is not appended.
            expect(tags).toContain(DefaultTagID.Conference);
            expect(tags).not.toContain(DefaultTagID.Untagged);
        });
    });
});
