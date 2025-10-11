/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render } from "jest-matrix-react";
import React from "react";

import * as stories from "./Clock.stories.tsx";

const { Default, LotOfSeconds } = composeStories(stories);

describe("Clock", () => {
    it("renders the clock", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the clock with a lot of seconds", () => {
        const { container } = render(<LotOfSeconds />);
        expect(container).toMatchSnapshot();
    });
});
