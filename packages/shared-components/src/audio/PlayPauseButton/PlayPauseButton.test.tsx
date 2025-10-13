/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "jest-matrix-react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { fn } from "storybook/test";

import * as stories from "./PlayPauseButton.stories.tsx";

const { Default, Playing } = composeStories(stories);

describe("PlayPauseButton", () => {
    it("renders the button in default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the button in playing state", () => {
        const { container } = render(<Playing />);
        expect(container).toMatchSnapshot();
    });

    it("calls togglePlay when clicked", async () => {
        const user = userEvent.setup();
        const togglePlay = fn();

        const { getByRole } = render(<Default togglePlay={togglePlay} />);
        await user.click(getByRole("button"));
        expect(togglePlay).toHaveBeenCalled();
    });
});
