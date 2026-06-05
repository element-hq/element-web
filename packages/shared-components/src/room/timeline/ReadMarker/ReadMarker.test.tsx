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

import { ReadMarker } from "./ReadMarker";
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
        render(
            <ul>
                <ReadMarker
                    eventId="$event"
                    kind="current"
                    showLine={true}
                    className="custom-read-marker compatibility-class"
                />
            </ul>,
        );

        const item = screen.getByRole("listitem");
        expect(item).toHaveClass("custom-read-marker", "compatibility-class");
        expect(item).toHaveAttribute("data-scroll-tokens", "$event");
    });

    it("wires ghost marker actions", () => {
        const onGhostLineRef = vi.fn();
        const onGhostTransitionEnd = vi.fn();

        render(
            <ul>
                <ReadMarker
                    eventId="$ghost"
                    kind="ghost"
                    onGhostLineRef={onGhostLineRef}
                    onGhostTransitionEnd={onGhostTransitionEnd}
                />
            </ul>,
        );

        const line = screen.getByRole("separator");
        fireEvent.transitionEnd(line);

        expect(onGhostLineRef).toHaveBeenCalled();
        expect(onGhostTransitionEnd).toHaveBeenCalledTimes(1);
    });

    it("wires the current marker ref", () => {
        const onCurrentMarkerRef = vi.fn();

        render(
            <ul>
                <ReadMarker eventId="$current" kind="current" showLine={true} onCurrentMarkerRef={onCurrentMarkerRef} />
            </ul>,
        );

        expect(onCurrentMarkerRef).toHaveBeenCalled();
    });
});
