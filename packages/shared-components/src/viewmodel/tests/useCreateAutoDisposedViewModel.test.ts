/*
Copyright 2025 Element Creations Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";

import { BaseViewModel } from "../BaseViewModel";
import { useCreateAutoDisposedViewModel } from "../useCreateAutoDisposedViewModel";

class TestViewModel extends BaseViewModel<{ count: number }, { initial: number }> {
    public constructor(props: { initial: number }) {
        super(props, { count: props.initial });
    }

    public increment(): void {
        const newCount = this.getSnapshot().count + 1;
        this.snapshot.set({ count: newCount });
    }
}

describe("useAutoDisposedViewModel", () => {
    it("should return view-model", () => {
        const vmCreator = (): TestViewModel => new TestViewModel({ initial: 0 });
        const { result } = renderHook(() => useCreateAutoDisposedViewModel(vmCreator));
        const vm = result.current;
        expect(vm).toBeInstanceOf(TestViewModel);
        expect(vm.isDisposed).toStrictEqual(false);
    });

    it("should dispose view-model on unmount", () => {
        const vmCreator = (): TestViewModel => new TestViewModel({ initial: 0 });
        const { result, unmount } = renderHook(() => useCreateAutoDisposedViewModel(vmCreator));
        const vm = result.current;
        vm.increment();
        unmount();
        expect(vm.isDisposed).toStrictEqual(true);
    });

    it("should recreate view-model on react strict mode", async () => {
        const vmCreator = (): TestViewModel => new TestViewModel({ initial: 0 });
        const output = renderHook(() => useCreateAutoDisposedViewModel(vmCreator), { reactStrictMode: true });
        const vm = output.result.current;
        expect(vm.isDisposed).toStrictEqual(false);
    });
});
