/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { createEvent, fireEvent } from "@testing-library/dom";
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

    class DisambiguatedProfileViewModel
        extends MockViewModel<DisambiguatedProfileViewSnapshot>
        implements DisambiguatedProfileViewActions
    {
        public onClick?: DisambiguatedProfileViewActions["onClick"];

        public constructor(snapshot: DisambiguatedProfileViewSnapshot, actions: DisambiguatedProfileViewActions = {}) {
            super(snapshot);
            this.onClick = actions.onClick;
        }
    }

    const getProfileContainer = (displayName: string): HTMLDivElement => {
        const profileContainer = screen.getByText(displayName).closest("div");
        if (!profileContainer) {
            throw new Error("Expected profile container to exist");
        }
        return profileContainer;
    };

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
        const onClick = vi.fn();
        const user = userEvent.setup();
        const vm = new DisambiguatedProfileViewModel(
            {
                displayName: "Clickable User",
            },
            { onClick },
        );

        render(<DisambiguatedProfileView vm={vm} />);
        await user.click(screen.getByText("Clickable User"));
        expect(onClick).toHaveBeenCalled();
    });

    it("should set button semantics when onClick is provided", () => {
        const vm = new DisambiguatedProfileViewModel(
            {
                displayName: "Keyboard User",
            },
            { onClick: vi.fn() },
        );

        render(<DisambiguatedProfileView vm={vm} />);
        const profileContainer = getProfileContainer("Keyboard User");
        expect(profileContainer).toHaveAttribute("role", "button");
        expect(profileContainer).toHaveAttribute("tabIndex", "0");
    });

    it("should call onClick on keyboard activation keys", () => {
        const onClick = vi.fn();
        const vm = new DisambiguatedProfileViewModel(
            {
                displayName: "Keyboard User",
            },
            { onClick },
        );

        render(<DisambiguatedProfileView vm={vm} />);
        const profileContainer = getProfileContainer("Keyboard User");

        const enterEvent = createEvent.keyDown(profileContainer, { key: "Enter" });
        fireEvent(profileContainer, enterEvent);

        const spaceEvent = createEvent.keyDown(profileContainer, { key: " " });
        fireEvent(profileContainer, spaceEvent);

        expect(enterEvent.defaultPrevented).toBe(true);
        expect(spaceEvent.defaultPrevented).toBe(true);
        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it("should not call onClick for non-activation keys", () => {
        const onClick = vi.fn();
        const vm = new DisambiguatedProfileViewModel(
            {
                displayName: "Keyboard User",
            },
            { onClick },
        );

        render(<DisambiguatedProfileView vm={vm} />);
        const profileContainer = getProfileContainer("Keyboard User");

        fireEvent.keyDown(profileContainer, { key: "Escape" });
        expect(onClick).not.toHaveBeenCalled();
    });

    it("should not set button semantics when onClick is not provided", () => {
        const vm = new DisambiguatedProfileViewModel({
            displayName: "Static User",
        });

        render(<DisambiguatedProfileView vm={vm} />);
        const profileContainer = getProfileContainer("Static User");
        expect(profileContainer).not.toHaveAttribute("role");
        expect(profileContainer).not.toHaveAttribute("tabIndex");
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
