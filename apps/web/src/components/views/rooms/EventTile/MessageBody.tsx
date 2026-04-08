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
import type { EventTileOps } from "../../../../models/rooms/EventTileTypes";
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

export const MessageBody = memo(MessageBodyComponent);
