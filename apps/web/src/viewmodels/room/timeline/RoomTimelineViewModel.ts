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
    NavigationAnchor,
} from "@element-hq/web-shared-components";
import { haveRendererForEvent } from "../../../events/EventTileFactory";
import shouldHideEvent from "../../../shouldHideEvent";
import SettingsStore from "../../../settings/SettingsStore";
import { logger } from "matrix-js-sdk/src/logger";

const PAGINATE_SIZE = 100;
const INITIAL_SIZE = 100;

/**
 * Discriminated union describing the initial scroll target for {@link RoomTimelineViewModel.load}.
 *
 * - `live`      — scroll to the live end of the room.
 * - `permalink` — centre on `eventId` and highlight it.
 * - `restore`   — scroll to the saved `eventId` without highlighting.
 */
type LoadTarget =
    | { kind: "live" }
    | { kind: "permalink"; eventId: string }
    | { kind: "restore"; eventId: string };

/** Starting value for `firstItemIndex`, high enough that prepends never go negative. */
const INITIAL_FIRST_ITEM_INDEX = 100_000;

export interface RoomTimelineViewModelOpts {
    client: MatrixClient;
    room: Room;
    /** Optional anchor for initial load (permalink, search result). Shown highlighted and centred. */
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

    /**
     * Cache of continuation decisions keyed by event id.
     *
     * A timeline event's `continuation` flag (suppresses avatar + sender name
     * when consecutive messages are from the same sender) is a function of the
     * event and its PREVIOUS neighbour. When back-pagination prepends events,
     * the previously-first event gains a new neighbour, which can flip its
     * continuation flag from `false` to `true`. That flip changes the rendered
     * row's height and shifts every item below it, causing a visible scroll
     * jump because Virtuoso's scroll anchor is measured in pixels.
     *
     * To avoid that, we fix each event's continuation status the first time
     * we see it and never recompute it afterwards. The slight visual cost
     * (a duplicate avatar at a pagination boundary) is much better than
     * scroll drift.
     */
    private continuationCache = new Map<string, boolean>();

    /**
     * Set on `permalink` and `restore` loads; cleared on the first `onEndReached`.
     * Allows that first call to bypass the `pendingAnchor` guard so the initial
     * window fills while the anchor scroll is still pending.
     */
    private anchoredLoad = false;

    /**
     * In-flight backward pagination chain, or null when idle.
     *
     * A single `Promise<void>` is created for the first `onStartReached` call.
     * Any further `onStartReached` calls while the chain is running simply
     * return early — they point at the same in-flight work rather than
     * starting a parallel one. When the chain settles this is set back to null,
     * and the next `onStartReached` creates a fresh chain.
     *
     * Using a stored promise as the guard (rather than checking
     * `backwardPagination === "loading"` in the snapshot) ensures coalescing
     * survives the async gap between when we clear the loading state and when
     * the React render triggered by that state change fires.
     */
    private backwardPaginateChain: Promise<void> | null = null;

    /** Mirror of {@link backwardPaginateChain} for the forward direction. */
    private forwardPaginateChain: Promise<void> | null = null;

    /** True when Virtuoso reports the list is scrolled to the bottom. */
    private isAtBottom = false;

    /**
     * The event ID of the bottommost visible item as last reported by
     * {@link onVisibleRangeChanged}. Persisted to localStorage on dispose
     * so the view can be restored to this position next visit.
     */
    private lastBottomEventId: string | null = null;

    private static readonly SCROLL_STATE_KEY_PREFIX = "timeline_scroll_";

    private static readScrollTarget(roomId: string): string | null {
        try {
            return localStorage.getItem(`${RoomTimelineViewModel.SCROLL_STATE_KEY_PREFIX}${roomId}`);
        } catch {
            return null;
        }
    }

