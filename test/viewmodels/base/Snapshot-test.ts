/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Snapshot } from "../../../src/viewmodels/base/Snapshot";

interface TestSnapshot {
    key1: string;
    key2: number;
    key3: boolean;
}

describe("Snapshot", () => {
    it("should accept an initial value", () => {
        const snapshot = new Snapshot<TestSnapshot>({ key1: "foo", key2: 5, key3: false }, jest.fn());
        expect(snapshot.current).toStrictEqual({ key1: "foo", key2: 5, key3: false });
    });

    it("should call emit callback when state changes", () => {
        const emit = jest.fn();
        const snapshot = new Snapshot<TestSnapshot>({ key1: "foo", key2: 5, key3: false }, emit);
        snapshot.merge({ key3: true });
        expect(emit).toHaveBeenCalledTimes(1);
    });

    it("should swap out entire snapshot on set call", () => {
        const snapshot = new Snapshot<TestSnapshot>({ key1: "foo", key2: 5, key3: false }, jest.fn());
        const newValue = { key1: "bar", key2: 8, key3: true };
        snapshot.set(newValue);
        expect(snapshot.current).toStrictEqual(newValue);
    });

    it("should merge partial snapshot on merge call", () => {
        const snapshot = new Snapshot<TestSnapshot>({ key1: "foo", key2: 5, key3: false }, jest.fn());
        snapshot.merge({ key2: 10 });
        expect(snapshot.current).toStrictEqual({ key1: "foo", key2: 10, key3: false });
    });
});
