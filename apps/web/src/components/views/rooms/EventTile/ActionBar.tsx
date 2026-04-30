/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { ActionBarView, useViewModel } from "@element-hq/web-shared-components";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type ReplyChain from "../../elements/ReplyChain";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
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
    onMenuOpenChange: (open: boolean) => void;
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
    onMenuOpenChange,
}: Readonly<ActionBarProps>): JSX.Element {
    const snapshot = useViewModel(vm);

    useEffect(() => {
        onMenuOpenChange(snapshot.isMenuOpen);
    }, [onMenuOpenChange, snapshot.isMenuOpen]);

    const collapseReplyChain = replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined;

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            {snapshot.optionsMenuAnchorRect ? (
                <MessageContextMenu
                    {...aboveLeftOf(snapshot.optionsMenuAnchorRect)}
                    mxEvent={mxEvent}
                    permalinkCreator={permalinkCreator}
                    eventTileOps={tileRef.current ?? undefined}
                    collapseReplyChain={collapseReplyChain}
                    onFinished={vm.closeOptionsMenu}
                    getRelationsForEvent={getRelationsForEvent}
                />
            ) : null}
            {snapshot.reactionsMenuAnchorRect ? (
                <ContextMenu
                    {...aboveLeftOf(snapshot.reactionsMenuAnchorRect)}
                    onFinished={vm.closeReactionsMenu}
                    managed={false}
                    focusLock
                >
                    <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={vm.closeReactionsMenu} />
                </ContextMenu>
            ) : null}
        </>
    );
}
