/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { defer } from "matrix-js-sdk/src/utils";

import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { AsyncActionPayload } from "../../../src/dispatcher/payloads";

describe("MatrixDispatcher", () => {
    it("should throw error if unregistering unknown token", () => {
        expect(() => defaultDispatcher.unregister("not-a-real-token")).toThrow(
            "Dispatcher.unregister(...): 'not-a-real-token' does not map to a registered callback.",
        );
    });

    it("should execute callbacks in registered order", async () => {
        const deferred1 = defer<number>();
        const deferred2 = defer<number>();

        const fn1 = jest.fn(() => deferred1.resolve(1));
        const fn2 = jest.fn(() => deferred2.resolve(2));

        defaultDispatcher.register(fn1);
        defaultDispatcher.register(fn2);

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn });
        const res = await Promise.race([deferred1.promise, deferred2.promise]);

        expect(res).toBe(1);
    });

    it("should skip the queue for the given callback", async () => {
        const deferred1 = defer<number>();
        const deferred2 = defer<number>();

        const fn1 = jest.fn(() => deferred1.resolve(1));
        const fn2 = jest.fn(() => deferred2.resolve(2));

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
        const fn2 = jest.fn();

        defaultDispatcher.register(() => {
            defaultDispatcher.register(fn2);
        });

        defaultDispatcher.dispatch({ action: Action.OnLoggedIn }, true);

        expect(fn2).not.toHaveBeenCalled();
    });

    it("should handle AsyncActionPayload", () => {
        const fn = jest.fn();
        defaultDispatcher.register(fn);

        const readyFn = jest.fn((dispatch) => {
            dispatch({ action: "test" });
        });
        defaultDispatcher.dispatch(new AsyncActionPayload(readyFn), true);

        expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ action: "test" }));
    });
});
