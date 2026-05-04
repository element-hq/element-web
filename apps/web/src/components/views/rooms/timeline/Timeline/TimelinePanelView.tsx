/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useMemo, type JSX, type ReactNode } from "react";
import { DateSeparatorView, TimelineView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { TimelinePanelViewModel } from "../../../../../viewmodels/room/timeline/TimelinePanelViewModel";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import type { TimelineModelItem } from "../../../../../models/rooms/TimelineModel";
import { LegacyEventTileAdapter } from "../../LegacyEventTileAdapter";
import type { GetRelationsForEvent } from "../../EventTile";
import NewRoomIntro from "../../NewRoomIntro";
import GenericEventListSummary from "../../../elements/GenericEventListSummary";
import type { Layout } from "../../../../../settings/enums/Layout";
import type { RoomPermalinkCreator } from "../../../../../utils/permalinks/Permalinks";

interface TimelinePanelViewProps {
    /** Room whose unfiltered timeline should be rendered. */
    room: Room;
    /** Event to open the timeline around, such as scroll-state restore or permalink navigation. */
    anchoredEventId?: string;
    /** Event to visually highlight after navigation, such as a search result target. */
    highlightedEventId?: string;
    showReactions?: boolean;
    showUrlPreview?: boolean;
    isTwelveHour?: boolean;
    alwaysShowTimestamps?: boolean;
    layout?: Layout;
    getRelationsForEvent?: GetRelationsForEvent;
    permalinkCreator?: RoomPermalinkCreator;
}

type LegacyEventTileRenderProps = Pick<
    TimelinePanelViewProps,
    | "showReactions"
    | "showUrlPreview"
    | "isTwelveHour"
    | "alwaysShowTimestamps"
    | "layout"
    | "getRelationsForEvent"
    | "permalinkCreator"
>;

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

function renderGroupItem(
    item: Extract<TimelineModelItem, { kind: "group" }>,
    tileProps: LegacyEventTileRenderProps,
): ReactNode {
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
                    <LegacyEventTileAdapter mxEvent={event} {...tileProps} />
                </li>
            ))}
        </GenericEventListSummary>
    );
}

function renderTimelineItem(_room: Room, tileProps: LegacyEventTileRenderProps, item: TimelineModelItem): ReactNode {
    if (item.kind === "event") {
        return <LegacyEventTileAdapter key={item.key} mxEvent={item.event} {...tileProps} />;
    }

    if (item.kind === "virtual") {
        return renderVirtualItem(item);
    }

    if (item.kind === "group") {
        return renderGroupItem(item, tileProps);
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
    showReactions,
    showUrlPreview,
    isTwelveHour,
    alwaysShowTimestamps,
    layout,
    getRelationsForEvent,
    permalinkCreator,
}: Readonly<TimelinePanelViewProps>): JSX.Element {
    const effectiveAnchorEventId = anchoredEventId ?? highlightedEventId;
    const viewKey = `${room.roomId}|${effectiveAnchorEventId ?? ""}`;

    return (
        <TimelinePanelViewInner
            key={viewKey}
            room={room}
            highlightedEventId={highlightedEventId}
            anchoredEventId={anchoredEventId}
            showReactions={showReactions}
            showUrlPreview={showUrlPreview}
            isTwelveHour={isTwelveHour}
            alwaysShowTimestamps={alwaysShowTimestamps}
            layout={layout}
            getRelationsForEvent={getRelationsForEvent}
            permalinkCreator={permalinkCreator}
        />
    );
}

function TimelinePanelViewInner({
    room,
    anchoredEventId,
    highlightedEventId,
    showReactions,
    showUrlPreview,
    isTwelveHour,
    alwaysShowTimestamps,
    layout,
    getRelationsForEvent,
    permalinkCreator,
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
    const renderItem = useMemo(
        () =>
            renderTimelineItem.bind(null, room, {
                showReactions,
                showUrlPreview,
                isTwelveHour,
                alwaysShowTimestamps,
                layout,
                getRelationsForEvent,
                permalinkCreator,
            }),
        [
            room,
            showReactions,
            showUrlPreview,
            isTwelveHour,
            alwaysShowTimestamps,
            layout,
            getRelationsForEvent,
            permalinkCreator,
        ],
    );

    useEffect(() => {
        vm.start();
    }, [vm]);

    return (
        <div className="mx_RoomView_messagePanel mx_RoomView_messageListWrapper" style={{ height: "100%" }}>
            <TimelineView<TimelineModelItem> vm={vm} renderItem={renderItem} />
        </div>
    );
}
