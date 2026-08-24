/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
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
import { logger } from "matrix-js-sdk/src/logger";

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
import { clearRoomNotification } from "../../../utils/notifications";

const DEBUG_TIMELINE = false;

/** Emits a trace line only when {@link DEBUG_TIMELINE} is on. */
const debug = (message: string): void => {
    if (DEBUG_TIMELINE) logger.debug(message);
};

/** How long after the last scroll event to wait before sending a read receipt (ms). */
const READ_RECEIPT_DEBOUNCE_MS = 500;

const PAGINATE_SIZE = 100;
const INITIAL_SIZE = 100;

/**
 * How many messages we try to gather before showing the timeline for the first time. Enough to
 * more than fill any realistic window, so the list is long enough to scroll straight away.
 *
 * This matters more than it looks. The view keeps the reader's place by adjusting the scroll
 * position to cancel out whatever was added or removed — but a list shorter than the window
 * cannot be scrolled, so there is no scroll position to adjust and that trick does nothing.
 * Rows are then placed by layout alone, and anything loading in around them shoves them about.
 *
 * It bites hardest when we are holding a particular message in place — opening a permalink, or
 * returning to where someone left off. A permalink has to fill both above and below its target,
 * and letting those batches arrive progressively would shift the target around as each one lands,
 * which is precisely the message the reader came to see. Gathering them before we show anything
 * costs a slightly slower first paint, and we take that trade deliberately.
 *
 * Starting at the newest message suffers a milder version: today the rows are laid out from the
 * top, so older history arriving above pushes everything down.
 *
 * The intended fix for that second case (not built yet) is to lay the rows out from the bottom
 * instead whenever we are at the live end and there is still history above us. Older messages
 * then grow upwards into the empty space, and the newest message — the one being read — never
 * moves, however few messages are loaded. Note this only applies while more history exists:
 * once the start of the room is loaded there is nothing left to grow into, and laying out from
 * the top is the right thing to do, as the timeline does today.
 *
 * Once that lands, this constant only matters for the anchored loads.
 */
const MIN_INITIAL_EVENTS = 40;

/**
 * The most messages we keep loaded at once. Loading more than this makes the SDK drop an
 * equivalent number from the far end, so memory stays bounded however long someone scrolls.
 *
 * We set this explicitly rather than take the SDK's default so we know the exact number, which
 * lets {@link RoomTimelineViewModel.makeRoomBeforeExtending} see a drop coming and do it as a
 * separate step instead of letting it happen in the middle of adding new messages.
 */
const WINDOW_LIMIT = 1000;

/**
 * Maximum time {@link RoomTimelineViewModel.waitForDecryption} blocks the
 * paginate chain on newly-fetched events. Decryption usually completes in
 * tens of milliseconds; this cap stops a slow/failed decryption from holding
 * the loading spinner indefinitely. Anything slower than this is not lost: it appears shortly
 * after it does decrypt, via {@link RoomTimelineViewModel.onEventDecrypted} — the reader does
 * not have to scroll or wait for another message to prompt it.
 */
const PAGINATE_DECRYPT_WAIT_MS = 500;

/**
 * Discriminated union describing the initial scroll target for {@link RoomTimelineViewModel.load}.
 *
 * - `live`      — scroll to the live end of the room.
 * - `permalink` — centre on `eventId` and highlight it.
 * - `restore`   — scroll to the saved `eventId` without highlighting.
 */
type LoadTarget = { kind: "live" } | { kind: "permalink"; eventId: string } | { kind: "restore"; eventId: string };

export interface RoomTimelineViewModelOpts {
    client: MatrixClient;
    room: Room;
    /** Optional anchor for initial load (permalink, search result). Shown highlighted and centred. */
    initialEventId?: string;
}

