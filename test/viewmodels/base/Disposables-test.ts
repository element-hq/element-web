/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventEmitter } from "events";

import { Disposables } from "../../../src/viewmodels/base/Disposables";

describe("Disposable", () => {
    it("isDisposed is true after dispose() is called", () => {
        const disposables = new Disposables();
        expect(disposables.isDisposed).toEqual(false);
        disposables.dispose();
        expect(disposables.isDisposed).toEqual(true);
    });

    it("dispose() calls the correct disposing function", () => {
        const disposables = new Disposables();

        const item1 = {
            foo: 5,
            dispose: jest.fn(),
        };
        disposables.track(item1);

        const item2 = jest.fn();
        disposables.track(item2);

        disposables.dispose();

        expect(item1.dispose).toHaveBeenCalledTimes(1);
        expect(item2).toHaveBeenCalledTimes(1);
    });

    it("Throws error if acting on already disposed disposables", () => {
        const disposables = new Disposables();
        disposables.dispose();
        expect(() => {
            disposables.track(jest.fn);
        }).toThrow();
    });

    it("Removes tracked event listeners on dispose", () => {
        const disposables = new Disposables();
        const emitter = new EventEmitter();

        const fn = jest.fn();
        disposables.trackListener(emitter, "FooEvent", fn);
        emitter.emit("FooEvent");
        expect(fn).toHaveBeenCalled();

        disposables.dispose();
        expect(emitter.listenerCount("FooEvent", fn)).toEqual(0);
    });
});
