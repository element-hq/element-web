/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TimelineWindow, Direction, RoomEvent, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
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

const log = (...args: unknown[]): void => console.log("[TimelineVM]", ...args);

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

    public constructor(opts: TimelinePanelViewModelOpts) {
        super(opts, {
            items: [],
            stuckAtBottom: true,
            backwardPagination: "idle",
            forwardPagination: "idle",
            focus: { focusedKey: null, containerFocused: false },
            pendingAnchor: null,
        });

        this.timelineWindow = new TimelineWindow(opts.client, opts.room.getUnfilteredTimelineSet());
        this.presenter = new TimelinePanelPresenter({
            client: opts.client,
            room: opts.room,
            canPaginateBackward: () => this.timelineWindow.canPaginate(Direction.Backward),
        });
        this.disposables.trackListener(opts.room, RoomEvent.Timeline, this.onRoomTimeline);
        this.disposables.track({
            dispose: () => this.presenter.dispose(),
        });

        this.load(opts.initialEventId);
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
            const canPaginateBackward = this.timelineWindow.canPaginate(Direction.Backward);
            const canPaginateForward = this.timelineWindow.canPaginate(Direction.Forward);

            log("load() done, items:", items.length, "canBack:", canPaginateBackward, "canFwd:", canPaginateForward);

            this.snapshot.merge({
                items,
                backwardPagination: canPaginateBackward ? "idle" : "idle",
                forwardPagination: canPaginateForward ? "idle" : "idle",
                pendingAnchor: eventId ? { targetKey: eventId, position: 0.5, highlight: true } : null,
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

    public paginate = (direction: "backward" | "forward"): void => {
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

    private buildItems(): TimelineModelItem[] {
        return this.presenter.buildItems(this.timelineWindow.getEvents());
    }
}
