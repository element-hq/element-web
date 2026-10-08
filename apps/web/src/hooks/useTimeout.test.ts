/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "test-utils-rtl";

import { useInterval, useTimeout } from "./useTimeout";

describe("useTimeout", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("calls the handler from the latest render once the time is up", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ handler }) => useTimeout(handler, 1000), {
            initialProps: { handler: first },
        });

        rerender({ handler: second });
        act(() => vi.advanceTimersByTime(1000));

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("does not call the handler after unmounting", () => {
        const handler = vi.fn();
        const { unmount } = renderHook(() => useTimeout(handler, 1000));

        unmount();
        vi.advanceTimersByTime(1000);

        expect(handler).not.toHaveBeenCalled();
    });
});

describe("useInterval", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("calls the handler from the latest render on each tick, until unmounted", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender, unmount } = renderHook(({ handler }) => useInterval(handler, 1000), {
            initialProps: { handler: first },
        });

        act(() => vi.advanceTimersByTime(1000));
        rerender({ handler: second });
        act(() => vi.advanceTimersByTime(2000));
        unmount();
        vi.advanceTimersByTime(1000);

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
    });
});
