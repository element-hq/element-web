/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "jest-matrix-react";
import React from "react";
import { composeStories } from "@storybook/react-vite";

import * as stories from "./SeekBar.stories.tsx";
const { Default } = composeStories(stories);

describe("Seekbar", () => {
    it("renders the clock", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
});
