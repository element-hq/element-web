/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { composeStories } from "@storybook/react-vite";
import { describe, it, expect, vi, beforeEach } from "vitest";

import * as stories from "./RoomListPrimaryFilters.stories";

const { Default, PeopleSelected, NoFilters, NarrowContainer, NarrowWithActiveWrappingFilter } = composeStories(stories);

describe("<RoomListPrimaryFilters /> stories", () => {
    describe("snapshots", () => {
        it("renders Default story", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders PeopleSelected story", () => {
            const { container } = render(<PeopleSelected />);
            expect(container).toMatchSnapshot();
        });

        it("renders NoFilters story", () => {
            const { container } = render(<NoFilters />);
            expect(container).toMatchSnapshot();
        });

        it("renders NarrowContainer story", () => {
            const { container } = render(<NarrowContainer />);
            expect(container).toMatchSnapshot();
        });

        it("renders NarrowWithActiveWrappingFilter story", () => {
            const { container } = render(<NarrowWithActiveWrappingFilter />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("behavior", () => {
        it("should call onToggleFilter when a filter is clicked", async () => {
            const user = userEvent.setup();
            render(<Default />);

            await user.click(screen.getByRole("option", { name: "People" }));

            expect(Default.args.onToggleFilter).toHaveBeenCalled();
        });
    });

    describe("resize behavior", () => {
        let resizeCallback: ResizeObserverCallback;

        beforeEach(() => {
            globalThis.ResizeObserver = class MockResizeObserver {
                public constructor(callback: ResizeObserverCallback) {
                    resizeCallback = callback;
                }
                public observe = vi.fn();
                public unobserve = vi.fn();
                public disconnect = vi.fn();
            } as unknown as typeof ResizeObserver;
        });

        function mockFiltersNotWrapping(): void {
            vi.spyOn(screen.getByText("People"), "offsetLeft", "get").mockReturnValue(0);
            vi.spyOn(screen.getByText("Rooms"), "offsetLeft", "get").mockReturnValue(30);
            vi.spyOn(screen.getByText("Unreads"), "offsetLeft", "get").mockReturnValue(60);

            const listbox = screen.getByRole("listbox", { name: "Room list filters" });
            act(() => resizeCallback([{ target: listbox } as any], {} as ResizeObserver));
        }

        function mockUnreadWrapping(): void {
            vi.spyOn(screen.getByText("People"), "offsetLeft", "get").mockReturnValue(0);
            vi.spyOn(screen.getByText("Rooms"), "offsetLeft", "get").mockReturnValue(30);
            vi.spyOn(screen.getByText("Unreads"), "offsetLeft", "get").mockReturnValue(0);

            const listbox = screen.getByRole("listbox", { name: "Room list filters" });
            act(() => resizeCallback([{ target: listbox } as any], {} as ResizeObserver));
        }

        it("should hide wrapping filters and show chevron", () => {
            render(<NarrowContainer />);
            mockUnreadWrapping();

            expect(screen.queryByRole("option", { name: "Unreads" })).toBeNull();
            expect(screen.getByRole("button", { name: "Expand filter list" })).toBeInTheDocument();
        });

        it("should expand and collapse filter list with chevron button", async () => {
            const user = userEvent.setup();
            render(<NarrowContainer />);
            mockUnreadWrapping();

            expect(screen.queryByRole("option", { name: "Unreads" })).toBeNull();

            await user.click(screen.getByRole("button", { name: "Expand filter list" }));
            expect(screen.getByRole("option", { name: "Unreads" })).toBeVisible();

            await user.click(screen.getByRole("button", { name: "Collapse filter list" }));
            expect(screen.queryByRole("option", { name: "Unreads" })).toBeNull();
        });

        it("should move active filter to front when collapsed and wrapping", () => {
            render(<NarrowWithActiveWrappingFilter />);
            mockUnreadWrapping();

            const listbox = screen.getByRole("listbox", { name: "Room list filters" });
            expect(listbox.children[0]).toBe(screen.getByRole("option", { name: "Unreads" }));
        });

        it("should restore original filter order when expanded", async () => {
            const user = userEvent.setup();
            render(<NarrowWithActiveWrappingFilter />);
            mockUnreadWrapping();

            await user.click(screen.getByRole("button", { name: "Expand filter list" }));

            const listbox = screen.getByRole("listbox", { name: "Room list filters" });
            expect(listbox.children[0]).toBe(screen.getByRole("option", { name: "People" }));
        });

        it("should handle resize from non-wrapping to wrapping", () => {
            render(<NarrowContainer />);
            mockFiltersNotWrapping();

            expect(screen.queryByRole("button", { name: "Expand filter list" })).toBeNull();

            mockUnreadWrapping();
            expect(screen.getByRole("button", { name: "Expand filter list" })).toBeInTheDocument();
        });
    });
});
