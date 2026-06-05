/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React, { createRef } from "react";
import { describe, it, expect } from "vitest";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BaseViewModel } from "../../../core/viewmodel/BaseViewModel";
import { DateSeparatorButton } from "./DateSeparatorButton";
import { DateSeparatorView, type DateSeparatorViewModel, type DateSeparatorViewSnapshot } from "./DateSeparatorView";
import * as stories from "./DateSeparatorView.stories";

const { Default, HasExtraClassNames, WithJumpToDatePicker, LongLocalizedLabel } = composeStories(stories);

class MutableDateSeparatorViewModel
    extends BaseViewModel<DateSeparatorViewSnapshot, undefined>
    implements DateSeparatorViewModel
{
    public constructor(snapshot: DateSeparatorViewSnapshot) {
        super(undefined, snapshot);
    }

    public setSnapshot(snapshot: DateSeparatorViewSnapshot): void {
        this.snapshot.set(snapshot);
    }

    public onLastWeekPicked = (): void => undefined;
    public onLastMonthPicked = (): void => undefined;
    public onBeginningPicked = (): void => undefined;
    public onDatePicked = (_dateString: string): void => undefined;
}

describe("DateSeparatorView", () => {
    it("renders default story", () => {
        const { container } = render(<Default />);
        expect(screen.getByText("Today")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders with extra class names", () => {
        const { container } = render(<HasExtraClassNames />);
        expect(container.firstElementChild).toHaveClass("extra_class_1");
        expect(container.firstElementChild).toHaveClass("extra_class_2");
        expect(container).toMatchSnapshot();
    });

    it("renders with jump to date picker story", async () => {
        const { container } = render(<WithJumpToDatePicker />);
        await userEvent.click(screen.getByTestId("jump-to-date-separator-button"));
        await expect(screen.findByTestId("jump-to-date-last-week")).resolves.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders long localized label story", () => {
        const { container } = render(<LongLocalizedLabel />);
        expect(
            screen.getByText("Wednesday, December 17, 2025 at 11:59 PM Coordinated Universal Time"),
        ).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("updates when view model snapshot changes", async () => {
        const vm = new MutableDateSeparatorViewModel({ label: "Today" });
        render(<DateSeparatorView vm={vm} />);

        expect(screen.getByText("Today", { selector: "h2" })).toBeInTheDocument();
        vm.setSnapshot({ label: "Yesterday" });
        await waitFor(() => expect(screen.getByText("Yesterday", { selector: "h2" })).toBeInTheDocument());
    });

    it("forwards refs to the trigger element", () => {
        const ref = createRef<HTMLDivElement>();

        render(<DateSeparatorButton ref={ref} label="Today" />);

        expect(ref.current).toBe(screen.getByTestId("jump-to-date-separator-button"));
    });
});
