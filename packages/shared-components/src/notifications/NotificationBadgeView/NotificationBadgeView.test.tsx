/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import { describe, expect, it } from "vitest";

import * as stories from "./NotificationBadgeView.stories";

const { Notification, Dot, Knocked, Hidden } = composeStories(stories);

describe("NotificationBadgeView", () => {
    it("renders the default notification badge", () => {
        const { container } = render(<Notification />);

        expect(container).toMatchSnapshot();
    });

    it("renders a dot badge", () => {
        render(<Dot />);

        expect(screen.getByTestId("notification-badge")).toHaveAttribute("data-badge-type", "dot");
    });

    it("renders a knocked badge icon", () => {
        render(<Knocked />);

        expect(screen.getByLabelText("Request to join sent")).toBeInTheDocument();
    });

    it("does not render when hidden", () => {
        const { container } = render(<Hidden />);

        expect(container.firstChild).toBeNull();
    });
});
