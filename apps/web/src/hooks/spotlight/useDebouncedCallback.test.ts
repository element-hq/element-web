/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderHook } from "test-utils-rtl";

import { useDebouncedCallback } from "./useDebouncedCallback";

describe("useDebouncedCallback", () => {
    beforeAll(() => vi.useFakeTimers());
    afterAll(() => vi.useRealTimers());

    function render(enabled: boolean, callback: (...params: any[]) => void, params: any[]) {
        return renderHook(({ enabled, callback, params }) => useDebouncedCallback(enabled, callback, params), {
            initialProps: {
                enabled,
                callback,
                params,
            },
        });
    }

    it("should be able to handle empty parameters", async () => {
        // When
        const params: any[] = [];
        const callback = vi.fn();
        render(true, callback, params);
        vi.advanceTimersByTime(1);

        // Then
        expect(callback).toHaveBeenCalledTimes(0);

        // When
        vi.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should call the callback with the parameters", async () => {
        // When
        const params = ["USER NAME"];
        const callback = vi.fn();
        render(true, callback, params);
        vi.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should call the callback with the parameters when parameters change during the timeout", async () => {
        // When
        const params = ["USER NAME"];
        const callback = vi.fn();
        const { rerender } = render(true, callback, []);

        vi.advanceTimersByTime(1);
        rerender({ enabled: true, callback, params });
        vi.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should handle multiple parameters", async () => {
        // When
        const params = [4, 8, 15, 16, 23, 42];
        const callback = vi.fn();
        const { rerender } = render(true, callback, []);

        vi.advanceTimersByTime(1);
        rerender({ enabled: true, callback, params });
        vi.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should debounce quick changes", async () => {
        // When
        const queries = [
            "U",
            "US",
            "USE",
            "USER",
            "USER ",
            "USER N",
            "USER NM",
            "USER NMA",
            "USER NM",
            "USER N",
            "USER NA",
            "USER NAM",
            "USER NAME",
        ];
        const callback = vi.fn();

        const { rerender } = render(true, callback, []);
        vi.advanceTimersByTime(1);

        for (const query of queries) {
            rerender({ enabled: true, callback, params: [query] });
            vi.advanceTimersByTime(50);
        }

        vi.advanceTimersByTime(500);

        // Then
        const query = queries[queries.length - 1];
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(query);
    });

    it("should not debounce slow changes", async () => {
        // When
        const queries = [
            "U",
            "US",
            "USE",
            "USER",
            "USER ",
            "USER N",
            "USER NM",
            "USER NMA",
            "USER NM",
            "USER N",
            "USER NA",
            "USER NAM",
            "USER NAME",
        ];
        const callback = vi.fn();

        const { rerender } = render(true, callback, []);
        vi.advanceTimersByTime(1);
        for (const query of queries) {
            rerender({ enabled: true, callback, params: [query] });
            vi.advanceTimersByTime(200);
        }

        vi.advanceTimersByTime(500);

        // Then
        const query = queries[queries.length - 1];
        expect(callback).toHaveBeenCalledTimes(queries.length);
        expect(callback).toHaveBeenCalledWith(query);
    });

    it("should not call the callback if it’s disabled", async () => {
        // When
        const queries = [
            "U",
            "US",
            "USE",
            "USER",
            "USER ",
            "USER N",
            "USER NM",
            "USER NMA",
            "USER NM",
            "USER N",
            "USER NA",
            "USER NAM",
            "USER NAME",
        ];
        const callback = vi.fn();

        const { rerender } = render(false, callback, []);
        vi.advanceTimersByTime(1);
        for (const query of queries) {
            rerender({ enabled: false, callback, params: [query] });
            vi.advanceTimersByTime(200);
        }

        vi.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(0);
    });
});
