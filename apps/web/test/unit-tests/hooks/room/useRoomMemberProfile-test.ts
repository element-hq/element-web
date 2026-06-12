/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { RoomMember } from "matrix-js-sdk/src/matrix";

import { resolveRoomMemberProfile, roomMemberToMemberInfo } from "../../../../src/hooks/room/useRoomMemberProfile";
import { TimelineRenderingType } from "../../../../src/contexts/RoomContext";

describe("resolveRoomMemberProfile", () => {
    it("prefers the current room member when current profiles are enabled", () => {
        const roomId = "!room:server";
        const userId = "@alice:server";
        const currentMember = new RoomMember(roomId, userId);
        currentMember.rawDisplayName = "Alan (away)";
        currentMember.disambiguate = false;
        const historicalMember = new RoomMember(roomId, userId);
        historicalMember.rawDisplayName = "Alan";
        historicalMember.disambiguate = false;
        const room = {
            getMember: jest.fn().mockReturnValue(currentMember),
        };

        const resolved = resolveRoomMemberProfile({
            room,
            userId,
            member: historicalMember,
            useOnlyCurrentProfiles: true,
            timelineRenderingType: TimelineRenderingType.Room,
        });

        expect(resolved).toBe(currentMember);
    });

    it("falls back to the historical member when current profiles are disabled", () => {
        const roomId = "!room:server";
        const userId = "@alice:server";
        const historicalMember = new RoomMember(roomId, userId);
        historicalMember.rawDisplayName = "Alan";
        historicalMember.disambiguate = false;

        const resolved = resolveRoomMemberProfile({
            room: {
                getMember: jest.fn(),
            },
            userId,
            member: historicalMember,
            useOnlyCurrentProfiles: false,
            timelineRenderingType: TimelineRenderingType.Room,
        });

        expect(resolved).toBe(historicalMember);
    });
});

describe("roomMemberToMemberInfo", () => {
    it("converts a room member into plain render data", () => {
        const member = new RoomMember("!room:server", "@alice:server");
        member.rawDisplayName = "Alan";
        member.disambiguate = true;

        expect(roomMemberToMemberInfo(member)).toEqual({
            userId: "@alice:server",
            roomId: "!room:server",
            rawDisplayName: "Alan",
            disambiguate: true,
        });
    });

    it("returns null for missing members", () => {
        expect(roomMemberToMemberInfo(null)).toBeNull();
    });
});