    private static saveScrollTarget(roomId: string, eventId: string | null): void {
        try {
            if (eventId) {
                localStorage.setItem(`${RoomTimelineViewModel.SCROLL_STATE_KEY_PREFIX}${roomId}`, eventId);
            } else {
                localStorage.removeItem(`${RoomTimelineViewModel.SCROLL_STATE_KEY_PREFIX}${roomId}`);
            }
        } catch {
            // Ignore storage errors (private browsing, quota exceeded, etc.)
        }
    }

    public constructor(opts: RoomTimelineViewModelOpts) {
        super(opts, {
            items: [],
            firstItemIndex: INITIAL_FIRST_ITEM_INDEX,
            backwardPagination: "idle",
            forwardPagination: "idle",
            atLiveEnd: false,
            pendingAnchor: null,
            highlightedEventId: opts.initialEventId ?? null,
        });

        this.opts = opts;
        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet());

        // Determine how to load the timeline.
        let loadTarget: LoadTarget;
        if (opts.initialEventId) {
            loadTarget = { kind: "permalink", eventId: opts.initialEventId };
        } else {
            const savedEventId = RoomTimelineViewModel.readScrollTarget(opts.room.roomId);
            loadTarget = savedEventId ? { kind: "restore", eventId: savedEventId } : { kind: "live" };
        }

        this.load(loadTarget);

