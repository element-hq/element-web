/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { screen } from "jest-matrix-react";

import { openDialog } from "../../../src/modules/Dialog.tsx";

describe("openDialog", () => {
    it("should open a dialog with the expected title", async () => {
        const Dialog = () => <>Dialog Content</>;

        const title = "Test Dialog";
        openDialog({ title }, Dialog, {});

        await expect(screen.findByText("Test Dialog")).resolves.toBeInTheDocument();
        expect(screen.getByText("Dialog Content")).toBeInTheDocument();
    });
});
