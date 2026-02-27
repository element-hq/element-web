/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ToastRack } from "../../../src/contexts/ToastContext";

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
