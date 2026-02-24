/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";
import userEvent from "@testing-library/user-event";

import * as stories from "./LinkPreview.stories.tsx";

const { Default, WithCompactLayout, WithTooltip, Title, TitleAndDescription } = composeStories(stories);

describe("LinkPreview", () => {
    it("renders a preview", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a preview with just a title", () => {
        const { container } = render(<Title />);
        expect(container).toMatchSnapshot();
    });
    it("renders a preview with just a title and description", () => {
        const { container } = render(<TitleAndDescription />);
        expect(container).toMatchSnapshot();
    });
    it("renders a preview with a tooltip", async () => {
        const user = userEvent.setup();
        render(<WithTooltip />);
        await user.tab();
        expect(screen.getByText("A simple title")).toHaveFocus();
        // Tooltip has the URL
        expect(await screen.findByText("https://matrix.org/")).toBeVisible();
    });
    it("renders a preview with a compact layout", () => {
        const { container } = render(<WithCompactLayout />);
        expect(container).toMatchSnapshot();
    });
});
