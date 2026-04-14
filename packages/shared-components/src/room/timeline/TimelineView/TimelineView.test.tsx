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
    TimelineView,
} from "./TimelineView";
import {
    getContiguousWindowShift,
    getForwardPaginationAnchorAdjustment,
    getForwardPaginationAnchorIndex,
    getIsAtLiveEdgeFromBottomState,
    getPostInitialFillBottomSnapIndex,
    getScrollLocationOnChange,
    shouldDisableFollowOutputOnScroll,
    shouldIgnoreAtBottomStateChange,
    shouldIgnoreStartReached,
    shouldMarkInitialBottomSnapDoneOnScrollTarget,
    shouldPaginateBackwardAtTopScroll,
    shouldReplayPendingForwardPaginationAfterInitialFill,
} from "./TimelineViewBehavior";
import { getLastVisibleTimelineItemElement } from "./TimelineViewDom";
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

    public updateSnapshot(partial: Partial<TimelineViewSnapshot<TimelineItem>>): void {
        this.snapshot.merge(partial);
    }
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
                scrollTarget: { targetKey: "beta", position: "center" },
                isAtLiveEdge: false,
                totalCount: 3,
                lastAnchoredKey: "beta",
                initialBottomSnapDone: true,
            }),
        ).toBe(false);
    });

    it("treats an initial live-edge bottom scroll target as satisfying the initial bottom snap", () => {
        expect(
            shouldMarkInitialBottomSnapDoneOnScrollTarget({
                items: makeSnapshot().items,
                scrollTarget: { targetKey: "gamma", position: "bottom" },
                isAtLiveEdge: true,
                initialBottomSnapDone: false,
            }),
        ).toBe(true);
    });

    it("does not treat non-terminal scroll targets as satisfying the initial bottom snap", () => {
        expect(
            shouldMarkInitialBottomSnapDoneOnScrollTarget({
                items: makeSnapshot().items,
                scrollTarget: { targetKey: "beta", position: "bottom" },
                isAtLiveEdge: true,
                initialBottomSnapDone: false,
            }),
        ).toBe(false);
    });

    it("does not request a scroll when the target item is missing", () => {
        expect(
            getScrollLocationOnChange({
                items: makeSnapshot().items,
                scrollTarget: { targetKey: "missing", position: "bottom" },
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

    it("does not treat the bottom of a paginatable forward window as the live edge", () => {
        expect(
            getIsAtLiveEdgeFromBottomState({
                atBottom: true,
                canPaginateForward: true,
            }),
        ).toBe(false);
    });

    it("treats the bottom of a non-paginatable forward window as the live edge", () => {
        expect(
            getIsAtLiveEdgeFromBottomState({
                atBottom: true,
                canPaginateForward: false,
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

    it("replays a pending forward pagination request after initial fill completes", () => {
        expect(
            shouldReplayPendingForwardPaginationAfterInitialFill({
                initialFillState: "done",
                hasPendingEndReached: true,
                forwardPagination: "idle",
                canPaginateForward: true,
            }),
        ).toBe(true);
    });

    it("does not replay pending forward pagination before initial fill completes", () => {
        expect(
            shouldReplayPendingForwardPaginationAfterInitialFill({
                initialFillState: "filling",
                hasPendingEndReached: true,
                forwardPagination: "idle",
                canPaginateForward: true,
            }),
        ).toBe(false);
    });

    it("does not replay forward pagination after anchor-driven startup scrolls", () => {
        expect(
            shouldReplayPendingForwardPaginationAfterInitialFill({
                initialFillState: "done",
                hasPendingEndReached: false,
                forwardPagination: "idle",
                canPaginateForward: true,
            }),
        ).toBe(false);
    });

    it("disables followOutput immediately when the user scrolls upward from the live edge", () => {
        expect(
            shouldDisableFollowOutputOnScroll({
                previousScrollTop: 1137,
                currentScrollTop: 1101,
                isAtLiveEdge: true,
                followOutputEnabled: true,
            }),
        ).toBe(true);
    });

    it("keeps followOutput enabled for downward scrolls while at the live edge", () => {
        expect(
            shouldDisableFollowOutputOnScroll({
                previousScrollTop: 664,
                currentScrollTop: 1137,
                isAtLiveEdge: true,
                followOutputEnabled: true,
            }),
        ).toBe(false);
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

    it("anchors forward pagination to the previous last visible item when items are appended", () => {
        const previousItems: TimelineItem[] = [
            { key: "alpha", kind: "event" },
            { key: "beta", kind: "event" },
            { key: "gamma", kind: "event" },
        ];
        const nextItems: TimelineItem[] = [
            ...previousItems,
            { key: "delta", kind: "event" },
            { key: "epsilon", kind: "event" },
        ];

        expect(
            getForwardPaginationAnchorIndex({
                previousItems,
                nextItems,
                forwardPaginationContext: {
                    anchorKey: "gamma",
                    lastVisibleRange: { startIndex: 0, endIndex: 2 },
                    bottomOffsetPx: 0,
                    requestedAtLiveEdge: false,
                },
                previousForwardPagination: "loading",
                forwardPagination: "idle",
                hasScrollTarget: false,
                firstItemIndex: 100,
                windowShift: 0,
            }),
        ).toBe(102);
    });

    it("does not apply forward anchor restore when a capped sliding window shift already preserved the viewport", () => {
        const previousItems: TimelineItem[] = Array.from({ length: 50 }, (_, index) => ({
            key: `event-${index + 21}`,
            kind: "event",
        }));
        const nextItems: TimelineItem[] = Array.from({ length: 50 }, (_, index) => ({
            key: `event-${index + 31}`,
            kind: "event",
        }));

        expect(
            getForwardPaginationAnchorIndex({
                previousItems,
                nextItems,
                forwardPaginationContext: {
                    anchorKey: "event-70",
                    lastVisibleRange: { startIndex: 39, endIndex: 49 },
                    bottomOffsetPx: 0,
                    requestedAtLiveEdge: false,
                },
                previousForwardPagination: "loading",
                forwardPagination: "idle",
                hasScrollTarget: false,
                firstItemIndex: 99940,
                windowShift: -10,
            }),
        ).toBeNull();
    });

    it("does not anchor forward pagination when the request started at the live end", () => {
        const previousItems: TimelineItem[] = [
            { key: "alpha", kind: "event" },
            { key: "beta", kind: "event" },
        ];
        const nextItems: TimelineItem[] = [...previousItems, { key: "gamma", kind: "event" }];

        expect(
            getForwardPaginationAnchorIndex({
                previousItems,
                nextItems,
                forwardPaginationContext: {
                    anchorKey: "beta",
                    lastVisibleRange: { startIndex: 0, endIndex: 1 },
                    bottomOffsetPx: 0,
                    requestedAtLiveEdge: true,
                },
                previousForwardPagination: "loading",
                forwardPagination: "idle",
                hasScrollTarget: false,
                firstItemIndex: 100,
                windowShift: 0,
            }),
        ).toBeNull();
    });

    it("computes a scroll adjustment that preserves the previous bottom offset", () => {
        expect(
            getForwardPaginationAnchorAdjustment({
                desiredBottomOffset: 24,
                currentBottomOffset: 8,
            }),
        ).toBe(16);
        expect(
            getForwardPaginationAnchorAdjustment({
                desiredBottomOffset: 8,
                currentBottomOffset: 24,
            }),
        ).toBe(-16);
    });

    it("prefers the last fully visible row over a lower partially visible row when capturing the forward anchor", () => {
        const scrollerElement = document.createElement("div");
        const fullyVisibleElement = document.createElement("div");
        const partiallyVisibleElement = document.createElement("div");

        fullyVisibleElement.dataset.timelineItemKey = "event-64";
        partiallyVisibleElement.dataset.timelineItemKey = "event-65";

        scrollerElement.append(fullyVisibleElement, partiallyVisibleElement);

        vi.spyOn(scrollerElement, "getBoundingClientRect").mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 300,
            bottom: 500,
            left: 0,
            width: 300,
            height: 500,
            toJSON: () => ({}),
        });
        vi.spyOn(fullyVisibleElement, "getBoundingClientRect").mockReturnValue({
            x: 0,
            y: 0,
            top: 420,
            right: 300,
            bottom: 499.5,
            left: 0,
            width: 300,
            height: 79.5,
            toJSON: () => ({}),
        });
        vi.spyOn(partiallyVisibleElement, "getBoundingClientRect").mockReturnValue({
            x: 0,
            y: 0,
            top: 470,
            right: 300,
            bottom: 540,
            left: 0,
            width: 300,
            height: 70,
            toJSON: () => ({}),
        });

        expect(getLastVisibleTimelineItemElement(scrollerElement)).toBe(fullyVisibleElement);
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

    it("auto-requests forward pagination during initial fill when only forward fill is available", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateForward: true,
                canPaginateBackward: false,
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onVisibleRangeChanged).toHaveBeenCalled());
        await waitFor(() => expect(vm.onRequestMoreItems).toHaveBeenCalledWith("forward"));
        await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());
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
                scrollTarget: { targetKey: "beta", position: "center" },
            }),
        );

        const view = renderTimeline(vm);
        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={vm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );

        await waitFor(() => expect(vm.onScrollTargetReached).toHaveBeenCalledOnce());
    });

    it("does not acknowledge a scroll target until the scroller has a measurable height", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                scrollTarget: { targetKey: "beta", position: "center" },
            }),
        );

        let forceZeroScrollerHeight = true;
        const clientHeightSpy = vi
            .spyOn(HTMLElement.prototype, "clientHeight", "get")
            .mockImplementation(() => (forceZeroScrollerHeight ? 0 : 200));

        try {
            const view = render(<TimelineView vm={vm} renderItem={(item) => <div>{item.key}</div>} />, {
                wrapper: ({ children }) => (
                    <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                        {children}
                    </VirtuosoMockContext.Provider>
                ),
            });

            expect(vm.onScrollTargetReached).not.toHaveBeenCalled();

            forceZeroScrollerHeight = false;
            view.rerender(
                <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                    <TimelineView vm={vm} renderItem={(item) => <div>{item.key}</div>} />
                </VirtuosoMockContext.Provider>,
            );

            await waitFor(() => expect(vm.onScrollTargetReached).toHaveBeenCalledOnce());
        } finally {
            clientHeightSpy.mockRestore();
        }
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

    it("notifies initial fill completion only once per view model lifecycle", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: false,
                canPaginateForward: true,
                forwardPagination: "loading",
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());

        vm.updateSnapshot({
            items: [
                { key: "alpha", kind: "event" },
                { key: "beta", kind: "event" },
                { key: "gamma", kind: "event" },
                { key: "delta", kind: "event" },
            ],
            forwardPagination: "idle",
        });

        await waitFor(() => expect(vm.onVisibleRangeChanged).toHaveBeenCalled());
        expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce();
    });

    it("suppresses the initial backward probe while a scroll target is being resolved", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: true,
                scrollTarget: { targetKey: "beta", position: "center" },
            }),
        );

        const view = renderTimeline(vm);
        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={vm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );

        await waitFor(() => expect(vm.onScrollTargetReached).toHaveBeenCalledOnce());
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("backward");
    });

    it("treats resolving an initial scroll target as completing startup fill", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: true,
                canPaginateForward: true,
                isAtLiveEdge: false,
                scrollTarget: { targetKey: "beta", position: "bottom" },
            }),
        );

        const view = renderTimeline(vm);
        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={vm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );

        await waitFor(() => expect(vm.onScrollTargetReached).toHaveBeenCalledOnce());
        vm.updateSnapshot({ scrollTarget: null });
        await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("backward");
        expect(vm.onRequestMoreItems).not.toHaveBeenCalledWith("forward");
    });

    it("resets anchor tracking when the view model instance changes", async () => {
        const firstVm = new TestTimelineViewModel(
            makeSnapshot({
                scrollTarget: { targetKey: "beta", position: "center" },
            }),
        );

        const secondVm = new TestTimelineViewModel(
            makeSnapshot({
                scrollTarget: { targetKey: "beta", position: "center" },
            }),
        );

        const view = renderTimeline(firstVm);
        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={firstVm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );
        await waitFor(() => expect(firstVm.onScrollTargetReached).toHaveBeenCalledOnce());

        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={secondVm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );

        await waitFor(() => expect(secondVm.onScrollTargetReached).toHaveBeenCalledOnce());
    });
});
