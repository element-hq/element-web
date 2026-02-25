/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { KnownMembership } from "matrix-js-sdk/src/types";

import { stubClient } from "../../../../../test-utils";
import { getMockedRooms } from "../getMockedRooms";
import { CallStore } from "../../../../../../src/stores/CallStore";
import type { Call } from "../../../../../../src/models/Call";
import { DefaultTagID } from "../../../../../../src/stores/room-list/models";
import { RoomNotificationStateStore } from "../../../../../../src/stores/notifications/RoomNotificationStateStore";
import type { RoomNotificationState } from "../../../../../../src/stores/notifications/RoomNotificationState";
import * as utils from "../../../../../../src/utils/notifications";
import { UnreadSorter } from "../../../../../../src/stores/room-list-v3/skip-list/sorters/UnreadSorter";
import { NotificationLevel } from "../../../../../../src/stores/notifications/NotificationLevel";

describe("UnreadSorter", () => {
    it("should sort correctly", () => {
        // Let's create some rooms first
        const cli = stubClient();
        const rooms = getMockedRooms(cli);

        // Let's make rooms 23, 67, 53, 5 invites
        const inviteRooms = [23, 67, 53, 5].map((i) => rooms[i]);
        for (const room of inviteRooms) {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Invite);
        }

        // Let's make rooms 66, 10, 78 have calls
        const callRooms = [66, 10, 78].map((i) => rooms[i]);
        jest.spyOn(CallStore.instance, "getCall").mockImplementation((roomId) => {
            if (callRooms.map((r) => r.roomId).includes(roomId)) {
                // We don't really care about the call object
                return true as unknown as Call;
            } else return null;
        });

        // Let's make rooms 13, 96, 40 have mentions
        const mentionRooms = [13, 96, 40].map((i) => rooms[i]);
        // Let's make 74, 62, 50, 34, 52, 61 have dots
        const dotRooms = [74, 62, 50, 34, 52, 61].map((i) => rooms[i]);
        // Let's make 12, 47 have unread count (number)
        const unreadRooms = [12, 47].map((i) => rooms[i]);
        // Let's make 98, 80, 49, 24 muted rooms
        const mutedRooms = [98, 80, 49, 24].map((i) => rooms[i]);

        jest.spyOn(RoomNotificationStateStore.instance, "getRoomState").mockImplementation((room) => {
            const isMention = mentionRooms.includes(room);
            const hasUnreadCount = unreadRooms.includes(room);
            const isActivityNotification = dotRooms.includes(room);
            const muted = mutedRooms.includes(room);
            const state = {
                isMention,
                hasUnreadCount,
                isActivityNotification,
                muted,
                level: NotificationLevel.None,
            } as unknown as RoomNotificationState;
            return state;
        });

        // Let's make 28, 25 as rooms that are marked as unread
        const markedAsUnreadRooms = [28, 25].map((i) => rooms[i]);
        jest.spyOn(utils, "getMarkedUnreadState").mockImplementation((room) => markedAsUnreadRooms.includes(room));

        // Let's make 6, 48, 76,   low priority rooms
        const lowPriorityRooms = [6, 48, 76].map((i) => rooms[i]);
        for (const room of lowPriorityRooms) {
            room.tags[DefaultTagID.LowPriority] = {};
        }

        // Now we can actually test the sorting algorithm
        const sorter = new UnreadSorter("@foobar:matrix.org");
        const sortedRoomIds = sorter.sort(rooms).map((r) => r.roomId);
        const roomIds = rooms.map((r) => r.roomId);

        // First we expect the invites to be shown: 67, 53, 23, 5
        const expectedInvites = sortedRoomIds.slice(0, 4);
        expect(expectedInvites).toEqual([roomIds[67], roomIds[53], roomIds[23], roomIds[5]]);

        // Next we expect the calls to be shown
        const expectedCalls = sortedRoomIds.slice(4, 7);
        expect(expectedCalls).toEqual([roomIds[78], roomIds[66], roomIds[10]]);

        // Next we expect the mentions
        const expectedMentions = sortedRoomIds.slice(7, 10);
        expect(expectedMentions).toEqual([roomIds[96], roomIds[40], roomIds[13]]);

        // Next we expect the rooms that have count/ or was marked as unread
        const expectedUnread = sortedRoomIds.slice(10, 14);
        expect(expectedUnread).toEqual([roomIds[47], roomIds[28], roomIds[25], roomIds[12]]);

        // Next we expect the rooms that have activity dot
        const expectedDots = sortedRoomIds.slice(14, 20);
        expect(expectedDots).toEqual([roomIds[74], roomIds[62], roomIds[61], roomIds[52], roomIds[50], roomIds[34]]);

        // The bottom 4 rooms should be muted
        const expectedMuted = sortedRoomIds.slice(96);
        expect(expectedMuted).toEqual([roomIds[98], roomIds[80], roomIds[49], roomIds[24]]);

        // The next 3 rooms from the bottom should be low priority rooms
        const expectedLowPriority = sortedRoomIds.slice(93, 96);
        expect(expectedLowPriority).toEqual([roomIds[76], roomIds[48], roomIds[6]]);
    });
});
