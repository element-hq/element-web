/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { Relations } from "matrix-js-sdk/src/matrix";
import type ReplyChain from "../../elements/ReplyChain";
import MessageActionBar from "../../messages/MessageActionBar";
import type { EventTileApi, EventTileProps } from "./EventTilePresenter";

interface ActionBarProps {
    props: EventTileProps;
    reactions: Relations | null;
    isEditing: boolean;
    isQuoteExpanded: boolean;
    tileRef: React.RefObject<EventTileApi | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
}

export function ActionBar({
    props,
    reactions,
    isEditing,
    isQuoteExpanded,
    tileRef,
    replyChainRef,
    onFocusChange,
    toggleThreadExpanded,
}: ActionBarProps): JSX.Element | undefined {
    if (isEditing || props.forExport) {
        return undefined;
    }

    return (
        <MessageActionBar
            mxEvent={props.mxEvent}
            reactions={reactions}
            permalinkCreator={props.permalinkCreator}
            getTile={() => tileRef.current}
            getReplyChain={() => replyChainRef.current}
            onFocusChange={onFocusChange}
            isQuoteExpanded={isQuoteExpanded}
            toggleThreadExpanded={toggleThreadExpanded}
            getRelationsForEvent={props.getRelationsForEvent}
        />
    );
}
