/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as stories from "./SenderProfileView.stories";

const { Default, Hidden, WithDisambiguation } = composeStories(stories);

describe("SenderProfileView", () => {
    it("renders default sender profile", () => {
        const { container } = render(<Default />);

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("does not render when hidden", () => {
        const { container } = render(<Hidden />);

        expect(screen.queryByText("Alice")).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders disambiguated identifier", () => {
        const { container } = render(<WithDisambiguation />);

        expect(screen.getByText("@alice:example.org")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("calls onClick when clicked", async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();

        render(<Default onClick={onClick} />);
        await user.click(screen.getByRole("button", { name: "Alice" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
