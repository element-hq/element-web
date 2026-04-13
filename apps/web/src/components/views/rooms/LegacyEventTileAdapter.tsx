/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import EventTile, { type GetRelationsForEvent, type IReadReceiptProps } from "./EventTile";
import type { Layout } from "../../../settings/enums/Layout";
import type { IReadReceiptPosition } from "./ReadReceiptMarker";
import type { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";

/**
 * Row-level props that the RoomTimelineViewModel attaches to each
 * legacy event item. These mirror what MessagePanel passes to EventTile today.
 */
export interface LegacyEventTileAdapterProps {
    mxEvent: MatrixEvent;

    // Position / continuation
    continuation?: boolean;
    last?: boolean;
    lastInSection?: boolean;
    lastSuccessful?: boolean;
    isSelectedEvent?: boolean;

    // Content control
    isRedacted?: boolean;
    replacingEventId?: string;
    hideSender?: boolean;

    // Read state
    readReceipts?: IReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    showReadReceipts?: boolean;

    // Display options
    layout?: Layout;
    showReactions?: boolean;
    showUrlPreview?: boolean;
    isTwelveHour?: boolean;
    alwaysShowTimestamps?: boolean;

    // Relations and groupers
    getRelationsForEvent?: GetRelationsForEvent;
    permalinkCreator?: RoomPermalinkCreator;
    callEventGrouper?: LegacyCallEventGrouper;
}

/**
 * Renders an unmigrated event using the legacy EventTile.
 *
 * The new shared timeline calls `renderItem(item)` for each row.
 * For items that are not yet migrated to MVVM, the web-side
 * renderItem implementation returns `<LegacyEventTileAdapter {...rowProps} />`.
 */
export function LegacyEventTileAdapter(props: Readonly<LegacyEventTileAdapterProps>): JSX.Element {
    return (
        <EventTile
            mxEvent={props.mxEvent}
            continuation={props.continuation}
            last={props.last}
            lastInSection={props.lastInSection}
            lastSuccessful={props.lastSuccessful}
            isSelectedEvent={props.isSelectedEvent}
            isRedacted={props.isRedacted}
            replacingEventId={props.replacingEventId}
            hideSender={props.hideSender}
            readReceipts={props.readReceipts}
            readReceiptMap={props.readReceiptMap}
            showReadReceipts={props.showReadReceipts}
            layout={props.layout}
            showReactions={props.showReactions}
            showUrlPreview={props.showUrlPreview}
            isTwelveHour={props.isTwelveHour}
            alwaysShowTimestamps={props.alwaysShowTimestamps}
            getRelationsForEvent={props.getRelationsForEvent}
            permalinkCreator={props.permalinkCreator}
            callEventGrouper={props.callEventGrouper}
        />
    );
}
