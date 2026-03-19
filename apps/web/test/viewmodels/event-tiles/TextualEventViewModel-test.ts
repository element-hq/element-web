/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { TextualEventViewModel } from "../../../src/viewmodels/event-tiles/TextualEventViewModel";
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

    it("should rebind sentinel listeners when props change", () => {
        const firstEvent = new MatrixEvent({});
        const secondEvent = new MatrixEvent({});
        stubClient();

        const vm = new TextualEventViewModel({
            showHiddenEvents: false,
            mxEvent: firstEvent,
        });

        const cb = jest.fn();

        vm.subscribe(cb);
        vm.updateProps({
            showHiddenEvents: false,
            mxEvent: secondEvent,
        });

        cb.mockClear();

        firstEvent.emit(MatrixEventEvent.SentinelUpdated);
        expect(cb).not.toHaveBeenCalled();

        secondEvent.emit(MatrixEventEvent.SentinelUpdated);
        expect(cb).toHaveBeenCalledTimes(1);
    });
});
