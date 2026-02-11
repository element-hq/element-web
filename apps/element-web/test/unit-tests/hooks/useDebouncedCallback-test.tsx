/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { renderHook } from "jest-matrix-react";

import { useDebouncedCallback } from "../../../src/hooks/spotlight/useDebouncedCallback";

describe("useDebouncedCallback", () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

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
        const callback = jest.fn();
        render(true, callback, params);
        jest.advanceTimersByTime(1);

        // Then
        expect(callback).toHaveBeenCalledTimes(0);

        // When
        jest.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should call the callback with the parameters", async () => {
        // When
        const params = ["USER NAME"];
        const callback = jest.fn();
        render(true, callback, params);
        jest.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should call the callback with the parameters when parameters change during the timeout", async () => {
        // When
        const params = ["USER NAME"];
        const callback = jest.fn();
        const { rerender } = render(true, callback, []);

        jest.advanceTimersByTime(1);
        rerender({ enabled: true, callback, params });
        jest.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(...params);
    });

    it("should handle multiple parameters", async () => {
        // When
        const params = [4, 8, 15, 16, 23, 42];
        const callback = jest.fn();
        const { rerender } = render(true, callback, []);

        jest.advanceTimersByTime(1);
        rerender({ enabled: true, callback, params });
        jest.advanceTimersByTime(500);

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
        const callback = jest.fn();

        const { rerender } = render(true, callback, []);
        jest.advanceTimersByTime(1);

        for (const query of queries) {
            rerender({ enabled: true, callback, params: [query] });
            jest.advanceTimersByTime(50);
        }

        jest.advanceTimersByTime(500);

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
        const callback = jest.fn();

        const { rerender } = render(true, callback, []);
        jest.advanceTimersByTime(1);
        for (const query of queries) {
            rerender({ enabled: true, callback, params: [query] });
            jest.advanceTimersByTime(200);
        }

        jest.advanceTimersByTime(500);

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
        const callback = jest.fn();

        const { rerender } = render(false, callback, []);
        jest.advanceTimersByTime(1);
        for (const query of queries) {
            rerender({ enabled: false, callback, params: [query] });
            jest.advanceTimersByTime(200);
        }

        jest.advanceTimersByTime(500);

        // Then
        expect(callback).toHaveBeenCalledTimes(0);
    });
});
