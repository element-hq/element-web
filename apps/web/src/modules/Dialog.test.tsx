/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { screen } from "test-utils-rtl";
import { clearAllModals } from "test-utils";

import { openDialog } from "./Dialog.tsx";

describe("openDialog", () => {
    afterEach(async () => {
        await clearAllModals();
    });
    it("should open a dialog with the expected title", async () => {
        const Dialog = () => <>Dialog Content</>;

        const title = "Test Dialog";
        openDialog({ title }, Dialog, {});

        await expect(screen.findByText("Test Dialog")).resolves.toBeInTheDocument();
        expect(screen.getByText("Dialog Content")).toBeInTheDocument();
    });

    it("should open a dialog without a title but with an accessible name", async () => {
        const Dialog = () => <>Dialog Content</>;

        openDialog({ ariaLabel: "Test Dialog" }, Dialog, {});

        await expect(screen.findByRole("dialog", { name: "Test Dialog" })).resolves.toBeInTheDocument();
        expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
});
