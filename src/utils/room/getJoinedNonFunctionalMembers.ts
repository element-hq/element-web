/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import { getFunctionalMembers } from "./getFunctionalMembers";

/**
 * Returns all room members that are non-functional (all actual room members).
 *
 * A functional user is a user that is not a real user, but a bot, assistant, etc.
 */
export const getJoinedNonFunctionalMembers = (room: Room): RoomMember[] => {
    const functionalMembers = getFunctionalMembers(room);
    return room.getJoinedMembers().filter((m) => !functionalMembers.includes(m.userId));
};
