/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "core-js/stable/structured-clone"; // for idb access
import "fake-indexeddb/auto";

import { idbDelete, idbLoad, idbSave } from "../../../src/utils/StorageAccess";

const NONEXISTENT_TABLE = "this_is_not_a_table_we_use_ever_and_so_we_can_use_it_in_tests";
const KNOWN_TABLES = ["account", "pickleKey"];

describe("StorageAccess", () => {
    it.each(KNOWN_TABLES)("should save, load, and delete from known table '%s'", async (tableName: string) => {
        const key = ["a", "b"];
        const data = { hello: "world" };

        // Should start undefined
        let loaded = await idbLoad(tableName, key);
        expect(loaded).toBeUndefined();

        // ... then define a value
        await idbSave(tableName, key, data);

        // ... then check that value
        loaded = await idbLoad(tableName, key);
        expect(loaded).toEqual(data);

        // ... then set it back to undefined
        await idbDelete(tableName, key);

        // ... which we then check again
        loaded = await idbLoad(tableName, key);
        expect(loaded).toBeUndefined();
    });

    it("should fail to save, load, and delete from a non-existent table", async () => {
        // Regardless of validity on the key/data, or write order, these should all fail.
        await expect(() => idbSave(NONEXISTENT_TABLE, "whatever", "value")).rejects.toThrow();
        await expect(() => idbLoad(NONEXISTENT_TABLE, "whatever")).rejects.toThrow();
        await expect(() => idbDelete(NONEXISTENT_TABLE, "whatever")).rejects.toThrow();
    });
});
