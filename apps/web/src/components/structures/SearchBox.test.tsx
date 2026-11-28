/*
Copyright 2026 Viktor Shchelochkov

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "test-utils-rtl";

import SearchBox from "./SearchBox";

describe("<SearchBox />", () => {
    it("renders the search icon as an svg so it takes the theme's color", () => {
        const { container } = render(<SearchBox onSearch={vi.fn()} placeholder="Search for rooms" />);

        expect(screen.getByPlaceholderText("Search for rooms")).toBeInTheDocument();
        expect(container.querySelector(".mx_SearchBox > svg.mx_SearchBox_icon")).toBeInTheDocument();
    });
});
