/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { DefaultTagID } from "../room-list-v3/skip-list/tag";

export const OrderedDefaultTagIDs = [
    DefaultTagID.Invite,
    DefaultTagID.Favourite,
    DefaultTagID.DM,
    DefaultTagID.Conference,
    DefaultTagID.Untagged,
    DefaultTagID.LowPriority,
    DefaultTagID.ServerNotice,
    DefaultTagID.Suggested,
    DefaultTagID.Archived,
];

export enum RoomUpdateCause {
    Timeline = "TIMELINE",
    PossibleTagChange = "POSSIBLE_TAG_CHANGE",
    PossibleMuteChange = "POSSIBLE_MUTE_CHANGE",
    ReadReceipt = "READ_RECEIPT",
    NewRoom = "NEW_ROOM",
    RoomRemoved = "ROOM_REMOVED",
}
