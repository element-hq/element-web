/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { EventType, M_BEACON_INFO, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { BaseGrouper } from "./BaseGrouper";
import { type WrappedEvent } from "../MessagePanel";
import type MessagePanel from "../MessagePanel";
import DMRoomMap from "../../../utils/DMRoomMap";
import { _t } from "../../../languageHandler";
import DateSeparator from "../../views/messages/DateSeparator";
import NewRoomIntro from "../../views/rooms/NewRoomIntro";
import GenericEventListSummary from "../../views/elements/GenericEventListSummary";
import { SeparatorKind } from "../../views/messages/TimelineSeparator";

// Wrap initial room creation events into a GenericEventListSummary
// Grouping only events sent by the same user that sent the `m.room.create` and only until
// the first non-state event, beacon_info event or membership event which is not regarding the sender of the `m.room.create` event

export class CreationGrouper extends BaseGrouper {
    public static canStartGroup = function (_panel: MessagePanel, { event }: WrappedEvent): boolean {
        return event.getType() === EventType.RoomCreate;
    };

    public shouldGroup({ event, shouldShow }: WrappedEvent): boolean {
        const panel = this.panel;
        const createEvent = this.firstEventAndShouldShow.event;
        if (!shouldShow) {
            return true;
        }
        if (panel.wantsSeparator(this.firstEventAndShouldShow.event, event) === SeparatorKind.Date) {
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

        // beacons are not part of room creation configuration
        // should be shown in timeline
        if (M_BEACON_INFO.matches(eventType)) {
            return false;
        }

        if (event.isState() && event.getSender() === createEvent.getSender()) {
            return true;
        }

        return false;
    }

    public add(wrappedEvent: WrappedEvent): void {
        const { event: ev, shouldShow } = wrappedEvent;
        const panel = this.panel;
        this.readMarker = this.readMarker || panel.readMarkerForEvent(ev.getId()!, ev === this.lastShownEvent);
        if (!shouldShow) {
            return;
        }
        if (ev.getType() === EventType.RoomEncryption) {
            this.ejectedEvents.push(wrappedEvent);
        } else {
            this.events.push(wrappedEvent);
        }
    }

    public getTiles(): ReactNode[] {
        // If we don't have any events to group, don't even try to group them. The logic
        // below assumes that we have a group of events to deal with, but we might not if
        // the events we were supposed to group were redacted.
        if (!this.events || !this.events.length) return [];

        const panel = this.panel;
        const ret: ReactNode[] = [];
        const isGrouped = true;
        const createEvent = this.firstEventAndShouldShow;
        const lastShownEvent = this.lastShownEvent;

        if (panel.wantsSeparator(this.prevEvent, createEvent.event) === SeparatorKind.Date) {
            const ts = createEvent.event.getTs();
            ret.push(
                <li key={ts + "~"}>
                    <DateSeparator roomId={createEvent.event.getRoomId()!} ts={ts} />
                </li>,
            );
        }

        // If this m.room.create event should be shown (room upgrade) then show it before the summary
        if (createEvent.shouldShow) {
            // pass in the createEvent as prevEvent as well so no extra DateSeparator is rendered
            ret.push(...panel.getTilesForEvent(createEvent.event, createEvent));
        }

        for (const ejected of this.ejectedEvents) {
            ret.push(
                ...panel.getTilesForEvent(createEvent.event, ejected, createEvent.event === lastShownEvent, isGrouped),
            );
        }

        const eventTiles = this.events
            .map((e) => {
                // In order to prevent DateSeparators from appearing in the expanded form
                // of GenericEventListSummary, render each member event as if the previous
                // one was itself. This way, the timestamp of the previous event === the
                // timestamp of the current event, and no DateSeparator is inserted.
                return panel.getTilesForEvent(e.event, e, e.event === lastShownEvent, isGrouped);
            })
            .reduce((a, b) => a.concat(b), []);
        // Get sender profile from the latest event in the summary as the m.room.create doesn't contain one
        const ev = this.events[this.events.length - 1].event;

        let summaryText: string;
        const roomId = ev.getRoomId();
        const creator = ev.sender?.name ?? ev.getSender();
        if (roomId && DMRoomMap.shared().getUserIdForRoomId(roomId)) {
            summaryText = _t("timeline|creation_summary_dm", { creator });
        } else {
            summaryText = _t("timeline|creation_summary_room", { creator });
        }

        ret.push(<NewRoomIntro key="newroomintro" />);

        ret.push(
            <GenericEventListSummary
                key="roomcreationsummary"
                events={this.events.map((e) => e.event)}
                onToggle={panel.onHeightChanged} // Update scroll state
                summaryMembers={ev.sender ? [ev.sender] : undefined}
                summaryText={summaryText}
                layout={this.panel.props.layout}
            >
                {eventTiles}
            </GenericEventListSummary>,
        );

        if (this.readMarker) {
            ret.push(this.readMarker);
        }

        return ret;
    }

    public getNewPrevEvent(): MatrixEvent {
        return this.firstEventAndShouldShow.event;
    }
}
