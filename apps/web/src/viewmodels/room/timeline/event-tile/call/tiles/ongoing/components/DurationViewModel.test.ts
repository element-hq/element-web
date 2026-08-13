/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";

import { DurationViewModel } from "./DurationViewModel";

describe("DurationViewModel", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should compute duration correctly", () => {
        const callStartTs = Date.now();
        vi.advanceTimersByTime(100 * 1000);
        const vm = new DurationViewModel({ callStartTs });

        // Time elapsed from callStartTs is 100 seconds, so expect duration to be 100
        expect(vm.getSnapshot().duration).toStrictEqual(100);

        // Snapshot must update as time goes on
        vi.advanceTimersByTime(100 * 1000);
        expect(vm.getSnapshot().duration).toStrictEqual(200);
    });
});
