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
import { page } from "vitest/browser";

import { TimelineView } from "./TimelineView";
import type {
    ImmediateScroll,
    TimelineItem,
    TimelineViewHandle,
    TimelineViewModel,
    TimelineViewSnapshot,
} from "./types";

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
        event: null,
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
    onJumpToStart: ReturnType<typeof vi.fn>;
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
        onJumpToStart: vi.fn(),
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

    describe("when the viewport changes height", () => {
        // The view is height:100%, so re-rendering the wrapper with a new height is how the composer
        // growing, or a banner appearing above the timeline, reaches the scroller.
        function renderResizable(vm: TimelineViewModel, height: number): { resize: (h: number) => void } {
            const view = (h: number): React.ReactElement => (
                <div style={{ height: h, width: 320 }}>
                    <TimelineView vm={vm} renderItem={renderItem} />
                </div>
            );
            const result = render(view(height));
            return { resize: (h) => result.rerender(view(h)) };
        }

        const distanceFromBottom = (el: HTMLElement): number => el.scrollHeight - el.scrollTop - el.clientHeight;
        // Long enough for TanStack's scroll corrections to finish, or for a wrongful scroll to show.
        const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 100));

        it("keeps a reader who was at the bottom at the bottom when the viewport shrinks", async () => {
            const { vm, actions } = makeFakeVm({ items: eventItems(30) });
            const { resize } = renderResizable(vm, VIEWPORT_HEIGHT);
            const scroller = screen.getByTestId("timeline-scroller");
            await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
            await waitFor(() => expect(actions.onAtBottomStateChange).toHaveBeenLastCalledWith(true));
            expect(distanceFromBottom(scroller)).toBeLessThanOrEqual(1);
            actions.onAtBottomStateChange.mockClear();

            resize(VIEWPORT_HEIGHT - 60);

            await waitFor(() => expect(scroller.clientHeight).toBe(VIEWPORT_HEIGHT - 60));
            await waitFor(() => expect(distanceFromBottom(scroller)).toBeLessThanOrEqual(1));
            // The view model is never told the reader left the bottom: they did not.
            expect(actions.onAtBottomStateChange).not.toHaveBeenCalledWith(false);
        });

        it("leaves the scroll position alone when the reader was not at the bottom", async () => {
            const { vm, actions } = makeFakeVm({ items: eventItems(30) });
            const { resize } = renderResizable(vm, VIEWPORT_HEIGHT);
            const scroller = screen.getByTestId("timeline-scroller");
            await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
            // The first load's scrollToIndex keeps steering back to its target for a moment; let
            // it settle, or it would undo the reader's scroll below.
            await settle();
            scroller.scrollTop = 200;
            await waitFor(() => expect(actions.onAtBottomStateChange).toHaveBeenLastCalledWith(false));
            await settle();
            expect(scroller.scrollTop).toBe(200);

            resize(VIEWPORT_HEIGHT - 60);

            await waitFor(() => expect(scroller.clientHeight).toBe(VIEWPORT_HEIGHT - 60));
            // Give the view time to scroll, in case it wrongly does.
            await settle();
            expect(scroller.scrollTop).toBe(200);
        });

        it("keeps a reader at the bottom when the window shrinks and some rows shrink with it", async () => {
            // Every fourth row is sized as a share of the window height, like a collapsed code
            // block, so it changes height in the same frame as the viewport.
            const renderWindowSizedItem = (item: TimelineItem): React.ReactNode => (
                <div
                    data-testid={`row-${item.key}`}
                    style={{ height: Number(item.key.slice("evt-".length)) % 4 === 0 ? "30vh" : ROW_HEIGHT }}
                >
                    {item.key}
                </div>
            );
            const { vm, actions } = makeFakeVm({ items: eventItems(30) });
            render(
                <div style={{ height: "50vh", width: 320 }}>
                    <TimelineView vm={vm} renderItem={renderWindowSizedItem} />
                </div>,
            );
            const scroller = screen.getByTestId("timeline-scroller");
            await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
            await waitFor(() => expect(actions.onAtBottomStateChange).toHaveBeenLastCalledWith(true));
            await settle();
            actions.onAtBottomStateChange.mockClear();

            const { innerWidth: width, innerHeight: height } = window;
            try {
                // Shrink in steps, as dragging the window edge does.
                for (const shrinkBy of [60, 120, 180]) {
                    await page.viewport(width, height - shrinkBy);
                    await waitFor(() => expect(scroller.clientHeight).toBe(Math.round((height - shrinkBy) / 2)));
                    await settle();
                    expect(distanceFromBottom(scroller)).toBeLessThanOrEqual(1);
                }
            } finally {
                await page.viewport(width, height);
            }
            expect(actions.onAtBottomStateChange).not.toHaveBeenCalledWith(false);
        });
    });

    describe("ref handle", () => {
        // Thirty 40px rows in a 300px viewport: 1200px of content, 900px of scroll range, and
        // the first load lands at the bottom.
        async function renderWithHandle(
            initial: Partial<TimelineViewSnapshot> = {},
        ): Promise<{ handle: TimelineViewHandle; scroller: HTMLElement; actions: Actions }> {
            const { vm, actions } = makeFakeVm({ items: eventItems(30), ...initial });
            const ref = React.createRef<TimelineViewHandle>();
            render(
                <div style={{ height: VIEWPORT_HEIGHT, width: 320 }}>
                    <TimelineView vm={vm} renderItem={renderItem} ref={ref} />
                </div>,
            );
            await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
            const scroller = screen.getByTestId("timeline-scroller");
            await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
            await waitFor(() => expect(actions.onVisibleRangeChanged).toHaveBeenCalled());
            return { handle: ref.current!, scroller, actions };
        }

        it("pages up and down by the number of rows on screen", async () => {
            const { handle, scroller, actions } = await renderWithHandle();
            // The view reports the visible range as [first, last] row indices; a page is the
            // difference, and the row landed on goes to the top.
            const [first, last] = actions.onVisibleRangeChanged.mock.calls.at(-1)! as [number, number];
            const pageSize = last - first;
            expect(pageSize).toBeGreaterThan(1);

            act(() => handle.scrollByPage(-1));
            await waitFor(() => expect(scroller.scrollTop).toBe((first - pageSize) * ROW_HEIGHT));

            act(() => handle.scrollByPage(1));
            await waitFor(() => expect(scroller.scrollTop).toBe(first * ROW_HEIGHT));
        });

        it("does not take focus when the shortcut comes from outside the timeline", async () => {
            const { handle } = await renderWithHandle();
            // As when the reader presses page up with the caret in the composer.
            const outside = document.createElement("button");
            document.body.appendChild(outside);
            outside.focus();

            act(() => handle.scrollByPage(-1));

            await waitFor(() => expect(screen.getByTestId("timeline-scroller").scrollTop).toBeLessThan(900));
            expect(document.activeElement).toBe(outside);
            outside.remove();
        });

        it("scrolls straight to a loaded row through scrollNow", async () => {
            const { handle, scroller } = await renderWithHandle();

            act(() => handle.scrollNow({ targetKey: "evt-0", align: "start" }));

            await waitFor(() => expect(scroller.scrollTop).toBe(0));
        });

        it("exposes the same immediate scroll the overlay buttons hand to the view model", async () => {
            const { handle, actions } = await renderWithHandle({ isAtBottom: false });
            const jumpToBottom = await screen.findByRole("button", { name: "Scroll to most recent messages" });

            await userEvent.setup().click(jumpToBottom);

            expect(actions.onJumpToLive.mock.calls[0][0]).toBe(handle.scrollNow);
        });
    });

    describe("keyboard navigation", () => {
        const rowFor = (key: string): HTMLElement => screen.getByTestId(`row-${key}`).closest("li")!;
        const focusedKey = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset.key;

        /** Render thirty rows at the bottom, with the outer element recording keys that escape. */
        async function renderFocused(
            initial: Partial<TimelineViewSnapshot> = {},
            items: TimelineItem[] = eventItems(30),
        ): Promise<{
            scroller: HTMLElement;
            actions: Actions;
            escaped: ReturnType<typeof vi.fn>;
            update: FakeVm["update"];
        }> {
            const { vm, actions, update } = makeFakeVm({ items, ...initial });
            const escaped = vi.fn();
            render(
                <div style={{ height: VIEWPORT_HEIGHT, width: 320 }} onKeyDown={escaped}>
                    <TimelineView vm={vm} renderItem={renderItem} />
                </div>,
            );
            await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
            const scroller = screen.getByTestId("timeline-scroller");
            await waitFor(() => expect(actions.onVisibleRangeChanged).toHaveBeenCalled());
            return { scroller, actions, escaped, update };
        }

        it("hands keyboard focus on to the newest message on screen", async () => {
            await renderFocused();
            const user = userEvent.setup();

            // Tab reaches the scroller first; the timeline passes focus on to a row.
            await user.tab();

            await waitFor(() => expect(focusedKey()).toBe("evt-29"));
            expect(rowFor("evt-29")).toHaveAttribute("tabindex", "0");
            expect(rowFor("evt-28")).toHaveAttribute("tabindex", "-1");
        });

        it("moves one message at a time with the arrow keys, scrolling only when needed", async () => {
            const { scroller, actions } = await renderFocused();
            const user = userEvent.setup();
            await user.tab();
            await waitFor(() => expect(focusedKey()).toBe("evt-29"));
            const atBottom = scroller.scrollTop;

            await user.keyboard("{ArrowUp}");
            expect(focusedKey()).toBe("evt-28");
            // Still on screen, so nothing moved.
            expect(scroller.scrollTop).toBe(atBottom);

            await user.keyboard("{ArrowDown}");
            expect(focusedKey()).toBe("evt-29");
            // The newest row is the last one: down from it stays put.
            await user.keyboard("{ArrowDown}");
            expect(focusedKey()).toBe("evt-29");

            // Walk up past the top of the viewport: the row above scrolls into view.
            const [first] = actions.onVisibleRangeChanged.mock.calls.at(-1)! as [number, number];
            for (let i = 29; i > first - 1; i--) await user.keyboard("{ArrowUp}");
            expect(focusedKey()).toBe(`evt-${first - 1}`);
            await waitFor(() => expect(scroller.scrollTop).toBeLessThan(atBottom));
            expect(scroller.scrollTop).toBe((first - 1) * ROW_HEIGHT);
        });

        it("pages by the rows on screen and keeps focus on the row landed on", async () => {
            const { scroller, actions } = await renderFocused();
            const user = userEvent.setup();
            await user.tab();
            await waitFor(() => expect(focusedKey()).toBe("evt-29"));
            const [first, last] = actions.onVisibleRangeChanged.mock.calls.at(-1)! as [number, number];
            const pageSize = last - first;

            await user.keyboard("{PageUp}");

            // From the focused (last) row, up a page, and that row goes to the top.
            expect(focusedKey()).toBe(`evt-${29 - pageSize}`);
            await waitFor(() => expect(scroller.scrollTop).toBe((29 - pageSize) * ROW_HEIGHT));

            await user.keyboard("{PageDown}");

            expect(focusedKey()).toBe("evt-29");
        });

        it("goes to the start of the room and the live end with home and end", async () => {
            const { scroller, actions } = await renderFocused();
            // Both are already loaded here, so the view model scrolls straight there.
            actions.onJumpToStart.mockImplementation((scrollNow: ImmediateScroll) =>
                scrollNow({ targetKey: "evt-0", align: "start" }),
            );
            actions.onJumpToLive.mockImplementation((scrollNow: ImmediateScroll) =>
                scrollNow({ targetKey: "evt-29", align: "end" }),
            );
            const user = userEvent.setup();
            await user.tab();
            await waitFor(() => expect(focusedKey()).toBe("evt-29"));

            await user.keyboard("{Home}");
            expect(actions.onJumpToStart).toHaveBeenCalledTimes(1);
            await waitFor(() => expect(focusedKey()).toBe("evt-0"));
            await waitFor(() => expect(scroller.scrollTop).toBe(0));

            await user.keyboard("{End}");
            expect(actions.onJumpToLive).toHaveBeenCalledTimes(1);
            await waitFor(() => expect(focusedKey()).toBe("evt-29"));
            await waitFor(() => expect(scroller.scrollTop).toBe(30 * ROW_HEIGHT - VIEWPORT_HEIGHT));
        });

        it("focuses the first message once the start of the room has loaded", async () => {
            const { scroller, update } = await renderFocused();
            const user = userEvent.setup();
            await user.tab();
            await waitFor(() => expect(focusedKey()).toBe("evt-29"));

            // The view model has to fetch the start first, so it does not scroll yet.
            await user.keyboard("{Home}");
            // It then replaces the rows with the room's first messages and anchors to the top,
            // which is a date separator rather than a message.
            update({
                items: [{ key: "sep-start", kind: "date-separator", ts: 0 }, ...eventItems(30, 100)],
                pendingAnchor: { targetKey: "sep-start", align: "start" },
                atLiveEnd: false,
            });

            await waitFor(() => expect(focusedKey()).toBe("evt-100"));
            expect(scroller.scrollTop).toBe(0);
        });

        it("focuses where the last of home and end lands when one overtakes the other", async () => {
            const { update } = await renderFocused();
            const user = userEvent.setup();
            await user.tab();
            await waitFor(() => expect(focusedKey()).toBe("evt-29"));

            // Home has to load; End is pressed before it lands.
            await user.keyboard("{Home}");
            await user.keyboard("{End}");
            // The start arrives first and is placed, but it is not where the reader is going.
            update({
                items: [{ key: "sep-start", kind: "date-separator", ts: 0 }, ...eventItems(30, 100)],
                pendingAnchor: { targetKey: "sep-start", align: "start" },
                atLiveEnd: false,
            });
            await waitFor(() => expect(screen.getByTestId("row-evt-100")).toBeInTheDocument());
            expect(focusedKey()).not.toBe("evt-100");
            // Then the live end, which is.
            update({
                items: eventItems(30, 200),
                pendingAnchor: { targetKey: "evt-229", align: "end" },
                atLiveEnd: true,
            });

            await waitFor(() => expect(focusedKey()).toBe("evt-229"));
        });

        it("skips rows that are not messages", async () => {
            const items: TimelineItem[] = [
                ...eventItems(28),
                { key: "sep", kind: "date-separator", ts: 0 },
                ...eventItems(1, 28),
            ];
            await renderFocused({}, items);
            const user = userEvent.setup();
            await user.tab();
            await waitFor(() => expect(focusedKey()).toBe("evt-28"));

            await user.keyboard("{ArrowUp}");

            expect(focusedKey()).toBe("evt-27");
        });

        it("leaves modified keys to the app and keys typed in an editor to the editor", async () => {
            const withInput = (item: TimelineItem): React.ReactNode => (
                <div data-testid={`row-${item.key}`} style={{ height: ROW_HEIGHT }}>
                    <input aria-label={`edit ${item.key}`} />
                </div>
            );
            const { vm, actions } = makeFakeVm({ items: eventItems(30) });
            const escaped = vi.fn();
            render(
                <div style={{ height: VIEWPORT_HEIGHT, width: 320 }} onKeyDown={escaped}>
                    <TimelineView vm={vm} renderItem={withInput} />
                </div>,
            );
            await waitFor(() => expect(actions.onAnchorReached).toHaveBeenCalled(), { timeout: 5000 });
            const user = userEvent.setup();

            const escapedKeys = (): string[] => escaped.mock.calls.map(([e]) => (e as KeyboardEvent).key);

            // Shift+PageUp is the app's "jump to oldest unread": not ours.
            await user.tab();
            await user.keyboard("{Shift>}{PageUp}{/Shift}");
            expect(escapedKeys()).toContain("PageUp");
            expect(focusedKey()).toBe("evt-29");

            // Inside an editor the arrow keys move the caret.
            const input = screen.getByLabelText("edit evt-29");
            input.focus();
            await user.keyboard("{ArrowUp}");
            expect(document.activeElement).toBe(input);
            expect(escapedKeys()).toContain("ArrowUp");
        });
    });
});
