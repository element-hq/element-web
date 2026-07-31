/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { TextualEventViewModel } from "../../../src/viewmodels/room/timeline/event-tile/TextualEventViewModel";
import { textForEvent } from "../../../src/TextForEvent";
import { stubClient } from "../../test-utils";

jest.mock("../../../src/TextForEvent.tsx", () => ({
    textForEvent: jest.fn().mockReturnValue("Test Message"),
}));

describe("TextualEventViewModel", () => {
    it("should update when the sentinel updates", () => {
        const fakeEvent = new MatrixEvent({});
        stubClient();

        const vm = new TextualEventViewModel({
            showHiddenEvents: false,
            mxEvent: fakeEvent,
        });

        const cb = jest.fn();

        vm.subscribe(cb);

        fakeEvent.emit(MatrixEventEvent.SentinelUpdated);

        expect(cb).toHaveBeenCalledTimes(1);
    });

    it("should ask for rich content in the timeline", () => {
        const fakeEvent = new MatrixEvent({});
        const client = stubClient();
        mocked(textForEvent).mockClear();

        new TextualEventViewModel({ showHiddenEvents: false, mxEvent: fakeEvent });

        expect(textForEvent).toHaveBeenCalledWith(fakeEvent, client, true, false);
    });

    it("should ask for plain content when exporting", () => {
        const fakeEvent = new MatrixEvent({});
        const client = stubClient();
        mocked(textForEvent).mockClear();

        // Buttons rendered into an export are dead, so the export must not be given any
        new TextualEventViewModel({ showHiddenEvents: false, mxEvent: fakeEvent, forExport: true });

        expect(textForEvent).toHaveBeenCalledWith(fakeEvent, client);
    });
});
