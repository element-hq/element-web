/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useMemo, type JSX, type ReactNode } from "react";
import { TimelineView, type TimelineItem } from "@element-hq/web-shared-components";

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { TimelinePanelViewModel } from "../../viewmodels/room/timeline/TimelinePanelViewModel";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { LegacyEventTileAdapter } from "../views/rooms/LegacyEventTileAdapter";

interface NewTimelinePanelProps {
    room: Room;
    highlightedEventId?: string;
}

/**
 * New MVVM-based timeline panel, rendered behind the `feature_new_timeline` Labs flag.
 * Uses the shared TimelineView from shared-components with a RoomTimelineViewModel.
 */
export function TimelinePanelView({ room, highlightedEventId }: NewTimelinePanelProps): JSX.Element {
    const client: MatrixClient = useMatrixClientContext();

    const vm = useMemo(
        () =>
            new TimelinePanelViewModel({
                client,
                room,
                initialEventId: highlightedEventId,
            }),
        [client, room, highlightedEventId],
    );

    const renderItem = useMemo(
        () =>
            (item: TimelineItem): ReactNode => {
                switch (item.kind) {
                    case "date-separator":
                        return (
                            <div key={item.key} className="mx_DateSeparator">
                                {item.key}
                            </div>
                        );
                    case "read-marker":
                        return <hr key={item.key} className="mx_RoomView_myReadMarker" />;
                    case "loading":
                        return <div key={item.key}>Loading...</div>;
                    case "gap":
                        return <div key={item.key}>Gap</div>;
                    case "event":
                        // For now, all events go through the legacy adapter.
                        // As tiles are migrated to MVVM, this switch will
                        // send migrated types to their shared views instead.
                        return <LegacyEventTileAdapter key={item.key} mxEvent={findEventById(room, item.key)!} />;
                    default:
                        return null;
                }
            },
        [room],
    );

    return (
        <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper" style={{ height: "100%" }}>
            <TimelineView vm={vm} renderItem={renderItem} />
        </div>
    );
}

/**
 * Look up a MatrixEvent by ID from the room's timelines.
 */
function findEventById(room: Room, eventId: string): MatrixEvent | undefined {
    return room.findEventById(eventId) ?? undefined;
}
