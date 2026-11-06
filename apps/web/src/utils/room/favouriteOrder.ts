/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";

import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";

/**
 * Get the position the user gave a favourite room, from the `order` of its `m.favourite` tag.
 * The spec defines it as a number between 0 and 1, lower first.
 * @returns the order, or undefined if the room is not a favourite or has no valid order.
 */
export function getFavouriteOrder(room: Room): number | undefined {
    const order = room.tags[DefaultTagID.Favourite]?.order;
    return typeof order === "number" && Number.isFinite(order) ? order : undefined;
}

/**
 * Compare two favourite rooms by the position the user gave them: a room with an order comes before
 * one without, and two rooms without an order are left for the caller to sort.
 * @returns a negative number if `roomA` comes first, a positive one if `roomB` does, 0 if undecided.
 */
export function compareFavouriteOrder(roomA: Room, roomB: Room): number {
    const orderA = getFavouriteOrder(roomA);
    const orderB = getFavouriteOrder(roomB);
    if (orderA === undefined && orderB === undefined) return 0;
    if (orderA === undefined) return 1;
    if (orderB === undefined) return -1;
    return orderA - orderB;
}

/**
 * Work out the new `m.favourite` orders after a favourite has been moved.
 *
 * When every favourite already has an order, only the moved room gets a new one, halfway between its new
 * neighbours. Otherwise, or when the neighbours are too close for a number in between, all the favourites
 * are numbered again, evenly spread between 0 and 1, so that the list keeps the order the user sees.
 *
 * @param rooms - The favourite rooms in their new order, with the moved room already in its new position.
 * @param movedIndex - The new position of the moved room in `rooms`.
 * @returns the new order of each room whose order has to change.
 */
export function getFavouriteOrderUpdates(rooms: Room[], movedIndex: number): Map<string, number> {
    const orders = rooms.map(getFavouriteOrder);
    const othersHaveOrders = orders.every((order, index) => index === movedIndex || order !== undefined);

    if (othersHaveOrders) {
        // Rooms at either end are placed halfway to the bounds of the range, 0 and 1
        const before = movedIndex > 0 ? orders[movedIndex - 1]! : 0;
        const after = movedIndex < rooms.length - 1 ? orders[movedIndex + 1]! : 1;
        const order = (before + after) / 2;
        // The neighbours are in order and there is still a number strictly between them
        if (before < order && order < after) {
            return new Map([[rooms[movedIndex].roomId, order]]);
        }
    }

    const updates = new Map<string, number>();
    rooms.forEach((room, index) => {
        const order = (index + 1) / (rooms.length + 1);
        if (orders[index] !== order) updates.set(room.roomId, order);
    });
    return updates;
}
