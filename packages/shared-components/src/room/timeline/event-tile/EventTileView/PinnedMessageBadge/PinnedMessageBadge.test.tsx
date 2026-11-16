/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { render, screen } from "@test-utils";

import * as stories from "./PinnedMessageBadge.stories";

const { Default } = composeStories(stories);

describe("PinnedMessageBadge", () => {
    it("renders the default badge", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("keeps its label on one line in a narrow footer", () => {
        // The event footer is a flex row, so the reactions next to the badge squeeze it when space is short.
        render(
            <div style={{ display: "flex", width: "120px" }}>
                <Default />
                <span>Reactions that take up the rest of the footer</span>
            </div>,
        );

        const label = document.createRange();
        label.selectNodeContents(screen.getByText("Pinned message").lastChild!);
        expect(label.getClientRects()).toHaveLength(1);
    });
});
