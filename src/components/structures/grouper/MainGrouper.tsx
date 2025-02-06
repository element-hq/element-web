/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { EventType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import type MessagePanel from "../MessagePanel";
import type { WrappedEvent } from "../MessagePanel";
import { BaseGrouper } from "./BaseGrouper";
import { hasText } from "../../../TextForEvent";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import DateSeparator from "../../views/messages/DateSeparator";
import HistoryTile from "../../views/rooms/HistoryTile";
import EventListSummary from "../../views/elements/EventListSummary";
import { SeparatorKind } from "../../views/messages/TimelineSeparator";

const groupedStateEvents = [
    EventType.RoomMember,
    EventType.RoomThirdPartyInvite,
    EventType.RoomServerAcl,
    EventType.RoomPinnedEvents,
];

// Wrap consecutive grouped events in a ListSummary
export class MainGrouper extends BaseGrouper {
    public static canStartGroup = function (panel: MessagePanel, { event: ev, shouldShow }: WrappedEvent): boolean {
        if (!shouldShow) return false;

        if (ev.isState() && groupedStateEvents.includes(ev.getType() as EventType)) {
            return true;
        }

        if (ev.isRedacted()) {
            return true;
        }

        if (panel.showHiddenEvents && !panel.shouldShowEvent(ev, true)) {
            return true;
        }

        return false;
    };

    public constructor(
        public readonly panel: MessagePanel,
        public readonly firstEventAndShouldShow: WrappedEvent,
        public readonly prevEvent: MatrixEvent | null,
        public readonly lastShownEvent: MatrixEvent | undefined,
        nextEvent: WrappedEvent | null,
        nextEventTile: MatrixEvent | null,
    ) {
        super(panel, firstEventAndShouldShow, prevEvent, lastShownEvent, nextEvent, nextEventTile);
        this.events = [firstEventAndShouldShow];
    }

    public shouldGroup({ event: ev, shouldShow }: WrappedEvent): boolean {
        if (!shouldShow) {
            // absorb hidden events so that they do not break up streams of messages & redaction events being grouped
            return true;
        }
        if (this.panel.wantsSeparator(this.events[0].event, ev) === SeparatorKind.Date) {
            return false;
        }
        if (ev.isState() && groupedStateEvents.includes(ev.getType() as EventType)) {
            return true;
        }
        if (ev.isRedacted()) {
            return true;
        }
        if (this.panel.showHiddenEvents && !this.panel.shouldShowEvent(ev, true)) {
            return true;
        }
        return false;
    }

    public add(wrappedEvent: WrappedEvent): void {
        const { event: ev, shouldShow } = wrappedEvent;
        if (ev.getType() === EventType.RoomMember) {
            // We can ignore any events that don't actually have a message to display
            if (!hasText(ev, MatrixClientPeg.safeGet(), this.panel.showHiddenEvents)) return;
        }
        this.readMarker = this.readMarker || this.panel.readMarkerForEvent(ev.getId()!, ev === this.lastShownEvent);
        if (!this.panel.showHiddenEvents && !shouldShow) {
            // absorb hidden events to not split the summary
            return;
        }

        if (ev.getType() === EventType.RoomPinnedEvents) {
            // If pinned messages are disabled, don't show the summary
            return;
        }

        this.events.push(wrappedEvent);
    }

    private generateKey(): string {
        return "eventlistsummary-" + this.events[0].event.getId();
    }

    public getTiles(): ReactNode[] {
        // If we don't have any events to group, don't even try to group them. The logic
        // below assumes that we have a group of events to deal with, but we might not if
        // the events we were supposed to group were redacted.
        if (!this.events?.length) return [];

        const isGrouped = true;
        const panel = this.panel;
        const lastShownEvent = this.lastShownEvent;
        const ret: ReactNode[] = [];

        if (panel.wantsSeparator(this.prevEvent, this.events[0].event) === SeparatorKind.Date) {
            const ts = this.events[0].event.getTs();
            ret.push(
                <li key={ts + "~"}>
                    <DateSeparator roomId={this.events[0].event.getRoomId()!} ts={ts} />
                </li>,
            );
        }

        // Ensure that the key of the EventListSummary does not change with new events in either direction.
        // This will prevent it from being re-created unnecessarily, and instead will allow new props to be provided.
        // In turn, the shouldComponentUpdate method on ELS can be used to prevent unnecessary renderings.
        const keyEvent = this.events.find((e) => this.panel.grouperKeyMap.get(e.event));
        const key =
            keyEvent && this.panel.grouperKeyMap.has(keyEvent.event)
                ? this.panel.grouperKeyMap.get(keyEvent.event)!
                : this.generateKey();
        if (!keyEvent) {
            // Populate the weak map with the key.
            // Note that we only set the key on the specific event it refers to, since this group might get
            // split up in the future by other intervening events. If we were to set the key on all events
            // currently in the group, we would risk later giving the same key to multiple groups.
            this.panel.grouperKeyMap.set(this.events[0].event, key);
        }

        let highlightInSummary = false;
        let eventTiles: ReactNode[] | null = this.events
            .map((e, i) => {
                if (e.event.getId() === panel.props.highlightedEventId) {
                    highlightInSummary = true;
                }
                return panel.getTilesForEvent(
                    i === 0 ? this.prevEvent : this.events[i - 1].event,
                    e,
                    e.event === lastShownEvent,
                    isGrouped,
                    this.nextEvent,
                    this.nextEventTile,
                );
            })
            .reduce((a, b) => a.concat(b), []);

        if (eventTiles.length === 0) {
            eventTiles = null;
        }

        // If a membership event is the start of visible history, tell the user
        // why they can't see earlier messages
        if (!this.panel.props.canBackPaginate && !this.prevEvent) {
            ret.push(<HistoryTile key="historytile" />);
        }

        ret.push(
            <EventListSummary
                key={key}
                data-testid={key}
                events={this.events.map((e) => e.event)}
                onToggle={panel.onHeightChanged} // Update scroll state
                startExpanded={highlightInSummary}
                layout={this.panel.props.layout}
            >
                {eventTiles}
            </EventListSummary>,
        );

        if (this.readMarker) {
            ret.push(this.readMarker);
        }

        return ret;
    }

    public getNewPrevEvent(): MatrixEvent {
        return this.events[this.events.length - 1].event;
    }
}
