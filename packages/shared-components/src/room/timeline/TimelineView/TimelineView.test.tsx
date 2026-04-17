/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "@test-utils";
import { VirtuosoMockContext } from "react-virtuoso";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BaseViewModel } from "../../../core/viewmodel";
import { TimelineView } from "./TimelineView";
import { getContiguousWindowShift, getIsAtLiveEdgeFromBottomState } from "./utils";
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

function makeItems(keys: string[]): TimelineItem[] {
    return keys.map((key) => ({
        key,
        kind: "event",
    }));
}

function makeSnapshot(partial?: Partial<TimelineViewSnapshot<TimelineItem>>): TimelineViewSnapshot<TimelineItem> {
    return {
        items: makeItems(["alpha", "beta", "gamma"]),
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

async function withMeasuredScrollerHeight(testFn: () => Promise<void> | void): Promise<void> {
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (
        this: HTMLElement,
    ) {
        if (this.dataset.virtuosoScroller === "true") {
            return 200;
        }

        return 0;
    });

    try {
        await testFn();
    } finally {
        clientHeightSpy.mockRestore();
    }
}

describe("TimelineView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("signals initial fill completion once", async () => {
        const vm = new TestTimelineViewModel(makeSnapshot());

        renderTimeline(vm);

        await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());

        vm.updateSnapshot({
            items: makeItems(["alpha", "beta", "gamma", "delta"]),
        });

        expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce();
    });

    it("does not acknowledge a missing scroll target", async () => {
        await withMeasuredScrollerHeight(async () => {
            const vm = new TestTimelineViewModel(
                makeSnapshot({
                    scrollTarget: { targetKey: "missing", position: "center" },
                }),
            );

            renderTimeline(vm);

            await waitFor(() => expect(vm.onInitialFillCompleted).toHaveBeenCalledOnce());
            expect(vm.onScrollTargetReached).not.toHaveBeenCalled();
        });
    });

    it("signals live-edge changes", async () => {
        const vm = new TestTimelineViewModel(makeSnapshot());

        renderTimeline(vm);

        await waitFor(() => expect(vm.onIsAtLiveEdgeChanged).toHaveBeenCalled());
    });
});

describe("TimelineView utils", () => {
    it("computes contiguous window shifts for prepends", () => {
        expect(
            getContiguousWindowShift(makeItems(["alpha", "beta", "gamma"]), makeItems(["before", "alpha", "beta"])),
        ).toBe(1);
    });

    it("treats bottom as live-edge only when forward pagination is exhausted", () => {
        expect(
            getIsAtLiveEdgeFromBottomState({
                atBottom: true,
                canPaginateForward: false,
            }),
        ).toBe(true);

        expect(
            getIsAtLiveEdgeFromBottomState({
                atBottom: true,
                canPaginateForward: true,
            }),
        ).toBe(false);
    });
});
