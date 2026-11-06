/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";
import type { Room } from "matrix-js-sdk/src/matrix";

import { DefaultTagID } from "../../stores/room-list-v3/skip-list/tag";
import { compareFavouriteOrder, getFavouriteOrder, getFavouriteOrderUpdates } from "./favouriteOrder";

/** A favourite room with the given order, or none. */
function mkFavourite(roomId: string, order?: unknown): Room {
    return { roomId, tags: { [DefaultTagID.Favourite]: order === undefined ? {} : { order } } } as unknown as Room;
}

describe("getFavouriteOrder", () => {
    it("returns the order of the favourite tag", () => {
        expect(getFavouriteOrder(mkFavourite("!a", 0.25))).toBe(0.25);
    });

    it.each([undefined, "0.5", Number.NaN])("ignores an order of %s", (order) => {
        expect(getFavouriteOrder(mkFavourite("!a", order))).toBeUndefined();
    });

    it("returns undefined for a room that is not a favourite", () => {
        expect(getFavouriteOrder({ roomId: "!a", tags: {} } as unknown as Room)).toBeUndefined();
    });
});

describe("compareFavouriteOrder", () => {
    it("puts the lower order first", () => {
        expect(compareFavouriteOrder(mkFavourite("!a", 0.2), mkFavourite("!b", 0.6))).toBeLessThan(0);
        expect(compareFavouriteOrder(mkFavourite("!a", 0.6), mkFavourite("!b", 0.2))).toBeGreaterThan(0);
    });

    it("puts a room with an order before one without", () => {
        expect(compareFavouriteOrder(mkFavourite("!a", 0.9), mkFavourite("!b"))).toBeLessThan(0);
        expect(compareFavouriteOrder(mkFavourite("!a"), mkFavourite("!b", 0.9))).toBeGreaterThan(0);
    });

    it("leaves two rooms without an order undecided", () => {
        expect(compareFavouriteOrder(mkFavourite("!a"), mkFavourite("!b"))).toBe(0);
    });
});

describe("getFavouriteOrderUpdates", () => {
    it("only moves the room halfway between its neighbours when they all have an order", () => {
        // !c moved between !a and !b
        const rooms = [mkFavourite("!a", 0.2), mkFavourite("!c", 0.8), mkFavourite("!b", 0.4)];
        const updates = getFavouriteOrderUpdates(rooms, 1);
        expect([...updates.keys()]).toEqual(["!c"]);
        expect(updates.get("!c")).toBeCloseTo(0.3);
    });

    it("places a room moved to either end halfway to 0 or 1", () => {
        const first = [mkFavourite("!b", 0.6), mkFavourite("!a", 0.2), mkFavourite("!c", 0.8)];
        expect(getFavouriteOrderUpdates(first, 0)).toEqual(new Map([["!b", 0.1]]));

        const last = [mkFavourite("!b", 0.6), mkFavourite("!c", 0.8), mkFavourite("!a", 0.2)];
        expect(getFavouriteOrderUpdates(last, 2)).toEqual(new Map([["!a", 0.9]]));
    });

    it("numbers all the favourites again when some have no order", () => {
        const rooms = [mkFavourite("!b"), mkFavourite("!a", 0.5), mkFavourite("!c")];
        expect(getFavouriteOrderUpdates(rooms, 0)).toEqual(
            new Map([
                ["!b", 0.25],
                ["!c", 0.75],
            ]),
        );
    });

    it("numbers all the favourites again when there is no number between the neighbours", () => {
        const rooms = [mkFavourite("!a", 0.5), mkFavourite("!c", 0.9), mkFavourite("!b", 0.5)];
        expect(getFavouriteOrderUpdates(rooms, 1)).toEqual(
            new Map([
                ["!a", 0.25],
                ["!c", 0.5],
                ["!b", 0.75],
            ]),
        );
    });
});
