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
    M_BEACON_INFO,
    type MatrixClient,
    type Room,
    type MatrixEvent,
} from "matrix-js-sdk/src/matrix";
import { BaseViewModel } from "@element-hq/web-shared-components";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { wantsDateSeparator } from "../../../DateUtils";
import type { TimelineModelItem } from "../../../models/rooms/TimelineModel";
import DMRoomMap from "../../../utils/DMRoomMap";
import { _t } from "../../../languageHandler";
import { DateSeparatorViewModel } from "./DateSeparatorViewModel";
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
    private dateSeparatorVms = new Map<string, DateSeparatorViewModel>();
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

        this.load(opts.initialEventId);

        // Listen for new events so live messages appear
        opts.room.on(RoomEvent.Timeline, this.onRoomTimeline);
    }

    public override dispose(): void {
        this.props.room.off(RoomEvent.Timeline, this.onRoomTimeline);
        for (const vm of this.dateSeparatorVms.values()) {
            vm.dispose();
        }
        this.dateSeparatorVms.clear();
        super.dispose();
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

    // ── Snapshot construction ────────────────────────────────────────

    private shouldInsertDateSeparator(prevEvent: MatrixEvent | null, event: MatrixEvent): boolean {
        if (prevEvent === null) {
            return !this.timelineWindow.canPaginate(Direction.Backward);
        }

        return wantsDateSeparator(prevEvent.getDate() || undefined, event.getDate() || undefined);
    }

    private getDateSeparatorVm(ts: number): DateSeparatorViewModel {
        const key = `${this.props.room.roomId}-${ts}`;
        let vm = this.dateSeparatorVms.get(key);
        if (!vm) {
            vm = new DateSeparatorViewModel({
                roomId: this.props.room.roomId,
                ts,
            });
            this.dateSeparatorVms.set(key, vm);
        }

        return vm;
    }

    private buildDateSeparatorItem(event: MatrixEvent): TimelineModelItem {
        const ts = event.getTs();
        const dateKey = new Date(ts).toDateString();

        return {
            key: `date-${dateKey}`,
            kind: "virtual",
            type: "date-separator",
            vm: this.getDateSeparatorVm(ts),
        };
    }

    private buildRoomCreationItem(): TimelineModelItem {
        return {
            key: "new-room",
            kind: "virtual",
            type: "new-room",
        };
    }

    private shouldIncludeInCreationGroup(createEvent: MatrixEvent, event: MatrixEvent): boolean {
        if (this.shouldInsertDateSeparator(createEvent, event)) {
            return false;
        }

        const eventType = event.getType();
        if (
            eventType === EventType.RoomMember &&
            (event.getStateKey() !== createEvent.getSender() ||
                event.getContent()["membership"] !== KnownMembership.Join)
        ) {
            return false;
        }

        if (M_BEACON_INFO.matches(eventType)) {
            return false;
        }

        return event.isState() && event.getSender() === createEvent.getSender();
    }

    private buildRoomCreationGroupItem(events: MatrixEvent[]): TimelineModelItem {
        const latestEvent = events[events.length - 1];
        const roomId = latestEvent.getRoomId();
        const creator = latestEvent.sender?.name ?? latestEvent.getSender();
        const summaryText =
            roomId && DMRoomMap.shared().getUserIdForRoomId(roomId)
                ? _t("timeline|creation_summary_dm", { creator })
                : _t("timeline|creation_summary_room", { creator });

        return {
            key: `room-creation-${events[0].getId()}`,
            kind: "group",
            type: "room-creation",
            events,
            summaryMembers: latestEvent.sender ? [latestEvent.sender] : undefined,
            summaryText,
        };
    }

    private buildInitialCreationItems(
        events: MatrixEvent[],
    ): { items: TimelineModelItem[]; consumedCount: number } | null {
        const createEvent = events[0];
        if (!createEvent || createEvent.getType() !== EventType.RoomCreate) {
            return null;
        }

        const groupedEvents: MatrixEvent[] = [createEvent];
        const ejectedEvents: MatrixEvent[] = [];
        let index = 1;

        while (index < events.length && this.shouldIncludeInCreationGroup(createEvent, events[index])) {
            const event = events[index];
            if (event.getType() === EventType.RoomEncryption) {
                ejectedEvents.push(event);
            } else {
                groupedEvents.push(event);
            }
            index += 1;
        }

        const items: TimelineModelItem[] = [this.buildDateSeparatorItem(createEvent)];
        items.push(...ejectedEvents.map((event) => ({ key: event.getId()!, kind: "event" as const })));
        items.push(this.buildRoomCreationItem());
        items.push(this.buildRoomCreationGroupItem(groupedEvents));

        return { items, consumedCount: index };
    }

    private buildItems(): TimelineModelItem[] {
        const events: MatrixEvent[] = this.timelineWindow.getEvents();
        const items: TimelineModelItem[] = [];
        let prevEvent: MatrixEvent | null = null;
        let startIndex = 0;

        if (!this.timelineWindow.canPaginate(Direction.Backward)) {
            const creationItems = this.buildInitialCreationItems(events);
            if (creationItems) {
                items.push(...creationItems.items);
                startIndex = creationItems.consumedCount;
                prevEvent = events[creationItems.consumedCount - 1] ?? null;
            }
        }

        for (const event of events.slice(startIndex)) {
            const eventId = event.getId();
            if (!eventId) continue;

            if (this.shouldInsertDateSeparator(prevEvent, event)) {
                items.push(this.buildDateSeparatorItem(event));
            }

            items.push({
                key: eventId,
                kind: "event",
            });

            prevEvent = event;
        }

        return items;
    }
}
