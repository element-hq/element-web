/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { PillCompletion } from "../../../src/autocomplete/Components";

describe("PillCompletion", () => {
    it("renders the titleAdornment immediately after the title", () => {
        render(<PillCompletion title="Alice" titleAdornment={<span>💡</span>} description="@alice:example.org" />);

        const title = screen.getByText("Alice");
        const adornment = screen.getByText("💡");
        // The adornment must sit right after the title so the emoji appears just after the display name.
        expect(title.nextElementSibling).toBe(adornment);
    });
});
