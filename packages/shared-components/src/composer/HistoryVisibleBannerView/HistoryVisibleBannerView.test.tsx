/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";

import * as stories from "./HistoryVisibleBannerView.stories.tsx";

const { Default } = composeStories(stories);

describe("HistoryVisibleBannerView", () => {
    it("renders a history visible banner", () => {
        const dismissFn = jest.fn();

        const { container } = render(<Default onClose={dismissFn} />);
        expect(container).toMatchSnapshot();

        const button = container.querySelector("button");
        expect(button).not.toBeNull();
        button?.click();
        expect(dismissFn).toHaveBeenCalled();
    });
});
