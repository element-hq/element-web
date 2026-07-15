/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, expect as viExpect, beforeAll as viBeforeAll, afterAll as viAfterAll } from "vitest";
import { mocked as jestMocked } from "jest-mock";

export const isJest = typeof jest !== "undefined";

/**
 * Subset of the vitest API surface, with jest equivalents for the same functions when running under jest.
 */
const adapter = {
    fn: isJest ? (jest.fn as unknown as typeof vi.fn) : vi.fn,
    spyOn: isJest ? (jest.spyOn as unknown as typeof vi.spyOn) : vi.spyOn,
    mocked: isJest ? (jestMocked as typeof vi.mocked) : vi.mocked,
    advanceTimersByTime: isJest
        ? (jest.advanceTimersByTime as unknown as typeof vi.advanceTimersByTime)
        : vi.advanceTimersByTime,
} as Pick<typeof vi, "fn" | "spyOn" | "mocked" | "advanceTimersByTime">;

const mocked = adapter.mocked;
export { adapter as vi, mocked };

const _expect = isJest ? (expect as unknown as typeof viExpect) : viExpect;
const _beforeAll = isJest ? (beforeAll as unknown as typeof viBeforeAll) : viBeforeAll;
const _afterAll = isJest ? (afterAll as unknown as typeof viAfterAll) : viAfterAll;
export { _expect as expect, _beforeAll as beforeAll, _afterAll as afterAll };

export { type Mocked, type MockedObject } from "vitest";
