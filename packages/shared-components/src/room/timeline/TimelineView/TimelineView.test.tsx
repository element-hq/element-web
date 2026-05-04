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
import { getInitialTopMostItemIndex, TimelineView } from "./TimelineView";
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

    it("uses LAST/end when scrollTarget is not set", async () => {
        expect(getInitialTopMostItemIndex(makeItems(["alpha", "beta", "gamma"]), null)).toEqual({
            index: "LAST",
            align: "end",
        });
    });

    it("uses LAST/end when the scrollTarget cannot be found", () => {
        expect(
            getInitialTopMostItemIndex(makeItems(["alpha", "beta", "gamma"]), {
                targetKey: "missing",
                position: "center",
            }),
        ).toEqual({ index: "LAST", align: "end" });
    });

    it("uses the target item index and center alignment for a centered scrollTarget", () => {
        expect(
            getInitialTopMostItemIndex(makeItems(["alpha", "beta", "gamma", "delta", "epsilon"]), {
                targetKey: "gamma",
                position: "center",
            }),
        ).toEqual({ index: 2, align: "center" });
    });

    it("maps top and bottom scrollTarget positions to Virtuoso alignment", () => {
        expect(
            getInitialTopMostItemIndex(makeItems(["alpha", "beta", "gamma"]), {
                targetKey: "beta",
                position: "top",
            }),
        ).toEqual({ index: 1, align: "start" });

        expect(
            getInitialTopMostItemIndex(makeItems(["alpha", "beta", "gamma"]), {
                targetKey: "beta",
                position: "bottom",
            }),
        ).toEqual({ index: 1, align: "end" });
    });

    it("signals live-edge changes", async () => {
        const vm = new TestTimelineViewModel(makeSnapshot());

        renderTimeline(vm);

        await waitFor(() => expect(vm.onIsAtLiveEdgeChanged).toHaveBeenCalled());
    });
});
