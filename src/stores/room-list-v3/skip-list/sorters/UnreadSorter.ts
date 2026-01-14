/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { KnownMembership, RoomType, type Room } from "matrix-js-sdk/src/matrix";

import { type Sorter, SortingAlgorithm } from ".";
import { RoomNotificationStateStore } from "../../../notifications/RoomNotificationStateStore";
import { DefaultTagID } from "../../../room-list/models";
import { CallStore } from "../../../CallStore";
import { getMarkedUnreadState } from "../../../../utils/notifications";
import { BaseRecencySorter } from "./BaseRecencySorter";

/**
 * Similar to RecencySorter but with the following special order:
 * Invites -> Calls (new and ongoing) -> Mentions (@) -> Count ([1])/ Marked as unread -> Activity (dot) -> None -> Low Priority -> Mute
 */
export class UnreadSorter extends BaseRecencySorter implements Sorter {
    public get type(): SortingAlgorithm.Recency {
        return SortingAlgorithm.Recency;
    }

    protected getScore(room: Room): number {
        // Invites first
        if (room.getMyMembership() === KnownMembership.Invite) return 100;

        // Then rooms that have calls (but not video rooms)
        const roomType = room.getType();
        const isVideoRoom = roomType === RoomType.UnstableCall || roomType === RoomType.ElementVideo;
        if (!isVideoRoom && !!CallStore.instance.getCall(room.roomId)) return 101;

        const roomNotificationState = RoomNotificationStateStore.instance.getRoomState(room);
        // Then mentions
        if (roomNotificationState.isMention) return 102;

        // Then rooms that have a count or was marked as unread
        if (roomNotificationState.hasUnreadCount || !!getMarkedUnreadState(room)) return 103;

        // Then rooms that have a dot
        if (roomNotificationState.isActivityNotification) return 104;

        // Then all other non special rooms, see last return

        // Then low priority rooms
        if (!!room.tags[DefaultTagID.LowPriority]) return 106;

        // Muted rooms at the bottom
        if (roomNotificationState.muted) return 107;

        return 105;
    }
}