/**
 * Works out what the room timeline should show, and keeps it up to date.
 *
 * The shared `TimelineView` draws a list and reports what the user can see; it knows nothing
 * about Matrix. This class is the other half: it owns all the Matrix detail and hands the view
 * a plain list of rows to render. Everything travels in one direction each way — we publish a
 * snapshot (the rows, plus flags like "are we at the newest message"), and the view calls back
 * to say what happened ("the top is showing", "the user is at the bottom").
 *
 * The messages themselves come from the SDK's `TimelineWindow`, a sliding window over the room's
 * history. It holds at most {@link WINDOW_LIMIT} messages: paginating past that drops an equal
 * number off the far end, so scrolling for a long time does not grow memory without limit.
 *
 * What this class has to get right:
 *
 *  - **Turning events into rows.** Not every event is shown (hidden or unrenderable types are
 *    skipped), and some rows are not events at all — date separators, the unread marker, and
 *    the loading spinners at either end. See `buildItems`.
 *  - **Loading more when asked.** The view reports reaching either end; we fetch more history
 *    in that direction, showing a spinner while it happens.
 *  - **Where to start.** Usually the newest message, but a permalink starts at a specific
 *    message, and returning to a room restores where the reader left off. See `LoadTarget`.
 *  - **Read state.** Tracking the unread marker, deciding whether to offer a jump to it, and
 *    sending read receipts as the reader catches up.
 *
 * A note on timing: the constructor deliberately does nothing but set fields. React's StrictMode
 * builds two instances in development and discards one, so anything that subscribes or fetches
 * belongs in {@link start}, which the view calls exactly once.
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
     * Whether a message is a "continuation" — drawn without repeating the sender's avatar and
     * name — depends on the message immediately before it. That is a problem when older history
     * loads in: the message that used to be first suddenly has something before it, and can flip
     * to being a continuation. Losing its avatar and name makes the row shorter, which drags
     * everything below it upwards and moves the text the reader was looking at.
     *
     * So we decide each message's continuation status the first time we see it and never revisit
     * it. The cost is an occasional repeated avatar where two loaded batches meet, which is far
     * less annoying than the text moving while you read it.
     */
    private continuationCache = new Map<string, boolean>();

    /** Set by {@link start} so a double-start (e.g. via StrictMode) is a no-op. */
    private started = false;

    /**
     * In-flight backward pagination chain, or null when idle.
     *
     * A single `Promise<void>` is created for the first `onStartReached` call.
     * Any further `onStartReached` calls while the chain is running simply
     * return early — they point at the same in-flight work rather than
     * starting a parallel one. When the chain settles this is set back to null,
     * and the next `onStartReached` creates a fresh chain.
     *
     * Using a stored promise as the guard ensures coalescing survives the async
     * gap between when the chain finishes and when the next `onStartReached` fires.
     */
    private backwardPaginateChain: Promise<void> | null = null;

    /** Mirror of {@link backwardPaginateChain} for the forward direction. */
    private forwardPaginateChain: Promise<void> | null = null;

    /**
     * The real timeline content: messages, date separators and the unread marker, with no
     * loading spinners. {@link republish} adds the spinners on the way out to the view, so
     * showing or hiding one never has to touch this list.
     */
    private baseItems: TimelineItem[] = [];

    /** Whether the leading (backward) pagination spinner is currently shown. */
    private backwardSpinnerVisible = false;

    /** Whether the trailing (forward) pagination spinner is currently shown. */
    private forwardSpinnerVisible = false;

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

    /** True when the view reports the list is scrolled to the bottom. */
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
     * Where the unread line sits, decided once when the room is opened and then left alone for
     * as long as the reader stays in it. Set by {@link freezeReadMarkerForSession}, and read by
     * {@link buildItems}, {@link computeCanJumpToReadMarker} and {@link onJumpToReadMarker}.
     *
     * `null` means no line at all this visit — either the room was already read on entry, or
     * there is no marker. Otherwise the line stays pinned to that message however much the
     * reader scrolls, sends, or receives.
     *
     * Holding it still is deliberate, and matches Element X: a line that crept downwards
     * as you read would take away the very thing you are using it for — seeing where you got to.
     * It moves when the room is left and re-entered (see the `setRoomReadMarkers` call in
     * {@link dispose}), or immediately if the reader marks everything read
     * ({@link onMarkAllAsRead}).
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
            atLiveEnd: false,
            pendingAnchor: null,
            highlightedEventId: opts.initialEventId ?? null,
            isAtBottom: false,
            canJumpToReadMarker: false,
            numUnreadMessages: 0,
            hasHighlights: false,
        });

        this.opts = opts;
        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet(), {
            windowLimit: WINDOW_LIMIT,
        });

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
        this.disposables.trackListener(
            this.opts.room,
            RoomEvent.Timeline,
            this.onRoomTimeline as (...args: unknown[]) => void,
        );
        // Track changes to the room's fully-read marker.
        this.disposables.trackListener(
            this.opts.room,
            RoomEvent.AccountData,
            this.onRoomAccountData as (...args: unknown[]) => void,
        );
        // Decryption arrivals (late key delivery / key backup) need a rebuild
        // so previously-pending events that we filtered out of items become
        // visible. RoomEvent.Timeline only fires once per event at arrival
        // time and is not re-emitted on decryption (see js-sdk
        // event-timeline-set.js addEventToTimeline → emit Timeline), so this
        // listener is the only signal we have for that transition.
        this.disposables.trackListener(
            this.opts.client,
            MatrixEventEvent.Decrypted,
            this.onEventDecrypted as (...args: unknown[]) => void,
        );
    }

    private onRoomTimeline = (
        event: MatrixEvent,
        _room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        // Only events from the room's main timeline. Threads and filtered timelines have their
        // own timeline sets and are not our concern.
        const ourTimelineSet = this.opts.room.getUnfilteredTimelineSet();
        if (data.timeline.getTimelineSet() !== ourTimelineSet) return;

        // Only genuinely new messages arriving at the end of the timeline. Older messages we
        // fetched ourselves come back through this same event, as do removals, and without this
        // check we would rebuild the whole list every time a reaction or redaction went past.
        if (toStartOfTimeline || removed || data.liveEvent !== true) return;
        if (this.isDisposed) return;

        debug(`[TimelineVM][onRoomTimeline] live event ${event.getId()} (${event.getType()})`);
        // Extend the window by one so the new message is inside it, then rebuild.
        this.timelineWindow.paginate(Direction.Forward, 1, false).then(() => {
            if (this.isDisposed) return;
            const items = this.buildItems();

            const atLiveEnd = !this.timelineWindow.canPaginate(Direction.Forward);
            // Accumulate unread count only for messages from other users.
            if (!this.isAtBottom && event.getSender() !== this.opts.client.getSafeUserId()) {
                this.unreadMessageCount++;
            }
            this.baseItems = items;
            this.republish("live-event", {
                atLiveEnd,
                numUnreadMessages: this.isAtBottom ? 0 : this.unreadMessageCount,
                hasHighlights: this.opts.room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0,
                canJumpToReadMarker: this.computeCanJumpToReadMarker(items),
            });
        });
    };

    /**
     * A message in our window has decrypted. Rebuild the list so anything we were holding back
     * while it decrypted ({@link shouldIncludeEvent}) now gets a row.
     *
     * This is what guarantees a slow decryption still shows up. Everywhere else that skips an
     * undecrypted message relies on this: the reader never has to scroll, or wait for someone to
     * send something, to see it.
     *
     * Debounced so that a burst of decryptions — which is what a paginate usually triggers —
     * causes one rebuild rather than one per message. Rebuilding per message remounted the rows
     * repeatedly and restarted any media they were downloading.
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
     * Rebuild items in response to a settled burst of decryptions, routing the swap
     * through {@link commitItems} (which updates {@link baseItems} and counts newly-shown
     * events; the virtualizer holds scroll position by key, so no index bookkeeping).
     *
     * **Gated against in-flight paginate chains.** If a chain is running, we
     * defer: the chain's terminal {@link buildItems} will pick up everything
     * these decrypts revealed, and a concurrent rebuild here would race the
     * chain's own {@link commitItems} call. We re-arm the debounce timer so we
     * try again after the chain finishes — that way a decrypt that fires deep
     * inside a chain doesn't get lost if no further decrypts arrive.
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

        const itemsNew = this.buildItems();
        const prevLength = this.baseItems.length;

        const newCanJumpToReadMarker = this.computeCanJumpToReadMarker(itemsNew);
        const newHasHighlights = this.opts.room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0;

        // Swap in the rebuilt list. Where decryption has revealed a message we were holding back,
        // it slots into place and the view keeps the reader's position by message id.
        const newlyShown = this.commitItems(itemsNew);
        const changed = newlyShown > 0 || itemsNew.length !== prevLength;

        if (!changed) {
            // No rows gained or lost — everything that decrypted turned out to be something we
            // do not show anyway, like a reaction or an edit. Just refresh the derived flags;
            // mergeSnapshot skips the update entirely if none of them actually moved.
            this.mergeSnapshot(
                { canJumpToReadMarker: newCanJumpToReadMarker, hasHighlights: newHasHighlights },
                "decrypt-flush(no-op)",
            );
            return;
        }

        // Items grew (typical: historical encrypted events newly decrypted).
        this.republish(`decrypt-flush(+${newlyShown})`, {
            canJumpToReadMarker: newCanJumpToReadMarker,
            hasHighlights: newHasHighlights,
        });
    }

    /**
     * Wait up to `timeoutMs` for the given encrypted-pending events to decrypt.
     *
     * Resolves as soon as all the given events have either decrypted (success or failure) or the
     * timeout fires, whichever comes first. Waiting here is only an optimisation: anything still
     * undecrypted when we give up is added by {@link onEventDecrypted} once it lands.
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
        debug(`[TimelineVM] freezeReadMarkerForSession — frozen=${this.frozenMarkerEventId}`);
    }

    private async load(target: LoadTarget): Promise<void> {
        debug(
            `[TimelineVM] load() start — kind=${target.kind}${target.kind !== "live" ? ` eventId=${target.eventId}` : ""}`,
        );
        const sdkLoadTarget = target.kind !== "live" ? target.eventId : undefined;

        try {
            await this.timelineWindow.load(sdkLoadTarget, INITIAL_SIZE);
            if (this.isDisposed) return;
            // Gather enough messages to fill the window before we show anything. Only a permalink
            // needs messages on both sides of its target; see fillInitialWindow.
            await this.fillInitialWindow(target.kind === "permalink" ? sdkLoadTarget : undefined);
            if (this.isDisposed) return;
            const windowEvents = this.timelineWindow.getEvents();
            debug(
                `[TimelineVM] load() window — ${windowEvents.length} events in window, ` +
                    `canPaginate(Backward)=${this.timelineWindow.canPaginate(Direction.Backward)}, ` +
                    `canPaginate(Forward)=${this.timelineWindow.canPaginate(Direction.Forward)}`,
            );
            if (windowEvents.length > 0) {
                debug(
                    `[TimelineVM] load() window first=${windowEvents[0].getId()} (${windowEvents[0].getType()}), ` +
                        `last=${windowEvents[windowEvents.length - 1].getId()} (${windowEvents[windowEvents.length - 1].getType()})`,
                );
            }
            // Snapshot the read-marker for the duration of this session. Must run
            // BEFORE buildItems so it sees the frozen value.
            this.freezeReadMarkerForSession();
            const items = this.buildItems();
            debug(`[TimelineVM] load() done — ${windowEvents.length} events → ${items.length} items after filtering`);

            let pendingAnchor: NavigationAnchor | null = null;

            // Only anchor to a target that is actually in `items` — otherwise the
            // anchor could never settle in view. A permalink/restore target that was
            // filtered (state event, redaction, unrenderable type) falls through to
            // the live-end anchor below.
            if (target.kind === "permalink") {
                if (items.some((i) => i.key === target.eventId)) {
                    pendingAnchor = { targetKey: target.eventId, align: "center" };
                } else {
                    debug(
                        `[TimelineVM] load() — permalink target ${target.eventId} not in items, falling back to live end`,
                    );
                }
            } else if (target.kind === "restore") {
                if (items.some((i) => i.key === target.eventId)) {
                    pendingAnchor = { targetKey: target.eventId, align: "end" };
                } else {
                    // Saved event was filtered/redacted and can't be displayed.
                    // Clear the stale position so next visit doesn't loop back here.
                    debug(
                        `[TimelineVM] load() — restore target ${target.eventId} not in items, clearing saved position and falling back to live end`,
                    );
                    RoomTimelineViewModel.saveScrollTarget(this.opts.room.roomId, null);
                    // No anchor needed — fall through to live-end logic below.
                }
            }

            if (!pendingAnchor && items.length > 0 && !this.timelineWindow.canPaginate(Direction.Forward)) {
                // Live-end: anchor to the last item so the view lands at the bottom.
                pendingAnchor = { targetKey: items[items.length - 1].key, align: "end" };
                debug(`[TimelineVM] load() — live-end anchor key=${pendingAnchor.targetKey}`);
            }

            this.baseItems = items;
            this.backwardSpinnerVisible = false;
            this.forwardSpinnerVisible = false;
            this.republish(`load(${target.kind})-done`, {
                atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                pendingAnchor,
                highlightedEventId: target.kind === "permalink" ? target.eventId : null,
                canJumpToReadMarker: this.computeCanJumpToReadMarker(items),
            });

            // If all events in the initial window were filtered (items empty) but more
            // content exists ahead, the view won't fire onEndReached on an empty list.
            // Proactively forward-paginate to find visible events.
            if (items.length === 0 && this.timelineWindow.canPaginate(Direction.Forward)) {
                debug(`[TimelineVM] load() — items empty with more content ahead, auto-triggering forward paginate`);
                this.triggerForwardPaginate();
            }
        } catch (e) {
            logger.error(`[TimelineVM] load() error`, e);
            this.backwardSpinnerVisible = false;
            this.forwardSpinnerVisible = false;
            this.republish(`load(${target.kind})-error`);
        }
    }

    /**
     * Fetches extra messages so the first thing the reader sees is longer than the window and
     * can be scrolled — see {@link MIN_INITIAL_EVENTS} for why that matters. All of this happens
     * before anything is shown.
     *
     * Which way we fetch depends on where we are starting:
     *  - **Opening a permalink** (`centreOn` set): the message has to sit in the middle, so it
     *    needs messages on both sides — we aim for about half the target each way. Without the
     *    newer half it would be the last message in the list, and "centre" would put it at the
     *    bottom of the screen instead.
     *  - **Anywhere else**: we start at the newest message, so only older ones are needed.
     *
     * Usually this costs nothing: opening a permalink already fetches the messages around it,
     * and we only go to the server when there is genuinely nothing loaded on that side. Each
     * direction gets a couple of attempts at most, so a room that keeps returning events we
     * do not display cannot hold up the first paint — we show what we have, and the reader's
     * first scroll fetches more in the normal way.
     */
    private async fillInitialWindow(centreOn: string | undefined): Promise<void> {
        const MAX_FILL_REQUESTS_PER_DIRECTION = 2;
        const perDirectionTarget = centreOn ? Math.ceil(MIN_INITIAL_EVENTS / 2) : MIN_INITIAL_EVENTS;

        for (const direction of [Direction.Backward, Direction.Forward]) {
            // Unanchored loads only need history above the bottom-anchored view.
            if (!centreOn && direction === Direction.Forward) break;

            let requests = 0;
            while (
                requests < MAX_FILL_REQUESTS_PER_DIRECTION &&
                this.renderableEventCount(centreOn, direction) < perDirectionTarget &&
                this.timelineWindow.canPaginate(direction)
            ) {
                requests++;
                const before = this.timelineWindow.getEvents().length;
                await this.timelineWindow.paginate(direction, PAGINATE_SIZE);
                if (this.isDisposed) return;
                debug(
                    `[TimelineVM] fillInitialWindow — paginate(${direction === Direction.Backward ? "backward" : "forward"}) ` +
                        `window: ${before}→${this.timelineWindow.getEvents().length}, ` +
                        `renderable(side)=${this.renderableEventCount(centreOn, direction)}`,
                );
            }
        }
    }

    /**
     * Count renderable events in the window. With `centreOn` set, counts only
     * those strictly on `direction`'s side of that event (so each side of a
     * centred target can be filled independently); without it, counts the whole
     * window. Side-effect-free — does not touch the continuation cache.
     */
    private renderableEventCount(centreOn: string | undefined, direction: Direction): number {
        const events = this.timelineWindow.getEvents();
        const showHiddenEvents = SettingsStore.getValue("showHiddenEventsInTimeline");

        let from = 0;
        let to = events.length;
        if (centreOn) {
            const idx = events.findIndex((e) => e.getId() === centreOn);
            if (idx !== -1) {
                if (direction === Direction.Backward) to = idx;
                else from = idx + 1;
            }
        }

        let count = 0;
        for (let i = from; i < to; i++) {
            if (this.shouldIncludeEvent(events[i], showHiddenEvents)) count++;
        }
        return count;
    }

    // ── TimelineViewActions ──────────────────────────────────────────

    public onStartReached = (): void => {
        debug(`[TimelineVM] onStartReached — items=${this.snapshot.current.items.length}`);
        this.triggerBackwardPaginate();
    };

    public onEndReached = (): void => {
        debug("[TimelineVM] onEndReached");
        this.triggerForwardPaginate();
    };

    /**
     * The View reports the anchor placement has settled. We clear `pendingAnchor`,
     * re-enabling `followOutput` and resuming scroll-position / read-receipt tracking.
     * Held until now so the cold-loading list stays pinned to the anchor instead of
     * being snapped to the bottom by the virtualizer's grow-to-bottom trap (see the View's onSettled).
     */
    public onAnchorReached = (): void => {
        if (this.snapshot.current.pendingAnchor === null) return;
        debug(`[TimelineVM] onAnchorReached — placement settled, clearing pendingAnchor`);
        this.mergeSnapshot({ pendingAnchor: null }, "anchor-settled");
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
     * Called by the View on every visible-range change.
     * Walks backwards from `endIndex` to find the bottommost rendered event,
     * then stores its ID for scroll-position persistence on dispose.
     */
    public onVisibleRangeChanged = (startIndex: number, endIndex: number): void => {
        // Don't record position while an anchor is pending — the range reflects
        // auto-placement, not the user's reading position. The View clears the
        // anchor (via onAnchorReached) once placement settles, after which normal
        // tracking resumes.
        if (this.snapshot.current.pendingAnchor !== null) return;

        const items = this.snapshot.current.items;

        // startIndex/endIndex are 0-based into `items` (the View reports array indices).
        const prevStartArrayIndex = this.visibleStartArrayIndex;
        const prevEndArrayIndex = this.visibleEndArrayIndex;
        this.visibleStartArrayIndex = Math.max(0, startIndex);
        this.visibleEndArrayIndex = Math.max(0, endIndex);

        for (let i = endIndex; i >= startIndex; i--) {
            const item = items[i];
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
            const lastSentEvent = this.timelineWindow
                .getEvents()
                .find((e) => e.getId() === this.lastSentReceiptEventId);
            if (lastSentEvent && lastSentEvent.getTs() >= event.getTs()) return;
        }

        this.lastSentReceiptEventId = eventId;
        const receiptType = SettingsStore.getValue("sendReadReceipts", this.opts.room.roomId)
            ? ReceiptType.Read
            : ReceiptType.ReadPrivate;

        debug(`[TimelineVM] sendAutoReadReceipt — sending receipt for ${eventId} (${receiptType})`);
        this.opts.client.sendReadReceipt(event, receiptType).catch((err) => {
            this.lastSentReceiptEventId = null; // allow retry
            logger.warn(`[TimelineVM] sendAutoReadReceipt — sendReadReceipt failed`, err);
        });
    }

    // ── Overlay button actions ───────────────────────────────────────

    public onJumpToReadMarker = (scrollNow: ImmediateScroll): void => {
        const items = this.snapshot.current.items;
        const rmIdx = items.findIndex((item) => item.kind === "read-marker");
        debug(
            `[TimelineVM] onJumpToReadMarker — frozenMarkerEventId=${this.frozenMarkerEventId}, ` +
                `rmIdx=${rmIdx}, items=${items.length}, ` +
                `visibleStartArrayIndex=${this.visibleStartArrayIndex}, ` +
                `canPaginate(Backward)=${this.timelineWindow.canPaginate(Direction.Backward)}, ` +
                `canJumpToReadMarker=${this.snapshot.current.canJumpToReadMarker}`,
        );
        if (rmIdx !== -1) {
            // Marker is in the loaded window — scroll to it imperatively.
            const readMarkerKey = items[rmIdx].key;
            debug(
                `[TimelineVM] onJumpToReadMarker — marker in window at index ${rmIdx}, scrolling now key=${readMarkerKey}`,
            );
            scrollNow({ targetKey: readMarkerKey, align: "center" });
        } else if (this.frozenMarkerEventId && this.timelineWindow.canPaginate(Direction.Backward)) {
            // Frozen marker is not in the current window — reload at it.
            // pendingAnchor gets set inside load() and drives the post-load scroll.
            debug(`[TimelineVM] onJumpToReadMarker — marker not in window, reloading at ${this.frozenMarkerEventId}`);
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
        this.mergeSnapshot({ items: newItems, canJumpToReadMarker: false }, "mark-all-as-read");
    };

    public onJumpToLive = (scrollNow: ImmediateScroll): void => {
        debug(`[TimelineVM] onJumpToLive — atLiveEnd=${this.snapshot.current.atLiveEnd}`);
        this.unreadMessageCount = 0;
        if (!this.snapshot.current.atLiveEnd) {
            // The newest messages are not loaded, so fetch them first. load() sets
            // pendingAnchor, which is what makes the view scroll there once they arrive.
            this.load({ kind: "live" });
        } else {
            // Already have the latest events — scroll to the last item now.
            const items = this.snapshot.current.items;
            if (items.length > 0) {
                const targetKey = items[items.length - 1].key;
                debug(`[TimelineVM] onJumpToLive — scrolling now to targetKey=${targetKey}`);
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
            debug(`[TimelineVM] dispose() — no visible range recorded, preserving saved position`);
            super.dispose();
            return;
        }

        if (this.isAtBottom) {
            debug(`[TimelineVM] dispose() — clearing saved scroll position (at visual bottom)`);
            RoomTimelineViewModel.saveScrollTarget(this.opts.room.roomId, null);
        } else {
            debug(`[TimelineVM] dispose() — saving scroll position eventId=${this.lastBottomEventId}`);
            RoomTimelineViewModel.saveScrollTarget(this.opts.room.roomId, this.lastBottomEventId);
        }

        // Advance the FullyRead marker to the last bottommost event we saw.
        // Skip if it already matches what we last advanced to (avoids redundant network calls).
        if (this.lastBottomEventId !== this.readMarkerEventId) {
            debug(`[TimelineVM] dispose() — advancing FullyRead marker to ${this.lastBottomEventId}`);
            this.opts.client.setRoomReadMarkers(this.opts.room.roomId, this.lastBottomEventId).catch((err) => {
                logger.warn(`[TimelineVM] dispose() — setRoomReadMarkers failed`, err);
            });
        }

        super.dispose();
    }

    // ── Pagination ───────────────────────────────────────────────────

    /**
     * Entry point for backward pagination. Coalesces concurrent calls behind a
     * single in-flight chain; the view will re-fire `onStartReached` naturally
     * if more items are needed after the chain settles.
     */
    private triggerBackwardPaginate(): void {
        if (this.backwardPaginateChain) {
            debug(`[TimelineVM] paginate(backward) coalesced — chain in flight`);
            return;
        }

        // Hold off while the first load is still scrolling into place. Rows that have not been
        // measured yet have no height, so the view can briefly think both ends are on screen and
        // ask for more history it does not need — which also disturbs the placement. Once the
        // anchor settles the view clears pendingAnchor, and the reader's own scrolling asks again.
        if (this.snapshot.current.pendingAnchor !== null) {
            debug(`[TimelineVM] paginate(backward) skipped — anchor placement pending`);
            return;
        }

        if (!this.timelineWindow.canPaginate(Direction.Backward)) {
            debug(`[TimelineVM] paginate(backward) skipped — canPaginate=false`);
            return;
        }

        this.backwardPaginateChain = this.runPaginateChain(Direction.Backward).finally(() => {
            this.backwardPaginateChain = null;
        });
    }

    /**
     * Entry point for forward pagination. Coalesces concurrent `onEndReached`
     * calls behind a single in-flight chain.
     */
    private triggerForwardPaginate(): void {
        if (this.forwardPaginateChain) {
            debug(`[TimelineVM] paginate(forward) coalesced — chain in flight`);
            return;
        }

        // Don't paginate while still placing the initial anchor — see
        // triggerBackwardPaginate for why.
        if (this.snapshot.current.pendingAnchor !== null) {
            debug(`[TimelineVM] paginate(forward) skipped — anchor placement pending`);
            return;
        }

        debug(
            `[TimelineVM] paginate(forward) check — canPaginate=${this.timelineWindow.canPaginate(Direction.Forward)}, ` +
                `atLiveEnd=${this.snapshot.current.atLiveEnd}, items=${this.snapshot.current.items.length}`,
        );

        if (!this.timelineWindow.canPaginate(Direction.Forward)) {
            debug(`[TimelineVM] paginate(forward) skipped — canPaginate=false`);
            if (!this.snapshot.current.atLiveEnd) {
                debug(`[TimelineVM] paginate(forward) — setting atLiveEnd=true`);
                this.mergeSnapshot({ atLiveEnd: true }, "paginate(forward)-at-live-end");
            }
            return;
        }

        this.forwardPaginateChain = this.runPaginateChain(Direction.Forward).finally(() => {
            this.forwardPaginateChain = null;
        });
    }

    /**
     * Keys for the two loading spinners. {@link republish} adds these to the list on the way
     * out to the view and they are never kept in {@link baseItems}, so each can appear at most
     * once per end.
     *
     * They are ordinary list rows rather than something fixed above or below the list. That way
     * the view measures their height like any other row and can absorb one appearing or
     * disappearing without the messages jumping.
     */
    private static readonly BACKWARD_LOADING_KEY = "backward-loading";
    private static readonly FORWARD_LOADING_KEY = "forward-loading";

    /**
     * Publish {@link baseItems} to the View, layering spinners on top:
     * `[ (backward?), ...baseItems, (forward?) ]`.
     */
    private republish(reason: string, extra: Partial<TimelineViewSnapshot> = {}): void {
        const items: TimelineItem[] = [];
        if (this.backwardSpinnerVisible) {
            items.push({ kind: "loading", key: RoomTimelineViewModel.BACKWARD_LOADING_KEY });
        }
        items.push(...this.baseItems);
        if (this.forwardSpinnerVisible) {
            items.push({ kind: "loading", key: RoomTimelineViewModel.FORWARD_LOADING_KEY });
        }
        this.mergeSnapshot({ items, ...extra }, reason);
    }

    /**
     * Swap {@link baseItems} for a freshly-built array and report how many events newly
     * entered. Scroll position is preserved by the virtualizer's own key-based anchoring,
     * so no index bookkeeping is needed here.
     *
     * @returns the number of events that newly entered the list — the only reliable
     *   progress signal for the paginate loop once trimming has made net array length
     *   meaningless.
     */
    private commitItems(rebuilt: TimelineItem[]): number {
        const oldEventKeys = new Set<string>();
        for (const item of this.baseItems) {
            if (item.kind === "event") oldEventKeys.add(item.key);
        }

        let newlyShown = 0;
        for (const item of rebuilt) {
            if (item.kind === "event" && !oldEventKeys.has(item.key)) newlyShown++;
        }

        this.baseItems = rebuilt;
        return newlyShown;
    }

    /**
     * Stage the window's far-end trim as its own update *before* extending the
     * near end, so the virtualizer never sees an add-at-one-end + trim-at-the-other in a
     * single change.
     *
     * The virtualizer only holds scroll position when an update is "pure": items added
     * or removed at the top (it compensates scrollTop) or added at the bottom (no
     * compensation needed). An update that extends one end and trims the other is neither,
     * and rather than guess how far to adjust the virtualizer stops compensating altogether —
     * so the viewport shifts by the height of whatever was trimmed. At the window cap the
     * SDK's `paginate()` does exactly that combination, which is the on-append scroll jump.
     *
     * So when a paginate is about to overflow {@link WINDOW_LIMIT}, we first
     * `unpaginate()` the far end ourselves and publish that as a standalone,
     * compensated trim, then yield a frame. The subsequent `paginate()` now has
     * room and lands as a pure extend. Both directions are covered by the shared
     * chain: forward extends the end so we trim the start; backward is the mirror.
     *
     * Below the cap `toTrim <= 0` and this is a no-op — the normal pure-append /
     * pure-prepend path is untouched.
     */
    private async makeRoomBeforeExtending(direction: Direction, dirLabel: string): Promise<void> {
        const windowSize = this.timelineWindow.getEvents().length;
        const toTrim = windowSize + PAGINATE_SIZE - WINDOW_LIMIT;
        if (toTrim <= 0) return;

        // Forward extends the end, so the SDK would trim the start (startOfTimeline=true);
        // backward extends the start, so it would trim the end. Mirror that here.
        const trimStartOfTimeline = direction === Direction.Forward;
        try {
            this.timelineWindow.unpaginate(toTrim, trimStartOfTimeline);
        } catch (e) {
            // Defensive: if the window can't give back this many events we simply
            // skip the pre-trim and let paginate() do its combined extend+trim.
            logger.warn(`[TimelineVM] makeRoomBeforeExtending — unpaginate(${toTrim}) failed, falling back`, e);
            return;
        }

        const newlyShown = this.commitItems(this.buildItems());
        debug(
            `[TimelineVM] paginate(${dirLabel}) pre-trim — unpaginated=${toTrim} ` +
                `(window→${this.timelineWindow.getEvents().length}), newlyShown=${newlyShown}`,
        );
        this.republish(`paginate(${dirLabel})-trim`, {
            atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
            canJumpToReadMarker: this.computeCanJumpToReadMarker(this.baseItems),
        });

        // Yield a frame so React commits the trim and the virtualizer applies its scroll
        // compensation before we publish the extend in the next update.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    /**
     * Fetches more history in one direction. Used for both ends; `direction` says which.
     *
     * It loops rather than fetching once, because a batch from the server can turn out to
     * contain nothing we display — a run of membership changes or other hidden events. Rather
     * than finish having added no rows, we keep asking until something showable arrives, we run
     * out of history, or we hit `MAX_EMPTY_RETRIES`. The spinner stays up for the whole loop, so
     * however many batches that takes it reads as one wait rather than a flicker per batch.
     *
     * Rows are published after each batch. Encrypted messages appear straight away, before they
     * are decrypted; decryption later changes what a row contains but never adds or removes
     * rows, so it cannot disturb the list from here.
     *
     * Both directions hand the rebuilt list over via {@link commitItems}, and the view keeps the
     * reader's place by message id, so nothing here needs to care which end the SDK dropped
     * messages from. The one real difference is `atLiveEnd`: once the window is full, paginating
     * backwards trims the newest messages, which flips that flag from true to false as a side
     * effect. It gates the view's stick-to-bottom, so leaving a stale `true` in place would drag
     * the reader to the bottom if a message arrived mid-chain — hence we republish it after every
     * backward batch. Forward pagination only ever trims the oldest, so it cannot touch the flag
     * and one check once the loop finishes is enough.
     */
    private async runPaginateChain(direction: Direction): Promise<void> {
        // A backstop: the loop already stops when canPaginate() or hasMore say
        // there is no more history. This caps how long it can keep fetching nothing displayable
        // off the back of a single scroll — after this many empty batches we stop and wait for the
        // reader to scroll again rather than walk the whole room unprompted.
        const MAX_EMPTY_RETRIES = 10;
        const isBackward = direction === Direction.Backward;
        const dirLabel = isBackward ? "backward" : "forward";

        if (isBackward) {
            this.backwardSpinnerVisible = true;
            this.republish("paginate(backward)-start");
        } else {
            this.forwardSpinnerVisible = true;
            this.republish("paginate(forward)-start");
        }

        try {
            let emptyBatches = 0;

            while (emptyBatches <= MAX_EMPTY_RETRIES) {
                if (!this.timelineWindow.canPaginate(direction)) {
                    debug(`[TimelineVM] paginate(${dirLabel}) chain end — canPaginate=false`);
                    break;
                }

                // If this paginate would overflow the window cap, stage the
                // far-end trim as its own compensated update first so the extend
                // below lands as a pure add (no on-append scroll jump). No-op
                // below the cap.
                await this.makeRoomBeforeExtending(direction, dirLabel);
                if (this.isDisposed) return;

                const eventsBefore = new Set(this.timelineWindow.getEvents());
                const hasMore = await this.timelineWindow.paginate(direction, PAGINATE_SIZE);
                if (this.isDisposed) return;
                const eventsAfter = this.timelineWindow.getEvents();

                // Give newly-fetched encrypted messages a moment to decrypt, so buildItems can
                // see what they really are and decide once whether to show them. Any that take
                // longer are added by onEventDecrypted when they finish.
                const newEvents = eventsAfter.filter((e) => !eventsBefore.has(e));
                if (newEvents.length > 0) {
                    await this.waitForDecryption(newEvents, PAGINATE_DECRYPT_WAIT_MS);
                    if (this.isDisposed) return;
                }

                const rebuilt = this.buildItems();

                // `newlyShown` counts the events that newly entered the list. Once the window is
                // trimming at its limit the array length alone says nothing, so this is the only
                // reliable signal that the batch made progress.
                const newlyShown = this.commitItems(rebuilt);
                debug(`[TimelineVM] paginate(${dirLabel}) batch — newlyShown=${newlyShown}, hasMore=${hasMore}`);

                if (isBackward) {
                    this.republish("paginate(backward)-batch", {
                        // Backward pagination can trim the newest messages away once the window is
                        // full, so re-check whether we are still at the live end.
                        atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                        canJumpToReadMarker: this.computeCanJumpToReadMarker(rebuilt),
                    });
                } else {
                    this.republish("paginate(forward)-batch", {
                        canJumpToReadMarker: this.computeCanJumpToReadMarker(rebuilt),
                    });
                }

                if (newlyShown > 0 || !hasMore) break;
                emptyBatches++;
            }

            if (isBackward) {
                this.backwardSpinnerVisible = false;
                this.republish("paginate(backward)-end", {
                    atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                });
            } else {
                this.forwardSpinnerVisible = false;
                this.republish("paginate(forward)-end", {
                    atLiveEnd: !this.timelineWindow.canPaginate(Direction.Forward),
                });
            }
        } catch (e) {
            logger.error(`[TimelineVM] paginate(${dirLabel}) error`, e);
            if (isBackward) {
                this.backwardSpinnerVisible = false;
                this.republish("paginate(backward)-error");
            } else {
                this.forwardSpinnerVisible = false;
                this.republish("paginate(forward)-error");
            }
        }
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
        // Tracks which date keys have already had a separator emitted. Rooms
        // with out-of-order server-clock events can produce a timeline where the
        // same calendar date appears in multiple non-contiguous runs. Without
        // this guard, `buildItems` would emit a second separator with the same
        // key, causing a React key collision and the virtualizer rendering the same
        // separator slot multiple times in the DOM.
        const emittedDateKeys = new Set<string>();

        const showHiddenEvents = SettingsStore.getValue("showHiddenEventsInTimeline");
        // Suppress the leading date separator when more history is available
        // behind the current window — the backward pagination spinner
        // visually fills that role, matching the legacy `MessagePanel`
        // behaviour (see `wantsSeparator` in MessagePanel.tsx). Once we've
        // hit the start of the timeline we let the leading separator render
        // so the user sees an explicit "this is the start" marker.
        const suppressLeadingSeparator = this.timelineWindow.canPaginate(Direction.Backward);

        for (const event of events) {
            const eventId = event.getId();
            if (!eventId) continue;

            // Messages still being decrypted are left out, so the view never measures a small
            // placeholder it has to swap for a full message a moment later — the repeated
            // re-measuring was the original cause of the timeline going blank. They are added at
            // their real size once decryption finishes (see onEventDecrypted).
            if (!this.shouldIncludeEvent(event, showHiddenEvents)) {
                filteredCount++;
                continue;
            }

            // Insert date separator when the day changes (or for the very
            // first event when we're at the start of the timeline). Only
            // reached for events that pass the inclusion filter, so
            // separators are never orphaned.
            const eventDate = new Date(event.getTs());
            const dateKey = eventDate.toDateString();
            const isLeadingEvent = lastDate === null;
            if (
                dateKey !== lastDate &&
                !emittedDateKeys.has(dateKey) &&
                !(isLeadingEvent && suppressLeadingSeparator)
            ) {
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
                emittedDateKeys.add(dateKey);
                prevEvent = null; // date separator breaks continuation
            }
            // Track the most recently seen day even when we suppressed the
            // separator so we still emit one when the day changes mid-list.
            lastDate = dateKey;

            items.push({
                key: eventId,
                kind: "event",
                continuation: this.getCachedContinuation(eventId, prevEvent, event),
                lastInSection: false, // computed in the post-pass below, once the next event is known
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

        // lastInSection: an event closes its continuation group when the next
        // event does not continue from it (or it is the last event). This mirrors
        // the grouping MessagePanel derives for the legacy timeline; bubble layout
        // rounds a group's closing corner off it. Mutating the filtered references
        // mutates the originals in `items` (same objects). Recomputed each build —
        // it only drives border-radius, so a flip has no height/scroll impact.
        const eventItems = items.filter((it): it is Extract<TimelineItem, { kind: "event" }> => it.kind === "event");
        for (let i = 0; i < eventItems.length; i++) {
            eventItems[i].lastInSection = i === eventItems.length - 1 || !eventItems[i + 1].continuation;
        }

        debug(
            `[TimelineVM][buildItems] emitted ${items.length} items from ${events.length} window events, ` +
                `filtered=${filteredCount}`,
        );

        return items;
    }

    /**
     * Whether this event should get a row of its own. Re-decided on every {@link buildItems}.
     *
     * An encrypted message still being decrypted is left out for the moment. Showing one would
     * put a small placeholder in the list that grows into a full message moments later, pushing
     * everything below it down; it appears at its real size on the next rebuild instead, which
     * happens as soon as decryption finishes.
     *
     * A message that has *failed* to decrypt is different, and is shown — as the usual "unable to
     * decrypt" tile. That state can last indefinitely (the keys may never arrive), so hiding it
     * would quietly drop the message from the room rather than briefly delay it.
     *
     * Once decrypted, whether it gets a row depends on what it turned out to be: a message
     * does, but things that only modify other messages — reactions, edits — do not, matching
     * what the existing timeline shows.
     */
    private shouldIncludeEvent(event: MatrixEvent, showHiddenEvents: boolean): boolean {
        const eventId = event.getId();
        if (!eventId) return false;

        // Encrypted and still decrypting — leave it out until we know what it is. Note the
        // isDecryptionFailure check: one that has already failed is shown, not held back.
        // onEventDecrypted brings in whatever resolves later.
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
    private getCachedContinuation(eventId: string, prev: MatrixEvent | null, cur: MatrixEvent): boolean {
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
        debug(`[VM-merge] reason=${reason} changes=[${changes.join(", ")}]`);
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
