/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";

import { BaseViewModel } from "../../../src/viewmodels/base/BaseViewModel";
import { useAutoDisposedViewModel } from "../../../src/viewmodels/base/useAutoDisposedViewModel";

class TestViewModel extends BaseViewModel<{ count: number }, { initial: number }> {
    constructor(props: { initial: number }) {
        super(props, { count: props.initial });
    }

    public increment() {
        const newCount = this.getSnapshot().count + 1;
        this.snapshot.set({ count: newCount });
    }
}

describe("useAutoDisposedViewModel", () => {
    it("should return view-model", () => {
        const vmCreator = () => new TestViewModel({ initial: 0 });
        const { result } = renderHook(() => useAutoDisposedViewModel(vmCreator));
        const vm = result.current;
        expect(vm).toBeInstanceOf(TestViewModel);
        expect(vm.isDisposed).toStrictEqual(false);
    });

    it("should dispose view-model on unmount", () => {
        const vmCreator = () => new TestViewModel({ initial: 0 });
        const { result, unmount } = renderHook(() => useAutoDisposedViewModel(vmCreator));
        const vm = result.current;
        vm.increment();
        unmount();
        expect(vm.isDisposed).toStrictEqual(true);
    });

    it("should recreate view-model on react strict mode", async () => {
        const vmCreator = () => new TestViewModel({ initial: 0 });
        const output = renderHook(() => useAutoDisposedViewModel(vmCreator), { reactStrictMode: true });
        const vm = output.result.current;
        expect(vm.isDisposed).toStrictEqual(false);
    });
});
