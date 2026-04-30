/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { ActionBarView, useViewModel } from "@element-hq/web-shared-components";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type ReplyChain from "../../elements/ReplyChain";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import GenericContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import type { EventTileOps, GetRelationsForEvent } from "./types";
import type { EventTileActionBarViewModel } from "../../../../viewmodels/room/timeline/event-tile/actions/EventTileActionBarViewModel";

type ActionBarProps = {
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    vm: EventTileActionBarViewModel;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
};

/** Renders the event action bar and its event-tile-specific menus. */
export function ActionBar({
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    vm,
    tileRef,
    replyChainRef,
}: Readonly<ActionBarProps>): JSX.Element {
    const snapshot = useViewModel(vm);

    const collapseReplyChain = replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined;
    const optionsMenu = snapshot.optionsMenuAnchorRect ? (
        <MessageContextMenu
            {...aboveLeftOf(snapshot.optionsMenuAnchorRect)}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            eventTileOps={tileRef.current ?? undefined}
            collapseReplyChain={collapseReplyChain}
            onFinished={vm.closeOptionsMenu}
            getRelationsForEvent={getRelationsForEvent}
        />
    ) : null;
    const reactionsMenu = snapshot.reactionsMenuAnchorRect ? (
        <GenericContextMenu
            {...aboveLeftOf(snapshot.reactionsMenuAnchorRect)}
            onFinished={vm.closeReactionsMenu}
            managed={false}
            focusLock
        >
            <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={vm.closeReactionsMenu} />
        </GenericContextMenu>
    ) : null;

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            {optionsMenu}
            {reactionsMenu}
        </>
    );
}
