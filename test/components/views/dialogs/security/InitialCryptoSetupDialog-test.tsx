/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { InitialCryptoSetupDialog } from "../../../../../src/components/views/dialogs/security/InitialCryptoSetupDialog";
import { InitialCryptoSetupStore } from "../../../../../src/stores/InitialCryptoSetupStore";

describe("InitialCryptoSetupDialog", () => {
    const storeMock = {
        getStatus: jest.fn(),
        retry: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    };

    beforeEach(() => {
        jest.spyOn(InitialCryptoSetupStore, "sharedInstance").mockReturnValue(storeMock as any);
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("should show a spinner while the setup is in progress", async () => {
        const onFinished = jest.fn();

        storeMock.getStatus.mockReturnValue("in_progress");

        render(<InitialCryptoSetupDialog onFinished={onFinished} />);

        expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("should display an error if setup has failed", async () => {
        storeMock.getStatus.mockReturnValue("error");

        render(<InitialCryptoSetupDialog onFinished={jest.fn()} />);

        await expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("calls retry when retry button pressed", async () => {
        const onFinished = jest.fn();
        storeMock.getStatus.mockReturnValue("error");

        render(<InitialCryptoSetupDialog onFinished={onFinished} />);

        await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

        expect(storeMock.retry).toHaveBeenCalled();
    });
});
