/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect } from "vitest";
import { stubClient } from "test-utils";

import { textForEvent } from "../../../../TextForEvent";
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

    it("should ask for rich content in the timeline", () => {
        const fakeEvent = new MatrixEvent({});
        const client = stubClient();
        vi.mocked(textForEvent).mockClear();

        const vm = new TextualEventViewModel({ showHiddenEvents: false, mxEvent: fakeEvent });

        expect(textForEvent).toHaveBeenCalledWith(fakeEvent, client, true, false);
        expect(vm.getSnapshot().content).toBe("Test Message");
    });

    it("should ask for plain content when exporting", () => {
        const fakeEvent = new MatrixEvent({});
        const client = stubClient();
        vi.mocked(textForEvent).mockClear();

        const vm = new TextualEventViewModel({ showHiddenEvents: false, mxEvent: fakeEvent, forExport: true });

        expect(textForEvent).toHaveBeenCalledWith(fakeEvent, client);
        expect(vm.getSnapshot().content).toBe("Test Message");
    });
});
