/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TimelineWindow, Direction, RoomEvent, type MatrixClient, type Room, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { BaseViewModel } from "@element-hq/web-shared-components";
import type {
    TimelineViewSnapshot,
    TimelineViewActions,
    TimelineItem,
    VisibleRange,
    PaginationState,
} from "@element-hq/web-shared-components";

const PAGINATE_SIZE = 20;
const INITIAL_SIZE = 30;

const log = (...args: unknown[]): void => console.log("[TimelineVM]", ...args);

export interface RoomTimelineViewModelOpts {
    client: MatrixClient;
    room: Room;
    /** Optional anchor for initial load (permalink, search result). */
    initialEventId?: string;
}

/**
 * Element Web implementation of the shared TimelineViewModel contract.
 *
 * Wraps the SDK's TimelineWindow and translates Matrix timeline state
 * into the SDK-agnostic types that the shared TimelineView consumes.
 */
export class RoomTimelineViewModel
    extends BaseViewModel<TimelineViewSnapshot, RoomTimelineViewModelOpts>
    implements TimelineViewActions
{
    private timelineWindow: TimelineWindow;
    // TODO: Use visibleRange for read receipts
    public visibleRange: VisibleRange = { startIndex: 0, endIndex: 0 };

    public constructor(opts: RoomTimelineViewModelOpts) {
        super(opts, {
            items: [],
            stuckAtBottom: true,
            backwardPagination: "idle",
            forwardPagination: "idle",
            focus: { focusedKey: null, containerFocused: false },
            pendingAnchor: null,
        });

        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet());

        this.load(opts.initialEventId);

        // Listen for new events so live messages appear
        opts.room.on(RoomEvent.Timeline, this.onRoomTimeline);
    }

    public dispose(): void {
        this.options.room.off(RoomEvent.Timeline, this.onRoomTimeline);
    }

    private onRoomTimeline = (): void => {
        const { stuckAtBottom } = this.snapshot.current;
        log("onRoomTimeline fired, stuckAtBottom:", stuckAtBottom);
        // Always extend the window to include new events so they're
        // available whether or not the user is scrolled up.
        this.timelineWindow.paginate(Direction.Forward, 1).then(() => {
            const items = this.buildItems();
            log("live event added, total items:", items.length);
            this.snapshot.merge({ items });
        });
    };

    /**
     * Track the Virtuoso firstItemIndex — starts at a high number so
     * prepending items shifts it down without going negative.
     */
    private firstItemIndex = 100_000;

    public getFirstItemIndex(): number {
        return this.firstItemIndex;
    }

    private async load(eventId?: string): Promise<void> {
        log("load() start, eventId:", eventId);
        this.snapshot.merge({
            backwardPagination: "loading",
            forwardPagination: "loading",
        });

        try {
            await this.timelineWindow.load(eventId, INITIAL_SIZE);

            const items = this.buildItems();

            log("load() done, items:", items.length);

            this.snapshot.merge({
                items,
                backwardPagination: "idle",
                forwardPagination: "idle",
                pendingAnchor: eventId
                    ? { targetKey: eventId, position: 0.5, highlight: true }
                    : null,
            });
        } catch (e) {
            log("load() error:", e);
            this.snapshot.merge({
                backwardPagination: "error",
                forwardPagination: "error",
            });
        }
    }

    // ── TimelineViewActions ──────────────────────────────────────────

    public onStartReached = (): void => {
        this.paginate("backward");
    };

    public onEndReached = (): void => {
        this.paginate("forward");
    };

    private paginate = (direction: "backward" | "forward"): void => {
        const dir = direction === "backward" ? Direction.Backward : Direction.Forward;
        const stateKey = direction === "backward" ? "backwardPagination" : "forwardPagination";

        const canPaginate = this.timelineWindow.canPaginate(dir);
        log("paginate()", direction, "canPaginate:", canPaginate, "currentState:", this.snapshot.current[stateKey]);

        if (!canPaginate) {
            return;
        }

        this.snapshot.merge({ [stateKey]: "loading" as PaginationState });

        const prevItemCount = this.snapshot.current.items.length;
        this.timelineWindow
            .paginate(dir, PAGINATE_SIZE)
            .then((success) => {
                const items = this.buildItems();
                const newCount = items.length - prevItemCount;
                if (direction === "backward" && newCount > 0) {
                    this.firstItemIndex -= newCount;
                }
                log("paginate()", direction, "success:", success, "items:", prevItemCount, "->", items.length, "firstItemIndex:", this.firstItemIndex);
                this.snapshot.merge({
                    items,
                    [stateKey]: "idle" as PaginationState,
                });
            })
            .catch((e) => {
                log("paginate()", direction, "error:", e);
                this.snapshot.merge({ [stateKey]: "error" as PaginationState });
            });
    };

    public onVisibleRangeChanged = (range: VisibleRange): void => {
        this.visibleRange = range;
    };

    public onAnchorReached = (): void => {
        this.snapshot.merge({ pendingAnchor: null });
    };

    public setFocus = (key: string | null): void => {
        this.snapshot.merge({
            focus: { ...this.snapshot.current.focus, focusedKey: key },
        });
    };

    public onStuckAtBottomChanged = (stuckAtBottom: boolean): void => {
        this.snapshot.merge({ stuckAtBottom });
    };

    // ── Snapshot construction ────────────────────────────────────────

    private static readonly CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000;
    private static readonly CONTINUED_TYPES = new Set(["m.room.message", "m.sticker"]);

    private buildItems(): TimelineItem[] {
        const events: MatrixEvent[] = this.timelineWindow.getEvents();
        const items: TimelineItem[] = [];
        let lastDate: string | null = null;
        let prevEvent: MatrixEvent | null = null;

        for (const event of events) {
            const eventId = event.getId();
            if (!eventId) continue;

            // Insert date separator when the day changes
            const eventDate = new Date(event.getTs());
            const dateKey = eventDate.toDateString();
            if (dateKey !== lastDate) {
                items.push({
                    key: `date-${dateKey}`,
                    kind: "date-separator",
                    label: eventDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
                });
                lastDate = dateKey;
                prevEvent = null; // date separator breaks continuation
            }

            items.push({
                key: eventId,
                kind: "event",
                continuation: this.shouldFormContinuation(prevEvent, event),
            });
            prevEvent = event;
        }

        return items;
    }

    private shouldFormContinuation(prev: MatrixEvent | null, cur: MatrixEvent): boolean {
        if (!prev?.sender || !cur.sender) return false;
        if (cur.getTs() - prev.getTs() > RoomTimelineViewModel.CONTINUATION_MAX_INTERVAL) return false;
        if (cur.isRedacted() !== prev.isRedacted()) return false;
        const curType = cur.getType();
        const prevType = prev.getType();
        const ct = RoomTimelineViewModel.CONTINUED_TYPES;
        if (curType !== prevType && !(ct.has(curType) && ct.has(prevType))) return false;
        if (
            cur.sender.userId !== prev.sender.userId ||
            cur.sender.name !== prev.sender.name ||
            cur.sender.getMxcAvatarUrl() !== prev.sender.getMxcAvatarUrl()
        )
            return false;
        return true;
    }
}
