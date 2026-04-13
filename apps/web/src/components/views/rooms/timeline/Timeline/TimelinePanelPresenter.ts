/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, M_BEACON_INFO, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { wantsDateSeparator } from "../../../../../DateUtils";
import type { TimelineModelItem } from "../../../../../models/rooms/TimelineModel";
import DMRoomMap from "../../../../../utils/DMRoomMap";
import { _t } from "../../../../../languageHandler";
import { DateSeparatorViewModel } from "../../../../../viewmodels/room/timeline/DateSeparatorViewModel";

export interface TimelinePanelPresenterOpts {
    room: Room;
}

export class TimelinePanelPresenter {
    private readonly dateSeparatorVms = new Map<string, DateSeparatorViewModel>();

    public constructor(private readonly opts: TimelinePanelPresenterOpts) {}

    public dispose(): void {
        for (const vm of this.dateSeparatorVms.values()) {
            vm.dispose();
        }
        this.dateSeparatorVms.clear();
    }

    public buildItems(events: MatrixEvent[], canPaginateBackward: boolean): TimelineModelItem[] {
        const items: TimelineModelItem[] = [];
        let prevEvent: MatrixEvent | null = null;
        let startIndex = 0;

        if (!canPaginateBackward) {
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

            if (this.shouldInsertDateSeparator(prevEvent, event, canPaginateBackward)) {
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

    private shouldInsertDateSeparator(
        prevEvent: MatrixEvent | null,
        event: MatrixEvent,
        canPaginateBackward: boolean,
    ): boolean {
        if (prevEvent === null) {
            return !canPaginateBackward;
        }

        return wantsDateSeparator(prevEvent.getDate() || undefined, event.getDate() || undefined);
    }

    private getDateSeparatorVm(ts: number): DateSeparatorViewModel {
        const key = `${this.opts.room.roomId}-${ts}`;
        let vm = this.dateSeparatorVms.get(key);
        if (!vm) {
            vm = new DateSeparatorViewModel({
                roomId: this.opts.room.roomId,
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
        if (createEvent === null) {
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
        const latestEvent = events.at(-1) ?? events[0];
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

        const items: TimelineModelItem[] = [
            this.buildDateSeparatorItem(createEvent),
            ...ejectedEvents.map((event) => ({ key: event.getId()!, kind: "event" as const })),
            this.buildRoomCreationItem(),
            this.buildRoomCreationGroupItem(groupedEvents),
        ];

        return { items, consumedCount: index };
    }
}
