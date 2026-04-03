/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import type ReplyChain from "../../elements/ReplyChain";
import MessageActionBar from "../../messages/MessageActionBar";
import type { EventTileOps, GetRelationsForEvent } from "./types";

/**
 * Props used to render the interactive message action bar for a tile.
 */
export type ActionBarProps = Readonly<{
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    isEditing: boolean;
    isQuoteExpanded?: boolean;
    forExport?: boolean;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
}>;

export function ActionBar({
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    isEditing,
    isQuoteExpanded,
    forExport,
    tileRef,
    replyChainRef,
    onFocusChange,
    toggleThreadExpanded,
}: ActionBarProps): JSX.Element | undefined {
    if (isEditing || forExport) {
        return undefined;
    }

    return (
        <MessageActionBar
            mxEvent={mxEvent}
            reactions={reactions}
            permalinkCreator={permalinkCreator}
            getTile={() => tileRef.current}
            getReplyChain={() => replyChainRef.current}
            onFocusChange={onFocusChange}
            isQuoteExpanded={isQuoteExpanded}
            toggleThreadExpanded={toggleThreadExpanded}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}
