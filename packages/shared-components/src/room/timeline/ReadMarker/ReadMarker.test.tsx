/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import type { CDPSession } from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";
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

    it("gives the ghost marker a transition the browser accepts", async () => {
        // The test context sets `prefers-reduced-motion: reduce` for screenshot
        // stability (see vitest.config.ts), which would otherwise strip the transition
        // this test is asserting.
        const session = cdp() as CDPSession;
        await session.send("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
        });

        try {
            render(
                <ul>
                    <ReadMarker eventId="$ghost" kind="ghost" />
                </ul>,
            );

            // An unparseable easing drops the whole shorthand, so the ghost would vanish instantly
            // and never fire transitionend.
            const style = getComputedStyle(screen.getByRole("separator"));
            expect(style.transitionProperty).toBe("width, opacity");
            expect(style.transitionDuration).toBe("0.4s, 0.4s");
            expect(style.transitionDelay).toBe("1s, 1s");
        } finally {
            await session.send("Emulation.setEmulatedMedia", {
                features: [{ name: "prefers-reduced-motion", value: "reduce" }],
            });
        }
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
