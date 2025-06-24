/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test, vitest } from "vitest";

import { Watchable } from "./watchable";

test("initial value is set correctly", () => {
    const watchable = new Watchable(42);
    expect(watchable.value).toBe(42);
});

test("value can be updated", () => {
    const watchable = new Watchable(100);
    watchable.value = 200;
    expect(watchable.value).toBe(200);
});

test("watchers are notified on value change", () => {
    const watchable = new Watchable(1);
    const listener = vitest.fn();

    watchable.watch(listener);
    watchable.value = 2; // This should trigger the listener
    expect(listener).toHaveBeenCalledExactlyOnceWith(2);

    watchable.unwatch(listener); // Clean up after the test
});

test("watchers are not notified if value does not change", () => {
    const watchable = new Watchable(10);
    const listener = vitest.fn();

    watchable.watch(listener);
    watchable.value = 10; // This should not trigger the listener
    expect(listener).not.toHaveBeenCalled();

    watchable.unwatch(listener); // Clean up after the test
});

test("when value is an object, shallow comparison works", () => {
    const watchable = new Watchable({ a: 1, b: 2 });
    const listener = vitest.fn();
    watchable.watch(listener);

    // Update with a new object that has the same properties
    watchable.value = { a: 3, b: 2 }; // This should trigger the listener
    expect(listener).toHaveBeenCalledExactlyOnceWith({ a: 3, b: 2 });
    listener.mockClear();
    watchable.value = { a: 3, b: 2 }; // This should not trigger the listener again
    expect(listener).not.toHaveBeenCalled();

    watchable.unwatch(listener); // Clean up after the test
});
