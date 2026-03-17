/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./UserMenu.stories.tsx";

const { Default, LongerName, Condensed } = composeStories(stories);

describe("UserMenu", () => {
    it("renders a button", async () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders a button with a longer name", async () => {
        const { container } = render(<LongerName />);
        expect(container).toMatchSnapshot();
    });
    it("renders condensed view", async () => {
        const { container } = render(<Condensed />);
        expect(container).toMatchSnapshot();
    });
    it("renders a menu", async () => {
        const { baseElement, getByRole } = render(<Default />);
        await userEvent.click(getByRole("button"));
        expect(baseElement).toMatchSnapshot();
    });
});
