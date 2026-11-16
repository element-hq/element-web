/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import { createUnregister, removeFromArray } from "./unregister";

describe("createUnregister", () => {
    it("removes the registration only on the first call", () => {
        const remove = vi.fn();
        const unregister = createUnregister(remove);

        unregister();
        unregister();

        expect(remove).toHaveBeenCalledTimes(1);
    });
});

describe("removeFromArray", () => {
    it("removes the first occurrence of the item", () => {
        const a = { id: "a" };
        const b = { id: "b" };
        const array = [a, b, a];

        removeFromArray(array, a);

        expect(array).toEqual([b, a]);
    });

    it("leaves the array alone when the item is missing", () => {
        const array = [1, 2];

        removeFromArray(array, 3);

        expect(array).toEqual([1, 2]);
    });
});
