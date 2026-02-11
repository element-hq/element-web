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

import { DateSeparatorView, type DateSeparatorViewSnapshot } from "./DateSeparatorView";
import { MockViewModel } from "../../viewmodel";
import * as stories from "./DateSeparatorView.stories";
import { type ViewModel } from "../../viewmodel/ViewModel";

const { Default, HasExtraClassNames } = composeStories(stories);

class MutableDateSeparatorViewModel implements ViewModel<DateSeparatorViewSnapshot> {
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
}

describe("DateSeparatorView", () => {
    function customRender(
        snapshot: DateSeparatorViewSnapshot = {
            label: "Today",
            className: "",
        },
    ): ReturnType<typeof render> {
        return render(<DateSeparatorView vm={new MockViewModel(snapshot)} />);
    }

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

    it("renders jumpToDateMenu instead of default heading", () => {
        const { queryByRole, getByTestId } = customRender({
            label: "Today",
            jumpToDateMenu: <button data-testid="custom-jump-menu">Jump</button>,
        });

        expect(getByTestId("custom-jump-menu")).toBeInTheDocument();
        expect(queryByRole("heading", { level: 2, name: "Today" })).not.toBeInTheDocument();
    });

    it("updates when view model snapshot changes", async () => {
        const vm = new MutableDateSeparatorViewModel({ label: "Today" });
        render(<DateSeparatorView vm={vm} />);

        expect(screen.getByText("Today", { selector: "h2" })).toBeInTheDocument();
        vm.setSnapshot({ label: "Yesterday" });
        await waitFor(() => expect(screen.getByText("Yesterday", { selector: "h2" })).toBeInTheDocument());
    });
});
