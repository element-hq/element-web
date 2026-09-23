/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";

import defaultDispatcher from "./dispatcher";
import { Action } from "./actions";
import { AsyncActionPayload } from "./payloads";

describe("MatrixDispatcher", () => {
    it("should throw error if unregistering unknown token", () => {
        expect(() => defaultDispatcher.unregister("not-a-real-token")).toThrow(
            "Dispatcher.unregister(...): 'not-a-real-token' does not map to a registered callback.",
        );
    });

    it("should execute callbacks in registered order", async () => {
        const deferred1 = Promise.withResolvers<number>();
        const deferred2 = Promise.withResolvers<number>();

        const fn1 = vi.fn(() => deferred1.resolve(1));
        const fn2 = vi.fn(() => deferred2.resolve(2));

        defaultDispatcher.register(fn1);
        defaultDispatcher.register(fn2);

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn });
        const res = await Promise.race([deferred1.promise, deferred2.promise]);

        expect(res).toBe(1);
    });

    it("should skip the queue for the given callback", async () => {
        const deferred1 = Promise.withResolvers<number>();
        const deferred2 = Promise.withResolvers<number>();

        const fn1 = vi.fn(() => deferred1.resolve(1));
        const fn2 = vi.fn(() => deferred2.resolve(2));

        defaultDispatcher.register(() => {
            defaultDispatcher.waitFor([id2]);
        });
        defaultDispatcher.register(fn1);
        const id2 = defaultDispatcher.register(fn2);

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn });
        const res = await Promise.race([deferred1.promise, deferred2.promise]);

        expect(res).toBe(2);
    });

    it("should not fire callback which was added during a dispatch", () => {
        const fn2 = vi.fn();

        defaultDispatcher.register(() => {
            defaultDispatcher.register(fn2);
        });

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn }, true);

        expect(fn2).not.toHaveBeenCalled();
    });

    it("should handle AsyncActionPayload", () => {
        const fn = vi.fn();
        defaultDispatcher.register(fn);

        const readyFn = vi.fn((dispatch) => {
            dispatch({ action: "test" });
        });
        defaultDispatcher.dispatch(new AsyncActionPayload(readyFn), true);

        expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ action: "test" }));
    });
});
