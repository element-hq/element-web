/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, type JSX } from "react";

import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type Layout } from "../../../../settings/enums/Layout";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import ReplyChain from "../../elements/ReplyChain";
import type { GetRelationsForEvent } from "../../../../models/rooms/EventTileTypes";

/**
 * Props used to render the reply preview shown ahead of the main event body.
 */
export type ReplyPreviewProps = Readonly<{
    mxEvent: MatrixEvent;
    forExport?: boolean;
    permalinkCreator?: RoomPermalinkCreator;
    layout?: Layout;
    getRelationsForEvent?: GetRelationsForEvent;
    alwaysShowTimestamps?: boolean;
    isQuoteExpanded?: boolean;
    replyChainRef: React.RefObject<ReplyChain | null>;
    setQuoteExpanded: (expanded: boolean) => void;
}>;

function ReplyPreviewComponent({
    mxEvent,
    forExport,
    permalinkCreator,
    layout,
    getRelationsForEvent,
    alwaysShowTimestamps,
    isQuoteExpanded,
    replyChainRef,
    setQuoteExpanded,
}: ReplyPreviewProps): JSX.Element | undefined {
    return (
        <ReplyChain
            parentEv={mxEvent}
            ref={replyChainRef}
            forExport={forExport}
            permalinkCreator={permalinkCreator}
            layout={layout}
            alwaysShowTimestamps={alwaysShowTimestamps}
            isQuoteExpanded={isQuoteExpanded}
            setQuoteExpanded={setQuoteExpanded}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}

export const ReplyPreview = memo(ReplyPreviewComponent);
