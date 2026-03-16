/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import userEvent from "@testing-library/user-event";
import { composeStories } from "@storybook/react-vite";
import { render } from "@test-utils";
import React from "react";
import { describe, it, expect } from "vitest";

import * as stories from "./QuickSettingsMenu.stories.tsx";

const { Default, LongerName } = composeStories(stories);

describe("QuickSettingsMenu", () => {
    it("renders a basic menu", async () => {
        const { container, getByRole } = render(<Default />);
        await userEvent.click(getByRole("button"));

        expect(container).toMatchSnapshot();
    });
    it("renders a menu with a longer name", async () => {
        const { container, getByRole } = render(<LongerName />);
        await userEvent.click(getByRole("button"));

        expect(container).toMatchSnapshot();
    });
});
