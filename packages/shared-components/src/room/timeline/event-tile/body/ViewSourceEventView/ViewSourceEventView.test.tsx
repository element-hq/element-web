/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import {
    ViewSourceEventView,
    type ViewSourceEventViewActions,
    type ViewSourceEventViewModel,
    type ViewSourceEventViewSnapshot,
} from "./ViewSourceEventView";
import * as stories from "./ViewSourceEventView.stories";

const { Default, Expanded } = composeStories(stories);

class TestViewSourceEventViewModel
    extends MockViewModel<ViewSourceEventViewSnapshot>
    implements ViewSourceEventViewActions
{
    public constructor(
        snapshot: ViewSourceEventViewSnapshot,
        public onToggle: ViewSourceEventViewActions["onToggle"],
    ) {
        super(snapshot);
    }
}

const createVm = (
    snapshot: Partial<ViewSourceEventViewSnapshot> = {},
    onToggle: ViewSourceEventViewActions["onToggle"] = vi.fn(),
): ViewSourceEventViewModel =>
    new TestViewSourceEventViewModel(
        {
            expanded: false,
            preview: '{ "type": m.room.message }',
            source: '{\n    "type": "m.room.message"\n}',
            ...snapshot,
        },
        onToggle,
    ) as ViewSourceEventViewModel;

describe("ViewSourceEventView", () => {
    const getToggleButton = (container: HTMLElement): HTMLButtonElement => {
        const button = container.querySelector<HTMLButtonElement>('button[aria-label="toggle event"]');

        if (!button) {
            throw new Error("Expected view source toggle button to be rendered");
        }

        return button;
    };

    it("renders the default story", () => {
        const { container } = render(<Default />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText('{ "type": m.room.message }')).toBeInTheDocument();
        expect(getToggleButton(container)).toBeInTheDocument();
    });

    it("renders the expanded story", () => {
        const { container } = render(<Expanded />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText(/"sender": "@alice:example\.org"/)).toBeInTheDocument();
    });

    it("invokes the toggle action", () => {
        const onToggle = vi.fn();
        const vm = createVm({}, onToggle);

        const { container } = render(<ViewSourceEventView vm={vm} />);

        fireEvent.click(getToggleButton(container));

        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("applies custom class names to the root element", () => {
        const vm = createVm({ expanded: true });

        const { container } = render(
            <ViewSourceEventView vm={vm} className="custom-source" expandedClassName="custom-expanded" />,
        );

        expect(container.firstChild).toHaveClass("custom-source", "custom-expanded");
    });

    it("forwards the provided ref to the root span", () => {
        const ref = React.createRef<HTMLSpanElement>();
        const vm = createVm();

        render(<ViewSourceEventView vm={vm} ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    });
});
