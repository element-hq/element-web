/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel } from "../../../src/viewmodels/base/BaseViewModel";

interface Props {
    initialTodos: string[];
}

/**
 * BaseViewModel is an abstract class, so we'll have to test it with a dummy view model.
 */
class TodoViewModel extends BaseViewModel<Props> {
    public todos: string[];

    public constructor(props: Props) {
        super(props);
        this.todos = [...props.initialTodos];
    }

    public doEmit(): void {
        this.emit();
    }
}

describe("BaseViewModel", () => {
    describe("Test integrity of getSnapshot()", () => {
        it("Multiple calls to getSnapshot returns a cached value", () => {
            // To be sure that we don't run into
            // https://react.dev/reference/react/useSyncExternalStore#im-getting-an-error-the-result-of-getsnapshot-should-be-cached
            const vm = new TodoViewModel({ initialTodos: ["todo1", "todo2"] });
            const snapshot1 = vm.getSnapshot();
            const snapshot2 = vm.getSnapshot();
            expect(snapshot1).toBe(snapshot2);
        });
        it("emit() causes snapshot value to change", () => {
            // When emit() is called, the snapshot should change in order for react to rerender any subscribed components.
            const vm = new TodoViewModel({ initialTodos: ["todo1", "todo2"] });
            const snapshot1 = vm.getSnapshot();
            vm.doEmit();
            const snapshot2 = vm.getSnapshot();
            expect(snapshot1).not.toBe(snapshot2);
        });
    });

    describe("Subscriptions", () => {
        it("subscribe() returns unsubscribe callback", () => {
            const vm = new TodoViewModel({ initialTodos: ["todo1", "todo2"] });
            const result = vm.subscribe(jest.fn());
            expect(typeof result).toBe("function");
        });

        it("emit() calls subscribe callbacks", () => {
            const vm = new TodoViewModel({ initialTodos: ["todo1", "todo2"] });

            const callbacks = [jest.fn(), jest.fn()];
            callbacks.forEach((c) => vm.subscribe(c));
            vm.doEmit();

            callbacks.forEach((c) => expect(c).toHaveBeenCalledTimes(1));
        });

        it("Invoking unsubscribe callback returned from subscribe() removes subscription", () => {
            const vm = new TodoViewModel({ initialTodos: ["todo1", "todo2"] });

            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const unsubscribe = vm.subscribe(callback1);
            vm.subscribe(callback2);

            unsubscribe();
            vm.doEmit();

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });
    });
});
