/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { mocked } from "jest-mock";

import E2eSetup from "../../../../../src/components/structures/auth/E2eSetup.tsx";
import { InitialCryptoSetupStore } from "../../../../../src/stores/InitialCryptoSetupStore.ts";

afterEach(() => jest.restoreAllMocks());

describe("LeftPanel", () => {
    it("should call `onCancelled` when the user clicks the cancel button", () => {
        const mockInitialCryptoSetupStore = {
            getStatus: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };
        jest.spyOn(InitialCryptoSetupStore, "sharedInstance").mockReturnValue(mockInitialCryptoSetupStore as any);

        // We need the setup process to have failed, for the dialog to present a cancel button.
        mocked(mockInitialCryptoSetupStore.getStatus).mockReturnValue("error");

        const onCancelled = jest.fn();
        const { getByRole } = render(<E2eSetup onCancelled={onCancelled} />);

        getByRole("button", { name: "Cancel" }).click();
        expect(onCancelled).toHaveBeenCalled();
    });
});
