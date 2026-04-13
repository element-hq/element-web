/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "@test-utils";
import { VirtuosoMockContext } from "react-virtuoso";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BaseViewModel } from "../../../core/viewmodel";
import {
    getContiguousWindowShift,
    getPostInitialFillBottomSnapIndex,
    getScrollLocationOnChange,
    shouldPaginateBackwardAtTopScroll,
    shouldIgnoreStartReached,
    shouldIgnoreAtBottomStateChange,
    TimelineView,
} from "./TimelineView";
import type { TimelineItem, TimelineViewActions, TimelineViewSnapshot } from "./types";

class TestTimelineViewModel
    extends BaseViewModel<TimelineViewSnapshot<TimelineItem>, undefined>
    implements TimelineViewActions
{
    public constructor(snapshot: TimelineViewSnapshot<TimelineItem>) {
        super(undefined, snapshot);
    }

    public onRequestMoreItems = vi.fn();
    public onInitialFillCompleted = vi.fn();
    public onVisibleRangeChanged = vi.fn();
    public onScrollTargetReached = vi.fn();
    public onIsAtLiveEdgeChanged = vi.fn();
}

function makeSnapshot(partial?: Partial<TimelineViewSnapshot<TimelineItem>>): TimelineViewSnapshot<TimelineItem> {
    return {
        items: [
            { key: "alpha", kind: "event" },
            { key: "beta", kind: "event" },
            { key: "gamma", kind: "event" },
        ],
        isAtLiveEdge: true,
        canPaginateBackward: false,
        canPaginateForward: false,
        backwardPagination: "idle",
        forwardPagination: "idle",
        scrollTarget: null,
        ...partial,
    };
}

function renderTimeline(vm: TestTimelineViewModel): ReturnType<typeof render> {
    return render(<TimelineView vm={vm} renderItem={(item) => <div>{item.key}</div>} />, {
        wrapper: ({ children }) => (
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                {children}
            </VirtuosoMockContext.Provider>
        ),
    });
}

