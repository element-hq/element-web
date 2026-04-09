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

import type { TimelineModelItem } from "../../../models/rooms/TimelineModel";
import { TimelinePanelPresenter } from "./TimelinePanelPresenter";
import type {
    TimelineViewSnapshot,
    TimelineViewActions,
    VisibleRange,
    PaginationState,
} from "@element-hq/web-shared-components";

const PAGINATE_SIZE = 20;
const INITIAL_SIZE = 30;
const WINDOW_LIMIT = 200;
const MAX_INITIAL_FILL_ROUNDS = 3;

const log = (...args: unknown[]): void => console.log("[TimelineVM]", ...args);
type RoomTimelineListenerArgs = [
    ev: MatrixEvent,
    room: Room | undefined,
    toStartOfTimeline: boolean | undefined,
    removed: boolean,
    data: IRoomTimelineData,
];

export interface TimelinePanelViewModelOpts {
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
export class TimelinePanelViewModel
    extends BaseViewModel<TimelineViewSnapshot<TimelineModelItem>, TimelinePanelViewModelOpts>
    implements TimelineViewActions
{
    private timelineWindow: TimelineWindow;
    private presenter: TimelinePanelPresenter;
    // TODO: Use visibleRange for read receipts
    public visibleRange: VisibleRange = { startIndex: 0, endIndex: 0 };
    /** Number of backward paginations consumed by the mount-time fill loop. */
    private initialFillRounds = 0;
    /** Whether Virtuoso has emitted at least one visible range for this load. */
    private sawInitialRange = false;

    public constructor(opts: TimelinePanelViewModelOpts) {
        super(opts, {
            items: [],
            initialFill: "filling",
            stuckAtBottom: !opts.initialEventId,
            canPaginateBackward: false,
            canPaginateForward: false,
            backwardPagination: "idle",
            forwardPagination: "idle",
            focus: { focusedKey: null, containerFocused: false },
            pendingAnchor: null,
        });

        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet(), {
            windowLimit: WINDOW_LIMIT,
        });
        this.presenter = new TimelinePanelPresenter({
            client: opts.client,
            room: opts.room,
            canPaginateBackward: () => this.timelineWindow.canPaginate(Direction.Backward),
        });
        this.disposables.trackListener(opts.room, RoomEvent.Timeline, this.onRoomTimelineListener);
        this.disposables.track({
            dispose: () => this.presenter.dispose(),
        });

        this.load(opts.initialEventId);
    }

    private onRoomTimelineListener = (...args: unknown[]): void => {
        this.onRoomTimeline(...(args as RoomTimelineListenerArgs));
    };

