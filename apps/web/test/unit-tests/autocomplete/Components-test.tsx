/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { PillCompletion } from "../../../src/autocomplete/Components";

describe("PillCompletion", () => {
    it("renders the titleIcon immediately after the title", () => {
        render(<PillCompletion title="Alice" titleIcon={<span>💡</span>} description="@alice:example.org" />);

        const title = screen.getByText("Alice");
        const adornment = screen.getByText("💡");
        expect(title.nextElementSibling).toBe(adornment);
    });
});
