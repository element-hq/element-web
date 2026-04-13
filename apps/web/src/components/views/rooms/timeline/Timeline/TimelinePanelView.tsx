/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useMemo, type JSX, type ReactNode } from "react";
import { DateSeparatorView, TimelineView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { TimelinePanelViewModel } from "../../../../../viewmodels/room/timeline/TimelinePanelViewModel";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import type { TimelineModelItem } from "../../../../../models/rooms/TimelineModel";
import { LegacyEventTileAdapter } from "../../LegacyEventTileAdapter";
import NewRoomIntro from "../../NewRoomIntro";
import GenericEventListSummary from "../../../elements/GenericEventListSummary";

interface TimelinePanelViewProps {
    /** Room whose unfiltered timeline should be rendered. */
    room: Room;
    /** Event to open the timeline around, such as scroll-state restore or permalink navigation. */
    anchoredEventId?: string;
    /** Event to visually highlight after navigation, such as a search result target. */
    highlightedEventId?: string;
}

/** Look up a MatrixEvent by ID from the room's timelines. */
function findEventById(room: Room, eventId: string): MatrixEvent | undefined {
    return room.findEventById(eventId) ?? undefined;
}

function renderVirtualItem(item: Extract<TimelineModelItem, { kind: "virtual" }>): ReactNode {
    if (item.type === "date-separator") {
        return <DateSeparatorView key={item.key} vm={item.vm} className="mx_TimelineSeparator" />;
    }

    if (item.type === "new-room") {
        return <NewRoomIntro key={item.key} />;
    }

    if (item.type === "read-marker") {
        return <hr key={item.key} className="mx_RoomView_myReadMarker" />;
    }

    if (item.type === "loading") {
        return <div key={item.key}>Loading...</div>;
    }

    if (item.type === "gap") {
        return <div key={item.key}>Gap</div>;
    }

    return null;
}

function renderGroupItem(item: Extract<TimelineModelItem, { kind: "group" }>): ReactNode {
    if (item.type !== "room-creation") {
        return null;
    }

    return (
        <GenericEventListSummary
            key={item.key}
            events={item.events}
            summaryMembers={item.summaryMembers}
            summaryText={item.summaryText}
        >
            {item.events.map((event) => (
                <li key={event.getId()!}>
                    <LegacyEventTileAdapter mxEvent={event} />
                </li>
            ))}
        </GenericEventListSummary>
    );
}

function renderTimelineItem(room: Room, item: TimelineModelItem): ReactNode {
    if (item.kind === "event") {
        const event = findEventById(room, item.key);
        return event ? <LegacyEventTileAdapter key={item.key} mxEvent={event} /> : null;
    }

    if (item.kind === "virtual") {
        return renderVirtualItem(item);
    }

    if (item.kind === "group") {
        return renderGroupItem(item);
    }

    return null;
}

/**
 * New MVVM-based timeline panel, rendered behind the `feature_new_timeline` Labs flag.
 * Uses the shared TimelineView from shared-components with a RoomTimelineViewModel.
 */
export function TimelinePanelView({
    room,
    anchoredEventId,
    highlightedEventId,
}: Readonly<TimelinePanelViewProps>): JSX.Element {
    const effectiveAnchorEventId = anchoredEventId ?? highlightedEventId;
    const viewKey = `${room.roomId}|${effectiveAnchorEventId ?? ""}`;

    return (
        <TimelinePanelViewInner
            key={viewKey}
            room={room}
            highlightedEventId={highlightedEventId}
            anchoredEventId={anchoredEventId}
        />
    );
}

function TimelinePanelViewInner({
    room,
    anchoredEventId,
    highlightedEventId,
}: Readonly<TimelinePanelViewProps>): JSX.Element {
    const effectiveAnchorEventId = anchoredEventId ?? highlightedEventId;
    const client: MatrixClient = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new TimelinePanelViewModel({
                client,
                room,
                initialEventId: effectiveAnchorEventId,
            }),
    );
    const renderItem = useMemo(() => renderTimelineItem.bind(null, room), [room]);

    useEffect(() => {
        vm.start();
    }, [vm]);

    return (
        <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper" style={{ height: "100%" }}>
            <TimelineView<TimelineModelItem> vm={vm} renderItem={renderItem} />
        </div>
    );
}
