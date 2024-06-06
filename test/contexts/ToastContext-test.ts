/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { ToastRack } from "../../src/contexts/ToastContext";

describe("ToastRack", () => {
    it("should return a toast once one is displayed", () => {
        const toastRack = new ToastRack();
        toastRack.displayToast("Hello, world!");

        expect(toastRack.getActiveToast()).toBe("Hello, world!");
    });

    it("calls update callback when a toast is added", () => {
        const toastRack = new ToastRack();
        const updateCallbackFn = jest.fn();
        toastRack.setCallback(updateCallbackFn);
        toastRack.displayToast("Hello, world!");

        expect(updateCallbackFn).toHaveBeenCalled();
    });

    it("removes toast when remove function is called", () => {
        const toastRack = new ToastRack();
        const removeFn = toastRack.displayToast("Hello, world!");
        expect(toastRack.getActiveToast()).toBe("Hello, world!");
        removeFn();
        expect(toastRack.getActiveToast()).toBeUndefined();
    });
});
