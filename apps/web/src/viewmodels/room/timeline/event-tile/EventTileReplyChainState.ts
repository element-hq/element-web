/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { shouldDisplayReply } from "../../../../utils/Reply";

/** Minimal ReplyChain surface needed for collapse decisions. */
export interface EventTileReplyChainLike {
    /** Whether the reply chain can currently be collapsed. */
    canCollapse(): boolean;
    /** Collapse the reply chain. */
    collapse(): void;
}

/** Inputs for deriving EventTile reply-chain display state. */
export interface EventTileReplyChainStateInput {
    /** Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Whether the event has a renderer in the current timeline context. */
    hasRenderer: boolean;
}

/** EventTile reply-chain display state. */
export interface EventTileReplyChainState {
    /** Whether EventTile should render ReplyChain. */
    shouldShowReplyChain: boolean;
}

/** Derives reply-chain display state for EventTile. */
export function getEventTileReplyChainState({
    mxEvent,
    hasRenderer,
}: EventTileReplyChainStateInput): EventTileReplyChainState {
    return {
        shouldShowReplyChain: hasRenderer && shouldDisplayReply(mxEvent),
    };
}

/** Whether the current reply chain can collapse. */
export function canCollapseReplyChain(replyChain: EventTileReplyChainLike | null | undefined): boolean {
    return !!replyChain?.canCollapse();
}
