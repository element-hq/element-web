/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useEffect, useState, type JSX } from "react";
import { ActionBarView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import type ReplyChain from "../../elements/ReplyChain";
import type { EventTileOps, GetRelationsForEvent } from "./types";
import RoomContext from "../../../../contexts/RoomContext";
import { CardContext } from "../../right_panel/context";
import {
    EventTileActionBarViewModel,
} from "../../../../viewmodels/room/EventTileActionBarViewModel";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";

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

    const roomContext = useContext(RoomContext);
    const { isCard } = useContext(CardContext);
    const [optionsMenuAnchorRect, setOptionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const [reactionsMenuAnchorRect, setReactionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const isSearch = Boolean(roomContext.search);

    const handleOptionsClick = useCallback((anchor: HTMLElement | null): void => {
        setOptionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);
    const handleReactionsClick = useCallback((anchor: HTMLElement | null): void => {
        setReactionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new EventTileActionBarViewModel({
                mxEvent,
                timelineRenderingType: roomContext.timelineRenderingType,
                canSendMessages: roomContext.canSendMessages,
                canReact: roomContext.canReact,
                isSearch,
                isCard,
                isQuoteExpanded,
                onToggleThreadExpanded: toggleThreadExpanded,
                onOptionsClick: handleOptionsClick,
                onReactionsClick: handleReactionsClick,
                getRelationsForEvent,
            }),
    );

    useEffect(() => {
        vm.setProps({
            mxEvent,
            timelineRenderingType: roomContext.timelineRenderingType,
            canSendMessages: roomContext.canSendMessages,
            canReact: roomContext.canReact,
            isSearch,
            isCard,
            isQuoteExpanded,
            getRelationsForEvent,
            onToggleThreadExpanded: toggleThreadExpanded,
            onOptionsClick: handleOptionsClick,
            onReactionsClick: handleReactionsClick,
        });
    }, [
        vm,
        mxEvent,
        roomContext.timelineRenderingType,
        roomContext.canSendMessages,
        roomContext.canReact,
        isSearch,
        isCard,
        isQuoteExpanded,
        getRelationsForEvent,
        handleOptionsClick,
        handleReactionsClick,
        toggleThreadExpanded,
    ]);

    useEffect(() => {
        onFocusChange?.(Boolean(optionsMenuAnchorRect || reactionsMenuAnchorRect));
    }, [onFocusChange, optionsMenuAnchorRect, reactionsMenuAnchorRect]);

    useEffect(() => {
        setOptionsMenuAnchorRect(null);
        setReactionsMenuAnchorRect(null);
    }, [mxEvent]);

    const closeOptionsMenu = useCallback((): void => {
        setOptionsMenuAnchorRect(null);
    }, []);

    const closeReactionsMenu = useCallback((): void => {
        setReactionsMenuAnchorRect(null);
    }, []);

    const replyChain = replyChainRef.current;
    const collapseReplyChain = replyChain?.canCollapse() ? replyChain.collapse : undefined;

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            {optionsMenuAnchorRect ? (
                <MessageContextMenu
                    {...aboveLeftOf(optionsMenuAnchorRect)}
                    mxEvent={mxEvent}
                    permalinkCreator={permalinkCreator}
                    eventTileOps={tileRef.current ?? undefined}
                    collapseReplyChain={collapseReplyChain}
                    onFinished={closeOptionsMenu}
                    getRelationsForEvent={getRelationsForEvent}
                />
            ) : null}
            {reactionsMenuAnchorRect ? (
                <ContextMenu
                    {...aboveLeftOf(reactionsMenuAnchorRect)}
                    onFinished={closeReactionsMenu}
                    managed={false}
                    focusLock
                >
                    <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionsMenu} />
                </ContextMenu>
            ) : null}
        </>
    );
}
