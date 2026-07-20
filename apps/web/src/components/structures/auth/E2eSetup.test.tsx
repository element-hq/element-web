/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render } from "test-utils-rtl";

import E2eSetup from "./E2eSetup.tsx";
import { InitialCryptoSetupStore } from "../../../stores/InitialCryptoSetupStore.ts";

afterEach(() => vi.restoreAllMocks());

describe("LeftPanel", () => {
    it("should call `onCancelled` when the user clicks the cancel button", () => {
        const mockInitialCryptoSetupStore = {
            getStatus: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        };
        vi.spyOn(InitialCryptoSetupStore, "sharedInstance").mockReturnValue(mockInitialCryptoSetupStore as any);

        // We need the setup process to have failed, for the dialog to present a cancel button.
        vi.mocked(mockInitialCryptoSetupStore.getStatus).mockReturnValue("error");

        const onCancelled = vi.fn();
        const { getByRole } = render(<E2eSetup onCancelled={onCancelled} />);

        getByRole("button", { name: "Cancel" }).click();
        expect(onCancelled).toHaveBeenCalled();
    });
});