    private onRoomTimeline = (
        _ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (!room || removed || room.roomId !== this.props.room.roomId) {
            return;
        }

        // Ignore pagination and filtered-timeline updates. Only live-end
        // mutations should extend the loaded window or expose forward paging.
        if (data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()) {
            return;
        }

        if (toStartOfTimeline || !data.liveEvent) {
            return;
        }

        const { stuckAtBottom } = this.snapshot.current;
        log("onRoomTimeline fired, stuckAtBottom:", stuckAtBottom);
        if (!stuckAtBottom) {
            this.snapshot.merge({
                canPaginateForward: true,
            });
            return;
        }

        this.timelineWindow.paginate(Direction.Forward, 1, false).then(() => {
            const items = this.buildItems();
            log("live event added, total items:", items.length);
            this.snapshot.merge({
                items,
                canPaginateBackward: this.timelineWindow.canPaginate(Direction.Backward),
                canPaginateForward: this.timelineWindow.canPaginate(Direction.Forward),
            });
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
            const canPaginateBackward = this.timelineWindow.canPaginate(Direction.Backward);
            const canPaginateForward = this.timelineWindow.canPaginate(Direction.Forward);

            log("load() done, items:", items.length, "canBack:", canPaginateBackward, "canFwd:", canPaginateForward);

            this.snapshot.merge({
                items,
                initialFill: "filling",
                canPaginateBackward,
                canPaginateForward,
                backwardPagination: "idle",
                forwardPagination: "idle",
                pendingAnchor: eventId ? { targetKey: eventId, position: 0.5, highlight: true } : null,
            });
        } catch (e) {
            log("load() error:", e);
            this.snapshot.merge({
                initialFill: "done",
                canPaginateBackward: false,
                canPaginateForward: false,
                backwardPagination: "error",
                forwardPagination: "error",
            });
        }
    }

    // ── TimelineViewActions ──────────────────────────────────────────

    public paginate = (direction: "backward" | "forward"): void => {
        const dir = direction === "backward" ? Direction.Backward : Direction.Forward;
        const stateKey = direction === "backward" ? "backwardPagination" : "forwardPagination";

        const canPaginate = this.timelineWindow.canPaginate(dir);
        log("paginate()", direction, "canPaginate:", canPaginate, "currentState:", this.snapshot.current[stateKey]);

        if (!canPaginate) {
            this.snapshot.merge({
                [direction === "backward" ? "canPaginateBackward" : "canPaginateForward"]: false,
            });
            return;
        }

        if (
            direction === "backward" &&
            this.snapshot.current.initialFill === "filling" &&
            this.initialFillRounds === 0
        ) {
            this.initialFillRounds = 1;
        }

        this.snapshot.merge({ [stateKey]: "loading" as PaginationState });

        const prevItemCount = this.snapshot.current.items.length;
        this.timelineWindow
            .paginate(dir, PAGINATE_SIZE)
            .then((success) => {
                const items = this.buildItems();
                const newCount = items.length - prevItemCount;
                const canPaginateBackward = this.timelineWindow.canPaginate(Direction.Backward);
                const canPaginateForward = this.timelineWindow.canPaginate(Direction.Forward);
                if (direction === "backward" && newCount > 0) {
                    this.firstItemIndex -= newCount;
                }
                log(
                    "paginate()",
                    direction,
                    "success:",
                    success,
                    "items:",
                    prevItemCount,
                    "->",
                    items.length,
                    "firstItemIndex:",
                    this.firstItemIndex,
                );
                this.snapshot.merge({
                    items,
                    canPaginateBackward,
                    canPaginateForward,
                    [stateKey]: "idle" as PaginationState,
                });
            })
            .catch((e) => {
                log("paginate()", direction, "error:", e);
                this.snapshot.merge({
                    canPaginateBackward: this.timelineWindow.canPaginate(Direction.Backward),
                    canPaginateForward: this.timelineWindow.canPaginate(Direction.Forward),
                    [stateKey]: "error" as PaginationState,
                });
            });
    };

    public onVisibleRangeChanged = (range: VisibleRange): void => {
        this.visibleRange = range;
        this.maybeRunInitialFill(range);
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

    private buildItems(): TimelineModelItem[] {
        return this.presenter.buildItems(this.timelineWindow.getEvents());
    }

    /**
     * Startup fill state machine:
     * 1. Wait for the first top-edge backward probe opportunity.
     * 2. Keep paginating backward while the viewport remains top-bound.
     * 3. Hand over to normal edge pagination once the viewport settles.
     */
    private maybeRunInitialFill(range: VisibleRange): void {
        const snapshot = this.snapshot.current;
        if (snapshot.initialFill !== "filling") {
            return;
        }

        if (snapshot.backwardPagination === "loading") {
            return;
        }

        if (this.shouldWaitForFirstBackwardProbe(snapshot)) {
            return;
        }

        if (!this.sawInitialRange) {
            this.sawInitialRange = true;
            this.runBackwardStartupFillIfPossible(range, snapshot);
            return;
        }

        if (!this.shouldContinueInitialFill(range, snapshot)) {
            this.finishInitialFill();
            return;
        }

        this.initialFillRounds += 1;
        this.paginate("backward");
    }

    private shouldWaitForFirstBackwardProbe(snapshot: TimelineViewSnapshot<TimelineModelItem>): boolean {
        return this.initialFillRounds === 0 && snapshot.canPaginateBackward && !snapshot.pendingAnchor;
    }

    private canRunBackwardStartupFill(range: VisibleRange, snapshot: TimelineViewSnapshot<TimelineModelItem>): boolean {
        return (
            snapshot.items.length > 0 &&
            range.startIndex === 0 &&
            snapshot.canPaginateBackward &&
            this.initialFillRounds < MAX_INITIAL_FILL_ROUNDS &&
            !snapshot.pendingAnchor
        );
    }

    private runBackwardStartupFillIfPossible(
        range: VisibleRange,
        snapshot: TimelineViewSnapshot<TimelineModelItem>,
    ): void {
        if (this.canRunBackwardStartupFill(range, snapshot)) {
            this.initialFillRounds += 1;
            this.paginate("backward");
            return;
        }

        this.finishInitialFill();
    }

    private shouldContinueInitialFill(range: VisibleRange, snapshot: TimelineViewSnapshot<TimelineModelItem>): boolean {
        return (
            range.startIndex === 0 &&
            snapshot.canPaginateBackward &&
            this.initialFillRounds < MAX_INITIAL_FILL_ROUNDS &&
            !snapshot.pendingAnchor
        );
    }

    private finishInitialFill(): void {
        this.snapshot.merge({ initialFill: "done" });
    }
}
