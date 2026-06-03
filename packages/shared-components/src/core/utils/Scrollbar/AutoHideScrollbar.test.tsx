/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutoHideScrollbar } from "./AutoHideScrollbar";

describe("AutoHideScrollbar", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders children with the default scrollbar props", () => {
        render(
            <AutoHideScrollbar data-testid="scrollbar">
                <div>Item 1</div>
            </AutoHideScrollbar>,
        );

        const scrollbar = screen.getByTestId("scrollbar");

        expect(scrollbar).toHaveAttribute("tabindex", "-1");
        expect(scrollbar.className).toContain("scrollbar");
        expect(screen.getByText("Item 1")).toBeInTheDocument();
    });

    it("forwards props to the requested element", () => {
        render(
            <AutoHideScrollbar as="section" aria-label="Scrollable content" data-testid="scrollbar">
                <div>Item 1</div>
            </AutoHideScrollbar>,
        );

        const scrollbar = screen.getByTestId("scrollbar");

        expect(scrollbar.tagName).toBe("SECTION");
        expect(scrollbar).toHaveAttribute("aria-label", "Scrollable content");
    });

    it("attaches the scroll listener and reports the scroll container ref", async () => {
        const onScroll = vi.fn<(event: Event) => void>();
        const wrappedRef = vi.fn<(ref: HTMLDivElement | null) => void>();
        const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");
        const removeEventListenerSpy = vi.spyOn(HTMLElement.prototype, "removeEventListener");

        const { unmount } = render(
            <AutoHideScrollbar data-testid="scrollbar" onScroll={onScroll} wrappedRef={wrappedRef}>
                <div style={{ height: 1000 }}>Scrollable content</div>
            </AutoHideScrollbar>,
        );

        const scrollbar = screen.getByTestId("scrollbar");

        await waitFor(() => expect(wrappedRef).toHaveBeenCalledWith(scrollbar));
        expect(addEventListenerSpy).toHaveBeenCalledWith("scroll", onScroll, { passive: true });

        fireEvent.scroll(scrollbar);
        expect(onScroll).toHaveBeenCalledTimes(1);

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", onScroll);
        expect(wrappedRef).toHaveBeenLastCalledWith(null);

        fireEvent.scroll(scrollbar);
        expect(onScroll).toHaveBeenCalledTimes(1);
    });

    it("provides wrappedRef before parent componentDidMount runs", () => {
        const calls: Array<string> = [];

        class TimingProbe extends React.Component {
            private scrollNode: HTMLDivElement | null = null;

            public componentDidMount(): void {
                calls.push("parent-did-mount");
                expect(this.scrollNode).not.toBeNull();
            }

            public render(): React.ReactNode {
                return (
                    <AutoHideScrollbar
                        data-testid="scrollbar"
                        wrappedRef={(node) => {
                            calls.push(node ? "wrapped-ref" : "wrapped-ref-null");
                            this.scrollNode = node;
                        }}
                    >
                        <div>Item 1</div>
                    </AutoHideScrollbar>
                );
            }
        }

        render(<TimingProbe />);

        expect(calls).toEqual(["wrapped-ref", "parent-did-mount"]);
        expect(screen.getByTestId("scrollbar")).toBeInTheDocument();
    });
});
