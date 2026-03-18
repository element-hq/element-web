/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { EventTileContextMenu } from "../../../../viewmodels/room/EventTileViewModel";
import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import type ReplyChain from "../../elements/ReplyChain";
import { aboveRightOf } from "../../../structures/ContextMenu";
import type { EventTileApi } from "./EventTilePresenter";
import type { GetRelationsForEvent } from "./types";

type ContextMenuProps = {
    contextMenu: EventTileContextMenu;
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    tileRef: React.RefObject<EventTileApi | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFinished: () => void;
};

export function ContextMenu({
    contextMenu,
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    tileRef,
    replyChainRef,
    onFinished,
}: ContextMenuProps): JSX.Element {
    return (
        <MessageContextMenu
            {...aboveRightOf(contextMenu.position)}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            eventTileOps={tileRef.current?.getEventTileOps?.()}
            collapseReplyChain={replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined}
            onFinished={onFinished}
            rightClick={true}
            reactions={reactions}
            link={contextMenu.link}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}
