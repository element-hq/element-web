/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import { composeStories } from "@storybook/react-vite";
import React from "react";

import * as stories from "./TimelineSeparatorView.stories.tsx";
import { TimelineSeparatorView, type TimelineSeparatorViewSnapshot } from "./TimelineSeparatorView";
import { MockViewModel } from "../../viewmodel/MockViewModel";

const { Default, WithHtmlChild, WithoutChildren, WithDateEvent, WithLateEvent } = composeStories(stories);

describe("TimelineSeparatorView", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Snapshot tests", () => {
        it("renders the timeline separator in default state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders the timeline separator with HTML child", () => {
            const { container } = render(<WithHtmlChild />);
            expect(container).toMatchSnapshot();
        });

        it("renders the timeline separator without children", () => {
            const { container } = render(<WithDateEvent />);
            expect(container).toMatchSnapshot();
        });
        
        it("renders the timeline separator without children", () => {
            const { container } = render(<WithLateEvent />);
            expect(container).toMatchSnapshot();
        });
        it("renders the timeline separator without children", () => {
            const { container } = render(<WithoutChildren />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("Unit tests", () => {
        it("should render with correct accessibility role", () => {
            render(<Default />);
            const separator = screen.getByRole("separator");
            expect(separator).toBeDefined();
        });

        it("should have aria-label matching the provided label", () => {
            const vm = new MockViewModel<TimelineSeparatorViewSnapshot>({
                label: "Today",
                children: "Today",
            });

            render(<TimelineSeparatorView vm={vm} />);
            const separator = screen.getByRole("separator");
            expect(separator.getAttribute("aria-label")).toBe("Today");
        });

        it("should render two hr elements", () => {
            render(<Default />);
            const hrElements = document.querySelectorAll("hr");
            expect(hrElements).toHaveLength(2);
        });

        it("should render hr elements with role=none to hide from accessibility tree", () => {
            render(<Default />);
            const hrElements = document.querySelectorAll("hr");
            hrElements.forEach((hr) => {
                expect(hr.getAttribute("role")).toBe("none");
            });
        });

        it("should render children between hr elements", () => {
            const vm = new MockViewModel<TimelineSeparatorViewSnapshot>({
                label: "Yesterday",
                children: <span data-testid="custom-child">Yesterday</span>,
            });

            render(<TimelineSeparatorView vm={vm} />);
            const child = screen.getByTestId("custom-child");
            expect(child).toBeDefined();
            expect(child.textContent).toBe("Yesterday");
        });

        it("should render without children when none provided", () => {
            const vm = new MockViewModel<TimelineSeparatorViewSnapshot>({
                label: "Empty separator",
                children: undefined,
            });

            render(<TimelineSeparatorView vm={vm} />);
            const separator = screen.getByRole("separator");
            // Should only contain the two hr elements
            expect(separator.childNodes).toHaveLength(2);
        });
    });
});
