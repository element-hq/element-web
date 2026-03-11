/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect } from "vitest";
import React from "react";

import * as stories from "./UrlPreviewGroupView.stories.tsx";

const { Default, MultiplePreviewsHidden, MultiplePreviewsVisible, WithCompactView } = composeStories(stories);

describe("UrlPreviewGroupView", () => {
    it("renders a single preview", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
    it("renders multiple previews", () => {
        const { container } = render(<MultiplePreviewsVisible />);
        expect(container).toMatchSnapshot();
    });
    it("renders multiple previews which are hidden", () => {
        const { container } = render(<MultiplePreviewsHidden />);
        expect(container).toMatchSnapshot();
    });
    it("renders with a compact view", () => {
        const { container } = render(<WithCompactView />);
        expect(container).toMatchSnapshot();
    });
});