        // Listen for new events so live messages appear.
        this.disposables.trackListener(opts.room, RoomEvent.Timeline, this.onRoomTimeline as (...args: unknown[]) => void);
    }

    private onRoomTimeline = (
        event: MatrixEvent,
        _room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        // Only handle events in our timeline set (the unfiltered room timeline).
        const ourTimelineSet = this.opts.room.getUnfilteredTimelineSet();
        if (data.timeline.getTimelineSet() !== ourTimelineSet) {
            // logger.debug(
            //     `[TimelineVM][onRoomTimeline] ignoring event ${event.getId()} — wrong timeline set`,
            // );
            return;
        }

        // Ignore backfilled events (we load our own backwards pagination) and
        // redactions; only respond to genuinely new live events at the end of
        // the timeline. Without this filter the handler would re-build items
        // for every reaction/decryption/redaction ripple that passes through.
        if (toStartOfTimeline || removed || data.liveEvent !== true) return;
        if (this.isDisposed) return;

        logger.debug("[TimelineVM][onRoomTimeline] live event — forwarding 1 event");
        this.timelineWindow.paginate(Direction.Forward, 1, false).then((extended) => {
            if (this.isDisposed) return;
            logger.debug(
                `[TimelineVM][onRoomTimeline] paginate done — extended=${extended}, ` +
                `items before=${this.snapshot.current.items.length}`,
            );
            const items = this.buildItems();
            logger.debug(`[TimelineVM][onRoomTimeline] buildItems → ${items.length} items`);
            this.snapshot.merge({
                items,
                atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
            });
        });
    };

    private async load(target: LoadTarget): Promise<void> {
        logger.debug(`[TimelineVM] load() start — kind=${target.kind}${target.kind !== "live" ? ` eventId=${target.eventId}` : ""}`);
        this.snapshot.merge({
            backwardPagination: "loading",
            forwardPagination: "loading",
        });

        const sdkLoadTarget = target.kind !== "live" ? target.eventId : undefined;

        try {
            await this.timelineWindow.load(sdkLoadTarget, INITIAL_SIZE);
            if (this.isDisposed) return;
            const windowEvents = this.timelineWindow.getEvents();
            logger.debug(
                `[TimelineVM] load() window — ${windowEvents.length} events in window, ` +
                `canPaginate(Backward)=${this.timelineWindow.canPaginate(Direction.Backward)}, ` +
                `canPaginate(Forward)=${this.timelineWindow.canPaginate(Direction.Forward)}`,
            );
            if (windowEvents.length > 0) {
                logger.debug(
                    `[TimelineVM] load() window first=${windowEvents[0].getId()} (${windowEvents[0].getType()}), ` +
                    `last=${windowEvents[windowEvents.length - 1].getId()} (${windowEvents[windowEvents.length - 1].getType()})`,
                );
            }
            const items = this.buildItems();
            logger.debug(
                `[TimelineVM] load() done — ${windowEvents.length} events → ${items.length} items after filtering`,
            );

            if (target.kind === "permalink" || target.kind === "restore") {
                // Both cases start with a small centred window. Allow the first automatic
                // onEndReached to forward-paginate (filling the window) but prevent that
                // chain from setting atLiveEnd=true and jumping the view to the bottom.
                this.anchoredLoad = true;
                logger.debug(`[TimelineVM] load() — anchoredLoad=true (kind=${target.kind})`);
            }

            let pendingAnchor: NavigationAnchor | null = null;

            if (target.kind === "permalink") {
                pendingAnchor = { targetKey: target.eventId, align: "center", highlight: true };
            } else if (target.kind === "restore") {
                if (items.some((i) => i.key === target.eventId)) {
                    pendingAnchor = { targetKey: target.eventId, align: "end" };
                } else {
                    // Saved event was redacted / fell outside the window — fall through to live-end.
                    logger.debug(`[TimelineVM] load() — restore target ${target.eventId} not in items, falling back to live end`);
                }
            }

            if (!pendingAnchor && items.length > 0 && !this.timelineWindow.canPaginate(Direction.Forward)) {
                // Live-end load (or stale restore fallback): anchor to the last rendered
                // item so scrollIntoViewOnChange fires post-ResizeObserver and the view
                // reliably lands at the very bottom.
                pendingAnchor = { targetKey: items[items.length - 1].key, align: "end" };
                logger.debug(`[TimelineVM] load() — live-end anchor key=${pendingAnchor.targetKey}`);
            }

            this.snapshot.merge({
                items,
                backwardPagination: "idle",
                forwardPagination: "idle",
                atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                pendingAnchor,
                highlightedEventId: target.kind === "permalink" ? target.eventId : null,
            });
        } catch (e) {
            logger.error(`[TimelineVM] load() error`, e);
            this.snapshot.merge({
                backwardPagination: "error",
                forwardPagination: "error",
            });
        }
    }

    // ── TimelineViewActions ──────────────────────────────────────────

    public onStartReached = (): void => {
        logger.debug(
            `[TimelineVM] onStartReached — firstItemIndex=${this.snapshot.current.firstItemIndex}, items=${this.snapshot.current.items.length}`,
        );
        this.triggerBackwardPaginate();
    };

    public onEndReached = (): void => {
        logger.debug("[TimelineVM] onEndReached");
        this.triggerForwardPaginate();
    };

    public onAnchorReached = (): void => {
        logger.debug(`[TimelineVM] onAnchorReached — clearing pendingAnchor, anchoredLoad=${this.anchoredLoad}`);
        this.snapshot.merge({ pendingAnchor: null });
    };

    public onAtBottomStateChange = (atBottom: boolean): void => {
        this.isAtBottom = atBottom;
    };

    /**
     * Called by the View on every Virtuoso `rangeChanged` event.
     * Walks backwards from `endIndex` to find the bottommost rendered event,
     * then stores its ID for scroll-position persistence on dispose.
     */
    public onVisibleRangeChanged = (startIndex: number, endIndex: number): void => {
        // Don't update while an anchor scroll is in progress — the range reflects the
        // view mid-scroll, not the user's actual reading position. Once the anchor is
        // reached and pendingAnchor is cleared, normal tracking resumes.
        if (this.snapshot.current.pendingAnchor !== null) return;

        const items = this.snapshot.current.items;
        for (let i = endIndex; i >= startIndex; i--) {
            const index = i - this.snapshot.current.firstItemIndex;
            const item = items[index];
            if (item?.kind === "event") {
                this.lastBottomEventId = item.key;
                return;
            }
        }
    };

    /**
     * Save the current scroll position to localStorage before tearing down.
     * Clears the saved position only when the user is visually at the bottom
     * of the list (so the next visit starts fresh at the live end).
     * Preserves any existing saved position when no visible range was recorded.
     */
    public override dispose(): void {
        if (!this.lastBottomEventId) {
            logger.debug(`[TimelineVM] dispose() — no visible range recorded, preserving saved position`);
            super.dispose();
            return;
        }

        if (this.isAtBottom) {
            logger.debug(`[TimelineVM] dispose() — clearing saved scroll position (at visual bottom)`);
            RoomTimelineViewModel.saveScrollTarget(this.opts.room.roomId, null);
        } else {
            logger.debug(`[TimelineVM] dispose() — saving scroll position eventId=${this.lastBottomEventId}`);
            RoomTimelineViewModel.saveScrollTarget(this.opts.room.roomId, this.lastBottomEventId);
        }
        super.dispose();
    }

    // ── Pagination ───────────────────────────────────────────────────

    /**
     * Entry point for backward pagination. Coalesces concurrent calls behind a
     * single in-flight chain; Virtuoso will re-fire `onStartReached` naturally
     * if more items are needed after the chain settles.
     */
    private triggerBackwardPaginate(): void {
        if (this.backwardPaginateChain) {
            logger.debug(`[TimelineVM] paginate(backward) coalesced — chain in flight`);
            return;
        }

        if (!this.timelineWindow.canPaginate(Direction.Backward)) {
            logger.debug(`[TimelineVM] paginate(backward) skipped — canPaginate=false`);
            return;
        }

        this.backwardPaginateChain = this.runPaginateChain(Direction.Backward).finally(() => {
            this.backwardPaginateChain = null;
        });
    }

    /**
     * Entry point for forward pagination. Coalesces concurrent `onEndReached`
     * calls behind a single in-flight chain.
     *
     * Handles two cross-cutting concerns before delegating to the shared chain:
     * - `anchoredLoad`: consumed exactly once on the first `onEndReached` after
     *   a non-live initial load, so it is cleared here (instance state) rather
     *   than inside the async chain.
     * - `pendingAnchor` guard: while an anchor is pending we suppress any
     *   `onEndReached` that was NOT the initial load's own first call, which
     *   would otherwise paginate all the way to the live end and jump the view.
     */
    private triggerForwardPaginate(): void {
        if (this.forwardPaginateChain) {
            logger.debug(`[TimelineVM] paginate(forward) coalesced — chain in flight`);
            return;
        }

        // Consume the anchored-load flag — always safe to clear, harmless if already false.
        const wasAnchoredLoad = this.anchoredLoad;
        this.anchoredLoad = false;
        if (wasAnchoredLoad) {
            logger.debug(`[TimelineVM] paginate(forward) — consuming anchoredLoad`);
        }

        logger.debug(
            `[TimelineVM] paginate(forward) check — canPaginate=${this.timelineWindow.canPaginate(Direction.Forward)}, ` +
            `atLiveEnd=${this.snapshot.current.atLiveEnd}, items=${this.snapshot.current.items.length}, ` +
            `wasAnchoredLoad=${wasAnchoredLoad}`,
        );

        // Suppress further forward pagination while an anchor is pending — except
        // for the initial anchored load's own first onEndReached (wasAnchoredLoad).
        if (!wasAnchoredLoad && this.snapshot.current.pendingAnchor !== null) {
            logger.debug(`[TimelineVM] paginate(forward) skipped — pendingAnchor still set`);
            return;
        }

        if (!this.timelineWindow.canPaginate(Direction.Forward)) {
            logger.debug(`[TimelineVM] paginate(forward) skipped — canPaginate=false`);
            if (!this.snapshot.current.atLiveEnd) {
                logger.debug(`[TimelineVM] paginate(forward) — setting atLiveEnd=true`);
                this.snapshot.merge({ atLiveEnd: true });
            }
            return;
        }

        this.forwardPaginateChain = this.runPaginateChain(Direction.Forward, wasAnchoredLoad).finally(() => {
            this.forwardPaginateChain = null;
        });
    }

    /**
     * Shared pagination chain for both directions.
     *
     * Loops internally when all fetched events are filtered (state events,
     * hidden events, etc.) so the user is never left stranded at an invisible
     * boundary. The loop holds the relevant loading state for its entire
     * duration, giving a single loading→idle transition per logical pagination
     * regardless of how many empty SDK batches are needed.
     *
     * Differences between directions handled inline:
     * - **Backward**: uses {@link mergePrepended} and decrements `firstItemIndex`.
     * - **Forward**: rebuilds from the full window; updates `atLiveEnd` on completion.
     */
    private async runPaginateChain(direction: Direction, wasAnchoredLoad = false): Promise<void> {
        // Not strictly necessary — the loop already terminates when canPaginate() returns
        // false or hasMore is false. However, leaving it unbounded without user action feels a bit weird.
        // This is a bit more defensive in that after 10 we give up and require the user to scroll again to trigger another chain.
        const MAX_EMPTY_RETRIES = 10;
        const isBackward = direction === Direction.Backward;
        const dirLabel = isBackward ? "backward" : "forward";
        const loadingKey = isBackward ? "backwardPagination" : "forwardPagination";

        this.snapshot.merge({ [loadingKey]: "loading" });

        try {
            let emptyBatches = 0;

            while (emptyBatches <= MAX_EMPTY_RETRIES) {
                if (!this.timelineWindow.canPaginate(direction)) {
                    logger.debug(`[TimelineVM] paginate(${dirLabel}) chain end — canPaginate=false`);
                    break;
                }

                // Re-read snapshot after each async gap: the other direction may
                // have updated items or firstItemIndex while we were awaiting.
                const currentItems = this.snapshot.current.items;
                const currentFirstItemIndex = this.snapshot.current.firstItemIndex;

                logger.debug(
                    `[TimelineVM] paginate(${dirLabel}) batch — ` +
                    `emptyBatches=${emptyBatches}, items=${currentItems.length}, ` +
                    `firstItemIndex=${currentFirstItemIndex}`,
                );

                const hasMore = await this.timelineWindow.paginate(direction, PAGINATE_SIZE);
                if (this.isDisposed) return;

                const rebuilt = this.buildItems();
                let added: number;

                if (isBackward) {
                    // Re-read again — forward pagination may have appended during the await.
                    const postItems = this.snapshot.current.items;
                    const postFirstItemIndex = this.snapshot.current.firstItemIndex;
                    const items = this.mergePrepended(postItems, rebuilt);
                    const prepended = items.length - postItems.length;
                    added = prepended;
                    logger.debug(
                        `[TimelineVM] paginate(backward) batch done — ` +
                        `prepended=${prepended}, hasMore=${hasMore}, emptyBatches=${emptyBatches}, ` +
                        `firstItemIndex: ${postFirstItemIndex} → ${postFirstItemIndex - prepended}`,
                    );
                    this.snapshot.merge({ items, firstItemIndex: postFirstItemIndex - prepended });
                } else {
                    added = rebuilt.length - currentItems.length;
                    logger.debug(
                        `[TimelineVM] paginate(forward) batch done — ` +
                        `appended=${added}, hasMore=${hasMore}, emptyBatches=${emptyBatches}`,
                    );
                    this.snapshot.merge({ items: rebuilt });
                }

                if (added > 0 || !hasMore) break;

                // All fetched events were filtered — keep going.
                emptyBatches++;
            }

            const completionUpdate: Partial<TimelineViewSnapshot> = { [loadingKey]: "idle" };
            if (!isBackward) {
                completionUpdate.atLiveEnd = !this.timelineWindow.canPaginate(Direction.Forward);
            }
            this.snapshot.merge(completionUpdate);
        } catch (e) {
            logger.error(`[TimelineVM] paginate(${dirLabel}) error`, e);
            this.snapshot.merge({ [loadingKey]: "error" });
        }
    }

    /**
     * Merge a freshly-built item list with the existing one after a backward
     * pagination, returning `[...newPrefix, ...prev]` where `newPrefix` is
     * the slice of `next` that appears BEFORE the first key already present
     * in `prev`.
     *
     * This deliberately discards any changes `next` may contain in the
     * middle or at the tail of the list (e.g. a previously-encrypted event
     * that is now renderable, or a newly-appended live event). Those would
     * be middle-insertions from Virtuoso's perspective and would shift its
     * scroll anchor by the inserted items' height. Middle changes will be
     * picked up on the next pagination, and render-side content updates
     * (decryption, reactions, edits) flow through the renderer directly
     * because they key on the underlying event id.
     *
     * When `next` contains no keys from `prev` (e.g. the first pagination
     * on an empty list) we use it verbatim.
     *
     * If the last prepended item and the first prev item are date separators
     * for the same date, the duplicate leading the prev suffix is dropped.
     */
    private mergePrepended(prev: TimelineItem[], next: TimelineItem[]): TimelineItem[] {
        if (prev.length === 0) return next;
        const prevKeys = new Set(prev.map((it) => it.key));
        const firstSharedIdx = next.findIndex((it) => prevKeys.has(it.key));
        if (firstSharedIdx < 0) {
            // Nothing shared — treat as a fresh list.
            return next;
        }
        const prefix = next.slice(0, firstSharedIdx);
        // De-dup: if prefix ends with a date separator whose key matches the
        // first item of prev (also a date separator), prev already owns it.
        if (
            prefix.length > 0 &&
            prefix[prefix.length - 1].kind === "date-separator" &&
            prev[0].kind === "date-separator" &&
            prefix[prefix.length - 1].key === prev[0].key
        ) {
            prefix.pop();
        }
        return [...prefix, ...prev];
    }

    // ── Snapshot construction ────────────────────────────────────────

    private static readonly CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000;
    private static readonly CONTINUED_TYPES = new Set(["m.room.message", "m.sticker"]);

    private buildItems(): TimelineItem[] {
        const events: MatrixEvent[] = this.timelineWindow.getEvents();
        const items: TimelineItem[] = [];
        let lastDate: string | null = null;
        let prevEvent: MatrixEvent | null = null;
        let filteredCount = 0;

        const showHiddenEvents = SettingsStore.getValue("showHiddenEventsInTimeline");

        for (const event of events) {
            const eventId = event.getId();
            if (!eventId) continue;
            if (!haveRendererForEvent(event, this.opts.client, showHiddenEvents)) {
                logger.debug(`[TimelineVM] buildItems filtering event ${eventId} (${event.getType()}) — no renderer`);
                filteredCount++;
                continue;
            }
            if (shouldHideEvent(event)) {
                logger.debug(`[TimelineVM] buildItems filtering event ${eventId} (${event.getType()}) — shouldHideEvent`);
                filteredCount++;
                continue;
            }

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
                continuation: this.getCachedContinuation(eventId, prevEvent, event),
            });
            prevEvent = event;
        }

        if (filteredCount > 0) {
            logger.debug(`[TimelineVM] buildItems — ${filteredCount} events filtered out of ${events.length} total`);
        }

        return items;
    }

    /**
     * Return the continuation flag for `event`, using a cached value if we
     * have already seen the event before. See `continuationCache` for why.
     */
    private getCachedContinuation(
        eventId: string,
        prev: MatrixEvent | null,
        cur: MatrixEvent,
    ): boolean {
        const cached = this.continuationCache.get(eventId);
        if (cached !== undefined) return cached;
        const value = this.shouldFormContinuation(prev, cur);
        this.continuationCache.set(eventId, value);
        return value;
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
