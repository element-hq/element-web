/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { defer } from "matrix-js-sdk/src/utils";

import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";
import { AsyncActionPayload } from "../../src/dispatcher/payloads";

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
