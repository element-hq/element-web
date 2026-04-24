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
} from "@element-hq/web-shared-components";
import { haveRendererForEvent } from "../../../events/EventTileFactory";
import shouldHideEvent from "../../../shouldHideEvent";
import SettingsStore from "../../../settings/SettingsStore";
import { logger } from "matrix-js-sdk/src/logger";

const PAGINATE_SIZE = 100;
const INITIAL_SIZE = 100;

/** Starting value for `firstItemIndex`, high enough that prepends never go negative. */
const INITIAL_FIRST_ITEM_INDEX = 100_000;

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
     * True from the moment a permalink `load(eventId)` completes until the
     * first `onEndReached` is processed.  Prevents that first (Virtuoso-
     * triggered-on-tiny-list) `onEndReached` from setting `atLiveEnd=true`
     * and jumping the view to the bottom.
     *
     * Unlike `pendingAnchor`, this flag lives on the instance (not in the
     * snapshot) so it is NOT affected by `onAnchorReached()` clearing the
     * snapshot anchor before `onEndReached` fires.
     */
    private permalinkMode = false;

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

        this.load(opts.initialEventId);

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
            // Only promote atLiveEnd to true if we were already tracking the live end.
            // If the user loaded a permalink (atLiveEnd starts false), live events
            // arriving in the background will eventually paginate the window to the
            // live edge, but we must NOT flip followOutput on — that would auto-scroll
            // Virtuoso to the bottom. atLiveEnd is set to true properly once the user
            // manually scrolls to the bottom and triggerForwardPaginate completes.
            const wasAtLiveEnd = this.snapshot.current.atLiveEnd;
            const nowAtLiveEnd = wasAtLiveEnd && !this.timelineWindow.canPaginate(Direction.Forward);
            logger.debug(
                `[TimelineVM][onRoomTimeline] atLiveEnd: wasAtLiveEnd=${wasAtLiveEnd} nowAtLiveEnd=${nowAtLiveEnd}`,
            );
            this.snapshot.merge({
                items,
                atLiveEnd: nowAtLiveEnd,
            });
        });
    };

    private async load(eventId?: string): Promise<void> {
        logger.debug(`[TimelineVM] load() start — eventId=${eventId ?? "none"}`);
        this.snapshot.merge({
            backwardPagination: "loading",
            forwardPagination: "loading",
        });

        try {
            await this.timelineWindow.load(eventId, INITIAL_SIZE);
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
                `[TimelineVM] load() done — ${windowEvents.length} events → ${items.length} items after filtering, ` +
                `highlightedEventId=${eventId ?? "none"}`,
            );
            if (eventId) {
                this.permalinkMode = true;
                logger.debug(`[TimelineVM] load() — permalinkMode=true`);
            }
            this.snapshot.merge({
                items,
                backwardPagination: "idle",
                forwardPagination: "idle",
                atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                // Only permalink loads request an explicit scroll target. Bottom-of-room
                // loads rely on Virtuoso's `alignToBottom` behaviour; any residual
                // "landed above the bottom" caused by items resizing after mount is
                // addressed at the item layer by reserving heights (e.g. encrypted
                // tile placeholders, media sizes) and by suppressing media during
                // scroll.
                pendingAnchor: eventId
                    ? { targetKey: eventId, align: "center", highlight: true }
                    : null,
                highlightedEventId: eventId ?? null,
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
        this.snapshot.merge({ pendingAnchor: null });
    };

    // ── Pagination ───────────────────────────────────────────────────

    /**
     * Entry point for backward pagination. Coalesces concurrent calls: if a
     * chain is already in flight (e.g. Virtuoso fires `onStartReached` twice
     * during a single scroll gesture) the extra calls are silently dropped —
     * the existing chain will re-check whether we are still at the start after
     * it settles, and Virtuoso will re-fire `onStartReached` naturally if more
     * items are needed.
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

        this.backwardPaginateChain = this.runBackwardPaginateChain().finally(() => {
            this.backwardPaginateChain = null;
        });
    }

    /**
     * Runs a backward pagination chain to completion.
     *
     * Loops internally when all fetched events are filtered (state events,
     * hidden events, etc.) and there is still more history to fetch — this
     * avoids leaving the user stranded at an invisible boundary. The loop
     * holds `backwardPagination="loading"` for its entire duration so the
     * view transitions through exactly one loading→idle cycle per chain,
     * regardless of how many empty SDK batches are needed.
     *
     * After each batch the snapshot items and `firstItemIndex` are updated
     * immediately (via {@link mergePrepended}), so the user sees content as
     * soon as it lands even in the middle of a long filtered-event stretch.
     */
    private async runBackwardPaginateChain(): Promise<void> {
        const MAX_EMPTY_RETRIES = 10;

        this.snapshot.merge({ backwardPagination: "loading" });

        try {
            let emptyBatches = 0;

            while (emptyBatches <= MAX_EMPTY_RETRIES) {
                if (!this.timelineWindow.canPaginate(Direction.Backward)) {
                    logger.debug(`[TimelineVM] paginate(backward) chain end — canPaginate=false`);
                    break;
                }

                const prevItems = this.snapshot.current.items;
                const preLoadFirstItemIndex = this.snapshot.current.firstItemIndex;

                logger.debug(
                    `[TimelineVM] paginate(backward) batch — ` +
                        `emptyBatches=${emptyBatches}, items=${prevItems.length}, ` +
                        `firstItemIndex=${preLoadFirstItemIndex}`,
                );

                const hasMore = await this.timelineWindow.paginate(Direction.Backward, PAGINATE_SIZE);

                // Re-read the current snapshot after the async gap — forward pagination
                // may have updated items while we were waiting.  Using a stale prevItems
                // would cause mergePrepended to discard any events that were appended
                // by concurrent forward pagination.
                const currentItems = this.snapshot.current.items;
                const currentFirstItemIndex = this.snapshot.current.firstItemIndex;

                const rebuilt = this.buildItems();
                const items = this.mergePrepended(currentItems, rebuilt);
                const prepended = items.length - currentItems.length;
                const newFirstItemIndex = currentFirstItemIndex - prepended;

                logger.debug(
                    `[TimelineVM] paginate(backward) batch done — ` +
                        `prepended=${prepended}, hasMore=${hasMore}, emptyBatches=${emptyBatches}, ` +
                        `firstItemIndex: ${preLoadFirstItemIndex} → ${newFirstItemIndex}`,
                );

                // Merge items and firstItemIndex immediately so the user sees
                // content as soon as it lands. Pagination state stays "loading"
                // — the view renders one continuous loading period for the whole
                // chain rather than flickering per-batch.
                this.snapshot.merge({ items, firstItemIndex: newFirstItemIndex });

                if (prepended > 0) {
                    break;
                }

                if (!hasMore) {
                    // Reached the beginning of history.
                    break;
                }

                // All fetched events were filtered — keep going.
                emptyBatches++;
            }

            this.snapshot.merge({ backwardPagination: "idle" });
        } catch (e) {
            logger.error(`[TimelineVM] paginate(backward) error`, e);
            this.snapshot.merge({ backwardPagination: "error" });
        }
    }

    /**
     * Forward pagination — simpler than backward: no retry loop (forward
     * events are live and rarely all-filtered), no coalescing needed (forward
     * is rate-limited naturally by the live event stream), no firstItemIndex
     * bookkeeping (appends don't disturb the scroll anchor).
     */
    private triggerForwardPaginate(): void {
        if (this.snapshot.current.forwardPagination === "loading") {
            logger.debug(`[TimelineVM] paginate(forward) skipped — already loading`);
            return;
        }

        // Consume the permalink flag before any async work so it is cleared
        // exactly once, regardless of the canPaginate result.
        const wasInPermalinkMode = this.permalinkMode;
        if (wasInPermalinkMode) {
            this.permalinkMode = false;
            logger.debug(`[TimelineVM] paginate(forward) — consuming permalinkMode`);
        }

        const canFwd = this.timelineWindow.canPaginate(Direction.Forward);
        logger.debug(
            `[TimelineVM] paginate(forward) check — canPaginate=${canFwd}, ` +
            `atLiveEnd=${this.snapshot.current.atLiveEnd}, items=${this.snapshot.current.items.length}, ` +
            `wasInPermalinkMode=${wasInPermalinkMode}`,
        );

        // After the initial permalink window load, suppress further forward pagination
        // until the anchor has been resolved. Without this, a second onEndReached that
        // fires because the initial window is too short to fill the viewport would
        // paginate all the way to the live end, jumping the user away from the target.
        if (!wasInPermalinkMode && this.snapshot.current.pendingAnchor !== null) {
            logger.debug(`[TimelineVM] paginate(forward) skipped — pendingAnchor still set`);
            return;
        }

        if (!canFwd) {
            logger.debug(`[TimelineVM] paginate(forward) skipped — canPaginate=false`);
            // Only set atLiveEnd=true when this is a genuine user-scroll-to-bottom,
            // not the automatic onEndReached that fires because the initial permalink
            // window is too small to fill the viewport.
            if (!wasInPermalinkMode && !this.snapshot.current.atLiveEnd) {
                logger.debug(`[TimelineVM] paginate(forward) — not in permalink mode, setting atLiveEnd=true`);
                this.snapshot.merge({ atLiveEnd: true });
            }
            return;
        }

        this.snapshot.merge({ forwardPagination: "loading" });

        this.timelineWindow
            .paginate(Direction.Forward, PAGINATE_SIZE)
            .then((hasMore) => {
                const nowAtLiveEnd =
                    !wasInPermalinkMode && !this.timelineWindow.canPaginate(Direction.Forward);
                logger.debug(
                    `[TimelineVM] paginate(forward) done — items=${this.snapshot.current.items.length}, ` +
                    `hasMore=${hasMore}, wasInPermalinkMode=${wasInPermalinkMode}, nowAtLiveEnd=${nowAtLiveEnd}`,
                );
                this.snapshot.merge({
                    items: this.buildItems(),
                    forwardPagination: "idle",
                    atLiveEnd: nowAtLiveEnd,
                });
            })
            .catch((e) => {
                logger.error(`[TimelineVM] paginate(forward) error`, e);
                this.snapshot.merge({ forwardPagination: "error" });
            });
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
