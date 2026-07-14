/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import { describe, it, expect } from "vitest";

import { PillCompletion } from "./Components";

describe("PillCompletion", () => {
    it("renders the titleIcon immediately after the title", () => {
        render(<PillCompletion title="Alice" titleIcon={<span>💡</span>} description="@alice:example.org" />);

        const title = screen.getByText("Alice");
        const icon = screen.getByText("💡");
        expect(title.nextElementSibling).toBe(icon);
    });
});
