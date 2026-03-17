/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import type { EventTileContextMenuState, EventTileViewSnapshot } from "../../../../viewmodels/room/EventTileViewModel";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import type ReplyChain from "../../elements/ReplyChain";
import { aboveRightOf } from "../../../structures/ContextMenu";
import type { EventTileApi, EventTileProps } from "./EventTilePresenter";

interface ContextMenuProps {
    props: EventTileProps;
    contextMenu: EventTileContextMenuState;
    snapshot: EventTileViewSnapshot;
    tileRef: React.RefObject<EventTileApi | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFinished: () => void;
}

export function ContextMenu({
    props,
    contextMenu,
    snapshot,
    tileRef,
    replyChainRef,
    onFinished,
}: ContextMenuProps): JSX.Element {
    return (
        <MessageContextMenu
            {...aboveRightOf(contextMenu.position)}
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            eventTileOps={tileRef.current?.getEventTileOps?.()}
            collapseReplyChain={replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined}
            onFinished={onFinished}
            rightClick={true}
            reactions={snapshot.reactions}
            link={contextMenu.link}
            getRelationsForEvent={props.getRelationsForEvent}
        />
    );
}
