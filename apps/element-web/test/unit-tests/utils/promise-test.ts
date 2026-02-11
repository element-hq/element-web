/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { batch } from "../../../src/utils/promise.ts";

describe("promise.ts", () => {
    describe("batch", () => {
        afterEach(() => jest.useRealTimers());

        it("should batch promises into groups of a given size", async () => {
            const promises = [() => Promise.resolve(1), () => Promise.resolve(2), () => Promise.resolve(3)];
            const batchSize = 2;
            const result = await batch(promises, batchSize);
            expect(result).toEqual([1, 2, 3]);
        });

        it("should wait for the current batch to finish to request the next one", async () => {
            jest.useFakeTimers();

            let promise1Called = false;
            const promise1 = () =>
                new Promise<number>((resolve) => {
                    promise1Called = true;
                    resolve(1);
                });
            let promise2Called = false;
            const promise2 = () =>
                new Promise<number>((resolve) => {
                    promise2Called = true;
                    setTimeout(() => {
                        resolve(2);
                    }, 10);
                });

            let promise3Called = false;
            const promise3 = () =>
                new Promise<number>((resolve) => {
                    promise3Called = true;
                    resolve(3);
                });
            const batchSize = 2;
            const batchPromise = batch([promise1, promise2, promise3], batchSize);

            expect(promise1Called).toBe(true);
            expect(promise2Called).toBe(true);
            expect(promise3Called).toBe(false);

            jest.advanceTimersByTime(11);
            expect(await batchPromise).toEqual([1, 2, 3]);
        });
    });
});
