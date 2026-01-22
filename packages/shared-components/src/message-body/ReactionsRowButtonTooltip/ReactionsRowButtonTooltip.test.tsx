/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "jest-matrix-react";
import React from "react";

import * as stories from "./ReactionsRowButtonTooltip.stories";

const { Default, ManySenders, WithoutCaption, NoTooltip } = composeStories(stories);

describe("ReactionsRowButtonTooltip", () => {
    it("renders the tooltip with formatted senders and caption", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the tooltip with many senders", () => {
        const { container } = render(<ManySenders />);
        expect(container).toMatchSnapshot();
    });

    it("renders the tooltip without a caption", () => {
        const { container } = render(<WithoutCaption />);
        expect(container).toMatchSnapshot();
    });

    it("renders children without tooltip when formattedSenders is undefined", () => {
        render(<NoTooltip />);
        // Should render the button without a tooltip wrapper
        expect(screen.getByRole("button")).toBeInTheDocument();
    });
});