describe("TimelineView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders timeline items", () => {
        renderTimeline(new TestTimelineViewModel(makeSnapshot()));

        expect(screen.getByText("alpha")).toBeTruthy();
        expect(screen.getByText("beta")).toBeTruthy();
        expect(screen.getByText("gamma")).toBeTruthy();
    });

    it("requests an initial scroll to the bottom when mounted at the live end", () => {
        expect(
            getScrollLocationOnChange({
                items: makeSnapshot().items,
                scrollTarget: null,
                isAtLiveEdge: true,
                totalCount: 3,
                lastAnchoredKey: null,
                initialBottomSnapDone: false,
            }),
        ).toMatchObject({
            index: 2,
            align: "end",
            behavior: "auto",
        });
    });

    it("does not request an initial bottom scroll when not at the live end", () => {
        expect(
            getScrollLocationOnChange({
                items: makeSnapshot().items,
                scrollTarget: null,
                isAtLiveEdge: false,
                totalCount: 3,
                lastAnchoredKey: null,
                initialBottomSnapDone: false,
            }),
        ).toBe(false);
    });

    it("does not request another scroll when the current target key was already anchored", () => {
        expect(
            getScrollLocationOnChange({
                items: makeSnapshot().items,
                scrollTarget: { targetKey: "beta", position: "center", highlight: true },
                isAtLiveEdge: false,
                totalCount: 3,
                lastAnchoredKey: "beta",
                initialBottomSnapDone: true,
            }),
        ).toBe(false);
    });

    it("does not request a scroll when the target item is missing", () => {
        expect(
            getScrollLocationOnChange({
                items: makeSnapshot().items,
                scrollTarget: { targetKey: "missing", position: "bottom", highlight: false },
                isAtLiveEdge: false,
                totalCount: 3,
                lastAnchoredKey: null,
                initialBottomSnapDone: true,
            }),
        ).toBe(false);
    });

    it("requests a post-fill bottom snap after startup backfill completes", () => {
        expect(
            getPostInitialFillBottomSnapIndex({
                initialFillState: "done",
                isAtLiveEdge: true,
                hasScrollTarget: false,
                itemCount: 5,
                firstItemIndex: 100,
                postInitialFillBottomSnapDone: false,
            }),
        ).toBe(104);
    });

    it("does not request a post-fill bottom snap when a scroll target is pending", () => {
        expect(
            getPostInitialFillBottomSnapIndex({
                initialFillState: "done",
                isAtLiveEdge: true,
                hasScrollTarget: true,
                itemCount: 5,
                firstItemIndex: 100,
                postInitialFillBottomSnapDone: false,
            }),
        ).toBeNull();
    });

    it("ignores atBottom state changes during initial fill for live timelines", () => {
        expect(
            shouldIgnoreAtBottomStateChange({
                initialFillState: "filling",
                hasScrollTarget: false,
            }),
        ).toBe(true);
    });

    it("ignores startReached when already pinned to the live bottom", () => {
        expect(
            shouldIgnoreStartReached({
                initialFillState: "done",
                isAtLiveEdge: true,
                hasScrollTarget: false,
            }),
        ).toBe(true);
    });

    it("allows backward pagination when the user scrolls to the top after initial fill", () => {
        expect(
            shouldPaginateBackwardAtTopScroll({
                initialFillState: "done",
                isAtLiveEdge: false,
                hasScrollTarget: false,
                backwardPagination: "idle",
                canPaginateBackward: true,
                scrollTop: 0,
            }),
        ).toBe(true);
    });

    it("detects a backward sliding-window shift when older items are prepended and newer tail items are trimmed", () => {
        const prevItems: TimelineItem[] = Array.from({ length: 60 }, (_, index) => ({
            key: `event-${index + 31}`,
            kind: "event",
        }));
        const nextItems: TimelineItem[] = Array.from({ length: 70 }, (_, index) => ({
            key: `event-${index + 11}`,
            kind: "event",
        }));

        expect(getContiguousWindowShift(prevItems, nextItems)).toBe(20);
    });

    it("detects a forward sliding-window shift when older head items are trimmed", () => {
        const prevItems: TimelineItem[] = Array.from({ length: 70 }, (_, index) => ({
            key: `event-${index + 11}`,
            kind: "event",
        }));
        const nextItems: TimelineItem[] = Array.from({ length: 60 }, (_, index) => ({
            key: `event-${index + 31}`,
            kind: "event",
        }));

        expect(getContiguousWindowShift(prevItems, nextItems)).toBe(-20);
    });

    it("ignores non-contiguous overlap when computing a window shift", () => {
        const prevItems: TimelineItem[] = [
            { key: "alpha", kind: "event" },
            { key: "beta", kind: "event" },
            { key: "gamma", kind: "event" },
        ];
        const nextItems: TimelineItem[] = [
            { key: "prepended", kind: "event" },
            { key: "alpha", kind: "event" },
            { key: "gamma", kind: "event" },
        ];

        expect(getContiguousWindowShift(prevItems, nextItems)).toBe(0);
    });

    it("does not paginate backward from top scroll when a request is already loading", () => {
        expect(
            shouldPaginateBackwardAtTopScroll({
                initialFillState: "done",
                isAtLiveEdge: false,
                hasScrollTarget: false,
                backwardPagination: "loading",
                canPaginateBackward: true,
                scrollTop: 0,
            }),
        ).toBe(false);
    });

    it("reports visible range and bottom state", async () => {
        const vm = new TestTimelineViewModel(makeSnapshot());

        renderTimeline(vm);

        await waitFor(() => expect(vm.onVisibleRangeChanged).toHaveBeenCalled());
        await waitFor(() => expect(vm.onIsAtLiveEdgeChanged).toHaveBeenCalled());
    });

    it("requests forward pagination when the end is reachable and forward pagination is enabled", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateForward: true,
                canPaginateBackward: false,
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onVisibleRangeChanged).toHaveBeenCalled());
        await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());
        await waitFor(() => expect(vm.onRequestMoreItems).toHaveBeenCalledWith("forward"));
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("backward");
    });

    it("allows the initial backward probe while suppressing forward pagination during initial fill", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: true,
                canPaginateForward: true,
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onRequestMoreItems).toHaveBeenCalledWith("backward"));
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("forward");
        expect(vm.onInitialFillCompleted).not.toHaveBeenCalled();
    });

    it("acknowledges a scroll target when the target item is present", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                scrollTarget: { targetKey: "beta", position: "center", highlight: true },
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onScrollTargetReached).toHaveBeenCalledOnce());
    });

    it("marks initial fill complete without probing backward when no backfill is available", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: false,
                canPaginateForward: false,
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("backward");
    });

    it("suppresses the initial backward probe while a scroll target is being resolved", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: true,
                scrollTarget: { targetKey: "beta", position: "center", highlight: true },
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onScrollTargetReached).toHaveBeenCalledOnce());
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("backward");
    });

    it("resets anchor tracking when the view model instance changes", async () => {
        const firstVm = new TestTimelineViewModel(
            makeSnapshot({
                scrollTarget: { targetKey: "beta", position: "center", highlight: true },
            }),
        );

        const secondVm = new TestTimelineViewModel(
            makeSnapshot({
                scrollTarget: { targetKey: "beta", position: "center", highlight: true },
            }),
        );

        const view = renderTimeline(firstVm);
        await waitFor(() => expect(firstVm.onScrollTargetReached).toHaveBeenCalledOnce());

        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={secondVm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );

        await waitFor(() => expect(secondVm.onScrollTargetReached).toHaveBeenCalledOnce());
    });
});
