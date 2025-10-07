/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "jest-matrix-react";
import React from "react";

import * as stories from "./Pill.stories";

const { Default, WithoutCloseButton } = composeStories(stories);

describe("Pill", () => {
    it("renders the pill", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the pill without close button", () => {
        const { container } = render(<WithoutCloseButton />);
        expect(container).toMatchSnapshot();
    });
});
