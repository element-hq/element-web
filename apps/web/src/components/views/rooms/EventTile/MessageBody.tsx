/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { renderTile } from "../../../../events/EventTileFactory";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import RedactedBody from "../../messages/RedactedBody";
import { EventPreview } from "../EventPreview";
import { DecryptionFailureBody } from "./DecryptionFailureBody";
import type { EventTileApi, EventTileProps } from "./EventTilePresenter";

interface MessageBodyProps {
    mxEvent: MatrixEvent;
    timelineRenderingType: TimelineRenderingType;
    tileRenderType: TimelineRenderingType;
    isSeeingThroughMessageHiddenForModeration: boolean;
    renderTileProps: EventTileProps;
    tileRef: React.RefObject<EventTileApi | null>;
    permalinkCreator?: RoomPermalinkCreator;
    showHiddenEvents: boolean;
}

export function MessageBody({
    mxEvent,
    timelineRenderingType,
    tileRenderType,
    isSeeingThroughMessageHiddenForModeration,
    renderTileProps,
    tileRef,
    permalinkCreator,
    showHiddenEvents,
}: MessageBodyProps): JSX.Element | null {
    if (
        timelineRenderingType === TimelineRenderingType.Notification ||
        timelineRenderingType === TimelineRenderingType.ThreadsList
    ) {
        if (mxEvent.isRedacted()) {
            return <RedactedBody mxEvent={mxEvent} />;
        }

        if (mxEvent.isDecryptionFailure()) {
            return <DecryptionFailureBody mxEvent={mxEvent} />;
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
