/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useContext, useEffect, useMemo, useState, type JSX } from "react";
import { ActionBarView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import RoomContext from "../../../../contexts/RoomContext";
import { EventTileActionBarViewModel } from "../../../../viewmodels/room/timeline/event-tile/actions/EventTileActionBarViewModel";
import type { EventTileActionBarViewModelProps } from "../../../../viewmodels/room/timeline/event-tile/actions/EventTileActionBarViewModel";
import type ReplyChain from "../../elements/ReplyChain";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf } from "../../../structures/ContextMenu";
import ReactionPicker from "../../emojipicker/ReactionPicker";
import { CardContext } from "../../right_panel/context";
import type { EventTileOps, GetRelationsForEvent } from "./types";

type ActionBarProps = {
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    isQuoteExpanded?: boolean;
    tileRef: React.RefObject<EventTileOps | null>;
    replyChainRef: React.RefObject<ReplyChain | null>;
    onFocusChange: (focused: boolean) => void;
    toggleThreadExpanded: () => void;
};

function buildEventTileActionBarViewModelProps(
    props: Pick<ActionBarProps, "mxEvent" | "isQuoteExpanded" | "getRelationsForEvent" | "toggleThreadExpanded">,
    roomContext: Pick<React.ContextType<typeof RoomContext>, "timelineRenderingType" | "canSendMessages" | "canReact">,
    isSearch: boolean,
    isCard: boolean,
    handleOptionsClick: NonNullable<EventTileActionBarViewModelProps["onOptionsClick"]>,
    handleReactionsClick: NonNullable<EventTileActionBarViewModelProps["onReactionsClick"]>,
): EventTileActionBarViewModelProps {
    return {
        mxEvent: props.mxEvent,
        timelineRenderingType: roomContext.timelineRenderingType,
        canSendMessages: roomContext.canSendMessages,
        canReact: roomContext.canReact,
        isSearch,
        isCard,
        isQuoteExpanded: props.isQuoteExpanded,
        onToggleThreadExpanded: props.toggleThreadExpanded,
        onOptionsClick: handleOptionsClick,
        onReactionsClick: handleReactionsClick,
        getRelationsForEvent: props.getRelationsForEvent,
    };
}

export function ActionBar({
    mxEvent,
    reactions,
    permalinkCreator,
    getRelationsForEvent,
    isQuoteExpanded,
    tileRef,
    replyChainRef,
    onFocusChange,
    toggleThreadExpanded,
}: Readonly<ActionBarProps>): JSX.Element {
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
    const actionBarViewModelProps = useMemo(
        () =>
            buildEventTileActionBarViewModelProps(
                { mxEvent, isQuoteExpanded, getRelationsForEvent, toggleThreadExpanded },
                roomContext,
                isSearch,
                isCard,
                handleOptionsClick,
                handleReactionsClick,
            ),
        [
            mxEvent,
            isQuoteExpanded,
            getRelationsForEvent,
            toggleThreadExpanded,
            roomContext,
            isSearch,
            isCard,
            handleOptionsClick,
            handleReactionsClick,
        ],
    );
    const vm = useCreateAutoDisposedViewModel(() => new EventTileActionBarViewModel(actionBarViewModelProps));

    useEffect(() => {
        vm.setProps(actionBarViewModelProps);
    }, [vm, actionBarViewModelProps]);
    useEffect(() => {
        onFocusChange(Boolean(optionsMenuAnchorRect || reactionsMenuAnchorRect));
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
    const collapseReplyChain = replyChainRef.current?.canCollapse() ? replyChainRef.current.collapse : undefined;

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
