/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi } from "vitest";
import { mocked as jestMocked } from "jest-mock";

const isJest = typeof jest !== "undefined";

/**
 * Subset of the vitest API surface, with jest equivalents for the same functions when running under jest.
 */
const adapter = {
    fn: isJest ? (jest.fn as unknown as typeof vi.fn) : vi.fn,
    spyOn: isJest ? (jest.spyOn as unknown as typeof vi.spyOn) : vi.spyOn,
    mocked: isJest ? (jestMocked as typeof vi.mocked) : vi.mocked,
} as Pick<typeof vi, "fn" | "spyOn" | "mocked">;

const mocked = adapter.mocked;
export { adapter as vi, mocked };

export { type Mocked, type MockedObject } from "vitest";
