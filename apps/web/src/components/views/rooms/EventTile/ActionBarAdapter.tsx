/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useEffect, useState, type JSX } from "react";
import { type MatrixEvent, type Relations } from "matrix-js-sdk/src/matrix";
import { ActionBarView } from "@element-hq/web-shared-components";

import type ReplyChain from "../../elements/ReplyChain";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import RoomContext from "../../../../contexts/RoomContext";
import { CardContext } from "../../right_panel/context";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type EventTileViewModel } from "../../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import { type GetRelationsForEvent } from "../../../../viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";

/**
 * Operations exposed by the event tile for action bar interactions.
 */
interface ActionBarEventTileOps {
    /** Returns whether the widget is currently hidden. */
    isWidgetHidden(): boolean;
    /** Unhides the widget if it was previously hidden. */
    unhideWidget(): void;
}

/**
 * Event tile handle used by the action bar to query tile-level operations.
 */
interface ActionBarEventTile {
    /** Returns the available tile operations, if any. */
    getEventTileOps?(): ActionBarEventTileOps;
}

/**
 * Props for the {@link ActionBarAdapter} component.
 */
interface ActionBarAdapterProps {
    /** View model backing the event tile action bar. */
    eventTileViewModel: EventTileViewModel;
    /** Matrix event rendered by this tile. */
    mxEvent: MatrixEvent;
    /** Reaction relation state for the event, if available. */
    reactions?: Relations | null;
    /** Creates permalinks for the room, when link actions are shown. */
    permalinkCreator?: RoomPermalinkCreator;
    /** Returns the current tile instance for event tile operations. */
    getTile: () => ActionBarEventTile | null;
    /** Returns the current reply chain for the tile, if any. */
    getReplyChain: () => ReplyChain | null;
    /** Notifies the parent when the action bar gains or loses focus. */
    onFocusChange?: (focused: boolean) => void;
    /** Indicates whether the event quote is currently expanded. */
    isQuoteExpanded?: boolean;
    /** Toggles the thread expansion state for this tile. */
    toggleThreadExpanded: () => void;
    /** Looks up relation data for the current event. */
    getRelationsForEvent?: GetRelationsForEvent;
}

/**
 * Renders the event tile action bar and its context menus.
 */
export function ActionBarAdapter({
    eventTileViewModel,
    mxEvent,
    reactions,
    permalinkCreator,
    getTile,
    getReplyChain,
    onFocusChange,
    isQuoteExpanded,
    toggleThreadExpanded,
    getRelationsForEvent,
}: Readonly<ActionBarAdapterProps>): JSX.Element {
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
    const vm = eventTileViewModel.getActionBarViewModel({
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
    });

    useEffect(() => {
        // This child VM owns Matrix and settings listeners, so release it when the view using it leaves the tree.
        return () => eventTileViewModel.releaseActionBarViewModel();
    }, [eventTileViewModel]);

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

    const tile = getTile();
    const replyChain = getReplyChain();
    const eventTileOps = tile?.getEventTileOps ? tile.getEventTileOps() : undefined;
    const collapseReplyChain = replyChain?.canCollapse() ? replyChain.collapse : undefined;

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            {optionsMenuAnchorRect ? (
                <MessageContextMenu
                    {...aboveLeftOf(optionsMenuAnchorRect)}
                    mxEvent={mxEvent}
                    permalinkCreator={permalinkCreator}
                    eventTileOps={eventTileOps}
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
