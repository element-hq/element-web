/* @vitest-environment jsdom */
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

    public paginate = vi.fn();
    public onInitialFillCompleted = vi.fn();
    public onVisibleRangeChanged = vi.fn();
    public onAnchorReached = vi.fn();
    public onStuckAtBottomChanged = vi.fn();
}

function makeSnapshot(partial?: Partial<TimelineViewSnapshot<TimelineItem>>): TimelineViewSnapshot<TimelineItem> {
    return {
        items: [
            { key: "alpha", kind: "event" },
            { key: "beta", kind: "event" },
            { key: "gamma", kind: "event" },
        ],
        stuckAtBottom: true,
        canPaginateBackward: false,
        canPaginateForward: false,
        backwardPagination: "idle",
        forwardPagination: "idle",
        pendingAnchor: null,
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
                pendingAnchor: null,
                stuckAtBottom: true,
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

    it("requests a post-fill bottom snap after startup backfill completes", () => {
        expect(
            getPostInitialFillBottomSnapIndex({
                initialFillState: "done",
                stuckAtBottom: true,
                hasPendingAnchor: false,
                itemCount: 5,
                firstItemIndex: 100,
                postInitialFillBottomSnapDone: false,
            }),
        ).toBe(104);
    });

    it("ignores atBottom state changes during initial fill for live timelines", () => {
        expect(
            shouldIgnoreAtBottomStateChange({
                initialFillState: "filling",
                hasPendingAnchor: false,
            }),
        ).toBe(true);
    });

    it("ignores startReached when already pinned to the live bottom", () => {
        expect(
            shouldIgnoreStartReached({
                initialFillState: "done",
                stuckAtBottom: true,
                hasPendingAnchor: false,
            }),
        ).toBe(true);
    });

    it("allows backward pagination when the user scrolls to the top after initial fill", () => {
        expect(
            shouldPaginateBackwardAtTopScroll({
                initialFillState: "done",
                stuckAtBottom: false,
                hasPendingAnchor: false,
                backwardPagination: "idle",
                canPaginateBackward: true,
                scrollTop: 0,
            }),
        ).toBe(true);
    });

    it("reports visible range and bottom state", async () => {
        const vm = new TestTimelineViewModel(makeSnapshot());

        renderTimeline(vm);

        await waitFor(() => expect(vm.onVisibleRangeChanged).toHaveBeenCalled());
        await waitFor(() => expect(vm.onStuckAtBottomChanged).toHaveBeenCalled());
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
        await waitFor(() => expect(vm.paginate).toHaveBeenCalledWith("forward"));
        expect(vm.paginate).not.toHaveBeenCalledWith("backward");
    });

    it("allows the initial backward probe while suppressing forward pagination during initial fill", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: true,
                canPaginateForward: true,
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.paginate).toHaveBeenCalledWith("backward"));
        expect(vm.paginate).not.toHaveBeenCalledWith("forward");
        expect(vm.onInitialFillCompleted).not.toHaveBeenCalled();
    });

    it("acknowledges a pending anchor when the anchored item is present", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                pendingAnchor: { targetKey: "beta", position: 0.5, highlight: true },
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onAnchorReached).toHaveBeenCalledOnce());
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
        expect(vm.paginate).not.toHaveBeenCalledWith("backward");
    });

    it("suppresses the initial backward probe while a pending anchor is being resolved", async () => {
        const vm = new TestTimelineViewModel(
            makeSnapshot({
                canPaginateBackward: true,
                pendingAnchor: { targetKey: "beta", position: 0.5, highlight: true },
            }),
        );

        renderTimeline(vm);

        await waitFor(() => expect(vm.onAnchorReached).toHaveBeenCalledOnce());
        expect(vm.paginate).not.toHaveBeenCalledWith("backward");
    });

    it("resets anchor tracking when the view model instance changes", async () => {
        const firstVm = new TestTimelineViewModel(
            makeSnapshot({
                pendingAnchor: { targetKey: "beta", position: 0.5, highlight: true },
            }),
        );

        const secondVm = new TestTimelineViewModel(
            makeSnapshot({
                pendingAnchor: { targetKey: "beta", position: 0.5, highlight: true },
            }),
        );

        const view = renderTimeline(firstVm);
        await waitFor(() => expect(firstVm.onAnchorReached).toHaveBeenCalledOnce());

        view.rerender(
            <VirtuosoMockContext.Provider value={{ viewportHeight: 200, itemHeight: 48 }}>
                <TimelineView vm={secondVm} renderItem={(item) => <div>{item.key}</div>} />
            </VirtuosoMockContext.Provider>,
        );

        await waitFor(() => expect(secondVm.onAnchorReached).toHaveBeenCalledOnce());
    });
});
