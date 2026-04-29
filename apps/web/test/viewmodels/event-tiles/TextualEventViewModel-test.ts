/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { TextualEventViewModel } from "../../../src/viewmodels/room/timeline/event-tile/TextualEventViewModel";
import { stubClient } from "../../test-utils";

jest.mock("../../../src/TextForEvent.tsx", () => ({
    textForEvent: jest.fn().mockReturnValue("Test Message"),
}));

const mockTextForEvent = jest.requireMock("../../../src/TextForEvent.tsx").textForEvent as jest.Mock;

describe("TextualEventViewModel", () => {
    beforeEach(() => {
        mockTextForEvent.mockReturnValue("Test Message");
    });

    it("should update when the sentinel updates", () => {
        const fakeEvent = new MatrixEvent({});
        stubClient();

        const vm = new TextualEventViewModel({
            showHiddenEvents: false,
            mxEvent: fakeEvent,
        });

        const cb = jest.fn();

        vm.subscribe(cb);

        mockTextForEvent.mockReturnValue("Updated Message");
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

        const nextProps = {
            showHiddenEvents: false,
            mxEvent: secondEvent,
        };

        vm.subscribe(cb);
        vm.updateProps(nextProps);

        cb.mockClear();

        firstEvent.emit(MatrixEventEvent.SentinelUpdated);
        expect(cb).not.toHaveBeenCalled();

        mockTextForEvent.mockReturnValue("Updated Message");
        secondEvent.emit(MatrixEventEvent.SentinelUpdated);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it("should update sentinel listeners when props change", () => {
        const firstEvent = new MatrixEvent({});
        const secondEvent = new MatrixEvent({});
        stubClient();

        const vm = new TextualEventViewModel({
            showHiddenEvents: false,
            mxEvent: firstEvent,
        });
        const firstEventOffSpy = jest.spyOn(firstEvent, "off");
        const secondEventOnSpy = jest.spyOn(secondEvent, "on");

        vm.updateProps({
            showHiddenEvents: false,
            mxEvent: secondEvent,
        });

        expect(firstEventOffSpy).toHaveBeenCalledWith(MatrixEventEvent.SentinelUpdated, expect.any(Function));
        expect(secondEventOnSpy).toHaveBeenCalledWith(MatrixEventEvent.SentinelUpdated, expect.any(Function));
    });
});
