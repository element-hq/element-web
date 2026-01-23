/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@test-utils";

import * as stories from "./DisambiguatedProfile.stories";
import {
    DisambiguatedProfileView,
    type DisambiguatedProfileViewActions,
    type DisambiguatedProfileViewSnapshot,
} from "./DisambiguatedProfileView";
import { MockViewModel } from "../../viewmodel/MockViewModel";

const { Default, WithMxid, WithColorClass, Emphasized, WithTooltip, FullExample } = composeStories(stories);

describe("DisambiguatedProfileView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders the default state", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders with MXID for disambiguation", () => {
        const { container } = render(<WithMxid />);
        expect(container).toMatchSnapshot();
    });

    it("renders with color class", () => {
        const { container } = render(<WithColorClass />);
        expect(container).toMatchSnapshot();
    });

    it("renders with emphasized display name", () => {
        const { container } = render(<Emphasized />);
        expect(container).toMatchSnapshot();
    });

    it("renders with tooltip", () => {
        const { container } = render(<WithTooltip />);
        expect(container).toMatchSnapshot();
    });

    it("renders the full example", () => {
        const { container } = render(<FullExample />);
        expect(container).toMatchSnapshot();
    });

    const onClick = vi.fn();

    class DisambiguatedProfileViewModel
        extends MockViewModel<DisambiguatedProfileViewSnapshot>
        implements DisambiguatedProfileViewActions
    {
        public onClick = onClick;
    }

    it("should display the display name", () => {
        const vm = new DisambiguatedProfileViewModel({
            displayName: "Eve",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.getByText("Eve")).toBeInTheDocument();
    });

    it("should display the MXID when provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            displayName: "Test User",
            displayIdentifier: "@test:example.org",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.getByText("@test:example.org")).toBeInTheDocument();
    });

    it("should call onClick when clicked", async () => {
        const user = userEvent.setup();
        const vm = new DisambiguatedProfileViewModel({
            displayName: "Clickable User",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        await user.click(screen.getByText("Clickable User"));
        expect(onClick).toHaveBeenCalled();
    });

    it("should display tooltip title when provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            displayName: "User With Tooltip",
            title: "User With Tooltip (@user:example.org)",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.getByText("User With Tooltip").closest("div")).toHaveAttribute(
            "title",
            "User With Tooltip (@user:example.org)",
        );
    });

    it("should apply color class when provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            displayName: "Colored User",
            colorClass: "mx_Username_color3",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        const displayNameElement = screen.getByText("Colored User");
        expect(displayNameElement).toHaveClass("mx_Username_color3");
    });

    it("should apply emphasis styling when emphasizeDisplayName is true", () => {
        const vm = new DisambiguatedProfileViewModel({
            displayName: "Emphasized User",
            emphasizeDisplayName: true,
        });

        render(<DisambiguatedProfileView vm={vm} />);
        const displayNameElement = screen.getByText("Emphasized User");
        expect(displayNameElement).toHaveClass("mx_DisambiguatedProfile_displayName");
    });
});
