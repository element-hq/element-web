/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React, { useLayoutEffect } from "react";
import { render } from "test-utils-rtl";

import { useDispatcher } from "./useDispatcher";
import { MatrixDispatcher } from "../dispatcher/dispatcher";

describe("useDispatcher", () => {
    it("calls the handler with each dispatch until unmounted", () => {
        const dispatcher = new MatrixDispatcher();
        const handler = vi.fn();
        const Listener: React.FC = () => {
            useDispatcher(dispatcher, handler);
            return null;
        };

        const { unmount } = render(<Listener />);
        dispatcher.dispatch({ action: "test" }, true);
        expect(handler).toHaveBeenCalledWith({ action: "test" });

        unmount();
        dispatcher.dispatch({ action: "test" }, true);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("calls the handler from the latest render as soon as that render is committed", () => {
        const dispatcher = new MatrixDispatcher();
        const seen: string[] = [];
        const Listener: React.FC<{ value: string }> = ({ value }) => {
            useDispatcher(dispatcher, () => seen.push(value));
            // Layout effects run while the render is being committed, before any passive effect
            useLayoutEffect(() => {
                dispatcher.dispatch({ action: "test" }, true);
            }, [value]);
            return null;
        };

        // The first render's dispatch goes unheard, as the handler is only registered once that render's effects run
        const { rerender } = render(<Listener value="first" />);
        rerender(<Listener value="second" />);

        expect(seen).toEqual(["second"]);
    });
});
