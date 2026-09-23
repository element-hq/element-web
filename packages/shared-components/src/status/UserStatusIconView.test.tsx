/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@test-utils";

import * as stories from "./UserStatusIconView.stories";

const { Default, NoStatus } = composeStories(stories);

describe("UserStatusIconView", () => {
    it("renders nothing when the user has no status", () => {
        const { container } = render(<NoStatus />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the status emoji", () => {
        render(<Default />);
        expect(screen.getByText("🐎")).toBeInTheDocument();
    });

    it("shows the status text in a tooltip on hover", async () => {
        render(<Default />);

        await userEvent.hover(screen.getByText("🐎"));
        await waitFor(() => {
            expect(screen.getByRole("tooltip")).toHaveTextContent("on a horse");
        });
    });
});
