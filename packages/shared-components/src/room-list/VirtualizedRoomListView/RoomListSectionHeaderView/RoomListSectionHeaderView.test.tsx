/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";

import * as stories from "./RoomListSectionHeaderView.stories";

const { Default } = composeStories(stories);

describe("<RoomListSectionHeaderView /> stories", () => {
    it("renders Default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("should call onClick when the header is clicked", async () => {
        const user = userEvent.setup();

        const { getByRole } = render(<Default />);
        const button = getByRole("gridcell", { name: "Toggle Favourites section" });
        await user.click(button);
        expect(Default.args.onClick).toHaveBeenCalled();
    });
});
