/*
Copyright 2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";

import ConfirmTokenizerChangeDialog from "../../../../../src/async-components/views/dialogs/eventindex/ConfirmTokenizerChangeDialog";
import EventIndexPeg from "../../../../../src/indexing/EventIndexPeg";
import { flushPromises } from "../../../../test-utils";

describe("<ConfirmTokenizerChangeDialog />", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("deletes the event index and finishes when confirmed", async () => {
        const onFinished = jest.fn();
        jest.spyOn(EventIndexPeg, "deleteEventIndex").mockResolvedValue(undefined);

        render(<ConfirmTokenizerChangeDialog onFinished={onFinished} />);

        fireEvent.click(screen.getByRole("button", { name: /ok/i }));
        await flushPromises();

        expect(EventIndexPeg.deleteEventIndex).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalledWith(true);
    });
});
