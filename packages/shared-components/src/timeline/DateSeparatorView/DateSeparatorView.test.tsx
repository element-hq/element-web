/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import { describe, it, expect } from "vitest";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DateSeparatorView, type DateSeparatorViewModel, type DateSeparatorViewSnapshot } from "./DateSeparatorView";
import * as stories from "./DateSeparatorView.stories";

const { Default, HasExtraClassNames, WithJumpToDatePicker, LongLocalizedLabel } = composeStories(stories);

class MutableDateSeparatorViewModel implements DateSeparatorViewModel {
    private listeners = new Set<() => void>();

    public constructor(private snapshot: DateSeparatorViewSnapshot) {}

    public setSnapshot(snapshot: DateSeparatorViewSnapshot): void {
        this.snapshot = snapshot;
        for (const listener of this.listeners) {
            listener();
        }
    }

    public getSnapshot = (): DateSeparatorViewSnapshot => {
        return this.snapshot;
    };

    public subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    public onLastWeekPicked = (): void => undefined;
    public onLastMonthPicked = (): void => undefined;
    public onBeginningPicked = (): void => undefined;
    public onDatePicked = (_dateString: string): void => undefined;
}

describe("DateSeparatorView", () => {
    it("renders default story", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
        expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("renders with extra class names", () => {
        const { container } = render(<HasExtraClassNames />);
        expect(container).toMatchSnapshot();
        expect(container.firstElementChild).toHaveClass("extra_class_1");
        expect(container.firstElementChild).toHaveClass("extra_class_2");
    });

    it("renders with jump to date picker story", async () => {
        const { container } = render(<WithJumpToDatePicker />);
        expect(container).toMatchSnapshot();
        await userEvent.click(screen.getByTestId("jump-to-date-separator-button"));
        await expect(screen.findByTestId("jump-to-date-last-week")).resolves.toBeInTheDocument();
    });

    it("renders long localized label story", () => {
        const { container } = render(<LongLocalizedLabel />);
        expect(container).toMatchSnapshot();
        expect(
            screen.getByText("Wednesday, December 17, 2025 at 11:59 PM Coordinated Universal Time"),
        ).toBeInTheDocument();
    });

    it("updates when view model snapshot changes", async () => {
        const vm = new MutableDateSeparatorViewModel({ label: "Today" });
        render(<DateSeparatorView vm={vm} />);

        expect(screen.getByText("Today", { selector: "h2" })).toBeInTheDocument();
        vm.setSnapshot({ label: "Yesterday" });
        await waitFor(() => expect(screen.getByText("Yesterday", { selector: "h2" })).toBeInTheDocument());
    });
});
