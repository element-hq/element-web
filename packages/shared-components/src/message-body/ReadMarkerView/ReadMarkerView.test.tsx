/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../viewmodel";
import {
    ReadMarkerView,
    type ReadMarkerViewActions,
    type ReadMarkerViewModel,
    type ReadMarkerViewSnapshot,
} from "./ReadMarkerView";
import * as stories from "./ReadMarkerView.stories";

const { Current, HiddenCurrent, Ghost } = composeStories(stories);

describe("ReadMarkerView", () => {
    it("renders the current read marker", () => {
        const { container } = render(<Current />);
        expect(container).toMatchSnapshot();
    });

    it("renders the hidden current read marker without a line", () => {
        const { container } = render(<HiddenCurrent />);
        expect(container).toMatchSnapshot();
        expect(container.querySelector("hr")).toBeNull();
    });

    it("renders the ghost read marker", () => {
        const { container } = render(<Ghost />);
        expect(container).toMatchSnapshot();
    });

    it("applies custom className to the list item", () => {
        const vm = new MockViewModel<ReadMarkerViewSnapshot>({
            eventId: "$event",
            kind: "current",
            showLine: true,
        }) as ReadMarkerViewModel;

        render(
            <ul>
                <ReadMarkerView vm={vm} className="custom-read-marker compatibility-class" />
            </ul>,
        );

        const item = screen.getByRole("listitem");
        expect(item).toHaveClass("custom-read-marker", "compatibility-class");
        expect(item).toHaveAttribute("data-scroll-tokens", "$event");
    });

    it("wires ghost marker actions", () => {
        const onGhostLineRef = vi.fn();
        const onGhostTransitionEnd = vi.fn();

        class GhostReadMarkerViewModel
            extends MockViewModel<ReadMarkerViewSnapshot>
            implements ReadMarkerViewActions
        {
            public onGhostLineRef = onGhostLineRef;
            public onGhostTransitionEnd = onGhostTransitionEnd;
        }

        const vm = new GhostReadMarkerViewModel({
            eventId: "$ghost",
            kind: "ghost",
        }) as ReadMarkerViewModel;

        render(
            <ul>
                <ReadMarkerView vm={vm} />
            </ul>,
        );

        const line = screen.getByRole("separator");
        fireEvent.transitionEnd(line);

        expect(onGhostLineRef).toHaveBeenCalled();
        expect(onGhostTransitionEnd).toHaveBeenCalledTimes(1);
    });

    it("wires the current marker ref", () => {
        const onCurrentMarkerRef = vi.fn();

        class CurrentReadMarkerViewModel
            extends MockViewModel<ReadMarkerViewSnapshot>
            implements ReadMarkerViewActions
        {
            public onCurrentMarkerRef = onCurrentMarkerRef;
        }

        const vm = new CurrentReadMarkerViewModel({
            eventId: "$current",
            kind: "current",
            showLine: true,
        }) as ReadMarkerViewModel;

        render(
            <ul>
                <ReadMarkerView vm={vm} />
            </ul>,
        );

        expect(onCurrentMarkerRef).toHaveBeenCalled();
    });
});
