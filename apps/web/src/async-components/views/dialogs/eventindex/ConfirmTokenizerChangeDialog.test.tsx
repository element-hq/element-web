/*
Copyright 2026 Hiroshi Shinaoka
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import { flushPromises } from "test-utils";

import ConfirmTokenizerChangeDialog from "./ConfirmTokenizerChangeDialog";
import EventIndexPeg from "../../../../indexing/EventIndexPeg";

describe("<ConfirmTokenizerChangeDialog />", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("deletes the event index and finishes when confirmed", async () => {
        const onFinished = vi.fn();
        vi.spyOn(EventIndexPeg, "deleteEventIndex").mockResolvedValue(undefined);

        render(<ConfirmTokenizerChangeDialog onFinished={onFinished} />);

        await userEvent.click(screen.getByRole("button", { name: "OK" }));
        await flushPromises();

        expect(EventIndexPeg.deleteEventIndex).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalledWith(true);
    });
});
