/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vitest } from "vitest";
import { render } from "@testing-library/react";
import { Toast } from "@vector-im/compound-web";
import React, { type JSX } from "react";

import { ToastContext, ToastRack, useToastContext } from "./ToastContext";

describe("ToastRack", () => {
    it("should return a toast once one is displayed", () => {
        const toastRack = new ToastRack();
        toastRack.displayToast("Hello, world!");

        expect(toastRack.getActiveToast()).toBe("Hello, world!");
    });

    it("calls update callback when a toast is added", () => {
        const toastRack = new ToastRack();
        const updateCallbackFn = vitest.fn();
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

describe("useToastContext", () => {
    it("should fail if there is no context wrapper", () => {
        function FailingComponent(): JSX.Element {
            useToastContext();
            return <p>Test</p>;
        }
        expect(() => render(<FailingComponent />)).toThrow(
            "Component must be wrapped in <ToastContext.Provider /> to use useToastContext",
        );
    });
    it("should succeed if there is a context wrapper", async () => {
        function HappyComponent(): JSX.Element {
            const toaster = useToastContext();
            return <>{toaster.getActiveToast()}</>;
        }
        const rack = new ToastRack();
        rack.displayToast(<Toast>Toast!</Toast>);
        const { getByText } = render(
            <ToastContext value={rack}>
                <HappyComponent />
            </ToastContext>,
        );
        expect(getByText("Toast!")).toBeVisible();
    });
});
