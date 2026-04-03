/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TimelineWindow, Direction, type MatrixClient, type Room, type MatrixEvent } from "matrix-js-sdk/src/matrix";
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
    }

    private async load(eventId?: string): Promise<void> {
        this.snapshot.merge({
            backwardPagination: "loading",
            forwardPagination: "loading",
        });

        try {
            await this.timelineWindow.load(eventId, INITIAL_SIZE);

            const items = this.buildItems();
            const canPaginateBackward = this.timelineWindow.canPaginate(Direction.Backward);
            const canPaginateForward = this.timelineWindow.canPaginate(Direction.Forward);

            this.snapshot.merge({
                items,
                backwardPagination: canPaginateBackward ? "idle" : "idle",
                forwardPagination: canPaginateForward ? "idle" : "idle",
                pendingAnchor: eventId
                    ? { targetKey: eventId, position: 0.5, highlight: true }
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

    public paginate = (direction: "backward" | "forward"): void => {
        const dir = direction === "backward" ? Direction.Backward : Direction.Forward;
        const stateKey = direction === "backward" ? "backwardPagination" : "forwardPagination";

        if (!this.timelineWindow.canPaginate(dir)) {
            return;
        }

        this.snapshot.merge({ [stateKey]: "loading" as PaginationState });

        this.timelineWindow
            .paginate(dir, PAGINATE_SIZE)
            .then((success) => {
                const items = this.buildItems();
                this.snapshot.merge({
                    items,
                    [stateKey]: "idle" as PaginationState,
                });
            })
            .catch(() => {
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

    private buildItems(): TimelineItem[] {
        const events: MatrixEvent[] = this.timelineWindow.getEvents();
        const items: TimelineItem[] = [];
        let lastDate: string | null = null;

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
                });
                lastDate = dateKey;
            }

            items.push({
                key: eventId,
                kind: "event",
            });
        }

        return items;
    }
}
