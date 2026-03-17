/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { haveRendererForEvent } from "../../../../events/EventTileFactory";
import { shouldDisplayReply } from "../../../../utils/Reply";
import ReplyChain from "../../elements/ReplyChain";
import type { EventTileProps } from "./EventTilePresenter";

interface ReplyPreviewProps {
    props: EventTileProps;
    cli: MatrixClient;
    showHiddenEvents: boolean;
    hover: boolean;
    focusWithin: boolean;
    isQuoteExpanded: boolean;
    replyChainRef: React.RefObject<ReplyChain | null>;
    setQuoteExpanded: (expanded: boolean) => void;
}

export function ReplyPreview({
    props,
    cli,
    showHiddenEvents,
    hover,
    focusWithin,
    isQuoteExpanded,
    replyChainRef,
    setQuoteExpanded,
}: ReplyPreviewProps): JSX.Element | undefined {
    if (!haveRendererForEvent(props.mxEvent, cli, showHiddenEvents) || !shouldDisplayReply(props.mxEvent)) {
        return undefined;
    }

    return (
        <ReplyChain
            parentEv={props.mxEvent}
            ref={replyChainRef}
            forExport={props.forExport}
            permalinkCreator={props.permalinkCreator}
            layout={props.layout}
            alwaysShowTimestamps={props.alwaysShowTimestamps || hover || focusWithin}
            isQuoteExpanded={isQuoteExpanded}
            setQuoteExpanded={setQuoteExpanded}
            getRelationsForEvent={props.getRelationsForEvent}
        />
    );
}
