/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HiddenMediaPlaceholder } from "./HiddenMediaPlaceholder";
import * as stories from "./HiddenMediaPlaceholder.stories";

const { Default } = composeStories(stories);

describe("HiddenMediaPlaceholder", () => {
    it("renders the default story", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        expect(screen.getByRole("button", { name: "Show image" })).toBeInTheDocument();
    });

    it("invokes the click handler", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        render(<HiddenMediaPlaceholder onClick={onClick}>Show image</HiddenMediaPlaceholder>);

        await user.click(screen.getByRole("button", { name: "Show image" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("applies a custom className to the root button", () => {
        render(
            <HiddenMediaPlaceholder onClick={vi.fn()} className="custom-hidden-media">
                Show image
            </HiddenMediaPlaceholder>,
        );

        expect(screen.getByRole("button", { name: "Show image" })).toHaveClass("custom-hidden-media");
    });
});
