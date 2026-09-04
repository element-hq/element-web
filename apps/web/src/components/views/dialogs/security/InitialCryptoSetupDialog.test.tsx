/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { InitialCryptoSetupDialog } from "./InitialCryptoSetupDialog";
import { InitialCryptoSetupStore } from "../../../../stores/InitialCryptoSetupStore";

describe("InitialCryptoSetupDialog", () => {
    const storeMock = {
        getStatus: vi.fn(),
        retry: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    };

    beforeEach(() => {
        vi.spyOn(InitialCryptoSetupStore, "sharedInstance").mockReturnValue(storeMock as any);
    });

    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it("should show a spinner while the setup is in progress", async () => {
        storeMock.getStatus.mockReturnValue("in_progress");

        render(<InitialCryptoSetupDialog onCancelled={vi.fn()} />);

        expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("should display an error if setup has failed", async () => {
        storeMock.getStatus.mockReturnValue("error");

        render(<InitialCryptoSetupDialog onCancelled={vi.fn()} />);

        await expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("calls retry when retry button pressed", async () => {
        storeMock.getStatus.mockReturnValue("error");

        render(<InitialCryptoSetupDialog onCancelled={vi.fn()} />);

        await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

        expect(storeMock.retry).toHaveBeenCalled();
    });
});
