/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect } from "vitest";
import { stubClient } from "test-utils";

import { TextualEventViewModel } from "./TextualEventViewModel";

vi.mock("../../../../TextForEvent.tsx", () => ({
    textForEvent: vi.fn().mockReturnValue("Test Message"),
}));

describe("TextualEventViewModel", () => {
    it("should update when the sentinel updates", () => {
        const fakeEvent = new MatrixEvent({});
        stubClient();

        const vm = new TextualEventViewModel({
            showHiddenEvents: false,
            mxEvent: fakeEvent,
        });

        const cb = vi.fn();

        vm.subscribe(cb);

        fakeEvent.emit(MatrixEventEvent.SentinelUpdated);

        expect(cb).toHaveBeenCalledTimes(1);
    });
});
