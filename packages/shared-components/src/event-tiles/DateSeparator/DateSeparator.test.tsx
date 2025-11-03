/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "jest-matrix-react";
import React from "react";

import { DateSeparator } from "./DateSeparator";

describe("DateSeparator", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Set a fixed "now" time for consistent testing
        jest.setSystemTime(new Date("2024-11-03T12:00:00Z"));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("renders today's date", () => {
        const { container } = render(<DateSeparator ts={new Date("2024-11-03T10:00:00Z").getTime()} locale="en" />);
        expect(container).toMatchSnapshot();
        expect(container.textContent).toContain("today");
    });

    it("renders yesterday's date", () => {
        const { container } = render(<DateSeparator ts={new Date("2024-11-02T10:00:00Z").getTime()} locale="en" />);
        expect(container).toMatchSnapshot();
        expect(container.textContent).toContain("yesterday");
    });

    it("renders a weekday for dates within the last 6 days", () => {
        // 4 days ago
        const { container } = render(<DateSeparator ts={new Date("2024-10-30T10:00:00Z").getTime()} locale="en" />);
        expect(container).toMatchSnapshot();
        // Should show a day name like "Wednesday"
        expect(container.querySelector(".mx_DateSeparator_dateHeading")).toBeTruthy();
    });

    it("renders full date for dates older than 6 days", () => {
        const { container } = render(<DateSeparator ts={new Date("2024-10-01T10:00:00Z").getTime()} locale="en" />);
        expect(container).toMatchSnapshot();
        expect(container.textContent).toContain("Oct");
    });

    it("renders full date when relative timestamps are disabled", () => {
        const { container } = render(
            <DateSeparator ts={new Date("2024-11-03T10:00:00Z").getTime()} locale="en" disableRelativeTimestamps />,
        );
        expect(container).toMatchSnapshot();
        // Should show full date even though it's today
        expect(container.textContent).toContain("Nov");
    });

    it("applies custom className", () => {
        const { container } = render(
            <DateSeparator ts={Date.now()} locale="en" className="custom-class" />,
        );
        expect(container.querySelector(".mx_DateSeparator.custom-class")).toBeTruthy();
    });

    it("has correct ARIA attributes", () => {
        const { container } = render(<DateSeparator ts={Date.now()} locale="en" />);
        const separator = container.querySelector('[role="separator"]');
        expect(separator).toBeTruthy();
        expect(separator?.getAttribute("aria-label")).toBeTruthy();
    });
});
