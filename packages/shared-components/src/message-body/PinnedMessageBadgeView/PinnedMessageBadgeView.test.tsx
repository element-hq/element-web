/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { render } from "@test-utils";

import * as stories from "./PinnedMessageBadgeView.stories";

const { Default, WithAriaDescription } = composeStories(stories);

describe("PinnedMessageBadge", () => {
    it("renders the default badge", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders the badge with host attributes", () => {
        const { container } = render(<WithAriaDescription />);
        expect(container).toMatchSnapshot();
    });
});
