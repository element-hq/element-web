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
    private initialFillCompleted = false;
    // TODO: Use visibleRange for read receipts
    public visibleRange: VisibleRange = { startIndex: 0, endIndex: 0 };

    public constructor(opts: TimelinePanelViewModelOpts) {
        super(opts, {
            items: [],
            stuckAtBottom: !opts.initialEventId,
            canPaginateBackward: false,
            canPaginateForward: false,
            backwardPagination: "idle",
            forwardPagination: "idle",
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
        if (!stuckAtBottom) {
            this.mergeSnapshot({
                canPaginateForward: true,
            });
            return;
        }

        this.paginateDirection(Direction.Forward, 1, false, false);
    };

    private async load(eventId?: string): Promise<void> {
        this.mergeSnapshot({
            backwardPagination: "loading",
            forwardPagination: "loading",
        });

        try {
            await this.timelineWindow.load(eventId, INITIAL_SIZE);
            if (this.isDisposed) {
                return;
            }

            const items = this.buildItems();
            const canPaginateBackward = this.timelineWindow.canPaginate(Direction.Backward);
            const canPaginateForward = this.timelineWindow.canPaginate(Direction.Forward);

            this.mergeSnapshot({
                items,
                canPaginateBackward,
                canPaginateForward,
                backwardPagination: "idle",
                forwardPagination: "idle",
                pendingAnchor: eventId ? { targetKey: eventId, position: 0.5, highlight: true } : null,
            });
        } catch {
            this.mergeSnapshot({
                canPaginateBackward: false,
                canPaginateForward: false,
                backwardPagination: "error",
                forwardPagination: "error",
            });
        }
    }

    // ── TimelineViewActions ──────────────────────────────────────────

    public paginate = (direction: "backward" | "forward"): void => {
        if (direction === "forward" && !this.initialFillCompleted) {
            return;
        }

        const dir = direction === "backward" ? Direction.Backward : Direction.Forward;
        this.paginateDirection(dir, PAGINATE_SIZE, true, true);
    };

    public onInitialFillCompleted = (): void => {
        this.initialFillCompleted = true;
    };

    public onVisibleRangeChanged = (range: VisibleRange): void => {
        this.visibleRange = range;
    };

    public onAnchorReached = (): void => {
        this.mergeSnapshot({ pendingAnchor: null });
    };

    public onStuckAtBottomChanged = (stuckAtBottom: boolean): void => {
        this.mergeSnapshot({ stuckAtBottom });
    };

    private buildItems(): TimelineModelItem[] {
        return this.presenter.buildItems(this.timelineWindow.getEvents());
    }

    private mergeSnapshot(update: Partial<TimelineViewSnapshot<TimelineModelItem>>): void {
        if (this.isDisposed) {
            return;
        }

        this.snapshot.merge(update);
    }

    private paginateDirection(dir: Direction, size: number, allowRequest: boolean, requireCanPaginate: boolean): void {
        const direction = dir === Direction.Backward ? "backward" : "forward";
        const stateKey = direction === "backward" ? "backwardPagination" : "forwardPagination";
        const capabilityKey = direction === "backward" ? "canPaginateBackward" : "canPaginateForward";
        const currentState = this.snapshot.current[stateKey];
        const canPaginate = this.timelineWindow.canPaginate(dir);

        if (currentState === "loading") {
            return;
        }

        if (requireCanPaginate && !canPaginate) {
            this.mergeSnapshot({
                [capabilityKey]: false,
            });
            return;
        }

        this.mergeSnapshot({ [stateKey]: "loading" as PaginationState });

        const paginationRequest = allowRequest
            ? this.timelineWindow.paginate(dir, size)
            : this.timelineWindow.paginate(dir, size, false);

        paginationRequest
            .then((success) => {
                if (this.isDisposed) {
                    return;
                }

                const items = this.buildItems();
                const canPaginateBackward = this.timelineWindow.canPaginate(Direction.Backward);
                const canPaginateForward = this.timelineWindow.canPaginate(Direction.Forward);
                this.mergeSnapshot({
                    items,
                    canPaginateBackward,
                    canPaginateForward,
                    [stateKey]: "idle" as PaginationState,
                });
            })
            .catch((e) => {
                this.mergeSnapshot({
                    canPaginateBackward: this.timelineWindow.canPaginate(Direction.Backward),
                    canPaginateForward: this.timelineWindow.canPaginate(Direction.Forward),
                    [stateKey]: "error" as PaginationState,
                });
            });
    }
}
