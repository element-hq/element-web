/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState, type JSX } from "react";
import { type MatrixEvent, type Relations } from "matrix-js-sdk/src/matrix";
import { ActionBarView } from "@element-hq/web-shared-components";

import type ReplyChain from "../../elements/ReplyChain";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { type GetRelationsForEvent } from "../../../../viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";
import { type EventTileActionBarViewModel } from "../../../../viewmodels/room/EventTileActionBarViewModel";

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

interface ActionBarMenusProps {
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    optionsMenuAnchorRect: DOMRect | null;
    reactionsMenuAnchorRect: DOMRect | null;
    closeOptionsMenu: () => void;
    closeReactionsMenu: () => void;
    getTile: () => ActionBarEventTile | null;
    getReplyChain: () => ReplyChain | null;
    getRelationsForEvent?: GetRelationsForEvent;
}

function ActionBarMenus({
    mxEvent,
    reactions,
    permalinkCreator,
    optionsMenuAnchorRect,
    reactionsMenuAnchorRect,
    closeOptionsMenu,
    closeReactionsMenu,
    getTile,
    getReplyChain,
    getRelationsForEvent,
}: Readonly<ActionBarMenusProps>): JSX.Element | null {
    const tile = getTile();
    const replyChain = getReplyChain();
    const eventTileOps = tile?.getEventTileOps ? tile.getEventTileOps() : undefined;
    const collapseReplyChain = replyChain?.canCollapse() ? replyChain.collapse : undefined;

    if (!optionsMenuAnchorRect && !reactionsMenuAnchorRect) {
        return null;
    }

    return (
        <>
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

/**
 * Props for the {@link ActionBarAdapter} component.
 */
interface ActionBarAdapterProps {
    /** View model owned by the parent event tile container. */
    vm: EventTileActionBarViewModel;
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
    /** Indicates whether the quoted reply chain is expanded. */
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
    vm,
    mxEvent,
    reactions,
    permalinkCreator,
    getTile,
    getReplyChain,
    onFocusChange,
    isQuoteExpanded: _isQuoteExpanded,
    toggleThreadExpanded: _toggleThreadExpanded,
    getRelationsForEvent,
}: Readonly<ActionBarAdapterProps>): JSX.Element {
    const [optionsMenuAnchorRect, setOptionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const [reactionsMenuAnchorRect, setReactionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const handleOptionsClick = useCallback((anchor: HTMLElement | null): void => {
        setOptionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);
    const handleReactionsClick = useCallback((anchor: HTMLElement | null): void => {
        setReactionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);

    useEffect(() => {
        vm.setMenuClickHandlers({
            onOptionsClick: handleOptionsClick,
            onReactionsClick: handleReactionsClick,
        });

        return () => {
            vm.setMenuClickHandlers({
                onOptionsClick: undefined,
                onReactionsClick: undefined,
            });
        };
    }, [vm, handleOptionsClick, handleReactionsClick]);

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

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            <ActionBarMenus
                mxEvent={mxEvent}
                reactions={reactions}
                permalinkCreator={permalinkCreator}
                optionsMenuAnchorRect={optionsMenuAnchorRect}
                reactionsMenuAnchorRect={reactionsMenuAnchorRect}
                closeOptionsMenu={closeOptionsMenu}
                closeReactionsMenu={closeReactionsMenu}
                getTile={getTile}
                getReplyChain={getReplyChain}
                getRelationsForEvent={getRelationsForEvent}
            />
        </>
    );
}
