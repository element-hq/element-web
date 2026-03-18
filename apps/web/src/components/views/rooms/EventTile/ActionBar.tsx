/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type { GetRelationsForEvent } from "../../../../viewmodels/room/EventTileViewModel";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import type ReplyChain from "../../elements/ReplyChain";
import MessageActionBar from "../../messages/MessageActionBar";
import type { EventTileApi } from "./EventTilePresenter";

interface ActionBarProps {
    mxEvent: MatrixEvent;
    forExport?: boolean;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    reactions: Relations | null;
    isEditing: boolean;
    isQuoteExpanded: boolean;
    tileRef: React.RefObject<EventTileApi | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
}

export function ActionBar({
    mxEvent,
    forExport,
    permalinkCreator,
    getRelationsForEvent,
    reactions,
    isEditing,
    isQuoteExpanded,
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
