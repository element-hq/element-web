/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room } from "matrix-js-sdk/src/matrix";

// Populate this file with the details of your customisations when copying it.

/**
 * Determines if a room is visible in the room list or not. By default,
 * all rooms are visible. Where special handling is performed by Element,
 * those rooms will not be able to override their visibility in the room
 * list - Element will make the decision without calling this function.
 *
 * This function should be as fast as possible to avoid slowing down the
 * client.
 * @param {Room} room The room to check the visibility of.
 * @returns {boolean} True if the room should be visible, false otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isRoomVisible(room: Room): boolean {
    return true;
}

// This interface summarises all available customisation points and also marks
// them all as optional. This allows customisers to only define and export the
// customisations they need while still maintaining type safety.
export interface IRoomListCustomisations {
    isRoomVisible?: typeof isRoomVisible;
}

// A real customisation module will define and export one or more of the
// customisation points that make up the interface above.
export const RoomListCustomisations: IRoomListCustomisations = {};
