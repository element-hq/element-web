/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Event type for room account data and room creation content used to mark rooms as virtual rooms
// (and store the ID of their native room)
export const VIRTUAL_ROOM_EVENT_TYPE = "im.vector.is_virtual_room";

export const JitsiCallMemberEventType = "io.element.video.member";

export interface JitsiCallMemberContent {
    // Connected device IDs
    devices: string[];
    // Time at which this state event should be considered stale
    expires_ts: number;
}
