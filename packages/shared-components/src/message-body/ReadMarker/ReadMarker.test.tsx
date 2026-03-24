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
import { ReadMarker, type ReadMarkerActions, type ReadMarkerModel, type ReadMarkerSnapshot } from "./ReadMarker";
import * as stories from "./ReadMarker.stories";

const { Current, HiddenCurrent, Ghost } = composeStories(stories);

describe("ReadMarker", () => {
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
        const vm = new MockViewModel<ReadMarkerSnapshot>({
            eventId: "$event",
            kind: "current",
            showLine: true,
        }) as ReadMarkerModel;

        render(
            <ul>
                <ReadMarker vm={vm} className="custom-read-marker compatibility-class" />
            </ul>,
        );

        const item = screen.getByRole("listitem");
        expect(item).toHaveClass("custom-read-marker", "compatibility-class");
        expect(item).toHaveAttribute("data-scroll-tokens", "$event");
    });

    it("wires ghost marker actions", () => {
        const onGhostLineRef = vi.fn();
        const onGhostTransitionEnd = vi.fn();

        class GhostReadMarkerModel extends MockViewModel<ReadMarkerSnapshot> implements ReadMarkerActions {
            public onGhostLineRef = onGhostLineRef;
            public onGhostTransitionEnd = onGhostTransitionEnd;
        }

        const vm = new GhostReadMarkerModel({
            eventId: "$ghost",
            kind: "ghost",
        }) as ReadMarkerModel;

        render(
            <ul>
                <ReadMarker vm={vm} />
            </ul>,
        );

        const line = screen.getByRole("separator");
        fireEvent.transitionEnd(line);

        expect(onGhostLineRef).toHaveBeenCalled();
        expect(onGhostTransitionEnd).toHaveBeenCalledTimes(1);
    });

    it("wires the current marker ref", () => {
        const onCurrentMarkerRef = vi.fn();

        class CurrentReadMarkerModel extends MockViewModel<ReadMarkerSnapshot> implements ReadMarkerActions {
            public onCurrentMarkerRef = onCurrentMarkerRef;
        }

        const vm = new CurrentReadMarkerModel({
            eventId: "$current",
            kind: "current",
            showLine: true,
        }) as ReadMarkerModel;

        render(
            <ul>
                <ReadMarker vm={vm} />
            </ul>,
        );

        expect(onCurrentMarkerRef).toHaveBeenCalled();
    });
});
