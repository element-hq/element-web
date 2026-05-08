/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, type JSX } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { renderTile, type EventTileTypeProps } from "../../../../events/EventTileFactory";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { EventPreview } from "../EventPreview";
import type { EventTileOps } from "./types";
import { DecryptionFailureBodyFactory, RedactedBodyFactory } from "../../messages/MBodyFactory";

export type MessageBodyRenderTileProps = Omit<
    EventTileTypeProps,
    "ref" | "permalinkCreator" | "showHiddenEvents" | "isSeeingThroughMessageHiddenForModeration"
>;

/**
 * Props used to render the event body content for a single tile.
 */
export type MessageBodyProps = Readonly<{
    mxEvent: MatrixEvent;
    isDecryptionFailure: boolean;
    renderTileProps: MessageBodyRenderTileProps;
    timelineRenderingType: TimelineRenderingType;
    tileRenderType: TimelineRenderingType;
    showHiddenEvents: boolean;
    isSeeingThroughMessageHiddenForModeration: boolean;
    permalinkCreator?: RoomPermalinkCreator;
    tileRef: React.RefObject<EventTileOps | null>;
}>;

function MessageBodyComponent({
    mxEvent,
    isDecryptionFailure,
    renderTileProps,
    timelineRenderingType,
    tileRenderType,
    showHiddenEvents,
    isSeeingThroughMessageHiddenForModeration,
    permalinkCreator,
    tileRef,
}: MessageBodyProps): JSX.Element | null {
    if (
        timelineRenderingType === TimelineRenderingType.Notification ||
        timelineRenderingType === TimelineRenderingType.ThreadsList
    ) {
        if (mxEvent.isRedacted()) {
            return <RedactedBodyFactory mxEvent={mxEvent} />;
        }

        if (isDecryptionFailure) {
            return <DecryptionFailureBodyFactory mxEvent={mxEvent} />;
        }

        return <EventPreview mxEvent={mxEvent} />;
    }

    return renderTile(tileRenderType, {
        ...renderTileProps,
        ref: tileRef,
        permalinkCreator,
        showHiddenEvents,
        isSeeingThroughMessageHiddenForModeration,
    });
}

function areRenderTilePropsEqual(a: MessageBodyRenderTileProps, b: MessageBodyRenderTileProps): boolean {
    return (
        a.mxEvent === b.mxEvent &&
        a.forExport === b.forExport &&
        a.showUrlPreview === b.showUrlPreview &&
        a.highlights === b.highlights &&
        a.highlightLink === b.highlightLink &&
        a.getRelationsForEvent === b.getRelationsForEvent &&
        a.editState === b.editState &&
        a.replacingEventId === b.replacingEventId &&
        a.callEventGrouper === b.callEventGrouper &&
        a.inhibitInteraction === b.inhibitInteraction &&
        a.maxImageHeight === b.maxImageHeight &&
        a.overrideBodyTypes === b.overrideBodyTypes &&
        a.overrideEventTypes === b.overrideEventTypes
    );
}

function areMessageBodyPropsEqual(a: MessageBodyProps, b: MessageBodyProps): boolean {
    return (
        a.mxEvent === b.mxEvent &&
        a.isDecryptionFailure === b.isDecryptionFailure &&
        a.timelineRenderingType === b.timelineRenderingType &&
        a.tileRenderType === b.tileRenderType &&
        a.showHiddenEvents === b.showHiddenEvents &&
        a.isSeeingThroughMessageHiddenForModeration === b.isSeeingThroughMessageHiddenForModeration &&
        a.permalinkCreator === b.permalinkCreator &&
        a.tileRef === b.tileRef
    );
}

// EventTileNodes rebuilds renderTileProps as a fresh object on parent renders, so compare the fields
// explicitly to keep MessageBody memoized across hover/focus-only tile updates.
export const MessageBody = memo(
    MessageBodyComponent,
    (a, b) => areMessageBodyPropsEqual(a, b) && areRenderTilePropsEqual(a.renderTileProps, b.renderTileProps),
);
