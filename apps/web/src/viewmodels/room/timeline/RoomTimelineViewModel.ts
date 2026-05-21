/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    TimelineWindow,
    Direction,
    RoomEvent,
    EventType,
    MatrixEventEvent,
    NotificationCountType,
    ReceiptType,
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
    ImmediateScroll,
} from "@element-hq/web-shared-components";
import { haveRendererForEvent, pickFactory } from "../../../events/EventTileFactory";
import shouldHideEvent from "../../../shouldHideEvent";
import SettingsStore from "../../../settings/SettingsStore";
import { logger } from "matrix-js-sdk/src/logger";
import { clearRoomNotification } from "../../../utils/notifications";

/** How long after the last scroll event to wait before sending a read receipt (ms). */
const READ_RECEIPT_DEBOUNCE_MS = 500;

const PAGINATE_SIZE = 100;
const INITIAL_SIZE = 100;

/**
 * Maximum time {@link RoomTimelineViewModel.waitForDecryption} blocks the
 * paginate chain on newly-fetched events. Decryption usually completes in
 * tens of milliseconds; this cap stops a slow/failed decryption from holding
 * the loading spinner indefinitely. Stragglers that miss the window get
 * picked up by the next paginate or live-event rebuild.
 */
const PAGINATE_DECRYPT_WAIT_MS = 500;

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

    /** Number of events filtered by the most recent `buildItems()` call. */
    private lastBuildFilteredCount = 0;

    /** Set by {@link start} so a double-start (e.g. via StrictMode) is a no-op. */
    private started = false;

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

    /** The event ID for which we last sent a read receipt, to avoid redundant sends. */
    private lastSentReceiptEventId: string | null = null;

    /** Debounce timer for auto read receipt sends triggered by scroll. */
    private readReceiptDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Debouncer for items rebuilds after a burst of Decrypted events.
     * See {@link onEventDecrypted} / {@link flushDecryptRebuild}.
     */
    private decryptDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private static readonly DECRYPT_FLUSH_DEBOUNCE_MS = 200;

    /** True when Virtuoso reports the list is scrolled to the bottom. */
    private isAtBottom = false;

    /**
     * The event ID of the bottommost visible item as last reported by
     * {@link onVisibleRangeChanged}. Persisted to localStorage on dispose
     * so the view can be restored to this position next visit.
     */
    private lastBottomEventId: string | null = null;

    /**
     * The 0-based index (into the items array) of the topmost currently-visible item.
     * Updated on every `onVisibleRangeChanged` call; used to derive `canJumpToReadMarker`.
     */
    private visibleStartArrayIndex = 0;

    /**
     * The 0-based index (into the items array) of the bottommost currently-visible item.
     * Updated on every `onVisibleRangeChanged` call; used to derive `canJumpToReadMarker`.
     */
    private visibleEndArrayIndex = 0;

    /**
     * The Matrix event ID of the room's "fully read" marker. null when none is set.
     * Tracked via `RoomEvent.AccountData` / `EventType.FullyRead`. Reflects server
     * state and may change mid-session if another device advances the marker;
     * used by {@link dispose} and {@link onMarkAllAsRead} but NOT by the UI.
     */
    private readMarkerEventId: string | null = null;

    /**
     * Snapshot of the read-marker position taken once at the start of the session
     * by {@link freezeReadMarkerForSession}, and consumed by {@link buildItems},
     * {@link computeCanJumpToReadMarker} and {@link onJumpToReadMarker}.
     *
     * The visibility / position of the read-divider line is determined entirely
     * at room entry and frozen for the lifetime of this view model:
     *   - `null` means "no line, ever, this session" — either the room is
     *     fully-read on entry, or no marker is set at all.
     *   - A non-null value pins the line at that event for the whole session,
     *     even as the user scrolls, sends messages, or new events arrive.
     *
     * Mirrors Element X iOS, which delegates marker position to the SDK and
     * does not advance it mid-session. The line stays where the user last saw
     * it; it only updates when the user leaves and re-enters the room (see
     * {@link dispose}'s setRoomReadMarkers call). Cleared explicitly by
     * {@link onMarkAllAsRead}.
     */
    private frozenMarkerEventId: string | null = null;

    /**
     * Count of new live messages that arrived since the user last reached the
     * visual bottom of the live timeline. Reset on `onAtBottomStateChange(true)`
     * when `atLiveEnd` is also true.
     */
    private unreadMessageCount = 0;

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
            isAtBottom: false,
            canJumpToReadMarker: false,
            numUnreadMessages: 0,
            hasHighlights: false,
        });

        this.opts = opts;
        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet());

        // Initialise the read marker from room account data.
        this.readMarkerEventId =
            (opts.room.getAccountData(EventType.FullyRead)?.getContent()?.event_id as string | undefined) ?? null;

        // NOTE: deliberately side-effect-free. React StrictMode (and useState
        // initializer checks) invoke `vmCreator` twice in dev, constructing
        // two instances; one is retained, one is discarded. If we registered
        // listeners or kicked off load() here, the discarded instance would
        // silently leak its subscriptions. Side effects belong in {@link start}
        // which the View calls exactly once via useEffect.
    }

    /**
     * Wire the VM up to its data sources and kick off the initial load.
     *
     * Must be called exactly once per instance, after construction, from a
     * React effect (so React's lifecycle controls when subscriptions attach).
     * Calling this from the constructor risks leaking listeners on
     * StrictMode-discarded instances; see the constructor comment.
     */
    public start(): void {
        // In StrictMode dev, a consumer's useEffect can briefly fire with a
        // stale `vm` reference between the hook disposing the old VM and
        // React re-rendering with the new one. That's harmless — we just bail.
        if (this.started || this.isDisposed) return;
        this.started = true;

        // Determine how to load the timeline.
        let loadTarget: LoadTarget;
        if (this.opts.initialEventId) {
            loadTarget = { kind: "permalink", eventId: this.opts.initialEventId };
        } else {
            const savedEventId = RoomTimelineViewModel.readScrollTarget(this.opts.room.roomId);
            loadTarget = savedEventId ? { kind: "restore", eventId: savedEventId } : { kind: "live" };
        }

        this.load(loadTarget);

        // Listen for new events so live messages appear.
        this.disposables.trackListener(this.opts.room, RoomEvent.Timeline, this.onRoomTimeline as (...args: unknown[]) => void);
        // Track changes to the room's fully-read marker.
        this.disposables.trackListener(this.opts.room, RoomEvent.AccountData, this.onRoomAccountData as (...args: unknown[]) => void);
        // Decryption arrivals (late key delivery / key backup) need a rebuild
        // so previously-pending events that we filtered out of items become
        // visible. RoomEvent.Timeline only fires once per event at arrival
        // time and is not re-emitted on decryption (see js-sdk
        // event-timeline-set.js addEventToTimeline → emit Timeline), so this
        // listener is the only signal we have for that transition.
        this.disposables.trackListener(this.opts.client, MatrixEventEvent.Decrypted, this.onEventDecrypted as (...args: unknown[]) => void);
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

        const incomingEventId = event.getId();
        const windowSizeBefore = this.timelineWindow.getEvents().length;
        logger.debug(
            `[TimelineVM][onRoomTimeline] live event — eventId=${incomingEventId} type=${event.getType()} ` +
            `windowSize=${windowSizeBefore} snapshotItems=${this.snapshot.current.items.length} ` +
            `isAtBottom=${this.isAtBottom} pendingAnchor=${this.snapshot.current.pendingAnchor?.targetKey ?? null}`,
        );
        this.timelineWindow.paginate(Direction.Forward, 1, false).then((extended) => {
            if (this.isDisposed) return;
            const windowSizeAfter = this.timelineWindow.getEvents().length;
            logger.debug(
                `[TimelineVM][onRoomTimeline] paginate done — extended=${extended}, ` +
                `windowSize: ${windowSizeBefore} → ${windowSizeAfter}, snapshotItems=${this.snapshot.current.items.length}`,
            );
            const items = this.buildItems();
            const eventInItems = items.some((i) => i.key === incomingEventId);
            const tail = items.slice(-3).map((i) => `${i.kind}:${i.key}`).join(", ");
            logger.debug(
                `[TimelineVM][onRoomTimeline] buildItems → ${items.length} items, ` +
                `eventInItems=${eventInItems}, tail=[${tail}]`,
            );

            const atLiveEnd = !this.timelineWindow.canPaginate(Direction.Forward);
            // Accumulate unread count only for messages from other users.
            if (!this.isAtBottom && event.getSender() !== this.opts.client.getSafeUserId()) {
                this.unreadMessageCount++;
            }
            this.mergeSnapshot(
                {
                    items,
                    atLiveEnd,
                    numUnreadMessages: this.isAtBottom ? 0 : this.unreadMessageCount,
                    hasHighlights: this.opts.room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0,
                    canJumpToReadMarker: this.computeCanJumpToReadMarker(items),
                },
                "live-event",
            );
        });
    };

    /**
     * Decryption arrived for an event in our window. Schedule a debounced
     * rebuild of items so newly-decrypted events that were previously filtered
     * (wire-encrypted-pending → excluded from items, see
     * {@link shouldIncludeEvent}) become visible.
     *
     * Debounced so a paginate-driven cascade of decrypts collapses into a
     * single rebuild instead of one per event — the per-event variant
     * remounted virtuoso tiles repeatedly and restarted media downloads.
     */
    private onEventDecrypted = (event: MatrixEvent): void => {
        if (this.isDisposed) return;
        if (!this.timelineWindow.getEvents().includes(event)) return;

        if (this.decryptDebounceTimer !== null) clearTimeout(this.decryptDebounceTimer);
        this.decryptDebounceTimer = setTimeout(() => {
            this.decryptDebounceTimer = null;
            this.flushDecryptRebuild();
        }, RoomTimelineViewModel.DECRYPT_FLUSH_DEBOUNCE_MS);
    };

    /**
     * Rebuild items in response to a settled burst of decryptions, with
     * firstItemIndex compensation to keep totalCount constant (matches the
     * back-paginate path; virtuoso's upward scroll compensation is gated on
     * `prev totalCount === current totalCount`).
     *
     * **Gated against in-flight paginate chains.** If a chain is running, we
     * defer: the chain's terminal {@link buildItems} will pick up everything
     * these decrypts revealed, and a concurrent rebuild here would race the
     * chain's `prepended` count computation. We re-arm the debounce timer so
     * we try again after the chain finishes — that way a decrypt that fires
     * deep inside a chain doesn't get lost if no further decrypts arrive.
     */
    private flushDecryptRebuild(): void {
        if (this.isDisposed) return;

        if (this.backwardPaginateChain !== null || this.forwardPaginateChain !== null) {
            // Defer until the chain ends.
            if (this.decryptDebounceTimer === null) {
                this.decryptDebounceTimer = setTimeout(() => {
                    this.decryptDebounceTimer = null;
                    this.flushDecryptRebuild();
                }, RoomTimelineViewModel.DECRYPT_FLUSH_DEBOUNCE_MS);
            }
            return;
        }

        const itemsBefore = this.snapshot.current.items;
        const firstItemIndexBefore = this.snapshot.current.firstItemIndex;
        const itemsNew = this.buildItems();
        const delta = itemsNew.length - itemsBefore.length;

        const newCanJumpToReadMarker = this.computeCanJumpToReadMarker(itemsNew);
        const newHasHighlights =
            this.opts.room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0;

        if (delta === 0) {
            // No structural change (decrypts that resolved to already-filtered
            // types like reactions/edits, or events whose state didn't move
            // them in/out of the inclusion set). Refresh derived flags only;
            // mergeSnapshot drops the merge entirely if nothing actually
            // changed.
            this.mergeSnapshot(
                { canJumpToReadMarker: newCanJumpToReadMarker, hasHighlights: newHasHighlights },
                "decrypt-flush(Δ=0)",
            );
            return;
        }

        // Items grew (typical: historical encrypted events newly decrypted).
        // Compensate firstItemIndex by -delta so totalCount stays constant.
        this.mergeSnapshot(
            {
                items: itemsNew,
                firstItemIndex: firstItemIndexBefore - delta,
                canJumpToReadMarker: newCanJumpToReadMarker,
                hasHighlights: newHasHighlights,
            },
            `decrypt-flush(Δ=${delta >= 0 ? "+" : ""}${delta})`,
        );
    }

    /**
     * Wait up to `timeoutMs` for the given encrypted-pending events to decrypt.
     *
     * Resolves as soon as all the given events have either decrypted (success
     * or failure) or the timeout fires, whichever comes first. Stragglers that
     * miss the timeout get picked up by the next paginate or live-event
     * rebuild.
     */
    private async waitForDecryption(events: MatrixEvent[], timeoutMs: number): Promise<void> {
        const pending = events.filter(
            (e) => e.isEncrypted() && e.getClearContent() === null && !e.isDecryptionFailure(),
        );
        if (pending.length === 0) return;

        const detachers: Array<() => void> = [];
        const allDecrypted = Promise.all(
            pending.map(
                (e) =>
                    new Promise<void>((resolve) => {
                        if (e.getClearContent() !== null || e.isDecryptionFailure()) {
                            resolve();
                            return;
                        }
                        const handler = (): void => {
                            e.off(MatrixEventEvent.Decrypted, handler);
                            resolve();
                        };
                        e.on(MatrixEventEvent.Decrypted, handler);
                        detachers.push(() => e.off(MatrixEventEvent.Decrypted, handler));
                    }),
            ),
        );

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<void>((resolve) => {
            timeoutId = setTimeout(resolve, timeoutMs);
        });

        try {
            await Promise.race([allDecrypted, timeout]);
        } finally {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
            for (const detach of detachers) detach();
        }
    }

    private onRoomAccountData = (ev: MatrixEvent): void => {
        if (ev.getType() !== EventType.FullyRead) return;
        const newMarker = (ev.getContent()?.event_id as string | undefined) ?? null;
        if (newMarker === this.readMarkerEventId) return;
        // Track the server-side marker so dispose() can avoid redundant writes,
        // but don't touch frozenMarkerEventId — the visible divider position is
        // pinned for the session. If the user wants the marker line to reflect
        // changes another device made mid-session they can leave and re-enter.
        this.readMarkerEventId = newMarker;
    };

    /**
     * Snapshot the current read-marker position into {@link frozenMarkerEventId}.
     * Called once per session by {@link load} after the initial window is loaded.
     *
     * The frozen value is what the UI consumes for the entire session:
     *  - `null` when the marker is unset OR on the room's latest known event.
     *    In that case the divider line is never rendered this session even if
     *    new events arrive later (matches the iOS "nothing new since last
     *    visit → no line" behaviour).
     *  - Otherwise the marker's event id, pinned at that position for the
     *    session regardless of subsequent sends, scrolls, or new events.
     */
    private freezeReadMarkerForSession(): void {
        if (!this.readMarkerEventId) {
            this.frozenMarkerEventId = null;
            return;
        }
        const liveEvents = this.opts.room.getLiveTimeline().getEvents();
        const lastLiveEventId = liveEvents[liveEvents.length - 1]?.getId();
        if (lastLiveEventId && lastLiveEventId === this.readMarkerEventId) {
            // Fully read on entry — no line, ever, this session.
            this.frozenMarkerEventId = null;
        } else {
            this.frozenMarkerEventId = this.readMarkerEventId;
        }
        logger.debug(`[TimelineVM] freezeReadMarkerForSession — frozen=${this.frozenMarkerEventId}`);
    }

    private async load(target: LoadTarget): Promise<void> {
        logger.debug(`[TimelineVM] load() start — kind=${target.kind}${target.kind !== "live" ? ` eventId=${target.eventId}` : ""}`);
        this.mergeSnapshot(
            {
                backwardPagination: "loading",
                forwardPagination: "loading",
            },
            `load(${target.kind})-start`,
        );

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
            // Snapshot the read-marker for the duration of this session. Must run
            // BEFORE buildItems so it sees the frozen value.
            this.freezeReadMarkerForSession();
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
                    // Saved event was filtered/redacted and can't be displayed.
                    // Clear the stale position so next visit doesn't loop back here.
                    logger.debug(`[TimelineVM] load() — restore target ${target.eventId} not in items, clearing saved position and falling back to live end`);
                    RoomTimelineViewModel.saveScrollTarget(this.opts.room.roomId, null);
                    // No anchor needed — fall through to live-end logic below.
                }
            }

            if (!pendingAnchor && items.length > 0 && !this.timelineWindow.canPaginate(Direction.Forward)) {
                // Live-end load (or stale restore fallback): anchor to the last rendered
                // item so scrollIntoViewOnChange fires post-ResizeObserver and the view
                // reliably lands at the very bottom.
                pendingAnchor = { targetKey: items[items.length - 1].key, align: "end" };
                logger.debug(`[TimelineVM] load() — live-end anchor key=${pendingAnchor.targetKey}`);
            }

            this.mergeSnapshot(
                {
                    items,
                    backwardPagination: "idle",
                    forwardPagination: "idle",
                    atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                    pendingAnchor,
                    highlightedEventId: target.kind === "permalink" ? target.eventId : null,
                    canJumpToReadMarker: this.computeCanJumpToReadMarker(items),
                },
                `load(${target.kind})-done`,
            );

            // If all events in the initial window were filtered (items empty) but more
            // content exists ahead, Virtuoso won't fire onEndReached on an empty list.
            // Proactively forward-paginate to find visible events.
            if (items.length === 0 && this.timelineWindow.canPaginate(Direction.Forward)) {
                logger.debug(`[TimelineVM] load() — items empty with more content ahead, auto-triggering forward paginate`);
                this.triggerForwardPaginate();
            }
        } catch (e) {
            logger.error(`[TimelineVM] load() error`, e);
            this.mergeSnapshot(
                {
                    backwardPagination: "error",
                    forwardPagination: "error",
                },
                `load(${target.kind})-error`,
            );
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
        const anchor = this.snapshot.current.pendingAnchor;
        logger.debug(
            `[TimelineVM] onAnchorReached — anchor=${anchor ? `key=${anchor.targetKey} align=${anchor.align}` : "null"}, ` +
            `anchoredLoad=${this.anchoredLoad}`,
        );
        this.mergeSnapshot({ pendingAnchor: null }, "anchor-reached");
    };

    public onAtBottomStateChange = (atBottom: boolean): void => {
        this.isAtBottom = atBottom;
        if (atBottom && this.snapshot.current.atLiveEnd) {
            this.unreadMessageCount = 0;
        }
        this.mergeSnapshot(
            {
                isAtBottom: atBottom,
                numUnreadMessages: atBottom && this.snapshot.current.atLiveEnd ? 0 : this.unreadMessageCount,
            },
            "at-bottom",
        );
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
        const firstItemIndex = this.snapshot.current.firstItemIndex;
        const startArrayIndex = startIndex - firstItemIndex;

        // Update visible range so we can derive canJumpToReadMarker.
        const prevStartArrayIndex = this.visibleStartArrayIndex;
        const prevEndArrayIndex = this.visibleEndArrayIndex;
        this.visibleStartArrayIndex = Math.max(0, startArrayIndex);
        this.visibleEndArrayIndex = Math.max(0, endIndex - firstItemIndex);

        for (let i = endIndex; i >= startIndex; i--) {
            const index = i - firstItemIndex;
            const item = items[index];
            if (item?.kind === "event") {
                this.lastBottomEventId = item.key;
                break;
            }
        }

        // Recompute canJumpToReadMarker when the visible range moves.
        if (this.visibleStartArrayIndex !== prevStartArrayIndex || this.visibleEndArrayIndex !== prevEndArrayIndex) {
            const canJumpToReadMarker = this.computeCanJumpToReadMarker(items);
            if (canJumpToReadMarker !== this.snapshot.current.canJumpToReadMarker) {
                this.mergeSnapshot({ canJumpToReadMarker }, "range-changed");
            }
        }

        // Debounce sending a read receipt for the last visible event.
        if (this.readReceiptDebounceTimer !== null) clearTimeout(this.readReceiptDebounceTimer);
        this.readReceiptDebounceTimer = setTimeout(() => {
            this.readReceiptDebounceTimer = null;
            this.sendAutoReadReceipt();
        }, READ_RECEIPT_DEBOUNCE_MS);
    };

    /**
     * Sends a read receipt for the last visible event, debounced from `onVisibleRangeChanged`.
     * Only advances the receipt — never rewinds it. Respects the `sendReadReceipts` setting.
     *
     * Read receipts (`m.read`) and the FullyRead marker (`m.fully_read`) serve different
     * purposes. Read receipts are public — they tell *other* users where this user has
     * read up to — and should advance freely as the user scrolls. The FullyRead marker is
     * private and drives the local "unread divider" line; advancing it mid-session causes
     * the divider to jump (e.g. landing above the user's own outgoing message). So we
     * only advance the receipt here. The FullyRead marker is advanced once on dispose
     * (see {@link dispose}), mirroring Element X iOS's behaviour.
     */
    private sendAutoReadReceipt(): void {
        if (this.isDisposed) return;
        const eventId = this.lastBottomEventId;
        if (!eventId || eventId === this.lastSentReceiptEventId) return;

        const event = this.timelineWindow.getEvents().find((e) => e.getId() === eventId);
        if (!event) return;

        // Don't rewind — only advance if this event is newer than the last receipted one.
        if (this.lastSentReceiptEventId) {
            const lastSentEvent = this.timelineWindow.getEvents().find((e) => e.getId() === this.lastSentReceiptEventId);
            if (lastSentEvent && lastSentEvent.getTs() >= event.getTs()) return;
        }

        this.lastSentReceiptEventId = eventId;
        const receiptType = SettingsStore.getValue("sendReadReceipts", this.opts.room.roomId)
            ? ReceiptType.Read
            : ReceiptType.ReadPrivate;

        logger.debug(`[TimelineVM] sendAutoReadReceipt — sending receipt for ${eventId} (${receiptType})`);
        this.opts.client.sendReadReceipt(event, receiptType).catch((err) => {
            this.lastSentReceiptEventId = null; // allow retry
            logger.warn(`[TimelineVM] sendAutoReadReceipt — sendReadReceipt failed`, err);
        });
    }

    // ── Overlay button actions ───────────────────────────────────────

    public onJumpToReadMarker = (scrollNow: ImmediateScroll): void => {
        const items = this.snapshot.current.items;
        const rmIdx = items.findIndex((item) => item.kind === "read-marker");
        logger.debug(
            `[TimelineVM] onJumpToReadMarker — frozenMarkerEventId=${this.frozenMarkerEventId}, ` +
            `rmIdx=${rmIdx}, items=${items.length}, ` +
            `visibleStartArrayIndex=${this.visibleStartArrayIndex}, ` +
            `canPaginate(Backward)=${this.timelineWindow.canPaginate(Direction.Backward)}, ` +
            `canJumpToReadMarker=${this.snapshot.current.canJumpToReadMarker}`,
        );
        if (rmIdx !== -1) {
            // Marker is in the loaded window — scroll to it imperatively.
            const readMarkerKey = items[rmIdx].key;
            logger.debug(`[TimelineVM] onJumpToReadMarker — marker in window at index ${rmIdx}, scrolling now key=${readMarkerKey}`);
            scrollNow({ targetKey: readMarkerKey, align: "center" });
        } else if (this.frozenMarkerEventId && this.timelineWindow.canPaginate(Direction.Backward)) {
            // Frozen marker is not in the current window — reload at it.
            // pendingAnchor gets set inside load() and drives the post-load scroll.
            logger.debug(`[TimelineVM] onJumpToReadMarker — marker not in window, reloading at ${this.frozenMarkerEventId}`);
            this.load({ kind: "permalink", eventId: this.frozenMarkerEventId });
        } else {
            logger.warn(
                `[TimelineVM] onJumpToReadMarker — no action taken: marker not in window (rmIdx=${rmIdx}) ` +
                `and frozenMarkerEventId=${this.frozenMarkerEventId}, canPaginate(Backward)=${this.timelineWindow.canPaginate(Direction.Backward)}`,
            );
        }
    };

    public onMarkAllAsRead = (): void => {
        // Use the same logic as the room list "Mark as read" — receipts the last live event
        // in the room and clears the manually-marked-unread state. This ensures the grey dot
        // in the room list is cleared, regardless of the user's scroll position.
        clearRoomNotification(this.opts.room, this.opts.client).catch((err) => {
            logger.warn(`[TimelineVM] onMarkAllAsRead — clearRoomNotification failed`, err);
        });
        // Immediately clear the read marker line locally. This is an explicit
        // user action ("I have read everything"), so we override the per-session
        // freeze and drop the divider line.
        this.readMarkerEventId = null;
        this.frozenMarkerEventId = null;
        const newItems = this.buildItems(); // removes the read-marker item
        this.mergeSnapshot(
            { items: newItems, canJumpToReadMarker: false },
            "mark-all-as-read",
        );
    };

    public onJumpToLive = (scrollNow: ImmediateScroll): void => {
        logger.debug(`[TimelineVM] onJumpToLive — atLiveEnd=${this.snapshot.current.atLiveEnd}`);
        this.unreadMessageCount = 0;
        if (!this.snapshot.current.atLiveEnd) {
            // Window doesn't reach the live end yet — reload the timeline at
            // live. pendingAnchor gets set inside load() and drives the
            // post-load scroll via scrollIntoViewOnChange.
            this.load({ kind: "live" });
        } else {
            // Already have the latest events — scroll to the last item now.
            const items = this.snapshot.current.items;
            if (items.length > 0) {
                const targetKey = items[items.length - 1].key;
                logger.debug(`[TimelineVM] onJumpToLive — scrolling now to targetKey=${targetKey}`);
                this.mergeSnapshot({ numUnreadMessages: 0, hasHighlights: false }, "jump-to-live");
                scrollNow({ targetKey, align: "end" });
            } else {
                this.mergeSnapshot({ numUnreadMessages: 0, hasHighlights: false }, "jump-to-live-empty");
            }
        }
    };

    /**
     * Derive whether the "Jump to unread" bar should be shown and in which direction.
     * - `"above"` — marker is above the visible start (or above the loaded window).
     * - `"below"` — marker is below the visible end (within the loaded window).
     * - `false`   — marker is visible, not set, or unreachable.
     *
     * The marker row may have been stripped from `items` by the trailing-strip
     * Driven by `frozenMarkerEventId` (the session-pinned snapshot), not the
     * live server-side `readMarkerEventId`. If the freeze was `null` (no marker
     * or fully read on entry) the button is never offered this session.
     */
    private computeCanJumpToReadMarker(items: TimelineItem[]): "above" | "below" | false {
        if (!this.frozenMarkerEventId) return false;

        const events = this.timelineWindow.getEvents();
        const markerInWindow = events.some((e) => e.getId() === this.frozenMarkerEventId);

        const rmIdx = items.findIndex((item) => item.kind === "read-marker");
        if (rmIdx === -1) {
            if (markerInWindow) {
                // Marker event is in the window but didn't make it into the rendered
                // items — likely a filtered event. Don't show a misleading button.
                return false;
            }
            // Marker is genuinely outside the loaded window. Direction depends on
            // which side has unloaded events. If forward pagination is possible,
            // the marker is newer than our window (e.g. the user has back-paginated
            // past the live edge and the marker fell off via window trimming):
            // "below". Otherwise the marker is older than our window: "above".
            if (this.timelineWindow.canPaginate(Direction.Forward)) return "below";
            if (this.timelineWindow.canPaginate(Direction.Backward)) return "above";
            return false;
        }
        if (rmIdx < this.visibleStartArrayIndex) return "above";
        if (rmIdx > this.visibleEndArrayIndex) return "below";
        return false;
    }

    /**
     * Tear-down: save scroll position and advance the FullyRead marker.
     *
     * - Saves the current scroll position to localStorage so the next visit
     *   resumes here. Clears the saved position only when the user is at the
     *   visual bottom (so the next visit starts fresh at the live end).
     * - Advances the FullyRead marker to the last bottommost event we've seen
     *   during this session, so the next time the user enters the room the
     *   "unread divider" reflects what they've actually read. We deliberately
     *   do this only on dispose, not during scrolling — see
     *   {@link sendAutoReadReceipt} for the rationale.
     */
    public override dispose(): void {
        if (this.readReceiptDebounceTimer !== null) {
            clearTimeout(this.readReceiptDebounceTimer);
            this.readReceiptDebounceTimer = null;
        }
        if (this.decryptDebounceTimer !== null) {
            clearTimeout(this.decryptDebounceTimer);
            this.decryptDebounceTimer = null;
        }
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

        // Advance the FullyRead marker to the last bottommost event we saw.
        // Skip if it already matches what we last advanced to (avoids redundant network calls).
        if (this.lastBottomEventId !== this.readMarkerEventId) {
            logger.debug(`[TimelineVM] dispose() — advancing FullyRead marker to ${this.lastBottomEventId}`);
            this.opts.client.setRoomReadMarkers(this.opts.room.roomId, this.lastBottomEventId).catch((err) => {
                logger.warn(`[TimelineVM] dispose() — setRoomReadMarkers failed`, err);
            });
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
                this.mergeSnapshot({ atLiveEnd: true }, "paginate(forward)-at-live-end");
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
     * Items are emitted immediately after each SDK batch — encrypted events
     * land as UTD-rendered slots and stay at their slot for life (see
     * {@link buildItems}). Decryption is invisible to this chain: it only
     * changes a tile's content, never the items array.
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

        this.mergeSnapshot({ [loadingKey]: "loading" }, `paginate(${dirLabel})-start`);

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

                const eventsBefore = new Set(this.timelineWindow.getEvents());
                const windowSizeBefore = eventsBefore.size;
                const hasMore = await this.timelineWindow.paginate(direction, PAGINATE_SIZE);
                if (this.isDisposed) return;
                const eventsAfter = this.timelineWindow.getEvents();
                const windowSizeAfter = eventsAfter.length;
                const rawDelta = windowSizeAfter - windowSizeBefore;

                // Wait briefly for newly-fetched encrypted events to decrypt
                // so buildItems sees them at their final clear type and the
                // inclusion filter picks the right INCLUDE/EXCLUDE up front.
                // Stragglers that miss the window are picked up by the next
                // paginate or live-event rebuild.
                const newEvents = eventsAfter.filter((e) => !eventsBefore.has(e));
                if (newEvents.length > 0) {
                    await this.waitForDecryption(newEvents, PAGINATE_DECRYPT_WAIT_MS);
                    if (this.isDisposed) return;
                }

                const rebuilt = this.buildItems();
                const filteredCount = this.lastBuildFilteredCount;
                let added: number;

                if (isBackward) {
                    // Re-read again — forward pagination may have appended during the await.
                    const postItems = this.snapshot.current.items;
                    const postFirstItemIndex = this.snapshot.current.firstItemIndex;
                    const items = this.mergePrepended(postItems, rebuilt);
                    const prepended = items.length - postItems.length;
                    added = prepended;
                    // Backward pagination can cause the window to trim from the forward
                    // (live) end once it exceeds the SDK's window limit. Recompute
                    // atLiveEnd after every backward batch so the snapshot reflects
                    // whether forward pagination is still possible.
                    const newAtLiveEnd = !this.timelineWindow.canPaginate(Direction.Forward);
                    logger.debug(
                        `[TimelineVM] paginate(backward) batch — ` +
                        `rawΔ=${rawDelta} (window: ${windowSizeBefore}→${windowSizeAfter}), ` +
                        `filtered=${filteredCount}, prepended=${prepended}, hasMore=${hasMore}, ` +
                        `emptyBatches=${emptyBatches}, ` +
                        `firstItemIndex: ${postFirstItemIndex}→${postFirstItemIndex - prepended}, ` +
                        `atLiveEnd=${newAtLiveEnd}`,
                    );
                    this.mergeSnapshot(
                        {
                            items,
                            firstItemIndex: postFirstItemIndex - prepended,
                            atLiveEnd: newAtLiveEnd,
                            canJumpToReadMarker: this.computeCanJumpToReadMarker(items),
                        },
                        "paginate(backward)-batch",
                    );
                } else {
                    added = rebuilt.length - currentItems.length;
                    logger.debug(
                        `[TimelineVM] paginate(forward) batch — ` +
                        `rawΔ=${rawDelta} (window: ${windowSizeBefore}→${windowSizeAfter}), ` +
                        `filtered=${filteredCount}, appended=${added}, hasMore=${hasMore}, ` +
                        `emptyBatches=${emptyBatches}`,
                    );
                    this.mergeSnapshot(
                        { items: rebuilt, canJumpToReadMarker: this.computeCanJumpToReadMarker(rebuilt) },
                        "paginate(forward)-batch",
                    );
                }

                if (added > 0 || !hasMore) break;

                // All fetched events were filtered — keep going.
                emptyBatches++;
            }

            // Always recompute atLiveEnd at chain completion. Backward chains can
            // cause forward trimming; forward chains can reach (or leave) live end.
            this.mergeSnapshot(
                {
                    [loadingKey]: "idle",
                    atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                },
                `paginate(${dirLabel})-end`,
            );
        } catch (e) {
            logger.error(`[TimelineVM] paginate(${dirLabel}) error`, e);
            this.mergeSnapshot({ [loadingKey]: "error" }, `paginate(${dirLabel})-error`);
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
        }        // Drop middle insertions: only take the new prefix (items before the first
        // key already present in prev) and stitch it onto the existing list.
        // This prevents newly-renderable events (e.g. late-decrypted) from causing
        // a mid-list insertion that shifts Virtuoso's scroll anchor.
        // Commented out to allow middle insertions for now.
        // const prefix = next.slice(0, firstSharedIdx);
        // // De-dup: if prefix ends with a date separator whose key matches the
        // // first item of prev (also a date separator), prev already owns it.
        // if (
        //     prefix.length > 0 &&
        //     prefix[prefix.length - 1].kind === "date-separator" &&
        //     prev[0].kind === "date-separator" &&
        //     prefix[prefix.length - 1].key === prev[0].key
        // ) {
        //     prefix.pop();
        // }
        // return [...prefix, ...prev];

        // Middle-insertion dropping disabled — use the full rebuilt list.
        return next;
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

            // Pending-decryption events are excluded so virtuoso never
            // measures a UTD placeholder it would later have to swap for a
            // real body (the resulting size cache churn was the original
            // "white void" symptom). When decryption completes the next
            // paginate / live-event rebuild will pick the event up at its
            // final height.
            if (!this.shouldIncludeEvent(event, showHiddenEvents)) {
                filteredCount++;
                continue;
            }

            // Insert date separator when the day changes. Only reached for
            // events that pass the inclusion filter, so separators are never
            // orphaned.
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

            // Insert the read-marker item directly after the event it belongs to.
            // Uses the per-session frozen marker so the divider position never
            // changes during the session (see {@link freezeReadMarkerForSession}).
            // Works correctly for wire-encrypted anchors too, because the slot
            // exists immediately.
            if (this.frozenMarkerEventId && eventId === this.frozenMarkerEventId) {
                items.push({ key: "read-marker", kind: "read-marker" });
            }

            prevEvent = event;
        }

        // Stash for the caller to log alongside batch/rebuild context.
        this.lastBuildFilteredCount = filteredCount;

        // Diagnostic: detect adjacent date separators (would indicate a day
        // with all events filtered) or any structural anomaly in the emitted
        // items array. Adjacent separators were a visible bug after the
        // sticky-inclusion refactor; this log lets us confirm whether they
        // reappear and which days are involved.
        const counts = { event: 0, separator: 0, readMarker: 0, loading: 0, gap: 0, other: 0 };
        const adjacentSeparators: Array<{ a: string; b: string; index: number }> = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "date-separator") counts.separator++;
            else if (item.kind === "event") counts.event++;
            else if (item.kind === "read-marker") counts.readMarker++;
            else if (item.kind === "loading") counts.loading++;
            else if (item.kind === "gap") counts.gap++;
            else counts.other++;

            if (i > 0 && item.kind === "date-separator" && items[i - 1].kind === "date-separator") {
                adjacentSeparators.push({ a: items[i - 1].key, b: item.key, index: i });
            }
        }
        if (adjacentSeparators.length > 0) {
            logger.warn(
                `[TimelineVM][buildItems] adjacent date separators detected (${adjacentSeparators.length}): ` +
                    adjacentSeparators.map((p) => `${p.a}→${p.b}@${p.index}`).join(", "),
            );
        }
        logger.debug(
            `[TimelineVM][buildItems] emitted ${items.length} items ` +
                `(events=${counts.event}, separators=${counts.separator}, ` +
                `readMarkers=${counts.readMarker}, loading=${counts.loading}, gap=${counts.gap}) ` +
                `from ${events.length} window events, filtered=${filteredCount}`,
        );

        return items;
    }

    /**
     * Decide whether an event gets a slot in the items array. Computed fresh
     * each {@link buildItems} run.
     *
     * Wire-encrypted events that are still decrypting are excluded — we don't
     * want virtuoso measuring a placeholder it will later have to resize. The
     * next paginate / live-event rebuild (which is what fires after the
     * paginate-time decrypt wait, or after stragglers eventually settle)
     * picks them up at their final height.
     *
     * Wire-encrypted events that have decrypted to a renderable type are
     * included; ones that decrypted to a type with no body
     * (reactions, edits, custom doc-delta types) are excluded — same effect
     * as the legacy timeline's `shouldShowEvent` filter.
     */
    private shouldIncludeEvent(event: MatrixEvent, showHiddenEvents: boolean): boolean {
        const eventId = event.getId();
        if (!eventId) return false;

        // Wire-encrypted + still pending decryption: exclude until the event
        // resolves. The next paginate / live-event rebuild picks them up.
        if (
            event.getWireType() === EventType.RoomMessageEncrypted &&
            !event.isDecryptionFailure() &&
            event.getClearContent() === null
        ) {
            return false;
        }

        return this.computeInclusion(event, showHiddenEvents);
    }

    private computeInclusion(event: MatrixEvent, showHiddenEvents: boolean): boolean {
        // shouldHideEvent catches edits (m.replace), poll-end events,
        // redacted-when-hidden, member events filtered by display prefs, etc.
        if (shouldHideEvent(event)) return false;

        if (!haveRendererForEvent(event, this.opts.client, showHiddenEvents)) return false;

        // Also require a concrete native factory. `haveRendererForEvent`
        // returns true if a module-registered custom-component hint exists
        // for the event (see `customComponents.getHintsForMessage`), even
        // when no native EVENT_TILE_TYPES factory matches. EventTile's
        // rendering decision uses `!!pickFactory(...)` directly though, so
        // an event in that "hinted but no factory" gap would slip into items
        // and then render as the "could not be displayed" fallback tile.
        // Custom event types like `org.element.doc.delta` fall into this
        // gap. Filtering them at the VM keeps the timeline clean.
        return !!pickFactory(event, this.opts.client, showHiddenEvents);
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
        ) {
            return false;
        }
        return true;
    }

    /**
     * Merge `partial` into the snapshot with a single structured log line
     * naming the trigger (`reason`) and listing the fields that actually
     * changed. No-op merges are skipped entirely.
     *
     * Every snapshot mutation in this class goes through this helper so the
     * console gives a chronological record of view-observable state
     * transitions, attributable to the trigger that caused them. To diagnose
     * a UI jump: filter the console on `[VM-merge]` and find the merge whose
     * field changes line up with the symptom.
     */
    private mergeSnapshot(partial: Partial<TimelineViewSnapshot>, reason: string): void {
        const before = this.snapshot.current;
        const changes: string[] = [];
        for (const [k, v] of Object.entries(partial)) {
            const oldV = (before as unknown as Record<string, unknown>)[k];
            if (Object.is(oldV, v)) continue;
            changes.push(formatSnapshotChange(k, oldV, v));
        }
        if (changes.length === 0) return;
        logger.debug(`[VM-merge] reason=${reason} changes=[${changes.join(", ")}]`);
        this.snapshot.merge(partial);
    }
}

/**
 * Format a single field change for the structured merge log. Arrays show
 * only their length delta; other values show JSON before/after.
 */
function formatSnapshotChange(key: string, oldV: unknown, newV: unknown): string {
    if (Array.isArray(oldV) && Array.isArray(newV)) {
        return `${key}.length: ${oldV.length}→${newV.length}`;
    }
    return `${key}: ${JSON.stringify(oldV)}→${JSON.stringify(newV)}`;
}
