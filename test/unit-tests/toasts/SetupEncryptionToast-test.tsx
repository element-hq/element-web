/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import ToastContainer from "../../../src/components/structures/ToastContainer";
import { Kind, showToast } from "../../../src/toasts/SetupEncryptionToast";

describe("SetupEncryptionToast", () => {
    beforeEach(() => {
        render(<ToastContainer />);
    });

    it("should render the se up recovery toast", async () => {
        showToast(Kind.SET_UP_RECOVERY);

        await expect(screen.findByText("Set up recovery")).resolves.toBeInTheDocument();
    });
});
