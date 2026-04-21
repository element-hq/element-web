/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    TimelineWindow,
    Direction,
    RoomEvent,
    type IRoomTimelineData,
    type MatrixClient,
    type MatrixEvent,
    type Room,
} from "matrix-js-sdk/src/matrix";
import { BaseViewModel } from "@element-hq/web-shared-components";
import type {
    TimelineViewSnapshot,
    TimelineViewActions,
    TimelineItem,
    PaginationState,
} from "@element-hq/web-shared-components";

const PAGINATE_SIZE = 20;
const INITIAL_SIZE = 30;

/** Starting value for `firstItemIndex`, high enough that prepends never go negative. */
const INITIAL_FIRST_ITEM_INDEX = 100_000;

/** Debounce for `atBottom=false` — filters transient layout-induced readings during prepend. */
const AT_BOTTOM_DEBOUNCE_MS = 150;

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
    private readonly opts: RoomTimelineViewModelOpts;
    private timelineWindow: TimelineWindow;

    /** Timer used to debounce atBottom=false transitions. */
    private atBottomTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(opts: RoomTimelineViewModelOpts) {
        super(opts, {
            items: [],
            firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
            stuckAtBottom: true,
            backwardPagination: "idle",
            forwardPagination: "idle",
            pendingAnchor: null,
        });

        this.opts = opts;
        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet());

        this.load(opts.initialEventId);

        // Listen for new events so live messages appear.
        opts.room.on(RoomEvent.Timeline, this.onRoomTimeline);
    }

    public dispose(): void {
        if (this.atBottomTimer !== null) clearTimeout(this.atBottomTimer);
        this.opts.room.off(RoomEvent.Timeline, this.onRoomTimeline);
    }

    private onRoomTimeline = (
        _event: MatrixEvent,
        _room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        // Ignore backfilled events (we load our own backwards pagination) and
        // redactions; only respond to genuinely new live events at the end of
        // the timeline. Without this filter the handler would re-build items
        // for every reaction/decryption/redaction ripple that passes through.
        if (toStartOfTimeline || removed || data.liveEvent !== true) return;

        this.timelineWindow.paginate(Direction.Forward, 1).then(() => {
            this.snapshot.merge({ items: this.buildItems() });
        });
    };

    private async load(eventId?: string): Promise<void> {
        this.snapshot.merge({
            backwardPagination: "loading",
            forwardPagination: "loading",
        });

        try {
            await this.timelineWindow.load(eventId, INITIAL_SIZE);
            this.snapshot.merge({
                items: this.buildItems(),
                backwardPagination: "idle",
                forwardPagination: "idle",
                // For a permalink load, scroll to the target. For a bottom-of-room
                // load the TimelineView handles initial placement via its
                // `initialTopMostItemIndex={LAST}` on mount.
                pendingAnchor: eventId
                    ? { targetKey: eventId, align: "center", highlight: true }
                    : null,
            });
        } catch {
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

    public onAnchorReached = (): void => {
        this.snapshot.merge({ pendingAnchor: null });
    };

    public onStuckAtBottomChanged = (atBottom: boolean): void => {
        if (atBottom) {
            // Immediately accept atBottom=true (cancel any pending flip-to-false).
            if (this.atBottomTimer !== null) {
                clearTimeout(this.atBottomTimer);
                this.atBottomTimer = null;
            }
            this.snapshot.merge({ stuckAtBottom: true });
        } else {
            // Debounce atBottom=false — transient false readings (from prepend layout
            // or height expansion) should not flip followOutput off.
            if (this.atBottomTimer !== null) return;
            this.atBottomTimer = setTimeout(() => {
                this.atBottomTimer = null;
                this.snapshot.merge({ stuckAtBottom: false });
            }, AT_BOTTOM_DEBOUNCE_MS);
        }
    };

    // ── Pagination ───────────────────────────────────────────────────

    private paginate(direction: "backward" | "forward"): void {
        const dir = direction === "backward" ? Direction.Backward : Direction.Forward;
        const stateKey = direction === "backward" ? "backwardPagination" : "forwardPagination";

        if (!this.timelineWindow.canPaginate(dir)) return;

        this.snapshot.merge({ [stateKey]: "loading" as PaginationState });

        // Capture a stable anchor key from the current items BEFORE paginating.
        // We use this to measure the exact number of prepended items (instead of
        // diffing array lengths), because `onRoomTimeline` handlers can append
        // live events concurrently while the paginate request is in-flight.
        // Diffing lengths would conflate those appends with backward-prepended
        // events and cause `firstItemIndex` to decrement by too much, shifting
        // every existing item's Virtuoso index and producing visible scroll
        // flicker/jumps.
        //
        // We anchor on an **event** key (not a date-separator) because
        // date-separators use deterministic keys (`date-<dayString>`) that are
        // regenerated identically across a prepend boundary when the older
        // events are from the same day; locating the old separator in the new
        // list would return its original index and the prepend count would be 0.
        const prevItems = this.snapshot.current.items;
        const anchorKey = prevItems.find((it) => it.kind === "event")?.key;

        this.timelineWindow
            .paginate(dir, PAGINATE_SIZE)
            .then(() => {
                const items = this.buildItems();
                const update: Partial<TimelineViewSnapshot> = {
                    items,
                    [stateKey]: "idle" as PaginationState,
                };
                if (direction === "backward") {
                    const prepended = this.countPrepended(prevItems, items, anchorKey);
                    if (prepended > 0) {
                        update.firstItemIndex = this.snapshot.current.firstItemIndex - prepended;
                    }
                }
                this.snapshot.merge(update);
            })
            .catch(() => {
                this.snapshot.merge({ [stateKey]: "error" as PaginationState });
            });
    }

    /**
     * Count how many items were prepended in `next` relative to `prev`, using
     * the provided `anchorKey` (an event key that was in `prev`) as the fixed
     * reference point. Falls back to the position of the first event in `next`
     * if no anchor was available (i.e. `prev` had no events).
     */
    private countPrepended(
        prev: TimelineItem[],
        next: TimelineItem[],
        anchorKey: string | undefined,
    ): number {
        if (anchorKey === undefined) {
            const firstEventIdx = next.findIndex((it) => it.kind === "event");
            if (firstEventIdx >= 0) return firstEventIdx;
            return Math.max(0, next.length - prev.length);
        }
        const newIdx = next.findIndex((it) => it.key === anchorKey);
        const oldIdx = prev.findIndex((it) => it.key === anchorKey);
        if (newIdx < 0 || oldIdx < 0) return 0;
        return Math.max(0, newIdx - oldIdx);
    }

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
                    label: eventDate.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    }),
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
