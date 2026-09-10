/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, render, screen, waitFor, type RenderResult } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { TimelineView } from "./TimelineView";
import type { TimelineItem, TimelineViewModel, TimelineViewSnapshot } from "./types";

const baseSnapshot: TimelineViewSnapshot = {
    items: [],
    atLiveEnd: true,
    pendingAnchor: null,
    highlightedEventId: null,
    isAtBottom: true,
    canJumpToReadMarker: false,
    numUnreadMessages: 0,
    hasHighlights: false,
};

function eventItems(count: number, offset = 0): TimelineItem[] {
    return Array.from({ length: count }, (_, i) => ({
        key: `evt-${offset + i}`,
        kind: "event" as const,
        continuation: false,
        lastInSection: true,
    }));
}

type Actions = {
    onStartReached: ReturnType<typeof vi.fn>;
    onEndReached: ReturnType<typeof vi.fn>;
    onAnchorReached: ReturnType<typeof vi.fn>;
    onVisibleRangeChanged: ReturnType<typeof vi.fn>;
    onAtBottomStateChange: ReturnType<typeof vi.fn>;
    onJumpToReadMarker: ReturnType<typeof vi.fn>;
    onMarkAllAsRead: ReturnType<typeof vi.fn>;
    onJumpToLive: ReturnType<typeof vi.fn>;
};

interface FakeVm {
    vm: TimelineViewModel;
    actions: Actions;
    /** Push a new snapshot and notify subscribers (wrapped in act). */
    update: (patch: Partial<TimelineViewSnapshot>) => void;
}

function makeFakeVm(initial: Partial<TimelineViewSnapshot> = {}): FakeVm {
    let snapshot: TimelineViewSnapshot = { ...baseSnapshot, ...initial };
    const listeners = new Set<() => void>();
    const actions: Actions = {
        onStartReached: vi.fn(),
        onEndReached: vi.fn(),
        onAnchorReached: vi.fn(),
        onVisibleRangeChanged: vi.fn(),
        onAtBottomStateChange: vi.fn(),
        onJumpToReadMarker: vi.fn(),
        onMarkAllAsRead: vi.fn(),
        onJumpToLive: vi.fn(),
    };
    // vi.fn() carries a constructable signature that trips assignability to the
    // ViewModel's action method types, so cast the assembled object.
    const vm = {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        ...actions,
    } as unknown as TimelineViewModel;
    const update = (patch: Partial<TimelineViewSnapshot>): void => {
        act(() => {
            snapshot = { ...snapshot, ...patch };
            listeners.forEach((l) => l());
        });
    };
    return { vm, actions, update };
}

// Each row is a fixed 40px so the virtualizer measures a deterministic layout.
const ROW_HEIGHT = 40;
const renderItem = (item: TimelineItem): React.ReactNode => (
    <div data-testid={`row-${item.key}`} style={{ height: ROW_HEIGHT }}>
        {item.key}
    </div>
);

// Fixed-height viewport: the TimelineView is height:100%, so its parent must size it.
const VIEWPORT_HEIGHT = 300;
function renderTimeline(vm: TimelineViewModel): RenderResult {
    return render(
        <div style={{ height: VIEWPORT_HEIGHT, width: 320 }}>
            <TimelineView vm={vm} renderItem={renderItem} />
        </div>,
    );
}

describe("<TimelineView />", () => {
    it("renders each item via the renderItem callback", async () => {
        const { vm } = makeFakeVm({ items: eventItems(5) });
        renderTimeline(vm);

        expect(await screen.findByTestId("row-evt-0")).toBeInTheDocument();
        expect(screen.getByTestId("row-evt-4")).toBeInTheDocument();
    });

    it("stays hidden behind the cover then reveals after the anchor settles", async () => {
        // A list taller than the viewport so there is a real scroll offset to settle on.
        const { vm, actions } = makeFakeVm({ items: eventItems(30) });
        renderTimeline(vm);

        const scroller = screen.getByTestId("timeline-scroller");
        // Cover is up initially: the scroller is hidden and the anchor hasn't settled.
        expect(scroller).toHaveStyle({ visibility: "hidden" });
        expect(actions.onAnchorReached).not.toHaveBeenCalled();

        await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalledTimes(1), { timeout: 5000 });
        await waitFor(() => expect(scroller).toHaveStyle({ visibility: "visible" }));
    });

    it("reports the visible range and at-bottom state once live", async () => {
        const { vm, actions } = makeFakeVm({ items: eventItems(30) });
        renderTimeline(vm);

        await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
        await waitFor(() => expect(actions.onVisibleRangeChanged).toHaveBeenCalled());
        await waitFor(() => expect(actions.onAtBottomStateChange).toHaveBeenCalled());

        // Indices are 0-based into the items array.
        const [start, end] = actions.onVisibleRangeChanged.mock.calls.at(-1)!;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
    });

    it("re-renders when the view model pushes a new snapshot", async () => {
        const { vm, update } = makeFakeVm({ items: eventItems(5) });
        renderTimeline(vm);
        await screen.findByTestId("row-evt-0");

        update({ items: eventItems(6) });

        expect(await screen.findByTestId("row-evt-5")).toBeInTheDocument();
    });

    it("shows the jump-to-bottom control once revealed when scrolled off the bottom", async () => {
        const { vm, actions } = makeFakeVm({ items: eventItems(30), isAtBottom: false });
        renderTimeline(vm);

        const jumpToBottom = await screen.findByRole(
            "button",
            { name: "Scroll to most recent messages" },
            { timeout: 5000 },
        );

        const user = userEvent.setup();
        await user.click(jumpToBottom);
        expect(actions.onJumpToLive).toHaveBeenCalledTimes(1);
        // The View hands the VM its imperative scroll handle.
        expect(actions.onJumpToLive.mock.calls[0][0]).toBeTypeOf("function");
    });
});
