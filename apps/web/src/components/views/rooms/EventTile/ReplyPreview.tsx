/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { haveRendererForEvent } from "../../../../events/EventTileFactory";
import { type Layout } from "../../../../settings/enums/Layout";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { shouldDisplayReply } from "../../../../utils/Reply";
import ReplyChain from "../../elements/ReplyChain";
import type { GetRelationsForEvent } from "./types";

/**
 * Props used to render the reply preview shown ahead of the main event body.
 */
export interface ReplyPreviewProps {
    mxEvent: MatrixEvent;
    cli: MatrixClient;
    showHiddenEvents: boolean;
    forExport?: boolean;
    permalinkCreator?: RoomPermalinkCreator;
    layout?: Layout;
    getRelationsForEvent?: GetRelationsForEvent;
    alwaysShowTimestamps?: boolean;
    hover: boolean;
    focusWithin: boolean;
    isQuoteExpanded?: boolean;
    replyChainRef: React.RefObject<ReplyChain | null>;
    setQuoteExpanded: (expanded: boolean) => void;
}

export function ReplyPreview({
    mxEvent,
    cli,
    showHiddenEvents,
    forExport,
    permalinkCreator,
    layout,
    getRelationsForEvent,
    alwaysShowTimestamps,
    hover,
    focusWithin,
    isQuoteExpanded,
    replyChainRef,
    setQuoteExpanded,
}: ReplyPreviewProps): JSX.Element | undefined {
    if (!haveRendererForEvent(mxEvent, cli, showHiddenEvents) || !shouldDisplayReply(mxEvent)) {
        return undefined;
    }

    return (
        <ReplyChain
            parentEv={mxEvent}
            ref={replyChainRef}
            forExport={forExport}
            permalinkCreator={permalinkCreator}
            layout={layout}
            alwaysShowTimestamps={alwaysShowTimestamps || hover || focusWithin}
            isQuoteExpanded={isQuoteExpanded}
            setQuoteExpanded={setQuoteExpanded}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}
