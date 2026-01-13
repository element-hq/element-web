/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import React from "react";

import * as stories from "./TimelineSeparatorView.stories.tsx";

const { Default } = composeStories(stories);

describe("TimelineSeparatorView", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("renders the audio player in default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

});
