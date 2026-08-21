/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../settings/SettingsStore";

/**
 * Find the room a known alias belongs to, skipping rooms which have been upgraded away from.
 *
 * After a room upgrade both the old and the new room can still carry the same alias in their
 * state, and the old room is usually stored first, so a plain search over every room would keep
 * resolving the alias to the room the user has left behind.
 *
 * @param client - The client whose rooms to search.
 * @param alias - The canonical or alternative alias to look for.
 * @returns The room carrying the alias, or null if none of the visible rooms does.
 */
export function findRoomByAlias(client: MatrixClient, alias: string): Room | null {
    return (
        client
            .getVisibleRooms(SettingsStore.getValue("feature_dynamic_room_predecessors"))
            .find((room) => room.getCanonicalAlias() === alias || room.getAltAliases().includes(alias)) ?? null
    );
}
