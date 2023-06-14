/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { renderHook } from "@testing-library/react-hooks";

import { useDebouncedCallback } from "../../src/hooks/spotlight/useDebouncedCallback";

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
