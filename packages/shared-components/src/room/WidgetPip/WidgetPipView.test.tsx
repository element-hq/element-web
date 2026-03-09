/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, expect } from "vitest";
import { getByTestId } from "storybook/test";

import * as stories from "./WidgetPipView.stories.tsx";

const { WithGreyWidget } = composeStories(stories);

describe("WidgetPipView", () => {
    it("renders with gray widget", () => {
        const { container } = render(<WithGreyWidget />);
        expect(container).toMatchSnapshot();
    });
    it("detects back click action", async () => {
        const onBackClick = vi.fn();
        const { container, getByRole } = render(<WithGreyWidget onBackClick={onBackClick} />);
        expect(container).toMatchSnapshot();

        const button = getByRole("button", { name: "Back" });
        await userEvent.click(button);
        expect(onBackClick).toHaveBeenCalled();
    });
    it("detects double click triggers back", async () => {
        const onBackClick = vi.fn();
        const { container } = render(<WithGreyWidget onStartMoving={onBackClick} />);
        expect(container).toMatchSnapshot();

        const pipContainer = getByTestId(container, "widget-pip-container");
        await userEvent.dblClick(pipContainer);
        expect(onBackClick).toHaveBeenCalled();
    });
    it("detects on mouse down for drag", async () => {
        const onStartMoving = vi.fn();
        const { container } = render(<WithGreyWidget onStartMoving={onStartMoving} />);
        expect(container).toMatchSnapshot();

        const pipContainer = getByTestId(container, "widget-pip-container");
        await userEvent.click(pipContainer);
        expect(onStartMoving).toHaveBeenCalled();
    });
});
