/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, type JSX } from "react";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type {
    EventTileViewModel,
    EventTileViewSnapshot,
} from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import type ReplyChain from "../../elements/ReplyChain";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import { aboveRightOf } from "../../../structures/ContextMenu";
import type { EventTileContextMenuState, EventTileOps, GetRelationsForEvent } from "./types";

type UseContextMenuNodeArgs = {
    props: {
        mxEvent: MatrixEvent;
        permalinkCreator?: RoomPermalinkCreator;
        getRelationsForEvent?: GetRelationsForEvent;
    };
    snapshot: Pick<EventTileViewSnapshot, "contextMenuState" | "isContextMenuOpen" | "reactions">;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    vm: EventTileViewModel;
};

type ContextMenuProps = {
    contextMenu: EventTileContextMenuState;
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFinished: () => void;
};

export function useContextMenuNode({
    props,
    snapshot,
    tileRef,
    replyChainRef,
    vm,
}: UseContextMenuNodeArgs): JSX.Element | undefined {
    const closeContextMenu = useCallback((): void => {
        vm.closeContextMenu();
    }, [vm]);

    return snapshot.contextMenuState && snapshot.isContextMenuOpen ? (
        <ContextMenu
            mxEvent={props.mxEvent}
            permalinkCreator={props.permalinkCreator}
            getRelationsForEvent={props.getRelationsForEvent}
            reactions={snapshot.reactions}
            contextMenu={snapshot.contextMenuState}
            tileRef={tileRef}
            replyChainRef={replyChainRef}
            onFinished={closeContextMenu}
        />
    ) : undefined;
}

export function ContextMenu({
    contextMenu,
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    tileRef,
    replyChainRef,
    onFinished,
}: Readonly<ContextMenuProps>): JSX.Element {
    return (
        <MessageContextMenu
            {...aboveRightOf(contextMenu.position)}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            eventTileOps={tileRef.current ?? undefined}
            collapseReplyChain={replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined}
            onFinished={onFinished}
            rightClick={true}
            reactions={reactions}
            link={contextMenu.link}
            getRelationsForEvent={getRelationsForEvent}
        />
    );
}
