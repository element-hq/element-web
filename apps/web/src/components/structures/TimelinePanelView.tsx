/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo, type JSX, type ReactNode } from "react";
import { DateSeparatorView, TimelineView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { TimelinePanelViewModel } from "../../viewmodels/room/timeline/TimelinePanelViewModel";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import type { TimelineModelItem } from "../../models/rooms/TimelineModel";
import { LegacyEventTileAdapter } from "../views/rooms/LegacyEventTileAdapter";
import NewRoomIntro from "../views/rooms/NewRoomIntro";
import GenericEventListSummary from "../views/elements/GenericEventListSummary";

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

/** Typed TimelineView alias for the web timeline row model. */
const TypedTimelineView = TimelineView as (props: {
    vm: TimelinePanelViewModel;
    renderItem: (item: TimelineModelItem) => ReactNode;
}) => JSX.Element;

/**
 * New MVVM-based timeline panel, rendered behind the `feature_new_timeline` Labs flag.
 * Uses the shared TimelineView from shared-components with a RoomTimelineViewModel.
 */
export function TimelinePanelView({ room, anchoredEventId, highlightedEventId }: TimelinePanelViewProps): JSX.Element {
    const effectiveAnchorEventId = anchoredEventId ?? highlightedEventId;
    const viewKey = `${room.roomId}|${effectiveAnchorEventId ?? ""}`;

    return (
        <TimelinePanelViewContent
            key={viewKey}
            room={room}
            anchoredEventId={anchoredEventId}
            highlightedEventId={highlightedEventId}
        />
    );
}

function TimelinePanelViewContent({ room, anchoredEventId, highlightedEventId }: TimelinePanelViewProps): JSX.Element {
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

    const renderItem = useMemo(
        () =>
            (item: TimelineModelItem): ReactNode => {
                switch (item.kind) {
                    case "event":
                        // For now, all events go through the legacy adapter.
                        // As tiles are migrated to MVVM, this switch will
                        // send migrated types to their shared views instead.
                        return <LegacyEventTileAdapter key={item.key} mxEvent={findEventById(room, item.key)!} />;
                    case "virtual":
                        switch (item.type) {
                            case "date-separator":
                                return (
                                    <DateSeparatorView key={item.key} vm={item.vm} className="mx_TimelineSeparator" />
                                );
                            case "new-room":
                                return <NewRoomIntro key={item.key} />;
                            case "read-marker":
                                return <hr key={item.key} className="mx_RoomView_myReadMarker" />;
                            case "loading":
                                return <div key={item.key}>Loading...</div>;
                            case "gap":
                                return <div key={item.key}>Gap</div>;
                            default:
                                return null;
                        }
                    case "group":
                        switch (item.type) {
                            case "room-creation":
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
                            default:
                                return null;
                        }
                    default:
                        return null;
                }
            },
        [room],
    );

    return (
        <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper" style={{ height: "100%" }}>
            <TypedTimelineView vm={vm} renderItem={renderItem} />
        </div>
    );
}
