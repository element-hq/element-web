/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import '@testing-library/jest-dom';


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
        jest.clearAllMocks();
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

    const onClick = jest.fn();

    class DisambiguatedProfileViewModel
        extends MockViewModel<DisambiguatedProfileViewSnapshot>
        implements DisambiguatedProfileViewActions
    {
        public onClick = onClick;
    }

    it("should display the display name", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "Eve",
                userId: "@eve:matrix.org",
                roomId: "!room:example.org",
                disambiguate: false,
            },
            fallbackName: "Eve",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.getByText("Eve")).toBeInTheDocument();
    });

    it("should display the MXID when provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "Test User",
                userId: "@test:example.org",
                roomId: "!room:example.org",
                disambiguate: true,
            },
            fallbackName: "Test User",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.getByText("@test:example.org")).toBeInTheDocument();
    });

    it("should not display the MXID when not provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "Test User",
                userId: "@test:example.org",
                roomId: "!room:example.org",
                disambiguate: false,
            },
            fallbackName: "Test User",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.queryByText("@test:example.org")).not.toBeInTheDocument();
    });

    it("should call onClick when clicked", async () => {
        const user = userEvent.setup();
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "Clickable User",
                userId: "@clickable:example.org",
                roomId: "!room:example.org",
                disambiguate: false,
            },
            fallbackName: "Clickable User",
            
        });

        render(<DisambiguatedProfileView vm={vm} />);
        await user.click(screen.getByText("Clickable User"));
        expect(onClick).toHaveBeenCalled();
    });

    it("should display tooltip title when provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "User With Tooltip",
                userId: "@user:example.org",
                roomId: "!room:example.org",
                disambiguate: false,
            },
            fallbackName: "User With Tooltip",  
            withTooltip: true,        
        });

        render(<DisambiguatedProfileView vm={vm} />);
        expect(screen.getByText("User With Tooltip").closest("div")).toHaveAttribute(
            "title",
            "timeline|disambiguated_profile",
        );
    });

    it("should apply color class when provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "Colored User",
                userId: "@colored:example.org",
                roomId: "!room:example.org",
                disambiguate: false,
            },
            fallbackName: "Colored User",
            colored: true,
        });

        render(<DisambiguatedProfileView vm={vm} />);
        const displayNameElement = screen.getByText("Colored User");
        expect(displayNameElement.className).toMatch(/mx_Username_color\d+/);
    });

    it("should apply emphasis styling when emphasizeDisplayName is true", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: {
                rawDisplayName: "Emphasized User",
                userId: "@emphasized:example.org",
                roomId: "!room:example.org",
                disambiguate: false,
            },
            fallbackName: "Emphasized User",
            emphasizeDisplayName: true,
        });

        render(<DisambiguatedProfileView vm={vm} />);
        const displayNameElement = screen.getByText("Emphasized User");
        expect(displayNameElement).toHaveClass("mx_DisambiguatedProfile_displayName");
    });
});
