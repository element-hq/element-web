/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { JoinRule, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { createTestClient, mkRoom } from "../../../test-utils";
import { DefaultTagID } from "../../../../src/stores/room-list-v3/skip-list/tag";
import { getTagsForRoom } from "../../../../src/utils/room/getTagsForRoom";

describe("getTagsForRoom", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
    });

    it("should retrieve conference tags for private, public video room and knocked room", () => {
        const videoRoomPrivate = "!videoRoomPrivate_server";
        const videoRoomPublic = "!videoRoomPublic_server";
        const videoRoomKnock = "!videoRoomKnock_server";

        const rooms: Room[] = [];
        mkRoom(client, videoRoomPrivate, rooms);
        mkRoom(client, videoRoomPublic, rooms);
        mkRoom(client, videoRoomKnock, rooms);

        mocked(client).getRoom.mockImplementation((roomId) => rooms.find((room) => room.roomId === roomId) || null);
        mocked(client).getRooms.mockImplementation(() => rooms);

        const videoRoomKnockRoom = client.getRoom(videoRoomKnock);
        (videoRoomKnockRoom!.getJoinRule as jest.Mock).mockReturnValue(JoinRule.Knock);

        const videoRoomPrivateRoom = client.getRoom(videoRoomPrivate);
        (videoRoomPrivateRoom!.getJoinRule as jest.Mock).mockReturnValue(JoinRule.Invite);

        const videoRoomPublicRoom = client.getRoom(videoRoomPublic);
        (videoRoomPublicRoom!.getJoinRule as jest.Mock).mockReturnValue(JoinRule.Public);

        [videoRoomPrivateRoom, videoRoomPublicRoom, videoRoomKnockRoom].forEach((room) => {
            (room!.isCallRoom as jest.Mock).mockReturnValue(true);
        });

        expect(getTagsForRoom(client.getRoom(videoRoomPublic)!).includes(DefaultTagID.Conference)).toBeTruthy();
        expect(getTagsForRoom(client.getRoom(videoRoomKnock)!).includes(DefaultTagID.Conference)).toBeTruthy();
        expect(getTagsForRoom(client.getRoom(videoRoomPrivate)!).includes(DefaultTagID.Conference)).toBeFalsy();
    });
});
