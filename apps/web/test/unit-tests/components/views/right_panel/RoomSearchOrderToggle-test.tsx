/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { SearchOrderBy } from "matrix-js-sdk/src/matrix";

import { RoomSearchOrderToggle } from "../../../../../src/components/views/right_panel/RoomSearchOrderToggle";

describe("RoomSearchOrderToggle", () => {
    it("renders the order toggle trigger", () => {
        render(<RoomSearchOrderToggle order={SearchOrderBy.Recent} onSearchOrderChange={jest.fn()} />);
        expect(screen.getByTestId("search-order-toggle-button")).toBeInTheDocument();
    });

    it("selecting Most relevant requests relevance (Rank) order", async () => {
        const onChange = jest.fn();
        render(<RoomSearchOrderToggle order={SearchOrderBy.Recent} onSearchOrderChange={onChange} />);

        await userEvent.click(screen.getByTestId("search-order-toggle-button"));
        await userEvent.click(await screen.findByRole("menuitemradio", { name: "Most relevant" }));

        expect(onChange).toHaveBeenCalledWith(SearchOrderBy.Rank);
    });

    it("selecting Most recent requests recency (Recent) order", async () => {
        const onChange = jest.fn();
        render(<RoomSearchOrderToggle order={SearchOrderBy.Rank} onSearchOrderChange={onChange} />);

        await userEvent.click(screen.getByTestId("search-order-toggle-button"));
        await userEvent.click(await screen.findByRole("menuitemradio", { name: "Most recent" }));

        expect(onChange).toHaveBeenCalledWith(SearchOrderBy.Recent);
    });

    it("checks the radio matching the active order (controlled)", async () => {
        render(<RoomSearchOrderToggle order={SearchOrderBy.Rank} onSearchOrderChange={jest.fn()} />);

        await userEvent.click(screen.getByTestId("search-order-toggle-button"));

        expect(await screen.findByRole("menuitemradio", { name: "Most relevant" })).toBeChecked();
        expect(screen.getByRole("menuitemradio", { name: "Most recent" })).not.toBeChecked();
    });

    it("shows the active-order indicator only for a non-default (relevance) order", () => {
        const { rerender } = render(
            <RoomSearchOrderToggle order={SearchOrderBy.Recent} onSearchOrderChange={jest.fn()} />,
        );
        // Default (recency): no indicator dot, and the accessible name is the neutral label.
        expect(screen.getByTestId("search-order-toggle-button")).not.toHaveAttribute("data-indicator");
        expect(screen.getByTestId("search-order-toggle-button")).toHaveAccessibleName("Sort results");

        rerender(<RoomSearchOrderToggle order={SearchOrderBy.Rank} onSearchOrderChange={jest.fn()} />);
        // Relevance: the indicator dot is shown and the active state is folded into the accessible name.
        expect(screen.getByTestId("search-order-toggle-button")).toHaveAttribute("data-indicator", "default");
        expect(screen.getByTestId("search-order-toggle-button")).toHaveAccessibleName("Sort results (by relevance)");
    });
});
